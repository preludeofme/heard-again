# Heard Again: Lite (No-AI) Local Setup Guide

This guide describes how to set up and run the core features of **Heard Again** (family story documentation, media hosting, family tree management, GEDCOM import/export, and timelines) on your local machine **without** the resource-intensive AI services (FastAPI, Qwen3-TTS, Python, CUDA/GPU drivers, or PyTorch).

---

## Architecture: Standard vs. Lite

```
                    ┌────────────────────────┐
                    │      Web Browser       │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │    UI (Next.js App)    │
                    │      (Port 4777)       │
                    └─────┬───────┬───────┬──┘
                          │       │       │
      ┌───────────────────┘       │       └───────────────────┐
      ▼                           ▼                           ▼
┌────────────┐              ┌────────────┐              ┌────────────┐
│ PostgreSQL │              │   Redis    │              │Trigger.dev │
│ (Database) │              │  (Cache)   │              │  (Worker)  │
└────────────┘              └────────────┘              └────────────┘
      
      ❌ BYPASSED IN LITE DEPLOYMENT:
      ┌────────────────────────────────────────────────────────┐
      │  TTS Python Service (Qwen3-TTS, PyTorch, GPU/CUDA)      │
      └────────────────────────────────────────────────────────┘
```

When running in **Lite Mode**, all database operations, story authoring, timeline visualizations, and media uploads function normally. The AI voice cloning, speech synthesis, and automatic audio transcriptions are disabled.

---

## 1. Prerequisites

To run the Lite version, you only need standard web development tools. You **do not** need Python, CUDA, PyTorch, or an NVIDIA GPU.

- **Node.js**: `20.9.0+`
- **npm**: `10.0.0+`
- **Docker & Docker Compose**: Recommended to instantly run PostgreSQL and Redis. If you don't have Docker, you can install PostgreSQL and Redis directly on your operating system.

---

## 2. Installation

Clone the repository and install the Node.js dependencies:

```bash
# Clone the repository
git clone https://github.com/preludeofme/heard-again.git
cd heard-again

# Install workspace and UI dependencies
npm run install:all
```

---

## 3. Environment Configuration

The application is configured to run without AI out of the box using environment flags.

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Open the newly created `.env` file in your editor and verify/update the following configuration keys:

   ```env
   # Database Connection
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/heard_again"
   POSTGRES_PASSWORD="postgres_secure_password"

   # NextAuth Authentication
   NEXTAUTH_SECRET="generate-a-secure-random-string-here"
   NEXTAUTH_URL="http://localhost:4777"

   # Disable Audio Generation & Background Narration Workers
   AUDIO_GENERATION_ENABLED="false"
   NARRATION_WORKER_ENABLED="false"

   # Set Media Uploads to Local Directory
   STORAGE_MODE="local"
   UPLOAD_DIR="./uploads"

   # Bypassed/Unused Settings (Safe to leave as dummy values or empty)
   TTS_SERVICE_URL="http://localhost:4779" # FastAPI service is not running
   TTS_SERVICE_SECRET="dummy_secret"
   ```

3. Sync the environment variables to the Next.js frontend folder:
   ```bash
   cp .env UI/.env
   ```

---

## 4. Run Core Services (PostgreSQL & Redis)

Use the Docker Compose profile to spin up only the database and caching layer:

```bash
# Start PostgreSQL, Redis, and ClamAV (for security virus scanning)
docker compose up -d db redis clamav
```

---

## 5. Initialize the Database

Apply the database schema using Prisma and seed the initial workspace tables:

```bash
# Generate the Prisma Client
npm run db:generate

# Apply migrations to create database tables
npm run db:migrate

# Seed the database with default admin account and initial structures
npm run db:seed
```

---

## 6. Run the Application

Start the Next.js development server:

```bash
# From the root directory, start the Next.js development server
npm --workspace UI run dev
```

Your Heard Again application is now active on **http://localhost:4777** (or proxy port **http://localhost:4776** depending on your local config).

---

## What Works vs. What is Disabled in Lite Mode

### What Works:
* **Family Tree Visualizer**: Create, view, edit, and link family members together in a visual family tree.
* **Story & Keepsake Documenting**: Write, structure, and save stories, biographies, and memories for any family member.
* **Media & File Hosting**: Upload photos, document scans, letters, and even pre-recorded audio files as attachments to stories.
* **GEDCOM Import/Export**: Import external family trees (`.ged` files) or export your current tree.
* **Family Timelines**: View chronological events across family history.

### What is Disabled:
* **Voice Cloning**: Creating AI voice signatures from reference audio profiles.
* **Text-to-Speech (TTS)**: Generating synthetic spoken narration of your written stories.
* **Audio Transcription**: Automated text generation from uploaded audio recordings.

---

## Troubleshooting

### Trigger.dev Dev Worker Warns About Missing Secret
The background processor (Trigger.dev) is used for long-running imports or exports. If you see warnings about `TRIGGER_SECRET_KEY` being missing, you can safely ignore them for simple, manual storytelling. If you want to use the GEDCOM import/export:
1. Trigger.dev runs locally at http://localhost:3030 when starting the stack.
2. Sign in or create a local project there.
3. Paste the generated API token into `TRIGGER_SECRET_KEY` in your `.env` file.
