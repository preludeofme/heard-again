# Heard Again - Complete Implementation Todo

> This document tracks all work needed to go from the current state (UI components with mock data) to a fully functional end-to-end application.

## Progress Legend
- [ ] Not Started
- [-] In Progress
- [~] Partially Complete
- [x] Complete

---

## Phase 1: Foundation & Infrastructure

### Database Setup
- [x] Prisma schema defined (comprehensive - 1040 lines)
- [x] Run initial migration: `npm run db:migrate`
- [x] Set up Prisma client singleton (`src/lib/prisma.ts`)
- [x] Database seed script for development data
- [x] Connection pooling configuration for production

### Environment & Configuration
- [x] `.env.example` exists
- [x] Create `.env` with actual values (DATABASE_URL, NEXTAUTH_SECRET, etc.)
- [x] TTS service environment configuration
- [x] Upload/storage configuration (local vs cloud)

### Project Structure
- [x] Create `src/lib/` utilities:
  - [x] Prisma client
  - [x] API response helpers (`api-helpers.ts`)
  - [x] Error handling utilities (`api-helpers.ts` - AppError, Errors factory)
  - [x] Validation helpers (`validation.ts`)
  - [x] Auth helpers (`auth-helpers.ts` - getAuthUser, requireWorkspaceRole)
- [x] Set up `src/hooks/` for reusable data hooks
- [x] Organize API routes by domain

---

## Phase 2: Authentication & User Management (NextAuth.js)

### New User Flow
- [ ] User auth stored in database
- [ ] workflow created
- [ ] user profile created
- [ ] user role assigned
- [ ] when login/create account then the user needs to be prompted on family name
  - [ ] user created with family name
  - [ ] Family tree should show self and then add family member when first starting
 
### Core NextAuth Setup
- [x] Install NextAuth.js v4: `npm install next-auth@4`
- [x] Install PrismaAdapter: `npm install @next-auth/prisma-adapter`
- [x] Create `auth.ts` configuration file (JWT strategy)
- [x] Configure PrismaAdapter with schema
- [x] Set up `pages/api/auth/[...nextauth].ts` handler
- [x] Create SessionProvider (`AuthProvider.tsx`) in `_app.tsx`

### Auth Providers
- [x] Credentials provider (email/password)
  - [x] Password hashing with bcrypt
  - [x] User lookup in database
  - [x] Invalid credentials handling
- [ ] Google OAuth provider
  - [ ] Google Console app setup
  - [ ] Client ID/Secret in env
  - [ ] Account linking for existing users

### Database Schema (NextAuth)
- [x] User model exists with required fields
- [x] Account model for OAuth (verify in schema)
- [x] Session model for database sessions (verify in schema)
- [x] VerificationToken for password reset
- [x] VerificationToken model exists in schema
- [ ] Add password reset token table if not present

### Password Reset Flow (Custom)
- [ ] `POST /api/auth/reset-password` - Generate reset token
- [ ] `POST /api/auth/reset-password/verify` - Verify token validity
- [ ] `POST /api/auth/reset-password/update` - Update password
- [ ] Email service integration (Resend/SendGrid/AWS SES)

### Protected Routes & Middleware
- [x] Create `middleware.ts` for route protection
- [x] Configure public vs protected routes
- [x] Middleware passes all `/api/*` routes through (API routes handle own auth)
- [ ] Auth guard component for client-side protection
- [x] Redirect unauthenticated users to login

### UI - Auth Integration
- [~] Update CreateAccountPage.tsx to use NextAuth signUp
- [x] Build Login page with NextAuth signIn
- [x] Signup API creates user + workspace + membership + subscription in transaction
- [ ] Password reset request page
- [ ] Password reset confirm page
- [ ] Update navigation with auth state (sign in/out)

---

## Phase 3: Workspace & Membership System

### API Routes - Workspaces
- [x] `POST /api/workspaces` - Create workspace
- [x] `GET /api/workspaces` - List user's workspaces
- [x] `GET /api/workspaces/[id]` - Get workspace details
- [x] `PUT /api/workspaces/[id]` - Update workspace
- [x] `DELETE /api/workspaces/[id]` - Delete workspace
- [x] `POST /api/workspaces/[id]/switch` - Set as default

### API Routes - Memberships/Invites
- [x] `POST /api/workspaces/[id]/invite` - Invite member
- [x] `GET /api/workspaces/[id]/invite` - List workspace invites
- [x] `GET /api/workspaces/[id]/members` - List workspace members
- [x] `POST /api/invites/[token]/accept` - Accept invite
- [x] `POST /api/invites/[token]/decline` - Decline invite
- [x] `PUT /api/workspaces/[id]/members/[userId]` - Update member role
- [x] `DELETE /api/workspaces/[id]/members/[userId]` - Remove member

### Controllers - Workspace
- [ ] `useWorkspaceController.ts` - Workspace management
- [ ] `useMembershipController.ts` - Members and invites

### Dashboard
- [x] `GET /api/dashboard/stats` - Workspace stats, memory wall, family members
- [x] `useDashboardController.ts` - Wired to real /api/dashboard/stats endpoint
- [x] `/dashboard` page created with real data from controller
- [x] Post-login redirect → `/dashboard`

### UI - Workspace
- [ ] Workspace switcher component
- [ ] Workspace settings page
- [ ] Member management modal
- [ ] Invite acceptance flow

---

## Phase 4: Person/Family Tree Management

### API Routes - People
- [x] `POST /api/people` - Create person
- [x] `GET /api/people` - List people in workspace (with search & type filter)
- [x] `GET /api/people/[id]` - Get person details (with relationships, voice profiles)
- [x] `PUT /api/people/[id]` - Update person
- [x] `DELETE /api/people/[id]` - Delete person
- [x] `POST /api/people/[id]/avatar` - Upload avatar (creates Asset + links to Person)

### API Routes - Relationships
- [x] `POST /api/people/[id]/relationships` - Create relationship
- [x] `GET /api/people/[id]/relationships` - Get person's relationships
- [x] `DELETE /api/relationships/[id]` - Remove relationship

### Controllers - Family Tree
- [x] FamilyTreePage.tsx - Wired to /api/people (real API)

### UI - Family Tree (Already Built, Needs Wiring)
- [x] FamilyTreePage.tsx - Wired to real people data from API
- [x] Person detail modal/page
- [x] Add/Edit person modal
- [ ] Relationship editor
- [ ] Family tree zoom/pan controls
- [ ] Ability to merge families (in case multiple people create accounts and family trees) 
  - [ ] Need to figure out how to handle this such as matching family members then join the tree together
---

## Phase 5: Stories & Memory System

### API Routes - Stories
- [x] `POST /api/stories` - Create story
- [x] `GET /api/stories` - List stories (with search, filters, pagination)
- [x] `GET /api/stories/[id]` - Get story details (with comments, assets, voice)
- [x] `PUT /api/stories/[id]` - Update story
- [x] `DELETE /api/stories/[id]` - Delete story
- [x] `POST /api/stories/[id]/publish` - Publish story
- [x] `POST /api/stories/[id]/archive` - Archive story

### API Routes - Story Assets
- [x] `POST /api/stories/[id]/assets` - Attach asset to story
- [x] `GET /api/stories/[id]/assets` - List story assets
- [x] `POST /api/stories/[id]/generate-audio` - Generate TTS for story (creates job record)

### API Routes - Comments
- [x] `POST /api/stories/[id]/comments` - Add comment (with threading)
- [x] `GET /api/stories/[id]/comments` - List story comments
- [x] `DELETE /api/comments/[id]` - Delete comment (own or admin)

### API Routes - Collections & Favorites
- [x] `POST /api/collections` - Create collection
- [x] `GET /api/collections` - List collections
- [x] `GET /api/collections/[id]` - Get collection with stories
- [x] `PUT /api/collections/[id]` - Update collection
- [x] `DELETE /api/collections/[id]` - Delete collection
- [x] `POST /api/collections/[id]/stories` - Add story to collection
- [x] `DELETE /api/collections/[id]/stories` - Remove story from collection
- [x] `GET /api/favorites` - List user's favorited stories
- [x] `POST /api/stories/[id]/favorite` - Favorite story
- [x] `DELETE /api/stories/[id]/favorite` - Unfavorite story

### Controllers - Stories
- [x] `useStoriesController.ts` - Wired to real /api/stories endpoint

### UI - Stories (Already Built, Needs Wiring)
- [x] StoriesPage.tsx - Wired to useStoriesController (real API) + Post Memory wired
- [x] Story detail page (`/stories/[id]`) with comments, favorites, audio player
- [x] Collection management pages (`/collections`, `/collections/[id]`)
- [~] Story editor with rich text (basic inline editing via detail page)
- [x] Audio recording in story creation
- [x] Favorites view

---

## Phase 6: Voice System Integration

### Current State
- [x] TTS Python service with Qwen3-TTS
- [x] Voice training API routes
- [x] Synthesis API routes
- [x] VoiceLabPage UI with voice training modal

### Database Integration for Voice
- [ ] Link voice profiles to database:
  - [ ] Save `VoiceProfile` records when creating profiles
  - [ ] Update profile metadata in database
  - [ ] Associate profiles with `Person` records
- [ ] `VoiceGenerationJob` tracking in database

### API Routes - Voice (Database Integration)
- [~] `POST /api/voice/train` - Create voice profile (exists, needs DB save)
- [~] `POST /api/voice/synthesize` - Generate speech (exists, needs DB save)
- [x] `GET /api/voice/profiles` - List profiles from DB (with personId filter)
- [x] `GET /api/voice/profiles/[id]` - Get profile details
- [x] `PUT /api/voice/profiles/[id]` - Update profile metadata (incl. set default)
- [x] `DELETE /api/voice/profiles/[id]` - Delete profile with DB cleanup
- [x] `POST /api/voice/profiles` - Create voice profile DB record

### API Routes - Voice Consent
- [x] `POST /api/voice/consent` - Record voice consent
- [x] `GET /api/people/[id]/voice-consent` - Get consent status
- [x] `PUT /api/voice/consent/[id]` - Revoke consent

### Controllers - Voice (Already Built, Needs DB Integration)
- [x] `useVoiceLabController.ts` - Wired to /api/voice/profiles + /api/assets (real DB)
- [x] `useTalkController.ts` - Wired to /api/voice/profiles + real people API

### UI - Voice
- [x] VoiceLabPage.tsx - Training UI complete, controller wired to real APIs
- [x] VoiceTrainingModal.tsx - 3-step flow complete
- [x] TalkPage.tsx - Chat UI wired to real voice profiles + people API
- [ ] Voice profile selector component
- [ ] Voice consent modal
- [ ] Generated audio player with controls

---

## Phase 7: Assets & File Management

### API Routes - Assets
- [x] `POST /api/assets/upload` - Upload file (multipart, local storage)
- [x] `GET /api/assets` - List assets (with type filter, search, pagination)
- [x] `GET /api/assets/[id]` - Get asset details
- [x] `DELETE /api/assets/[id]` - Delete asset
- [x] `GET /api/assets/[id]/download` - Download file (stream from local storage)

### Storage Implementation
- [ ] Local storage adapter
- [ ] S3/R2 storage adapter (for cloud)
- [ ] Audio processing pipeline (Whisper transcription)
- [ ] Image optimization
- [ ] Video processing (optional)

### Controllers - Assets
- [x] `useDocumentsController.ts` - Wired to /api/assets endpoint

### UI - Assets
- [x] DocumentsPage.tsx - Wired to useDocumentsController (real API)
- [ ] Asset upload component
- [ ] Asset gallery/grid view
- [ ] Audio player with transcript display

---

## Phase 8: Import/Export

### API Routes - Import
- [ ] `POST /api/import/gedcom` - Import GEDCOM file
- [ ] `POST /api/import/json` - Import JSON backup
- [ ] `POST /api/import/bulk-audio` - Bulk audio import
- [ ] `GET /api/import/jobs` - List import jobs
- [ ] `GET /api/import/jobs/[id]` - Get import status

### API Routes - Export
- [ ] `POST /api/export/json` - Export workspace data
- [ ] `POST /api/export/pdf` - Generate PDF stories
- [ ] `POST /api/export/gedcom` - Export GEDCOM
- [ ] `GET /api/export/jobs` - List export jobs
- [ ] `GET /api/export/jobs/[id]/download` - Download export

### UI - Import/Export
- [ ] Import wizard (GEDCOM, JSON, bulk audio)
- [ ] Export options page
- [ ] Job status tracking UI

---

## Phase 9: Billing & Usage (Cloud/Connected Mode)

### API Routes - Billing
- [ ] `GET /api/billing/plans` - List available plans
- [ ] `GET /api/billing/subscription` - Get current subscription
- [ ] `POST /api/billing/subscribe` - Subscribe to plan
- [ ] `POST /api/billing/cancel` - Cancel subscription
- [ ] `POST /api/billing/update-payment` - Update payment method
- [ ] `GET /api/billing/usage` - Get usage stats

### Stripe Integration
- [ ] Stripe webhook handlers
- [ ] Subscription lifecycle management
- [ ] Usage metering for cloud GPU
- [ ] Quota enforcement

### UI - Billing
- [ ] Pricing/plans page
- [ ] Subscription management
- [ ] Usage dashboard
- [ ] Payment method management

---

## Phase 10: Self-Hosting & Tunnel (Connected Mode)

### API Routes - Instance Management
- [ ] `POST /api/instance/register` - Register local instance
- [ ] `GET /api/instance/status` - Get connection status
- [ ] `POST /api/instance/tunnel` - Configure Cloudflare tunnel
- [ ] `GET /api/instance/health` - Health check

### Tunnel Implementation
- [ ] Cloudflare tunnel integration
- [ ] Automatic subdomain assignment
- [ ] SSL certificate management
- [ ] Connection status monitoring

### Tutorial UI
- [ ] Interactive tutorial for self-hosting setup
- [ ] Cloudflare tunnel walkthrough
- [ ] Storage configuration guide

---

## Phase 11: Search & Discovery

### API Routes - Search
- [x] `GET /api/search?q=...` - Global search (stories, people, assets)
- [~] `GET /api/search/people?q=...` - Search people (subset of global)
- [~] `GET /api/search/stories?q=...` - Search stories (subset of global)
- [ ] `GET /api/search/suggestions?q=...` - Autocomplete

### UI - Search
- [x] Global search page (`/search`) with debounced input
- [x] Search results grouped by type (stories, people, assets)
- [~] Advanced filters
- [ ] Recent/favorites quick access

---

## Phase 12: Trust, Consent & Safety

### API Implementation
- [ ] Voice consent recording system
- [ ] AI-generated audio watermarking/labeling
- [ ] Data retention policies
- [ ] Permanent deletion (GDPR compliance)

### UI - Safety
- [ ] Consent recording modal
- [ ] AI disclosure notices
- [ ] Data export/deletion tools
- [ ] Privacy settings

---

## Phase 13: Testing & Quality Assurance

### Automated Testing
- [ ] Unit tests for API routes
- [ ] Integration tests for voice pipeline
- [ ] E2E tests for critical user flows
- [ ] Database migration tests

### Manual QA
- [ ] Cross-browser testing
- [ ] Mobile responsiveness testing
- [ ] Accessibility audit (WCAG)
- [ ] Performance testing (Lighthouse)

---

## Phase 14: Deployment & Operations

### Production Setup
- [ ] Production database setup
- [ ] Environment configuration
- [ ] Docker configuration for deployment
- [ ] CI/CD pipeline

### Monitoring & Logging
- [ ] Error tracking (Sentry)
- [ ] Application monitoring
- [ ] Voice service health monitoring
- [ ] Usage analytics

### Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] User documentation
- [ ] Self-hosting guide
- [ ] Admin/runbook documentation

---

## Quick Reference: Already Built (UI Only)

These components exist with Material UI but use mock data:
- [x] `LandingPage.tsx` - Marketing landing page
- [x] `CreateAccountPage.tsx` - Account creation UI
- [x] `Dashboard.tsx` - Memory wall dashboard
- [x] `FamilyTreePage.tsx` - Visual family tree
- [x] `StoriesPage.tsx` - Story contributions UI
- [x] `TalkPage.tsx` - AI chat interface
- [x] `VoiceLabPage.tsx` - Voice training & synthesis
- [x] `VoiceTrainingModal.tsx` - 3-step voice creation
- [x] `DocumentsPage.tsx` - Document management
- [x] `AudioTrimmer.tsx` - Audio editing component
- [x] `ToastProvider.tsx` - Notification system

---

## Quick Reference: TTS Service (Complete)

The Python TTS service is fully functional:
- [x] `tts-service/app/main.py` - FastAPI endpoints
- [x] `tts-service/app/model_manager.py` - Qwen3-TTS integration
- [x] `tts-service/app/style_presets.py` - Voice style control
- [x] `tts-service/app/transcriber.py` - Whisper transcription
- [x] Voice cloning from reference audio
- [x] Voice design from natural language
- [x] Speech synthesis with style params

---

## Next Priority Actions

**Completed:**
1. ~~Run database migration~~ ✓
2. ~~Set up Prisma client~~ ✓
3. ~~Implement authentication (NextAuth.js)~~ ✓
4. ~~Create base API route handlers~~ ✓
5. ~~Wire up Person CRUD to database~~ ✓
6. ~~Wire up Story CRUD to database~~ ✓
7. ~~Connect Voice profiles to database~~ ✓
8. ~~Build login page~~ ✓
9. ~~Workspace CRUD + members + invites~~ ✓
10. ~~Collections + favorites~~ ✓
11. ~~Wire controllers (dashboard, stories, documents)~~ ✓
12. ~~Dashboard page with real data~~ ✓
13. ~~File upload endpoint + asset download~~ ✓
14. ~~Story detail page with comments/favorites~~ ✓
15. ~~Search API + search page~~ ✓
16. ~~Collection management UI~~ ✓
17. ~~Person Detail Modal + Add/Edit Modal~~ ✓
18. ~~Wire Person modals to real API endpoints~~ ✓
19. ~~Add Favorites link to navigation~~ ✓
20. ~~Wire audio recording to API for story creation~~ ✓
21. ~~Create reusable data hooks (useApi, useDebounce, usePagination, useToggle)~~ ✓
22. ~~Add connection pooling for production database~~ ✓
23. ~~TTS service environment configuration~~ ✓
24. ~~Upload/storage configuration (local/S3/R2)~~ ✓

**Phase 1: Foundation & Infrastructure - COMPLETE ✓**

**Next Up:**
1. UI polish and testing of current features
2. Review remaining lower priority items

**Lower Priority:**
1. Password reset flow + email service
2. Billing/Stripe integration
3. Import/Export
4. Self-hosting tunnel

