#!/bin/bash

echo "🎙️ Starting Voice Infrastructure for Heard Again..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if NVIDIA Docker runtime is available
if ! docker run --rm --gpus all nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi > /dev/null 2>&1; then
    echo "⚠️ NVIDIA Docker runtime not detected. GPU acceleration may not be available."
    echo "   Please install NVIDIA Container Toolkit for GPU support."
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p models logs uploads

# Start the voice services
echo "🚀 Starting voice services with Docker Compose..."
docker compose -f docker-compose.voice.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check if services are running
echo "🔍 Checking service status..."
docker compose -f docker-compose.voice.yml ps

# Display service URLs
echo ""
echo "✅ Voice Infrastructure Started!"
echo "📍 Service URLs:"
echo "   - GPT-SoVITS API: http://localhost:9874"
echo "   - GPT-SoVITS Web UI: http://localhost:9873"
echo "   - Redis: localhost:6379"
echo "   - PostgreSQL: localhost:5432"
echo ""
echo "📝 To view logs: docker compose -f docker-compose.voice.yml logs -f"
echo "🛑 To stop: docker compose -f docker-compose.voice.yml down"
echo ""
echo "📌 Note: Using real GPT-SoVITS service."
