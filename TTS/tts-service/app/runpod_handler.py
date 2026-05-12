import json
import logging
import shutil
import time
from pathlib import Path

import requests
import runpod
from pydantic import ValidationError

from app.runpod_callback_client import post_callback
from app.runpod_config import DEFAULT_AUDIO_FORMAT, TEMP_DIR, ensure_runtime_dirs
from app.runpod_r2_client import R2Client
from app.runpod_schemas import RunPodResult, RunPodTTSInput
from app.runpod_tts_service import generate_tts_audio

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _download_reference(url: str, target_path: Path) -> None:
    with requests.get(url, timeout=60, stream=True) as r:
        r.raise_for_status()
        with target_path.open("wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)


def handler(event):
    start = time.time()
    ensure_runtime_dirs()
    payload = (event or {}).get("input", {})
    job_id = payload.get("jobId", "unknown")

    try:
        req = RunPodTTSInput.model_validate(payload)
    except ValidationError as exc:
        return RunPodResult(jobId=job_id, status="failed", error=f"Invalid payload: {exc}", durationMs=int((time.time()-start)*1000)).model_dump()

    job_dir = TEMP_DIR / req.jobId
    job_dir.mkdir(parents=True, exist_ok=True)
    output_path = job_dir / f"output.{DEFAULT_AUDIO_FORMAT}"
    reference_path = None

    callback_warning = None
    try:
        if req.referenceAudioUrl:
            reference_path = job_dir / "reference.audio"
            logger.info("Downloading reference audio for %s", req.jobId)
            _download_reference(req.referenceAudioUrl, reference_path)

        generate_tts_audio(
            text=req.text,
            output_path=str(output_path),
            reference_audio_path=str(reference_path) if reference_path else None,
            reference_text=req.referenceText,
        )

        logger.info("Uploading output to R2 key=%s", req.outputKey)
        r2 = R2Client()
        r2.upload_file(str(output_path), req.outputKey)

        result = RunPodResult(
            jobId=req.jobId,
            status="completed",
            outputKey=req.outputKey,
            durationMs=int((time.time()-start)*1000),
        ).model_dump()

        if req.callbackUrl:
            callback_warning = post_callback(req.callbackUrl, result)
            if callback_warning:
                result["warning"] = f"Callback failed: {callback_warning}"

        return result
    except Exception as exc:
        return RunPodResult(jobId=req.jobId, status="failed", error=str(exc), durationMs=int((time.time()-start)*1000)).model_dump()
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
