# Production Deployment Guide

Follow these steps to deploy a new change to the production environment (Versail).

## 1. Verify (Pre-Flight)
Run the automated quality gate to ensure the codebase is stable and builds correctly:
```bash
./Scripts/ci-verify.sh
```
*Note: This checks linting, types, unit tests, and production builds for all services.*

## 2. Deploy
Push to the production branch — the Versail platform handles the build and deployment automatically:
```bash
git push origin main
```

**Automated Actions:**
- Builds Docker images for **UI**, **Worker**, and **TTS**.
- Executes Prisma **database migrations**.
- Deploys all services to the Versail infrastructure.

## 3. Validate
Confirm all services are healthy by checking their endpoints:
- **UI:** `https://heardagain.com/api/instance/health`
- **TTS:** Check the RunPod endpoint health
- **Background Jobs:** Trigger.dev dashboard

---

*For detailed infrastructure setup, refer to the project README.*
