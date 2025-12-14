# Quick Start Deployment

## Prerequisites Checklist

- [ ] GCP Project ID: `gcloud config get-value project`
- [ ] Hugging Face Token: https://huggingface.co/settings/tokens
- [ ] Llama-2 Access: https://huggingface.co/meta-llama/Llama-2-7b-chat-hf (request access)
- [ ] Billing enabled on GCP project

## 5-Minute Deployment

```bash
# 1. Configure Terraform
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your project_id and hf_token

# 2. Deploy infrastructure
terraform init
terraform apply

# 3. Get VM IP
VM_IP=$(terraform output -raw external_ip)
echo "VM IP: $VM_IP"

# 4. Upload code
cd ..
scp -r api/ jupyter@$VM_IP:/home/jupyter/webllm-chat/
scp docker-compose.yml jupyter@$VM_IP:/home/jupyter/webllm-chat/

# 5. SSH and start services
gcloud compute ssh webllm-bench-gpu-vm --zone us-central1-a << 'EOF'
cd /home/jupyter/webllm-chat
export HUGGING_FACE_HUB_TOKEN="YOUR_TOKEN_HERE"
docker compose up -d
docker compose logs -f
EOF

# 6. Configure frontend
cd client
echo "VITE_REMOTE_API_URL=http://$VM_IP:8001/api/chat" > .env
npm run dev
```

## Verify Deployment

```bash
# Test API
curl http://$VM_IP:8001/health

# Test chat (should stream)
curl -X POST http://$VM_IP:8001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello!"}],"stream":true}'
```

## Stop VM (Save Costs)

```bash
gcloud compute instances stop webllm-bench-gpu-vm --zone us-central1-a
```

## Start VM Again

```bash
gcloud compute instances start webllm-bench-gpu-vm --zone us-central1-a
# Wait 2-3 minutes, then services should auto-start if configured
```

## Destroy Everything

```bash
cd terraform
terraform destroy
```

