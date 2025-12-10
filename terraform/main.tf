terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# Enable Compute Engine API
resource "google_project_service" "compute" {
  service = "compute.googleapis.com"
  disable_on_destroy = false
}

# Network
resource "google_compute_network" "vpc_network" {
  name = "webllm-bench-network"
  auto_create_subnetworks = true
  depends_on = [google_project_service.compute]
}

# Firewall: Allow SSH and API ports
resource "google_compute_firewall" "allow_webllm" {
  name    = "allow-webllm-bench"
  network = google_compute_network.vpc_network.name

  allow {
    protocol = "tcp"
    ports    = ["22", "8000", "8001"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["webllm-bench-node"]
}

# VM Instance with GPU
resource "google_compute_instance" "vm_instance" {
  name         = "webllm-bench-gpu-vm"
  machine_type = var.machine_type
  zone         = var.zone

  tags = ["webllm-bench-node"]

  boot_disk {
    initialize_params {
      # Deep Learning Image: Has Docker + NVIDIA drivers (CUDA 12.8)
      image = "projects/deeplearning-platform-release/global/images/family/common-cu128-ubuntu-2204-nvidia-570"
      size  = 100
      type  = "pd-balanced"
    }
  }

  network_interface {
    network = google_compute_network.vpc_network.name
    access_config {
      # Ephemeral public IP
    }
  }

  guest_accelerator {
    type  = var.gpu_type
    count = 1
  }

  # Scheduling required for GPUs
  scheduling {
    on_host_maintenance = "TERMINATE"
    automatic_restart   = true
  }

  metadata = {
    # Install Docker Compose and setup repo
    startup-script = <<-EOF
      #! /bin/bash
      echo "Starting setup..."
      
      # Wait for apt lock
      sleep 10

      # Install Docker Compose (if not present)
      apt-get update
      apt-get install -y docker-compose-plugin

      # Create app directory and metrics directory
      mkdir -p /home/jupyter/webllm-chat
      mkdir -p /home/jupyter/webllm-chat/metrics
      cd /home/jupyter/webllm-chat

      # NOTE: In a real automated setup, you would git clone your repo here.
      # For now, we just prepare the directory so you can SCP your files or git clone manually.
      # Or we can write the docker-compose.yml directly here:
      
      cat <<EOT > docker-compose.yml
      version: '3.8'
      services:
        vllm:
          image: vllm/vllm-openai:latest
          runtime: nvidia
          ports:
            - "8000:8000"
          environment:
            - HUGGING_FACE_HUB_TOKEN=${var.hf_token}
          volumes:
            - ~/.cache/huggingface:/root/.cache/huggingface
          command: --model meta-llama/Llama-2-7b-chat-hf --host 0.0.0.0 --port 8000 --dtype float16 
          deploy:
            resources:
              reservations:
                devices:
                  - driver: nvidia
                    count: 1
                    capabilities: [gpu]

        mongodb:
          image: mongo:7.0
          ports:
            - "27017:27017"
          volumes:
            - mongodb_data:/data/db
          environment:
            - MONGO_INITDB_DATABASE=${var.mongodb_db}
          restart: unless-stopped

        api:
          build: ./api
          ports:
            - "8001:8001"
          environment:
            - VLLM_API_BASE=http://vllm:8000/v1
            - MODEL_NAME=meta-llama/Llama-2-7b-chat-hf
            - PORT=8001
            # MongoDB logging for remote chats (using local MongoDB service)
            - MONGODB_URI=${var.mongodb_uri != "" ? var.mongodb_uri : "mongodb://mongodb:27017/${var.mongodb_db}"}
            - MONGODB_DB=${var.mongodb_db}
            - MONGODB_COLLECTION=${var.mongodb_collection}
          volumes:
            - ./metrics:/app/metrics
          depends_on:
            - vllm
            - mongodb

      volumes:
        mongodb_data:
      EOT
      
      echo "Setup complete. Upload your api/ folder code and run 'docker compose up -d'"
    EOF
  }

  service_account {
    scopes = ["cloud-platform"]
  }
}

