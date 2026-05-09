variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for all resources"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone for zonal resources (GKE node pool)"
  type        = string
  default     = "us-central1-a"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["prod", "staging", "dev"], var.environment)
    error_message = "environment must be prod, staging, or dev"
  }
}

variable "app_name" {
  description = "Application name prefix for all resources"
  type        = string
  default     = "heard-again"
}

variable "postgres_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}

variable "chroma_credentials" {
  description = "ChromaDB basic auth credentials (user:password)"
  type        = string
  sensitive   = true
}

variable "nextauth_secret" {
  description = "NextAuth JWT signing secret"
  type        = string
  sensitive   = true
}

variable "chat_service_secret" {
  description = "Shared secret for UI → Chat service auth"
  type        = string
  sensitive   = true
}

variable "tts_service_token" {
  description = "Bearer token for UI → TTS service auth"
  type        = string
  sensitive   = true
}

variable "nextauth_url" {
  description = "Public URL for NextAuth (e.g. https://heardagain.example.com)"
  type        = string
}

variable "gke_gpu_node_count" {
  description = "Number of GPU nodes in the GKE pool (0 to disable TTS/Ollama)"
  type        = number
  default     = 1
}

variable "alert_notification_email" {
  description = "Email address for Cloud Monitoring alert notifications"
  type        = string
  default     = ""
}

variable "cdn_domain" {
  description = "Custom domain for the generated-audio CDN (e.g. audio.heardagain.example.com). Leave empty to skip CDN provisioning."
  type        = string
  default     = ""
}

variable "google_client_id" {
  description = "Google OAuth 2.0 Client ID for NextAuth"
  type        = string
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth 2.0 Client Secret for NextAuth"
  type        = string
  sensitive   = true
}
