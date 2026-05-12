# Heard Again RunPod Serverless (Qwen3-TTS)

## Build image
```bash
cd TTS/tts-service
./scripts/build-runpod-image.sh
```

## Push image
### Docker Hub
```bash
REGISTRY_IMAGE=yourdockerhubuser/heard-again-qwen3-tts IMAGE_TAG=latest ./scripts/push-runpod-image.sh
```

### GitHub Container Registry
```bash
docker login ghcr.io
REGISTRY_IMAGE=ghcr.io/youruser/heard-again-qwen3-tts IMAGE_TAG=latest ./scripts/push-runpod-image.sh
```

## RunPod setup
- Choose **Custom deployment**.
- Choose **Deploy from Docker registry**.
- Set **Container image** to your pushed image:
  - `yourdockerhubuser/heard-again-qwen3-tts:latest` or
  - `ghcr.io/youruser/heard-again-qwen3-tts:latest`
- Leave **Container start command** blank.
- Endpoint type: Queue.
- Min workers: 0.
- Max workers: 1 while testing.

## Required environment variables
- `MODEL_ID` (`Qwen/Qwen3-TTS-12Hz-0.6B-Base` or `Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice`)
- `MODEL_CACHE_DIR=/runpod-volume/models`
- `HF_HOME=/runpod-volume/models/huggingface`
- `TRANSFORMERS_CACHE=/runpod-volume/models/huggingface`
- `TORCH_HOME=/runpod-volume/models/torch`
- `TEMP_DIR=/tmp/heard-again`
- `R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`
- `R2_BUCKET_NAME=heard-again-prod`
- `R2_ACCESS_KEY_ID=...`
- `R2_SECRET_ACCESS_KEY=...`
- `TTS_CALLBACK_SECRET=...`
- `DEFAULT_AUDIO_FORMAT=mp3`

## Recommended endpoint settings
- Endpoint name: `heard-again-qwen3-tts`
- Endpoint type: Queue
- Min workers: 0
- Max workers: 1
- GPU: RTX 4090, A40, A5000, or better
- Container image: your pushed image
- Container start command: blank
- Network volume: optional but recommended after first successful test

## Example payload
```json
{
  "jobId": "tts_job_123",
  "familySpaceId": "family_abc",
  "personId": "person_123",
  "text": "Text to narrate.",
  "referenceAudioUrl": "https://signed-r2-url",
  "referenceText": "Optional transcript.",
  "outputKey": "family-spaces/family_abc/people/person_123/generated-audio/tts_job_123.mp3",
  "callbackUrl": "https://heardagain.com/api/tts/runpod/callback"
}
```

## Local smoke test
Use stub mode to validate pipeline wiring:
```bash
cd TTS/tts-service
TTS_STUB_MODE=true python -m app.runpod_handler_local_test
```

## Troubleshooting
- If GPU is not detected, verify RunPod GPU selection and CUDA runtime image.
- If model download fails, verify outbound networking and HF model permissions.
- If cache is slow/cold every run, attach a RunPod network volume at `/runpod-volume`.
- If R2 upload fails, confirm endpoint excludes bucket name and credentials are valid.
