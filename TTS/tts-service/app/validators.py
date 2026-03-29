import re
from typing import Optional, List
from pydantic import BaseModel, validator, Field
from fastapi import HTTPException, status

# Security constants
MAX_TEXT_LENGTH = 10000  # Maximum characters for TTS text
MAX_PROFILE_NAME_LENGTH = 100
MAX_STYLE_INSTRUCT_LENGTH = 500
MAX_LANGUAGE_LENGTH = 10
ALLOWED_LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Chinese', 'Japanese', 'Korean']

class ValidationError(Exception):
    """Custom validation error"""
    pass

def sanitize_text(text: str, max_length: int = MAX_TEXT_LENGTH) -> str:
    """
    Sanitize text input to prevent injection attacks and resource exhaustion
    """
    if not text:
        raise ValidationError("Text cannot be empty")
    
    if len(text) > max_length:
        raise ValidationError(f"Text exceeds maximum length of {max_length} characters")
    
    # Remove potentially dangerous characters
    # Allow basic punctuation, letters, numbers, and common symbols
    sanitized = re.sub(r'[^\w\s\.\,\?\!\;\:\-\(\)\[\]\{\}\"\'\/\\\n\r\t]', '', text)
    
    if not sanitized.strip():
        raise ValidationError("Text contains no valid characters after sanitization")
    
    return sanitized.strip()

def validate_profile_name(name: str) -> str:
    """Validate and sanitize voice profile name"""
    if not name:
        raise ValidationError("Profile name cannot be empty")
    
    if len(name) > MAX_PROFILE_NAME_LENGTH:
        raise ValidationError(f"Profile name exceeds maximum length of {MAX_PROFILE_NAME_LENGTH} characters")
    
    # Allow alphanumeric characters, spaces, hyphens, and underscores
    sanitized = re.sub(r'[^\w\s\-_]', '', name)
    
    if not sanitized.strip():
        raise ValidationError("Profile name contains no valid characters after sanitization")
    
    return sanitized.strip()

def validate_style_instruct(style: Optional[str]) -> Optional[str]:
    """Validate and sanitize style instruction"""
    if not style:
        return None
    
    if len(style) > MAX_STYLE_INSTRUCT_LENGTH:
        raise ValidationError(f"Style instruction exceeds maximum length of {MAX_STYLE_INSTRUCT_LENGTH} characters")
    
    # Remove potentially dangerous characters but allow descriptive text
    sanitized = re.sub(r'[<>\&]', '', style)
    
    return sanitized.strip()

def validate_language(language: str) -> str:
    """Validate language parameter"""
    if not language:
        return "English"  # Default language
    
    if language not in ALLOWED_LANGUAGES:
        raise ValidationError(f"Language must be one of: {', '.join(ALLOWED_LANGUAGES)}")
    
    return language

def validate_file_id(file_id: str) -> str:
    """Validate file ID format"""
    if not file_id:
        raise ValidationError("File ID cannot be empty")
    
    # Check for valid UUID format or similar identifier
    if not re.match(r'^[a-zA-Z0-9\-_]{8,36}$', file_id):
        raise ValidationError("Invalid file ID format")
    
    return file_id

def validate_profile_id(profile_id: str) -> str:
    """Validate profile ID format"""
    if not profile_id:
        raise ValidationError("Profile ID cannot be empty")
    
    # Check for valid profile ID format (alphanumeric, hyphens, underscores)
    if not re.match(r'^[a-zA-Z0-9\-_]{1,50}$', profile_id):
        raise ValidationError("Invalid profile ID format")
    
    return profile_id

# Pydantic models for request validation
class ValidatedUploadReferenceRequest(BaseModel):
    """Validation model for upload reference endpoint"""
    # File is handled separately by FastAPI's UploadFile

class ValidatedCreateProfileRequest(BaseModel):
    """Validation model for create voice profile endpoint"""
    fileId: str = Field(..., min_length=8, max_length=36)
    refText: Optional[str] = Field(None, max_length=MAX_TEXT_LENGTH)
    profileName: str = Field(..., min_length=1, max_length=MAX_PROFILE_NAME_LENGTH)
    styleInstruct: Optional[str] = Field(None, max_length=MAX_STYLE_INSTRUCT_LENGTH)
    
    @validator('fileId')
    def validate_file_id(cls, v):
        return validate_file_id(v)
    
    @validator('refText')
    def validate_ref_text(cls, v):
        if v is not None:
            return sanitize_text(v)
        return v
    
    @validator('profileName')
    def validate_profile_name(cls, v):
        return validate_profile_name(v)
    
    @validator('styleInstruct')
    def validate_style_instruct(cls, v):
        return validate_style_instruct(v)

class ValidatedSynthesizeRequest(BaseModel):
    """Validation model for synthesize endpoint"""
    profileId: str = Field(..., min_length=1, max_length=50)
    text: str = Field(..., min_length=1, max_length=MAX_TEXT_LENGTH)
    language: str = Field(default="English", max_length=MAX_LANGUAGE_LENGTH)
    style: Optional[str] = Field(None, max_length=MAX_STYLE_INSTRUCT_LENGTH)
    
    @validator('profileId')
    def validate_profile_id(cls, v):
        return validate_profile_id(v)
    
    @validator('text')
    def validate_text(cls, v):
        return sanitize_text(v)
    
    @validator('language')
    def validate_language(cls, v):
        return validate_language(v)
    
    @validator('style')
    def validate_style(cls, v):
        return validate_style_instruct(v)

class ValidatedDesignVoiceRequest(BaseModel):
    """Validation model for design voice endpoint"""
    text: str = Field(..., min_length=1, max_length=MAX_TEXT_LENGTH)
    instruct: str = Field(..., min_length=1, max_length=MAX_STYLE_INSTRUCT_LENGTH)
    language: str = Field(default="English", max_length=MAX_LANGUAGE_LENGTH)
    
    @validator('text')
    def validate_text(cls, v):
        return sanitize_text(v)
    
    @validator('instruct')
    def validate_instruct(cls, v):
        if not v.strip():
            raise ValidationError("Voice design instruction cannot be empty")
        return validate_style_instruct(v)
    
    @validator('language')
    def validate_language(cls, v):
        return validate_language(v)

class ValidatedBlendVoiceRequest(BaseModel):
    """Validation model for blend voice endpoint"""
    fileId: str = Field(..., min_length=8, max_length=36)
    refText: Optional[str] = Field(None, max_length=MAX_TEXT_LENGTH)
    instruct: str = Field(..., min_length=1, max_length=MAX_STYLE_INSTRUCT_LENGTH)
    styleRefText: Optional[str] = Field(None, max_length=500)
    profileName: str = Field(..., min_length=1, max_length=MAX_PROFILE_NAME_LENGTH)
    language: str = Field(default="English", max_length=MAX_LANGUAGE_LENGTH)
    
    @validator('fileId')
    def validate_file_id(cls, v):
        return validate_file_id(v)
    
    @validator('refText')
    def validate_ref_text(cls, v):
        if v is not None:
            return sanitize_text(v)
        return v
    
    @validator('instruct')
    def validate_instruct(cls, v):
        if not v.strip():
            raise ValidationError("Voice blend instruction cannot be empty")
        return validate_style_instruct(v)
    
    @validator('styleRefText')
    def validate_style_ref_text(cls, v):
        if v is not None:
            return sanitize_text(v, max_length=500)
        return v
    
    @validator('profileName')
    def validate_profile_name(cls, v):
        return validate_profile_name(v)
    
    @validator('language')
    def validate_language(cls, v):
        return validate_language(v)

# Validation middleware function
def validate_request(request_model: BaseModel):
    """Decorator to validate request data"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Extract request data from kwargs or args
            request_data = None
            for arg in args:
                if isinstance(arg, request_model):
                    request_data = arg
                    break
            
            if request_data is None:
                # Try to get from kwargs
                for key, value in kwargs.items():
                    if isinstance(value, request_model):
                        request_data = value
                        break
            
            if request_data is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid request format"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

# File size validation
def validate_audio_file_size(file_size: int, max_size_mb: int = 50) -> None:
    """Validate audio file size"""
    max_size_bytes = max_size_mb * 1024 * 1024
    
    if file_size > max_size_bytes:
        raise ValidationError(f"Audio file size exceeds maximum of {max_size_mb}MB")
    
    if file_size <= 0:
        raise ValidationError("Audio file size must be greater than 0")

def validate_audio_file_extension(filename: str) -> str:
    """Validate audio file extension"""
    if not filename:
        raise ValidationError("Filename cannot be empty")
    
    allowed_extensions = ['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac']
    extension = filename.lower().split('.')[-1]
    
    if not any(filename.lower().endswith(ext) for ext in allowed_extensions):
        raise ValidationError(f"Audio file must have one of these extensions: {', '.join(allowed_extensions)}")
    
    return '.' + extension
