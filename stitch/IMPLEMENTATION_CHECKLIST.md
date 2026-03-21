# Heard Again — End-to-End Implementation Checklist

This checklist is organized to follow the required build order:

1. UI first (complete screens with mocked data)
2. Controller/state wiring
3. API/data integration (end-to-end)
4. Hardening (testing, accessibility, performance, deployment)

---

## Phase 0 — Foundations (repo + app scaffolding)

- [x] Choose primary web stack (expected: React + TypeScript + Material UI v7+).
- [x] Establish routing for required pages:
  - [x] `Home` (Dashboard / Legacy Home)
  - [x] `Talk` (AI Conversation Interface)
  - [x] `Voice Lab` (Voice & Documents Lab)
  - [x] `Documents` (Document Archive view)
  - [x] `Stories` (Story Collection Portal)
- [x] Implement global layout skeleton matching mock:
  - [x] Top app bar (brand, primary nav links, search, icons, avatar)
  - [x] Left side rail (“The Living Archive”) with required items
  - [x] Side rail footer links (Support, Privacy Settings)
  - [x] Selected nav item visual state matches mock
  - [x] Mobile responsive behavior:
    - [x] Side rail collapses/hidden on small screens
    - [x] Mobile bottom navigation (Home / Lab / Add / Stories / Profile)
- [x] Define design tokens/theme aligned with `stitch/DESIGN.md`:
  - [x] Warm minimal base surfaces (surface / surface-container-low / lowest / dim)
  - [x] “No-Line Rule” (avoid 1px borders; ghost border fallback only)
  - [x] Typography pairing (Newsreader-like for display/headlines; Manrope-like for UI/body)
  - [x] Rounded corners everywhere; avoid sharp corners
  - [x] Primary CTA gradient (primary → primary-container)
  - [x] Glassmorphism recipe for floating/overlay elements (80% opacity + ~24px blur)

---

## Phase 1 — Core domain models (mocked)

Create TypeScript interfaces and mock datasets (no API calls yet):

- [x] `LegacySubject`:
  - [x] `id`, `fullName`, `lifespanText`, `bio`, `avatarUrl`, `accentIcon`
- [x] `AudioSample`:
  - [x] `id`, `title`, `recordedAt`, `durationSeconds`, `status`
- [x] `VoiceCloneStatus`:
  - [x] `percentComplete`, `uploadedCount`, `remainingCount`, `statusText`
- [x] `DocumentArtifact`:
  - [x] `id`, `title`, `type`, `uploadedAt`, `thumbnailUrl`, `shareAction`
- [x] `StoryContribution`:
  - [x] `id`, `authorName`, `authorRole`, `authorAvatarUrl`, `content`, `createdAt`, `type`, `audioDurationSeconds?`
- [x] `ConversationMessage`:
  - [x] `id`, `sender`, `timestamp`, `content`, `state`

Acceptance criteria:

- [x] All pages render fully with believable mock data.
- [x] No console errors; strict TypeScript passes.

---

## Phase 2 — UI Implementation (mocked data only, match stitch screenshots)

### 2.1 Home / Dashboard (Legacy Home)

Match `stitch/dashboard_legacy_home/screen.png`.

- [x] Hero area with two primary cards:
  - [x] Legacy subject profile card (avatar + heart badge, name, lifespan, short bio)
  - [x] Voice sample card:
    - [x] Title "Voice Sample"
    - [x] Subtitle "Generated Legacy Clone — High Fidelity"
    - [x] Large circular play button
    - [x] Soft rounded-bar waveform visualization
    - [x] Time labels (0:00, quote snippet, 2:45)
- [x] "Memory Wall" section:
  - [x] Title + "View All Stories" link
  - [x] Bento grid of mixed cards (quote, audio memory, short quote with author chip, archive stats)
- [x] "Preserve the Present" quick actions:
  - [x] 3 action cards (Start Conversation, New Story, Upload Recording)
- [x] Desktop side rail includes "Start Recording" primary CTA near bottom
- [x] Top bar search input ("Search memories…")

Interactive placeholders (no real logic yet):

- [x] Play button toggles between play/pause UI state
- [x] Quick action cards navigate to their destination routes (or open stub modal)

### 2.2 Stories / Story Collection Portal

Match `stitch/story_collection_portal/screen.png`.

- [x] Landing hero:
  - [x] Headline "Help us tell Arthur's story."
  - [x] Supporting paragraph
  - [x] Right-side tilted portrait
  - [x] Floating glass quote card ("The best way to remember is to share.")
- [x] Contribution hub:
  - [x] "Record a Memory" card with waveform placeholder + "Start Recording" CTA
  - [x] "Write a Story" card:
    - [x] Optional title input
    - [x] Main textarea ("Share your memory here…")
    - [x] Attach file + add photo actions
    - [x] Submit CTA ("Post Memory")
- [x] "Recent Contributions" section:
  - [x] Grid of contribution cards
  - [x] Highlight audio contribution card with mini player
- [x] Footer matching mock content blocks

Interactive placeholders:

- [x] "Post Memory" performs client-side validation and shows success toast (mock)
- [x] Attach actions open file picker (no upload yet)

### 2.3 Voice & Documents Lab

Match `stitch/voice_documents_lab/screen.png`.

Left column (Voice Cloning):

- [x] Status row (title, "Status: Calibration in progress", badge "Active")
- [x] Progress ring showing percent (e.g., 75%)
- [x] Stats list ("15 recordings uploaded", "5 more needed")
- [x] Soft waveform card
- [x] Primary CTA "Record Sample"
- [x] "Recent Samples" list rows (play, title, meta, overflow)

Right column (Document Archive):

- [x] Title "Document Archive"
- [x] Filter chips (All, PDFs, Handwritten)
- [x] Document grid cards (thumbnail, type pill, title, uploaded date, share action)
- [x] "Upload Artifact" dashed card with plus icon + supporting text

Interactive placeholders:

- [x] Filter chips update the displayed mocked documents
- [x] "Upload Artifact" opens file picker (no upload yet)
- [x] "Record Sample" opens stub recording modal

### 2.4 Documents (Document Archive route)

- [x] Create a dedicated `Documents` route that shows the same Document Archive UI as the lab's right column.
- [x] Ensure the side rail "Documents" nav item routes here.

### 2.5 Talk / AI Conversation Interface

Match `stitch/ai_conversation_interface/screen.png`.

- [x] Talk header (back, title "Conversation with Evelyn", live indicator, avatar + icons)
- [x] Message list:
  - [x] Legacy subject bubble (left) with sender label + timestamp
  - [x] User bubble (right) with sender label + timestamp
- [x] Listening centerpiece (orb/rings + mic icon) + status text ("Evelyn is listening…")
- [x] Typing indicator bubble (three dots)
- [x] Bottom sticky input bar:
  - [x] Mute button with label
  - [x] Text input ("Type a memory or just say hello…")
  - [x] Image attachment
  - [x] Mic button
  - [x] Primary Send button
- [x] Footer microcopy ("Encrypted Connection • Archive Active")

Interactive placeholders:

- [x] Sending a message appends to local message list
- [x] Toggle listening/typing UI states (mock)

---

## Phase 3 — Interaction states + UX polish (still mocked data)

- [x] Tonal hover states across clickable elements (no harsh changes)
- [x] Active/pressed micro-interactions (subtle scale/opacity)
- [x] Loading/progress UI:
  - [x] Voice clone ring + counts can represent "processing" and "ready"
  - [x] Talk: listening state + typing state
- [x] Empty states:
  - [x] Document archive empty
  - [x] Recent samples empty
  - [x] Contributions empty
- [x] Error states (visual + copy):
  - [x] Recording failed
  - [x] Upload failed
  - [x] Post memory failed
- [x] Accessibility:
  - [x] Keyboard focus visible via ghost border (not harsh outline)
  - [x] Contrast checks while keeping warm palette
  - [x] ARIA labels for icon-only buttons

Acceptance criteria:

- [x] All screens match stitch mocks closely (layout, spacing, tonal layering).
- [x] All primary interactions are clickable and visibly respond.

---

## Phase 4 — Controller/state layer (UI → real behavior, no backend yet)

Goal: centralize local state and interactions behind “service-like” modules or hooks.

- [x] Introduce page-level controllers/hooks for each route:
  - [x] `useDashboardController` (memory wall selection, quick actions)
  - [x] `useStoriesController` (form state, optimistic UI for new contribution)
  - [x] `useVoiceLabController` (filters, sample playback state, recording modal state)
  - [x] `useDocumentsController` (filters, selection, share UI)
  - [x] `useTalkController` (message list, typing/listening state machine)
- [x] Standardize UI state patterns:
  - [x] `isLoading`, `hasError`, `errorMessage`
  - [x] toast/alert pattern
  - [x] consistent empty state triggers

Acceptance criteria:

- [x] No page directly mutates mock arrays; controller owns mutations.
- [x] Each major UI action triggers a controller method.

---

## Phase 4.5 — Voice Cloning Infrastructure

### Backend Setup
- [ ] Set up Voice Cloning Docker service
  - [ ] Configure docker-compose.yml with GPU support
  - [ ] Set up CUDA 12.6/12.8 environment
  - [ ] Configure shared memory (16GB+)
  - [ ] Set up persistent model storage
  - [ ] Network configuration for API access

- [x] Create Voice Cloning API wrapper
  - [x] `/api/voice/train` - Start training job
  - [x] `/api/voice/train/status` - Check training progress
  - [x] `/api/voice/synthesize` - Generate speech
  - [x] `/api/voice/upload-sample` - Upload audio samples
  - [x] `/api/voice/models` - List trained models

- [x] Database schema updates
  - [x] VoiceModel table (id, userId, name, status, modelPath, metadata)
  - [x] TrainingJob table (id, userId, modelId, status, progress, samples)
  - [x] AudioSample table (id, userId, jobId, path, duration, quality)

### Frontend Integration
- [x] VoiceLabController enhancements
  - [x] Training state management
  - [x] Progress tracking with real-time updates
  - [x] Error handling for training failures
  - [x] Model selection and management

- [x] UI Components for Voice Cloning
  - [x] Training progress indicator with stages
  - [x] Audio quality checker interface
  - [x] Model management dashboard
  - [x] Voice preview and comparison player

### Voice Collection Workflow
- [x] Enhanced recording interface
  - [x] Real-time waveform visualization
  - [x] Audio quality metrics display
  - [x] Background noise detection
  - [x] 60-second minimum duration enforcement
- [x] Sample management system
  - [x] Multiple sample upload with drag-drop
  - [x] Sample preview and trimming tools
  - [x] Quality scoring system
  - [x] Batch processing capabilities
- [x] Voice Cloning server connectivity
  - [x] Server is running and accessible
  - [x] API endpoints are responding
  - [x] Training requests are being sent
  - [ ] Proper data formatting for voice cloning system

### Training Pipeline Integration
- [x] Pre-processing automation
  - [x] Audio format conversion
  - [x] Noise reduction filters
  - [x] Voice separation (UVR5)
  - [x] Automatic audio segmentation

- [x] ASR and Text Processing
  - [x] Speech-to-text for training data
  - [x] Text correction interface
  - [x] Multi-language support

- [x] Model Training Management
  - [x] Job queue with priority handling
  - [x] GPU resource allocation
  - [x] Training progress callbacks
  - [x] Model validation and testing

### Voice Synthesis Integration
- [x] TTS API Integration
  - [x] Text preprocessing and cleanup
  - [x] Emotion and style controls
  - [x] Speed and pitch adjustment
  - [x] Batch synthesis capability

- [x] Talk Page Voice Features
  - [x] Voice selection dropdown
  - [x] Real-time synthesis streaming
  - [x] Audio caching for repeated phrases
  - [x] Voice comparison A/B testing

### Quality and Performance
- [x] Output validation system
  - [x] Voice similarity scoring
  - [x] Audio quality metrics
  - [x] Model performance benchmarking

- [ ] Performance optimization
  - [ ] Audio compression for uploads
  - [ ] Caching for repeated requests
  - [ ] Lazy loading for large audio files

- [ ] Security and Privacy
  - [ ] User authentication for voice models
  - [ ] Secure file storage with encryption
  - [ ] GDPR compliance for voice data
  - [ ] Model access controls

### Docker Infrastructure (Remaining)
- [x] Set up Voice Cloning Docker service
  - [x] Configure docker-compose.yml with GPU support
  - [x] Set up CUDA 12.6/12.8 environment
  - [x] Configure shared memory (16GB+)
  - [x] Set up persistent model storage
  - [x] Network configuration for API access
- [ ] Implement proper voice cloning data pipeline
  - [ ] Audio upload and preprocessing workflow
  - [ ] ASR transcription integration
  - [ ] .list file generation with audio paths and transcriptions
  - [ ] Proper folder structure for training data

### Security and Privacy
- [ ] Data protection measures
  - [ ] Encrypt audio data at rest
  - [ ] Secure model storage
  - [ ] GDPR compliance checklist

- [ ] Access control implementation
  - [ ] Rate limiting on training requests
  - [ ] Resource quotas per user
  - [ ] Authentication for all voice endpoints
  - [ ] Audit logging for voice operations

Acceptance criteria:

- [ ] Users can train a voice model with 1 minute of audio
- [ ] Training completes within 30 minutes on GPU
- [ ] Synthesized speech responds in < 2 seconds
- [ ] Voice similarity score > 85% for trained models
- [ ] All voice data encrypted and isolated per user

---

## Phase 5 — API/Data integration design (contracts first)

Before coding integrations, lock down contracts.

- [ ] Decide backend architecture:
  - [ ] Monolith API (Node/Express, Next.js API routes, etc.) or serverless
  - [ ] Database (Postgres recommended) and ORM/migrations
- [ ] Define API endpoints and payload shapes:
  - [ ] Legacy subject profile
  - [ ] Story contributions (list, create)
  - [ ] Document artifacts (list, upload, metadata)
  - [ ] Audio samples (list, upload, processing status)
  - [ ] Conversation (send message, stream response)
- [ ] Define file storage strategy:
  - [ ] Object storage (S3-compatible) for audio + artifacts
  - [ ] Signed upload URLs for direct-to-storage uploads
- [ ] Authentication/authorization strategy:
  - [ ] Owner/admin vs contributors vs public viewers
  - [ ] Session/JWT approach

Acceptance criteria:

- [ ] API contracts documented in a single place (OpenAPI or typed client).
- [ ] Frontend controllers can be adapted with minimal shape changes.

---

## Phase 6 — API/Data integration (replace mocks incrementally)

### 6.1 Data fetching layer

- [ ] Add a typed API client module.
- [ ] Implement request error handling and standard response envelope.
- [ ] Add caching strategy (e.g., TanStack Query) only when approved.

### 6.2 Stories integration

- [ ] `GET /stories` populates Recent Contributions grid
- [ ] `POST /stories` wires “Post Memory”
- [ ] Support attachments:
  - [ ] image upload and association to story
  - [ ] audio memory upload and association to story

### 6.3 Documents integration

- [ ] `GET /documents` populates Document Archive grid
- [ ] Upload Artifact flow end-to-end:
  - [ ] file picker → signed URL → upload → create metadata record
  - [ ] progress indicator and error handling
- [ ] Filters backed by real types (PDF / Handwritten / etc.)

### 6.4 Voice lab integration

- [ ] `GET /voice/samples` populates Recent Samples
- [ ] Record Sample end-to-end:
  - [ ] capture audio (browser media APIs)
  - [ ] upload audio
  - [ ] update sample status (uploaded → processing → ready)
- [ ] `GET /voice/clone-status` drives the progress ring

### 6.5 Talk integration (STT + TTS + chat)

- [ ] Decide conversation backend approach:
  - [ ] streaming responses (SSE/WebSocket)
  - [ ] message persistence in DB
- [ ] `POST /conversation/messages` sends user text
- [ ] Streaming response renders typing state and progressively appends assistant text
- [ ] Mic input:
  - [ ] STT capture and transcription
  - [ ] transcript inserted into input field
- [ ] Legacy voice playback:
  - [ ] TTS endpoint generates audio for responses (or pre-generated)
  - [ ] audio player UI states

### 6.6 Dashboard integration

- [ ] Load legacy subject profile from API
- [ ] Load memory wall content from stories/documents aggregation endpoint
- [ ] Hook quick actions to real flows (conversation create, story create, upload recording)

Acceptance criteria:

- [ ] Each screen has real network data and works with real empty/error/loading conditions.
- [ ] Mocks fully removed (or kept only as dev fallback).

---

## Phase 7 — Security, privacy, and permissions

- [ ] Implement auth (sign-in/out) and role-based access:
  - [ ] Owner/admin can manage archive
  - [ ] Contributors can post stories/uploads (if allowed)
  - [ ] Public view rules for Story Collection Portal
- [ ] Ensure encrypted transport (HTTPS) and secure cookies/session storage
- [ ] Data retention and deletion flows (Privacy Settings link)
- [ ] Audit logging for uploads and contributions

---

## Phase 8 — Quality: testing, monitoring, performance

- [ ] Component tests for critical UI pieces (forms, upload flows, chat input)
- [ ] Integration tests for key journeys:
  - [ ] Post story
  - [ ] Upload artifact
  - [ ] Record sample
  - [ ] Talk conversation
- [ ] Accessibility checks (keyboard navigation, ARIA, contrast)
- [ ] Performance:
  - [ ] image optimization
  - [ ] lazy loading for grids
  - [ ] minimize layout shift in chat
- [ ] Observability:
  - [ ] client error reporting
  - [ ] server logs + metrics

---

## Phase 9 — Deployment + environment management

- [ ] Define environments (local/dev/staging/prod)
- [ ] Configure env vars (API base URL, auth keys, storage bucket, STT/TTS provider keys)
- [ ] Deploy frontend
- [ ] Deploy backend + database + storage
- [ ] Run smoke tests in staging
- [ ] Launch checklist:
  - [ ] backups enabled
  - [ ] rate limiting / abuse prevention (especially public Stories)
  - [ ] privacy policy + support links wired

---

## Phase 10 — Analytics and iteration

- [ ] Track events:
  - [ ] story posted
  - [ ] artifact uploaded
  - [ ] voice sample recorded
  - [ ] conversation started
- [ ] Funnel metrics for contribution completion
- [ ] Feedback mechanism (support) and iteration backlog
