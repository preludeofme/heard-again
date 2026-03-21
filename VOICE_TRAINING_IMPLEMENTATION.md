# Voice Training Implementation Documentation

## Overview

This document describes the complete implementation of the GPT-SoVITS voice training pipeline for the Heard Again application. The implementation follows the phases outlined in the GPT_SOVITS_IMPLEMENTATION_PLAN.md.

## Implemented Features

### Phase 1: File Storage Structure ✅
- Created proper directory structure for GPT-SoVITS integration
- Updated upload endpoint to save files to both local and container paths
- File tracking with container path mapping

### Phase 2: Audio Preprocessing ✅
- **Audio Slicing** (`/api/voice/preprocess/slice`): Integrates with GPT-SoVITS fn_index 22
- **Voice Enhancement** (`/api/voice/preprocess/enhance`): Integrates with GPT-SoVITS fn_index 31
- Both endpoints have fallback to mock implementations when GPT-SoVITS is unavailable

### Phase 3: ASR Transcription ✅
- **ASR Transcription** (`/api/voice/asr/transcribe`): Integrates with GPT-SoVITS fn_index 39
- Supports multiple languages (en, zh, ja, ko, yue)
- Generates transcript files for training data preparation

### Phase 4: Training Data Preparation ✅
- **List File Generation** (`/api/voice/preprocess/generate-list`): Creates .list files in GPT-SoVITS format
- Format: `/path/to/audio.wav|transcript text|0|EN`
- Updated training endpoint to run the complete preprocessing pipeline

### Phase 5: Model Management ✅
- Enhanced models endpoint to check local file system for trained models
- Model download endpoint (`/api/voice/models/[modelId]/download`)
- Support for both GPT-SoVITS and locally trained models

### Phase 6: UI Updates ✅
- Updated VoiceTrainingModal with detailed pipeline progress indicators
- Shows individual stages: slicing, enhancement, ASR, list generation, training
- Visual indicators for real GPT-SoVITS vs mock processing

## API Endpoints

### Core Pipeline Endpoints

1. **POST /api/voice/upload-sample**
   - Uploads audio files to GPT-SoVITS compatible structure
   - Returns file paths for both local and container access

2. **POST /api/voice/preprocess/slice**
   - Slices audio into segments using GPT-SoVITS
   - Parameters: userId, sampleId, options (threshold, minLength, minInterval)

3. **POST /api/voice/preprocess/enhance**
   - Applies voice enhancement and noise reduction
   - Parameters: userId, sampleId, options

4. **POST /api/voice/asr/transcribe**
   - Converts speech to text using ASR
   - Parameters: userId, audioFiles[], language, model, modelSize

5. **POST /api/voice/preprocess/generate-list**
   - Generates .list file for training
   - Parameters: userId, transcripts[], language, outputFileName

6. **POST /api/voice/train**
   - Orchestrates the complete training pipeline
   - Runs preprocessing stages before starting training
   - Integrates with GPT-SoVITS fn_index 78 for training

### Supporting Endpoints

7. **GET /api/voice/train/[jobId]/status**
   - Checks training job status
   - Updates progress for real GPT-SoVITS jobs

8. **GET /api/voice/models**
   - Lists available models
   - Checks both database and local file system

9. **GET/POST /api/voice/models/[modelId]/download**
   - Prepares model for download
   - Creates archive of model files

## File Structure

```
heard-again/
├── uploads/
│   ├── raw/{userId}/          # Raw audio files for GPT-SoVITS
│   └── audio/{userId}/        # Local audio copies
├── outputs/
│   └── {userId}/
│       ├── sliced/            # Sliced audio segments
│       ├── enhanced/          # Enhanced audio files
│       └── asr_opt/           # ASR transcription outputs
├── models/
│   └── trained/               # Trained model storage
└── src/app/api/voice/
    ├── preprocess/
    │   ├── slice/
    │   ├── enhance/
    │   └── generate-list/
    ├── asr/
    │   └── transcribe/
    ├── train/
    │   └── [jobId]/status/
    └── models/
        └── [modelId]/download/
```

## GPT-SoVITS Integration

### Function Indices
- 22: Audio slicing
- 31: Voice denoise
- 39: ASR processing
- 78: SoVITS training

### Container Paths
- Input audio: `/app/uploads/raw/{userId}/`
- Output files: `/app/outputs/{userId}/`
- Models: `/app/models/trained/`

## Testing

### Prerequisites
1. Start the voice infrastructure:
   ```bash
   npm run start:voice:real  # For real GPT-SoVITS
   # or
   npm run start:voice       # For mock implementation
   ```

2. Start the main application:
   ```bash
   npm run dev
   ```

### Test Script
Run the end-to-end test:
```bash
node test-voice-training-pipeline.js
```

The test script will:
1. Check GPT-SoVITS connectivity
2. Upload a test audio file
3. Run audio slicing
4. Perform ASR transcription
5. Generate training list file
6. Start training
7. Check training status
8. List available models

## Usage Example

```javascript
// 1. Upload audio
const uploadResponse = await fetch('/api/voice/upload-sample', {
  method: 'POST',
  body: formData // Contains audio file and userId
});
const { fileId } = await uploadResponse.json();

// 2. Start training (runs full pipeline)
const trainResponse = await fetch('/api/voice/train', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user123',
    samples: [fileId],
    language: 'en',
    modelName: 'My Voice Model'
  })
});
const { jobId } = await trainResponse.json();

// 3. Check status
const statusResponse = await fetch(`/api/voice/train/${jobId}/status`);
const { status, progress, currentStage } = await statusResponse.json();
```

## Error Handling

- All endpoints have graceful fallback to mock implementations
- Real GPT-SoVITS processing is attempted first, with fallback on errors
- Detailed error logging for debugging
- Progress tracking for long-running operations

## Next Steps

1. **Database Integration**: Replace global maps with proper database storage
2. **Queue Management**: Implement job queue for concurrent training
3. **Model Versioning**: Add version control for trained models
4. **Performance Optimization**: Add caching and parallel processing
5. **Security**: Add file validation and user isolation

## Troubleshooting

### GPT-SoVITS Not Responding
- Check if Docker container is running: `docker ps`
- View logs: `docker-compose -f docker-compose.voice.yml logs -f`
- Ensure GPU is available: `nvidia-smi`

### Training Fails
- Check audio file format (WAV, MP3, M4A supported)
- Verify file paths in container
- Check GPT-SoVITS queue status

### UI Not Updating
- Ensure WebSocket connection is active
- Check browser console for errors
- Verify API responses in Network tab
