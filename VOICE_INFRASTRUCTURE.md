# Voice Infrastructure Setup

This document explains how to set up the GPT-SoVITS voice cloning infrastructure.

## Prerequisites

1. **Docker & Docker Compose** installed
2. **NVIDIA GPU** with CUDA 12.6/12.8 support
3. **NVIDIA Container Toolkit** for GPU access

## Quick Start

1. **Start the voice infrastructure:**
   ```bash
   npm run start:voice
   ```

2. **Start the main application:**
   ```bash
   npm start
   ```

## Services

The voice infrastructure includes:

- **GPT-SoVITS API** (port 9874) - Core voice cloning and synthesis
- **GPT-SoVITS Web UI** (port 9873) - Web interface for GPT-SoVITS
- **Redis** (port 6379) - Caching and job queue
- **PostgreSQL** (port 5432) - Metadata storage

## Manual Setup

If the automated script doesn't work, you can set up manually:

1. **Build/Pull GPT-SoVITS Image:**
   ```bash
   # Option 1: Pull pre-built image (if available)
   docker pull gpt-sovits:latest
   
   # Option 2: Build from source
   git clone https://github.com/RVC-Boss/GPT-SoVITS.git
   cd GPT-SoVITS
   docker build -t gpt-sovits:latest .
   ```

2. **Start Services:**
   ```bash
   docker compose -f docker-compose.voice.yml up -d
   ```

## Configuration

### GPU Support
Ensure you have the NVIDIA Container Toolkit installed:
```bash
# Ubuntu/Debian
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update && sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker
```

### Environment Variables
Edit `docker-compose.voice.yml` to adjust:
- `CUDA_VISIBLE_DEVICES` - Which GPU to use
- `SHARE_MEMORY` - Shared memory size (recommended 16GB+)

## Troubleshooting

### GPU Not Detected
```bash
# Check NVIDIA Docker support
docker run --rm --gpus all nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi
```

### Service Logs
```bash
# View all logs
docker-compose -f docker-compose.voice.yml logs -f

# View specific service logs
docker-compose -f docker-compose.voice.yml logs -f gpt-sovits
```

### Reset Services
```bash
# Stop and remove all containers
docker-compose -f docker-compose.voice.yml down -v

# Restart
npm run start:voice
```

## Integration with Application

Once the voice infrastructure is running:

1. The training API will connect to the real GPT-SoVITS service
2. Voice models will be stored in `./models`
3. Training jobs will be processed by the actual AI service
4. Synthesis requests will generate real voice audio

## API Endpoints

- `POST http://localhost:9874/train` - Start voice training
- `GET http://localhost:9874/check_status/{job_id}` - Check training status
- `POST http://localhost:9874/synthesis` - Synthesize speech

## Notes

- The current implementation simulates training until GPT-SoVITS is fully integrated
- Model files can be large (several GB each)
- Training requires significant GPU resources
- Consider using cloud GPU services if local GPU is insufficient
