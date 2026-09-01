# GCP Compute Engine CI/CD Setup Guide

This guide walks you through configuring **Google Cloud Platform (GCP)** and **GitHub Repository Secrets** so that your GitHub Actions workflow can automatically test and deploy your code to your Compute Engine instance (`instance-20260901-190452`).

---

## 1. Create a GCP Service Account

Run the following commands in your local terminal or Google Cloud Shell:

```bash
# 1. Set your active project
gcloud config set project learncloud-501101

# 2. Create the GitHub Actions service account
gcloud iam service-accounts create github-actions-deployer \
    --description="Service account for GitHub Actions CI/CD deployment" \
    --display-name="github-actions-deployer"

# 3. Grant Compute OS Admin Login and Service Account User roles
gcloud projects add-iam-policy-binding learncloud-501101 \
    --member="serviceAccount:github-actions-deployer@learncloud-501101.iam.gserviceaccount.com" \
    --role="roles/compute.osAdminLogin"

gcloud projects add-iam-policy-binding learncloud-501101 \
    --member="serviceAccount:github-actions-deployer@learncloud-501101.iam.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser"

# 4. Generate and download JSON Key file
gcloud iam service-accounts keys create gcp-key.json \
    --iam-account=github-actions-deployer@learncloud-501101.iam.gserviceaccount.com
```

---

## 2. Configure GitHub Secrets

1. Open your GitHub Repository in your browser.
2. Go to **Settings** > **Secrets and variables** > **Actions**.
3. Click **New repository secret** and add the following secret:

| Secret Name | Description / Value |
| :--- | :--- |
| **`GCP_SA_KEY`** | Paste the entire contents of `gcp-key.json` file generated above. |
| **`GCP_PROJECT_ID`** | `learncloud-501101` |

---

## 3. How the Pipeline Works

Whenever you push code to `main` or open a Pull Request:
1. **CI Job (`ci-backend-tests`)**: Runs automatically on GitHub runners, installs dependencies from `backend/requirements.txt`, and executes `pytest`.
2. **CD Job (`cd-gcp-deploy`)**: Once tests pass on the `main` branch, GitHub Actions authenticates to GCP, connects via `gcloud compute ssh` to `instance-20260901-190452`, pulls the latest code (`git pull origin main`), rebuilds the Docker container (`docker compose up -d --build`), and verifies HTTP health check at `http://localhost:8000/`.
