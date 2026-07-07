# Qwen3-TTS Service for Heard Again

Local FastAPI service that wraps **Qwen3-TTS** for voice cloning and text-to-speech, used by the Heard Again Next.js frontend.

> **Which directory should I use?** This folder (`TTS/app`) is the version referenced by
> `docker-compose.yml` and is the target for containerized/production deployment.
> `npm run dev` (via `Scripts/start-dev.sh`) currently starts the service from
> `TTS/tts-service/` instead, which also contains RunPod serverless deployment variants
> (`Dockerfile.runpod*`) not used by Docker Compose. The two trees have diverged and are
> pending consolidation — if you're changing TTS behavior, check whether your change needs
> to be made in both places until that consolidation happens.

## Prerequisites

Before starting the service, make sure you have:
- NVIDIA GPU with CUDA drivers
- Python venv at `~/qwen3-tts/venv` with PyTorch + Qwen3-TTS installed
- The Qwen3-TTS model downloaded via HuggingFace

## Quick Start

```bash
# From project root
npm run start:tts

# Or directly
cd TTS && ./start.sh
```

The service starts on **http://localhost:4779** (see `TTS_PORT`).

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tts/health` | Health check + GPU info |
| POST | `/api/tts/load-model` | Manually trigger model loading |
| POST | `/api/tts/upload-reference` | Upload reference audio for cloning |
| POST | `/api/tts/create-voice-profile` | Create .pt voice profile from reference |
| GET | `/api/tts/voice-profiles` | List saved voice profiles |
| DELETE | `/api/tts/voice-profiles/{id}` | Delete a voice profile |
| POST | `/api/tts/synthesize` | Generate speech using a voice profile |
| POST | `/api/tts/synthesize-direct` | Generate speech directly from reference audio |
| GET | `/api/tts/audio/{id}` | Serve generated audio file |

## How It Connects

```
Browser → Next.js API Routes (/api/voice/*) → Python TTS Service (:8100)
```

The Next.js app proxies voice requests to this service. Both must be running:
- `npm run dev` — Next.js on port 4777
- `npm run start:tts` — TTS service on port 8100

## Environment Variables

Copy `.env.example` and adjust as needed. Key settings:
- `QWEN_TTS_MODEL` — Which model to load (default: 1.7B Base)
- `QWEN_TTS_VENV` — Path to your Qwen3-TTS Python venv
- `TTS_PORT` — Service port (default: 8100)

## Data Directories

Created automatically under `TTS/data/`:
- `reference_audio/` — Uploaded reference audio files
- `voice_profiles/` — Saved .pt voice profile files
- `generated_audio/` — Generated speech output files
