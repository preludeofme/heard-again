#!/bin/bash

# Heard Again - Full Stack Development Startup Script
# This script starts all required services for development

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ports configuration (only these ports will be killed by stop_app_processes)
MAIN_APP_PORT=4777
TTS_SERVICE_PORT=4779
REDIS_PORT=6379
# Note: Port 8101 is also managed for cleanup (legacy TTS port)

# Logging mode: "file" (default) or "live" (show in terminal)
# Can be set via: LOG_MODE=live or ./start-dev.sh --live
if [[ "$*" == *"--live"* ]]; then
    LOG_MODE="live"
else
    LOG_MODE="${LOG_MODE:-file}"
fi

# Directories
MAIN_APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UI_DIR="${UI_DIR_OVERRIDE:-$MAIN_APP_DIR/UI}"
TTS_SERVICE_DIR="$MAIN_APP_DIR/TTS/tts-service"

# Ensure logs directory exists
mkdir -p "$MAIN_APP_DIR/logs"

# PIDs file for cleanup
PIDS_FILE="/tmp/heard-again-dev.pids"

# ---------------------------------------------------------------------------
# Functions (all defined before first use)
# ---------------------------------------------------------------------------

# Cleanup function (called on Ctrl-C / SIGTERM)
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
    # Stop Redis dev container if it was started by this script
    if docker ps --format '{{.Names}}' | grep -q '^redis-dev$'; then
        echo "  Stopping Redis container..."
        docker stop redis-dev >/dev/null 2>&1 || true
    fi
    # Stop Exporter dev container
    if docker ps --format '{{.Names}}' | grep -q '^exporter-dev$'; then
        echo "  Stopping Exporter container..."
        docker stop exporter-dev >/dev/null 2>&1 || true
    fi
    # Stop Trigger.dev stack if this script started it
    if [ "${TRIGGER_STACK_STARTED:-false}" = "true" ]; then
        echo "  Stopping Trigger.dev stack..."
        docker compose -f "$MAIN_APP_DIR/docker-compose.trigger.yml" down >/dev/null 2>&1 || true
    fi
    echo -e "${GREEN}All services stopped.${NC}"
    exit 0
}

# Function to check if a port is available (returns 0=available, 1=in use)
check_port() {
    local port=$1
    if fuser "${port}/tcp" >/dev/null 2>&1; then
        return 1
    else
        return 0
    fi
}

# Stop only this application's processes (never touches postgres, redis, chromadb, ollama)
stop_app_processes() {
    local APP_PORTS=($MAIN_APP_PORT $TTS_SERVICE_PORT 8101)
    local STOPPED=0

    # Step 1: SIGTERM any PIDs we previously tracked (and their process groups)
    if [ -f "$PIDS_FILE" ]; then
        while read pid; do
            if kill -0 "$pid" 2>/dev/null; then
                # Kill the whole process group so child processes (e.g. node spawned by npm) also die
                kill -TERM -"$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
                STOPPED=$((STOPPED + 1))
            fi
        done < "$PIDS_FILE"
        rm -f "$PIDS_FILE"
    fi

    # Step 2: Kill anything currently listening on app-only ports (catches leftover children)
    for port in "${APP_PORTS[@]}"; do
        if fuser "${port}/tcp" >/dev/null 2>&1; then
            echo -e "  Stopping process on port $port..."
            fuser -k "${port}/tcp" 2>/dev/null || true
            STOPPED=$((STOPPED + 1))
        fi
    done

    # Step 3: Wait up to 5 s for all app ports to clear
    if [ $STOPPED -gt 0 ]; then
        local waited=0
        while [ $waited -lt 5 ]; do
            local still_busy=0
            for port in "${APP_PORTS[@]}"; do
                fuser "${port}/tcp" >/dev/null 2>&1 && still_busy=1
            done
            [ $still_busy -eq 0 ] && break
            sleep 1
            waited=$((waited + 1))
        done

        # Final hard-kill pass if anything is still holding a port
        for port in "${APP_PORTS[@]}"; do
            if fuser "${port}/tcp" >/dev/null 2>&1; then
                echo -e "  Force-stopping port $port..."
                fuser -k "${port}/tcp" 2>/dev/null || true
            fi
        done

        echo -e "  ${GREEN}✓ Previous app processes stopped${NC}"
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
        if curl -sk "$url" >/dev/null 2>&1; then
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

# Set trap for cleanup on Ctrl-C / SIGTERM
trap cleanup SIGINT SIGTERM

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Heard Again - Full Stack Development Environment Startup${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Stop any existing app processes so this script doubles as a restart
echo -e "${YELLOW}Stopping existing app processes...${NC}"
stop_app_processes
echo ""

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

# Check sox (required for TTS audio preprocessing)
if ! command -v sox &> /dev/null; then
    echo -e "  ${YELLOW}⚠ sox not found (TTS audio preprocessing may fail)${NC}"
    echo -e "    ${BLUE}Install: sudo apt install sox libsox-fmt-all${NC}"
    if command -v apt &> /dev/null; then
        echo -e "    ${BLUE}Attempting to install sox automatically...${NC}"
        if sudo apt update >/dev/null 2>&1 && sudo apt install -y sox libsox-fmt-all >/dev/null 2>&1; then
            echo -e "    ${GREEN}✓ sox installed successfully${NC}"
        else
            echo -e "    ${YELLOW}⚠ Failed to auto-install sox (may need manual install)${NC}"
        fi
    fi
else
    SOX_VERSION=$(sox --version 2>&1 | head -1)
    echo -e "  ${GREEN}✓ sox${NC} $SOX_VERSION"
fi

# Check flash-attn for TTS performance
if command -v python3 &> /dev/null && [ -d "$TTS_SERVICE_DIR" ]; then
    # Get the venv path from .env if available
    TTS_VENV="$HOME/qwen3-tts/venv"
    if [ -f "$TTS_SERVICE_DIR/.env" ]; then
        _PARSED=$(grep '^QWEN_TTS_VENV=' "$TTS_SERVICE_DIR/.env" | cut -d'=' -f2- | tr -d '"')
        [ -n "$_PARSED" ] && TTS_VENV="$_PARSED"
    fi
    
    if [ -d "$TTS_VENV" ]; then
        PYTHON_BIN="$TTS_VENV/bin/python"
        if $PYTHON_BIN -c "import flash_attn" 2>/dev/null; then
            echo -e "  ${GREEN}✓ flash-attn${NC} (TTS will use optimized attention)"
        else
            echo -e "  ${YELLOW}⚠ flash-attn not installed${NC} (TTS will be slower)"
            echo -e "    ${BLUE}It will be auto-installed when TTS starts (may take a few minutes)${NC}"
        fi
    fi
fi

echo ""

# Check ports
echo -e "${YELLOW}Checking port availability...${NC}"
PORT_CONFLICTS=0

if ! check_port $MAIN_APP_PORT; then
    echo -e "  ${RED}✗ Port $MAIN_APP_PORT is already in use (Main App)${NC}"
    PORT_CONFLICTS=$((PORT_CONFLICTS + 1))
else
    echo -e "  ${GREEN}✓ Port $MAIN_APP_PORT available${NC} (Main App)"
fi

if ! check_port $TTS_SERVICE_PORT; then
    echo -e "  ${YELLOW}TTS Service port $TTS_SERVICE_PORT is already in use (TTS Service)${NC}"
else
    echo -e "  ${GREEN}TTS Service port $TTS_SERVICE_PORT available${NC} (TTS Service)"
fi

# Check legacy TTS port 8101 (in case there are leftover processes)
if ! check_port 8101; then
    echo -e "  ${YELLOW}Legacy TTS port 8101 is already in use - will be cleaned${NC}"
else
    echo -e "  ${GREEN}Legacy TTS port 8101 is available${NC}"
fi

if [ $PORT_CONFLICTS -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}⚠ Some app ports still occupied after stop attempt — proceeding anyway${NC}"
fi

echo ""

# Setup environment files
echo -e "${YELLOW}Setting up environment files...${NC}"

# 1. Main root .env check
if [ ! -f "$MAIN_APP_DIR/.env" ]; then
    if [ -f "$MAIN_APP_DIR/.env.example" ]; then
        echo "  Creating main root .env from example..."
        cp "$MAIN_APP_DIR/.env.example" "$MAIN_APP_DIR/.env"
    fi
fi

# 2. Sync UI/.env from root .env if root exists (Next.js needs it in UI/ dir)
if [ -f "$MAIN_APP_DIR/.env" ] && [ ! -f "$UI_DIR/.env" ]; then
    echo "  Creating UI .env from root .env..."
    cp "$MAIN_APP_DIR/.env" "$UI_DIR/.env"
fi

# 3. TTS .env bootstrap/sync — pull shared secrets from root .env
if [ -f "$MAIN_APP_DIR/.env" ]; then
    # Ensure TTS/.env exists
    if [ ! -f "$TTS_SERVICE_DIR/.env" ]; then
        echo "  Creating TTS .env..."
        echo "# Auto-generated from root .env — update as needed" > "$TTS_SERVICE_DIR/.env"
        echo "QWEN_TTS_VENV=$HOME/qwen3-tts/venv" >> "$TTS_SERVICE_DIR/.env"
    fi

    # Sync specific secrets if missing
    _SECRET=$(grep '^NEXTAUTH_SECRET=' "$MAIN_APP_DIR/.env" | cut -d'=' -f2-)
    if [ -n "$_SECRET" ] && ! grep -q '^NEXTAUTH_SECRET=' "$TTS_SERVICE_DIR/.env"; then
        echo "  Syncing NEXTAUTH_SECRET to TTS .env..."
        echo "NEXTAUTH_SECRET=$_SECRET" >> "$TTS_SERVICE_DIR/.env"
    fi

    _TOKEN=$(grep '^TTS_SERVICE_TOKEN=' "$MAIN_APP_DIR/.env" | cut -d'=' -f2-)
    if [ -n "$_TOKEN" ] && ! grep -q '^TTS_SERVICE_TOKEN=' "$TTS_SERVICE_DIR/.env"; then
        echo "  Syncing TTS_SERVICE_TOKEN to TTS .env..."
        echo "TTS_SERVICE_TOKEN=$_TOKEN" >> "$TTS_SERVICE_DIR/.env"
    fi
fi

# 4. Exporter .env bootstrap
if [ ! -f "$MAIN_APP_DIR/Exporter/.env" ] && [ -d "$MAIN_APP_DIR/Exporter" ]; then
    echo "  Creating Exporter .env for local testing..."
    echo "# Auto-generated local testing config" > "$MAIN_APP_DIR/Exporter/.env"
    echo "SAVE_LOCAL=true" >> "$MAIN_APP_DIR/Exporter/.env"
fi

echo -e "  ${GREEN}✓ Environment files ready${NC}"

echo ""

# Setup HTTPS certificates
echo -e "${YELLOW}Setting up HTTPS Local CA...${NC}"
MKCERT_BIN=$(ls ~/.cache/mkcert/mkcert-*-linux-amd64 2>/dev/null | head -n 1)
if [ -z "$MKCERT_BIN" ] && command -v mkcert &> /dev/null; then
    MKCERT_BIN="mkcert"
fi
if [ -n "$MKCERT_BIN" ]; then
    CA_ROOT=$($MKCERT_BIN -CAROOT 2>/dev/null)
    if [ ! -f "$CA_ROOT/rootCA.pem" ]; then
        echo -e "  ${YELLOW}⚠ Local CA is not installed. Installing now... (This may prompt for your sudo password)${NC}"
        $MKCERT_BIN -install
        echo -e "  ${GREEN}✓ Local CA installed successfully${NC}"
    else
        echo -e "  ${GREEN}✓ Local CA is already installed${NC}"
    fi
else
    echo -e "  ${YELLOW}⚠ mkcert not found. Next.js will attempt to install it during startup.${NC}"
fi

echo ""

# Start infrastructure ( Phase 1: Dependencies for other services )
echo -e "${YELLOW}Starting infrastructure services...${NC}"
cd "$MAIN_APP_DIR"

# Prevent docker compose interpolation failures from unrelated services when starting only `db`.
# These fallbacks are local-dev only and do not override explicitly provided values.
export ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-}"
export STAGING_URL="${STAGING_URL:-}"
export CHROMA_CREDENTIALS="${CHROMA_CREDENTIALS:-dev:dev}"

# Start PostgreSQL via compose (it has no port conflict with host processes)
echo "  Starting PostgreSQL..."
docker compose up -d db 2>/dev/null || {
    echo -e "  ${YELLOW}⚠ Could not start PostgreSQL via docker compose - may already be running${NC}"
}

# Wait for PostgreSQL to be healthy
wait_for_postgres() {
    local max_attempts=30
    local attempt=1
    echo -n "  Waiting for PostgreSQL..."
    while [ $attempt -le $max_attempts ]; do
        if docker compose ps db | grep -q "healthy\|running" 2>/dev/null; then
            # Also verify we can connect on port 5433
            if docker compose exec -T db pg_isready -U postgres -h localhost -p 5432 >/dev/null 2>&1; then
                echo -e " ${GREEN}✓ Ready${NC}"
                return 0
            fi
        fi
        # Also accept external PostgreSQL on 5433
        if command -v pg_isready &> /dev/null && pg_isready -h localhost -p 5433 >/dev/null 2>&1; then
            echo -e " ${GREEN}✓ Ready (port 5433)${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done
    echo -e " ${YELLOW}⚠ Timeout${NC}"
    return 1
}
wait_for_postgres

# Start Redis with host port exposed for rate limiting.
REDIS_STARTED=false
if ! check_port $REDIS_PORT; then
    echo -e "  ${GREEN}✓ Redis already running on port $REDIS_PORT${NC}"
    REDIS_STARTED=true
else
    echo "  Starting Redis (port $REDIS_PORT)..."
    if command -v docker &> /dev/null; then
        docker run -d --name redis-dev -p 6379:6379 redis:7-alpine 2>/dev/null || \
            docker start redis-dev 2>/dev/null || {
            echo -e "    ${YELLOW}⚠ Could not start Redis via Docker${NC}"
            echo -e "    ${BLUE}  Run manually: docker run -d --name redis-dev -p 6379:6379 redis:7-alpine${NC}"
        }
        sleep 1
        if ! check_port $REDIS_PORT; then
            echo -e "    ${GREEN}✓ Redis started via Docker${NC}"
            REDIS_STARTED=true
        else
            echo -e "    ${YELLOW}⚠ Redis container may still be starting${NC}"
        fi
    else
        echo -e "    ${YELLOW}⚠ Docker not found - Redis cannot start (rate limiting will fail)${NC}"
    fi
fi

echo ""

# Wait for all infrastructure to be ready before starting application services
echo -e "${YELLOW}Waiting for infrastructure health...${NC}"

# Verify Redis
if [ "$REDIS_STARTED" = true ]; then
    echo -n "  Verifying Redis..."
    if redis-cli -h localhost -p 6379 ping >/dev/null 2>&1; then
        echo -e " ${GREEN}✓ Ready${NC}"
    else
        echo -e " ${YELLOW}⚠ May not be fully ready${NC}"
    fi
fi

echo ""

# Database setup for Main App (UI)
echo -e "${YELLOW}Setting up Main App database...${NC}"
cd "$UI_DIR"

# Generate Prisma client using root schema
echo "  Generating Prisma client for UI..."
npx prisma generate --schema=../prisma/schema.prisma --silent 2>/dev/null || npx prisma generate --schema=../prisma/schema.prisma

cd "$MAIN_APP_DIR"
echo -e "  ${GREEN}✓ Main App database ready${NC}"

echo ""

# Start services (Phase 2: Application services - start in dependency order)
echo -e "${YELLOW}Starting application services...${NC}"

# Clear old PIDs
rm -f "$PIDS_FILE"
touch "$PIDS_FILE"

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

# Wait for Main App to be healthy before starting TTS
echo -n "  Waiting for Main App health..."
if wait_for_service "Main App" "https://localhost:$MAIN_APP_PORT/api/instance/health" 60; then
    :
else
    echo -e "  ${YELLOW}⚠ Main App may need more time (continuing anyway)${NC}"
fi

# Start TTS Service (if Python is available) - uses wrapper script for flash-attn
if command -v python3 &> /dev/null && [ -d "$TTS_SERVICE_DIR" ]; then
    echo "  Starting TTS Service (port $TTS_SERVICE_PORT)..."

    # Load TTS service .env to get QWEN_TTS_VENV path
    if [ -f "$TTS_SERVICE_DIR/.env" ]; then
        export $(grep -v '^#' "$TTS_SERVICE_DIR/.env" | xargs)
    fi

    # Use Qwen3-TTS venv if specified, otherwise fall back to the shared Qwen3-TTS install
    VENV_PATH="${QWEN_TTS_VENV:-$HOME/qwen3-tts/venv}"

    if [ -d "$VENV_PATH" ]; then
        cd "$TTS_SERVICE_DIR"
        
        # Use the wrapper start.sh script which handles flash-attn installation
        export TTS_PORT=$TTS_SERVICE_PORT
        export NEXTAUTH_URL=https://localhost:$MAIN_APP_PORT
        
        if [ "$LOG_MODE" = "live" ]; then
            ./start.sh 2>&1 | tee "$MAIN_APP_DIR/logs/tts-service.log" &
        else
            ./start.sh > "$MAIN_APP_DIR/logs/tts-service.log" 2>&1 &
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

# ── Trigger.dev self-hosted stack ──────────────────────────────────────────
echo "  Checking Trigger.dev server (port 3030)..."
TRIGGER_STACK_STARTED=false
if ! check_port 3030; then
    echo -e "  ${GREEN}✓ Trigger.dev server already running on port 3030${NC}"
else
    if command -v docker &> /dev/null && [ -f "$MAIN_APP_DIR/docker-compose.trigger.yml" ]; then
        echo "  Starting Trigger.dev stack (first pull may take a few minutes)..."
        if [ "$LOG_MODE" = "live" ]; then
            docker compose -f "$MAIN_APP_DIR/docker-compose.trigger.yml" up -d 2>&1 | tee "$MAIN_APP_DIR/logs/trigger-app.log"
        else
            docker compose -f "$MAIN_APP_DIR/docker-compose.trigger.yml" up -d > "$MAIN_APP_DIR/logs/trigger-app.log" 2>&1
        fi
        TRIGGER_STACK_STARTED=true
        # Wait for the Trigger.dev app to become healthy (up to 3 minutes)
        echo -n "  Waiting for Trigger.dev server..."
        _TRIGGER_WAIT=0
        until curl -sf http://localhost:3030/healthcheck 2>/dev/null | grep -qi ok; do
            if [ $_TRIGGER_WAIT -ge 180 ]; then
                echo -e " ${YELLOW}⚠ Timeout — check logs/trigger-app.log${NC}"
                break
            fi
            echo -n "."
            sleep 3
            _TRIGGER_WAIT=$((_TRIGGER_WAIT + 3))
        done
        if curl -sf http://localhost:3030/healthcheck 2>/dev/null | grep -qi ok; then
            echo -e " ${GREEN}✓ Ready${NC}"
            echo -e "  ${BLUE}  First run? Visit http://localhost:3030 to create an account.${NC}"
            echo -e "  ${BLUE}  (magic-link login URL will appear in logs/trigger-app.log)${NC}"
        fi
    else
        echo -e "  ${YELLOW}⚠ Docker not found or docker-compose.trigger.yml missing — skipping Trigger.dev stack${NC}"
    fi
fi

# Load TRIGGER_API_URL from .env files; default to self-hosted localhost if not set
_TRIGGER_API_URL=$(grep '^TRIGGER_API_URL=' "$MAIN_APP_DIR/.env" 2>/dev/null | cut -d'=' -f2- | tr -d '"')
_TRIGGER_API_URL="${_TRIGGER_API_URL:-$(grep '^TRIGGER_API_URL=' "$UI_DIR/.env" 2>/dev/null | cut -d'=' -f2- | tr -d '"')}"
_TRIGGER_API_URL="${_TRIGGER_API_URL:-http://localhost:3030}"
export TRIGGER_API_URL="$_TRIGGER_API_URL"

# Check if a secret key is configured before starting the dev worker
_TRIGGER_KEY=$(grep '^TRIGGER_SECRET_KEY=' "$MAIN_APP_DIR/.env" 2>/dev/null | cut -d'=' -f2- | tr -d '"')
_TRIGGER_KEY="${_TRIGGER_KEY:-$(grep '^TRIGGER_SECRET_KEY=' "$UI_DIR/.env" 2>/dev/null | cut -d'=' -f2- | tr -d '"')}"
export TRIGGER_SECRET_KEY="$_TRIGGER_KEY"

# Start Trigger.dev dev worker (handles export-tree, narration-render, and gedcom-import tasks locally)
if [ -z "$_TRIGGER_KEY" ]; then
    echo -e "  ${YELLOW}⚠ TRIGGER_SECRET_KEY not set — Trigger.dev dev worker skipped${NC}"
    echo -e "    ${BLUE}Visit http://localhost:3030, create a project, and add the token to .env${NC}"
    TRIGGER_PID=""
else
    echo "  Starting Trigger.dev dev worker..."
    cd "$MAIN_APP_DIR"
    if [ "$LOG_MODE" = "live" ]; then
        npx trigger.dev@4.5.0 dev --api-url "$TRIGGER_API_URL" 2>&1 | tee "$MAIN_APP_DIR/logs/trigger-dev.log" &
    else
        npx trigger.dev@4.5.0 dev --api-url "$TRIGGER_API_URL" > "$MAIN_APP_DIR/logs/trigger-dev.log" 2>&1 &
    fi
    TRIGGER_PID=$!
    echo $TRIGGER_PID >> "$PIDS_FILE"
    echo -e "    ${GREEN}✓ Trigger.dev worker started (PID: $TRIGGER_PID)${NC}"
    echo -e "    ${BLUE}  API: $TRIGGER_API_URL${NC}"
    if [ "$LOG_MODE" != "live" ]; then
        echo -e "    ${BLUE}  Logs: $MAIN_APP_DIR/logs/trigger-dev.log${NC}"
    fi
fi

echo ""

# Start Exporter Service via Docker
echo "  Starting Exporter Service (port 8001)..."
if command -v docker &> /dev/null && [ -d "$MAIN_APP_DIR/Exporter" ]; then
    cd "$MAIN_APP_DIR/Exporter"
    # Always rebuild — Docker layer cache keeps this fast when nothing changed.
    # First build downloads ~300 MB Chrome for Testing; subsequent builds are near-instant.
    echo "    Building Exporter Docker image..."
    if [ "$LOG_MODE" = "live" ]; then
        docker build -t heard-again-exporter-local .
    else
        docker build -t heard-again-exporter-local . > /dev/null 2>&1
    fi
    
    # Run container
    mkdir -p "$UI_DIR/public/exports"
    docker rm -f exporter-dev >/dev/null 2>&1 || true
    docker run -d --name exporter-dev -p 8001:8000 \
      --add-host=host.docker.internal:host-gateway \
      --env-file .env \
      -v "$UI_DIR/public/exports:/app/output" \
      heard-again-exporter-local > /dev/null 2>&1
    
    cd "$MAIN_APP_DIR"
    echo -e "    ${GREEN}✓ Exporter Service started via Docker${NC}"
    EXPORTER_STARTED=true
else
    echo -e "    ${YELLOW}⚠ Exporter Service skipped (Docker not available or Exporter dir missing)${NC}"
    EXPORTER_STARTED=false
fi

echo ""

# Final health checks
echo -e "${YELLOW}Running final health checks...${NC}"

# Check Main App
if wait_for_service "Main App" "https://localhost:$MAIN_APP_PORT/api/instance/health" 15; then
    echo -e "  ${GREEN}✓ Main App is healthy${NC}"
else
    echo -e "  ${YELLOW}⚠ Main App may still be starting (check logs)${NC}"
fi

# Check TTS Service
if [ "$TTS_STARTED" = true ]; then
    if wait_for_service "TTS Service" "http://localhost:$TTS_SERVICE_PORT/api/tts/health" 90; then
        echo -e "  ${GREEN}✓ TTS Service is healthy${NC}"
        # Fire a warmup request so CUDA kernels are compiled before the first user hits TTS.
        # This is a fire-and-forget best-effort call — failures are non-fatal.
        echo -n "  Warming TTS GPU…"
        if curl -sf -X POST "http://localhost:$TTS_SERVICE_PORT/api/tts/warmup" -m 60 >/dev/null 2>&1; then
            echo -e " ${GREEN}✓ GPU warm${NC}"
        else
            echo -e " ${YELLOW}⚠ Warmup skipped (may not have profiles yet)${NC}"
        fi
    else
        echo -e "  ${YELLOW}⚠ TTS Service may still be loading models (check logs)${NC}"
    fi
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  All services started successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BLUE}Main App:${NC}      https://localhost:$MAIN_APP_PORT"
if [ "$TTS_STARTED" = true ]; then
    echo -e "  ${BLUE}TTS Service:${NC}   http://localhost:$TTS_SERVICE_PORT"
fi
if [ -n "$TRIGGER_PID" ]; then
    echo -e "  ${BLUE}Trigger.dev:${NC}   $TRIGGER_API_URL — PID: $TRIGGER_PID"
else
    echo -e "  ${BLUE}Trigger.dev:${NC}   $TRIGGER_API_URL (worker not started — set TRIGGER_SECRET_KEY)"
fi
if [ "$EXPORTER_STARTED" = true ]; then
    echo -e "  ${BLUE}Exporter:${NC}      http://localhost:8001/run (Docker)"
fi
echo ""
if [ "$LOG_MODE" = "live" ]; then
    echo -e "  ${YELLOW}Live logging enabled - all service output shown above${NC}"
else
    echo -e "  ${YELLOW}Log mode: file${NC} (run with LOG_MODE=live for live output)"
    echo -e "  ${BLUE}Tail all logs:${NC} ./Scripts/logs.sh"
fi
echo -e "  ${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for all processes
wait
