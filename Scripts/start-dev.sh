#!/bin/bash

# Heard Again - Full Stack Development Startup Script
# This script starts all required services for development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ports configuration
MAIN_APP_PORT=4777
CHAT_SYSTEM_PORT=4778
TTS_SERVICE_PORT=4779
REDIS_PORT=6379

# Logging mode: "file" (default) or "live" (show in terminal)
# Can be set via: LOG_MODE=live or ./start-dev.sh --live
if [[ "$*" == *"--live"* ]]; then
    LOG_MODE="live"
else
    LOG_MODE="${LOG_MODE:-file}"
fi

# Directories
MAIN_APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UI_DIR="$MAIN_APP_DIR/UI"
CHAT_SYSTEM_DIR="$MAIN_APP_DIR/Chat"
TTS_SERVICE_DIR="$MAIN_APP_DIR/TTS"

# PIDs file for cleanup
PIDS_FILE="/tmp/heard-again-dev.pids"

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Heard Again - Full Stack Development Environment Startup${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down services...${NC}"
    if [ -f "$PIDS_FILE" ]; then
        while read pid; do
            if kill -0 "$pid" 2>/dev/null; then
                echo "  Stopping process $pid..."
                kill -TERM "$pid" 2>/dev/null || true
            fi
        done < "$PIDS_FILE"
        rm -f "$PIDS_FILE"
    fi
    # Stop ChromaDB if running
    if docker ps | grep -q chromadb; then
        echo "  Stopping ChromaDB container..."
        docker stop chromadb >/dev/null 2>&1 || true
    fi
    echo -e "${GREEN}All services stopped.${NC}"
    exit 0
}

# Set trap for cleanup
trap cleanup SIGINT SIGTERM

# Function to check if a port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1
    else
        return 0
    fi
}

# Function to wait for a service
wait_for_service() {
    local name=$1
    local url=$2
    local max_attempts=${3:-30}
    local attempt=1

    echo -n "  Waiting for $name..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            echo -e " ${GREEN}✓ Ready${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done
    echo -e " ${RED}✗ Timeout${NC}"
    return 1
}

# Check dependencies
echo -e "${YELLOW}Checking dependencies...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed${NC}"
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

# Check Python (for TTS)
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}⚠ Python3 is not installed (TTS service won't start)${NC}"
else
    PYTHON_VERSION=$(python3 --version)
    echo -e "  ${GREEN}✓ Python${NC} $PYTHON_VERSION"
fi

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠ PostgreSQL client not found${NC}"
else
    echo -e "  ${GREEN}✓ PostgreSQL${NC}"
fi

# Check Redis
if ! command -v redis-cli &> /dev/null; then
    echo -e "${YELLOW}⚠ Redis not found${NC}"
else
    echo -e "  ${GREEN}✓ Redis${NC}"
fi

echo ""

# Check ports
echo -e "${YELLOW}Checking port availability...${NC}"
PORT_CONFLICTS=0

# Check ChromaDB port
CHROMA_PORT=8004
if ! check_port $CHROMA_PORT; then
    echo -e "  ${GREEN}✓ Port $CHROMA_PORT in use (ChromaDB)${NC}"
else
    echo -e "  ${YELLOW}⚠ Port $CHROMA_PORT available - ChromaDB needs to start${NC}"
fi

if ! check_port $MAIN_APP_PORT; then
    echo -e "  ${RED}✗ Port $MAIN_APP_PORT is already in use (Main App)${NC}"
    PORT_CONFLICTS=$((PORT_CONFLICTS + 1))
else
    echo -e "  ${GREEN}✓ Port $MAIN_APP_PORT available${NC} (Main App)"
fi

if ! check_port $CHAT_SYSTEM_PORT; then
    echo -e "  ${RED}✗ Port $CHAT_SYSTEM_PORT is already in use (Chat System)${NC}"
    PORT_CONFLICTS=$((PORT_CONFLICTS + 1))
else
    echo -e "  ${GREEN}✓ Port $CHAT_SYSTEM_PORT available${NC} (Chat System)"
fi

if ! check_port $TTS_SERVICE_PORT; then
    echo -e "  ${YELLOW}⚠ Port $TTS_SERVICE_PORT is already in use (TTS Service)${NC}"
else
    echo -e "  ${GREEN}✓ Port $TTS_SERVICE_PORT available${NC} (TTS Service)"
fi

if [ $PORT_CONFLICTS -gt 0 ]; then
    echo ""
    echo -e "${RED}Port conflicts detected. Please stop the conflicting services first.${NC}"
    echo "Run: lsof -ti:$CHAT_SYSTEM_PORT,$MAIN_APP_PORT,$TTS_SERVICE_PORT | xargs kill -9"
    exit 1
fi

echo ""

# Setup environment files
echo -e "${YELLOW}Setting up environment files...${NC}"

# Main app .env check
if [ ! -f "$MAIN_APP_DIR/.env" ]; then
    if [ -f "$MAIN_APP_DIR/.env.example" ]; then
        echo "  Creating main app .env from example..."
        cp "$MAIN_APP_DIR/.env.example" "$MAIN_APP_DIR/.env"
    fi
fi

# Chat-system .env check
if [ ! -f "$CHAT_SYSTEM_DIR/.env" ]; then
    if [ -f "$CHAT_SYSTEM_DIR/.env.example" ]; then
        echo "  Creating chat-system .env from example..."
        cp "$CHAT_SYSTEM_DIR/.env.example" "$CHAT_SYSTEM_DIR/.env"
        echo -e "  ${YELLOW}⚠ Please review $CHAT_SYSTEM_DIR/.env and update database credentials${NC}"
    fi
fi
echo -e "  ${GREEN}✓ Environment files ready${NC}"

echo ""

# Database setup for chat-system
echo -e "${YELLOW}Setting up Chat System database...${NC}"
cd "$CHAT_SYSTEM_DIR"

# Create uploads directory
mkdir -p "$CHAT_SYSTEM_DIR/uploads"
echo "  ✓ Created uploads directory"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "  Installing chat-system dependencies..."
    npm install
fi

# Generate Prisma client
echo "  Generating Prisma client..."
npx prisma generate

# Run migrations
echo "  Running database migrations..."
npx prisma migrate deploy 2>/dev/null || {
    echo "  Creating initial migration..."
    npx prisma migrate dev --name init --create-only 2>/dev/null || true
}

cd "$MAIN_APP_DIR"
echo -e "  ${GREEN}✓ Chat System database ready${NC}"

echo ""

# Start infrastructure
echo -e "${YELLOW}Starting infrastructure services...${NC}"
cd "$MAIN_APP_DIR"
docker compose up -d db redis 2>/dev/null || {
    echo -e "  ${YELLOW}⚠ Could not start Docker services - may already be running${NC}"
}
sleep 2
echo -e "  ${GREEN}✓ Infrastructure services ready${NC}"

echo ""

# Start ChromaDB if not running
CHROMA_STARTED=false
if ! check_port 8004; then
    echo -e "  ${GREEN}✓ ChromaDB already running${NC}"
    CHROMA_STARTED=true
else
    echo "  Starting ChromaDB (port 8004)..."
    if command -v docker &> /dev/null; then
        docker run -d --name chromadb -p 8004:8000 -v chroma_data:/chroma/chroma chromadb/chroma:latest 2>/dev/null || docker start chromadb 2>/dev/null || {
            echo -e "    ${YELLOW}⚠ Could not start ChromaDB via Docker${NC}"
            echo -e "    ${BLUE}  Run manually: docker run -p 8004:8000 chromadb/chroma:latest${NC}"
        }
        if docker ps | grep -q chromadb; then
            echo -e "    ${GREEN}✓ ChromaDB started via Docker${NC}"
            CHROMA_STARTED=true
        fi
    else
        echo -e "    ${YELLOW}⚠ Docker not found - ChromaDB cannot start${NC}"
    fi
fi

# Start Ollama if not running
OLLAMA_STARTED=false
if command -v ollama &> /dev/null; then
    if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Ollama already running${NC}"
        OLLAMA_STARTED=true
    else
        echo "  Starting Ollama (port 11434)..."
        ollama serve > /tmp/ollama.log 2>&1 &
        OLLAMA_PID=$!
        sleep 3
        if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
            echo -e "    ${GREEN}✓ Ollama started (PID: $OLLAMA_PID)${NC}"
            OLLAMA_STARTED=true
        else
            echo -e "    ${YELLOW}⚠ Ollama may still be starting${NC}"
        fi
    fi
else
    echo -e "  ${YELLOW}⚠ Ollama not found - LLM features unavailable${NC}"
fi

echo ""

# Start services
echo -e "${YELLOW}Starting services...${NC}"

# Clear old PIDs
rm -f "$PIDS_FILE"
touch "$PIDS_FILE"

# Start Chat System
echo "  Starting Chat System (port $CHAT_SYSTEM_PORT)..."
cd "$CHAT_SYSTEM_DIR"
if [ "$LOG_MODE" = "live" ]; then
    npm run dev 2>&1 | tee "$MAIN_APP_DIR/logs/chat-system.log" &
else
    npm run dev > "$MAIN_APP_DIR/logs/chat-system.log" 2>&1 &
fi
CHAT_PID=$!
echo $CHAT_PID >> "$PIDS_FILE"
cd "$MAIN_APP_DIR"
echo -e "    ${GREEN}✓ Chat System started (PID: $CHAT_PID)${NC}"
if [ "$LOG_MODE" != "live" ]; then
    echo -e "    ${BLUE}  Logs: $MAIN_APP_DIR/logs/chat-system.log${NC}"
fi

# Wait for chat system to be ready
sleep 3

# Start Main App
echo "  Starting Main App (port $MAIN_APP_PORT)..."
cd "$UI_DIR"
if [ "$LOG_MODE" = "live" ]; then
    npm run dev 2>&1 | tee "$MAIN_APP_DIR/logs/main-app.log" &
else
    npm run dev > "$MAIN_APP_DIR/logs/main-app.log" 2>&1 &
fi
MAIN_PID=$!
echo $MAIN_PID >> "$PIDS_FILE"
cd "$MAIN_APP_DIR"
echo -e "    ${GREEN}✓ Main App started (PID: $MAIN_PID)${NC}"
if [ "$LOG_MODE" != "live" ]; then
    echo -e "    ${BLUE}  Logs: $MAIN_APP_DIR/logs/main-app.log${NC}"
fi

# Start TTS Service (if Python is available)
if command -v python3 &> /dev/null && [ -d "$TTS_SERVICE_DIR" ]; then
    echo "  Starting TTS Service (port $TTS_SERVICE_PORT)..."

    # Load TTS service .env to get QWEN_TTS_VENV path
    if [ -f "$TTS_SERVICE_DIR/.env" ]; then
        export $(grep -v '^#' "$TTS_SERVICE_DIR/.env" | xargs)
    fi

    # Use Qwen3-TTS venv if specified, otherwise fall back to local venv
    VENV_PATH="${QWEN_TTS_VENV:-$TTS_SERVICE_DIR/venv}"

    if [ -d "$VENV_PATH" ]; then
        cd "$TTS_SERVICE_DIR"
        source "$VENV_PATH/bin/activate"
        if [ "$LOG_MODE" = "live" ]; then
            python -m app.main 2>&1 | tee "$MAIN_APP_DIR/logs/tts-service.log" &
        else
            python -m app.main > "$MAIN_APP_DIR/logs/tts-service.log" 2>&1 &
        fi
        TTS_PID=$!
        cd "$MAIN_APP_DIR"
        echo $TTS_PID >> "$PIDS_FILE"
        echo -e "    ${GREEN}✓ TTS Service started (PID: $TTS_PID)${NC}"
        echo -e "    ${BLUE}  Using venv: $VENV_PATH${NC}"
        if [ "$LOG_MODE" != "live" ]; then
            echo -e "    ${BLUE}  Logs: $MAIN_APP_DIR/logs/tts-service.log${NC}"
        fi
        TTS_STARTED=true
    else
        echo -e "    ${YELLOW}⚠ TTS Service virtual environment not found at $VENV_PATH${NC}"
        echo -e "    ${BLUE}  Set QWEN_TTS_VENV in $TTS_SERVICE_DIR/.env to your Qwen3-TTS venv path${NC}"
        TTS_STARTED=false
    fi
else
    echo -e "    ${YELLOW}⚠ TTS Service skipped (Python not available)${NC}"
    TTS_STARTED=false
fi

echo ""

# Health checks
echo -e "${YELLOW}Running health checks...${NC}"
sleep 2

# Check ChromaDB
if [ "$CHROMA_STARTED" = true ]; then
    if curl -s http://localhost:8004/api/v2/heartbeat >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓ ChromaDB is healthy${NC}"
    else
        echo -e "  ${YELLOW}⚠ ChromaDB may still be starting${NC}"
    fi
fi

# Check Chat System
if curl -s http://localhost:$CHAT_SYSTEM_PORT/api/health >/dev/null 2>&1 || curl -s http://localhost:$CHAT_SYSTEM_PORT >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Chat System is responding${NC}"
else
    echo -e "  ${YELLOW}⚠ Chat System may still be starting (check logs)${NC}"
fi

# Check Main App
if wait_for_service "Main App" "http://localhost:$MAIN_APP_PORT/api/instance/health" 15; then
    echo -e "  ${GREEN}✓ Main App is healthy${NC}"
else
    echo -e "  ${YELLOW}⚠ Main App may still be starting (check logs)${NC}"
fi

# Check TTS Service
if [ "$TTS_STARTED" = true ]; then
    if wait_for_service "TTS Service" "http://localhost:$TTS_SERVICE_PORT/api/tts/health" 30; then
        echo -e "  ${GREEN}✓ TTS Service is healthy${NC}"
    else
        echo -e "  ${YELLOW}⚠ TTS Service may still be loading models (check logs)${NC}"
    fi
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  All services started successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BLUE}Main App:${NC}      http://localhost:$MAIN_APP_PORT"
echo -e "  ${BLUE}Chat System:${NC}   http://localhost:$CHAT_SYSTEM_PORT"
if [ "$CHROMA_STARTED" = true ]; then
    echo -e "  ${BLUE}ChromaDB:${NC}      http://localhost:8004"
fi
if [ "$OLLAMA_STARTED" = true ]; then
    echo -e "  ${BLUE}Ollama:${NC}        http://localhost:11434"
fi
if [ "$TTS_STARTED" = true ]; then
    echo -e "  ${BLUE}TTS Service:${NC}   http://localhost:$TTS_SERVICE_PORT"
fi
echo ""
if [ "$LOG_MODE" = "live" ]; then
    echo -e "  ${YELLOW}Live logging enabled - all service output shown above${NC}"
else
    echo -e "  ${YELLOW}Log mode: file${NC} (run with LOG_MODE=live for live output)"
    echo -e "  ${BLUE}Tail all logs:${NC} ./scripts/logs.sh"
fi
echo -e "  ${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for all processes
wait
