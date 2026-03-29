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
CHAT_DIR="$ROOT_DIR/Chat"
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
    echo "Docker is required for PostgreSQL, Redis, and ChromaDB."
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

echo ""

# Create necessary directories
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
        cat > "$ROOT_DIR/.env" << EOF
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/heard_again

# Authentication
NEXTAUTH_SECRET=change-this-in-production
NEXTAUTH_URL=http://localhost:3002

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
if [ ! -f "$UI_DIR/.env" ]; then
    if [ -f "$UI_DIR/.env.example" ]; then
        echo "  Creating UI .env..."
        cp "$UI_DIR/.env.example" "$UI_DIR/.env"
    else
        echo "  Creating UI .env with defaults..."
        cat > "$UI_DIR/.env" << EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/heard_again
NEXTAUTH_SECRET=change-this-in-production
NEXTAUTH_URL=http://localhost:3002
TTS_SERVICE_URL=http://localhost:8100
CHAT_SYSTEM_URL=http://localhost:3001
REDIS_URL=redis://localhost:6379
EOF
    fi
    echo -e "  ${GREEN}✓ UI .env created${NC}"
else
    echo -e "  ${GREEN}✓ UI .env already exists${NC}"
fi

# Chat .env
if [ ! -f "$CHAT_DIR/.env" ]; then
    if [ -f "$CHAT_DIR/.env.example" ]; then
        echo "  Creating Chat .env..."
        cp "$CHAT_DIR/.env.example" "$CHAT_DIR/.env"
    else
        echo "  Creating Chat .env with defaults..."
        cat > "$CHAT_DIR/.env" << EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/heard_again
REDIS_URL=redis://localhost:6379
CHROMA_URL=http://localhost:8004
OLLAMA_URL=http://localhost:11434
TTS_SERVICE_URL=http://localhost:8100
NODE_ENV=development
PORT=3001
EOF
    fi
    echo -e "  ${GREEN}✓ Chat .env created${NC}"
else
    echo -e "  ${GREEN}✓ Chat .env already exists${NC}"
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

# Install Chat dependencies
echo -e "${YELLOW}Installing Chat dependencies...${NC}"
cd "$CHAT_DIR"
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "  ${GREEN}✓ Chat dependencies installed${NC}"
else
    echo -e "  ${GREEN}✓ Chat dependencies already installed${NC}"
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
echo -e "     - ${YELLOW}$CHAT_DIR/.env${NC}"
echo ""
echo -e "  2. Start the application:"
echo -e "     ${YELLOW}./Scripts/start-dev.sh --live${NC}"
echo ""
echo -e "  Or start services individually:"
echo -e "     ${YELLOW}cd UI && npm run dev${NC}     # Main UI on http://localhost:3002"
echo -e "     ${YELLOW}cd Chat && npm run dev${NC}  # Chat system on http://localhost:3001"
echo ""
echo -e "${BLUE}Documentation:${NC}"
echo -e "  - README.md - Overview and architecture"
echo -e "  - docs/ - Detailed documentation"
echo ""
