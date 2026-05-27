import base64
import logging
import re
import shutil
import sys
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any

import requests
import runpod
import soundfile as sf
from pydantic import ValidationError

from app.gpu_compat_check import exit_if_incompatible
from app.runpod_callback_client import post_callback
from app.runpod_config import DEFAULT_AUDIO_FORMAT, TEMP_DIR, TTS_STUB_MODE, ensure_runtime_dirs
from app.runpod_r2_client import R2Client
from app.runpod_schemas import (
    DownloadAudioInput,
    DownloadAudioResult,
    RunPodResult,
    RunPodTTSInput,
    SynthesizeBatchInput,
    SynthesisCompleteEvent,
    TranscribeInput,
    TranscribeResult,
    UploadReferenceInput,
    UploadReferenceResult,
)
from app.runpod_tts_service import generate_tts_audio

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── GPU compatibility gate ─────────────────────────────────────────────────────
# Fail fast before any model loading or job dispatch: if the allocated GPU is
# not compatible with the installed PyTorch, print a clear error and exit.
# RunPod will auto-restart the worker, hopefully on a compatible GPU next time.
exit_if_incompatible()


# ── helpers ──────────────────────────────────────────────────────────────────

def _download_url(url: str, target_path: Path) -> None:
    with requests.get(url, timeout=60, stream=True) as r:
        r.raise_for_status()
        with target_path.open("wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)


def _split_sentences(text: str) -> list[str]:
    """Split text into sentences using nltk (handles abbreviations, initials, etc.)."""
    try:
        import nltk
        # Store punkt data on the RunPod volume so it persists across cold starts.
        nltk_data_dir = "/runpod-volume/nltk_data"
        if nltk_data_dir not in nltk.data.path:
            nltk.data.path.insert(0, nltk_data_dir)
        try:
            nltk.data.find("tokenizers/punkt_tab")
        except LookupError:
            nltk.download("punkt_tab", download_dir=nltk_data_dir, quiet=True)
        sentences = nltk.sent_tokenize(text.strip())
        return [s.strip() for s in sentences if s.strip()]
    except Exception as exc:
        logger.warning("nltk sentence splitting failed (%s) — falling back to regex", exc)
        parts = re.split(r"(?<=[.!?])\s+", text.strip())
        return [p.strip() for p in parts if p.strip()]


def _transcribe(audio_path: Path) -> str | None:
    """Run Whisper transcription. Returns None if Whisper is unavailable."""
    try:
        import whisper  # openai-whisper
        model = whisper.load_model("base")
        result = model.transcribe(str(audio_path))
        return result.get("text", "").strip() or None
    except ImportError:
        try:
            from faster_whisper import WhisperModel
            model = WhisperModel("base", device="auto", compute_type="int8")
            segments, _ = model.transcribe(str(audio_path))
            return " ".join(seg.text for seg in segments).strip() or None
        except ImportError:
            logger.warning("No Whisper implementation found; transcript will be null")
            return None


def _audio_duration(path: Path) -> float:
    try:
        data, sr = sf.read(str(path))
        return len(data) / sr
    except Exception:
        return 0.0


# ── action handlers ──────────────────────────────────────────────────────────

def _handle_upload_reference(req: UploadReferenceInput) -> dict[str, Any]:
    job_dir = TEMP_DIR / f"upload-{uuid.uuid4().hex}"
    job_dir.mkdir(parents=True, exist_ok=True)
    try:
        audio_path = job_dir / req.filename

        if req.audioBase64:
            audio_path.write_bytes(base64.b64decode(req.audioBase64))
        elif req.audioUrl:
            _download_url(req.audioUrl, audio_path)
        else:
            raise ValueError("Either audioBase64 or audioUrl is required")

        duration = _audio_duration(audio_path)
        transcript = _transcribe(audio_path)

        file_id = uuid.uuid4().hex
        r2_key = f"voice-profiles/{req.familyspaceId}/{file_id}/{req.filename}"
        r2 = R2Client()
        r2.upload_file(str(audio_path), r2_key)

        return UploadReferenceResult(
            fileId=file_id,
            filePath=r2_key,
            fileName=req.filename,
            duration=duration,
            transcript=transcript,
        ).model_dump()
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)


def _handle_synthesize_batch(req: SynthesizeBatchInput) -> dict[str, Any]:
    job_dir = TEMP_DIR / f"synth-{uuid.uuid4().hex}"
    job_dir.mkdir(parents=True, exist_ok=True)
    try:
        import numpy as np

        start = time.time()
        sentences = _split_sentences(req.text)
        total = len(sentences)

        r2 = R2Client()
        reference_path: Path | None = None
        try:
            ref_prefix = f"voice-profiles/{req.familyspaceId}/{req.profileName}/"
            objects = r2.client.list_objects_v2(Bucket=r2.bucket_name, Prefix=ref_prefix)
            keys = [o["Key"] for o in objects.get("Contents", [])]
            if keys:
                reference_path = job_dir / "reference.audio"
                reference_path.write_bytes(r2.download_file_bytes(keys[0]))
        except Exception as e:
            logger.warning("Could not fetch voice reference for %s: %s", req.profileName, e)

        sentence_paths: list[Path] = []
        for i, sentence in enumerate(sentences):
            out_path = job_dir / f"sentence_{i:04d}.{DEFAULT_AUDIO_FORMAT}"
            t_sent = time.time()
            generate_tts_audio(
                text=sentence,
                output_path=str(out_path),
                reference_audio_path=str(reference_path) if reference_path else None,
                reference_text=req.referenceText,
            )
            last_secs = round(time.time() - t_sent, 2)
            sentence_paths.append(out_path)

            try:
                runpod.serverless.progress({
                    "type": "progress",
                    "sentencesDone": i + 1,
                    "sentencesTotal": total,
                    "lastSentenceSeconds": last_secs,
                })
            except AttributeError:
                pass  # SDK version doesn't expose serverless.progress; client falls back to polling

        combined_path = job_dir / f"combined.{DEFAULT_AUDIO_FORMAT}"
        all_audio: list[Any] = []
        sample_rate = 24000
        for sp in sentence_paths:
            data, sr = sf.read(str(sp))
            sample_rate = sr
            silence_samples = int(sr * req.silencePaddingMs / 1000)
            all_audio.append(data)
            all_audio.append(np.zeros(silence_samples, dtype=np.float32))

        combined = np.concatenate(all_audio)
        sf.write(str(combined_path), combined, sample_rate, subtype='PCM_16')

        duration = len(combined) / sample_rate
        synthesis_time = round(time.time() - start, 2)
        file_size = combined_path.stat().st_size

        audio_id = f"generated-audio/{req.familyspaceId}/{uuid.uuid4().hex}.{DEFAULT_AUDIO_FORMAT}"
        r2.upload_file(str(combined_path), audio_id)

        mime = "audio/mpeg" if DEFAULT_AUDIO_FORMAT == "mp3" else "audio/wav"
        return SynthesisCompleteEvent(
            audioId=audio_id,
            audioKey=audio_id,
            duration=round(duration, 3),
            sampleRate=sample_rate,
            synthesisTime=synthesis_time,
            sentenceCount=total,
            format=DEFAULT_AUDIO_FORMAT,  # type: ignore[arg-type]
            mimeType=mime,
            fileSize=file_size,
        ).model_dump()
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)


def _handle_transcribe(req: TranscribeInput) -> dict[str, Any]:
    job_dir = TEMP_DIR / f"transcribe-{uuid.uuid4().hex}"
    job_dir.mkdir(parents=True, exist_ok=True)
    try:
        audio_path = job_dir / req.filename
        if req.audioBase64:
            audio_path.write_bytes(base64.b64decode(req.audioBase64))
        elif req.audioUrl:
            _download_url(req.audioUrl, audio_path)
        else:
            raise ValueError("Either audioBase64 or audioUrl is required")
        transcript = _transcribe(audio_path)
        return TranscribeResult(transcript=transcript).model_dump()
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)


def _handle_download_audio(req: DownloadAudioInput) -> dict[str, Any]:
    r2 = R2Client()
    audio_bytes = r2.download_file_bytes(req.audioId)
    mime = "audio/mpeg" if req.audioId.endswith(".mp3") else "audio/wav"
    return DownloadAudioResult(
        audioBase64=base64.b64encode(audio_bytes).decode(),
        mimeType=mime,
    ).model_dump()


# ── legacy single-synthesis handler (backward compat) ────────────────────────

def _handle_legacy(payload: dict[str, Any]) -> dict[str, Any]:
    start = time.time()
    job_id = payload.get("jobId", "unknown")

    try:
        req = RunPodTTSInput.model_validate(payload)
    except ValidationError as exc:
        return RunPodResult(
            jobId=job_id,
            status="failed",
            error=f"Invalid payload: {exc}",
            durationMs=int((time.time() - start) * 1000),
        ).model_dump()

    job_dir = TEMP_DIR / req.jobId
    job_dir.mkdir(parents=True, exist_ok=True)
    output_path = job_dir / f"output.{DEFAULT_AUDIO_FORMAT}"
    reference_path = None

    try:
        if req.referenceAudioUrl:
            reference_path = job_dir / "reference.audio"
            logger.info("Downloading reference audio for %s", req.jobId)
            _download_url(req.referenceAudioUrl, reference_path)

        generate_tts_audio(
            text=req.text,
            output_path=str(output_path),
            reference_audio_path=str(reference_path) if reference_path else None,
            reference_text=req.referenceText,
        )

        r2 = R2Client()
        r2.upload_file(str(output_path), req.outputKey)

        result = RunPodResult(
            jobId=req.jobId,
            status="completed",
            outputKey=req.outputKey,
            durationMs=int((time.time() - start) * 1000),
        ).model_dump()

        if req.callbackUrl:
            warning = post_callback(req.callbackUrl, result)
            if warning:
                result["warning"] = f"Callback failed: {warning}"

        return result
    except Exception as exc:
        return RunPodResult(
            jobId=req.jobId,
            status="failed",
            error=str(exc),
            durationMs=int((time.time() - start) * 1000),
        ).model_dump()
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)


# ── main dispatcher ───────────────────────────────────────────────────────────

def handler(event: dict[str, Any]) -> dict[str, Any]:
    ensure_runtime_dirs()
    payload = (event or {}).get("input", {})
    action = payload.get("action")

    try:
        if action == "upload_reference":
            req = UploadReferenceInput.model_validate(payload)
            return _handle_upload_reference(req)

        if action == "synthesize_batch":
            req = SynthesizeBatchInput.model_validate(payload)
            return _handle_synthesize_batch(req)

        if action == "transcribe":
            req = TranscribeInput.model_validate(payload)
            return _handle_transcribe(req)

        if action == "download_audio":
            req = DownloadAudioInput.model_validate(payload)
            return _handle_download_audio(req)

        # No action field — route to legacy single-synthesis handler
        return _handle_legacy(payload)

    except ValidationError as exc:
        return {"status": "failed", "error": f"Invalid input for action '{action}': {exc}"}
    except Exception as exc:
        logger.exception("Unhandled error in action '%s'", action)
        return {"status": "failed", "error": str(exc)}


if __name__ == "__main__":
    # Pre-warm: load and initialise the model so library incompatibilities surface
    # immediately rather than failing silently on the first real job.
    # generate_voice_clone requires a reference audio, so we just force model load here.
    if not TTS_STUB_MODE:
        logger.info("Pre-warming TTS model (loading weights)...")
        from app.runpod_tts_service import _get_model
        try:
            _get_model()
            logger.info("TTS pre-warm complete — model loaded and verified.")
        except Exception as exc:
            logger.error(
                "TTS pre-warm FAILED: %s\n"
                "Worker will still start but the first job will likely fail with the same error. "
                "Check transformers version compatibility with qwen_tts.",
                exc,
            )

    runpod.serverless.start({"handler": handler})
