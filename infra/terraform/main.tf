terraform {
  required_version = ">= 1.6"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }

  backend "gcs" {}
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

locals {
  prefix = "${var.app_name}-${var.environment}"
  labels = {
    app         = var.app_name
    environment = var.environment
    managed-by  = "terraform"
  }
}

# ─── APIs ────────────────────────────────────────────────────────────────────

resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "container.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "storage.googleapis.com",
    "secretmanager.googleapis.com",
    "vpcaccess.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "compute.googleapis.com",
    "servicenetworking.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "monitoring.googleapis.com",
  ])

  service            = each.value
  disable_on_destroy = false
}

# ─── VPC ─────────────────────────────────────────────────────────────────────

resource "google_compute_network" "vpc" {
  name                    = "${local.prefix}-vpc"
  auto_create_subnetworks = false
  depends_on              = [google_project_service.apis]
}

resource "google_compute_subnetwork" "primary" {
  name          = "${local.prefix}-subnet"
  ip_cidr_range = "10.0.0.0/20"
  region        = var.region
  network       = google_compute_network.vpc.id

  secondary_ip_range {
    range_name    = "gke-pods"
    ip_cidr_range = "10.1.0.0/16"
  }

  secondary_ip_range {
    range_name    = "gke-services"
    ip_cidr_range = "10.2.0.0/20"
  }

  private_ip_google_access = true
}

# Private service access for Cloud SQL + Memorystore
resource "google_compute_global_address" "private_ip_range" {
  name          = "${local.prefix}-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 20
  network       = google_compute_network.vpc.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
  depends_on              = [google_project_service.apis]
}

# VPC Connector for Cloud Run → private resources
resource "google_vpc_access_connector" "connector" {
  name           = "${var.app_name}-${var.environment}-conn"
  region         = var.region
  ip_cidr_range  = "10.3.0.0/28"
  network        = google_compute_network.vpc.name
  min_instances  = 2
  max_instances  = 10
  machine_type   = "e2-micro"
  max_throughput = 1000
}

# Static internal IP for TTS internal load balancer (GKE → Cloud Run reachable via VPC)
resource "google_compute_address" "tts_internal_ip" {
  name         = "${local.prefix}-tts-ip"
  subnetwork   = google_compute_subnetwork.primary.id
  address_type = "INTERNAL"
  address      = "10.0.15.200"
  region       = var.region
  depends_on   = [google_compute_subnetwork.primary]
}

resource "google_compute_address" "ollama_internal_ip" {
  name         = "${local.prefix}-ollama-ip"
  subnetwork   = google_compute_subnetwork.primary.id
  address_type = "INTERNAL"
  address      = "10.0.15.201"
  region       = var.region
  depends_on   = [google_compute_subnetwork.primary]
}

resource "google_compute_address" "chroma_internal_ip" {
  name         = "${local.prefix}-chroma-ip"
  subnetwork   = google_compute_subnetwork.primary.id
  address_type = "INTERNAL"
  address      = "10.0.15.202"
  region       = var.region
  depends_on   = [google_compute_subnetwork.primary]
}

# ─── Artifact Registry ───────────────────────────────────────────────────────

resource "google_artifact_registry_repository" "images" {
  location      = var.region
  repository_id = local.prefix
  format        = "DOCKER"
  labels        = local.labels
  depends_on    = [google_project_service.apis]
}

# ─── Cloud SQL (PostgreSQL 15) ───────────────────────────────────────────────

resource "google_sql_database_instance" "postgres" {
  name             = "${local.prefix}-db"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier              = "db-custom-2-7680"
    availability_type = "REGIONAL"
    disk_type         = "PD_SSD"
    disk_size         = 50
    disk_autoresize   = true

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.vpc.id
      enable_private_path_for_google_cloud_services = true
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "03:00"
      backup_retention_settings {
        retained_backups = 7
      }
    }

    maintenance_window {
      day          = 7
      hour         = 4
      update_track = "stable"
    }

    insights_config {
      query_insights_enabled = true
    }
  }

  deletion_protection = true
  depends_on          = [google_service_networking_connection.private_vpc_connection]
}

resource "google_sql_database" "heard_again" {
  name     = "heard_again"
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "postgres" {
  name     = "postgres"
  instance = google_sql_database_instance.postgres.name
  password = var.postgres_password
}

# ─── Cloud Memorystore (Redis) ───────────────────────────────────────────────

resource "google_redis_instance" "cache" {
  name           = "${local.prefix}-redis"
  tier           = "STANDARD_HA"
  memory_size_gb = 2
  region         = var.region

  authorized_network = google_compute_network.vpc.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"

  redis_version  = "REDIS_7_0"
  auth_enabled   = true
  transit_encryption_mode = "SERVER_AUTHENTICATION"

  labels     = local.labels
  depends_on = [google_service_networking_connection.private_vpc_connection]
}

# ─── GCS Buckets ─────────────────────────────────────────────────────────────

resource "google_storage_bucket" "uploads" {
  name          = "${local.prefix}-uploads"
  location      = var.region
  force_destroy = false
  labels        = local.labels

  uniform_bucket_level_access = true

  versioning {
    enabled = false
  }

  cors {
    origin          = ["https://heardagain.com"]
    method          = ["GET", "PUT", "POST"]
    response_header = ["Content-Type", "Authorization"]
    max_age_seconds = 3600
  }
}

resource "google_storage_bucket" "generated_audio" {
  name          = "${local.prefix}-generated-audio"
  location      = var.region
  force_destroy = false
  labels        = local.labels

  uniform_bucket_level_access = true

  lifecycle_rule {
    action { type = "Delete" }
    condition { age = 7 }
  }
}

resource "google_storage_bucket" "tts_models" {
  name          = "${local.prefix}-tts-models"
  location      = var.region
  force_destroy = false
  labels        = local.labels

  uniform_bucket_level_access = true
}

# ─── Service Accounts ────────────────────────────────────────────────────────

resource "google_service_account" "ui" {
  account_id   = "${local.prefix}-ui"
  display_name = "Heard Again UI Service"
}

resource "google_service_account" "chat" {
  account_id   = "${local.prefix}-chat"
  display_name = "Heard Again Chat Service"
}

resource "google_service_account" "worker" {
  account_id   = "${local.prefix}-worker"
  display_name = "Heard Again Narration Worker"
}

resource "google_service_account" "tts" {
  account_id   = "${local.prefix}-tts"
  display_name = "Heard Again TTS Service"
}

# UI: uploads bucket (read + write), generated-audio bucket (read), Cloud SQL
resource "google_storage_bucket_iam_member" "ui_uploads_admin" {
  bucket = google_storage_bucket.uploads.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.ui.email}"
}

resource "google_storage_bucket_iam_member" "ui_audio_viewer" {
  bucket = google_storage_bucket.generated_audio.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.ui.email}"
}

resource "google_project_iam_member" "ui_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.ui.email}"
}

# Chat: uploads bucket (read), Cloud SQL
resource "google_storage_bucket_iam_member" "chat_uploads_viewer" {
  bucket = google_storage_bucket.uploads.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.chat.email}"
}

resource "google_project_iam_member" "chat_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.chat.email}"
}

# Worker: uploads (read), generated-audio (admin), Cloud SQL
resource "google_storage_bucket_iam_member" "worker_uploads_viewer" {
  bucket = google_storage_bucket.uploads.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_storage_bucket_iam_member" "worker_audio_admin" {
  bucket = google_storage_bucket.generated_audio.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_project_iam_member" "worker_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.worker.email}"
}

# TTS: Artifact Registry reader (needed for GKE node image pulls)
resource "google_project_iam_member" "tts_artifact_reader" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.tts.email}"
}

# TTS: tts-models (admin), generated-audio (admin)
resource "google_storage_bucket_iam_member" "tts_models_admin" {
  bucket = google_storage_bucket.tts_models.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.tts.email}"
}

resource "google_storage_bucket_iam_member" "tts_audio_admin" {
  bucket = google_storage_bucket.generated_audio.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.tts.email}"
}

# ─── Secret Manager ──────────────────────────────────────────────────────────

locals {
  secrets = {
    "postgres-password"    = var.postgres_password
    "database-url"         = "postgresql://postgres:${urlencode(var.postgres_password)}@localhost:5432/heard_again"
    "chroma-credentials"   = var.chroma_credentials
    "nextauth-secret"      = var.nextauth_secret
    "chat-service-secret"  = var.chat_service_secret
    "tts-service-token"    = var.tts_service_token
    "google-client-id"     = var.google_client_id
    "google-client-secret" = var.google_client_secret
  }
}

resource "google_secret_manager_secret" "secrets" {
  for_each  = local.secrets
  secret_id = "${local.prefix}-${each.key}"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "secret_values" {
  for_each    = local.secrets
  secret      = google_secret_manager_secret.secrets[each.key].id
  secret_data = each.value
}

# Grant each service account access to only the secrets it needs
resource "google_secret_manager_secret_iam_member" "ui_secrets" {
  for_each  = toset(["database-url", "nextauth-secret", "chat-service-secret", "tts-service-token", "google-client-id", "google-client-secret"])
  secret_id = google_secret_manager_secret.secrets[each.value].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.ui.email}"
}

resource "google_secret_manager_secret_iam_member" "chat_secrets" {
  for_each  = toset(["database-url", "chat-service-secret", "chroma-credentials"])
  secret_id = google_secret_manager_secret.secrets[each.value].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.chat.email}"
}

resource "google_secret_manager_secret_iam_member" "worker_secrets" {
  for_each  = toset(["database-url", "tts-service-token"])
  secret_id = google_secret_manager_secret.secrets[each.value].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_secret_manager_secret_iam_member" "tts_secrets" {
  for_each  = toset(["tts-service-token"])
  secret_id = google_secret_manager_secret.secrets[each.value].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.tts.email}"
}

# ─── GKE Cluster (GPU workloads: TTS + Ollama + ChromaDB) ────────────────────

resource "google_container_cluster" "gpu_cluster" {
  provider = google-beta
  name     = "${local.prefix}-cluster"
  location = var.zone

  remove_default_node_pool = true
  initial_node_count       = 1

  network    = google_compute_network.vpc.name
  subnetwork = google_compute_subnetwork.primary.name

  ip_allocation_policy {
    cluster_secondary_range_name  = "gke-pods"
    services_secondary_range_name = "gke-services"
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  addons_config {
    gce_persistent_disk_csi_driver_config {
      enabled = true
    }
  }

  deletion_protection = false

  depends_on = [google_project_service.apis]
}

resource "google_container_node_pool" "gpu_nodes" {
  provider       = google-beta
  name           = "gpu-pool"
  cluster        = google_container_cluster.gpu_cluster.name
  location       = var.zone
  node_locations = ["us-central1-b"]

  node_config {
    machine_type = "g2-standard-8"
    disk_size_gb = 200
    disk_type    = "pd-ssd"
    image_type   = "COS_CONTAINERD"
    preemptible  = true

    guest_accelerator {
      type  = "nvidia-l4"
      count = 1
      gpu_driver_installation_config {
        gpu_driver_version = "DEFAULT"
      }
    }

    service_account = google_service_account.tts.email
    oauth_scopes    = ["https://www.googleapis.com/auth/cloud-platform"]

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    labels = local.labels

    taint {
      key    = "nvidia.com/gpu"
      value  = "present"
      effect = "NO_SCHEDULE"
    }
  }

  autoscaling {
    total_min_node_count = 0
    total_max_node_count = var.gke_gpu_node_count
    location_policy      = "ANY"
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }
}

# ─── Cloud Run (UI + Chat) ────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "ui" {
  name     = "${local.prefix}-ui"
  location = var.region

  template {
    service_account = google_service_account.ui.email

    scaling {
      min_instance_count = 1
      max_instance_count = 10
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${local.prefix}/ui:latest"

      resources {
        limits = {
          cpu    = "2"
          memory = "2Gi"
        }
        cpu_idle = true
      }

      ports {
        container_port = 4777
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "STORAGE_MODE"
        value = "gcp"
      }
      env {
        name  = "GCP_BUCKET_NAME"
        value = google_storage_bucket.uploads.name
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "NEXTAUTH_URL"
        value = var.nextauth_url
      }
      env {
        name  = "NARRATION_WORKER_ENABLED"
        value = "false"
      }
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.secrets["database-url"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "NEXTAUTH_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.secrets["nextauth-secret"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "CHAT_SERVICE_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.secrets["chat-service-secret"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "TTS_SERVICE_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.secrets["tts-service-token"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name  = "REDIS_URL"
        value = "rediss://:${google_redis_instance.cache.auth_string}@${google_redis_instance.cache.host}:${google_redis_instance.cache.port}"
      }
      env {
        name  = "TTS_SERVICE_URL"
        value = "http://${google_compute_address.tts_internal_ip.address}:4779"
      }
      env {
        name = "GOOGLE_CLIENT_ID"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.secrets["google-client-id"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "GOOGLE_CLIENT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.secrets["google-client-secret"].secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        http_get {
          path = "/api/instance/health"
          port = 4777
        }
        initial_delay_seconds = 10
        period_seconds        = 5
        failure_threshold     = 10
      }

      liveness_probe {
        http_get {
          path = "/api/instance/health"
          port = 4777
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }

    # Cloud SQL Auth Proxy sidecar
    containers {
      image = "gcr.io/cloud-sql-connectors/cloud-sql-proxy:2"
      args  = ["--structured-logs", "--port=5432", "--private-ip", "${var.project_id}:${var.region}:${google_sql_database_instance.postgres.name}"]

      resources {
        limits = {
          cpu    = "0.5"
          memory = "256Mi"
        }
      }
    }
  }

  depends_on = [google_project_service.apis]
}

# Allow public access to UI Cloud Run service
resource "google_cloud_run_v2_service_iam_member" "ui_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.ui.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ─── Alert Notification Channel ──────────────────────────────────────────────

resource "google_monitoring_notification_channel" "email" {
  count        = var.alert_notification_email != "" ? 1 : 0
  display_name = "${local.prefix} Alerts"
  type         = "email"
  labels = {
    email_address = var.alert_notification_email
  }
  depends_on = [google_project_service.apis]
}

locals {
  alert_channels = var.alert_notification_email != "" ? [google_monitoring_notification_channel.email[0].id] : []
}

# ─── Alert Policies ──────────────────────────────────────────────────────────

# Cloud Run UI: 5xx error rate > 5% over 5 minutes
resource "google_monitoring_alert_policy" "ui_error_rate" {
  display_name = "${local.prefix} UI 5xx Error Rate"
  combiner     = "OR"

  conditions {
    display_name = "5xx rate > 5%"
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${google_cloud_run_v2_service.ui.name}\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.labels.response_code_class=\"5xx\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.05
      duration        = "300s"
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.labels.service_name"]
      }
    }
  }

  notification_channels = local.alert_channels
  depends_on            = [google_project_service.apis]
}


# Cloud Run UI: p95 request latency > 5 seconds
resource "google_monitoring_alert_policy" "ui_latency" {
  display_name = "${local.prefix} UI Request Latency p95"
  combiner     = "OR"

  conditions {
    display_name = "p95 latency > 5s"
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${google_cloud_run_v2_service.ui.name}\" AND metric.type=\"run.googleapis.com/request_latencies\""
      comparison      = "COMPARISON_GT"
      threshold_value = 5000
      duration        = "300s"
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_PERCENTILE_95"
        cross_series_reducer = "REDUCE_MEAN"
        group_by_fields      = ["resource.labels.service_name"]
      }
    }
  }

  notification_channels = local.alert_channels
  depends_on            = [google_project_service.apis]
}

# Cloud SQL: connection count approaching limit (> 400 of 500 default)
resource "google_monitoring_alert_policy" "cloudsql_connections" {
  display_name = "${local.prefix} Cloud SQL Connection Count"
  combiner     = "OR"

  conditions {
    display_name = "connections > 400"
    condition_threshold {
      filter          = "resource.type=\"cloudsql_database\" AND resource.labels.database_id=\"${var.project_id}:${google_sql_database_instance.postgres.name}\" AND metric.type=\"cloudsql.googleapis.com/database/postgresql/num_backends\""
      comparison      = "COMPARISON_GT"
      threshold_value = 400
      duration        = "120s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MAX"
      }
    }
  }

  notification_channels = local.alert_channels
  depends_on            = [google_project_service.apis]
}

# Memorystore Redis: memory usage > 80%
resource "google_monitoring_alert_policy" "redis_memory" {
  display_name = "${local.prefix} Redis Memory Usage"
  combiner     = "OR"

  conditions {
    display_name = "memory ratio > 80%"
    condition_threshold {
      filter          = "resource.type=\"redis_instance\" AND resource.labels.instance_id=\"${google_redis_instance.cache.name}\" AND metric.type=\"redis.googleapis.com/stats/memory/usage_ratio\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.8
      duration        = "120s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = local.alert_channels
  depends_on            = [google_project_service.apis]
}

# GKE: TTS pod restart count > 3 in 10 minutes (signals GPU OOM or crash loop)
resource "google_monitoring_alert_policy" "tts_pod_restarts" {
  display_name = "${local.prefix} TTS Pod Restarts"
  combiner     = "OR"

  conditions {
    display_name = "restart count > 3 in 10m"
    condition_threshold {
      filter          = "resource.type=\"k8s_container\" AND resource.labels.cluster_name=\"${google_container_cluster.gpu_cluster.name}\" AND resource.labels.namespace_name=\"heard-again\" AND metric.type=\"kubernetes.io/container/restart_count\""
      comparison      = "COMPARISON_GT"
      threshold_value = 3
      duration        = "600s"
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_DELTA"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.labels.pod_name"]
      }
    }
  }

  notification_channels = local.alert_channels
  depends_on            = [google_project_service.apis]
}

# ─── CDN for Generated Audio ─────────────────────────────────────────────────
# Routes GCS-served audio through Cloud CDN to reduce egress cost on repeated plays.
# Requires cdn_domain to be set and DNS pointed at cdn_ip output before provisioning.

resource "google_storage_bucket_iam_member" "generated_audio_public" {
  count  = var.cdn_domain != "" ? 1 : 0
  bucket = google_storage_bucket.generated_audio.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

resource "google_compute_backend_bucket" "audio_cdn" {
  count       = var.cdn_domain != "" ? 1 : 0
  name        = "${local.prefix}-audio-cdn"
  bucket_name = google_storage_bucket.generated_audio.name
  enable_cdn  = true

  cdn_policy {
    cache_mode        = "CACHE_ALL_STATIC"
    default_ttl       = 3600
    max_ttl           = 86400
    negative_caching  = true
  }
}

resource "google_compute_url_map" "audio_cdn" {
  count           = var.cdn_domain != "" ? 1 : 0
  name            = "${local.prefix}-audio-cdn"
  default_service = google_compute_backend_bucket.audio_cdn[0].id
}

resource "google_compute_managed_ssl_certificate" "audio_cdn" {
  count = var.cdn_domain != "" ? 1 : 0
  name  = "${local.prefix}-audio-cdn-cert"
  managed {
    domains = [var.cdn_domain]
  }
}

resource "google_compute_target_https_proxy" "audio_cdn" {
  count            = var.cdn_domain != "" ? 1 : 0
  name             = "${local.prefix}-audio-cdn-proxy"
  url_map          = google_compute_url_map.audio_cdn[0].id
  ssl_certificates = [google_compute_managed_ssl_certificate.audio_cdn[0].id]
}

resource "google_compute_global_address" "audio_cdn_ip" {
  count = var.cdn_domain != "" ? 1 : 0
  name  = "${local.prefix}-audio-cdn-ip"
}

resource "google_compute_global_forwarding_rule" "audio_cdn" {
  count                 = var.cdn_domain != "" ? 1 : 0
  name                  = "${local.prefix}-audio-cdn"
  ip_address            = google_compute_global_address.audio_cdn_ip[0].address
  port_range            = "443"
  target                = google_compute_target_https_proxy.audio_cdn[0].id
  load_balancing_scheme = "EXTERNAL"
}
