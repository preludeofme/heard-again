import json
import logging
import os
import time
import uuid
from pathlib import Path
from typing import Optional

import numpy as np
import soundfile as sf
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from app.config import (
    ALLOWED_AUDIO_EXTENSIONS,
    GENERATED_AUDIO_DIR,
    HOST,
    PORT,
    REFERENCE_AUDIO_DIR,
    VOICE_PROFILES_DIR,
)
from app.model_manager import model_manager
from app.transcriber import transcribe_audio

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Heard Again — Qwen3-TTS Service",
    description="Voice cloning and TTS backend powered by Qwen3-TTS",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Startup / shutdown
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup():
    logger.info("Starting TTS service…")
    try:
        model_manager.load_model()
    except Exception as e:
        logger.error(f"Model failed to load on startup: {e}")
        logger.info("Service will start without model — use /api/tts/load-model to retry.")


@app.on_event("shutdown")
async def shutdown():
    model_manager.unload_model()


# ---------------------------------------------------------------------------
# Health & info
# ---------------------------------------------------------------------------

@app.get("/api/tts/health")
async def health_check():
    return {
        "status": "ok",
        "model_loaded": model_manager.is_loaded,
        "model_name": model_manager.model_name,
        "gpu": model_manager.get_gpu_info(),
    }


@app.post("/api/tts/load-model")
async def load_model():
    """Manually trigger model loading (useful if startup load failed)."""
    try:
        model_manager.load_model()
        return {"success": True, "message": "Model loaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Reference audio upload
# ---------------------------------------------------------------------------

@app.post("/api/tts/upload-reference")
async def upload_reference(audio: UploadFile = File(...)):
    """Upload a reference audio file for voice cloning."""
    ext = Path(audio.filename or "").suffix.lower()
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{ext}'. Allowed: {ALLOWED_AUDIO_EXTENSIONS}",
        )

    file_id = str(uuid.uuid4())
    save_path = REFERENCE_AUDIO_DIR / f"{file_id}{ext}"

    content = await audio.read()
    save_path.write_bytes(content)

    # Get audio duration
    try:
        info = sf.info(str(save_path))
        duration = info.duration
    except Exception:
        duration = 0

    logger.info(f"Reference audio uploaded: {save_path} ({duration:.1f}s)")

    # Auto-transcribe the reference audio using Whisper
    transcript = ""
    try:
        transcript = transcribe_audio(str(save_path))
        logger.info(f"Auto-transcription result: {transcript[:120]}...")
    except Exception as e:
        logger.error(f"Auto-transcription failed (non-fatal): {e}")

    # Save metadata (transcript + duration) as a JSON sidecar
    meta_path = REFERENCE_AUDIO_DIR / f"{file_id}.json"
    meta_path.write_text(json.dumps({
        "fileId": file_id,
        "fileName": audio.filename,
        "duration": duration,
        "transcript": transcript,
    }))

    return {
        "success": True,
        "fileId": file_id,
        "fileName": audio.filename,
        "filePath": str(save_path),
        "duration": duration,
        "transcript": transcript,
    }


# ---------------------------------------------------------------------------
# Voice profile management
# ---------------------------------------------------------------------------

class CreateProfileRequest(BaseModel):
    fileId: str
    refText: Optional[str] = None
    profileName: str


@app.post("/api/tts/create-voice-profile")
async def create_voice_profile(req: CreateProfileRequest):
    """Create a reusable .pt voice profile from uploaded reference audio."""
    if not model_manager.is_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # Find the reference audio file (exclude .json sidecar)
    ref_files = [f for f in REFERENCE_AUDIO_DIR.glob(f"{req.fileId}.*") if f.suffix != ".json"]
    if not ref_files:
        raise HTTPException(status_code=404, detail="Reference audio not found")

    ref_path = str(ref_files[0])

    # Load stored transcript if refText not provided
    if not req.refText:
        meta_path = REFERENCE_AUDIO_DIR / f"{req.fileId}.json"
        if meta_path.exists():
            meta = json.loads(meta_path.read_text())
            req.refText = meta.get("transcript", None)
            logger.info(f"Using stored transcript: {(req.refText or '')[:80]}...")

    if not req.refText:
        raise HTTPException(
            status_code=400,
            detail="No transcript available. Please re-upload the reference audio or provide refText manually.",
        )

    # Sanitize profile name for filesystem
    safe_name = "".join(c if c.isalnum() or c in "-_ " else "" for c in req.profileName)
    safe_name = safe_name.strip().replace(" ", "_") or req.fileId

    try:
        start = time.time()
        profile_path = model_manager.create_voice_profile(
            ref_audio_path=ref_path,
            ref_text=req.refText,
            profile_name=safe_name,
        )
        elapsed = time.time() - start

        return {
            "success": True,
            "profileId": safe_name,
            "profilePath": str(profile_path),
            "processingTime": round(elapsed, 2),
        }
    except Exception as e:
        logger.error(f"Voice profile creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tts/voice-profiles")
async def list_voice_profiles():
    """List all saved voice profiles."""
    profiles = []
    for pt_file in sorted(VOICE_PROFILES_DIR.glob("*.pt")):
        stat = pt_file.stat()
        profiles.append({
            "id": pt_file.stem,
            "name": pt_file.stem.replace("_", " ").title(),
            "fileName": pt_file.name,
            "filePath": str(pt_file),
            "sizeBytes": stat.st_size,
            "createdAt": stat.st_mtime,
        })

    return {"success": True, "profiles": profiles}


@app.delete("/api/tts/voice-profiles/{profile_id}")
async def delete_voice_profile(profile_id: str):
    """Delete a voice profile."""
    profile_path = VOICE_PROFILES_DIR / f"{profile_id}.pt"
    if not profile_path.exists():
        raise HTTPException(status_code=404, detail="Voice profile not found")

    profile_path.unlink()
    return {"success": True, "message": f"Profile '{profile_id}' deleted"}


# ---------------------------------------------------------------------------
# Speech synthesis
# ---------------------------------------------------------------------------

class SynthesizeRequest(BaseModel):
    profileId: str
    text: str
    language: str = "English"


@app.post("/api/tts/synthesize")
async def synthesize_speech(req: SynthesizeRequest):
    """Generate speech from text using a saved voice profile."""
    if not model_manager.is_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded")

    profile_path = VOICE_PROFILES_DIR / f"{req.profileId}.pt"
    if not profile_path.exists():
        raise HTTPException(status_code=404, detail="Voice profile not found")

    try:
        start = time.time()
        audio_data, sr = model_manager.synthesize_from_profile(
            profile_path=str(profile_path),
            text=req.text,
            language=req.language,
        )
        elapsed = time.time() - start

        # Save generated audio
        output_id = str(uuid.uuid4())
        output_path = GENERATED_AUDIO_DIR / f"{output_id}.wav"
        sf.write(str(output_path), audio_data, sr)

        duration = len(audio_data) / sr

        logger.info(
            f"Synthesized {duration:.1f}s audio in {elapsed:.1f}s "
            f"(profile={req.profileId})"
        )

        return {
            "success": True,
            "audioId": output_id,
            "audioUrl": f"/api/tts/audio/{output_id}",
            "duration": round(duration, 2),
            "sampleRate": sr,
            "synthesisTime": round(elapsed, 2),
        }
    except Exception as e:
        logger.error(f"Synthesis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class SynthesizeDirectRequest(BaseModel):
    fileId: str
    refText: Optional[str] = None
    text: str
    language: str = "English"


@app.post("/api/tts/synthesize-direct")
async def synthesize_direct(req: SynthesizeDirectRequest):
    """Generate speech directly from reference audio (no saved profile)."""
    if not model_manager.is_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded")

    ref_files = [f for f in REFERENCE_AUDIO_DIR.glob(f"{req.fileId}.*") if f.suffix != ".json"]
    if not ref_files:
        raise HTTPException(status_code=404, detail="Reference audio not found")

    # Load stored transcript if refText not provided
    if not req.refText:
        meta_path = REFERENCE_AUDIO_DIR / f"{req.fileId}.json"
        if meta_path.exists():
            meta = json.loads(meta_path.read_text())
            req.refText = meta.get("transcript", None)

    try:
        start = time.time()
        audio_data, sr = model_manager.synthesize_from_reference(
            ref_audio_path=str(ref_files[0]),
            ref_text=req.refText,
            text=req.text,
            language=req.language,
        )
        elapsed = time.time() - start

        output_id = str(uuid.uuid4())
        output_path = GENERATED_AUDIO_DIR / f"{output_id}.wav"
        sf.write(str(output_path), audio_data, sr)

        duration = len(audio_data) / sr

        return {
            "success": True,
            "audioId": output_id,
            "audioUrl": f"/api/tts/audio/{output_id}",
            "duration": round(duration, 2),
            "sampleRate": sr,
            "synthesisTime": round(elapsed, 2),
        }
    except Exception as e:
        logger.error(f"Direct synthesis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Audio serving
# ---------------------------------------------------------------------------

@app.get("/api/tts/audio/{audio_id}")
async def serve_audio(audio_id: str):
    """Serve a generated audio file."""
    audio_path = GENERATED_AUDIO_DIR / f"{audio_id}.wav"
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")

    return FileResponse(
        str(audio_path),
        media_type="audio/wav",
        headers={"Content-Disposition": f'inline; filename="{audio_id}.wav"'},
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=False)
