# GPT-SoVITS Integration Plan

## Overview
GPT-SoVITS is a powerful few-shot voice cloning solution that can generate realistic TTS from just 1 minute of audio samples. This integration will enable users to create voice clones of their loved ones for the "Heard Again" memorial platform.

## Key Features
- **Zero-shot TTS**: 5-second vocal sample for instant TTS
- **Few-shot TTS**: 1-minute training data for improved voice similarity
- **Cross-lingual Support**: English, Japanese, Korean, Cantonese, Chinese
- **WebUI Tools**: Voice separation, ASR, text labeling
- **Fast Inference**: ~0.028 RTF on RTX 4060Ti

## Architecture Decision

### Option 1: Self-Hosted Docker Deployment (Recommended)
- Deploy GPT-SoVITS as a separate microservice
- Use Docker Compose for orchestration
- Expose REST API endpoints
- Full control over data and models

### Option 2: Cloud API Integration
- Use HuggingFace demo API (limited)
- Third-party hosting services
- Less control, easier setup

### Option 3: Hybrid Approach
- Self-host for training/processing
- Cloud CDN for model serving
- Best of both worlds

## Implementation Tasks

### Phase 4.5 — Voice Cloning Infrastructure

#### Backend Setup
- [ ] Set up GPT-SoVITS Docker service
  - [ ] Configure docker-compose.yml
  - [ ] Set up GPU-enabled environment (CUDA 12.6/12.8)
  - [ ] Configure shared memory (16GB+)
  - [ ] Set up model storage volume
  - [ ] Configure network access from Next.js app

- [ ] Create GPT-SoVITS API wrapper
  - [ ] `/api/voice/train` - Start training job
  - [ ] `/api/voice/train/status` - Check training progress
  - [ ] `/api/voice/synthesize` - Generate speech
  - [ ] `/api/voice/upload-sample` - Upload audio samples
  - [ ] `/api/voice/models` - List trained models

- [ ] Database schema updates
  - [ ] VoiceModel table (id, userId, name, status, modelPath, metadata)
  - [ ] TrainingJob table (id, userId, modelId, status, progress, samples)
  - [ ] AudioSample table (id, userId, jobId, path, duration, quality)

#### Frontend Integration
- [ ] VoiceLabController updates
  - [ ] Training state management
  - [ ] Progress tracking
  - [ ] Error handling for training failures
  - [ ] Model management

- [ ] UI Components
  - [ ] Training progress indicator
  - [ ] Audio quality checker
  - [ ] Model selection dropdown
  - [ ] Voice preview player

### Phase 4.6 — Voice Collection Workflow

#### Audio Collection Interface
- [ ] Enhanced recording interface
  - [ ] Real-time waveform visualization
  - [ ] Audio quality metrics
  - [ ] Background noise detection
  - [ ] Minimum duration enforcement (60 seconds)

- [ ] Sample management
  - [ ] Multiple sample upload
  - [ ] Sample preview and trimming
  - [ ] Quality scoring system
  - [ ] Batch processing

#### Training Pipeline
- [ ] Pre-processing
  - [ ] Audio format conversion
  - [ ] Noise reduction
  - [ ] Voice separation (UVR5)
  - [ ] Automatic segmentation

- [ ] ASR Integration
  - [ ] Speech-to-text for training data
  - [ ] Text correction interface
  - [ ] Multi-language support

- [ ] Model Training
  - [ ] Job queue management
  - [ ] GPU resource allocation
  - [ ] Training progress callbacks
  - [ ] Model validation

### Phase 4.7 — Voice Synthesis

#### TTS Integration
- [ ] Synthesis API
  - [ ] Text preprocessing
  - [ ] Emotion/style controls
  - [ ] Speed/pitch adjustment
  - [ ] Batch synthesis

- [ ] Talk Page Updates
  - [ ] Voice selection
  - [ ] Real-time synthesis
  - [ ] Audio caching
  - [ ] Streaming playback

#### Quality Controls
- [ ] Output validation
  - [ ] Similarity scoring
  - [ ] Naturalness metrics
  - [ ] A/B testing interface
  - [ ] User feedback collection

## Technical Specifications

### Hardware Requirements
- **GPU**: RTX 3060+ (6GB+ VRAM)
- **RAM**: 16GB+ system memory
- **Storage**: 100GB+ for models
- **CPU**: Modern multi-core processor

### Software Dependencies
- Docker & Docker Compose
- NVIDIA Container Toolkit
- CUDA 12.6 or 12.8
- FFmpeg
- Python 3.10

### API Endpoints Design

```typescript
// Training endpoints
POST /api/voice/train
{
  userId: string,
  samples: string[], // URLs to audio files
  language: 'en' | 'zh' | 'ja' | 'ko' | 'yue',
  model_name: string
}

GET /api/voice/train/{jobId}/status
{
  status: 'queued' | 'processing' | 'completed' | 'failed',
  progress: number, // 0-100
  stage: string,
  error?: string
}

// Synthesis endpoint
POST /api/voice/synthesize
{
  modelId: string,
  text: string,
  language: string,
  speed?: number,
  pitch?: number
}
```

### Database Schema

```sql
CREATE TABLE voice_models (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name VARCHAR(255),
  status VARCHAR(50),
  model_path TEXT,
  metadata JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE training_jobs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  model_id UUID REFERENCES voice_models(id),
  status VARCHAR(50),
  progress INTEGER,
  current_stage VARCHAR(100),
  error_message TEXT,
  samples JSONB,
  created_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

## Security Considerations

### Data Privacy
- [ ] Encrypt audio data at rest
- [ ] Secure model storage
- [ ] User data isolation
- [ ] GDPR compliance

### Access Control
- [ ] Rate limiting on training
- [ ] Resource quotas per user
- [ ] Authentication for all endpoints
- [ ] Audit logging

## Deployment Strategy

### Development Environment
1. Local Docker setup with CPU inference
2. Mock training API for UI development
3. Sample audio datasets for testing

### Staging Environment
1. GPU-enabled cloud instance
2. Full pipeline testing
3. Performance benchmarking
4. Load testing

### Production Environment
1. Multi-GPU setup for scalability
2. Auto-scaling based on demand
3. Model versioning
4. Backup and disaster recovery

## Monitoring & Analytics

### Metrics to Track
- Training success rate
- Average training time
- Model quality scores
- API response times
- Resource utilization

### Alerts
- Training failures
- GPU memory issues
- API errors
- Queue backlog

## Cost Estimation

### Infrastructure (Monthly)
- GPU Instance (RTX 4090): $500-800
- Storage (500GB): $50
- Bandwidth: $100
- **Total**: ~$650-950

### Per-User Costs
- Training: ~$2-5 per model
- Synthesis: ~$0.001 per request
- Storage: ~$0.10 per model

## Timeline

### Week 1-2: Infrastructure Setup
- Docker environment configuration
- Basic API wrapper implementation
- Database schema updates

### Week 3-4: Training Pipeline
- Audio collection UI
- Training job management
- Progress tracking

### Week 5-6: Synthesis Integration
- TTS API integration
- Talk page updates
- Quality controls

### Week 7-8: Testing & Optimization
- End-to-end testing
- Performance optimization
- Security hardening

## Risks & Mitigations

### Technical Risks
- **GPU resource contention**: Implement job queue
- **Model quality issues**: Quality validation pipeline
- **Long training times**: Progress tracking & notifications

### Business Risks
- **High infrastructure costs**: Tiered pricing model
- **User abandonment**: Simplified onboarding
- **Privacy concerns**: Transparent data policy

## Success Metrics
- Training completion rate > 90%
- Average training time < 30 minutes
- User satisfaction score > 4.5/5
- Model synthesis quality > 4.0/5

## Next Steps
1. Set up development environment
2. Create proof-of-concept API
3. Test with sample audio
4. Gather user feedback
5. Iterate on quality and experience
