import os
from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
VOICE_PROFILES_DIR = DATA_DIR / "voice_profiles"
REFERENCE_AUDIO_DIR = DATA_DIR / "reference_audio"
GENERATED_AUDIO_DIR = DATA_DIR / "generated_audio"

# Create directories
for d in [DATA_DIR, VOICE_PROFILES_DIR, REFERENCE_AUDIO_DIR, GENERATED_AUDIO_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Model configuration
MODEL_NAME = os.getenv("QWEN_TTS_MODEL", "Qwen/Qwen3-TTS-12Hz-1.7B-Base")
VOICE_DESIGN_MODEL_NAME = os.getenv("QWEN_TTS_DESIGN_MODEL", "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign")
DEVICE = os.getenv("QWEN_TTS_DEVICE", "cuda:0")
DTYPE = os.getenv("QWEN_TTS_DTYPE", "bfloat16")

# GCS storage (set to enable cross-pod voice profile sharing)
GCS_TTS_MODELS_BUCKET = os.getenv("GCS_TTS_MODELS_BUCKET", "")

# Server configuration
HOST = os.getenv("TTS_HOST", "0.0.0.0")
PORT = int(os.getenv("TTS_PORT", "8101"))

# Audio settings
SAMPLE_RATE = 24000
MAX_REFERENCE_DURATION_SEC = 30
MIN_REFERENCE_DURATION_SEC = 3
ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".flac", ".ogg", ".m4a"}
