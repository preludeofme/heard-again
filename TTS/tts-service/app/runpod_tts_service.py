import logging
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

from app.runpod_config import HF_HOME, MODEL_ID, TTS_STUB_MODE

logger = logging.getLogger(__name__)
_model = None


def _model_cache_dir() -> Path:
    slug = "models--" + MODEL_ID.replace("/", "--")
    return HF_HOME / slug


def _get_model():
    global _model
    if _model is not None:
        return _model

    logger.info("CUDA available: %s", torch.cuda.is_available())
    if TTS_STUB_MODE:
        logger.info("TTS_STUB_MODE=true, using stub generator.")
        _model = "stub"
        return _model

    from huggingface_hub import snapshot_download
    from qwen_tts import Qwen3TTSModel

    device = "cuda:0" if torch.cuda.is_available() else "cpu"

    # Use snapshot_download instead of from_pretrained(model_id) so that ALL
    # repo files are synced before loading — including speech_tokenizer/model.safetensors
    # and speech_tokenizer/preprocessor_config.json which from_pretrained can miss
    # when the local cache only has a partial download (e.g. old snapshot 5d83992).
    # snapshot_download compares local files against the Hub manifest and fetches
    # only what is missing, so it is fast on a complete cache and safe on a partial one.
    for attempt in range(2):
        try:
            logger.info("Syncing model files from Hub for '%s' (attempt %d)...", MODEL_ID, attempt + 1)
            local_dir = snapshot_download(
                repo_id=MODEL_ID,
                cache_dir=str(HF_HOME),
            )
            logger.info("Loading Qwen model on %s from %s", device, local_dir)
            _model = Qwen3TTSModel.from_pretrained(local_dir, device_map=device, dtype=torch.bfloat16)
            return _model
        except Exception as exc:
            if attempt == 0:
                logger.warning(
                    "Model load failed (%s) — forcing full re-download on next attempt",
                    exc,
                )
                # Force re-download by removing the refs pointer so snapshot_download
                # fetches everything fresh. Safer than rmtree on a network volume.
                refs_file = HF_HOME / _model_cache_dir().name / "refs" / "main"
                if refs_file.exists():
                    try:
                        refs_file.unlink()
                        logger.info("Removed stale refs/main pointer to force re-download")
                    except Exception as ref_exc:
                        logger.warning("Could not remove refs/main (%s) — trying force_download", ref_exc)
                        # Last resort: force_download flag bypasses all local caches
                        try:
                            local_dir = snapshot_download(
                                repo_id=MODEL_ID,
                                cache_dir=str(HF_HOME),
                                force_download=True,
                            )
                            _model = Qwen3TTSModel.from_pretrained(local_dir, device_map=device, dtype=torch.bfloat16)
                            return _model
                        except Exception as force_exc:
                            raise force_exc from exc
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

    if not reference_audio_path:
        # Base model requires a reference audio for voice cloning.
        # Write silence as a safe fallback (hit during pre-warm; real jobs always have a profile).
        logger.warning("No reference audio provided — writing silence (Base model requires ref_audio)")
        sf.write(str(out), np.zeros(24000, dtype=np.float32), 24000)
        return

    try:
        if reference_text:
            # ICL mode: uses both audio and transcript for best cloning quality.
            wavs, sr = model.generate_voice_clone(
                text=text,
                ref_audio=reference_audio_path,
                ref_text=reference_text,
                x_vector_only_mode=False,
            )
        else:
            # X-vector only mode: speaker embedding from audio alone.
            # Lower cloning accuracy but works without a transcript.
            # Profiles uploaded before Whisper was added won't have a transcript.
            logger.warning("No reference transcript available — using x_vector_only_mode (lower quality)")
            wavs, sr = model.generate_voice_clone(
                text=text,
                ref_audio=reference_audio_path,
                x_vector_only_mode=True,
            )
        sf.write(str(out), wavs[0], sr)
    except Exception as exc:
        raise RuntimeError(f"Qwen TTS generation failed: {exc}") from exc
