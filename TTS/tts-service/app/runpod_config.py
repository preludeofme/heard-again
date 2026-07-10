import os
from pathlib import Path

MODEL_ID = os.getenv("MODEL_ID", "Qwen/Qwen3-TTS-12Hz-0.6B-Base")
MODEL_CACHE_DIR = Path(os.getenv("MODEL_CACHE_DIR", "/runpod-volume/models"))
HF_HOME = Path(os.getenv("HF_HOME", "/runpod-volume/models/huggingface"))
TRANSFORMERS_CACHE = Path(os.getenv("TRANSFORMERS_CACHE", "/runpod-volume/models/huggingface"))
TORCH_HOME = Path(os.getenv("TORCH_HOME", "/runpod-volume/models/torch"))
TEMP_DIR = Path(os.getenv("TEMP_DIR", "/tmp/heard-again"))
DEFAULT_AUDIO_FORMAT = "wav"  # soundfile cannot write MP3; WAV is always safe
TTS_CALLBACK_SECRET = os.getenv("TTS_CALLBACK_SECRET", "")
TTS_STUB_MODE = os.getenv("TTS_STUB_MODE", "false").lower() in {"1", "true", "yes"}


def ensure_runtime_dirs() -> None:
    for d in [MODEL_CACHE_DIR, HF_HOME, TRANSFORMERS_CACHE, TORCH_HOME, TEMP_DIR, Path("/runpod-volume")]:
        d.mkdir(parents=True, exist_ok=True)

    # TEMP_DIR holds transient per-request audio; restrict it to the
    # container's own user rather than leaving it world-writable (the base
    # images chmod the whole /runpod-volume tree 777 at build time for
    # cross-UID model-volume compatibility — this narrows just the temp
    # scratch space back down at runtime).
    try:
        os.chmod(TEMP_DIR, 0o700)
    except OSError:
        pass
