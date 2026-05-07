# GCP Production Readiness

## Local Development

Local object storage uses `fake-gcs-server` (fsouza/fake-gcs-server Docker image).
The app connects to it via `STORAGE_EMULATOR_HOST=http://fake-gcs:4443` (Docker) or
`STORAGE_EMULATOR_HOST=http://localhost:4443` (host-side dev).

The same `@google-cloud/storage` SDK code runs in both environments. The emulator is
started automatically by Docker Compose.

## Production

Production object storage uses real Google Cloud Storage. The app uses `STORAGE_MODE=gcs`
with no `STORAGE_EMULATOR_HOST` set.

## Required GCP Setup Before Production Deployment

### GCS Buckets
- Create environment-specific buckets (e.g., `heard-again-prod`, `heard-again-staging`)
- Configure lifecycle rules for temporary/export files (e.g., 30-day expiry on `exports/`)
- Configure CORS if the browser uploads/downloads directly (not via the app server)
- Enable versioning for the production bucket

### IAM & Service Accounts
- Create a dedicated service account for the Cloud Run service
- Grant minimum required roles:
  - `roles/storage.objectAdmin` on the specific bucket (not project-wide)
- Use Workload Identity Federation for Cloud Run — do not deploy service account key files
- Do not set `GOOGLE_APPLICATION_CREDENTIALS` in Cloud Run (Workload Identity handles auth)

### Secret Management
- Store all secrets in Secret Manager or use Cloud Run secret injection
- Required secrets: `DATABASE_URL`, `NEXTAUTH_SECRET`, `REDIS_URL`, `GCS_BUCKET_NAME`
- Do not commit `.env` files to the repository

### Cloud Run Configuration
- Set `STORAGE_MODE=gcs`
- Set `GCS_BUCKET_NAME=<bucket-name>`
- Set `GOOGLE_CLOUD_PROJECT=<project-id>`
- **Do not set `STORAGE_EMULATOR_HOST`** — its presence activates emulator mode

### Cloud SQL
- Use Cloud SQL for PostgreSQL (shared with all services)
- Use Cloud SQL Auth Proxy for local-to-CloudSQL connections during migration testing
- Ensure connection pool settings are appropriate for Cloud Run concurrency

### Memorystore / Redis
- Use Memorystore for Redis (or a Redis-compatible managed service)
- Ensure `REDIS_URL` is set to the Memorystore endpoint

## Emulator Limitations (fake-gcs-server)

| Feature | Emulator Support | Notes |
|---|---|---|
| Object upload/download | Full | Functionally equivalent |
| Object delete | Full | |
| Bucket creation | Full | Auto-created on startup |
| Signed URLs | Partial | App falls back to direct URL in emulator mode — do not rely on signed URL behavior locally |
| IAM / ACLs | None | Not emulated — test on real GCS |
| Lifecycle rules | None | Not emulated |
| Object versioning | None | Not emulated |
| CORS | None | Not emulated |
| Event notifications | None | Not emulated |

## Required Validations Before Production

Run these against a real GCP dev/staging environment before promoting to production:

- [ ] Upload a file via the app → confirm object appears in real GCS bucket
- [ ] Download/view the file via the app → confirm retrieval from real GCS
- [ ] Delete a file via the app → confirm removal from real GCS bucket
- [ ] Signed URL generation → confirm signed URLs work and expire correctly
- [ ] Cloud Run service account permissions → confirm least-privilege access works
- [ ] CORS validation (if browser uploads/downloads directly)
- [ ] Bucket lifecycle rule validation (export file expiry)
- [ ] File size and streaming validation (large files, multipart uploads)
- [ ] Connection pool validation under Cloud Run concurrency settings
- [ ] Secret Manager injection validation

## Local Validation Commands

```bash
# Start all services including fake-gcs
docker compose up -d

# Verify fake-gcs is healthy
docker compose ps fake-gcs

# Verify bucket was auto-created
curl http://localhost:4443/storage/v1/b

# Run storage unit tests
cd UI && npm test -- --testPathPattern="gcs-provider"

# Run full test suite
cd UI && npm test

# Manual smoke test: upload a file through the app
# 1. Open http://localhost:4777
# 2. Upload a file through the UI
# 3. Confirm it appears in fake-gcs:
curl "http://localhost:4443/storage/v1/b/local-dev-bucket/o"
```

## Environment Variable Reference

| Variable | Local (Docker) | GCP Production |
|---|---|---|
| `STORAGE_MODE` | `gcs` | `gcs` |
| `STORAGE_EMULATOR_HOST` | `http://fake-gcs:4443` | *(not set)* |
| `GCS_BUCKET_NAME` | `local-dev-bucket` | real bucket name |
| `GOOGLE_CLOUD_PROJECT` | `local-dev` | real project ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | *(not set)* | *(not set — use Workload Identity)* |
