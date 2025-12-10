# Deployment Guide for WebLLM Chat

This guide walks you through deploying the remote inference backend to Google Cloud Platform.

## Prerequisites

1. **GCP Account & Project**
   - Create a GCP project or use an existing one
   - Enable billing (required for GPU instances)
   - Note your Project ID

2. **Hugging Face Token**
   - Sign up at https://huggingface.co
   - Go to Settings → Access Tokens
   - Create a token with **read** access
   - Request access to Llama-2: https://huggingface.co/meta-llama/Llama-2-7b-chat-hf
   - Wait for approval (usually instant for Llama-2)

3. **Google Cloud SDK**
   ```bash
   # Install gcloud CLI if not already installed
   # macOS:
   brew install google-cloud-sdk
   
   # Initialize
   gcloud init
   gcloud auth login
   ```

4. **Terraform**
   ```bash
   # Install Terraform if not already installed
   # macOS:
   brew install terraform
   ```

## Step 1: Configure Terraform Variables

1. Copy the example file:
   ```bash
   cd terraform
   cp terraform.tfvars.example terraform.tfvars
   ```

2. Edit `terraform.tfvars` with your values:
   ```hcl
   project_id = "your-gcp-project-id"           # Required: Your GCP Project ID
   hf_token   = "hf_your_hugging_face_token"    # Required: Hugging Face token
   
   # Optional (defaults shown - adjust if needed)
   region     = "us-central1"                   # GCP region
   zone       = "us-central1-a"                 # Zone (must support your GPU)
   machine_type = "g2-standard-4"               # For L4 GPU
   gpu_type   = "nvidia-l4"                     # GPU: nvidia-l4 or nvidia-tesla-t4
   ```

3. **Get your GCP Project ID:**
   ```bash
   gcloud config get-value project
   ```

4. **Check GPU availability in your region:**
   ```bash
   gcloud compute accelerator-types list --filter="zone:us-central1"
   ```

## Step 2: Deploy Infrastructure

1. **Initialize Terraform:**
   ```bash
   cd terraform
   terraform init
   ```

2. **Review the deployment plan:**
   ```bash
   terraform plan
   ```
   This will show you what resources will be created (VM, network, firewall rules).

3. **Deploy:**
   ```bash
   terraform apply
   ```
   Type `yes` when prompted. This will take 5-10 minutes.

4. **Get the VM IP address:**
   ```bash
   terraform output external_ip
   terraform output api_url
   ```

## Step 3: Upload Code to VM

1. **SSH into the VM:**
   ```bash
   terraform output ssh_command
   # Or manually:
   gcloud compute ssh webllm-bench-gpu-vm --zone us-central1-a
   ```

2. **Once inside the VM, set up the project:**
   ```bash
   # The startup script already created the directory
   cd /home/jupyter/webllm-chat
   
   # Install git if needed
   sudo apt-get update
   sudo apt-get install -y git
   
   # Option A: Clone your repo (if it's in a git repository)
   git clone <your-repo-url> .
   
   # Option B: Upload files manually using SCP (from your local machine)
   # Exit the VM first, then from your local machine:
   ```

3. **From your local machine, upload the code:**
   ```bash
   # Get the VM IP
   VM_IP=$(terraform -chdir=terraform output -raw external_ip)
   
   # Upload the api directory
   scp -r api/ jupyter@$VM_IP:/home/jupyter/webllm-chat/
   
   # Upload docker-compose.yml
   scp docker-compose.yml jupyter@$VM_IP:/home/jupyter/webllm-chat/
   ```

## Step 4: Start Services on VM

1. **SSH back into the VM:**
   ```bash
   gcloud compute ssh webllm-bench-gpu-vm --zone us-central1-a
   cd /home/jupyter/webllm-chat
   ```

2. **Set environment variable for Hugging Face token:**
   ```bash
   export HUGGING_FACE_HUB_TOKEN="your-hf-token-here"
   ```

3. **Start the services:**
   ```bash
   docker compose up -d
   ```

4. **Check logs:**
   ```bash
   # Check vLLM logs
   docker compose logs -f vllm
   
   # Check API logs
   docker compose logs -f api
   ```

5. **Verify services are running:**
   ```bash
   docker compose ps
   ```

   You should see both `vllm` and `api` services running.

## Step 5: Configure Frontend

1. **Get the API URL:**
   ```bash
   cd terraform
   terraform output api_url
   # Example output: http://34.123.45.67:8001/api/chat
   ```

2. **Update frontend environment:**
   ```bash
   cd client
   # Create or edit .env file
   echo "VITE_REMOTE_API_URL=http://YOUR_VM_IP:8001/api/chat" > .env
   ```

3. **Test locally:**
   ```bash
   npm run dev
   ```
   Switch to "Remote" mode and send a test message.

## Step 6: Verify Deployment

1. **Test the API directly:**
   ```bash
   curl -X POST http://YOUR_VM_IP:8001/api/chat \
     -H "Content-Type: application/json" \
     -d '{
       "messages": [{"role": "user", "content": "Hello!"}],
       "stream": true
     }'
   ```

2. **Check health endpoint:**
   ```bash
   curl http://YOUR_VM_IP:8001/health
   ```

3. **View metrics (if any requests were made):**
   ```bash
   # SSH into VM
   cat /home/jupyter/webllm-chat/metrics/benchmark_metrics.csv
   ```

## Troubleshooting

### GPU Not Available
- Check GPU quota: `gcloud compute project-info describe --project=YOUR_PROJECT_ID`
- Request quota increase if needed
- Try a different zone: `gcloud compute accelerator-types list`

### vLLM Fails to Start
- Check logs: `docker compose logs vllm`
- Verify Hugging Face token is set correctly
- Check GPU is detected: `nvidia-smi` (inside VM)

### API Not Responding
- Check firewall rules allow port 8001
- Verify API container is running: `docker compose ps`
- Check API logs: `docker compose logs api`

### Model Download Issues
- Verify Hugging Face token has access to Llama-2
- Check network connectivity from VM
- Model download happens on first start (can take 10-20 minutes)

## Cost Management

**Important:** GPU instances are expensive! (~$0.50-2.00/hour depending on GPU)

- **Stop the VM when not in use:**
  ```bash
  gcloud compute instances stop webllm-bench-gpu-vm --zone us-central1-a
  ```

- **Start it again:**
  ```bash
  gcloud compute instances start webllm-bench-gpu-vm --zone us-central1-a
  ```

- **Destroy everything (when done with project):**
  ```bash
  cd terraform
  terraform destroy
  ```

## Next Steps

1. ✅ Deploy infrastructure
2. ✅ Upload code and start services
3. ✅ Test remote inference
4. ✅ Run benchmarks comparing local vs remote
5. ✅ Present your findings!

## Model Information

- **Local (WebLLM):** Llama-3.2-3B-Instruct-q4f32_1-MLC (runs in browser)
- **Remote (vLLM):** meta-llama/Llama-2-7b-chat-hf (runs on GCP GPU)

Both models are similar in size and purpose to the TinyLLaMa models mentioned in your project document.

