import json
import logging
import os
import time
import uuid
from pathlib import Path
from typing import Optional, Annotated

import numpy as np
import soundfile as sf
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
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
from app.style_presets import resolve_style_params, list_presets
from app.auth import validate_token, require_workspace_role, validate_tenant_access, log_auth_event
from app.rate_limiter import RateLimitMiddleware
from app.validators import (
    ValidatedCreateProfileRequest,
    ValidatedSynthesizeRequest,
    ValidatedDesignVoiceRequest,
    ValidatedBlendVoiceRequest,
    ValidationError,
    validate_audio_file_size,
    validate_audio_file_extension
)
from app.text_chunker import chunk_text
from app.audio_encoder import encode_pcm_to_mp3, check_ffmpeg_available

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Constants for error messages to avoid duplication
MODEL_NOT_LOADED_ERROR = "Model not loaded"
VOICE_DESIGN_MODEL_NOT_LOADED_ERROR = "VoiceDesign model not loaded"
BASE_MODEL_NOT_LOADED_ERROR = "Base model not loaded"
REFERENCE_AUDIO_NOT_FOUND_ERROR = "Reference audio not found"
JSON_EXTENSION = ".json"

app = FastAPI(
    title="Heard Again — Qwen3-TTS Service",
    description="Voice cloning and TTS backend powered by Qwen3-TTS",
    version="1.0.0",
)

import os

# Environment-based CORS configuration with runtime validation
def get_allowed_origins() -> list[str]:
    """Get allowed origins based on environment with validation."""
    environment = os.getenv('ENVIRONMENT', 'development')
    
    if environment == 'production':
        allowed = os.getenv('ALLOWED_ORIGINS', '')
        if not allowed:
            raise RuntimeError("ALLOWED_ORIGINS must be set in production")
        
        origins = allowed.split(',')
        
        # ✅ Validate origin format
        for origin in origins:
            origin = origin.strip()
            if not origin.startswith(('http://', 'https://')):
                raise ValueError(f"Invalid origin format: {origin}. Must start with http:// or https://")
            
            # Basic URL structure validation
            if len(origin) < 11:  # Shortest valid URL: https://a.b
                raise ValueError(f"Invalid origin length: {origin}")
        
        return [origin.strip() for origin in origins]
    
    elif environment == 'staging':
        # Staging: allow staging domain with validation
        staging_url = os.getenv('STAGING_URL', 'https://staging.heardagain.com')
        if not staging_url.startswith(('http://', 'https://')):
            raise ValueError(f"Invalid staging URL format: {staging_url}")
        return [staging_url]
    
    else:
        # Development: allow localhost with validation
        dev_origins = [
            "http://localhost:4777",
            "http://localhost:3000", 
            "https://localhost:4777",
            "https://localhost:3000"
        ]
        
        # Log development mode warning
        logger.warning(
            "CORS in development mode - allowing localhost origins only. "
            "Do not use this configuration in production."
        )
        
        return dev_origins

# Add rate limiting middleware
app.add_middleware(
    RateLimitMiddleware,
    limits={
        'default': {'limit': 300, 'window': 900}
    }
)

# Add CORS middleware last (S8414)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["POST", "GET", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
    expose_headers=["X-Request-ID"],
    max_age=600,
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
        logger.error(f"Base model failed to load on startup: {e}")
        logger.info("Service will start without base model — use /api/tts/load-model to retry.")

    try:
        model_manager.load_design_model()
    except Exception as e:
        logger.error(f"Design model failed to load on startup: {e}")
        logger.info("Voice design will be unavailable — use /api/tts/load-design-model to retry.")


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
        "timestamp": time.time(),
        "version": "1.0.0"
    }


@app.get("/api/tts/health/detailed")
async def detailed_health_check():
    """Detailed health check with sensitive information - requires authentication"""
    # This endpoint could be protected with auth if needed in the future
    return {
        "status": "ok",
        "base_model_loaded": model_manager.base_loaded,
        "base_model_name": model_manager.base_model_name,
        "design_model_loaded": model_manager.design_loaded,
        "design_model_name": model_manager.design_model_name,
        "gpu": model_manager.get_gpu_info(),
    }


@app.post("/api/tts/load-model")
async def load_model():
    """Manually trigger base model loading."""
    try:
        model_manager.load_model()
        return {"success": True, "message": "Base model loaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tts/load-design-model")
async def load_design_model():
    """Manually trigger VoiceDesign model loading."""
    try:
        model_manager.load_design_model()
        return {"success": True, "message": "VoiceDesign model loaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Reference audio upload
# ---------------------------------------------------------------------------

@app.post("/api/tts/upload-reference")
async def upload_reference(
    auth_data: Annotated[dict, Depends(require_workspace_role)],
    audio: UploadFile = File(...),
):
    """Upload a reference audio file for voice cloning."""
    user_context = get_user_context(auth_data)
    
    logger.info(f"Reference audio upload started", extra={'user_context': user_context})
    
    try:
        ext = Path(audio.filename or "").suffix.lower()
        if ext not in ALLOWED_AUDIO_EXTENSIONS:
            await log_auth_event('INVALID_FILE_TYPE', auth_data, {'extension': ext})
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported format '{ext}'. Allowed: {ALLOWED_AUDIO_EXTENSIONS}",
            )

        # Validate file size (prevent resource exhaustion)
        content = await audio.read()
        max_size = 50 * 1024 * 1024  # 50MB limit
        if len(content) > max_size:
            await log_auth_event('FILE_TOO_LARGE', auth_data, {'size': len(content)})
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size is {max_size // (1024*1024)}MB"
            )

        file_id = str(uuid.uuid4())
        # Organize files by workspace for tenant isolation
        workspace_dir = REFERENCE_AUDIO_DIR / auth_data['workspace_id']
        workspace_dir.mkdir(exist_ok=True)
        save_path = workspace_dir / f"{file_id}{ext}"

        save_path.write_bytes(content)

        # Get audio duration
        try:
            info = sf.info(str(save_path))
            duration = info.duration
        except Exception:
            duration = 0

        logger.info(f"Reference audio uploaded: {save_path} ({duration:.1f}s)", extra={'user_context': user_context})

        # Auto-transcribe the reference audio using Whisper
        transcript = ""
        try:
            transcript = transcribe_audio(str(save_path))
            logger.info(f"Auto-transcription result: {transcript[:120]}...", extra={'user_context': user_context})
        except Exception as e:
            logger.error(f"Auto-transcription failed (non-fatal): {e}", extra={'user_context': user_context})

        # Save metadata (transcript + duration) as a JSON sidecar
        meta_path = workspace_dir / f"{file_id}{JSON_EXTENSION}"
        metadata = {
            "fileId": file_id,
            "fileName": audio.filename,
            "duration": duration,
            "transcript": transcript,
            "workspaceId": auth_data['workspace_id'],
            "uploadedBy": auth_data['user_id']
        }
        meta_path.write_text(json.dumps(metadata))

        await log_auth_event('REFERENCE_UPLOADED', auth_data, {
            'fileId': file_id,
            'fileName': audio.filename,
            'duration': duration
        })

        return {
            "success": True,
            "fileId": file_id,
            "fileName": audio.filename,
            "filePath": str(save_path),
            "duration": duration,
            "transcript": transcript,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await log_auth_event('UPLOAD_ERROR', auth_data, {'error': str(e)})
        logger.error(f"Reference audio upload failed: {e}", extra={'user_context': user_context})
        raise HTTPException(status_code=500, detail="Upload failed")

def get_user_context(auth_data: dict) -> dict:
    """Extract user context for logging"""
    return {
        'user_id': auth_data['user_id'],
        'workspace_id': auth_data['workspace_id'],
        'email': auth_data.get('email', 'unknown')
    }


# ---------------------------------------------------------------------------
# Voice profile management
# ---------------------------------------------------------------------------

class CreateProfileRequest(BaseModel):
    fileId: str
    refText: Optional[str] = None
    profileName: str
    styleInstruct: Optional[str] = None


@app.post("/api/tts/create-voice-profile")
async def create_voice_profile(
    auth_data: Annotated[dict, Depends(require_workspace_role)],
    req: ValidatedCreateProfileRequest,
):
    """Create a reusable .pt voice profile from uploaded reference audio."""
    user_context = get_user_context(auth_data)
    
    if not model_manager.is_loaded:
        raise HTTPException(status_code=503, detail=MODEL_NOT_LOADED_ERROR)

    # Find the reference audio file in user's workspace directory
    workspace_dir = REFERENCE_AUDIO_DIR / auth_data['workspace_id']
    ref_files = [f for f in workspace_dir.glob(f"{req.fileId}.*") if f.suffix != JSON_EXTENSION]
    if not ref_files:
        await log_auth_event('REFERENCE_NOT_FOUND', auth_data, {'fileId': req.fileId})
        raise HTTPException(status_code=404, detail=REFERENCE_AUDIO_NOT_FOUND_ERROR)

    ref_path = str(ref_files[0])

    # Validate tenant access to the reference file
    try:
        meta_path = workspace_dir / f"{req.fileId}{JSON_EXTENSION}"
        if meta_path.exists():
            meta = json.loads(meta_path.read_text())
            validate_tenant_access(auth_data, meta.get('workspaceId', ''))
    except Exception as e:
        await log_auth_event('TENANT_VIOLATION_ATTEMPT', auth_data, {'fileId': req.fileId})
        raise HTTPException(status_code=403, detail="Access denied")

    # Load stored transcript if refText not provided
    if not req.refText:
        meta_path = workspace_dir / f"{req.fileId}{JSON_EXTENSION}"
        if meta_path.exists():
            meta = json.loads(meta_path.read_text())
            req.refText = meta.get("transcript", None)
            logger.info(f"Using stored transcript: {(req.refText or '')[:80]}...", extra={'user_context': user_context})

    if not req.refText:
        raise HTTPException(
            status_code=400,
            detail="No transcript available. Please re-upload the reference audio or provide refText manually.",
        )

    # Sanitize profile name for filesystem
    safe_name = "".join(c if c.isalnum() or c in "-_ " else "" for c in req.profileName)
    safe_name = safe_name.strip().replace(" ", "_") or req.fileId

    # Resolve style params from natural language description
    style_params = resolve_style_params(instruct=req.styleInstruct) if req.styleInstruct else {}

    try:
        start = time.time()
        profile_path = model_manager.create_voice_profile(
            ref_audio_path=ref_path,
            ref_text=req.refText,
            profile_name=safe_name,
        )
        elapsed = time.time() - start

        # Organize voice profiles by workspace for tenant isolation
        workspace_profiles_dir = VOICE_PROFILES_DIR / auth_data['workspace_id']
        workspace_profiles_dir.mkdir(exist_ok=True)
        
        # Move profile to workspace directory
        workspace_profile_path = workspace_profiles_dir / f"{safe_name}.pt"
        if profile_path != workspace_profile_path:
            profile_path.rename(workspace_profile_path)
            profile_path = workspace_profile_path

        # Save style metadata alongside the profile
        if req.styleInstruct or style_params:
            meta_path = workspace_profiles_dir / f"{safe_name}{JSON_EXTENSION}"
            metadata = {
                "profileId": safe_name,
                "styleInstruct": req.styleInstruct or "",
                "styleParams": style_params,
                "workspaceId": auth_data['workspace_id'],
                "createdBy": auth_data['user_id'],
                "fileId": req.fileId
            }
            meta_path.write_text(json.dumps(metadata))
            logger.info(f"Saved style metadata: {meta_path}", extra={'user_context': user_context})

        await log_auth_event('VOICE_PROFILE_CREATED', auth_data, {
            'profileId': safe_name,
            'profileName': req.profileName,
            'processingTime': round(elapsed, 2)
        })

        return {
            "success": True,
            "profileId": safe_name,
            "profilePath": str(profile_path),
            "processingTime": round(elapsed, 2),
            "styleInstruct": req.styleInstruct,
            "styleParams": style_params,
        }
    except Exception as e:
        await log_auth_event('VOICE_PROFILE_ERROR', auth_data, {'error': str(e)})
        logger.error(f"Voice profile creation failed: {e}", extra={'user_context': user_context})
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tts/voice-profiles")
async def list_voice_profiles(auth_data: Annotated[dict, Depends(require_workspace_role)]):
    """List all saved voice profiles for the authenticated user's workspace."""
    user_context = get_user_context(auth_data)
    
    profiles = []
    workspace_profiles_dir = VOICE_PROFILES_DIR / auth_data['workspace_id']
    
    # Only list profiles from the user's workspace
    for pt_file in sorted(workspace_profiles_dir.glob("*.pt")):
        stat = pt_file.stat()
        
        # Load metadata for additional info
        meta_path = workspace_profiles_dir / f"{pt_file.stem}{JSON_EXTENSION}"
        metadata = {}
        if meta_path.exists():
            try:
                metadata = json.loads(meta_path.read_text())
            except Exception:
                pass
        
        profiles.append({
            "id": pt_file.stem,
            "name": pt_file.stem.replace("_", " ").title(),
            "fileName": pt_file.name,
            "filePath": str(pt_file),
            "sizeBytes": stat.st_size,
            "createdAt": stat.st_mtime,
            "createdBy": metadata.get("createdBy"),
            "workspaceId": auth_data['workspace_id'],
            "styleInstruct": metadata.get("styleInstruct"),
        })

    await log_auth_event('VOICE_PROFILES_LISTED', auth_data, {'count': len(profiles)})
    
    return {"success": True, "profiles": profiles}


@app.delete("/api/tts/voice-profiles/{profile_id}")
async def delete_voice_profile(
    auth_data: Annotated[dict, Depends(require_workspace_role)],
    profile_id: str,
):
    """Delete a voice profile."""
    user_context = get_user_context(auth_data)
    
    # Check profile in user's workspace directory
    workspace_profiles_dir = VOICE_PROFILES_DIR / auth_data['workspace_id']
    profile_path = workspace_profiles_dir / f"{profile_id}.pt"
    
    if not profile_path.exists():
        await log_auth_event('PROFILE_DELETE_NOT_FOUND', auth_data, {'profileId': profile_id})
        raise HTTPException(status_code=404, detail="Voice profile not found")

    # Verify tenant access
    meta_path = workspace_profiles_dir / f"{profile_id}{JSON_EXTENSION}"
    if meta_path.exists():
        try:
            metadata = json.loads(meta_path.read_text())
            validate_tenant_access(auth_data, metadata.get('workspaceId', ''))
        except Exception as e:
            await log_auth_event('TENANT_VIOLATION_ATTEMPT', auth_data, {'profileId': profile_id})
            raise HTTPException(status_code=403, detail="Access denied")

    try:
        profile_path.unlink()
        # Also delete metadata if exists
        if meta_path.exists():
            meta_path.unlink()
            
        await log_auth_event('VOICE_PROFILE_DELETED', auth_data, {'profileId': profile_id})
        return {"success": True, "message": f"Profile '{profile_id}' deleted"}
    except Exception as e:
        await log_auth_event('PROFILE_DELETE_ERROR', auth_data, {'profileId': profile_id, 'error': str(e)})
        logger.error(f"Failed to delete voice profile: {e}", extra={'user_context': user_context})
        raise HTTPException(status_code=500, detail="Failed to delete profile")


# ---------------------------------------------------------------------------
# Voice Design (natural language → voice)
# ---------------------------------------------------------------------------

class DesignVoiceRequest(BaseModel):
    text: str
    instruct: str
    language: str = "English"


@app.post("/api/tts/design-voice")
async def design_voice(
    auth_data: Annotated[dict, Depends(require_workspace_role)],
    req: DesignVoiceRequest,
):
    """Generate speech with a designed voice from a natural-language description."""
    user_context = get_user_context(auth_data)
    
    if not model_manager.design_loaded:
        raise HTTPException(status_code=503, detail=VOICE_DESIGN_MODEL_NOT_LOADED_ERROR)

    # Ensure workspace-specific output directory exists
    workspace_output_dir = GENERATED_AUDIO_DIR / auth_data['workspace_id']
    workspace_output_dir.mkdir(parents=True, exist_ok=True)

    try:
        start = time.time()
        
        # Log design operation start
        await log_auth_event('DESIGN_VOICE_START', auth_data, {
            'text': req.text[:100],  # Truncate for logging
            'instruct': req.instruct,
            'language': req.language
        })
        
        audio_data, sr = model_manager.design_voice(
            text=req.text,
            instruct=req.instruct,
            language=req.language,
            workspace_id=auth_data['workspace_id']  # Pass workspace for scoping
        )
        elapsed = time.time() - start

        output_id = str(uuid.uuid4())
        output_path = workspace_output_dir / f"{output_id}.wav"
        sf.write(str(output_path), audio_data, sr)

        duration = len(audio_data) / sr
        
        # Log successful design operation
        await log_auth_event('DESIGN_VOICE_SUCCESS', auth_data, {
            'audioId': output_id,
            'duration': duration,
            'synthesisTime': elapsed
        })

        return {
            "success": True,
            "audioId": output_id,
            "audioUrl": f"/api/tts/audio/{output_id}",
            "duration": round(duration, 2),
            "sampleRate": sr,
            "synthesisTime": round(elapsed, 2),
        }
    except Exception as e:
        logger.error(f"Voice design failed: {e}")
        # Log design operation failure
        await log_auth_event('DESIGN_VOICE_ERROR', auth_data, {
            'text': req.text[:100],  # Truncate for logging
            'instruct': req.instruct,
            'error': str(e)
        })
        raise HTTPException(status_code=500, detail=str(e))


class DesignAndCloneRequest(BaseModel):
    refText: str
    instruct: str
    profileName: str
    language: str = "English"


@app.post("/api/tts/design-and-clone")
async def design_and_clone(
    auth_data: Annotated[dict, Depends(require_workspace_role)],
    req: DesignAndCloneRequest,
):
    """
    Hybrid workflow: Design a voice with natural language → create a reusable clone profile.

    This combines VoiceDesign + Base model to produce a .pt profile that captures
    the designed voice characteristics for consistent future synthesis.
    """
    user_context = get_user_context(auth_data)
    
    if not model_manager.design_loaded:
        raise HTTPException(status_code=503, detail=VOICE_DESIGN_MODEL_NOT_LOADED_ERROR)
    if not model_manager.base_loaded:
        raise HTTPException(status_code=503, detail=BASE_MODEL_NOT_LOADED_ERROR)

    # Ensure workspace-specific output directory exists
    workspace_output_dir = GENERATED_AUDIO_DIR / auth_data['workspace_id']
    workspace_output_dir.mkdir(parents=True, exist_ok=True)

    safe_name = "".join(c if c.isalnum() or c in "-_ " else "" for c in req.profileName)
    safe_name = safe_name.strip().replace(" ", "_") or f"designed_{uuid.uuid4().hex[:8]}"

    try:
        start = time.time()
        
        # Log design-and-clone operation start
        await log_auth_event('DESIGN_AND_CLONE_START', auth_data, {
            'profileName': safe_name,
            'refText': req.refText[:100],  # Truncate for logging
            'instruct': req.instruct,
            'language': req.language
        })
        
        profile_path, design_audio_path = model_manager.design_and_clone_profile(
            ref_text=req.refText,
            instruct=req.instruct,
            profile_name=safe_name,
            language=req.language,
            workspace_id=auth_data['workspace_id']  # Pass workspace for scoping
        )
        elapsed = time.time() - start

        # Get the design audio ID for preview
        design_audio_id = Path(design_audio_path).stem.replace("design_", "")
        
        # Log successful design-and-clone operation
        await log_auth_event('DESIGN_AND_CLONE_SUCCESS', auth_data, {
            'profileId': safe_name,
            'processingTime': elapsed
        })

        return {
            "success": True,
            "profileId": safe_name,
            "profilePath": str(profile_path),
            "designAudioUrl": f"/api/tts/audio/design_{design_audio_id}",
            "processingTime": round(elapsed, 2),
            "instruct": req.instruct,
        }
    except Exception as e:
        logger.error(f"Design-and-clone failed: {e}")
        # Log design-and-clone operation failure
        await log_auth_event('DESIGN_AND_CLONE_ERROR', auth_data, {
            'profileName': safe_name,
            'refText': req.refText[:100],  # Truncate for logging
            'instruct': req.instruct,
            'error': str(e)
        })
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Blended Voice (real person's identity + designed style)
# ---------------------------------------------------------------------------

class BlendVoiceRequest(BaseModel):
    fileId: str
    refText: Optional[str] = None
    instruct: str
    styleRefText: Optional[str] = None
    profileName: str
    language: str = "English"


@app.post("/api/tts/blend-voice")
async def blend_voice(
    auth_data: Annotated[dict, Depends(require_workspace_role)],
    req: BlendVoiceRequest,
):
    """
    Create a voice profile that blends a real person's voice with a designed style.

    Takes the speaker identity (timbre) from a real audio recording and combines
    it with the prosodic style (emotion, cadence, tone) from a VoiceDesign
    natural language description. The result is a profile that sounds like the
    real person speaking with the designed characteristics.
    """
    user_context = get_user_context(auth_data)
    
    if not model_manager.design_loaded:
        raise HTTPException(status_code=503, detail=VOICE_DESIGN_MODEL_NOT_LOADED_ERROR)
    if not model_manager.base_loaded:
        raise HTTPException(status_code=503, detail=BASE_MODEL_NOT_LOADED_ERROR)

    # Find the reference audio file in user's workspace (exclude .json sidecar)
    workspace_ref_dir = REFERENCE_AUDIO_DIR / auth_data['workspace_id']
    ref_files = [f for f in workspace_ref_dir.glob(f"{req.fileId}.*") if f.suffix != JSON_EXTENSION]
    if not ref_files:
        raise HTTPException(status_code=404, detail=REFERENCE_AUDIO_NOT_FOUND_ERROR)
    ref_path = str(ref_files[0])

    # Load stored transcript if not provided
    if not req.refText:
        meta_path = workspace_ref_dir / f"{req.fileId}{JSON_EXTENSION}"
        if meta_path.exists():
            meta = json.loads(meta_path.read_text())
            req.refText = meta.get("transcript", None)
            logger.info(f"Using stored transcript: {(req.refText or '')[:80]}...")

    if not req.refText:
        raise HTTPException(
            status_code=400,
            detail="No transcript available for the reference audio.",
        )

    # Default style reference text if not provided
    style_ref_text = req.styleRefText or "Hello, how are you doing today? It's really nice to see you again."

    safe_name = "".join(c if c.isalnum() or c in "-_ " else "" for c in req.profileName)
    safe_name = safe_name.strip().replace(" ", "_") or f"blended_{uuid.uuid4().hex[:8]}"

    # Ensure workspace-specific output directory exists
    workspace_output_dir = GENERATED_AUDIO_DIR / auth_data['workspace_id']
    workspace_output_dir.mkdir(parents=True, exist_ok=True)

    try:
        start = time.time()
        
        # Log blend operation start
        await log_auth_event('BLEND_VOICE_START', auth_data, {
            'fileId': req.fileId,
            'profileName': safe_name,
            'instruct': req.instruct
        })
        
        profile_path, design_audio_path = model_manager.blend_voice_profile(
            ref_audio_path=ref_path,
            ref_text=req.refText,
            instruct=req.instruct,
            style_ref_text=style_ref_text,
            profile_name=safe_name,
            language=req.language,
            workspace_id=auth_data['workspace_id']  # Pass workspace for scoping
        )
        elapsed = time.time() - start

        design_audio_id = Path(design_audio_path).stem.replace("design_", "")
        
        # Log successful blend operation
        await log_auth_event('BLEND_VOICE_SUCCESS', auth_data, {
            'profileId': safe_name,
            'processingTime': elapsed
        })

        return {
            "success": True,
            "profileId": safe_name,
            "profilePath": str(profile_path),
            "designAudioUrl": f"/api/tts/audio/design_{design_audio_id}",
            "processingTime": round(elapsed, 2),
            "instruct": req.instruct,
            "blendMode": True,
        }
    except Exception as e:
        logger.error(f"Blend-voice failed: {e}")
        # Log blend operation failure
        await log_auth_event('BLEND_VOICE_ERROR', auth_data, {
            'fileId': req.fileId,
            'profileName': safe_name,
            'error': str(e)
        })
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Speech synthesis
# ---------------------------------------------------------------------------

class SynthesizeRequest(BaseModel):
    profileId: str
    text: str
    language: str = "English"
    style: Optional[str] = None
    workspaceId: Optional[str] = None  # Explicit workspace override


@app.post("/api/tts/synthesize")
async def synthesize_speech(
    auth_data: Annotated[dict, Depends(require_workspace_role)],
    req: SynthesizeRequest,
):
    """Generate speech from text using a saved voice profile."""
    # DEBUG: Confirm we entered the function
    logger.info(f"DEBUG: ENTER synthesize_speech - auth_workspace={auth_data.get('workspace_id')}, req_workspace={req.workspaceId}, profile={req.profileId}")
    user_context = get_user_context(auth_data)
    
    if not model_manager.is_loaded:
        raise HTTPException(status_code=503, detail=MODEL_NOT_LOADED_ERROR)

    # Verify voice profile belongs to user's workspace
    # Use explicit workspaceId from request if provided, otherwise fall back to auth
    workspace_id = req.workspaceId or auth_data['workspace_id']
    workspace_profiles_dir = VOICE_PROFILES_DIR / workspace_id
    
    # Sanitize profileId to match how profiles are saved (spaces -> underscores)
    safe_profile_id = "".join(c if c.isalnum() or c in "-_ " else "" for c in req.profileId)
    safe_profile_id = safe_profile_id.strip().replace(" ", "_")
    
    profile_path = workspace_profiles_dir / f"{safe_profile_id}.pt"
    
    # DEBUG: Log what we're looking for
    logger.info(f"DEBUG: Looking for profile '{req.profileId}' in workspace '{workspace_id}'")
    logger.info(f"DEBUG: VOICE_PROFILES_DIR = {VOICE_PROFILES_DIR}")
    logger.info(f"DEBUG: Profile path = {profile_path}")
    logger.info(f"DEBUG: Profile path (absolute) = {profile_path.absolute()}")
    logger.info(f"DEBUG: Profile exists = {profile_path.exists()}")
    logger.info(f"DEBUG: Profile parent exists = {profile_path.parent.exists()}")
    logger.info(f"DEBUG: Workspace dir exists = {workspace_profiles_dir.exists()}")
    if workspace_profiles_dir.exists():
        files = list(workspace_profiles_dir.glob("*.pt"))
        logger.info(f"DEBUG: Files in workspace dir: {[f.name for f in files]}")
        for f in files:
            logger.info(f"DEBUG: File '{f.name}' at path: {f}")
    
    if not profile_path.exists():
        await log_auth_event('PROFILE_ACCESS_DENIED', auth_data, {
            'profileId': req.profileId,
            'requestedWorkspace': workspace_id,
            'authWorkspace': auth_data['workspace_id']
        })
        raise HTTPException(status_code=404, detail="Voice profile not found")

    # Resolve style params: explicit override > profile metadata > defaults
    gen_kwargs = {}
    if req.style:
        gen_kwargs = resolve_style_params(style=req.style)
    else:
        meta_path = workspace_profiles_dir / f"{safe_profile_id}{JSON_EXTENSION}"
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text())
                saved_params = meta.get("styleParams", {})
                if saved_params:
                    gen_kwargs = saved_params
                    logger.info(f"Using saved style for {req.profileId}: {meta.get('styleInstruct', '')}")
            except Exception:
                pass

    try:
        start = time.time()
        audio_data, sr = model_manager.synthesize_from_profile(
            profile_path=str(profile_path),
            text=req.text,
            language=req.language,
            gen_kwargs=gen_kwargs if gen_kwargs else None,
        )
        elapsed = time.time() - start

        # Save generated audio in workspace-scoped directory
        output_id = str(uuid.uuid4())
        workspace_audio_dir = GENERATED_AUDIO_DIR / auth_data['workspace_id']
        workspace_audio_dir.mkdir(exist_ok=True)
        output_path = workspace_audio_dir / f"{output_id}.wav"
        sf.write(str(output_path), audio_data, sr)

        duration = len(audio_data) / sr

        # Save metadata with workspace ownership
        meta_path = workspace_audio_dir / f"{output_id}{JSON_EXTENSION}"
        metadata = {
            "audioId": output_id,
            "workspaceId": workspace_id,
            "createdBy": auth_data['user_id'],
            "profileId": req.profileId,
            "duration": duration,
            "createdAt": time.time()
        }
        meta_path.write_text(json.dumps(metadata))

        logger.info(
            f"Synthesized {duration:.1f}s audio in {elapsed:.1f}s "
            f"(profile={req.profileId}, workspace={workspace_id})"
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


class SynthesizeStreamRequest(BaseModel):
    profileId: str
    text: str
    language: str = "English"
    style: Optional[str] = None
    workspaceId: Optional[str] = None


@app.post("/api/tts/synthesize-stream")
async def synthesize_speech_stream(
    auth_data: Annotated[dict, Depends(require_workspace_role)],
    req: SynthesizeStreamRequest,
):
    """Stream MP3 audio synthesized sentence-by-sentence.

    The model is not token-streaming, but we split the text into sentences and
    yield each as it finishes encoding. Time-to-first-byte is roughly one sentence's
    synthesis time.
    """
    if not model_manager.is_loaded:
        raise HTTPException(status_code=503, detail=MODEL_NOT_LOADED_ERROR)

    if check_ffmpeg_available() is None:
        raise HTTPException(
            status_code=503,
            detail="ffmpeg is required for streaming synthesis but is not available on the server",
        )

    workspace_id = req.workspaceId or auth_data['workspace_id']
    workspace_profiles_dir = VOICE_PROFILES_DIR / workspace_id

    safe_profile_id = "".join(c if c.isalnum() or c in "-_ " else "" for c in req.profileId)
    safe_profile_id = safe_profile_id.strip().replace(" ", "_")
    profile_path = workspace_profiles_dir / f"{safe_profile_id}.pt"

    if not profile_path.exists():
        await log_auth_event('PROFILE_ACCESS_DENIED', auth_data, {
            'profileId': req.profileId,
            'requestedWorkspace': workspace_id,
            'authWorkspace': auth_data['workspace_id'],
            'endpoint': 'synthesize-stream',
        })
        raise HTTPException(status_code=404, detail="Voice profile not found")

    # Resolve style params (explicit override > profile metadata).
    gen_kwargs: dict = {}
    if req.style:
        gen_kwargs = resolve_style_params(style=req.style)
    else:
        meta_path = workspace_profiles_dir / f"{safe_profile_id}{JSON_EXTENSION}"
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text())
                saved_params = meta.get("styleParams", {})
                if saved_params:
                    gen_kwargs = saved_params
            except Exception:
                pass

    sentences = chunk_text(req.text)
    if not sentences:
        raise HTTPException(status_code=400, detail="Text contains no speakable content")

    stream_id = str(uuid.uuid4())
    logger.info(
        f"[stream {stream_id}] starting: profile={req.profileId} workspace={workspace_id} "
        f"sentences={len(sentences)} chars={len(req.text)}"
    )

    def generator():
        total_start = time.time()
        sentences_rendered = 0
        try:
            for idx, sentence in enumerate(sentences):
                sentence_start = time.time()
                audio_data, sr = model_manager.synthesize_from_profile(
                    profile_path=str(profile_path),
                    text=sentence,
                    language=req.language,
                    gen_kwargs=gen_kwargs if gen_kwargs else None,
                )
                mp3 = encode_pcm_to_mp3(audio_data, sr)
                sentences_rendered += 1
                elapsed = time.time() - sentence_start
                logger.info(
                    f"[stream {stream_id}] sentence {idx+1}/{len(sentences)} "
                    f"synth+encode {elapsed:.2f}s bytes={len(mp3)}"
                )
                yield mp3
        except Exception as e:
            logger.error(f"[stream {stream_id}] failed mid-stream: {e}")
            # Nothing meaningful we can do after headers are flushed; client will get a truncated file.
            return
        finally:
            total_elapsed = time.time() - total_start
            logger.info(
                f"[stream {stream_id}] complete: sentences={sentences_rendered}/{len(sentences)} "
                f"totalSeconds={total_elapsed:.2f}"
            )

    return StreamingResponse(
        generator(),
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "no-store",
            "X-Stream-Id": stream_id,
            "X-AI-Generated": "true",
            "X-Sentence-Count": str(len(sentences)),
        },
    )


class SynthesizeDirectRequest(BaseModel):
    fileId: str
    refText: Optional[str] = None
    text: str
    language: str = "English"


@app.post("/api/tts/synthesize-direct")
async def synthesize_direct(
    auth_data: Annotated[dict, Depends(require_workspace_role)],
    req: SynthesizeDirectRequest,
):
    """Generate speech directly from reference audio (no saved profile)."""
    user_context = get_user_context(auth_data)
    
    if not model_manager.is_loaded:
        raise HTTPException(status_code=503, detail=MODEL_NOT_LOADED_ERROR)

    # Look for reference audio in user's workspace directory
    workspace_ref_dir = REFERENCE_AUDIO_DIR / auth_data['workspace_id']
    ref_files = [f for f in workspace_ref_dir.glob(f"{req.fileId}.*") if f.suffix != JSON_EXTENSION]
    
    if not ref_files:
        await log_auth_event('REFERENCE_NOT_FOUND', auth_data, {'fileId': req.fileId})
        raise HTTPException(status_code=404, detail=REFERENCE_AUDIO_NOT_FOUND_ERROR)

    # Load stored transcript if refText not provided
    if not req.refText:
        meta_path = workspace_ref_dir / f"{req.fileId}{JSON_EXTENSION}"
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

        # Save generated audio in workspace-scoped directory
        output_id = str(uuid.uuid4())
        workspace_audio_dir = GENERATED_AUDIO_DIR / auth_data['workspace_id']
        workspace_audio_dir.mkdir(exist_ok=True)
        output_path = workspace_audio_dir / f"{output_id}.wav"
        sf.write(str(output_path), audio_data, sr)

        duration = len(audio_data) / sr

        # Save metadata with workspace ownership
        meta_path = workspace_audio_dir / f"{output_id}{JSON_EXTENSION}"
        metadata = {
            "audioId": output_id,
            "workspaceId": auth_data['workspace_id'],
            "createdBy": auth_data['user_id'],
            "fileId": req.fileId,
            "duration": duration,
            "createdAt": time.time()
        }
        meta_path.write_text(json.dumps(metadata))

        logger.info(
            f"Direct synthesis: {duration:.1f}s audio in {elapsed:.1f}s "
            f"(workspace={auth_data['workspace_id']})"
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
        logger.error(f"Direct synthesis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Audio serving
# ---------------------------------------------------------------------------

@app.get("/api/tts/audio/{audio_id}")
async def serve_audio(
    auth_data: Annotated[dict, Depends(require_workspace_role)],
    audio_id: str,
):
    """Serve a generated audio file with authentication and workspace verification."""
    user_context = get_user_context(auth_data)
    
    # Look for audio file in user's workspace directory
    workspace_audio_dir = GENERATED_AUDIO_DIR / auth_data['workspace_id']
    audio_path = workspace_audio_dir / f"{audio_id}.wav"
    
    if not audio_path.exists():
        # Don't leak whether file exists or user lacks permission
        await log_auth_event('AUDIO_ACCESS_DENIED', auth_data, {'audioId': audio_id, 'reason': 'not_found'})
        raise HTTPException(status_code=404, detail="Audio file not found")

    # Verify ownership via metadata
    meta_path = workspace_audio_dir / f"{audio_id}{JSON_EXTENSION}"
    if meta_path.exists():
        try:
            metadata = json.loads(meta_path.read_text())
            if metadata.get('workspaceId') != auth_data['workspace_id']:
                await log_auth_event('TENANT_VIOLATION', auth_data, {
                    'audioId': audio_id,
                    'resourceWorkspace': metadata.get('workspaceId')
                })
                raise HTTPException(status_code=404, detail="Audio file not found")
        except json.JSONDecodeError:
            logger.warning(f"Invalid metadata for audio {audio_id}")

    await log_auth_event('AUDIO_ACCESSED', auth_data, {'audioId': audio_id})

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
