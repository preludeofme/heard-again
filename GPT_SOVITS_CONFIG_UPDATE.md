# GPT-SoVITS Configuration Update

## Changes Made ✅

### 1. Docker Compose Configuration (`docker-compose.voice.yml`)
- **Port Changed**: `9874:9874` → `9888:9874` (external:internal)
- **Added Environment Variables**:
  - `GRADIO_SERVER_NAME=0.0.0.0` (bind to all interfaces)
  - `GRADIO_SERVER_PORT=9874` (internal port)

### 2. Code Updates (`src/lib/gpt-sovits-adapter.ts`)
- **Base URL Updated**: `http://localhost:9874` → `http://localhost:9888`
- **Synthesis URL Updated**: Port mapping logic updated for new configuration

### 3. Startup Script (`scripts/start-voice-infrastructure.sh`)
- **Service URL Updated**: Shows new port `9888` and `0.0.0.0` binding

## New Access Points 🚀

### Gradio Web Interface
- **Local Access**: `http://localhost:9888`
- **Network Access**: `http://0.0.0.0:9888`
- **Alternative UI**: `http://localhost:9873` (unchanged)

### TTS API
- **Synthesis Endpoint**: `http://localhost:9880` (unchanged)

### Other Services
- **Redis**: `localhost:6379`
- **PostgreSQL**: `localhost:5433`

## What This Enables 🎯

1. **External Access**: You can now access Gradio from other devices on your network using `http://0.0.0.0:9888`
2. **Dedicated Port**: Port 9888 avoids conflicts with other services
3. **Direct Training**: You can work directly with the GPT-SoVITS interface without going through the Next.js UI

## How to Use 📋

1. **Access Gradio**: Open `http://localhost:9888` in your browser
2. **Upload Audio**: Use the Gradio interface to upload audio files directly
3. **Train Models**: Run individual training steps (slicing, ASR, formatting, training)
4. **Monitor Progress**: See real-time training progress and file outputs
5. **Test Synthesis**: Use the TTS interface to test trained models

## Restart Commands 🔄

```bash
# Stop voice services
npm run stop:voice

# Start voice services (with new config)
npm run start:voice

# Check status
docker compose -f docker-compose.voice.yml ps
```

## Benefits ✨

- ✅ **Network Accessible**: Can access from any device on your network
- ✅ **Direct Training**: Work directly with GPT-SoVITS without API limitations
- ✅ **Better Debugging**: See actual file paths and training outputs
- ✅ **Port Isolation**: No conflicts with other development services
- ✅ **Full Control**: Complete access to all GPT-SoVITS features

The GPT-SoVITS Gradio interface is now ready for direct training work!
