import logging
import os
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

from app.runpod_config import MODEL_ID, TTS_STUB_MODE

logger = logging.getLogger(__name__)
_model = None


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
    _model = Qwen3TTSModel.from_pretrained(MODEL_ID, device_map=device, dtype=torch.bfloat16)
    return _model


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
