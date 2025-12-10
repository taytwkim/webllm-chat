# Google Cloud Values You Need

## Required Values (Must Have)

### 1. **Project ID** (Required)

This is the only value you MUST provide from GCP.

**How to get it:**

```bash
# If you have gcloud CLI installed:
gcloud config get-value project

# Or check in GCP Console:
# Go to: https://console.cloud.google.com
# Look at the top of the page - it shows your project name/ID
```

**Example:** `my-webllm-project-123456`

**What it looks like in terraform.tfvars:**

```hcl
project_id = "my-webllm-project-123456"
```

---

## Optional Values (Have Defaults, But You May Want to Change)

### 2. **Region** (Optional - Default: `us-central1`)

The GCP region where your VM will be created.

**Default:** `us-central1` (Iowa, USA)

**Other common options:**

- `us-east1` (South Carolina)
- `us-west1` (Oregon)
- `europe-west1` (Belgium)
- `asia-east1` (Taiwan)

**How to choose:**

- Pick the region closest to you/your users for lower latency
- Check GPU availability in that region

**What it looks like in terraform.tfvars:**

```hcl
region = "us-central1"  # Optional, defaults to us-central1
```

---

### 3. **Zone** (Optional - Default: `us-central1-a`)

The specific zone within the region. Must support your chosen GPU.

**Default:** `us-central1-a`

**How to check available zones with GPUs:**

```bash
# Check L4 GPU availability
gcloud compute accelerator-types list --filter="name:nvidia-l4"

# Check T4 GPU availability
gcloud compute accelerator-types list --filter="name:nvidia-tesla-t4"

# Check all GPUs in a specific region
gcloud compute accelerator-types list --filter="zone:us-central1"
```

**What it looks like in terraform.tfvars:**

```hcl
zone = "us-central1-a"  # Optional, defaults to us-central1-a
```

---

### 4. **Machine Type** (Optional - Default: `g2-standard-4`)

The VM instance type. Must match your GPU choice.

**Default:** `g2-standard-4` (for L4 GPUs)

**Options:**

- **For L4 GPU:** `g2-standard-4` (4 vCPUs, 16GB RAM)
- **For T4 GPU:** `n1-standard-4` (4 vCPUs, 15GB RAM)

**What it looks like in terraform.tfvars:**

```hcl
machine_type = "g2-standard-4"  # Optional, defaults to g2-standard-4
```

---

### 5. **GPU Type** (Optional - Default: `nvidia-l4`)

The type of GPU to attach to your VM.

**Default:** `nvidia-l4`

**Options:**

- `nvidia-l4` (16GB VRAM, newer, recommended)
- `nvidia-tesla-t4` (16GB VRAM, older, cheaper)

**How to check availability:**

```bash
# Check L4 availability in your region
gcloud compute accelerator-types list \
  --filter="name:nvidia-l4 AND zone:us-central1"

# Check T4 availability
gcloud compute accelerator-types list \
  --filter="name:nvidia-tesla-t4 AND zone:us-central1"
```

**What it looks like in terraform.tfvars:**

```hcl
gpu_type = "nvidia-l4"  # Optional, defaults to nvidia-l4
```

---

## Quick Setup Commands

### Get Your Project ID:

```bash
gcloud config get-value project
```

### Check GPU Availability:

```bash
# List all available GPUs in us-central1
gcloud compute accelerator-types list --filter="zone:us-central1"

# Check specific GPU
gcloud compute accelerator-types list \
  --filter="name:nvidia-l4 AND zone:us-central1-a"
```

### Check Your Quota (GPU Limits):

```bash
# Check if you have GPU quota
gcloud compute project-info describe \
  --project=YOUR_PROJECT_ID \
  --format="get(quotas[].limit,quotas[].metric)"

# Or check in Console:
# https://console.cloud.google.com/iam-admin/quotas
# Filter by "NVIDIA" to see GPU quotas
```

---

## Minimal terraform.tfvars (Only Required Values)

```hcl
# Only these two are required:
project_id = "your-gcp-project-id-here"
hf_token   = "hf_your_hugging_face_token_here"
```

Everything else will use defaults!

---

## Full terraform.tfvars Example (All Values)

```hcl
# Required
project_id = "my-webllm-project-123456"
hf_token   = "hf_abc123xyz789"

# Optional (with defaults shown)
region     = "us-central1"
zone       = "us-central1-a"
machine_type = "g2-standard-4"
gpu_type   = "nvidia-l4"
```

---

## Common Issues & Solutions

### Issue: "GPU quota exceeded"

**Solution:** Request quota increase or try a different zone

```bash
# Check quota
gcloud compute project-info describe --project=YOUR_PROJECT_ID

# Request increase in Console:
# https://console.cloud.google.com/iam-admin/quotas
```

### Issue: "GPU not available in zone"

**Solution:** Try a different zone or region

```bash
# Find zones with L4 GPUs
gcloud compute accelerator-types list --filter="name:nvidia-l4"
```

### Issue: "Billing not enabled"

**Solution:** Enable billing in GCP Console

- Go to: https://console.cloud.google.com/billing
- Link a billing account to your project

---

## Summary: What You Actually Need

**Minimum (just 2 values):**

1. ✅ `project_id` - Your GCP Project ID
2. ✅ `hf_token` - Your Hugging Face token (not from GCP, but required)

**Everything else has sensible defaults!**

The defaults will work for most cases:

- Region: `us-central1` (Iowa)
- Zone: `us-central1-a`
- Machine: `g2-standard-4` (for L4 GPU)
- GPU: `nvidia-l4` (16GB VRAM)

You only need to change these if:

- You want a different region (closer to you)
- L4 GPUs aren't available (use T4 instead)
- You need more/less compute power
