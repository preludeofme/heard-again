"""MP3 encoding for streaming TTS.

Each sentence is produced by the model as a float32 numpy array; we PCM-encode it
and push it through ffmpeg to produce MP3 frames. MP3 frames are independently
decodable, so concatenating multiple per-sentence MP3 streams on the wire works.
"""
from __future__ import annotations

import logging
import subprocess
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

FFMPEG_BINARY = "ffmpeg"
DEFAULT_BITRATE = "128k"


def encode_pcm_to_mp3(
    audio: np.ndarray,
    sample_rate: int,
    bitrate: str = DEFAULT_BITRATE,
) -> bytes:
    """Encode a float32 waveform to MP3 bytes via ffmpeg.

    Returns the raw MP3 byte string (stream-safe; independently decodable frames).
    """
    if audio.ndim > 1:
        audio = np.mean(audio, axis=1)

    # Normalize / clip to int16 PCM.
    audio = np.clip(audio, -1.0, 1.0)
    pcm = (audio * 32767.0).astype(np.int16).tobytes()

    cmd = [
        FFMPEG_BINARY,
        "-hide_banner",
        "-loglevel", "error",
        "-f", "s16le",
        "-ar", str(sample_rate),
        "-ac", "1",
        "-i", "pipe:0",
        "-codec:a", "libmp3lame",
        "-b:a", bitrate,
        "-f", "mp3",
        "pipe:1",
    ]

    process = subprocess.run(
        cmd,
        input=pcm,
        capture_output=True,
        check=False,
    )

    if process.returncode != 0:
        stderr = process.stderr.decode("utf-8", errors="replace")
        raise RuntimeError(f"ffmpeg MP3 encode failed: {stderr}")

    return process.stdout


def check_ffmpeg_available() -> Optional[str]:
    """Return version string if ffmpeg is present, else None."""
    try:
        result = subprocess.run(
            [FFMPEG_BINARY, "-version"],
            capture_output=True,
            check=False,
            timeout=5,
        )
        if result.returncode == 0:
            first_line = result.stdout.decode("utf-8", errors="replace").splitlines()
            return first_line[0] if first_line else "ffmpeg (unknown version)"
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None
    return None
