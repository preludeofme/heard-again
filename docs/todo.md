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
  - [x] Should be reusable across application, but start with family tree
  - [x] search and debounced type ahead
  - [x] display results with profile picture, name, and relationship
  - [x] allow selection of a family member
  - [x] show selected family member in a chip or badge
  - [x] if active page is not family tree, then there should be an Advanced search button that should take them to the family tree page with the the search component active/expanded
- [x] the application was originally built around a single person's profile but now we need to support multiple people and families
  - [x] The app needs to be also built around the idea that a user can select a family member and navigate around the application with that selected profile.
    - [x] use case: User goes to family_tree, user selects Ryan, user clicks on voice-lab (voice lab will be filtered down to Ryan's voices), user selects documents and navigates to documents where all the documents filtered for ryan are. 
    - [x] Add a component to the header that will display the selected family member that will persist through navigations throughout the app
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
  - [x] The talk page should show the talk interface for the currently selected family member or if no family member is selected it shows a random selection from the family archive of talks (like talk of the day type component) and then have a way to select a specific profile  
    - [x] Navigation should maybe be like a chat application where the sidebar shows the family members the user has chatted with (active conversations)
    - [x] Needs to be able to create new conversation and use the family member search/selection component
  - [x] Family documents page needs to be updated to have search component included
    - [x] should have option to filter by family member
    - [x] should have filter based on type of document
    - [x] should have filter based on date range
    - [x] should have filter based on search term
    - [x] should have option to upload new document
    - [x] should have option to download document
    - [x] should have option to delete document (this should be a soft delete and can be recovered from the trash and potentially have a system in the future for voting or notifying family admins of the deletion allowing them to override or save it)
- [x] On document upload and stories creation there needs to be some meta data that is optional to attach to the documents and stories 
  - [x] Date added (auto-generated)
  - [x] Date occurred (user-specified when content/event happened)
  - [x] Family members involved (DocumentPerson junction table with role)
  - [x] AI review enhancement framework (aiSuggestedPeople, aiSummary, aiConfidence fields)
- [x] Create a family timeline page that shows events in the family's history (births, deaths, marriages, stories, documents)
  - [x] Dynamic and filterable by person, shows entire family by default
  - [x] Uses existing PersonEvent for add/edit/delete (via /api/timeline POST)
  - [x] Chips/badges with avatars showing who events are about
  - [x] Performant with pagination (50 events per page, load more button)
  - [~] View events in calendar format (basic list view for now, calendar view can be added later)

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
