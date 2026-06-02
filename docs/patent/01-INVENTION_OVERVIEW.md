# Heard Again — Invention Overview & Technical Disclosure

> **Prepared for Patent Attorney Review**
> **Project:** Heard Again — Family Story Preservation Platform
> **Date:** June 1, 2026
> **Inventor:** Ryan Buck

---

## 1. Executive Summary

Heard Again is a **multi-service platform for preserving, experiencing, and interacting with family stories** through the integration of:

1. **Voice Cloning & Synthesis** — Creating personalized, consent-gated AI voice profiles from short reference recordings, enabling deceased or distant relatives to "speak" their stories
2. **Family Tree Visualization** — An interactive, graph-based family tree with real-time relationship navigation and gigapixel export capabilities
3. **AI Persona Chat** — A retrieval-augmented generation (RAG) system that allows users to converse with AI personas of family members, grounded exclusively in uploaded documents
4. **Story Preservation** — A rich multimedia platform for collecting, narrating, and sharing family memories through text, audio, and voice-narrated content

The platform operates as a hybrid on-premises/cloud system with GPU-accelerated voice processing running locally while web services route through a secure proxy.

---

## 2. Problem Space

### Problems Solved by Heard Again

1. **Voice as a Connector**: Written obituaries and photo albums are static. Hearing a loved one's synthesized voice telling their own story creates a fundamentally deeper emotional connection that existing platforms (Ancestry.com, MyHeritage, FamilySearch) do not provide.

2. **Consent-First Voice Cloning**: Existing voice cloning tools (ElevenLabs, Resemble AI) lack genealogical consent workflows. Heard Again invented a **multi-party consent system** where living relatives or estate representatives must explicitly grant permission (recorded via cryptographic attestation) before a deceased person's voice can be cloned from audio recordings.

3. **Persona Grounded in Documents**: Most AI chatbots hallucinate freely. Heard Again's **Evidence Gate** ensures every AI response about a family member is grounded in uploaded documents (letters, recordings, diaries) with a minimum evidence threshold before the persona can answer.

4. **Gigapixel Family Tree Export**: Large family trees (500+ members across 6+ generations) render poorly in browsers. Heard Again invented a **tile-and-stitch puppeteer pipeline** that captures vector-quality graph canvases and stitches them into gigapixel PNG files using Sharp image processing.

5. **Hybrid Compute Model**: Heard Again's deployment architecture allows GPU-intensive voice synthesis to run locally while the web application serves from the cloud, with optional tunnel networking for remote access — a design that reduces cloud costs by 90%+ for families.

---

## 3. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Internet / Cloud                             │
│                                                                     │
│  User Browser  ←→  Vercel / Next.js Web UI (:4777)                  │
│                      ↕ (NextAuth + session tokens)                   │
│                      ↕ (API routes: /api/* — thin handlers)          │
│                      ↕                                               │
│  ┌─────────────── API Proxy Layer ───────────────────┐              │
│  │  /api/voice/* → TTS Service (:4779)               │              │
│  │  /api/chat/*  → Chat Service (:4778)              │              │
│  │  /api/export  → RunPod Serverless / Docker Worker  │              │
│  └───────────────────────────────────────────────────┘              │
│                                                                     │
│   ┌─────────────────────────────────────────────────────┐           │
│   │              On-Premises Server (Home)               │           │
│   │                                                      │           │
│   │  ┌─────────┐  ┌──────────┐  ┌───────────┐          │           │
│   │  │ TTS     │  │ Chat     │  │ PostgreSQL │          │           │
│   │  │ Python  │  │ Next.js  │  │ (Prisma)   │          │           │
│   │  │ FastAPI │  │ RAG+LLM  │  │            │          │           │
│   │  │ Port    │  │ Port     │  │ Port 5432  │          │           │
│   │  │ 4779    │  │ 4778     │  │            │          │           │
│   │  │ Qwen3   │  │ Ollama   │  │ Redis      │          │           │
│   │  │ TTS GPU │  │ ChromaDB │  │ Port 6379  │          │           │
│   │  └────┬────┘  └────┬─────┘  └───────────┘          │           │
│   │       │            │                                │           │
│   │       └──── Caddy Proxy (:4777) ◄── Tailscale ◄─── │           │
│   │                    │                                │           │
│   │              GPU (RTX 4090 / Blackwell)             │           │
│   │              Docker Compose (10 services)           │           │
│   └─────────────────────────────────────────────────────┘           │
│                                                                     │
│    ┌──────────────────────────────────────────────┐                 │
│    │          RunPod Serverless (Production)       │                 │
│    │  TTS Worker (GPU) — Puppeteer Exporter        │                 │
│    │  Cloudflare R2 for audio storage               │                 │
│    └──────────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Services & Ports

| Service | Technology | Port | Purpose |
|---------|-----------|------|---------|
| **UI** | Next.js 16 + React 19 + MUI v7 | 4776→4777 (Caddy) | Main web application |
| **Chat** | Next.js 14 + TypeScript | 4778 | RAG chat, persona engine, LLM orchestration |
| **TTS** | Python FastAPI + Qwen3-TTS | 4779 | Voice cloning, synthesis, style presets |
| **Database** | PostgreSQL 15 + Prisma | 5432 | Unified schema across services |
| **Cache/Queue** | Redis | 6379 | Rate limiting, BullMQ job queues |
| **Vector DB** | ChromaDB | 8000 (internal) | Embedding storage for RAG |
| **LLM** | Ollama | 11434 (internal) | Local LLM inference |

---

## 4. What Makes Heard Again Patentable

Based on the codebase analysis, there are **five core inventions** that appear novel:

| # | Invention | Category | Uniqueness |
|---|-----------|----------|------------|
| 1 | **Consent-First Voice Cloning Pipeline** | Voice/Biometrics | Multi-party attestation with HMAC-signed tokens, per-familyspace encryption, granular cloud processing consent |
| 2 | **Evidence-Gated Persona Chat** | AI/Conversational | Grounded RAG with configurable evidence thresholds, natural-language refusal messages, persona generation from documents |
| 3 | **Tile-and-Stitch Gigapixel Tree Export** | Visualization | Puppeteer captures tiles at 1:1 scale, Sharp stitches into gigapixel output — solves browser texture limits |
| 4 | **Hybrid Voice/Family Graph Architecture** | Systems | Local GPU for inference + cloud for serving, multi-service orchestration with consent auditing |
| 5 | **Multi-Tenant Speech Consent Management** | Legal/Privacy | Audit log of consent changes, revocable permissions, encryption-at-rest of voice profiles |

The detailed write-up for each is in the companion documents.

---

## 5. Key Technical Differentiators vs. Existing Solutions

| Feature | Ancestry.com | MyHeritage | ElevenLabs | Heard Again |
|---------|-------------|------------|------------|-------------|
| Voice Narrated Stories | ✗ | ✗ | ✗ (API only) | ✓ (full pipeline) |
| Family Tree + Voice Integration | ✗ | ✗ | ✗ | ✓ |
| Deceased Voice Cloning (Ethical) | ✗ | "Deep Nostalgia" (video) | ✗ | ✓ (consent-gated) |
| AI Persona Chat w/ Evidence Gating | ✗ | ✗ | ✗ | ✓ |
| Gigapixel Tree Export | ✗ | ✗ | ✗ | ✓ |
| Local GPU / Cloud Hybrid | ✗ | ✗ | ✗ | ✓ |
| Voice Style Presets (warm, gentle, etc.) | ✗ | ✗ | ✓ | ✓ (QLoRA-free) |
| Open Source Model | ✗ | ✗ | ✗ | ✓ (Qwen3-TTS) |

---

## 6. Disclosure Precautions

**Before filing:**
- `heardagain.com` is live and has been since [check date]. Public disclosure of these features may have already started the 1-year US patent clock (35 U.S.C. § 102(b)).
- The codebase is hosted on GitHub. Check repository visibility and any prior public commits.
- This document was prepared for legal review only and should not be shared outside of legal counsel until filing.
