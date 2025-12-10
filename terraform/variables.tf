variable "project_id" {
  description = "The GCP Project ID to deploy to"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP Zone (must support the chosen GPU)"
  type        = string
  default     = "us-central1-a"
}

variable "machine_type" {
  description = "Compute Engine machine type"
  type        = string
  # g2-standard-4 is optimized for L4 GPUs. Use n1-standard-4 for T4.
  default     = "g2-standard-4"
}

variable "gpu_type" {
  description = "Type of GPU to attach"
  type        = string
  # nvidia-l4 or nvidia-tesla-t4
  default     = "nvidia-l4"
}

variable "hf_token" {
  description = "Hugging Face Hub Token (for downloading Llama-2)"
  type        = string
  sensitive   = true
}

variable "mongodb_uri" {
  description = "MongoDB connection string for logging remote chats (optional)"
  type        = string
  default     = ""
}

variable "mongodb_db" {
  description = "MongoDB database name for logging remote chats"
  type        = string
  default     = "webllm"
}

variable "mongodb_collection" {
  description = "MongoDB collection name for logging remote chats"
  type        = string
  default     = "remote_messages"
}

