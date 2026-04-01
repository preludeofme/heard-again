#!/bin/bash
# Start the Qwen3-TTS FastAPI service
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
    echo "Loading environment variables from .env"
    export $(grep -v '^#' .env | xargs)
fi

# Activate virtual environment if it exists at ~/qwen3-tts/venv
VENV_PATH="${QWEN_TTS_VENV:-$HOME/qwen3-tts/venv}"

if [ -d "$VENV_PATH" ]; then
    echo "Activating venv at $VENV_PATH"
    source "$VENV_PATH/bin/activate"
else
    echo "WARNING: No venv found at $VENV_PATH"
    echo "Set QWEN_TTS_VENV to your Qwen3-TTS virtual environment path"
fi

# Install service dependencies (FastAPI, etc.)
pip install -q -r requirements.txt 2>/dev/null || true

# Check for flash-attention and install if missing (improves TTS performance significantly)
python -c "import flash_attn" 2>/dev/null || {
    echo "flash-attn not found. Installing for improved TTS performance..."
    echo "This may take a few minutes (building CUDA extensions)..."
    # Try pre-built wheels first, then build from source
    pip install -q flash-attn --no-build-isolation 2>/dev/null || \
    pip install flash-attn --no-build-isolation || {
        echo "WARNING: Failed to install flash-attn. TTS will work but be slower."
        echo "To manually install: pip install flash-attn --no-build-isolation"
    }
}

# Start the service
echo "Starting Qwen3-TTS service on port ${TTS_PORT:-4779}..."
python -m uvicorn app.main:app \
    --host "${TTS_HOST:-0.0.0.0}" \
    --port "${TTS_PORT:-4779}" \
    --reload
