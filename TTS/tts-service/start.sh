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

# Start the service
echo "Starting Qwen3-TTS service on port ${TTS_PORT:-4779}..."
python -m uvicorn app.main:app \
    --host "${TTS_HOST:-0.0.0.0}" \
    --port "${TTS_PORT:-4779}" \
    --reload
