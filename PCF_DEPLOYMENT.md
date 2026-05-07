# PCF Deployment Runbook

**Target:** Pivotal Cloud Foundry (PCF / Tanzu Application Service)
**Last updated:** 2026-05-07
**Status:** Canonical deployment reference — supersedes any PCF notes in GCP_READINESS_PLAN.md

---

## 1. Service Broker Dependencies

Provision the following PCF marketplace services before pushing any app:

| Service type | Required plan | Bind to |
|---|---|---|
| PostgreSQL (e.g., `p.postgres`) | `db-small` or above, v15+ | `ui`, `chat` |
| Redis (e.g., `p-redis` or `a9s-redis`) | `standard` | `ui`, `chat` |
| Object storage (e.g., S3-compatible) | `standard` | `ui` |

```bash
# Example — adjust service names to your PCF tile versions
cf create-service p.postgres db-small heard-again-db
cf create-service p-redis standard heard-again-redis
cf create-service s3-compat standard heard-again-storage
```

> ChromaDB and Ollama have no PCF-native tile equivalents. Deploy them as
> user-provided services (see §6) or use an external managed endpoint.

---

## 2. App Processes

Two CF apps are required. Push from the repo root:

### 2a. UI (web)

```bash
cf push heard-again-ui \
  --docker-image <registry>/heard-again-ui:latest \
  --no-start
```

Or with a manifest (preferred — see §3).

| Process | Command | Instances |
|---|---|---|
| `web` | `node server.js` | 2+ |

### 2b. Chat (web + worker)

```bash
cf push heard-again-chat \
  --docker-image <registry>/heard-again-chat:latest \
  --no-start

cf push heard-again-worker \
  --docker-image <registry>/heard-again-chat:latest \
  --no-route \
  --health-check-type process \
  --no-start
```

| Process | Command | Instances |
|---|---|---|
| `web` | `node server.js` (port 4778) | 2+ |
| `worker` | `node dist/workers/ingestion-worker.js` | 1 |

---

## 3. Manifests

Create `manifest.yml` at the repo root (not committed — contains env overrides per target):

```yaml
applications:
  - name: heard-again-ui
    docker:
      image: <registry>/heard-again-ui:latest
    instances: 2
    memory: 512M
    disk_quota: 1G
    health-check-type: http
    health-check-http-endpoint: /api/instance/health
    routes:
      - route: heard-again.<your-pcf-domain>
    services:
      - heard-again-db
      - heard-again-redis
      - heard-again-storage
    env:
      NODE_ENV: production
      NEXTAUTH_URL: https://heard-again.<your-pcf-domain>
      # See §4 for full env var reference

  - name: heard-again-chat
    docker:
      image: <registry>/heard-again-chat:latest
    instances: 2
    memory: 512M
    health-check-type: http
    health-check-http-endpoint: /api/health
    routes:
      - route: heard-again-chat.<your-pcf-domain>
    services:
      - heard-again-db
      - heard-again-redis
    env:
      NODE_ENV: production

  - name: heard-again-worker
    docker:
      image: <registry>/heard-again-chat:latest
    instances: 1
    memory: 512M
    no-route: true
    health-check-type: process
    command: node dist/workers/ingestion-worker.js
    services:
      - heard-again-db
      - heard-again-redis
```

---

## 4. Environment Variables

Set via `cf set-env` or a CredHub service binding. Never hard-code in manifest.

### UI required vars

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (from service binding) |
| `REDIS_URL` | Redis connection string (from service binding) |
| `NEXTAUTH_SECRET` | Random 32-byte hex string |
| `NEXTAUTH_URL` | Public HTTPS URL of the UI app |
| `STORAGE_PROVIDER` | `s3` or `gcs` |
| `S3_BUCKET` / `GCS_BUCKET` | Storage bucket name |
| `S3_REGION` / `S3_ENDPOINT` | Storage region / endpoint |
| `CHAT_SERVICE_URL` | Internal URL of heard-again-chat |
| `CLAMAV_HOST` | ClamAV service host (user-provided service or sidecar) |
| `CLAMAV_PORT` | Default `3310` |

### Chat required vars

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `CHROMA_URL` | ChromaDB endpoint (user-provided service) |
| `OLLAMA_BASE_URL` | Ollama endpoint (user-provided service) |

```bash
# Bulk set from a local .env file (never commit this file)
cat Chat/.env | xargs -I{} cf set-env heard-again-chat {}
```

---

## 5. Health Endpoint Mapping

| App | Endpoint | Expected response |
|---|---|---|
| UI | `GET /api/instance/health` | `200 {"status":"ok"}` |
| Chat | `GET /api/health` | `200 {"status":"ok"}` |
| Worker | Process alive check (no HTTP) | Process exit 0 = healthy |

PCF router drops an instance from rotation if the health endpoint returns non-2xx for more than `health-check-timeout` seconds (default 60 s). Set `health-check-invocation-timeout` in the manifest if startup takes longer than 60 s.

---

## 6. User-Provided Services (External Dependencies)

For services with no PCF tile (ChromaDB, Ollama, ClamAV), register them as user-provided services:

```bash
cf create-user-provided-service heard-again-chroma \
  -p '{"url":"http://chroma.internal:8000"}'

cf create-user-provided-service heard-again-ollama \
  -p '{"url":"http://ollama.internal:11434"}'

cf create-user-provided-service heard-again-clamav \
  -p '{"host":"clamav.internal","port":"3310"}'
```

Bind these to the relevant apps in the manifest under `services:`.

---

## 7. Scaling Policy

| App | Min instances | Max instances | Scale trigger |
|---|---|---|---|
| `heard-again-ui` | 2 | 6 | CPU > 70% for 60 s |
| `heard-again-chat` | 2 | 4 | CPU > 70% for 60 s |
| `heard-again-worker` | 1 | 1 | Fixed (queue-driven concurrency) |

Enable autoscaling with the PCF App Autoscaler tile:

```bash
cf enable-autoscaling heard-again-ui
cf update-autoscaling-limits heard-again-ui 2 6
cf create-autoscaling-rule heard-again-ui cpu 30 70
```

---

## 8. Rolling Deployment

Use `cf push --strategy rolling` to achieve zero-downtime deploys:

```bash
cf push heard-again-ui --strategy rolling
cf push heard-again-chat --strategy rolling
```

The rolling strategy keeps the current version serving until new instances pass their health check.

### Pre-deploy checklist

1. Run `npm run verify` from a clean checkout and confirm all gates pass.
2. Run `npx prisma migrate deploy` against the target database before starting the rolling push.
3. Confirm new image is published to the registry and the manifest references the correct tag.
4. Apply env var changes with `cf set-env` before pushing (they take effect on the next start).

### Rollback

```bash
# Immediately route traffic back to the previous version
cf cancel-deployment heard-again-ui
cf cancel-deployment heard-again-chat
```

If a migration was applied and needs to be reverted, use `prisma migrate resolve` to mark it down, then re-apply the previous schema version manually.

---

## 9. First-Time Setup Order

1. Provision service broker instances (§1).
2. Set all env vars (§4).
3. Register user-provided services (§6).
4. Push apps with `--no-start`.
5. Bind all services to each app.
6. Run `npx prisma migrate deploy` from a local machine pointed at the target `DATABASE_URL`.
7. Start apps: `cf start heard-again-ui && cf start heard-again-chat && cf start heard-again-worker`.
8. Validate health endpoints (§5).
9. Smoke-test critical flows (login, upload, chat).

---

## 10. Operational Notes

- **Logs**: `cf logs heard-again-ui --recent` / `cf logs heard-again-chat --recent`
- **SSH access**: `cf ssh heard-again-ui` (disabled in locked-down PCF foundations — use `cf run-task` for one-off admin commands instead)
- **One-off tasks** (e.g., seed data): `cf run-task heard-again-ui --command "node scripts/seed.js" --name seed`
- **TTS service**: Not suitable for PCF buildpack deployment due to GPU requirements. Run on a VM with GPU and expose via user-provided service, or use ElevenLabs/Deepgram as a managed alternative.
