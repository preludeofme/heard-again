#!/usr/bin/env bash
set -euo pipefail

REGISTRY_IMAGE="${REGISTRY_IMAGE:?Set REGISTRY_IMAGE, for example yourdockerhubuser/heard-again-qwen3-tts or ghcr.io/youruser/heard-again-qwen3-tts}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
LOCAL_IMAGE="${LOCAL_IMAGE:-heard-again-qwen3-tts:${IMAGE_TAG}}"

docker tag "${LOCAL_IMAGE}" "${REGISTRY_IMAGE}:${IMAGE_TAG}"
docker push "${REGISTRY_IMAGE}:${IMAGE_TAG}"
