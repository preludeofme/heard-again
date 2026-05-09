output "ui_url" {
  description = "Cloud Run URL for the UI service"
  value       = google_cloud_run_v2_service.ui.uri
}

output "db_connection_name" {
  description = "Cloud SQL instance connection name for Cloud SQL Auth Proxy"
  value       = google_sql_database_instance.postgres.connection_name
}

output "db_private_ip" {
  description = "Cloud SQL private IP address"
  value       = google_sql_database_instance.postgres.private_ip_address
  sensitive   = true
}

output "redis_host" {
  description = "Memorystore Redis host"
  value       = google_redis_instance.cache.host
  sensitive   = true
}

output "redis_port" {
  description = "Memorystore Redis port"
  value       = google_redis_instance.cache.port
}

output "uploads_bucket" {
  description = "GCS bucket for user uploads"
  value       = google_storage_bucket.uploads.name
}

output "generated_audio_bucket" {
  description = "GCS bucket for TTS-generated audio"
  value       = google_storage_bucket.generated_audio.name
}

output "tts_models_bucket" {
  description = "GCS bucket for TTS model weights"
  value       = google_storage_bucket.tts_models.name
}

output "artifact_registry" {
  description = "Artifact Registry repository URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${local.prefix}"
}

output "gke_cluster_name" {
  description = "GKE cluster name"
  value       = google_container_cluster.gpu_cluster.name
}

output "ui_service_account" {
  description = "UI service account email"
  value       = google_service_account.ui.email
}

output "chat_service_account" {
  description = "Chat service account email"
  value       = google_service_account.chat.email
}

output "tts_service_account" {
  description = "TTS service account email"
  value       = google_service_account.tts.email
}

output "worker_service_account" {
  description = "Narration worker service account email"
  value       = google_service_account.worker.email
}

output "audio_cdn_ip" {
  description = "Global IP address for the generated-audio CDN load balancer (empty when cdn_domain is unset)"
  value       = var.cdn_domain != "" ? google_compute_global_address.audio_cdn_ip[0].address : ""
}

output "alert_notification_channel" {
  description = "Cloud Monitoring notification channel ID for alerts"
  value       = var.alert_notification_email != "" ? google_monitoring_notification_channel.email[0].id : ""
}

output "tts_internal_ip" {
  description = "Static internal IP reserved for the TTS GKE internal load balancer"
  value       = google_compute_address.tts_internal_ip.address
}
