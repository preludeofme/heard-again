# Heard Again - Scalability Implementation Checklist

This checklist tracks the work required to bring Heard Again into compliance with the [Scalability & Architecture Review Guide](./heard-again-scalability-review-guide.md).

**Cloud Provider: Google Cloud Platform (GCP)**
- Primary object storage: Google Cloud Storage (GCS)
- Database: Cloud SQL (PostgreSQL) or self-hosted
- GPU compute: GCE with NVIDIA T4/V100/A100
- Container orchestration: Cloud Run (stateless) or GKE (workers)
- Architecture remains provider-agnostic via abstraction layers

**Status Key:**
- `[ ]` Not started
- `[-]` In progress
- `[x]` Complete
- `[~]` Partial/needs review

---

## 1. Three-Plane Architecture Separation

### 1.1 Control Plane (Auth, Billing, Orchestration)

- [x] User identity and authentication (NextAuth)
- [x] Workspace/tenant isolation in schema
- [x] Basic subscription/plan models
- [x] Instance registration API
- [~] **TODO:** Separate control plane service boundaries (currently mixed in API routes)
- [ ] **TODO:** Centralized entitlement enforcement service
- [ ] **TODO:** Usage tracking and quota enforcement
- [ ] **TODO:** Feature flags per plan type

### 1.2 Data Plane (Storage, Database)

- [x] Workspace-scoped data models
- [~] **TODO:** Object Storage (GCS Primary)
- [~] **TODO:** Storage abstraction (GCS implementation incomplete - only LOCAL mode)
- [ ] **TODO:** Signed URL generation for direct uploads
- [ ] **TODO:** Storage lifecycle management (cleanup policies)
- [ ] **TODO:** Data residency controls (explicit data mode enforcement)

### 1.3 Compute Plane (Voice, GPU Jobs)

- [~] **TODO:** Job queue architecture (synchronous execution currently)
- [ ] **TODO:** Async job queue with Redis/Bull/BullMQ
- [ ] **TODO:** Separate worker processes
- [ ] **TODO:** Worker concurrency controls
- [ ] **TODO:** Job prioritization by plan type
- [ ] **TODO:** Dead letter queue for failed jobs
- [ ] **TODO:** Compute engine abstraction (allow swapping TTS engines)

---

## 2. Containerization & Deployment

### 2.1 Service Containers

- [~] **TODO:** Main docker-compose.yml for full stack
- [~] **TODO:** Separate Dockerfile for API service
- [~] **TODO:** Separate Dockerfile for worker services
- [ ] **TODO:** Separate Dockerfile for tunnel agent
- [x] TTS service has Docker setup
- [ ] **TODO:** Health checks for all containers
- [ ] **TODO:** Graceful shutdown handling

### 2.2 GPU Containerization

- [x] TTS service runs in Docker with GPU support
- [~] **TODO:** CPU fallback mode when GPU unavailable
- [ ] **TODO:** GPU worker scaling independent from API
- [ ] **TODO:** Model download on first run (not baked into image)

### 2.3 Self-Hosted Distribution

- [ ] **TODO:** docker-compose.local.yml (local-only mode)
- [ ] **TODO:** docker-compose.connected.yml (tunnel mode)
- [ ] **TODO:** docker-compose.gpu.yml (local GPU inference)
- [ ] **TODO:** .env.example with all required variables
- [ ] **TODO:** Upgrade documentation
- [ ] **TODO:** Backup/restore documentation
- [ ] **TODO:** Persistent volume documentation

---

## 3. Queue & Job Architecture

### 3.1 Job Infrastructure

- [x] Job models in schema (VoiceGenerationJob, ImportJob, ExportJob)
- [~] **TODO:** Job queue implementation (currently synchronous)
- [ ] **TODO:** Redis/BullMQ setup
- [ ] **TODO:** Job processor workers
- [ ] **TODO:** Job status polling/streaming

### 3.2 Worker Categories

- [ ] **TODO:** Audio Ingest Worker
- [ ] **TODO:** Transcription Worker
- [ ] **TODO:** Voice Profile Worker
- [ ] **TODO:** Story Narration Worker
- [ ] **TODO:** Export Worker

### 3.3 Job Safety

- [~] **TODO:** Idempotency (current implementation may create duplicates on retry)
- [ ] **TODO:** Deduplication strategy
- [ ] **TODO:** Atomic output writes
- [ ] **TODO:** Bounded retries with exponential backoff
- [ ] **TODO:** Job timeouts

---

## 4. API Layer Scalability

### 4.1 Stateless API Design

- [~] **TODO:** Session externalization (currently cookie-based sessions)
- [x] Stateless API routes
- [~] **TODO:** Remove local disk assumptions (StorageService uses process.cwd())
- [ ] **TODO:** Direct-to-storage uploads (bypass API for file streaming)

### 4.2 Pagination & Query Performance

- [x] Pagination support in list endpoints (verify all lists)
- [x] Database indexes on hot queries
- [ ] **TODO:** Cursor-based pagination for large collections
- [ ] **TODO:** Query result caching (Redis)

### 4.3 Multi-Tenancy Enforcement

- [x] Workspace scoping in schema
- [~] **TODO:** Verify ALL API routes enforce workspace scope
- [~] **TODO:** Centralized authorization layer (currently scattered)
- [ ] **TODO:** Storage path namespacing by workspace

---

## 5. Self-Hosted + Tunnel Architecture

### 5.1 Tunnel Agent

- [x] Tunnel configuration API
- [~] **TODO:** Automated tunnel agent (not manual cloudflared instructions)
- [ ] **TODO:** Outbound-only connection from instance
- [ ] **TODO:** Instance heartbeat/health reporting
- [ ] **TODO:** Automatic reconnection

### 5.2 Control Plane Integration

- [x] Instance registration API
- [x] Tunnel token generation
- [~] **TODO:** Token rotation automation
- [ ] **TODO:** Instance version reporting
- [ ] **TODO:** Stale version detection
- [ ] **TODO:** Instance revocation

### 5.3 Security

- [x] Tunnel token expiry (30 days)
- [~] **TODO:** Short-lived session tokens for tunnel access
- [ ] **TODO:** Workspace+role aware access checks for tunnel
- [ ] **TODO:** Access revocation when membership removed

---

## 6. Compute Scaling

### 6.1 GPU Workload Management

- [x] TTS service with GPU support
- [~] **TODO:** Per-model concurrency limits
- [ ] **TODO:** Queue backpressure
- [ ] **TODO:** Per-tenant rate limiting
- [ ] **TODO:** Cost-aware job scheduling

### 6.2 Engine Abstraction

- [~] **TODO:** TTS engine abstraction layer
- [ ] **TODO:** Local vs cloud engine selection
- [ ] **TODO:** Fallback engine support
- [ ] **TODO:** Multi-provider support architecture

### 6.3 Hybrid Mode

- [x] Plan types support hybrid mode
- [x] ComputeMode enum (LOCAL/CLOUD/HYBRID)
- [~] **TODO:** Cloud compute job submission
- [ ] **TODO:** Temporary artifact cleanup policy
- [ ] **TODO:** Data residency enforcement in hybrid mode

---

## 7. Database & Storage

### 7.1 Database Scalability

- [x] Proper indexing strategy
- [x] Workspace scoping
- [~] **TODO:** Query plan review for N+1 issues
- [ ] **TODO:** Read replicas for analytics queries
- [ ] **TODO:** Connection pooling configuration

### 7.2 Storage Abstraction

- [~] **TODO:** Complete GCS implementation in StorageService
- [ ] **TODO:** Cloudflare R2 adapter (optional)
- [ ] **TODO:** Azure Blob adapter (optional)
- [ ] **TODO:** AWS S3 adapter (optional)
- [ ] **TODO:** Signed URL generation (GCS)

### 7.3 Cleanup & Lifecycle

- [ ] **TODO:** Temporary file cleanup jobs
- [ ] **TODO:** Orphaned asset detection
- [ ] **TODO:** Versioning strategy for generated assets

---

## 8. Observability

### 8.1 Logging

- [~] **TODO:** Structured logging (JSON format)
- [ ] **TODO:** Request ID propagation
- [ ] **TODO:** Workspace ID in all tenant logs
- [ ] **TODO:** Job ID in worker logs
- [ ] **TODO:** Secrets redaction

### 8.2 Metrics

- [ ] **TODO:** Request latency metrics
- [ ] **TODO:** Error rate tracking
- [ ] **TODO:** Queue depth monitoring
- [ ] **TODO:** Job duration by type
- [ ] **TODO:** GPU utilization tracking
- [ ] **TODO:** Storage growth metrics
- [ ] **TODO:** Per-plan usage metrics

### 8.3 Tracing

- [ ] **TODO:** Distributed tracing setup
- [ ] **TODO:** End-to-end request tracing (frontend → API → queue → worker)

---

## 9. Security Hardening

### 9.1 Authorization

- [~] **TODO:** Centralized permission service
- [~] **TODO:** Consistent authorization across all routes
- [ ] **TODO:** Resource-level permissions (story-level, not just workspace)

### 9.2 Data Protection

- [x] Voice consent model
- [~] **TODO:** Encryption at rest for sensitive assets
- [ ] **TODO:** Audit logging for all data access
- [ ] **TODO:** GDPR compliance (data export/deletion)

### 9.3 Compute Security

- [~] **TODO:** Sandboxed job execution
- [ ] **TODO:** Resource limits per job
- [ ] **TODO:** Input validation at job boundaries

---

## 10. Migration & Portability

### 10.1 Import/Export

- [x] ImportJob/ExportJob models
- [~] **TODO:** Complete workspace export functionality
- [~] **TODO:** GEDCOM round-trip verification
- [ ] **TODO:** Full workspace backup/restore

### 10.2 Deployment Mode Migration

- [ ] **TODO:** Local → Connected migration path
- [ ] **TODO:** Connected → Hybrid migration path
- [ ] **TODO:** Hybrid → Cloud migration path
- [ ] **TODO:** Cloud → Self-hosted export path

---

## Priority Order for Implementation

### Phase 1: Critical for Cloud Launch (Must Have)

1. **Job Queue Architecture** - Move voice synthesis to async queue
2. **Containerization** - Docker Compose for production deployment
3. **Storage Abstraction** - Complete S3 implementation
4. **Worker Separation** - Separate worker process from API
5. **Authorization Hardening** - Centralized permission enforcement

### Phase 2: Scaling Essentials (Should Have)

6. **Observability** - Structured logging and metrics
7. **Worker Concurrency Controls** - Prevent GPU overload
8. **Idempotency** - Safe job retries
9. **Tunnel Agent** - Automated self-hosted tunnel
10. **Cleanup Jobs** - Lifecycle management

### Phase 3: Production Polish (Nice to Have)

11. **Multi-region Support** - Cloud deployment options
12. **Advanced Caching** - Redis query caching
13. **CDN Integration** - Asset delivery optimization
14. **Cost Optimization** - Better resource utilization

---

## Review Schedule

- **Weekly:** Progress review against this checklist
- **Bi-weekly:** Architecture review for new features
- **Monthly:** Full scalability assessment

---

## Current Status Summary

| Category | Progress | Status |
|----------|----------|--------|
| Data Model | 85% | Good foundation |
| Containerization | 25% | Needs significant work |
| Job Queue | 40% | Schema ready, implementation needed |
| Storage | 35% | Abstraction started, S3 incomplete |
| Tunnel/Self-Host | 50% | APIs exist, agent incomplete |
| Observability | 10% | Minimal logging |
| Security | 60% | Basic auth, needs hardening |

**Overall Project Readiness for Scale: ~45%**
