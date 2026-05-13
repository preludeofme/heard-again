from typing import Literal, Optional

from pydantic import BaseModel


# ── existing models ──────────────────────────────────────────────────────────

class RunPodTTSInput(BaseModel):
    jobId: str
    text: str
    outputKey: str
    familySpaceId: Optional[str] = None
    personId: Optional[str] = None
    referenceAudioUrl: Optional[str] = None
    referenceText: Optional[str] = None
    callbackUrl: Optional[str] = None


class RunPodResult(BaseModel):
    jobId: str
    status: str
    outputKey: Optional[str] = None
    durationMs: int
    error: Optional[str] = None
    warning: Optional[str] = None


# ── new action schemas ───────────────────────────────────────────────────────

class UploadReferenceInput(BaseModel):
    action: Literal["upload_reference"]
    familyspaceId: str
    filename: str
    mimeType: str
    audioBase64: Optional[str] = None
    audioUrl: Optional[str] = None


class UploadReferenceResult(BaseModel):
    fileId: str
    filePath: str
    fileName: str
    duration: float
    transcript: Optional[str]
    storageType: Literal["CLOUDFLARE_R2"] = "CLOUDFLARE_R2"


class SynthesizeBatchInput(BaseModel):
    action: Literal["synthesize_batch"]
    profileName: str
    text: str
    familyspaceId: str
    language: str = "English"
    silencePaddingMs: int = 200


class SynthesisCompleteEvent(BaseModel):
    type: Literal["complete"] = "complete"
    audioId: str
    audioKey: str  # R2 object key — not an HTTP URL
    duration: float
    sampleRate: int
    synthesisTime: float
    sentenceCount: int
    format: Literal["mp3", "wav"] = "mp3"
    mimeType: str = "audio/mpeg"
    fileSize: int


class DownloadAudioInput(BaseModel):
    action: Literal["download_audio"]
    audioId: str
    familyspaceId: Optional[str] = None


class DownloadAudioResult(BaseModel):
    audioBase64: str
    mimeType: str = "audio/mpeg"
