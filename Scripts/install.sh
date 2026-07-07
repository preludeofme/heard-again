#!/bin/bash

# Heard Again - Installation Script
# Sets up all dependencies, environment files, and initial configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
UI_DIR="$ROOT_DIR/UI"
TTS_DIR="$ROOT_DIR/TTS"

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Heard Again - Installation${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Check dependencies
echo -e "${YELLOW}Checking dependencies...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "  ${GREEN}✓ Node.js${NC} $NODE_VERSION"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm is not installed${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓ npm${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠ Docker is not installed${NC}"
    echo "Docker is required for PostgreSQL and Redis."
    echo "Install from https://docs.docker.com/get-docker/"
else
    echo -e "  ${GREEN}✓ Docker${NC}"
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${YELLOW}⚠ Docker Compose is not installed${NC}"
else
    echo -e "  ${GREEN}✓ Docker Compose${NC}"
fi

# Check Python (for TTS)
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}⚠ Python 3 is not installed${NC}"
    echo "    Python is required for the TTS service."
else
    PYTHON_VERSION=$(python3 --version 2>&1)
    echo -e "  ${GREEN}✓ Python${NC} $PYTHON_VERSION"
fi

# Check for pip
if ! command -v pip3 &> /dev/null; then
    echo -e "${YELLOW}⚠ pip3 is not installed${NC}"
    echo "    pip is required for TTS dependencies."
else
    echo -e "  ${GREEN}✓ pip${NC}"
fi

# Check sox (required for TTS audio processing)
if ! command -v sox &> /dev/null; then
    echo -e "${YELLOW}⚠ sox not found (TTS audio preprocessing may fail)${NC}"
    echo -e "    ${BLUE}Attempting to install sox...${NC}"
    if command -v apt &> /dev/null; then
        sudo apt update >/dev/null 2>&1 && sudo apt install -y sox libsox-fmt-all >/dev/null 2>&1 && echo -e "  ${GREEN}✓ sox installed${NC}" || echo -e "  ${YELLOW}⚠ Failed to install sox (may need manual: sudo apt install sox libsox-fmt-all)${NC}"
    else
        echo -e "    ${YELLOW}⚠ Automatic install not available - please install manually${NC}"
    fi
else
    SOX_VERSION=$(sox --version 2>&1 | head -1)
    echo -e "  ${GREEN}✓ sox${NC} $SOX_VERSION"
fi

# Check for nvcc (CUDA compiler) - needed for flash-attn
if ! command -v nvcc &> /dev/null; then
    echo -e "${YELLOW}⚠ CUDA toolkit (nvcc) not found${NC}"
    echo -e "    ${BLUE}Attempting to install nvidia-cuda-toolkit...${NC}"
    if command -v apt &> /dev/null; then
        sudo apt update >/dev/null 2>&1 && sudo apt install -y nvidia-cuda-toolkit >/dev/null 2>&1 && echo -e "  ${GREEN}✓ CUDA toolkit installed${NC}" || echo -e "  ${YELLOW}⚠ Failed to install CUDA toolkit (may need manual: sudo apt install nvidia-cuda-toolkit)${NC}"
    else
        echo -e "    ${YELLOW}⚠ Automatic install not available - please install manually${NC}"
    fi
else
    NVCC_VERSION=$(nvcc --version 2>&1 | grep "release" | head -1)
    echo -e "  ${GREEN}✓ CUDA toolkit${NC} $NVCC_VERSION"
fi

echo ""
echo -e "${YELLOW}Creating directories...${NC}"
mkdir -p "$ROOT_DIR/logs"
mkdir -p "$ROOT_DIR/uploads"
mkdir -p "$TTS_DIR/generated"
echo -e "  ${GREEN}✓ Directories created${NC}"

echo ""

# Setup environment files
echo -e "${YELLOW}Setting up environment files...${NC}"

# Root .env
if [ ! -f "$ROOT_DIR/.env" ]; then
    if [ -f "$ROOT_DIR/.env.example" ]; then
        echo "  Creating root .env..."
        cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    else
        echo "  Creating root .env with defaults..."
        NEXTAUTH_SECRET_GEN=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p | tr -d '\n' | head -c 64)
        cat > "$ROOT_DIR/.env" << EOF
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/heard_again

# Authentication
NEXTAUTH_SECRET=$NEXTAUTH_SECRET_GEN
NEXTAUTH_URL=http://localhost:4777

# Services
TTS_SERVICE_URL=http://localhost:8100
CHAT_SYSTEM_URL=http://localhost:3001
REDIS_URL=redis://localhost:6379

# Optional: External APIs
# OPENAI_API_KEY=your-key
# AWS_ACCESS_KEY_ID=your-key
# AWS_SECRET_ACCESS_KEY=your-secret
EOF
    fi
    echo -e "  ${GREEN}✓ Root .env created${NC}"
else
    echo -e "  ${GREEN}✓ Root .env already exists${NC}"
fi

# UI .env
UI_ENV_CREATED=false
if [ ! -f "$UI_DIR/.env" ]; then
    if [ -f "$UI_DIR/.env.example" ]; then
        echo "  Creating UI .env..."
        cp "$UI_DIR/.env.example" "$UI_DIR/.env"
    else
        echo "  Creating UI .env with defaults..."
        NEXTAUTH_SECRET_GEN=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p | tr -d '\n' | head -c 64)
        cat > "$UI_DIR/.env" << EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/heard_again
NEXTAUTH_SECRET=$NEXTAUTH_SECRET_GEN
NEXTAUTH_URL=http://localhost:4777
TTS_SERVICE_URL=http://localhost:8100
CHAT_SYSTEM_URL=http://localhost:3001
REDIS_URL=redis://localhost:6379
EOF
    fi
    UI_ENV_CREATED=true
    echo -e "  ${GREEN}✓ UI .env created${NC}"
else
    echo -e "  ${GREEN}✓ UI .env already exists${NC}"
fi

# TTS .env (if it exists or has example)
if [ -f "$TTS_DIR/.env.example" ] && [ ! -f "$TTS_DIR/.env" ]; then
    echo "  Creating TTS .env..."
    cp "$TTS_DIR/.env.example" "$TTS_DIR/.env"
    echo -e "  ${GREEN}✓ TTS .env created${NC}"
fi

echo ""
echo -e "${YELLOW}Note:${NC} Please review the .env files and update any credentials as needed."
echo ""

# Install root dependencies
echo -e "${YELLOW}Installing root dependencies...${NC}"
cd "$ROOT_DIR"
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "  ${GREEN}✓ Root dependencies installed${NC}"
else
    echo -e "  ${GREEN}✓ Root dependencies already installed${NC}"
fi

# Install UI dependencies
echo -e "${YELLOW}Installing UI dependencies...${NC}"
cd "$UI_DIR"
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "  ${GREEN}✓ UI dependencies installed${NC}"
else
    echo -e "  ${GREEN}✓ UI dependencies already installed${NC}"
fi

echo ""

# Setup TTS virtual environment and install flash-attn
if command -v python3 &> /dev/null; then
    echo -e "${YELLOW}Setting up TTS virtual environment...${NC}"

    # Determine venv path - check if QWEN_TTS_VENV is set in environment or TTS .env
    TTS_VENV="$HOME/qwen3-tts/venv"
    if [ -f "$TTS_DIR/tts-service/.env" ]; then
        _PARSED=$(grep '^QWEN_TTS_VENV=' "$TTS_DIR/tts-service/.env" | cut -d'=' -f2- | tr -d '"')
        [ -n "$_PARSED" ] && TTS_VENV="$_PARSED"
    fi

    # Create venv if it doesn't exist
    if [ ! -d "$TTS_VENV" ]; then
        echo "  Creating TTS virtual environment at $TTS_VENV..."
        python3 -m venv "$TTS_VENV"
        echo -e "  ${GREEN}✓ Virtual environment created${NC}"
    else
        echo -e "  ${GREEN}✓ Virtual environment already exists${NC}"
    fi

    # Install flash-attn if not present
    echo "  Checking for flash-attn..."
    PYTHON_BIN="$TTS_VENV/bin/python"
    if $PYTHON_BIN -c "import flash_attn" 2>/dev/null; then
        echo -e "  ${GREEN}✓ flash-attn already installed${NC}"
    else
        echo -e "  ${YELLOW}⚠ flash-attn not found, installing... (this may take a few minutes)${NC}"
        # Set CUDA_HOME correctly (nvcc is typically in /usr/bin on Ubuntu)
        export CUDA_HOME=/usr
        "$TTS_VENV/bin/pip" install flash-attn --no-build-isolation 2>&1 | tail -5
        if $PYTHON_BIN -c "import flash_attn" 2>/dev/null; then
            echo -e "  ${GREEN}✓ flash-attn installed successfully${NC}"
        else
            echo -e "  ${YELLOW}⚠ flash-attn installation failed (TTS will work but be slower)${NC}"
            echo -e "    Manual install: export CUDA_HOME=/usr && pip install flash-attn --no-build-isolation"
        fi
    fi
else
    echo -e "${YELLOW}⚠ Skipping TTS setup (Python not available)${NC}"
fi

echo ""

# Start infrastructure services
echo -e "${YELLOW}Starting infrastructure services (PostgreSQL, Redis)...${NC}"
cd "$ROOT_DIR"
if command -v docker &> /dev/null; then
    docker compose up -d db redis
    echo -e "  ${GREEN}✓ PostgreSQL and Redis started${NC}"
else
    echo -e "  ${YELLOW}⚠ Docker not available - skipping infrastructure start${NC}"
    echo "    Please start PostgreSQL and Redis manually."
fi

echo ""

# Setup database
echo -e "${YELLOW}Setting up database...${NC}"
cd "$UI_DIR"
npx prisma generate
if command -v docker &> /dev/null; then
    # Wait a moment for postgres to be ready
    sleep 3
    npx prisma migrate dev --name init --create-only 2>/dev/null || true
    npx prisma migrate deploy 2>/dev/null || {
        echo -e "  ${YELLOW}⚠ Migration deploy failed - may need manual intervention${NC}"
    }
    echo -e "  ${GREEN}✓ Database migrations applied${NC}"
else
    echo -e "  ${YELLOW}⚠ Skipping database setup (Docker not available)${NC}"
fi

echo ""

# Build UI
echo -e "${YELLOW}Building UI application...${NC}"
cd "$UI_DIR"
npm run build
echo -e "  ${GREEN}✓ UI built successfully${NC}"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Installation complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo ""
echo -e "  1. Review and update environment files if needed:"
echo -e "     - ${YELLOW}$ROOT_DIR/.env${NC}"
echo -e "     - ${YELLOW}$UI_DIR/.env${NC}"
echo ""
echo -e "  2. Start the application:"
echo -e "     ${YELLOW}./Scripts/start-dev.sh --live${NC}"
echo ""
echo -e "  Or start the UI directly:"
echo -e "     ${YELLOW}cd UI && npm run dev${NC}     # Main UI on http://localhost:4777"
echo ""
echo -e "${BLUE}Documentation:${NC}"
echo -e "  - README.md - Overview and architecture"
echo -e "  - docs/ - Detailed documentation"
echo ""
