import logging
import time
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Lazy-loaded Whisper model
_whisper_model = None


def _load_whisper(model_size: str = "base"):
    """Load Whisper model lazily on first use."""
    global _whisper_model
    if _whisper_model is not None:
        return _whisper_model

    logger.info(f"Loading Whisper model (size={model_size})...")
    import whisper

    start = time.time()
    _whisper_model = whisper.load_model(model_size, device="cpu")
    elapsed = time.time() - start
    logger.info(f"Whisper model loaded in {elapsed:.1f}s")
    return _whisper_model


def transcribe_audio(audio_path: str, language: Optional[str] = "en") -> str:
    """
    Transcribe an audio file using OpenAI Whisper.

    Returns the full transcript text.
    """
    model = _load_whisper()

    logger.info(f"Transcribing: {audio_path}")
    start = time.time()

    options = {}
    if language:
        options["language"] = language

    result = model.transcribe(str(audio_path), **options)
    transcript = result.get("text", "").strip()
    elapsed = time.time() - start

    logger.info(f"Transcription completed in {elapsed:.1f}s — {len(transcript)} chars")
    return transcript
