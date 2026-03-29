"""
Style presets for Qwen3-TTS voice synthesis.

Each preset maps a natural-language style description to generation parameters
(temperature, top_p, top_k, repetition_penalty) that influence how the cloned
voice sounds during synthesis — without changing the voice's identity.

Based on the ComfyUI-Qwen3TTS-Emotional community research which demonstrated
that these three generation parameters reliably shift vocal expression.
"""

from typing import Dict, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


# (temperature, top_p, top_k, repetition_penalty)
# Defaults: temperature=0.9, top_p=1.0, top_k=50, repetition_penalty=1.05
STYLE_PRESETS: Dict[str, Dict[str, float]] = {
    # ── Warmth & Calm ──
    "warm": {
        "temperature": 0.85,
        "top_p": 0.90,
        "top_k": 40,
        "repetition_penalty": 1.02,
    },
    "gentle": {
        "temperature": 0.80,
        "top_p": 0.85,
        "top_k": 35,
        "repetition_penalty": 1.00,
    },
    "calm": {
        "temperature": 0.75,
        "top_p": 0.80,
        "top_k": 30,
        "repetition_penalty": 1.00,
    },
    "soothing": {
        "temperature": 0.70,
        "top_p": 0.80,
        "top_k": 30,
        "repetition_penalty": 1.00,
    },
    # ── Energy & Emotion ──
    "happy": {
        "temperature": 1.05,
        "top_p": 0.95,
        "top_k": 60,
        "repetition_penalty": 1.10,
    },
    "excited": {
        "temperature": 1.15,
        "top_p": 0.95,
        "top_k": 70,
        "repetition_penalty": 1.12,
    },
    "energetic": {
        "temperature": 1.10,
        "top_p": 0.95,
        "top_k": 65,
        "repetition_penalty": 1.10,
    },
    # ── Sadness & Reflection ──
    "sad": {
        "temperature": 0.75,
        "top_p": 0.80,
        "top_k": 30,
        "repetition_penalty": 1.02,
    },
    "nostalgic": {
        "temperature": 0.80,
        "top_p": 0.85,
        "top_k": 35,
        "repetition_penalty": 1.03,
    },
    "reflective": {
        "temperature": 0.80,
        "top_p": 0.85,
        "top_k": 35,
        "repetition_penalty": 1.02,
    },
    # ── Confidence & Authority ──
    "confident": {
        "temperature": 0.95,
        "top_p": 0.90,
        "top_k": 50,
        "repetition_penalty": 1.08,
    },
    "authoritative": {
        "temperature": 0.90,
        "top_p": 0.85,
        "top_k": 45,
        "repetition_penalty": 1.10,
    },
    # ── Conversational ──
    "conversational": {
        "temperature": 0.92,
        "top_p": 0.95,
        "top_k": 50,
        "repetition_penalty": 1.05,
    },
    "storytelling": {
        "temperature": 0.95,
        "top_p": 0.92,
        "top_k": 55,
        "repetition_penalty": 1.06,
    },
    "friendly": {
        "temperature": 0.95,
        "top_p": 0.92,
        "top_k": 50,
        "repetition_penalty": 1.05,
    },
    # ── Slow / Fast ──
    "slow": {
        "temperature": 0.70,
        "top_p": 0.75,
        "top_k": 25,
        "repetition_penalty": 1.00,
    },
    "fast": {
        "temperature": 1.10,
        "top_p": 0.95,
        "top_k": 65,
        "repetition_penalty": 1.12,
    },
    # ── Neutral (the defaults) ──
    "neutral": {
        "temperature": 0.90,
        "top_p": 1.00,
        "top_k": 50,
        "repetition_penalty": 1.05,
    },
}

# Keywords in natural-language descriptions mapped to preset names
KEYWORD_TO_PRESET: Dict[str, str] = {
    "warm": "warm",
    "gentle": "gentle",
    "calm": "calm",
    "soothing": "soothing",
    "peaceful": "soothing",
    "happy": "happy",
    "cheerful": "happy",
    "joyful": "happy",
    "excited": "excited",
    "enthusiastic": "excited",
    "energetic": "energetic",
    "upbeat": "energetic",
    "lively": "energetic",
    "sad": "sad",
    "melancholy": "sad",
    "nostalgic": "nostalgic",
    "wistful": "nostalgic",
    "reflective": "reflective",
    "thoughtful": "reflective",
    "contemplative": "reflective",
    "confident": "confident",
    "strong": "confident",
    "bold": "confident",
    "authoritative": "authoritative",
    "commanding": "authoritative",
    "conversational": "conversational",
    "casual": "conversational",
    "natural": "conversational",
    "storytelling": "storytelling",
    "narrative": "storytelling",
    "bedtime": "storytelling",
    "friendly": "friendly",
    "inviting": "friendly",
    "slow": "slow",
    "deliberate": "slow",
    "measured": "slow",
    "fast": "fast",
    "quick": "fast",
    "rapid": "fast",
}


def resolve_style_params(
    style: Optional[str] = None,
    instruct: Optional[str] = None,
) -> Dict[str, float]:
    """
    Resolve generation parameters from a style preset name or natural-language
    description. Returns a dict of generation kwargs.

    Priority:
    1. Exact preset name match (e.g. "warm", "happy")
    2. Keyword extraction from natural-language description
    3. Falls back to "neutral" defaults
    """
    # Try exact preset match first
    if style and style.lower() in STYLE_PRESETS:
        logger.info(f"Using style preset: {style}")
        return STYLE_PRESETS[style.lower()].copy()

    # Try keyword extraction from instruct/style text
    text = (instruct or style or "").lower()
    if text:
        matched_presets = []
        for keyword, preset_name in KEYWORD_TO_PRESET.items():
            if keyword in text:
                matched_presets.append(preset_name)

        if matched_presets:
            # Average the params of all matched presets
            result: Dict[str, float] = {}
            for key in ["temperature", "top_p", "top_k", "repetition_penalty"]:
                values = [STYLE_PRESETS[p][key] for p in matched_presets]
                result[key] = sum(values) / len(values)
            # Round top_k to int
            result["top_k"] = round(result["top_k"])
            logger.info(f"Resolved style from keywords {matched_presets}: {result}")
            return result

    logger.info("No style matched, using neutral defaults")
    return STYLE_PRESETS["neutral"].copy()


def list_presets() -> list:
    """Return all available style presets with their parameters."""
    return [
        {"name": name, **params}
        for name, params in STYLE_PRESETS.items()
    ]
