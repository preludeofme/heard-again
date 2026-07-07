# Production Deployment Guide

Follow these steps to deploy a new change to a self-hosted production environment using Docker Compose.

## 1. Verify (Pre-Flight)
Run the automated quality gate to ensure the codebase is stable and builds correctly:
```bash
./Scripts/ci-verify.sh
```
*Note: This checks linting, types, unit tests, and production builds for all services.*

## 2. Deploy
Pull the latest change and rebuild/restart the affected services:
```bash
git pull origin main
npm run docker:build
npm run docker:up
```

**What this does:**
- Builds Docker images for **UI** and **TTS** (with the `with-tts` profile).
- Executes Prisma **database migrations** on startup.
- Restarts services with the new images.

## 3. Validate
Confirm all services are healthy by checking their endpoints:
- **UI:** `/api/instance/health`
- **TTS:** the TTS service's `/api/tts/health` endpoint
- **Background Jobs:** the Trigger.dev dashboard (`TRIGGER_API_URL`)

---

*For detailed infrastructure setup, refer to the project README.*
