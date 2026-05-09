# Production Deployment Guide

Follow these steps to deploy a new change to the production environment (GCP).

## 1. Verify (Pre-Flight)
Run the automated quality gate to ensure the codebase is stable and builds correctly:
```bash
./Scripts/ci-verify.sh
```
*Note: This checks linting, types, unit tests, and production builds for all services.*

## 2. Deploy
Trigger the GCP Cloud Build pipeline to build images and update services:
```bash
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_PROJECT_ID=heard-again,_REGION=us-central1,_ENV=prod
```
**Automated Actions:**
- Builds Docker images for **UI**, **Worker**, and **TTS**.
- Executes Prisma **database migrations**.
- Deploys UI/Chat to **Cloud Run**.
- Deploys TTS/Ollama/ChromaDB to **GKE**.

## 3. Validate
Confirm all services are healthy by checking their endpoints:
- **UI:** `https://heardagain.com/api/instance/health`
- **Chat:** `https://[chat-url]/api/health`
- **GKE Pods:** `kubectl get pods -n heard-again`

---
*For detailed infrastructure setup or PCF-specific notes, refer to `GCP_DEPLOYMENT_PLAN.md` or `PCF_DEPLOYMENT.md`.*
