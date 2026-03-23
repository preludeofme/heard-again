# Heard Again - Implementation Todo (Remaining Work)

> This document tracks **incomplete work only**. Completed items have been removed.

**Status Key:**
- `[ ]` Not Started
- `[-]` In Progress
- `[~]` Partially Complete

---

## Phase 1: User Testing Feedback

- [ ] When a user signs up and finishes the steps of onboarding, it routes them back to onboarding (might be an issue with the data not saving properly)
- [ ] If user is logged in and navigates to roote / then it shoud route to the dashboard
- [ ] 


## Phase 2: Authentication (Remaining)

### Google OAuth Provider
- [~] Google OAuth provider
  - [ ] Google Console app setup
  - [ ] Client ID/Secret in env
  - [ ] Account linking for existing users

### UI - Auth Integration
- [~] Update CreateAccountPage.tsx to use NextAuth signUp

---

## Phase 4: Person/Family Tree (Remaining)

### UI - Family Tree
- [ ] Ability to merge families (in case multiple people create accounts and family trees)
  - [ ] Need to figure out how to handle this such as matching family members then join the tree together

---

## Phase 5: Stories & Memory System (Remaining)

### UI - Stories
- [~] Story editor with rich text (basic inline editing via detail page)

---

## Phase 6: Voice System Integration (Remaining)

### Database Integration for Voice
- [ ] Link voice profiles to database:
  - [ ] Save VoiceProfile records when creating profiles
  - [ ] Update profile metadata in database
  - [ ] Associate profiles with Person records
- [ ] VoiceGenerationJob tracking in database

### API Routes - Voice (Database Integration)
- [~] POST /api/voice/train - Create voice profile (exists, needs DB save)
- [~] POST /api/voice/synthesize - Generate speech (exists, needs DB save)

---

## Phase 7: Assets & File Management (Remaining)

### Storage Implementation
- [ ] Local storage adapter
- [ ] S3/R2 storage adapter (for cloud)
- [ ] Audio processing pipeline (Whisper transcription)
- [ ] Image optimization
- [ ] Video processing (optional)

---

## Phase 9: Billing & Usage (Cloud/Connected Mode)

### API Routes - Billing
- [ ] GET /api/billing/plans - List available plans
- [ ] GET /api/billing/subscription - Get current subscription
- [ ] POST /api/billing/subscribe - Subscribe to plan
- [ ] POST /api/billing/cancel - Cancel subscription
- [ ] POST /api/billing/update-payment - Update payment method
- [ ] GET /api/billing/usage - Get usage stats

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
- [ ] POST /api/instance/register - Register local instance
- [ ] GET /api/instance/status - Get connection status
- [ ] POST /api/instance/tunnel - Configure Cloudflare tunnel
- [ ] GET /api/instance/health - Health check

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

## Next Priority Actions

1. Add automated test coverage for critical API flows (relationships, GEDCOM import/export, voice generation)
2. Begin billing/Stripe Phase 9 API scaffolding
3. Prepare manual QA checklist for high-risk flows (voice generation, GEDCOM import/export, relationship editing)

### Lower Priority:
1. Billing/Stripe integration
2. Self-hosting tunnel

---

*For completed work history, see git history or the SCALABILITY_CHECKLIST.md for architectural progress.*
