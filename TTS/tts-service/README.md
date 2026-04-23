# Qwen3-TTS Service for Heard Again

Local FastAPI service that wraps **Qwen3-TTS** for voice cloning and text-to-speech, used by the Heard Again Next.js frontend.

## Prerequisites

Complete the [Qwen3-TTS Setup Guide](../docs/QWEN3_TTS_SETUP_GUIDE.md) first — you need:
- NVIDIA GPU with CUDA drivers
- Python venv at `~/qwen3-tts/venv` with PyTorch + Qwen3-TTS installed
- The Qwen3-TTS model downloaded via HuggingFace

## Quick Start

```bash
# From project root
npm run start:tts

# Or directly
cd tts-service && ./start.sh
```

The service starts on **http://localhost:8100**.

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

Created automatically under `tts-service/data/`:
- `reference_audio/` — Uploaded reference audio files
- `voice_profiles/` — Saved .pt voice profile files
- `generated_audio/` — Generated speech output files
