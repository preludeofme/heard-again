import torch
import soundfile as sf
import numpy as np
import logging
import time
import threading
from pathlib import Path
from typing import Optional, Tuple

from app.config import (
    MODEL_NAME,
    VOICE_DESIGN_MODEL_NAME,
    DEVICE,
    DTYPE,
    VOICE_PROFILES_DIR,
    GENERATED_AUDIO_DIR,
)

logger = logging.getLogger(__name__)

# Map string dtype to torch dtype
DTYPE_MAP = {
    "float16": torch.float16,
    "bfloat16": torch.bfloat16,
    "float32": torch.float32,
}


class TTSModelManager:
    """Manages Qwen3-TTS Base + VoiceDesign models for the hybrid clone workflow."""

    def __init__(self):
        # Base model (voice cloning)
        self.base_model = None
        self.base_loaded = False
        self.base_model_name = MODEL_NAME

        # VoiceDesign model (voice design from natural language)
        self.design_model = None
        self.design_loaded = False
        self.design_model_name = VOICE_DESIGN_MODEL_NAME

        self.device = DEVICE
        self.dtype = DTYPE_MAP.get(DTYPE, torch.bfloat16)
        self.attn_impl = "sdpa"
        
        # Concurrency lock to prevent GPU OOM and contention
        self._lock = threading.Lock()

    @property
    def is_loaded(self) -> bool:
        return self.base_loaded

    def _detect_attn(self):
        try:
            import flash_attn  # noqa: F401
            self.attn_impl = "flash_attention_2"
            logger.info("Using FlashAttention 2")
        except ImportError:
            self.attn_impl = "sdpa"
            logger.info("FlashAttention not available, using SDPA")

    # ------------------------------------------------------------------
    # Model loading
    # ------------------------------------------------------------------

    def load_model(self):
        """Load the Base (voice-clone) model."""
        with self._lock:
            if self.base_loaded:
                logger.info("Base model already loaded, skipping.")
                return
            self._detect_attn()
            self._load_one("base")

    def load_design_model(self):
        """Load the VoiceDesign model."""
        with self._lock:
            if self.design_loaded:
                logger.info("Design model already loaded, skipping.")
                return
            self._detect_attn()
            self._load_one("design")

    def _load_one(self, which: str):
        from qwen_tts import Qwen3TTSModel

        name = self.base_model_name if which == "base" else self.design_model_name
        logger.info(f"Loading {which} model: {name}")
        logger.info(f"Device: {self.device}, Dtype: {DTYPE}")

        start = time.time()
        model = Qwen3TTSModel.from_pretrained(
            name,
            device_map=self.device,
            dtype=self.dtype,
            attn_implementation=self.attn_impl,
        )
        elapsed = time.time() - start
        vram_gb = torch.cuda.memory_allocated() / 1e9
        logger.info(f"{which} model loaded in {elapsed:.1f}s — VRAM total: {vram_gb:.2f} GB")

        if which == "base":
            self.base_model = model
            self.base_loaded = True
        else:
            self.design_model = model
            self.design_loaded = True

    def unload_model(self):
        """Free all GPU memory."""
        for attr, flag in [("base_model", "base_loaded"), ("design_model", "design_loaded")]:
            m = getattr(self, attr)
            if m is not None:
                del m
                setattr(self, attr, None)
                setattr(self, flag, False)
        torch.cuda.empty_cache()
        logger.info("All models unloaded, GPU memory freed.")

    # ------------------------------------------------------------------
    # Voice profile creation (from reference audio)
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
        if not self.base_loaded:
            raise RuntimeError("Base model is not loaded")

        logger.info(f"Creating voice profile '{profile_name}' from {ref_audio_path}")

        voice_clone_prompt = self.base_model.create_voice_clone_prompt(
            ref_audio=ref_audio_path,
            ref_text=ref_text,
        )

        profile_path = VOICE_PROFILES_DIR / f"{profile_name}.pt"
        torch.save({"items": voice_clone_prompt, "name": profile_name}, profile_path)

        logger.info(f"Voice profile saved to {profile_path}")
        return profile_path

    # ------------------------------------------------------------------
    # Voice Design
    # ------------------------------------------------------------------

    def design_voice(
        self,
        text: str,
        instruct: str,
        language: str = "English",
    ) -> Tuple[np.ndarray, int]:
        """
        Generate speech with a designed voice from a natural-language description.

        Args:
            text: What the voice should say (used as reference clip content).
            instruct: Natural-language description of the desired voice
                      (e.g. "A warm elderly male voice, slow cadence, gentle").
            language: Target language.

        Returns (audio_array, sample_rate).
        """
        with self._lock:
            if not self.design_loaded:
                raise RuntimeError("VoiceDesign model is not loaded")

            logger.info(f"Designing voice — instruct: '{instruct[:80]}…'")

            wavs, sr = self.design_model.generate_voice_design(
                text=text,
                language=language,
                instruct=instruct,
            )

            return wavs[0], sr

    def design_and_clone_profile(
        self,
        ref_text: str,
        instruct: str,
        profile_name: str,
        language: str = "English",
    ) -> Tuple[Path, str]:
        """
        Hybrid workflow: Design a voice → save reference clip → build clone profile.

        1. Uses VoiceDesign model to synthesize a reference clip matching `instruct`.
        2. Feeds that clip into the Base model's create_voice_clone_prompt.
        3. Saves a reusable .pt profile.

        Returns (profile_path, designed_audio_path).
        """
        with self._lock:
            if not self.design_loaded:
                raise RuntimeError("VoiceDesign model is not loaded")
            if not self.base_loaded:
                raise RuntimeError("Base model is not loaded")

            # Step 1: Generate the designed reference clip
            logger.info(f"[design→clone] Designing voice for '{profile_name}': {instruct[:80]}…")
            
            # We are already inside the lock, so we can't call design_voice (re-entrant lock?)
            # Actually threading.Lock is NOT re-entrant. 
            # Let's use design_model directly if we are inside design_and_clone_profile
            
            wavs, sr = self.design_model.generate_voice_design(
                text=ref_text,
                language=language,
                instruct=instruct,
            )
            designed_wav, sr = wavs[0], sr

            # Save the designed reference audio for records
            import uuid
            design_id = str(uuid.uuid4())
            design_path = GENERATED_AUDIO_DIR / f"design_{design_id}.wav"
            sf.write(str(design_path), designed_wav, sr)
            logger.info(f"[design→clone] Designed reference saved: {design_path}")

            # Step 2: Build a clone prompt from the designed audio
            logger.info(f"[design→clone] Building clone prompt from designed audio…")
            voice_clone_prompt = self.base_model.create_voice_clone_prompt(
                ref_audio=(designed_wav, sr),
                ref_text=ref_text,
            )

            # Step 3: Save as reusable profile
            profile_path = VOICE_PROFILES_DIR / f"{profile_name}.pt"
            torch.save({
                "items": voice_clone_prompt,
                "name": profile_name,
                "instruct": instruct,
                "ref_text": ref_text,
                "designed_from": str(design_path),
            }, profile_path)

            logger.info(f"[design→clone] Profile saved: {profile_path}")
            return profile_path, str(design_path)

    # ------------------------------------------------------------------
    # Blended Voice Profile (real identity + designed style)
    # ------------------------------------------------------------------

    def blend_voice_profile(
        self,
        ref_audio_path: str,
        ref_text: str,
        instruct: str,
        style_ref_text: str,
        profile_name: str,
        language: str = "English",
    ) -> Tuple[Path, str]:
        """
        Create a voice profile that blends a real person's timbre with a
        designed voice's emotion/cadence/style.
        """
        with self._lock:
            if not self.base_loaded:
                raise RuntimeError("Base model is not loaded")
            if not self.design_loaded:
                raise RuntimeError("VoiceDesign model is not loaded")

            from qwen_tts.inference.qwen3_tts_model import VoiceClonePromptItem

            # Step 1: Extract speaker identity from real audio
            logger.info(f"[blend] Extracting speaker identity from {ref_audio_path}")
            identity_prompt = self.base_model.create_voice_clone_prompt(
                ref_audio=ref_audio_path,
                ref_text=ref_text,
                x_vector_only_mode=True,
            )
            real_spk_embedding = identity_prompt[0].ref_spk_embedding
            logger.info(f"[blend] Speaker embedding shape: {real_spk_embedding.shape}")

            # Step 2: Generate styled reference clip via VoiceDesign
            logger.info(f"[blend] Designing style: '{instruct[:80]}…'")
            wavs, sr = self.design_model.generate_voice_design(
                text=style_ref_text,
                language=language,
                instruct=instruct,
            )
            designed_wav, sr = wavs[0], sr

            # Save the designed clip for reference
            import uuid
            design_id = str(uuid.uuid4())
            design_path = GENERATED_AUDIO_DIR / f"design_{design_id}.wav"
            sf.write(str(design_path), designed_wav, sr)
            logger.info(f"[blend] Designed style clip saved: {design_path}")

            # Step 3: Extract prosodic context (ref_code) from designed clip
            logger.info(f"[blend] Extracting style context from designed clip…")
            style_prompt = self.base_model.create_voice_clone_prompt(
                ref_audio=(designed_wav, sr),
                ref_text=style_ref_text,
                x_vector_only_mode=False,
            )
            designed_ref_code = style_prompt[0].ref_code
            logger.info(f"[blend] Style ref_code shape: {designed_ref_code.shape}")

            # Step 4: Build blended prompt — real identity + designed style
            logger.info(f"[blend] Fusing real identity with designed style…")
            blended_item = VoiceClonePromptItem(
                ref_code=designed_ref_code,
                ref_spk_embedding=real_spk_embedding,
                x_vector_only_mode=False,
                icl_mode=True,
                ref_text=style_ref_text,
            )
            blended_prompt = [blended_item]

            # Step 5: Save profile
            profile_path = VOICE_PROFILES_DIR / f"{profile_name}.pt"
            torch.save({
                "items": blended_prompt,
                "name": profile_name,
                "instruct": instruct,
                "ref_text": ref_text,
                "style_ref_text": style_ref_text,
                "blend_mode": True,
                "designed_from": str(design_path),
            }, profile_path)

            logger.info(f"[blend] Blended profile saved: {profile_path}")
            return profile_path, str(design_path)

    # ------------------------------------------------------------------
    # Speech synthesis
    # ------------------------------------------------------------------

    def synthesize_from_profile(
        self,
        profile_path: str,
        text: str,
        language: str = "English",
        gen_kwargs: Optional[dict] = None,
    ) -> Tuple[np.ndarray, int]:
        """Generate speech using a saved voice profile (.pt file)."""
        with self._lock:
            if not self.base_loaded:
                raise RuntimeError("Base model is not loaded")

            logger.info(f"Synthesizing with profile {profile_path}: '{text[:60]}…'")
            if gen_kwargs:
                logger.info(f"Style params: {gen_kwargs}")

            voice_data = torch.load(profile_path, map_location=self.device, weights_only=False)
            voice_clone_prompt = voice_data["items"]

            call_kwargs: dict = {
                "text": text,
                "language": language,
                "voice_clone_prompt": voice_clone_prompt,
            }
            if gen_kwargs:
                call_kwargs.update(gen_kwargs)

            wavs, sr = self.base_model.generate_voice_clone(**call_kwargs)

            return wavs[0], sr

    def synthesize_from_reference(
        self,
        ref_audio_path: str,
        ref_text: Optional[str],
        text: str,
        language: str = "English",
        gen_kwargs: Optional[dict] = None,
    ) -> Tuple[np.ndarray, int]:
        """Generate speech directly from reference audio (no saved profile)."""
        with self._lock:
            if not self.base_loaded:
                raise RuntimeError("Base model is not loaded")

            logger.info(f"Synthesizing from reference {ref_audio_path}: '{text[:60]}…'")

            kwargs: dict = {
                "text": text,
                "language": language,
                "ref_audio": ref_audio_path,
            }
            if ref_text:
                kwargs["ref_text"] = ref_text
            if gen_kwargs:
                kwargs.update(gen_kwargs)

            wavs, sr = self.base_model.generate_voice_clone(**kwargs)
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
