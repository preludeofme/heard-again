# Heard Again - Development Environment Setup

## Port Configuration

| Service | Port | Status |
|---------|------|--------|
| Main Next.js App | 4777 | ✓ Updated |
| Chat System | 3001 | ✓ Updated (was 4777) |
| TTS Service | 8100 | ✓ No conflict |
| PostgreSQL | 5432 | ✓ No conflict |
| Redis | 6379 | ✓ No conflict |

## Changes Made

### 1. Port Conflict Resolution

**chat-system/package.json**
- `dev` script: Changed from port 4777 to 3001
- `start` script: Changed from port 4777 to 3001

**chat-system/.env.example**
- `PORT`: Changed from 4777 to 3001

**Main app .env** (`/home/trubuck-design/Projects/Personal/heard-again/.env`)
- Added `CHAT_SYSTEM_URL=http://localhost:3001`

**docker-compose.yml**
- Added `CHAT_SYSTEM_URL=${CHAT_SYSTEM_URL:-http://chat-system:3001}` to main app environment

### 2. Chat System Database Setup

Created `/home/trubuck-design/Projects/Personal/heard-again/chat-system/.env` with:
- Database URL for `heard_again_chat` database
- Redis, ChromaDB, Ollama configuration
- Port 3001 setting

Applied migrations:
- `001_init_chat_schema.sql` - Creates all core tables and enums
- `20260328195000_add_custom_instructions_to_persona_profile` - Adds custom_instructions column

### 3. Startup Script

Created `/home/trubuck-design/Projects/Personal/heard-again/scripts/start-dev.sh`:
- Checks port availability before starting
- Installs dependencies if needed
- Runs database migrations
- Starts Chat System on port 3001
- Starts Main App on port 4777
- Optionally starts TTS Service (if Python venv exists)
- Health checks for all services
- Logs to `/home/trubuck-design/Projects/Personal/heard-again/logs/`

## How to Start All Services

```bash
# One command to start everything
./scripts/start-dev.sh
```

Or manually:

```bash
# Terminal 1: Chat System (port 3001)
cd chat-system
npm run dev

# Terminal 2: Main App (port 4777)
npm run dev

# Terminal 3: TTS Service (port 8100) - Optional, requires GPU
cd tts-service
source venv/bin/activate
python -m app.main
```

## Access Points

- **Main Application**: http://localhost:4777
- **Chat System API**: http://localhost:3001
- **TTS Service API**: http://localhost:8100

## Testing Voice & Chat

1. **Voice Lab** (http://localhost:4777/voice-lab):
   - Upload voice sample
   - Name it (e.g., "Grandpa Buck")
   - Add style description
   - Click "Create Voice"

2. **Talk** (http://localhost:4777/talk):
   - Select a family member
   - Type a message
   - Chat system responds via LLM
   - Voice synthesis plays response (if voice configured)

## Logs Location

- Main App: `/home/trubuck-design/Projects/Personal/heard-again/logs/main-app.log`
- Chat System: `/home/trubuck-design/Projects/Personal/heard-again/logs/chat-system.log`
- TTS Service: `/home/trubuck-design/Projects/Personal/heard-again/logs/tts-service.log`
