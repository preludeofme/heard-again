# GEMINI.md - Heard Again Project Context

This project, **Heard Again**, is a sophisticated family story preservation platform that leverages AI for transcription, voice synthesis (TTS), and RAG-based conversational interfaces.

## Project Overview

Heard Again is a multi-service application (monorepo structure) designed to digitize and preserve family histories. It consists of three primary services:

1.  **UI (`/UI`)**: Main web application.
    *   **Tech**: Next.js 16 (Pages Router), React 19, TypeScript, Material UI v7, NextAuth.
    *   **Features**: Family tree management, story collections, media uploads, and the "Voice Lab".
2.  **Chat (`/Chat`)**: AI conversational system.
    *   **Tech**: Next.js 14, Ollama, ChromaDB (Vector DB), Redis/BullMQ (Ingestion).
    *   **Features**: Family-history focused RAG, strict persona engine, and background document processing.
3.  **TTS (`/TTS`)**: Voice synthesis service.
    *   **Tech**: Python FastAPI, Qwen3-TTS, PyTorch.
    *   **Features**: Voice cloning from audio samples and style-preset synthesis.

The project uses a **Unified Prisma Schema** (`/prisma/schema.prisma`) shared across the UI and Chat services, backed by **PostgreSQL**.

## Architecture & Conventions

### 1. Contextual UI
The application relies heavily on the `SelectedFamilyMemberContext`. Most views and data fetches are dynamically filtered based on the currently active family member.

### 2. Strict Persona System
The Chat system implements a "Strict Persona" to prevent hallucinations:
*   **Deterministic**: LLM Temperature is set to `0.3`.
*   **Knowledge-Grounded**: Responses must be based on retrieved documents or verified facts.
*   **Uncertainty Phrases**: If information is unknown, the LLM *must* use specific phrases like "I don't recall that, I'm afraid."
*   **Hallucination Detection**: Post-generation validation checks for speculative language or invented details.

### 3. Security & Safety
*   **Location**: Security primitives (CSRF, rate limiting, MFA) are centralized in `UI/src/lib/security/`.
*   **Uploads**: All files undergo optimization and virus scanning (ClamAV) via `UI/src/lib/file-optimizer/`.

### 4. Database Management
*   Shared schema located at `prisma/schema.prisma`.
*   Always run `npm run db:generate` (or `npx prisma generate`) after schema changes to maintain type safety.

---

## Building and Running

### Development Environment

The project provides a centralized orchestration script:

```bash
# Install all dependencies (root, UI, Chat)
npm run install:all

# Start all services (UI, Chat, TTS, DB, Redis) with live logging
npm run dev

# Alternative: Start infra only
npm run docker:up
```

### Key Service Ports
| Service | Internal Port | Proxy Port (Caddy) |
| :--- | :--- | :--- |
| UI | 4776 | 4777 |
| Chat | 4778 | - |
| TTS | 4779 | - |
| PostgreSQL | 5432 | - |
| Redis | 6379 | - |

### Database Commands (Run from root)
*   `npm run db:migrate`: Create and apply migrations.
*   `npm run db:generate`: Update Prisma client.
*   `npm run db:seed`: Seed the database with test data.
*   `npm run db:studio`: Open Prisma Studio.

---

## Testing & Quality

### Automated Testing
*   **UI Tests**: `cd UI && npm test` (Jest)
*   **Chat Tests**: `cd Chat && npm test` (Jest)
*   **E2E Tests**: `npm run e2e:test` (Playwright)

### AI Evaluation (Chat)
The Chat system has a custom evaluation framework for quality gating:
```bash
cd Chat
npm run eval:release-candidate # Full comparison and Go/No-Go report
```

### Code Quality
*   **SonarQube**: Analysis can be run via `npm run sonar:scan`.
*   **Linting**: `npm run lint` (runs UI lint).

## Key Documentation
*   `CLAUDE.md`: Quick reference for commands and ports.
*   `docs/STRICT_PERSONA_SYSTEM.md`: Detailed rules for AI response behavior.
*   `docs/CHAT_SYSTEM_ARCHITECTURE.md`: RAG pipeline and vector DB design.
*   `docs/QWEN3_TTS_SETUP_GUIDE.md`: Setup for GPU-accelerated voice synthesis.
