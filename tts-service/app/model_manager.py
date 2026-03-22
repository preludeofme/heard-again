import torch
import soundfile as sf
import numpy as np
import logging
import time
from pathlib import Path
from typing import Optional, Tuple

from app.config import MODEL_NAME, DEVICE, DTYPE, VOICE_PROFILES_DIR

logger = logging.getLogger(__name__)

# Map string dtype to torch dtype
DTYPE_MAP = {
    "float16": torch.float16,
    "bfloat16": torch.bfloat16,
    "float32": torch.float32,
}


class TTSModelManager:
    """Manages the Qwen3-TTS model lifecycle: loading, inference, voice profiles."""

    def __init__(self):
        self.model = None
        self.is_loaded = False
        self.model_name = MODEL_NAME
        self.device = DEVICE
        self.dtype = DTYPE_MAP.get(DTYPE, torch.bfloat16)
        self.attn_impl = "sdpa"  # Default; will try flash_attention_2 if available

    def load_model(self):
        """Load the Qwen3-TTS model into GPU memory."""
        if self.is_loaded:
            logger.info("Model already loaded, skipping.")
            return

        logger.info(f"Loading Qwen3-TTS model: {self.model_name}")
        logger.info(f"Device: {self.device}, Dtype: {DTYPE}")

        # Check for FlashAttention
        try:
            import flash_attn  # noqa: F401
            self.attn_impl = "flash_attention_2"
            logger.info("Using FlashAttention 2")
        except ImportError:
            self.attn_impl = "sdpa"
            logger.info("FlashAttention not available, using SDPA")

        try:
            from qwen_tts import Qwen3TTSModel

            start = time.time()
            self.model = Qwen3TTSModel.from_pretrained(
                self.model_name,
                device_map=self.device,
                dtype=self.dtype,
                attn_implementation=self.attn_impl,
            )
            elapsed = time.time() - start

            vram_gb = torch.cuda.memory_allocated() / 1e9
            logger.info(f"Model loaded in {elapsed:.1f}s — VRAM: {vram_gb:.2f} GB")
            self.is_loaded = True
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise

    def unload_model(self):
        """Free GPU memory."""
        if self.model is not None:
            del self.model
            self.model = None
            self.is_loaded = False
            torch.cuda.empty_cache()
            logger.info("Model unloaded, GPU memory freed.")

    # ------------------------------------------------------------------
    # Voice profile creation
    # ------------------------------------------------------------------

    def create_voice_profile(
        self,
        ref_audio_path: str,
        ref_text: Optional[str],
        profile_name: str,
    ) -> Path:
        """
        Create a reusable .pt voice profile from reference audio.

        Returns the path to the saved .pt file.
        """
        if not self.is_loaded:
            raise RuntimeError("Model is not loaded")

        logger.info(f"Creating voice profile '{profile_name}' from {ref_audio_path}")

        voice_clone_prompt = self.model.create_voice_clone_prompt(
            ref_audio=ref_audio_path,
            ref_text=ref_text,
        )

        profile_path = VOICE_PROFILES_DIR / f"{profile_name}.pt"
        torch.save({"items": voice_clone_prompt, "name": profile_name}, profile_path)

        logger.info(f"Voice profile saved to {profile_path}")
        return profile_path

    # ------------------------------------------------------------------
    # Speech synthesis
    # ------------------------------------------------------------------

    def synthesize_from_profile(
        self,
        profile_path: str,
        text: str,
        language: str = "English",
    ) -> Tuple[np.ndarray, int]:
        """Generate speech using a saved voice profile (.pt file)."""
        if not self.is_loaded:
            raise RuntimeError("Model is not loaded")

        logger.info(f"Synthesizing with profile {profile_path}: '{text[:60]}…'")

        voice_data = torch.load(profile_path, map_location=self.device, weights_only=False)
        voice_clone_prompt = voice_data["items"]

        wavs, sr = self.model.generate_voice_clone(
            text=text,
            language=language,
            voice_clone_prompt=voice_clone_prompt,
        )

        return wavs[0], sr

    def synthesize_from_reference(
        self,
        ref_audio_path: str,
        ref_text: Optional[str],
        text: str,
        language: str = "English",
    ) -> Tuple[np.ndarray, int]:
        """Generate speech directly from reference audio (no saved profile)."""
        if not self.is_loaded:
            raise RuntimeError("Model is not loaded")

        logger.info(f"Synthesizing from reference {ref_audio_path}: '{text[:60]}…'")

        kwargs: dict = {
            "text": text,
            "language": language,
            "ref_audio": ref_audio_path,
        }
        if ref_text:
            kwargs["ref_text"] = ref_text

        wavs, sr = self.model.generate_voice_clone(**kwargs)
        return wavs[0], sr

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    def get_gpu_info(self) -> dict:
        """Return current GPU stats."""
        if not torch.cuda.is_available():
            return {"available": False}

        return {
            "available": True,
            "name": torch.cuda.get_device_name(0),
            "memory_total_gb": round(torch.cuda.get_device_properties(0).total_mem / 1e9, 2),
            "memory_allocated_gb": round(torch.cuda.memory_allocated() / 1e9, 2),
            "memory_reserved_gb": round(torch.cuda.memory_reserved() / 1e9, 2),
        }


# Singleton instance
model_manager = TTSModelManager()
