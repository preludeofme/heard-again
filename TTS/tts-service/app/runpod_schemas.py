from pydantic import BaseModel
from typing import Optional


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
