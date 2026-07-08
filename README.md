# Heard Again

A family story preservation platform that digitizes and preserves family histories through AI-powered transcription, voice synthesis, and conversational interfaces.

![Heard Again Landing Page](UI/public/screenshots/landing-hero.jpg)

## Architecture Overview

This is a multi-service application organized into separate components:

```
heard-again/
├── UI/                    # Next.js web application (main interface)
├── TTS/                   # Python FastAPI service for voice synthesis
├── Scripts/               # Utility scripts for development and operations
├── prisma/                # Shared database schema (PostgreSQL)
├── docs/                  # Documentation and design specs
└── uploads/               # Shared file upload directory
```

## Components

### UI/ - Main Web Application
**Technology:** Next.js 16 + React 19 + TypeScript + Material UI v7

The primary user interface for the platform. Features include:
- **Family Tree Management** - Visual family tree with relationship mapping
- **Story Management** - Upload, edit, and organize family stories
- **Voice Lab** - Voice cloning and text-to-speech synthesis
- **Dashboard** - User familyspace and content overview
- **Collections** - Organize stories into themed collections
- **Timeline** - Chronological view of family events
- **Import/Export** - GEDCOM support for genealogy data
- **Authentication** - NextAuth with MFA support

![Features](UI/public/screenshots/landing-features.jpg)

**Key Directories:**
- `src/components/` - React components
- `src/pages/` - Next.js pages and API routes
- `src/controllers/` - Custom hooks and state management
- `src/services/` - Business logic and external integrations

### TTS/ - Voice Synthesis Service
**Technology:** Python + FastAPI + Qwen3-TTS + PyTorch

AI-powered text-to-speech service supporting voice cloning from reference audio.

**Features:**
- Voice cloning from audio samples
- Voice design from natural language descriptions
- Style preset control (warm, gentle, excited, nostalgic)
- GPU-accelerated inference

**Key Files:**
- `app/main.py` - FastAPI application entry point
- `app/model_manager.py` - Dual model management (Base + VoiceDesign)
- `app/style_presets.py` - Voice style definitions
- `generated/` - Output directory for synthesized audio

**API Endpoints:**
- `POST /api/tts/create-voice-profile` - Clone voice from audio
- `POST /api/tts/synthesize` - Generate speech from text
- `POST /api/tts/upload-reference` - Upload and transcribe audio
- `GET /api/tts/voice-profiles` - List voice profiles

### Scripts/ - Development Utilities
Helper scripts for development, testing, and operations:
- `health-check.sh` - Service health verification
- `logs.sh` - Log aggregation and viewing
- `get-sonar-report.sh` - SonarQube reporting
- `start-dev.sh` - Development environment setup
- `test-enhanced-prompts.js` - AI prompt testing

### prisma/ - Shared Database Schema
Central Prisma schema used by the UI service:
- User management and authentication
- Family relationships (FamilyUnit/FamilyChild normalized model)
- Story and content storage
- Voice profiles and audio metadata

## Prerequisites

- **Node.js** 20.9+ (for UI — required by Next.js 16)
- **Python** 3.10+ (for TTS)
- **PostgreSQL** 15+
- **Redis** 7+
- **Docker** & Docker Compose (recommended)
- **NVIDIA GPU** (optional, for TTS acceleration)

## Quick Start

### Install

```bash
./Scripts/install.sh
```

This script will:
- Check dependencies (Node.js, npm, Docker)
- Create environment files (.env)
- Install all dependencies (root, UI)
- Start PostgreSQL and Redis via Docker
- Run database migrations
- Build the UI application

### Run

```bash
./Scripts/start-dev.sh --live
```

This starts all services with live logging:
- **UI** - http://localhost:4777 (Main web application)
- **PostgreSQL** - localhost:5432
- **Redis** - localhost:6379

To run without live logging (logs to files instead):
```bash
./Scripts/start-dev.sh
```

View logs:
```bash
./Scripts/logs.sh
```

## Manual Setup (Alternative)

If you prefer manual setup instead of using the install script:

```bash
# Install dependencies
npm install
cd UI && npm install

# Setup environment
cp .env.example .env
cp UI/.env.example UI/.env

# Start infrastructure
docker compose up -d db redis

# Setup database
cd UI
npx prisma migrate dev

# Build UI
cd UI
npm run build

# Run services
cd UI && npm run dev        # Port 4777
```

## Docker Deployment (Production)

All services are containerized using Docker. The setup uses **separate Dockerfiles per service** (microservices architecture) orchestrated by a single root `docker-compose.yml`.

### Why Separate Dockerfiles?

Each service has its own `Dockerfile` because:
- **UI** - Node.js Next.js app with specific build steps
- **TTS** - Python FastAPI service with PyTorch/CUDA requirements
- **Infrastructure** - Uses official images (PostgreSQL, Redis, etc.)

This approach allows independent scaling, updates, and technology choices per service.

### Deploy Everything

```bash
# Basic deployment (UI + Database + Redis)
docker compose up -d

# With TTS voice synthesis (requires GPU)
docker compose --profile with-tts up -d
```

### Service URLs (Docker)

| Service | URL | Internal Hostname |
|---------|-----|-------------------|
| UI | http://localhost:4777 | `app` |
| TTS API | http://localhost:4779 | `tts` |
| PostgreSQL | localhost:5432 | `db` |
| Redis | localhost:6379 | `redis` |

### Build Individual Services

```bash
# Build UI only
docker build -t heard-again-ui -f UI/Dockerfile .

# Build TTS only
docker build -t heard-again-tts -f TTS/Dockerfile ./TTS
```

### Development Mode

For development, use the install/start scripts (faster iteration):
```bash
./Scripts/install.sh
./Scripts/start-dev.sh --live
```

Docker is primarily for production deployment.

---

## Environment Configuration

### Root `.env`
```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/heard_again

# Authentication
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:4777

# Services
TTS_SERVICE_URL=http://localhost:4779
REDIS_URL=redis://localhost:6379

# Optional: External APIs
OPENAI_API_KEY=your-key
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_ENDPOINT=your-r2-endpoint-url
R2_BUCKET_NAME=your-r2-bucket-name
```

## Testing

```bash
# Run UI tests
cd UI && npm test

# Coverage report
cd UI && npm run test:coverage
```

## Production Deployment

### Build and Start

```bash
# Build UI for production
cd UI && npm run build

# Docker production deployment
docker compose -f docker-compose.yml up -d
```

### SonarQube Code Quality

```bash
# Start SonarQube server
npm run sonar:start

# Run analysis
npm run sonar:scan

# View reports
open http://localhost:9000
```

## Development Workflow

### Database Changes

```bash
cd UI

# Create migration
npx prisma migrate dev --name your_migration_name

# Deploy to production
npx prisma migrate deploy

# Generate client after schema changes
npx prisma generate
```

### Adding Dependencies

```bash
# UI dependency
cd UI && npm install package-name

# Root/orchestration dependency
npm install package-name
```

## Troubleshooting

**Port Conflicts:**
- UI runs on port 4777
- TTS runs on port 4779

**Database Connection Issues:**
Ensure PostgreSQL is running: `docker compose up -d db`

**TTS GPU Not Available:**
TTS service runs in CPU mode without GPU. For GPU support, ensure NVIDIA Docker runtime is configured.

**Build Errors:**
Clear caches and rebuild:
```bash
cd UI && rm -rf .next node_modules && npm install && npm run build
```

## License

MIT License - See LICENSE file for details

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, development setup, and pull request process.

## Support

For issues and questions, refer to:
- `docs/` directory for detailed specifications and architecture guides.
- Individual component READMEs for service-specific documentation.


## Workspace Commands (Next.js app in `UI/`)

This repository is configured as an npm workspace monorepo (`UI`). When running Next.js commands, prefer workspace-aware invocations from the repo root:

```bash
npm --workspace UI run dev
npm --workspace UI run lint
npm --workspace UI run build
```

You can still run commands from inside `UI/`, but avoid passing `.` to `next lint` (use `next lint`), because dot-based invocations can trigger incorrect root resolution in multi-lockfile environments.

