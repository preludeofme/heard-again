# Heard Again - Scalability & Architecture Review Guide for Implementation Agent

## Purpose

This document is a review guide for the implementation agent before scaling Heard Again to production.

The goal is to ensure the application is architected to:

- scale safely as cloud users increase
- support self-hosted users cleanly
- support self-hosted users tunneling through `heardagain.com`
- avoid early bottlenecks in compute, storage, queueing, and tenancy design
- preserve a clean separation between control plane, data plane, and compute plane
- avoid architectural decisions that will create painful rewrites later

This is not just a performance checklist. It is a system design review guide.

---

# 1. Product Modes the Architecture Must Support

The implementation must support all of the following modes without requiring a different product codebase.

## 1.1 Fully Cloud Hosted
Heard Again hosts:
- app frontend
- API/backend
- auth
- storage
- database
- voice compute jobs

## 1.2 Self-Hosted Local Only
User hosts:
- app frontend
- API/backend
- database
- storage
- optional local model inference

No cloud routing required.

## 1.3 Self-Hosted with Heard Again Tunnel
User hosts:
- app
- storage
- database

Heard Again provides:
- secure remote routing through `heardagain.com`
- central auth and workspace identity
- optional billing enforcement
- optional cloud compute

## 1.4 Hybrid Self-Hosted Data + Cloud Compute
User hosts:
- app
- storage
- database

Heard Again cloud provides:
- GPU generation jobs
- optional remote access
- central identity and billing

---

# 2. Core Architectural Principle

The system should be designed around three planes:

## 2.1 Control Plane
Handles:
- authentication
- workspace/account identity
- subscriptions and billing
- instance registration
- tunnel registration
- feature entitlements
- usage tracking
- orchestration metadata

## 2.2 Data Plane
Stores:
- people
- family tree relationships
- stories
- story metadata
- uploaded recordings
- generated audio
- collections
- workspace content

This may live:
- in Heard Again cloud
- on the user's own self-hosted instance

## 2.3 Compute Plane
Handles:
- voice profile creation
- audio preprocessing
- transcription
- generation jobs
- narration jobs
- model execution
- retryable async workloads

This may live:
- locally on user hardware
- in Heard Again cloud GPU workers
- in hybrid mode depending on plan/config

## Required Review Outcome
The agent must confirm that these planes are not tightly coupled in a way that makes:
- self-hosting impossible
- hybrid mode inconsistent
- scaling cloud compute too expensive
- tenant isolation weak

---

# 3. Architectural Requirements

## 3.1 Single Logical Product, Multiple Deployment Modes
The system must behave like one product with different deployment options, not three separate apps.

### Review Questions
- Is the same domain model used in all deployment modes?
- Can a workspace move from self-hosted to cloud-hosted without a full redesign?
- Can a self-hosted workspace use cloud compute without duplicating data models?
- Are deployment-specific concerns abstracted behind interfaces?

## 3.2 Strict Separation of Stateful vs Stateless Services
Stateful services:
- database
- file/object storage
- workspace content
- voice assets
- relationship graph

Stateless services:
- API gateways where possible
- compute workers
- preprocessing workers
- generation workers
- tunnel brokers
- web app frontend nodes

### Review Questions
- Are compute services stateless?
- Can compute workers be scaled horizontally without special local state?
- Are uploads stored before processing rather than held in memory?
- Are API instances safe to run behind a load balancer?

## 3.3 Asynchronous Job Architecture
Voice operations must never be implemented as synchronous request/response-only flows for production.

### All long-running tasks must be jobs
Examples:
- voice clone creation
- transcription
- segmentation
- narration generation
- export generation
- imports
- media transformation

### Review Questions
- Is there a job queue?
- Are retry policies defined?
- Is job status persisted?
- Are users able to resume/review results?
- Can failed jobs be safely retried without duplicate corruption?

---

# 4. Cloud Scalability Requirements

## 4.1 API Layer
The API layer must be horizontally scalable.

### Requirements
- stateless app servers
- session storage externalized if sessions are used
- no local-disk assumptions on API nodes
- no in-memory tenant-critical state
- cache only non-critical or easily rebuildable data

### Review Questions
- Can multiple API instances run simultaneously?
- Will sticky sessions be required? If yes, why?
- Are file uploads sent directly to object storage when possible?
- Are large media operations avoided on synchronous API threads?

## 4.2 Database Design
The database will become a bottleneck before compute if relationships, memberships, stories, assets, and permissions are not indexed well.

### Requirements
- clear tenant/workspace boundary
- indexing on all hot lookup paths
- support for pagination everywhere
- avoid unbounded eager loading
- avoid storing huge binary blobs in relational DB
- store files in object storage, not DB rows

### Review Questions
- Is every major content table scoped by workspace?
- Are foreign keys and indexes present on common filters?
- Are list endpoints paginated and sortable?
- Are relationship-heavy queries bounded?
- Is there any accidental N+1 behavior in key pages?

## 4.3 Object Storage
All media should be stored in object storage or self-hosted equivalent abstraction.

### Requirements
- abstraction for storage provider
- support for cloud object storage
- support for local/self-hosted storage
- support for signed URLs or controlled downloads
- metadata stored in DB, blobs stored outside DB

### Review Questions
- Is there a storage adapter/interface?
- Can object storage be swapped for local filesystem/S3-compatible storage?
- Are generated assets versioned or replaceable safely?
- Is cleanup/lifecycle management defined?

## 4.4 Caching
Caching should be applied carefully.

### Good cache candidates
- read-heavy profile views
- tree views
- story summaries
- collection lists
- permissions snapshots if invalidation is clear
- plan/entitlement reads

### Do not cache recklessly
- security decisions without invalidation
- mutable generation job state without source of truth
- anything tenant-sensitive without strong key scoping

### Review Questions
- Is caching scoped by tenant/workspace?
- Are permission changes invalidating caches?
- Is the source of truth always clear?

---

# 5. Compute Scaling Requirements

## 5.1 Workers Must Be Queue-Driven
GPU and CPU-heavy tasks must be consumed from queues.

### Worker categories
- transcription workers
- preprocessing workers
- voice profile workers
- generation workers
- export workers

### Review Questions
- Are queues separated by workload type?
- Is there prioritization support?
- Are retries bounded and safe?
- Are dead-letter or failure queues considered?

## 5.2 Concurrency Controls
GPU workloads can destroy reliability if concurrency is uncontrolled.

### Requirements
- explicit worker concurrency
- per-model concurrency controls
- queue backpressure
- plan-aware prioritization if needed
- protection against one tenant flooding the system

### Review Questions
- Is maximum concurrent work per GPU defined?
- Are workloads memory-profiled?
- Can one large job starve all others?
- Are jobs timeout-limited?

## 5.3 Idempotency
If a worker crashes mid-generation, retry logic must not corrupt state.

### Requirements
- job IDs
- deduplication strategy
- output written atomically
- status transitions validated
- safe retries

### Review Questions
- What happens if the same job is processed twice?
- Are outputs named deterministically or versioned?
- Can duplicate billing occur on retry?

## 5.4 Compute Abstraction
The system should not hardcode one engine or one runtime path.

### Requirements
- generation engine abstraction
- local compute implementation
- cloud compute implementation
- optional future multi-provider support

### Review Questions
- Can Chatterbox be swapped later?
- Can self-hosted users choose local inference while cloud users use hosted workers?
- Is engine selection separate from business logic?

---

# 6. Self-Hosted + Tunnel Architecture Requirements

## 6.1 Never Proxy Directly to Arbitrary Customer Origins
The hosted domain must not blindly reverse proxy to random public customer hosts.

### Required model
- customer instance initiates outbound tunnel
- Heard Again control plane registers instance
- routing terminates on infrastructure you control
- access is authorized before traffic is proxied to the instance

### Review Questions
- Is all self-host remote access outbound-only from customer infrastructure?
- Are inbound customer firewall openings avoided?
- Does the platform maintain instance identity securely?

## 6.2 Control Plane for Self-Hosted Instances
Self-hosted instances should register themselves with the platform.

### Required capabilities
- instance ID
- workspace binding
- token or certificate-based auth
- heartbeat
- version reporting
- entitlement checks
- tunnel status reporting

### Review Questions
- Can the platform tell whether an instance is online?
- Can the platform revoke an instance?
- Can the platform detect stale versions?
- Can tokens be rotated?

## 6.3 Tunnel Session Security
Tunnel access should require both:
- valid user auth
- valid instance authorization

### Requirements
- short-lived session tokens
- workspace-aware access checks
- role-aware access checks
- no permanent shared tunnel secret in browser
- revocation support

### Review Questions
- If membership is revoked, does access end quickly?
- Are access sessions scoped to workspace and instance?
- Are logs available for access activity?

## 6.4 Self-Hosted Data Ownership
Hybrid mode must not accidentally become cloud storage by default.

### Requirements
- data residency mode explicitly declared
- local storage remains source of truth in self-hosted mode
- cloud compute jobs only receive what is necessary
- temporary cloud processing artifacts must have cleanup policy

### Review Questions
- Is cloud processing opt-in where expected?
- Are uploads to cloud compute minimized?
- Is there a documented retention window for temporary processing artifacts?

---

# 7. Multi-Tenancy Requirements

## 7.1 Tenant Isolation
Workspace isolation is non-negotiable.

### Requirements
- every tenant-owned record must be workspace-scoped
- authorization must be enforced server-side
- no cross-tenant query leakage
- object storage paths should be tenant-aware
- logs and metrics should be safe for multi-tenant environments

### Review Questions
- Is every read/write path tenant scoped?
- Can a user access another workspace by ID guessing?
- Are storage keys namespaced by workspace?

## 7.2 Permission Model
Do not rely on frontend checks.

### Requirements
- centralized authorization layer
- workspace membership required
- role checks enforced in backend
- invitation flow separate from active membership
- story/person/asset operations validated against workspace ownership

### Review Questions
- Is authorization duplicated inconsistently across handlers?
- Is there a reusable permission service/policy layer?
- Are self-hosted and cloud modes using the same permission rules?

---

# 8. Data Model Scalability Requirements

## 8.1 Family Tree Graph
The family tree should be stored in a way that can scale beyond trivial cases.

### Requirements
- people and relationships modeled separately
- no recursive payload explosions
- tree rendering queries bounded
- support for partial graph loading

### Review Questions
- Can the app load part of a tree rather than everything?
- Are visual tree views pre-shaped in backend responses?
- Is graph traversal controlled?

## 8.2 Stories and Media
Stories and media will grow quickly.

### Requirements
- paginated story lists
- lazy media loading
- transcript search strategy defined
- generated audio metadata tracked separately from source audio

### Review Questions
- Can a person with hundreds of stories still load efficiently?
- Are media-heavy views streaming or paginated?
- Are transcripts searchable without scanning everything?

---

# 9. Observability Requirements

## 9.1 Logging
The system must produce structured logs.

### Required fields
- request ID
- workspace ID
- user ID when available
- instance ID when relevant
- job ID when relevant
- service name
- severity
- error category

### Review Questions
- Can one user-reported failure be traced across API, queue, and worker logs?
- Are secrets redacted from logs?
- Are tenant-sensitive payloads avoided?

## 9.2 Metrics
Track metrics from day one.

### Minimum metrics
- request latency
- error rate
- queue depth
- job duration by type
- job failure rate by type
- GPU worker utilization
- tunnel connection count
- active instances
- storage growth
- per-plan usage

### Review Questions
- Can the team detect backlog before users complain?
- Can the team separate API slowdown from worker backlog?
- Can the team track cost-driving usage?

## 9.3 Tracing
Distributed tracing is strongly recommended.

### Review Questions
- Can one generation request be traced from frontend request to queue to worker to storage?
- Are long-latency steps visible?

---

# 10. Performance Review Checklist

The implementation agent should explicitly verify the following.

## API
- No heavy media processing on request threads
- No blocking long-running jobs inside HTTP handlers
- No unbounded list queries
- Pagination on all list endpoints
- Appropriate indexes on hot queries

## Database
- Workspace scoping on tenant tables
- No blob storage in relational DB
- Query plans checked for major list/detail screens
- No N+1 on primary views

## Storage
- Object storage abstraction exists
- Self-hosted storage abstraction exists
- Signed access or secure proxy strategy defined
- Cleanup jobs exist for temporary artifacts

## Queue / Jobs
- Queue exists
- Job states persisted
- Retries safe
- Dead-letter path defined
- Worker concurrency controlled

## GPU / Compute
- Worker concurrency limited
- Per-job timeout enforced
- Queue isolation between job types
- Cost-driving metrics tracked
- Engine abstraction exists

## Self-Hosted / Tunnel
- Outbound-only instance connection
- Central instance registry
- Heartbeat support
- Token rotation supported
- Membership revocation affects tunnel access

## Security
- Multi-tenant access checks centralized
- Storage namespaced by workspace
- Cloud compute retention policy defined
- Consent and voice usage checks enforced

---

# 11. Migration & Portability Requirements

The system should support movement between deployment modes.

## Required migrations
- self-hosted local -> connected self-hosted
- connected self-hosted -> hybrid cloud compute
- hybrid -> fully cloud hosted
- cloud hosted -> export for self-hosting

### Review Questions
- Is there an import/export path for complete workspace backup?
- Are deployment-specific IDs avoided in business records?
- Can storage references survive migration?

---

# 12. Cost-Aware Architecture Requirements

The architecture must protect margins as users grow.

## Requirements
- generation usage tracked per workspace
- compute jobs metered
- storage growth measured
- replay/listening separated from generation cost
- avoid repeated regeneration when cached/generated asset can be reused

### Review Questions
- Are generated outputs reusable?
- Are repeated plays served from storage instead of recompute?
- Is billing based on durable metrics rather than inference guesswork?

---

# 13. Recommended Service Boundaries

A clean scalable shape would look like this:

## Core Services
- Web App
- API / Application Service
- Auth / Identity Service
- Billing / Entitlements Service
- Instance Registry / Tunnel Control Service
- Job Orchestrator
- Worker Services
- Storage Service abstraction

## Worker Categories
- Audio Ingest Worker
- Audio Cleanup / Segmentation Worker
- Transcription Worker
- Voice Profile Worker
- Story Narration Worker
- Export Worker

## Self-Hosted Agent Components
- Local App/API
- Local DB
- Local Storage
- Optional Local Compute Worker
- Tunnel Agent
- Instance Heartbeat / Registration Agent

---

# 14. Anti-Patterns to Avoid

The implementation agent should flag any of the following:

- single server doing API + DB + storage + queue + worker in production design
- long-running GPU generation inside request handlers
- local disk used as the only durable storage in cloud mode
- no queue for generation jobs
- no tenant scoping on data access
- direct reverse proxy from heardagain.com to user home IP
- billing logic embedded directly inside generation worker logic
- cloud-only assumptions baked into domain models
- one giant monolith with no separation between control plane and compute plane
- no migration/export path for user data
- storing sensitive raw voice assets in cloud without explicit policy
- no cleanup of temporary processing artifacts
- no observability for queues and workers

---

# 15. Required Final Review Output from the Implementation Agent

The implementation agent should produce a written review covering:

1. Current architecture summary
2. Deployment mode support matrix
3. Control plane / data plane / compute plane separation assessment
4. Queue and worker design assessment
5. Multi-tenant isolation assessment
6. Self-hosted tunnel architecture assessment
7. Database and storage scalability assessment
8. GPU compute scaling assessment
9. Observability gaps
10. Security gaps
11. Cost-risk areas
12. Migration/portability gaps
13. Recommended refactors before launch
14. Recommended refactors that can wait until after launch

---

# 16. Final Instruction to the Implementation Agent

Do not review this application only as a normal SaaS app.

Review it as a system that must support:

- fully hosted users
- self-hosted users
- self-hosted users connected through `heardagain.com`
- local data with cloud compute
- future growth in media volume, family graph size, and generation volume

The architecture should be considered successful only if it can scale technically and operationally across all of those modes without requiring a major redesign.
