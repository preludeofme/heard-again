#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-heard-again-qwen3-tts}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

docker build \
  -f Dockerfile.runpod \
  -t "${IMAGE_NAME}:${IMAGE_TAG}" \
  .
