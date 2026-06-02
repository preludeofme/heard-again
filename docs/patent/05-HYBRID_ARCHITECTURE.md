# Invention #4 — Hybrid Voice/Genealogy Graph + Multi-Service Architecture

> **Inventor:** Ryan Buck
> **Category:** Systems Architecture / Distributed Computing
> **Related Files:** `docker-compose.yml`, `UI/`, `Chat/`, `TTS/`, `Exporter/`, `Caddyfile`, `Scripts/`

---

## 1. Problem

Voice cloning for family history combines three computationally distinct workloads:

- **GPU-intensive** (TTS model inference — requires NVIDIA GPU, ~8-16GB VRAM)
- **Latency-sensitive** (web serving — requires fast response times)
- **Storage-heavy** (audio files, documents, photos — can be anywhere)

Existing solutions either run everything in the cloud (expensive: $50-200/month for GPU instances) or everything locally (poor accessibility for family members). No existing solution provides a **hybrid architecture** that runs GPU workloads locally while serving the web app from the cloud, with a unified data model.

---

## 2. The Invention

### 2.1 Hybrid Compute Model

```
                                 ┌──────────────────────┐
 ┌─────────────────────────────────▼─────────────┐     │
 │            VERCEL / CLOUD                      │     │
 │  ● Next.js UI (server-side rendering)          │     │
 │  ● Lightweight API routes (*most* /api/*)      │     │
 │  ● Cloud storage for large assets (R2/S3)      │     │
 │  ● Auth sessions (NextAuth)                    │     │
 └─────────────────────────────────────────────────┘     │
                                                        │
         Secure tunnel (Tailscale / Cloudflare)          │
                                                        │
 ┌─────────────────────────────────────────────────┐     │
 │          ON-PREMISES SERVER                       │     │
 │                                                   │     │
 │  ┌──────────────┐  ┌──────────────┐              │     │
 │  │  TTS Service   │  │  Chat Service  │              │     │
 │  │  (Python       │  │  (Next.js 14)  │              │     │
 │  │   FastAPI)     │  │  RAG + LLM     │              │     │
 │  │                │  │                │              │     │
 │  │  GPU Inference │  │  Ollama        │              │     │
 │  │  Qwen3-TTS     │  │  ChromaDB      │              │     │
 │  └────────────────┘  └────────────────┘              │     │
 │                                                   │     │
 │  ┌────────────────┐  ┌────────────────┐           │     │
 │  │  PostgreSQL     │  │  Redis          │           │     │
 │  │  (Prisma ORM)   │  │  (Queue/Cache)  │           │     │
 │  └────────────────┘  └────────────────┘           │     │
 │                                                   │     │
 │  ● Caddy reverse proxy (:4777)                     │     │
 │  ● Docker Compose orchestration                     │     │
 │  ● Tailscale for secure remote access               │     │
 └───────────────────────────────────────────────────────┘
```

### 2.2 Multi-Service with Shared Schema

All three services (UI, Chat, TTS) share a **single Prisma schema** at `prisma/schema.prisma`:

```prisma
// Three Prisma generators, one schema
generator client     { output = "./node_modules/.prisma/client"     }
generator client_ui  { output = "../UI/node_modules/.prisma/client" }
generator client_chat { output = "../Chat/node_modules/.prisma/client" }
```

This means:
- A single `prisma migrate` updates all three services simultaneously
- The Chat and TTS services use the same Prisma Client types as the UI
- No schema drift between services

### 2.3 Security Architecture

```
Incoming Request
     │
     ├── Caddy TLS termination (Tailscale HTTPS)
     │
     ├── Next.js Middleware
     │   ├── Auth guard (NextAuth session check)
     │   ├── Rate limiting (Redis-backed)
     │   └── Security header injection
     │
     ├── NextAuth Session Handler
     │   ├── Credential provider (email + password)
     │   ├── Google OAuth provider
     │   ├── MFA (TOTP via speakeasy)
     │   └── Session token management
     │
     ├── API Route Handler
     │   ├── CSRF token validation
     │   ├── Role-based access (OWNER, ADMIN, EDITOR, VIEWER)
     │   └── Resource ownership checks
     │
     └── TTS (if proxied)
         ├── HMAC consent token validation
         └── Rate limiter per IP / familyspace
```

### 2.4 Storage Abstraction Layer

The UI uses a **provider-based storage abstraction** that swaps between local, S3-compatible, and Google Cloud Storage based on environment:

```typescript
// Storage providers are swapped via env variables
// STORAGE_PROVIDER = "local" | "s3" | "gcp"
const provider = getStorageProvider(process.env.STORAGE_PROVIDER)
await provider.upload(file, { familyspaceId, assetType })
```

### 2.5 Docker Compose Orchestration

The system runs as 10 Docker services with GPU profiles:

```yaml
# docker-compose.yml
services:
  ui:          # Next.js web app
  chat:        # RAG chat service
  tts:         # GPU voice synthesis
  postgres:    # Database
  redis:       # Cache & queues
  chromadb:    # Vector database
  ollama:      # LLM inference
  clamav:      # Virus scanning for uploads
  caddy:       # HTTPS reverse proxy
  exporter:    # Puppeteer export worker
```

GPU profiles (`with-tts`, `with-llm`, `with-ingestion`) control which services get GPU access, allowing resource-constrained deployments to choose which features run on the GPU.

### 2.6 Instance Management

Each familyspace has an `Instance` record tracking its deployment:

```prisma
model Instance {
  id                   String
  familyspaceId        String
  type                 InstanceType  // LOCAL | CLOUD | HYBRID
  status               InstanceStatus  // REGISTERING | ACTIVE | OFFLINE
  tunnelEnabled        Boolean
  tunnelSubdomain      String?
  lastHeartbeatAt      DateTime?
  // ...
}
```

This enables:
- **Heartbeat monitoring** — dead instances detected
- **Tunnel management** — subdomain-based access
- **Region tracking** — cloud instance location
- **Deployment mode** — LOCAL (on-premises), CLOUD (fully hosted), HYBRID (mixed)

### 2.7 Scripts for Operational Management

The `Scripts/` directory contains lifecycle scripts for:
- `start-dev.sh` — Multi-service startup with health checks
- `ci-verify.sh` — Pre-deployment verification
- VRAM management — GPU memory balancing
- Log aggregation — Centralized log collection

---

## 3. Prior Art Distinction

| Feature | Pure Cloud (ElevenLabs) | Pure Local (Oobabooga) | Heard Again Hybrid |
|---------|------------------------|----------------------|-------------------|
| GPU inference location | Cloud only | Local only | **Either (per-service config)** |
| Cloud serving | ✓ | ✗ (no web) | ✓ |
| Shared data model | ✗ | ✗ (no schema) | ✓ (single Prisma schema) |
| Instance management | ✗ | ✗ | ✓ (heartbeat, tunnel, mode) |
| Storage abstraction | ✗ (fixed) | ✗ (local only) | ✓ (local/S3/GCP swap) |
| Consent-gated voice | ✗ | ✗ | ✓ |
| Multi-service orchestration | ✗ | ✗ | ✓ (10 containers, GPU profiles) |
| Offline-capable TTS | ✗ | ✓ | ✓ |

---

## 4. Claims Ideas

1. **A hybrid computing system for family story preservation** comprising: a cloud-deployed web application server; an on-premises GPU-accelerated inference server running voice cloning and AI chat services; a shared relational database schema accessible to both cloud and on-premises services; and a secure tunnel connecting the services.

2. **The system of claim 1** wherein the on-premises server includes a heartbeat mechanism that reports instance status to a cloud registry for remote monitoring and dead-instance detection.

3. **The system of claim 1** wherein a single Prisma schema defines the data model and generates client libraries for both the web application and the on-premises services, ensuring type-safe cross-service data access.

4. **The system of claim 1** wherein the GPU inference server supports configurable GPU profiles that selectively enable or disable GPU acceleration per service (TTS, LLM) based on hardware availability.

---

## 5. Related Source Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Production multi-service orchestration |
| `docker-compose.dev.yml` | Development variant |
| `Caddyfile` | Reverse proxy configuration |
| `Scripts/start-dev.sh` | Development startup lifecycle |
| `UI/src/middleware.ts` | Auth guard, rate limiting, security headers |
| `UI/src/lib/auth.ts` | NextAuth configuration |
| `UI/src/lib/session-handler.ts` | Custom session management |
| `UI/src/lib/security/` | CSRF, rate limiting, MFA, file validation |
| `UI/src/lib/storage/` | Provider-based storage abstraction |
| `UI/src/lib/file-optimizer/` | Per-type file optimization pipeline |
| `prisma/schema.prisma` (Instance model) | Instance tracking |
