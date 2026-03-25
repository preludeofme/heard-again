# Heard Again - Implementation Todo (Remaining Work)

> This document tracks **incomplete work only**. Completed items have been removed.

**Status Key:**
- `[ ]` Not Started
- `[-]` In Progress
- `[~]` Partially Complete
- `[x]` Complete

---

## Phase 1: User Testing Feedback

- [x] need to have the / root page redirect to the dashboard if the user is logged in
- [x] Need to add a search component to the family tree that is collapsible and can be expanded to show the search results
  - [ ] Should be reusable across application, but start with family tree
  - [x] search and debounced type ahead
  - [x] display results with profile picture, name, and relationship
  - [x] allow selection of a family member
  - [x] show selected family member in a chip or badge
  - [x] if active page is not family tree, then there should be an Advanced search button that should take them to the family tree page with the the search component active/expanded
- [-] the application was originally built around a single person's profile but now we need to support multiple people and families
  - [x] Need to have a profile page where the user can view specific family members profiles and can switch between them
    - [x] Profile picture (i like the one from the stories page where it's tilted and has a little animation) 
    - [x] Need to have details of the person such as name, bio, birth date, death date, etc.
    - [x] Need to have stories preview section (where users can also add stories about the person, but gives a quick view of stories but routes user to stories page)
    - [x] Needs to have a simple preview (static view) of the family tree showing parents and children level but no further. then have a link to route to family tree
    - [x] Needs to route to voice lab
    - [x] Needs to route to the talk page
    - [x] Needs to have a method for navigating to different family members
  - [x] Need to remove dashboard as it's not needed with a profile page
  - [x] Need to update the navigation to reflect the new structure
  - [x] Need to have the family tree now navigate the user to the profile page of the specific family member selected
    - [x] with a specific family member selected, it should highlight that person on the family tree to show which person is currently active/selected
  - [x] The stories page should show stories for the currently selected family member or if no family member is selected it shows a random selection from the family archive of stories (like story of the day type component) and then have a way to select a specific profile
  - [x] The voice lab page should show voices for the currently selected family member or if no family member is selected it shows a random selection from the family archive of voices (like voice of the day type component) and then have a way to select a specific profile
  - [ ] The talk page should show the talk interface for the currently selected family member or if no family member is selected it shows a random selection from the family archive of talks (like talk of the day type component) and then have a way to select a specific profile  
    - [ ] Navigation should maybe be like a chat application where the sidebar shows the family members the user has chatted with (active conversations)
    - [ ] Needs to be able to create new conversation and use the family member search/selection component
  - [ ] Family documents page needs to be updated to have search component included
    - [ ] should have option to filter by family member
    - [ ] should have filter based on type of document
    - [ ] should have filter based on date range
    - [ ] should have filter based on search term
    - [ ] should have option to upload new document
    - [ ] should have option to download document
    - [ ] should have option to delete document (this should be a soft delete and can be recovered from the trash and potentially have a system in the future for voting or notifying family admins of the deletion allowing them to override or save it)
- [ ] On document upload and stories creation there needs to be some meta data that is optional to attach to the documents and stories 
  - [ ] Date added
  - [ ] Date occurred
  - [ ] Family members involved
    - [ ] Potential enhancement is to add some AI review of the document or story that will auto-suggest family members it knows about based on name, nicknames, etc. 
- [ ] Create a family timeline page that shows events in the family's history (births, deaths, marriages, stories, documents)
  - [ ] Should be dynamic and filterable by person but by default show entire family
  - [ ] Should have ability to add/edit/delete events
  - [ ] Should use chips/badges with avatars to show who the event was about
  - [ ] Needs to be performant and potentially have infinite scrolling methods for loading events 
  - [ ] Needs to have a way to view events in a calendar format

## Phase 1.2
- [x] on Family Tree, need to have the canvas be the entire container, it does not need a parent container
- [x] search and control bar should be fixed at the top of the page


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
