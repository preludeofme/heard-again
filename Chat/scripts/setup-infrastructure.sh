#!/bin/bash

# Infrastructure setup script for Phase 1 Chat System
# This script sets up and starts all required services

set -e

echo "🚀 Setting up Phase 1 Chat System Infrastructure..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install docker-compose first."
    exit 1
fi

# Create required directories
echo "📁 Creating required directories..."
mkdir -p data/ollama
mkdir -p data/chromadb
mkdir -p data/redis
mkdir -p logs
mkdir -p uploads

# Set proper permissions
chmod 755 data/ollama data/chromadb data/redis logs uploads

# Check GPU availability for Ollama
if command -v nvidia-smi &> /dev/null; then
    echo "🎮 NVIDIA GPU detected - enabling GPU support for Ollama"
    export GPU_SUPPORT="--gpus all"
else
    echo "⚠️  No GPU detected - Ollama will run in CPU mode"
    export GPU_SUPPORT=""
fi

# Start the infrastructure services
echo "🐳 Starting infrastructure services..."
cd docker

# Start with the database and Redis first
echo "📊 Starting database and Redis..."
docker-compose up -d db redis

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Start ChromaDB
echo "🔍 Starting ChromaDB..."
docker-compose up -d chromadb

# Wait for ChromaDB to be ready
echo "⏳ Waiting for ChromaDB to be ready..."
sleep 5

# Start Ollama
echo "🤖 Starting Ollama..."
docker-compose up -d ollama

# Wait for Ollama to be ready
echo "⏳ Waiting for Ollama to be ready..."
sleep 10

# Pull the required models
echo "📥 Pulling Ollama models..."
docker-compose exec ollama ollama pull llama3.1:8b-instruct
docker-compose exec ollama ollama pull nomic-embed-text:latest

# Start the ingestion worker
echo "⚙️  Starting ingestion worker..."
docker-compose up -d ingestion-worker

# Start the chat application
echo "💬 Starting chat application..."
docker-compose up -d chat-app

echo "✅ Infrastructure setup complete!"
echo ""
echo "🌐 Service URLs:"
echo "   - Chat App:        http://localhost:4777"
echo "   - Ollama API:      http://localhost:11434"
echo "   - ChromaDB:        http://localhost:8000"
echo "   - Database:        localhost:5432"
echo "   - Redis:           localhost:6379"
echo ""
echo "🔧 To check service status:"
echo "   cd docker && docker-compose ps"
echo ""
echo "🛑 To stop all services:"
echo "   cd docker && docker-compose down"
echo ""
echo "📋 To view logs:"
echo "   cd docker && docker-compose logs -f [service-name]"
