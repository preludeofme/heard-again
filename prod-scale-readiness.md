# Production Scalability & Readiness Review: AI Generation System

**Project:** Heard Again  
**Review Date:** April 27, 2026  
**Status:** Hardened (Container/Resource Level) | Scaling Pending (Hardware/Orchestration Level)

---

## 1. Executive Summary
The "Heard Again" AI generation system (Chat & TTS) is currently transitioning from an "Ambitious Prototype" to a "Production-Ready Service." While the code handles individual requests with high quality, the architecture's reliance on a single GPU and synchronous locking mechanisms creates a hard ceiling for concurrency. 

As of this review, the system has been hardened at the container and resource level to prevent "cascading failures" during bursts, but true 1000-user readiness requires horizontal scaling across multiple GPU nodes and transition to centralized state management.

---

## 2. Hardening Actions Taken (Immediate Readiness)

I have implemented the following changes to ensure the system doesn't crash the host machine during a 1000-user burst:

### A. Resource Governance (Docker)
*   **CPU & Memory Limits**: Explicit limits and reservations added to all services in `docker-compose.yml`. This prevents "noisy neighbor" containers from starving the system or triggering OOM (Out-of-Memory) kills on the host.
*   **Memory Reservations**: Critical AI services (Ollama, TTS) now have memory reservations to ensure they have the minimum required VRAM/RAM to load models before accepting traffic.

### B. Statelessness & Scaling Prerequisites
*   **Named Volumes**: Replaced local bind mounts with managed named volumes (`generated_audio`, `voice_profiles`, `reference_audio`). 
    *   *Why?* This allows the application to move from a single-server setup to a multi-node cluster (using EFS, Azure Files, or Ceph) without code changes.

### C. Database Connection Optimization
*   **Prisma Pooling**: Injected `connection_limit` parameters into `DATABASE_URL` for all services.
    *   `chat`: 10 connections
    *   `app`: 20 connections
    *   `ingestion-worker`: 5 connections
    *   *Why?* This prevents 1000 concurrent Next.js serverless functions or worker threads from exhausting the PostgreSQL connection pool.

---

## 3. Critical Bottlenecks (The "1000 User" Ceiling)

The following areas are identified as the primary blockers to high-concurrency scaling:

### ❌ TTS Global Serialization
*   **Location:** `TTS/tts-service/app/model_manager.py`
*   **Issue:** A global `threading.Lock()` serializes all GPU synthesis.
*   **Impact:** If 1000 users request audio at once, they will be processed in a single-file line. Most requests will time out before they are reached.
*   **Production Fix:** Deploy multiple instances of the TTS service across a GPU cluster and use a load balancer.

### ❌ GPU VRAM Contention
*   **Location:** `docker-compose.yml` (GPU Reservation)
*   **Issue:** Ollama and Qwen3-TTS share a single GPU reservation without coordinated VRAM management.
*   **Impact:** A burst of chat requests can fill the VRAM, causing the TTS service to fail with `CUDA Out of Memory` when it tries to synthesize audio, and vice versa.
*   **Production Fix:** Isolate models to specific GPUs or nodes.

### ❌ In-Memory Rate Limiting
*   **Location:** `TTS/tts-service/app/rate_limiter.py`
*   **Issue:** The Python service uses local memory to track request counts.
*   **Impact:** If you scale horizontally (e.g., to 5 TTS containers), the rate limit is effectively multiplied by 5, as each container has its own independent "memory."
*   **Production Fix:** Refactor the Python rate limiter to use the existing Redis instance.

---

## 4. Scaling Roadmap (To 1000 Concurrent Users)

To achieve the 1000-user target, the following infrastructure changes are recommended:

### Phase 1: Connection & State (High Impact/Low Effort)
1.  **PgBouncer Integration**: Deploy a connection pooler in front of PostgreSQL to handle the high volume of short-lived Prisma connections.
2.  **Redis-Backed TTS Rate Limiting**: Centralize rate limiting in Redis so it remains consistent across all horizontal instances.

### Phase 2: Content Delivery (Performance)
1.  **S3/R2 Asset Storage**: Transition from local volumes to object storage for all audio and profile assets.
2.  **CDN Integration**: Serve generated audio assets via a CDN (CloudFront/Cloudflare) to offload egress traffic from the `app` container.

### Phase 3: AI Orchestration (True Concurrency)
1.  **Inference Server Upgrade**: Consider moving from raw Ollama to a high-throughput inference server like **vLLM** or **NVIDIA Triton**, which supports continuous batching of requests.
2.  **GPU Auto-Scaling**: Move to a Kubernetes-based orchestration (K8s) with GPU-aware auto-scaling (KEDA) to spin up/down TTS workers based on queue depth.

---

## 5. Security & Safety Note
As the system scales, the "Strict Persona" enforcement (deterministic temperature, hallucination detection) becomes even more critical. Ensure that the **Evaluation Framework** (`Chat/npm run eval`) is integrated into the CI/CD pipeline to prevent scaling up a "hallucinating" or "unstable" model version.
