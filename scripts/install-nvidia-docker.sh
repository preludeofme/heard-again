#!/bin/bash

echo "🚀 Installing NVIDIA Container Toolkit for GPU support in Docker..."
echo ""

# Check if running on Ubuntu/Debian
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
else
    echo "❌ Cannot detect OS. This script is for Ubuntu/Debian systems."
    exit 1
fi

echo "📋 Detected OS: $OS $VER"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first:"
    echo "   curl -fsSL https://get.docker.com -o get-docker.sh"
    echo "   sudo sh get-docker.sh"
    exit 1
fi

echo "✅ Docker is installed"
echo ""

# Install NVIDIA Container Toolkit
echo "📦 Installing NVIDIA Container Toolkit..."

# Add the package repositories
distribution=$(. /etc/os-release;echo $ID$VERSION_ID) \
   && curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add - \
   && curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

echo "📥 Added NVIDIA repositories"
echo ""

# Update package list
echo "🔄 Updating package list..."
sudo apt-get update

# Install nvidia-docker2
echo "📥 Installing nvidia-docker2..."
sudo apt-get install -y nvidia-docker2

# Restart Docker daemon
echo "🔄 Restarting Docker daemon..."
sudo systemctl restart docker

# Verify installation
echo ""
echo "🔍 Verifying installation..."
if docker run --rm --gpus all nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi &> /dev/null; then
    echo "✅ NVIDIA Container Toolkit installed successfully!"
    echo ""
    echo "🎯 Test command to verify GPU access:"
    echo "   docker run --rm --gpus all nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi"
    echo ""
    echo "🚀 You can now run: npm run start:voice"
else
    echo "⚠️ Installation may have failed. Please check:"
    echo "   1. NVIDIA drivers are installed (run 'nvidia-smi')"
    echo "   2. Docker is running"
    echo "   3. System was rebooted if needed"
fi
