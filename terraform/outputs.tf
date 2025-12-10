output "instance_name" {
  description = "Name of the VM instance"
  value       = google_compute_instance.vm_instance.name
}

output "external_ip" {
  description = "External IP address of the benchmark server"
  value       = google_compute_instance.vm_instance.network_interface[0].access_config[0].nat_ip
}

output "ssh_command" {
  description = "Command to SSH into the VM"
  value       = "gcloud compute ssh ${google_compute_instance.vm_instance.name} --zone ${var.zone}"
}

output "api_url" {
  description = "URL for the remote API (Metrics + Chat)"
  value       = "http://${google_compute_instance.vm_instance.network_interface[0].access_config[0].nat_ip}:8001/api/chat"
}

