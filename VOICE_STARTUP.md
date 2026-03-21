# Voice Server Startup Guide

## Quick Commands

### 1. Start Mock GPT-SoVITS (for testing)
```bash
npm run start:voice
```
This starts the mock voice server that simulates training.

### 2. Start Real GPT-SoVITS (for actual voice cloning)
```bash
npm run start:voice:real
```
This starts the actual GPT-SoVITS with GPU acceleration.

### 3. Stop Servers
```bash
# Stop real GPT-SoVITS
npm run stop:voice

# Stop mock GPT-SoVITS
npm run stop:voice:mock
```

## Current Status

The real GPT-SoVITS is already running! You can verify:
```bash
docker compose -f docker-compose.voice.yml ps
```

You should see:
- `gpt-sovits-api` running on ports 9873-9874
- `voice-redis` running on port 6379

## Access Points

### Real GPT-SoVITS (Currently Running)
- **Web UI**: http://localhost:9873
- **API**: http://localhost:9874
- **Status**: http://localhost:9874/queue/status

### Your Main Application
- **App**: http://localhost:3002
- **API**: http://localhost:3002/api/*

## What's Happening Under the Hood

1. **Real GPT-SoVITS** is running in Docker with GPU support
2. **Your app** automatically detects if GPT-SoVITS is available
3. **Training requests** will use the real service if available

## To Restart Everything

```bash
# Stop current services
npm run stop:voice

# Start again
npm run start:voice
```

## Verification

Check if everything is working:
```bash
# Check GPT-SoVITS
curl http://localhost:9874/queue/status

# Check your app
curl http://localhost:3002/api/voice/models
```

## Note

- The real GPT-SoVITS takes time to fully start up (1-2 minutes)
- It requires significant GPU resources
- Training is much slower than the mock but produces real voice models
