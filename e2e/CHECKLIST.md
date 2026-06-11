# E2E Test Checklist — Heard Again

> **Purpose**: Interactive test playbook for Hermes to verify the full application before each PR.
> **How to use**: Hermes works through each section, calling APIs and using the browser, explaining results as they go.
> **Prerequisites**: Dev server running at `https://localhost:4777`, demo user seeded, curl + browser tools available.

---

## 1. ⚡ Auth — Signup & Login

### 1.1 Unauthenticated redirect
- [x] Visit `/profile` without a session → redirects to `/login`

### 1.2 Login form renders
- [x] Visit `/login` → email field, password field, "Sign In" button visible
- [x] Link to `/signup` exists on the page

### 1.3 Invalid credentials
- [x] POST `email=wrong@x.com&password=wrong` → error message shown ("Invalid email or password")
- [x] User stays on login page (no redirect)

### 1.4 Valid login (demo user)
- [x] POST `email=demo@heardagain.com&password=demo123` → session cookie set
- [x] Redirect to `/legacy` (or `/dashboard`)

### 1.5 Session persists
- [x] After login, navigate to `/account` → page renders (not redirected to login)

### 1.6 Signout
- [x] Sign out → session cleared → visiting `/profile` redirects to `/login`

### 1.7 Signup
- [x] Visit `/signup` → first name, last name, email, password fields visible
- [x] Submit with valid data → account created, auto-logged in, redirected to onboarding
- [x] Submit with duplicate email → friendly error shown

---

## 2. 🚀 Onboarding

### 2.1 New user onboarding
- [ ] Newly signed-up user is redirected to `/onboarding`
- [ ] Onboarding shows welcome/get-started content
- [ ] Completing onboarding redirects to app

---

## 3. 👪 Family Tree

### 3.1 Tree page loads
- [ ] `/family-tree` loads without error
- [ ] Family members visible (Grandpa Bob, Grandma Maggie, etc.)
- [ ] Tree visualization renders (SVG/Canvas/graph)

### 3.2 Person detail
- [ ] Clicking a tree node navigates to person detail
- [ ] Person detail shows name, dates, bio, timeline events
- [ ] Family relationships (parents, children, spouses) shown

### 3.3 Timeline events
- [ ] Person has timeline events (education, occupation, custom)
- [ ] Events display with dates and descriptions

---

## 4. 📖 Stories — CRUD

### 4.1 Story listing
- [ ] `/stories` lists existing stories
- [ ] Published stories have a "Published" status indicator
- [ ] Draft stories have a "Draft" badge

### 4.2 Create story
- [ ] `/stories/new` shows title + content fields
- [ ] Can select subject/speaker (family member)
- [ ] Can set story date with precision (exact/year/approximate)
- [ ] Can save as Draft
- [ ] Can Publish directly
- [ ] After save, redirects to story detail

### 4.3 Story detail
- [ ] Title, content, date, author displayed
- [ ] Subject/Speaker names shown as clickable person links
- [ ] Favorite button visible (heart/star)

### 4.4 Edit story
- [ ] Can edit title and content from detail page
- [ ] Changes persist after save

### 4.5 Delete story
- [ ] Can delete a story
- [ ] Deleted story removed from list

### 4.6 Rewrite first person
- [ ] Story rewrite from first‑person perspective available
- [ ] Rewritten content replaces or augments original

---

## 5. ❤️ Favorites

### 5.1 Favorite a story
- [ ] Clicking favorite icon on story detail toggles state
- [ ] Favorited state persists on reload

### 5.2 Favorites page
- [ ] `/favorites` shows all favorited stories
- [ ] Unfavoriting removes from list

---

## 6. 📂 Collections

### 6.1 Collections page
- [ ] `/collections` loads without error
- [ ] Existing collections shown (if any)

### 6.2 Create collection
- [ ] Can create a new collection with name
- [ ] Collection appears in list

### 6.3 Add stories to collection
- [ ] Can add stories to a collection from story detail
- [ ] Collection shows its member stories

---

## 7. 💬 Comments

### 7.1 Add comment
- [ ] Story detail has comment input
- [ ] Can type and submit a comment
- [ ] Comment appears after submission

### 7.2 Threaded replies
- [ ] Can reply to an existing comment
- [ ] Reply appears nested under parent comment

---

## 8. 🎙️ Voice & Narration

### 8.1 Voice lab
- [ ] `/voice-lab` loads without error
- [ ] Shows options to create/import voice profiles
- [ ] Upload sample button visible

### 8.2 Voice profiles
- [ ] Existing voice profiles listed (if any)
- [ ] Profile shows name, status, source info

### 8.3 Story narration player
- [ ] Story detail has "Listen" / "Prepare & Play" section
- [ ] Voice selector dropdown shows available profiles
- [ ] Clicking "Prepare & Play" queues narration job
- [ ] Progress bar shown while generating
- [ ] Audio player appears when ready
- [ ] Can play/download the generated audio

### 8.4 Narration approval
- [ ] Can approve/reject generated narration
- [ ] Approved narration becomes the default version
- [ ] "Narrated" vs "Original" text toggle available

---

## 9. 💰 Billing & Usage Gating

### 9.1 Account page
- [ ] `/account` shows subscription/plan info
- [ ] Plan type displayed (e.g. "Free Local", "Self-Hosted")
- [ ] Usage tab shows storage + generation minutes status

### 9.2 Subscription page
- [ ] `/subscription` shows current plan details
- [ ] Available plans listed with features and pricing
- [ ] Upgrade/purchase flow available
- [ ] Can cancel current subscription

### 9.3 Usage bar on narration player
- [ ] FREE plan shows "Unlimited generation" (self-hosted = unlimited)
- [ ] HYBRID plan shows progress bar with min used / min quota
- [ ] At 80%+ usage, bar turns warning (orange) color
- [ ] At 100% usage, bar turns error (red) + upgrade CTA button

### 9.4 API — Subscription
- [ ] `GET /api/billing/subscription` returns plan + entitlements
- [ ] FREE plan returns `generationMinutesIncluded: 0`, `memberQuota: 1`
- [ ] Entitlements include feature flags (tunnel, cloud GPU, storage)

### 9.5 API — Usage
- [ ] `GET /api/billing/usage` returns storage, generation, members stats
- [ ] Percentages computed correctly (0 if quota is 0)
- [ ] `formattedUsed` / `formattedQuota` strings rendered

### 9.6 Quota gating — Narrate API
- [ ] FREE plan (0 min = unlimited): narrate returns 200 (allowed)
- [ ] CONNECTED plan (0 min, not FREE): returns **402** "not included"
- [ ] HYBRID plan, quota exhausted: returns **402** "all used"
- [ ] 402 responses include `code: "QUOTA_EXCEEDED"` and `upgradeUrl`

### 9.7 Usage tracking
- [ ] `incrementGenerationMinutes()` called on narration completion
- [ ] `generationMinutesUsed` increments in DB
- [ ] Next quota check reflects the incremented value

### 9.8 UpgradePrompt component
- [ ] Self-hosted users see upgrade banner on cloud-only features
- [ ] Clicking upgrade links to `/account?tab=subscription`

### 9.9 Dashboard subscription card
- [ ] Dashboard shows `SubscriptionStatusCard` when usage > 70%
- [ ] Card shows storage, generation, members progress bars
- [ ] "Manage" link navigates to account page

---

## 10. 🔍 Search

### 10.1 Search page
- [ ] `/search` loads with search input
- [ ] Can type a query and submit

### 10.2 Search results
- [ ] Matching stories, people, documents shown in results
- [ ] Results link directly to the found item

---

## 11. 📅 Timeline

### 11.1 Timeline loads
- [ ] `/timeline` shows chronological events
- [ ] Stories and person events interleaved by date

### 11.2 Timeline filtering
- [ ] Can filter by family member
- [ ] Can filter by event type

---

## 12. 📄 Documents

### 12.1 Documents page
- [ ] `/documents` loads without error
- [ ] Upload/create document button visible

### 12.2 Document detail
- [ ] Document page shows content
- [ ] Can edit document metadata
- [ ] Can delete document

---

## 13. 💬 Chat (AI) — OUT OF SCOPE

Chat is a separate microservice and not in scope for this test cycle.

---

## 14. 📦 Export / Import

### 14.1 Export page
- [ ] `/export` shows export options (PDF, JSON, GEDCOM, ZIP)
- [ ] Can initiate an export
- [ ] Export job status is tracked
- [ ] Completed export can be downloaded

### 14.2 Import page
- [ ] `/import` shows import options (GEDCOM, bulk audio)
- [ ] Can upload a GEDCOM file
- [ ] Import preview shows parsed data before committing

### 14.3 GEDCOM export
- [ ] `GET /api/export/gedcom` returns valid GEDCOM file
- [ ] All family members included with relationships

---

## 15. 🔗 Family Merge

### 15.1 Merge page loads
- [ ] `/family-merge` loads without error
- [ ] Shows existing merge proposals (if any)

### 15.2 Merge analysis
- [ ] `GET /api/family-merge/analyze` finds potential duplicates
- [ ] Analysis shows match score per pair

### 15.3 Merge execution
- [ ] Can create a merge proposal
- [ ] Can execute merge proposal
- [ ] Merged records combine correctly

---

## 16. 📊 Dashboard

### 16.1 Dashboard loads
- [ ] `/dashboard` loads without error
- [ ] Stats display (people count, stories count, etc.)
- [ ] Latest stories shown as preview cards

### 16.2 Dashboard API
- [ ] `GET /api/dashboard/stats` returns familyspace info + stats
- [ ] Stats include people, stories, voiceProfiles, members, generations
- [ ] Onboarding state returned (has first person, first story, etc.)

---

## 17. 🏠 Self-Hosting & Setup

### 17.1 Self-hosting page
- [ ] `/self-hosting` loads with deployment info

### 17.2 Setup guide
- [ ] `/setup-guide` loads with step-by-step instructions

---

## 18. 🌐 Tunnel

### 18.1 Tunnel setup page
- [ ] `/tunnel-setup` loads without error
- [ ] Shows tunnel status (enabled/disabled)
- [ ] Can enable tunnel
- [ ] Tunnel URL displayed when active

---

## 19. 🔐 Permissions & Security

### 19.1 Unauthenticated API access
- [ ] `GET /api/billing/subscription` without session → 401
- [ ] `GET /api/dashboard/stats` without session → 401

### 19.2 Public pages (no auth required)
- [ ] `/login` → renders
- [ ] `/signup` → renders
- [ ] `/forgot-password` → renders
- [ ] `/privacy` → renders
- [ ] `/terms` → renders

### 19.3 Protected pages (redirect to login)
- [ ] `/dashboard` → redirects to login
- [ ] `/account` → redirects to login
- [ ] `/stories` → redirects to login
- [ ] `/family-tree` → redirects to login
- [ ] `/voice-lab` → redirects to login
- [ ] `/chat` → redirects to login
- [ ] All other private routes → redirect to login

### 19.4 Security headers
- [ ] Response includes `X-Content-Type-Options: nosniff`
- [ ] Response includes `X-Frame-Options: DENY`
- [ ] Response includes `Content-Security-Policy`
- [ ] Response includes `Referrer-Policy`
- [ ] CSRF token required for mutation endpoints

### 19.5 MFA
- [ ] Account settings has MFA section
- [ ] Can enable MFA (TOTP)
- [ ] MFA required for OWNER role operations (once enabled)

---

## 20. ✅ API Validation

### 20.1 CSRF token
- [ ] `GET /api/csrf-token` returns `{ csrfToken: "..." }`

### 20.2 Dashboard stats
- [ ] `GET /api/dashboard/stats` → `{ success: true, data: { familyspace, stats, ... } }`

### 20.3 Plans
- [ ] `GET /api/billing/plans` → lists all available plans
- [ ] Each plan has name, price, entitlements

### 20.4 Stories API
- [ ] `GET /api/stories` → returns stories for current familyspace

### 20.5 Favorites API
- [ ] `GET /api/favorites` → returns favorited stories

### 20.6 Subscription API
- [ ] `GET /api/billing/subscription` → returns subscription + plan entitlements

### 20.7 Usage API
- [ ] `GET /api/billing/usage` → returns aggregated usage for billing period

### 20.8 Instance health
- [ ] `GET /api/instance/health` → returns 200

---

## 21. 🧪 Data Edge Cases

### 21.1 Empty state
- [ ] New familyspace with no people → empty state shown on family tree
- [ ] No stories → "Create your first story" prompt

### 21.2 Large payloads
- [ ] Story with very long content (>10K chars) loads correctly
- [ ] Large GEDCOM imports handle gracefully

### 21.3 Concurrent operations
- [ ] Starting a second narration while one is in progress → deduplicated or queued

---

## 22. 📱 UI / UX Checks

### 22.1 Loading states
- [ ] Pages show loading spinner/progress while fetching data
- [ ] Error states show helpful messages with retry options

### 22.2 Navigation
- [ ] Desktop sidebar / top nav works
- [ ] Mobile bottom nav works
- [ ] Breadcrumb navigation present on detail pages

### 22.3 Responsive
- [ ] Pages render at 375px width (mobile)
- [ ] Pages render at 1440px width (desktop)

### 22.4 Accessibility
- [ ] All interactive elements have accessible labels
- [ ] Color contrast meets WCAG AA standards
- [ ] Tab order follows logical flow
