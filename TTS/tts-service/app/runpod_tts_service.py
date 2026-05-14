import json
import logging
import os
import shutil
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

from app.runpod_config import HF_HOME, MODEL_ID, TTS_STUB_MODE

logger = logging.getLogger(__name__)
_model = None

# The exact content of speech_tokenizer/preprocessor_config.json as published in the
# Qwen/Qwen3-TTS-12Hz-0.6B-Base model repo on HuggingFace.  Older cached snapshots
# (e.g. 5d83992) were downloaded before this file was added to the repo and fail
# with "Can't load feature extractor … preprocessor_config.json".  We inject it
# directly so no 682 MB re-download is required.
_SPEECH_TOKENIZER_PREPROCESSOR_CONFIG = {
    "chunk_length_s": None,
    "feature_extractor_type": "EncodecFeatureExtractor",
    "feature_size": 1,
    "overlap": None,
    "padding_side": "right",
    "padding_value": 0.0,
    "return_attention_mask": True,
    "sampling_rate": 24000,
}


def _model_cache_dir() -> Path:
    slug = "models--" + MODEL_ID.replace("/", "--")
    return HF_HOME / slug


def _clear_model_cache() -> None:
    cache_dir = _model_cache_dir()
    if cache_dir.exists():
        logger.warning("Clearing corrupt model cache at %s", cache_dir)
        shutil.rmtree(cache_dir, ignore_errors=True)


def _inject_speech_tokenizer_config() -> bool:
    """Create speech_tokenizer/preprocessor_config.json in every cached snapshot
    that is missing it.  Returns True if at least one file was written."""
    snapshots_dir = _model_cache_dir() / "snapshots"
    if not snapshots_dir.exists():
        return False
    injected = False
    for snapshot in snapshots_dir.iterdir():
        speech_tok_dir = snapshot / "speech_tokenizer"
        config_path = speech_tok_dir / "preprocessor_config.json"
        if speech_tok_dir.is_dir() and not config_path.exists():
            config_path.write_text(json.dumps(_SPEECH_TOKENIZER_PREPROCESSOR_CONFIG, indent=2))
            logger.info("Injected missing speech_tokenizer/preprocessor_config.json → %s", config_path)
            injected = True
    return injected


def _get_model():
    global _model
    if _model is not None:
        return _model

    logger.info("CUDA available: %s", torch.cuda.is_available())
    if TTS_STUB_MODE:
        logger.info("TTS_STUB_MODE=true, using stub generator.")
        _model = "stub"
        return _model

    from qwen_tts import Qwen3TTSModel

    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    logger.info("Loading Qwen model '%s' on %s", MODEL_ID, device)

    # Three-phase recovery:
    #   attempt 0 → try inject preprocessor_config.json (avoids full re-download)
    #   attempt 1 → snapshot still broken (e.g. missing model weights); clear cache + re-download
    #   attempt 2 → fresh download; raise on any remaining error
    for attempt in range(3):
        try:
            _model = Qwen3TTSModel.from_pretrained(MODEL_ID, device_map=device, dtype=torch.bfloat16)
            return _model
        except Exception as exc:
            msg = str(exc)
            missing_preprocessor = "preprocessor_config.json" in msg
            missing_weights = (
                "no file named pytorch_model.bin" in msg
                or ("model.safetensors" in msg and "no file named" in msg)
            )
            is_incomplete_snapshot = missing_preprocessor or missing_weights or (
                "is the correct path to a directory" in msg
                or (isinstance(exc, (FileNotFoundError, OSError)) and str(HF_HOME) in msg)
            )

            if attempt == 0 and missing_preprocessor:
                if _inject_speech_tokenizer_config():
                    logger.info("Retrying model load after injecting preprocessor config")
                    continue
                # No cached snapshot yet — fall through to cache-clear below

            if attempt < 2 and is_incomplete_snapshot:
                logger.warning(
                    "Cached model snapshot is incomplete (%s) — clearing cache and re-downloading",
                    exc,
                )
                _clear_model_cache()
                continue

            raise


def generate_tts_audio(text: str, output_path: str, reference_audio_path: str | None = None, reference_text: str | None = None) -> None:
    model = _get_model()
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    if model == "stub":
        sr = 24000
        audio = np.zeros(sr, dtype=np.float32)
        sf.write(str(out), audio, sr)
        return

    try:
        if reference_audio_path:
            clone_prompt = model.create_voice_clone_prompt(ref_audio=reference_audio_path, ref_text=reference_text)
            wavs, sr = model.inference(text=text, prompt=clone_prompt)
        else:
            wavs, sr = model.inference(text=text)
        sf.write(str(out), wavs[0], sr)
    except Exception as exc:
        raise RuntimeError(f"Qwen TTS generation failed: {exc}") from exc
