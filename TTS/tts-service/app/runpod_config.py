import os
from pathlib import Path

MODEL_ID = os.getenv("MODEL_ID", "Qwen/Qwen3-TTS-12Hz-0.6B-Base")
MODEL_CACHE_DIR = Path(os.getenv("MODEL_CACHE_DIR", "/runpod-volume/models"))
HF_HOME = Path(os.getenv("HF_HOME", "/runpod-volume/models/huggingface"))
TRANSFORMERS_CACHE = Path(os.getenv("TRANSFORMERS_CACHE", "/runpod-volume/models/huggingface"))
TORCH_HOME = Path(os.getenv("TORCH_HOME", "/runpod-volume/models/torch"))
TEMP_DIR = Path(os.getenv("TEMP_DIR", "/tmp/heard-again"))
DEFAULT_AUDIO_FORMAT = os.getenv("DEFAULT_AUDIO_FORMAT", "mp3")
TTS_CALLBACK_SECRET = os.getenv("TTS_CALLBACK_SECRET", "")
TTS_STUB_MODE = os.getenv("TTS_STUB_MODE", "false").lower() in {"1", "true", "yes"}


def ensure_runtime_dirs() -> None:
    for d in [MODEL_CACHE_DIR, HF_HOME, TRANSFORMERS_CACHE, TORCH_HOME, TEMP_DIR, Path("/runpod-volume")]:
        d.mkdir(parents=True, exist_ok=True)
