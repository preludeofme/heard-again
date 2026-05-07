# GCP Readiness Plan — Heard Again

Generated: 2026-05-06

## Current State Summary

Multi-service application: Next.js UI (4776/4777), Next.js Chat (4778), Python FastAPI TTS (4779), PostgreSQL, Redis, ChromaDB, Ollama.

---

## Critical Bugs (Fix First)

| # | Bug | File(s) |
|---|-----|---------|
| 1 | Caddyfile proxies to `:4776`, but compose maps app on `4777:4777` — port conflict, nothing on 4776 | `Caddyfile`, `docker-compose.yml` |
| 2 | TTS compose sets `PORT=4779` but `config.py` reads `TTS_PORT` (defaults to 8101) — TTS unreachable | `docker-compose.yml`, `TTS/app/config.py` |
| 3 | `ingestion-worker` expose port `4779` conflicts with TTS port `4779` | `docker-compose.yml` |
| 4 | Chat + worker Dockerfiles run `npm ci --only=production` before `tsc` — build fails (devDeps needed) | `Chat/docker/Dockerfile`, `Chat/docker/Dockerfile.worker` |
| 5 | Ollama has no healthcheck but `ingestion-worker` depends on `service_healthy` — worker never starts | `docker-compose.yml` |
| 6 | ClamAV host-exposes port 3310 — unnecessary attack surface | `docker-compose.yml` |
| 7 | `storage-config.ts` only supports `local/s3/r2`, not `gcp` — shadow module conflicts with `StorageService` | `UI/src/lib/storage-config.ts` |
| 8 | ChromaDB has no auth in production compose — any internal service can wipe all vectors | `docker-compose.yml` |
| 9 | TTS Dockerfile runs as root, single-stage, no healthcheck | `TTS/Dockerfile` |
| 10 | `generated_audio` volume shared between `app` and `tts` — horizontal scaling wall | `docker-compose.yml` |

---

## Phase 1 — Fix Bugs & Harden Containers ✅

- [x] **Step 1**: Fix Caddyfile + compose port conflict — app now maps `4776:4777` (Caddy proxies to host:4776)
- [x] **Step 2**: Fix TTS port mismatch — `TTS_PORT=4779` in compose (was `PORT=4779`, ignored by app)
- [x] **Step 3**: Fix ingestion-worker port conflict — removed erroneous `expose: 4779` + `PORT=4779` (worker has no HTTP server)
- [x] **Step 4**: Fix Chat Dockerfile build order — `npm ci` (all deps) in builder, `npm ci --only=production` in runtime
- [x] **Step 5**: Fix Dockerfile.worker build order — `npm ci` (all deps) in both stages (tsx runs TypeScript directly)
- [x] **Step 6**: Add Ollama healthcheck — `curl /api/version`, 30s interval, 30s start_period
- [x] **Step 7**: Add Chat service healthcheck — `curl /api/health`, 30s interval, 40s start_period
- [x] **Step 8**: Remove ClamAV host port `3310:3310` — internal network only
- [x] **Step 9**: Fix `storage-config.ts` — replaced shadow module with re-export shim pointing to `StorageService`
- [x] **Step 10**: Lock down ChromaDB — added `CHROMA_SERVER_AUTHN_PROVIDER` + `CHROMA_CREDENTIALS` required env
- [x] **Step 11**: Add TTS healthcheck — `curl /api/tts/health`, 30s interval, 60s start_period
- [x] **Step 12**: Harden TTS Dockerfile — multi-stage, non-root `tts:1001`, `EXPOSE 4779`, healthcheck
- [x] **Bonus**: Block weak `NEXTAUTH_SECRET` default — changed to required `${NEXTAUTH_SECRET:?...}`
- [x] **Bonus**: Remove dead ingestion-worker HTTP healthcheck (worker has no HTTP server)

---

## Phase 2 — Make Services Stateless / Cloud-Ready ✅

- [x] **Step 13**: Decouple `temp_ingestion` shared volume — moved file download from Chat API to ingestion worker; worker downloads from `storageUrl` into `/tmp` directly; eliminated shared `temp_ingestion` volume entirely
- [x] **Step 14**: Decouple `generated_audio` from `app` — removed `generated_audio:/app/generated` mount from UI service; narration worker downloads from TTS via HTTP and saves via `storageService` (GCS when `STORAGE_MODE=gcp`); TTS keeps its private scratch volume
- [x] **Step 15**: TTS voice profiles portable via GCS — `.pt` + `.json` uploaded to GCS after creation; per-pod local cache with GCS fallback on miss; `design-and-clone` and `blend-voice` profiles moved to familyspace dir and synced; voice-profiles PVC replaced with emptyDir; SessionAffinity on TTS Service covers upload→train sequence
- [x] **Step 16**: Extract narration worker — `UI/Dockerfile.worker`, `UI/src/workers/start-workers.ts`, `narration-worker` compose service; `NARRATION_WORKER_ENABLED=false` in `app` container disables inline workers

---

## Phase 3 — GCP Infrastructure ✅

- [x] **Step 17**: `infra/terraform/main.tf` — provider, VPC + subnets, VPC connector, Artifact Registry
- [x] **Step 18**: Cloud SQL (PostgreSQL 15) — private IP only, REGIONAL HA, PITR, Cloud SQL Auth Proxy as Cloud Run sidecar
- [x] **Step 19**: Cloud Memorystore (Redis 7, Standard HA) — TLS, auth enabled, VPC-native
- [x] **Step 20**: GCS buckets — `uploads`, `generated-audio` (7-day lifecycle), `tts-models`; CORS configured
- [x] **Step 21**: Cloud Run `ui` — min 1, max 10, 2Gi, Workload Identity, Secret Manager, VPC connector
- [x] **Step 22**: Cloud Run `chat` — min 1, max 10, 2Gi, Workload Identity, Secret Manager, VPC connector
- [x] **Step 23**: GKE Standard cluster — `heard-again-prod-cluster`, GPU node pool (T4, n1-standard-8, min 0/max 2)
- [x] **Step 24**: `infra/k8s/tts.yaml` — GPU Deployment, init container downloads models from GCS, PVCs for voices/reference
- [x] **Step 25**: `infra/k8s/ollama.yaml` — GPU Deployment, GCE PD-backed PVC for model data
- [x] **Step 26**: `infra/k8s/chromadb.yaml` — StatefulSet, GCE PD PVC (100Gi), auth from k8s Secret
- [x] **Step 27**: Cloud Run URL mapping handles external routing; Terraform provisions `google_cloud_run_v2_service_iam_member` for public access; Caddy replaces itself
- [x] **Step 28**: Secret Manager — 5 secrets, per-service IAM bindings (least privilege), `infra/terraform/variables.tf`

---

## Phase 4 — CI/CD & Observability ✅

- [x] **Step 29**: `cloudbuild.yaml` — parallel image builds for all 4 services, Artifact Registry push, `prisma migrate deploy` via Cloud SQL Auth Proxy, Cloud Run + GKE deploy steps
- [x] **Step 30**: TTS structured JSON logging — `python-json-logger` added to `requirements.txt`; `main.py` configures `JsonFormatter` replacing bare `basicConfig`
- [x] **Step 31**: Cloud Monitoring alerts — 6 alert policies in Terraform (UI/Chat 5xx, UI latency p95, SQL connections, Redis memory, GKE pod restarts); email channel via `alert_notification_email` variable

---

## Additional Fixes (Post-Phase 4)

- [x] **TTS Redis rate limiting**: Replaced `InMemoryRateLimiter` with `RedisRateLimiter` using Lua sliding-window script; falls back to allow-all if Redis unavailable; `REDIS_URL` wired into TTS compose + GKE manifest
- [x] **CDN for generated audio**: Terraform provisions Cloud CDN-backed Load Balancer (`count`-gated on `cdn_domain` variable); set `cdn_domain` + point DNS at `audio_cdn_ip` output to activate; 1-hour TTL, up to 24-hour max
- [x] **TTS design-and-clone / blend-voice familyspace isolation bug**: Both endpoints were passing `familyspace_id` kwarg to model_manager methods that don't accept it (would raise TypeError at runtime); fixed by removing the invalid kwarg and adding explicit profile move + metadata save in the endpoint handler

---

## What Is Already GCP-Ready (Do Not Change)

- NextAuth JWT strategy — stateless, Cloud Run compatible
- GCP storage provider (`UI/src/lib/storage/providers/gcp-provider.ts`) — Workload Identity-friendly
- UI Dockerfile — multi-stage, non-root, read-only FS, tmpfs
- Redis-backed rate limiting and BullMQ queues
- Service-to-service auth tokens (`CHAT_SERVICE_SECRET`, `TTS_SERVICE_TOKEN`)
- `ingestion-worker` already decoupled from `chat` service
- Health check endpoints on all Node.js services
- `security_opt: no-new-privileges` + `cap_drop: ALL` on Node.js containers
- Prisma multi-client generators (separate outputs for UI and Chat)
