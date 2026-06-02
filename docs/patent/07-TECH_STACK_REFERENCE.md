# Heard Again — Complete Tech Stack Reference

> **For Patent Attorney Due Diligence**
> **Date:** June 1, 2026

---

## 1. Technology Stack

### 1.1 Primary Application (UI)

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | Next.js (Pages Router) | 16.2.6 |
| **UI Library** | React | 19.2.6 |
| **Component Library** | MUI (Material UI) | v7 |
| **Styling** | Emotion (CSS-in-JS) | ^11.14 |
| **Graph Visualization** | @xyflow/react (ReactFlow) | ^12.10.1 |
| **Tree Layout** | D3 (via d3-hierarchy) | ^7.9.0 |
| **Rich Text Editor** | TipTap | ^3.22.5 |
| **Audio Waveform** | wavesurfer.js + peaks.js | ^7.12.4 |
| **Canvas Export** | html-to-image | ^13.x |
| **Language** | TypeScript | ^5.9.3 |
| **Auth** | NextAuth.js | ^4.24.13 |
| **ORM** | Prisma | ^6.19.3 |
| **Queue** | BullMQ (Redis) | ^4.18.3 |
| **Validation** | Zod | ^4.3.6 |
| **Security** | bcrypt, speakeasy, otplib | Various |
| **File Upload** | formidable | ^3.5.4 |
| **Image Processing** | sharp | ^0.33.5 |
| **PDF Generation** | pdf-lib | ^1.17.1 |
| **PDF Extraction** | mammoth (docx) | ^1.12.0 |
| **Background Jobs** | Trigger.dev | v4 |
| **File Type** | file-type | ^21.3.4 |
| **Testing** | Jest / Playwright | Various |

### 1.2 Chat Service

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14 (Pages Router) |
| **LLM Gateway** | Custom abstraction over Ollama |
| **Vector Store** | ChromaDB |
| **Embeddings** | Local embedding model via Ollama |
| **Document Ingestion** | BullMQ workers |
| **Repository Pattern** | Custom DB access layer |
| **Evaluation** | Custom eval harness (`Chat/evals/`) |

### 1.3 TTS Service

| Layer | Technology |
|-------|-----------|
| **Framework** | Python FastAPI |
| **Model** | Qwen3-TTS (HuggingFace) |
| **GPU Compute** | PyTorch + CUDA |
| **Reference Audio** | 10-60 second clips |
| **Voice Profiles** | .pt model weights (encrypted at rest) |
| **Style Presets** | Parameter-based (no QLoRA needed) |
| **Encryption** | AES-256-GCM via cryptography.hazmat |
| **Token Auth** | HMAC-SHA256 |

### 1.4 Infrastructure

| Component | Technology |
|-----------|-----------|
| **Container Orchestration** | Docker Compose |
| **Reverse Proxy** | Caddy (with Tailscale) |
| **Database** | PostgreSQL 15 |
| **Cache / Queue** | Redis 7 |
| **Vector DB** | ChromaDB |
| **LLM** | Ollama (qwen3:14b, qwen3-coder:30b) |
| **Cloud Hosting** | Vercel (UI) + RunPod (GPU workers) |
| **Object Storage** | Cloudflare R2 |
| **VPN** | Tailscale |
| **CI/CD** | Google Cloud Build |
| **Code Quality** | SonarQube |

---

## 2. API Endpoint Map

### 2.1 Core Domain Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/*` | Various | NextAuth authentication |
| `/api/people/*` | CRUD | Person management |
| `/api/people/[id]` | GET | Person details with relations |
| `/api/relationships/*` | CRUD | Relationship management |
| `/api/stories/*` | CRUD | Story management (text, audio, media) |
| `/api/family-tree` | GET | Tree data with edges |
| `/api/search` | GET | Full-text search across people/stories |
| `/api/timeline` | GET | Chronological event timeline |
| `/api/locations` | GET | Geocoded story/photos locations |

### 2.2 Voice Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/voice/profiles` | GET/POST | List/create voice profiles |
| `/api/voice/profiles/[id]` | PATCH/DELETE | Update/delete voice profile |
| `/api/voice/consent` | POST | Grant voice consent |
| `/api/voice/consent/[id]` | DELETE | Revoke consent |
| `/api/voice/jobs` | GET/POST | List/create generation jobs |
| `/api/voice/jobs/[id]` | GET | Check generation job status |
| `/api/voice/audio/[id]` | GET | Serve generated audio file |
| `/api/voice/synthesize` | POST | Trigger on-demand synthesis |

### 2.3 Chat Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chat/sessions` | GET/POST | List/create chat sessions |
| `/api/chat/sessions/[id]` | GET/DELETE | Get/delete session |
| `/api/chat/sessions/[id]/messages` | GET/POST | Send/receive messages |

### 2.4 Export Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/export` | POST | Trigger export job |
| `/api/export/jobs/[id]` | GET | Poll export status |

### 2.5 Admin Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/instance/register` | POST | On-premises instance registration |
| `/api/instance/heartbeat` | POST | Instance health check |
| `/api/billing/*` | Various | Subscription management (Stripe) |
| `/api/logs` | GET | Audit log access |

---

## 3. Data Model Map (Prisma)

### 3.1 Core Models (20+)

| Model | Lines | Purpose |
|-------|-------|---------|
| User | 67 | User accounts, auth, preferences |
| Familyspace | 44 | Family group/tenant |
| Membership | 24 | User-to-familyspace with roles |
| Person | 48 | Individual family member |
| PersonName | 18 | Multiple names per person (birth, married, etc.) |
| PersonEvent | 22 | Life events (birth, marriage, death, etc.) |
| FamilyUnit | 16 | Parent-child grouping unit |
| FamilyParent | 12 | Parent in a family unit |
| FamilyChild | 12 | Child in a family unit |
| Story | 47 | Family story/memory |
| StoryComment | 16 | Threaded comments on stories |
| Asset | 34 | All uploaded/generated media files |
| Document | 24 | Digitized family records |
| DocumentChunk | 12 | Embedding chunks for RAG |
| VoiceProfile | 28 | Cloned voice model metadata |
| VoiceConsent | 19 | Multi-party consent records |
| VoiceGenerationJob | 18 | Synthesis job queue |
| PersonaProfile | 35 | AI persona configuration |
| AuditLog | 15 | Immutable action log |
| Instance | 25 | On-premises deployment tracking |
| ChatSession | 15 | AI conversation sessions |
| ChatMessage | 9 | Individual messages |

### 3.2 Enum Models (25+)

UserStatus, PlanType, DeploymentMode, FamilyspaceStatus, FamilyspaceRole, MembershipStatus, InviteStatus, ImportSourceType, JobStatus, ExportType, PersonType, PersonNameType, PersonEventType, ParentRelationshipType, ChildRelationshipType, ExternalRefSystem, GenerationMode, NotificationType, InstanceType, InstanceStatus, ComputeMode, DataMode, BillingStatus, GedcomSex, StoryType, DatePrecision, StoryStatus, TranscriptionStatus, NarrationStatus, DocumentType, StorageType, AssetType, ProcessingStatus, AssetRole, VoiceModelType, VoiceStatus, GenerationStatus, ActorType, MergeStatus

---

## 4. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Pages Router over App Router** | Pages Router is stable, well-documented, and all patterns were already established before App Router was production-ready for Next.js 16 |
| **MUI v7 + Emotion** | Established pattern from earlier versions; Emotion integration is deep and well-tested |
| **Prisma over TypeORM/Drizzle** | Prisma's type generation and migration pipeline were superior for the multi-service shared-schema pattern |
| **BullMQ over direct Pub/Sub** | Deduplication, retries, and visibility into job queues was critical for document ingestion and voice generation |
| **Qwen3-TTS over ElevenLabs API** | Full local control, no API costs, ability to encrypt voice profiles at rest |
| **ChromaDB over Pinecone** | Self-hosted, local inference pipeline, no cloud dependency for vector search |
| **Tailscale over traditional VPN** | Zero-config wireguard tunnel, no open ports needed, works behind NAT |
| **Caddy over nginx** | Automatic HTTPS, simpler config for Tailscale setup |
| **Opinionated form library (none)** | MUI form components + Zod validation proved simpler and more flexible than Formik/React Hook Form for the domain's moderate complexity |
| **Watchtower for Container Updates** | Automated container image updates with rollback capability, monitoring for failed updates |

---

## 5. Timeline of Development

This timeline is approximate based on codebase analysis and should be confirmed by the inventor:

| Phase | Approx. Date | Milestones |
|-------|-------------|-----------|
| **Initial Prototype** | Mid 2024 | Basic family tree, Next.js setup, Prisma schema first draft |
| **Platform Foundation** | Late 2024 | Auth system, story management, asset upload pipeline, Docker setup |
| **Voice System** | Early 2025 | Qwen3-TTS integration, voice profile management, consent system |
| **AI Chat** | Mid 2025 | RAG pipeline, persona generation, ChromaDB, Evidence Gate |
| **Gigapixel Export** | Mid 2025 | Puppeteer exporter, tile-and-stitch, RunPod integration |
| **Production Polish** | Late 2025 | MFA, billing, audit logs, instance management, hybrid deployment |
| **Refinement & Scale** | 2026 | Performance optimization, expanded features, `heardagain.com` live |

---

## 6. Next Steps For Patent Filing

- [ ] **Confirm first public disclosure date** — when did `heardagain.com` go live?
- [ ] **Check GitHub repo visibility** — is the repo public or private? Were any versions public?
- [ ] **Prior art search** — validate novelty of each of the 5 invention areas
- [ ] **Consider filing strategy** — single comprehensive patent vs. multiple filings per invention area
- [ ] **Priority filing** — provisional patent (USPTO) can establish early filing date
- [ ] **Prosecution counsel** — find patent attorney experienced in software/AI/voice technology
- [ ] **International considerations** — PCT filing if international protection desired
