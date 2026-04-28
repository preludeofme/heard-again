# Heard Again — UX Audit Report

**Date**: 2026-04-15
**Reviewer**: Claude Code
**Codebase branch**: feat/mvp-release

---

## Executive Summary

- The visual language is warm, intentional, and on-brand — a serif-forward palette (#16334a deep navy, warm creams) creates appropriate emotional register for a memory-preservation product.
- Navigation architecture is solid on desktop but critically broken on mobile: the bottom nav labels and routes do not match, and two major sections (Timeline, Family Tree, Favorites) are unreachable from mobile.
- The most important user flow — creating a story — requires zero navigation clicks once on the Stories page, which is correct. Voice creation is the most friction-heavy flow (5+ steps) but is appropriately complex given the domain.
- Empty and error states are inconsistently handled: `PersonDetailModal` falls through to mock data when no real data is passed (lines 202–208 default params), masking real fetch failures in production.
- Accessibility is partially addressed (aria-labels on dialogs, keyboard support on tree canvas) but has critical gaps: the mobile bottom nav uses unlabeled icons, focus management is missing in multi-step modals, and color contrast on secondary text (#546669 on #f6f3ee) is borderline at small sizes.
- The "Start Conversation" (AI chat) entry point on the dashboard routes to `/profile` rather than a dedicated chat route, leaving the feature's discoverability entirely dependent on the profile page content.

---

## Navigation Architecture

### Desktop Sidebar (256px fixed rail)

```
Heard Again
├── Profile          /profile → /profile/[firstPersonId]
├── Voice Lab        /voice-lab
├── Documents        /documents
├── Stories          /stories
├── Timeline         /timeline
├── Favorites        /favorites
└── Family Tree      /family-tree

Footer:
├── Support          /support
└── Privacy Settings /privacy
```

- Depth from any nav item to content: **1 click** (flat architecture — good).
- Active state correctly highlights current route including prefix matches for `/profile/*` and `/stories/*` (Layout.tsx lines 270–273).
- The `FamilyspaceSwitcher` component exists but is **not rendered in Layout.tsx**. Familyspace switching is only accessible from wherever the consumer mounts it — currently absent from the primary nav.

### Mobile Bottom Nav

Defined in Layout.tsx lines 222–236:

| Tab label | Route mapped | Icon |
|-----------|-------------|------|
| Home      | /profile    | HomeIcon |
| Lab       | /voice-lab  | MicIcon |
| Add       | /documents  | AddIcon |
| Stories   | /stories    | PersonIcon (wrong — should be BookIcon) |
| Profile   | /account    | Avatar |

**Critical issues:**
- The "Add" tab icon is `AddIcon` but it routes to `/documents`. Users expect a universal add/create action, not Documents.
- Timeline, Family Tree, and Favorites are **completely absent** from mobile navigation. Users on mobile cannot access these sections at all without knowing the direct URL.
- The Stories tab uses `PersonIcon` — semantically wrong for stories content.
- `getMobileNavValue()` (lines 152–157) defaults to index 0 (Home/Profile) for any unmatched route, meaning active state is wrong for Timeline, Family Tree, Favorites, and Documents (when navigated via URL).
- Bottom nav background `#f6f3ee` with no top border or elevation creates visual ambiguity about where the content ends.

### Route Map (all top-level pages)

```
/ (index)           → LandingPage
/login              → LoginPage
/signup             → CreateAccountPage
/onboarding         → OnboardingPage (3-step: Family Name → Profile → Done)
/dashboard          → redirects to /profile
/profile            → redirects to /profile/[firstPersonId]
/profile/[id]       → PersonProfilePage (full bio, stories timeline, documents)
/voice-lab          → VoiceLabPage
/documents          → DocumentsPage
/stories            → StoriesPage
/stories/[id]       → StoryDetailPage
/timeline           → TimelinePage
/favorites          → FavoritesPage
/family-tree        → FamilyTreePage
/search             → SearchPage
/collections        → CollectionsPage
/account            → AccountPage
/pricing            → PricingPage
/export             → ExportPage
/import             → ImportPage
/family-merge       → FamilyMergePage
/familyspaces/[id]    → FamilyspaceDetailPage
/profile/[id]/[id]  → nested profile (sub-page)
```

**IA issues:**
- `/dashboard` silently redirects to `/profile` — the mental model of "home/dashboard" is lost.
- The "Profile" nav item leads to the first person in the familyspace, not the logged-in user's own profile. This conflation of "family member profile" and "my account" is confusing. Account settings are at `/account`.
- No dedicated "Chat" route — AI conversation with a persona lives within the profile page, discoverable only after opening a person's profile.

---

## User Flow Analysis

### Flow 1: Create a New Story (Text)

**Current path**:
1. Click "Stories" in sidebar → `/stories`
2. Scroll past hero section to "Contribution Hub" (or click bounce-arrow button)
3. Type in "Story Title" field (optional)
4. Type in content textarea (required)
5. Click "Post Memory" button

**Click count**: 2 clicks (nav + submit), plus scrolling
**Text input**: Required (content)

**Friction**:
- The hero section is full-viewport-height (`minHeight: 'calc(100vh - 290px)'`), forcing a scroll before the creation form is visible. The animated bounce-arrow helps but the form is not above the fold on any screen size.
- The "Write a Story" form has no visible submit button affordance until content is typed — the button (`disabled={!storyContent.trim()}`) renders but looks inactive with no clear disabled styling differentiation from active.
- There is no title validation or minimum-length guidance.
- The Stories page footer (lines 524–594) repeats navigation links with `href="#"` placeholders — dead links in production.

**Recommendation**: Surface the creation form above the fold or provide a dedicated `/stories/new` route with a focused creation experience. Remove the full-viewport hero for authenticated users who are already committed to the product.

---

### Flow 2: Clone/Train a Voice (Voice Lab)

**Current path**:
1. Click "Voice Lab" in sidebar → `/voice-lab`
2. Click "Create New Voice" button (VoiceLabPage line 173)
3. `VoiceTrainingModal` opens
4. Click upload area to pick audio file → file picker opens
5. Select file → AudioTrimmer UI appears
6. Set trim points → click "Use this clip" (AudioTrimmer confirm action)
7. File uploads with progress indicator
8. Type voice name in "Name this voice" field (required)
9. Optionally type or click a style suggestion chip for voice description
10. Click "Create Voice" button
11. Wait 10–15 seconds for training
12. Click "Done" on success state

**Click count**: 7+ clicks (not counting file system navigation)
**Steps with blocking waits**: 1 (training, 10–15s)

**Friction**:
- Steps 2 and 4 are in VoiceLabPage and VoiceTrainingModal respectively — users click "Create New Voice" without understanding what's required first. A checklist or pre-flight guidance ("You'll need: a 30-second+ audio clip") before the modal opens would reduce surprise at step 4.
- The style description field (step 9) is completely optional but has a complex suggestion chip interface. Users unfamiliar with voice synthesis don't know how much this matters.
- `VoiceConsentModal` exists as a component but is **not wired into the VoiceTrainingModal or VoiceLabPage flow**. Voice consent recording appears to be a disconnected feature — the ethical/legal gate is present in code but not enforced in the UI flow.
- Language is hardcoded to `'English'` (VoiceTrainingModal line 99) with no user-facing selection — the `language` prop exists but is never surfaced.

**Recommendation**: Add a "Before you start" pre-flight card on the Voice Lab page showing the 3 requirements (audio file, name, description). Wire VoiceConsentModal into the creation flow as step 0 for non-self users.

---

### Flow 3: Add a New Person to the Family Tree

**Current path (via Family Tree page "Add Relative" button)**:
1. Click "Family Tree" in sidebar → `/family-tree`
2. Click "Add Relative" button at bottom of canvas OR "Add" button on a parent-level card
3. `handleAddPerson()` is called (FamilyTreePage line 394) → fires `onAddPerson?.()` callback
4. Parent page (`family-tree.tsx`) handles the actual modal open — the modal is not opened from within FamilyTreePage itself for new creates
5. `AddEditPersonModal` opens in "create" mode
6. **Step 1 - Basic Info**: Enter First Name (required), Last Name, Display Name, Person Type → click "Next"
7. **Step 2 - Dates & Details**: Birth date, death date, middle name, nickname, maiden name, suffix, bio → click "Next"
8. **Step 3 - Review**: Preview summary → click "Create Person"
9. `window.location.reload()` is called (FamilyTreePage line 438) — hard page reload

**Click count**: 4 clicks minimum (nav + add button + 2× Next + Create)
**Step count**: 3–4 modal steps

**Friction**:
- Step 2 puts 6 text fields on screen (middle name, nickname, maiden name, suffix plus dates) — most users will skip all of these. Consider collapsing optional fields behind a disclosure or moving them to an edit-later pattern.
- Photo upload on step 1 is a placeholder `<Paper>` with no actual file input wired up (AddEditPersonModal lines 271–309). The "Add a photo" affordance does nothing on click.
- After creation, the page hard-reloads (`window.location.reload()`), destroying scroll position and any unsaved state. This is a known gap (comment on line 438).
- The `handleAddPerson` in FamilyTreePage calls `onAddPerson?.()` but does not directly open `addEditModalOpen` — it relies on the parent route component to handle modal state. This creates a disconnect when the parent doesn't implement `onAddPerson`.
- The "Relationships" step (step 3) only appears when `existingPeople` is passed — it is not passed in the current family-tree page implementation, so relationship creation is always a separate post-creation step.

**Recommendation**: Wire the photo upload. Replace the hard reload with a data refetch. Show the relationship step by default (pre-populated with tree context). Collapse optional name fields into a "More details" accordion on step 2.

---

### Flow 4: Upload a Document

**Current path**:
1. Click "Documents" in sidebar → `/documents`
2. Locate the "Upload Artifact" card (always last in grid, but visually indistinct from document cards at a glance)
3. Click or drag-and-drop to the card
4. OS file picker opens → select file
5. Upload runs with no in-card progress indicator (DocumentsPage uses `FileUpload` component — no loading state visible in the card itself)
6. `onUploadSuccess` fires → `onUploadSuccess?.()` refreshes the list

**Click count**: 2 clicks (nav + card/file pick)

**Friction**:
- The upload card at DocumentsPage line 248 is styled identically to document cards (same `#f6f3ee` background, same `borderRadius: 3`). It is only distinguishable by the dashed border and upload icon. On a dense grid it can be overlooked.
- There is no visible upload progress within the card. The `FileUpload` component renders `children` (the card) without surfacing upload state back into it.
- The `handleUploadError` at line 33 calls `console.error` only — no user-facing toast or error message.
- Filter chips (`All`, `PDF`, `Photo`, `Letter`, `Handwritten`) use document `type` field for filtering (line 25), but the document type is set server-side at upload time. Users cannot filter by types they don't yet have documents for — stale filter chips remain visible but return empty results with no "No documents of this type" message.
- The `FilterIcon` button at line 87 does nothing — it has no `onClick` handler.

**Recommendation**: Add a persistent upload CTA button in the page header. Show upload progress inside the drop zone. Provide an error toast. Hide filter chips for types with zero documents.

---

### Flow 5: Start an AI Chat Session with an Ancestor Persona

This flow has the most discoverability problems of any feature.

**Current path**:
1. Click "Profile" in sidebar → `/profile` → redirects to `/profile/[firstPersonId]`
2. On PersonProfilePage, locate the "Talk with [Name]" action button (rendered around line 304 in profile/[id].tsx)
3. Click the button
4. Chat interface opens (inline within profile page or dedicated section)

**Click count**: 2 clicks (nav + chat button)

**Friction**:
- The Dashboard "Start Conversation" card (Dashboard.tsx line 288) routes to `/profile` — not to a chat interface. It lands the user on the profile page with no further guidance, requiring them to find the chat button themselves.
- The chat entry point is context-dependent: it is only accessible from a person's profile page. There is no global "Talk to an ancestor" entry in the sidebar.
- The flow is only meaningful after a voice profile has been created. Users without a voice profile who click "Start Conversation" land on a profile page that shows a "Go to Voice Lab" prompt — two levels of redirection before the actual feature.
- There is no `/chat` or `/conversations` route in the page listing, suggesting AI chat is fully embedded in the profile page, making it impossible to deep-link to a conversation or view conversation history from a dedicated page.

**Recommendation**: Add "Chat" to the sidebar (or at minimum, to mobile bottom nav). Create a `/chat/[personId]` route. Make the Dashboard "Start Conversation" card route directly to the chat interface with the primary person pre-selected.

---

### Flow 6: Navigate to and Play Back a Recorded Audio Memory

**Current path (via Stories page)**:
1. Click "Stories" in sidebar → `/stories`
2. Scroll past hero to "Recent Contributions" section
3. Click on an audio-type story card (dark navy background with play icon)
4. Navigate to `/stories/[id]` (story detail page)
5. On detail page, locate the `generatedAudio` player card (StoryDetailPage lines 245–274)
6. Click play button

**Click count**: 3 clicks (nav + story card + play)

**Alternative path (via Dashboard Memory Wall)**:
1. Dashboard loads with Memory Wall
2. Click "Listen to Legacy" button on audio-memory card (Dashboard.tsx line 207)
3. The button has no `onClick` handler — it does nothing

**Friction**:
- The "Listen to Legacy" button on the Dashboard Memory Wall card (Dashboard.tsx line 207) is non-functional. No `onClick`, no route, no audio playback.
- The audio player on the StoryDetailPage (lines 249–253) toggles local state `isPlayingAudio` but does not connect to any audio element or audio URL — the play/pause is visual-only. The `generatedAudio.storagePath` is available but no `<audio>` element or `AudioPlayer` component is rendered. This is a **broken playback experience** in production.
- The StoriesPage story cards for `type === 'audio'` show a static progress bar at "33%" width with a hardcoded duration of "1:42" (lines 494–506) — this is display-only mock UI, not connected to actual audio data.
- `AudioPlayer` component (a full-featured player with seek, volume, speed controls) exists but is not used on either the Stories list or the Story detail page.

**Recommendation**: Wire `AudioPlayer` into `StoryDetailPage` using `story.generatedAudio`. Fix the Dashboard "Listen to Legacy" button. Replace the static progress bar in story cards with real duration data from the API.

---

### Flow 7: Manage Family Familyspace Members

**Current path**:
1. Access familyspace settings — the `FamilyspaceSwitcher` component is not rendered in Layout.tsx, so the primary entry point for familyspace management is unclear
2. Navigate to `/familyspaces/[id]/settings` (if the user knows the URL, or finds it through `FamilyspaceSwitcher` → "Familyspace settings" menu item)
3. From familyspace settings, locate member management
4. `MemberManagementModal` opens (used within familyspace settings pages)
5. Enter email address, select role (Editor/Viewer), click "Invite"

**Click count**: 3+ clicks, but discoverability is the primary problem

**Friction**:
- `FamilyspaceSwitcher` is a fully built component with a "Familyspace settings" menu item but is **not rendered in Layout.tsx**. The sidebar has no familyspace indicator or settings entry point. Users cannot find familyspace management through the primary nav at all.
- `MemberManagementModal` (line 239) only offers "Editor" and "Viewer" invite roles. Admin invite is not supported through the UI — only through direct role escalation after joining.
- Role change menu (`getAvailableRoles`) at line 189 only shows roles below the selected member's current role, preventing promotion to a higher role. This is likely intentional for permission safety, but the UX provides no explanation for why some roles are missing from the dropdown.
- Error handling for failed role changes (line 155) calls `console.error` only — no user-facing feedback when a role update fails.
- There is no confirmation dialog for member removal — clicking "Remove from familyspace" in the overflow menu immediately fires the DELETE request (line 160).

**Recommendation**: Add `FamilyspaceSwitcher` to the desktop sidebar and mobile header. Add a "Members" link in the sidebar for users with OWNER or ADMIN roles. Add a confirmation step before member removal.

---

## Design Quality Assessment

### Visual Hierarchy

- Strong. The primary color (#16334a deep navy) is used consistently for headings, primary actions, and selected states. Warm cream backgrounds (#fcf9f4, #f6f3ee, #ffffff) create appropriate layering.
- The Newsreader serif font for headings pairs well with the brand positioning. The `className="serif-font"` approach is used inconsistently — some components use `fontFamily: 'var(--font-newsreader), serif'` inline, others use the class. Both should be unified.
- The MUI theme primary color and the hardcoded `#16334a` values are used interchangeably across components with no single token source — a color drift risk as the codebase grows.

### Consistency Issues

- Two different icon systems coexist: `@mui/icons-material` (imported components) and Material Symbols Outlined (string-based via `MaterialSymbolsIcon` in Layout.tsx line 38). The sidebar nav uses the string system; every other component uses MUI icons. This creates visual inconsistency in icon weight and fill style.
- Button styles: some use `textTransform: 'none'`, others don't. The MUI default uppercases button text, so components that forgot `textTransform: 'none'` will render uppercase buttons inconsistently.
- Card border radius varies: `borderRadius: 2`, `3`, `4`, `6`, `8` are all used across components with no clear size scale mapping to intent.

### Typography

- Scale is well-chosen: h1 (hero) → h4 (section) → h6 (card title) → body1/body2 → caption. The serif italic on hero copy is effective.
- Line heights are explicitly set in most places (1.6–1.9 for body copy) — good for readability.
- The `StoriesPage` hero h1 at `fontSize: { xs: '3rem', md: '4.5rem' }` is dramatic but appropriate for an emotional entry point.

### Color Usage

- Primary: #16334a (navy) — used correctly as the dominant brand anchor
- Secondary: #546669 (muted teal) — used for supporting text; contrast against #f6f3ee cream background is approximately 3.8:1, which **fails WCAG AA** (4.5:1 required) for normal text at small sizes
- Accent: #d0e3e6 (light teal) — used for selected states and chips; acceptable
- Tertiary: #e0c29a / #feddb4 (gold/warm) — used sparingly for decorative elements; good
- Error states use MUI default red (#e53935 in AudioRecorder) — appropriate
- The `selfCardColor` green (#1a6b5a) in FamilyTreePage line 138 for "self" family member cards introduces a fourth distinct hue not referenced anywhere else in the design system

---

## Mobile Experience

### What Works

- The `useMediaQuery(theme.breakpoints.down('md'))` breakpoint switch in Layout.tsx correctly provides a mobile-specific layout.
- The sticky AppBar with search and notification icons is appropriately minimal.
- Card hover effects (`transform: 'translateY(-4px)'`) are desktop-only interactions that don't interfere on touch.
- Content padding (`p: 2` on mobile vs `p: { xs: 2, md: 4 }` in Dashboard) adapts reasonably.

### What Fails

- **Bottom navigation is broken**: Only 4 of 7 nav destinations are reachable. Timeline, Family Tree, and Favorites have no mobile access point.
- **The "Add" tab routes to Documents**: The `AddIcon` implies a creation action. This is a significant mismatch between icon semantics and behavior.
- **Family Tree is not mobile-adapted**: `FamilyTreePage` uses absolute positioning and pixel-based card widths (PARENT_CARD_WIDTH = 288, GRANDPARENT_CARD_WIDTH = 256). On a 390px mobile screen, a two-parent row would be 624px wide before gaps, requiring horizontal scroll with no pan affordance (the hand tool requires deliberate mode-switching).
- **The Insight/Legend sidebar** in FamilyTreePage (`display: { xs: 'none', xl: 'flex' }`) is hidden on everything below 1536px width — including desktop. The sidebar only appears on XL screens, meaning most desktop users don't see it either.
- **VoiceLabPage** uses a two-column Grid (`xs: 12, lg: 5` and `lg: 7`) that stacks correctly on mobile, but the "Create New Voice" button at the top of the left column appears before the voice list on mobile — reasonable.
- **Story detail page** has no back-to-stories gesture affordance beyond the `<ArrowBack>` button. On mobile, users expect swipe-back navigation which is not implemented.
- **Dialog widths**: All dialogs use `maxWidth="sm"` or `"md"` with `fullWidth` — these render full-screen on narrow mobile, which is correct behavior.

---

## Empty & Error States

### Inventory

| Location | Type | State | Quality |
|----------|------|--------|---------|
| VoiceLabPage — "Your Voices" panel | Empty | Icon + text + CTA button | Good |
| VoiceLabPage — "Test a Voice" panel | Empty (no voice selected) | Icon + text, no CTA | Acceptable |
| StoriesPage — Recent Contributions | Empty | Uses `EmptyState` component | Good |
| DocumentsPage — Document grid | Empty | Uses `EmptyState` component | Good |
| PersonDetailModal — Stories tab | Empty | Icon + text + Add Story button (only visible in footer when tab is active) | Adequate |
| PersonDetailModal — Voice Profiles tab | Empty | Icon + text, no direct CTA within the empty state itself | Weak |
| PersonDetailModal — Relationships tab | Empty | Icon + text, no direct CTA within the empty state | Weak |
| FamilyTreePage — empty tree | Default data with empty arrays | No explicit empty state UI — canvas renders with no cards and no CTA | **Missing** |
| Dashboard — Memory Wall | No empty state | If `memoryWallItems` is empty, the grid renders nothing with no message | **Missing** |
| AudioPlayer | Load error | Shows error text in Paper | Acceptable |
| AudioRecorder | Mic permission denied | Shows Alert with warning | Good |
| StoryDetailPage — loading | Spinner centered in full viewport | Good |
| StoryDetailPage — error | Error text + "Back to Stories" button | Good |
| PersonDetailModal — loading | Spinner in dialog | Good |
| PersonDetailModal — error | Error text + Close button | Good |

**Critical gap**: `PersonDetailModal` defaults all props to mock data (lines 202–208 — `person = mockPerson`, `stories = mockStories`, etc.). When the API fetch fails and `person` is null but `error` is set, the check at line 279 (`if (error && !person)`) shows the error state correctly. However, if the API returns `{ success: false }` and the component receives `null` for person but the parent doesn't pass `error`, the component falls through to `if (!person)` (line 310) showing "Person Not Found" instead of a retry option.

**Critical gap**: The Dashboard's "Listen to Legacy" button (line 207) and the audio progress bars in story cards are non-functional UI (see Flow 6). These present false affordances to users.

---

## Accessibility

### What Is Present

- ARIA dialog labels: `aria-labelledby` on `PersonDetailModal` (line 346), `AddEditPersonModal` (line 735), `MemberManagementModal` (line 195), `VoiceTrainingModal` (line 128), `VoiceConsentModal` (line 127).
- Close button aria-labels: "Close dialog" on all modals.
- Keyboard navigation on FamilyTreePage canvas: arrow keys for pan, +/- for zoom (lines 937–944). Cards have `tabIndex={0}` and `onKeyDown` handlers for Enter/Space (FamilyTreePage lines 144–145).
- AudioPlayer play button has `aria-label={isPlaying ? 'Pause' : 'Play'}` (line 261).
- AudioRecorder pause/stop buttons have aria-labels (lines 247, 258).
- Search icon button in Layout.tsx has `aria-label="Search"` (line 191). Notifications button has `aria-label="Notifications"` (line 197).

### Gaps

- **Mobile bottom nav**: `BottomNavigationAction` labels ("Home", "Lab", "Add", "Stories", "Profile") are set but the icons are not descriptive on their own, and the "Add" label conflicts with its Documents destination. Screen readers will announce "Add" for a button that navigates to Documents.
- **Color contrast**: #546669 on #f6f3ee is ~3.8:1 (fails WCAG AA for body text < 18px). This combination appears throughout: nav item labels, card subtitles, DocumentsPage filter chips unselected state, story meta text.
- **Focus management**: Multi-step modals (AddEditPersonModal, VoiceTrainingModal) do not programmatically move focus to the first interactive element when advancing steps. After clicking "Next", focus remains on the "Next" button, which may become disabled or change to "Create Person".
- **No `role` or `aria-live` on training status**: The VoiceTrainingModal training progress (LinearProgress + text) has no `aria-live="polite"` region, so screen readers won't announce when training completes.
- **The `MaterialSymbolsIcon` component** renders as a `<Typography component="span">` with a font-ligature icon. This is visually correct but completely invisible to screen readers — no `aria-hidden="true"` and no fallback label. All sidebar nav items rendered via this component are missing accessible icon labels.
- **Image alt text**: The `<Image>` in the StoriesPage hero (line 116) uses a hardcoded Google CDN URL with no alt text attribute set (uses default empty string from Avatar). The Dashboard profile card image has `alt={legacySubject.fullName}` — correct.
- **Family tree SVG connectors** have no `aria-label` or role — they are decorative so `aria-hidden="true"` should be set on the SVG element.

---

## Priority Recommendations

### High — Breaks Core Experience

1. **Fix the Story Detail audio player** (StoryDetailPage lines 245–274): Wire `AudioPlayer` component to `story.generatedAudio`. The current play button toggles CSS state only — no audio plays. This is the core media playback feature of the product.

2. **Fix the Dashboard "Listen to Legacy" button** (Dashboard.tsx line 207): Add an `onClick` handler that navigates to the story detail or plays audio inline.

3. **Fix the static audio progress bars on story cards** (StoriesPage lines 494–506): Replace hardcoded "1:42" and 33% progress with real data or remove the progress bar if audio data isn't available on the list view.

4. **Add Timeline, Family Tree, and Favorites to mobile navigation**: The current 5-tab bottom nav excludes 3 of 7 nav items. Either expand to a scrollable nav, add an overflow "More" tab, or restructure to prioritize the 5 most-used destinations correctly.

5. **Fix the "Add" bottom nav tab**: It routes to `/documents` but uses `AddIcon` — either make it a creation FAB, route it correctly, or relabel it to "Docs".

### High — Feature Correctness

6. **Wire `FamilyspaceSwitcher` into the layout**: The component is built but not rendered. Desktop users have no way to access familyspace switching or settings through the primary nav.

7. **Wire VoiceConsentModal into the voice creation flow**: The consent gate exists but is not enforced. This is an ethical and legal gap — voice cloning without recorded consent creates liability.

8. **Fix the photo upload in AddEditPersonModal** (lines 271–309): The "Add a photo" `<Paper>` has no file input. Users expect this to work.

9. **Replace `window.location.reload()` after person create/delete** (FamilyTreePage lines 438, 455): Use a data refetch or router invalidation. Hard reloads destroy user state and create a jarring experience.

### Medium — Friction and Discoverability

10. **Surface the Stories creation form above the fold**: The full-viewport hero forces every user to scroll before they can create a story. For authenticated users, the creation form should be the first visible element.

11. **Add a "Chat" entry point in the sidebar or dedicated route**: AI conversation is a primary differentiator but has no dedicated navigation entry point. Create `/chat/[personId]` or `/conversations` and add it to the sidebar.

12. **Add the FilterIcon onClick handler in DocumentsPage** (line 87): The filter icon button does nothing. Either wire it to open a filter panel or remove the button.

13. **Show the Family Tree empty state**: When all three generation arrays are empty, the canvas renders a large empty teal grid with no CTA. Add an empty state with "Add your first family member" button.

14. **Unify icon systems**: Choose between `@mui/icons-material` and Material Symbols Outlined for the sidebar. Currently both are used; Material Symbols string-based icons in Layout.tsx are inaccessible to screen readers.

15. **Add `aria-hidden="true"` to Material Symbol icons** or replace with a labeled alternative.

### Low — Polish and Consistency

16. **Fix secondary text color contrast** (#546669 on #f6f3ee): Increase to at least #4a5f62 or use a slightly darker background to achieve 4.5:1 WCAG AA compliance for small body text.

17. **Add `aria-live="polite"` to VoiceTrainingModal training status** (lines 414–435): Announce completion to screen readers.

18. **Add focus management to multi-step modals**: On step advance, move focus to the first field in the new step using `autoFocus` or a ref.

19. **Fix the Stories page footer dead links** (lines 540–553): `href="#"` for "The Voice Lab", "Memory Documents", "Family Stories" should route to real pages or be removed.

20. **Unify `textTransform: 'none'` on all buttons**: Audit and standardize — currently applied inconsistently, producing a mix of cased and uppercased button labels.

21. **Add `aria-hidden="true"` to the Family Tree SVG connector overlay** (FamilyTreePage line 983): Decorative SVG should be hidden from screen readers.

22. **Fix Dashboard "Start Conversation" route** (Dashboard.tsx line 288): Routes to `/profile` — should route to a chat interface or at minimum to the specific person's profile with the chat section focused.

---

## Active Family Member Selection — Deep Dive

### How It Currently Works (Actual Implementation)

The app maintains a "selected family member" via `SelectedFamilyMemberContext` (`UI/src/contexts/SelectedFamilyMemberContext.tsx`). This is pure React `useState` — it resets on every full page reload or new browser session.

**Where the context gets set:**
| Trigger | How |
|---------|-----|
| Clicking a person on Family Tree (`family-tree.tsx` line 518) | `setSelectedFamilyMember()` then pushes to `/profile/[id]` |
| Changing the person filter on Stories page (`stories.tsx` line 70) | `setSelectedFamilyMember()` |
| Changing the person filter on Documents page (`documents.tsx` lines 58, 85) | `setSelectedFamilyMember()` |
| Changing the person filter on Voice Lab page (`voice-lab.tsx` line 70) | `setSelectedFamilyMember()` |
| Clicking X on the chip or clearing the filter | `clearSelectedFamilyMember()` → resets to null ("Global Archive") |

**Where the context is displayed:**
| Location | Component | What renders |
|----------|-----------|--------------|
| Mobile top bar | `ActiveMemberHeader` (Layout.tsx line 179) | Avatar + name in dark navy pill, OR "Global Archive" badge when null |
| Mobile top bar | `SelectedFamilyMemberChip` (Layout.tsx line 195) | Duplicate chip with X close button — **same info as above, rendered simultaneously** |
| Desktop sidebar | Nothing | **No indicator exists on desktop** |
| Dashboard | `legacySubject` prop | Hardcoded, does not read from context |

**Critical gaps diagnosed:**

1. **Desktop has no active member indicator at all.** The sidebar shows 7 nav items and nothing else. A user on desktop has no persistent visual anchor for who they are currently "inside the context of." If they set a filter on Stories and navigate to Documents, there is no reminder that content is scoped.

2. **Two redundant components in the mobile header.** `ActiveMemberHeader` and `SelectedFamilyMemberChip` both appear simultaneously in the mobile top bar (Layout.tsx lines 179, 195) rendering the same person twice. One shows a navy pill, the other a dismissible chip. The user sees the same name twice and two different ways to interact with it.

3. **The context resets on page reload.** There is no `localStorage` persistence. Opening a new tab or refreshing loses the selection. For a product where users repeatedly return to the same person over days, this means re-selecting on every session.

4. **The per-page person filters and the global context are the same thing — but this is invisible to the user.** Changing the person dropdown on the Stories page silently changes the context for all pages. A user who filters Stories to "Margaret Thompson" will find Voice Lab and Documents also filtered to her — with no explanation of why.

5. **The Dashboard ignores the context entirely.** `Dashboard` takes a `legacySubject` prop hardcoded from the page server/route level. Selecting a different person in context does not update the Dashboard hero card.

6. **No quick-switch affordance.** If a user is looking at Margaret Thompson's stories and wants to check her son James's documents, the path is: navigate to Family Tree → find James → click him → navigate to Documents. That is 3–4 clicks minimum, and on mobile, Family Tree is not in the bottom nav.

7. **For large families, the only browsable member list is the Family Tree canvas.** The canvas renders 3 generations at a time, centered on the selected person. To find a cousin two generations removed requires panning or searching. There is no paginated list, no alphabetical index, no recently viewed rail.

---

### The Core Mental Model Problem

The app conflates two distinct concepts:

- **"The person I am currently managing / adding content for"** — a familyspace-like context, e.g. "I'm working on Grandma Evelyn's archive today"
- **"The person whose content I'm browsing"** — a filter context, e.g. "Show me only Margaret's stories"

Currently both are served by the same `selectedFamilyMember` context. This creates confusion: is clearing the context just "unfilter this page" or "exit this person's archive"? The "Global Archive" label on `ActiveMemberHeader` suggests the former is the default mode, but the Dashboard is always scoped to one person regardless.

---

### Scale Analysis: What Breaks at 50+ Members

| Problem | Appears at | Impact |
|---------|-----------|--------|
| Family Tree canvas requires 5+ pans to find a distant relative | ~20 members | Navigation |
| Per-page person dropdown becomes a long scrollable list with no search | ~30 members | Filtering |
| No recently-viewed members means repeat navigation every session | ~15 members | Session continuity |
| No alphabetical or generational grouping in any list | ~50 members | Findability |
| Context reset on reload forces re-selection on every session | Any count | Continuity |

---

### Alternative Patterns and Recommendations

The following are distinct design approaches, ordered from least to most structural change required.

---

#### Option A — Persist + Surface the Current Model (Low Effort)

Fix the existing system without redesigning it. Addresses the most critical gaps.

**Changes:**
1. **Persist to `localStorage`**: On `setSelectedFamilyMember`, write to `localStorage`. On app load, read from `localStorage` and hydrate the context. One person's archive session persists across refreshes and tabs.
2. **Add active member indicator to desktop sidebar**: Below the nav items, add a persistent "Viewing" section showing the selected person's avatar and name with a "Switch" link. On mobile, remove the duplicate — keep only `ActiveMemberHeader` and wire its click to open the member picker.
3. **Add search to the per-page person dropdowns**: Replace the plain `<Select>` with a searchable autocomplete (MUI `Autocomplete`) so users can type a name rather than scroll.
4. **Unify the per-page filter and the global context visually**: Add a banner or pill on Stories/Documents/Voice Lab that says "Showing content for [Name] — change" so the connection between the filter and global context is explicit.

**Effort**: 1–2 days. **Solves**: reload persistence, desktop blindspot, scroll fatigue on large families.

---

#### Option B — URL-Based Member Context (Medium Effort, Recommended)

Encode the active member into the URL. Every page that is member-scoped carries the person ID in the route.

**Proposed structure:**
```
/profile/[personId]            → person overview (existing, already correct)
/profile/[personId]/stories    → stories scoped to this person
/profile/[personId]/documents  → documents scoped to this person
/profile/[personId]/voice-lab  → voice lab scoped to this person
/profile/[personId]/timeline   → timeline scoped to this person
```

**Top-level routes become the "global archive" view:**
```
/stories        → all stories, unfiltered (discovery mode)
/documents      → all documents, unfiltered
/voice-lab      → all voice profiles, unfiltered
```

**Changes:**
1. The sidebar navigation changes based on context: when a person is selected (URL contains `/profile/[personId]`), the sidebar items link to their scoped sub-routes. When in global mode, they link to top-level routes.
2. `ActiveMemberHeader` reads from `router.query.personId` rather than React context — no reset on reload.
3. The "Switch member" action is just navigating to a different person's profile, which is a standard link.
4. Deep linking works: sharing `/profile/abc123/stories` opens the right person's stories immediately.

**Effort**: 3–5 days (route restructure + sidebar refactor). **Solves**: all persistence issues, deep linking, clear mental model.

---

#### Option C — Persistent Member Rail in Sidebar (Medium Effort)

Add a "Recent / Pinned Members" rail to the sidebar — a compact list of avatar thumbnails for recently viewed and pinned people. This is the Netflix/Spotify "recently played" pattern adapted for a family context.

**What it looks like:**
```
Heard Again
─────────────────────
[Recently viewed]
● Evelyn May Carter     ← active (highlighted)
● James Carter
● Margaret Thompson
  + View all members
─────────────────────
Profile
Voice Lab
Documents
...
```

**Behavior:**
- Clicking a person in the rail sets them as active and navigates to their profile.
- The active person is highlighted (already have a dark navy card style from Family Tree).
- Rail stores up to 5 recent members; "View all" opens a searchable drawer over the full family list.
- Pinning a person (star icon on hover) promotes them to the top of the rail permanently.

**Effort**: 2–3 days. **Solves**: quick-switch for 2–10 frequently-used members, reduces Family Tree navigation for daily use.

---

#### Option D — Member-Switcher Flyout in the Header (Low-Medium Effort)

Replace `ActiveMemberHeader` and `SelectedFamilyMemberChip` with a single, clickable member-switcher component in both mobile and desktop headers. Clicking opens a searchable flyout showing all family members.

**Flyout structure:**
```
┌─────────────────────────────────────────┐
│  Switch Family Member         [× Close] │
├─────────────────────────────────────────┤
│  🔍 Search by name...                   │
├─────────────────────────────────────────┤
│  RECENTLY VIEWED                        │
│  ● Evelyn May Carter          [Select]  │
│  ● James Carter               [Select]  │
├─────────────────────────────────────────┤
│  ALL MEMBERS  (A–Z)                     │
│  ● Alice Thompson             [Select]  │
│  ● Evelyn May Carter  ✓                 │
│  ● James Carter               [Select]  │
│  ● Margaret Thompson          [Select]  │
│  ...                                    │
│  [Load more]                            │
└─────────────────────────────────────────┘
```

**Behavior:**
- The flyout opens on click of the active member indicator in the header.
- Search filters the list in real time.
- Selecting a person sets them in context and closes the flyout.
- "Recently viewed" section is populated from `localStorage`.

This works well for families up to ~200 members (search handles larger).

**Effort**: 2–3 days. **Solves**: quick-switch from anywhere, scale to large families via search, removes redundant dual-component problem.

---

### Recommended Combination

For the fastest path to a good experience across small and large families:

| Priority | Change | Effort |
|----------|--------|--------|
| 1 | **Persist context to `localStorage`** — survives reload | 2 hours |
| 2 | **Remove `SelectedFamilyMemberChip` from mobile bar** — keep only `ActiveMemberHeader`, make it clickable | 1 hour |
| 3 | **Add `ActiveMemberHeader` to the desktop sidebar** below the nav items | 2 hours |
| 4 | **Make `ActiveMemberHeader` open a searchable member-switcher flyout** (Option D) | 1 day |
| 5 | **Replace per-page `<Select>` dropdowns with `Autocomplete`** for search-as-you-type | half day |
| 6 | **Store up to 10 recently viewed members in `localStorage`** and show them in the flyout | half day |
| 7 (future) | **Migrate to URL-based routing** (Option B) for deep linking and share-ability | 3–5 days |

Total for items 1–6: ~3 days. This resolves the "who am I looking at" confusion on both mobile and desktop, scales to hundreds of members via search, and survives page reloads.

---

### Flow Comparison: Switching from Evelyn to James (Before vs After)

**Current flow (before):**
1. Realize you're on Evelyn's content with no way to switch from current page
2. Click "Family Tree" in sidebar (on mobile: unreachable without knowing URL)
3. Wait for canvas to load
4. Find James on the canvas (pan if necessary)
5. Click James → navigates to his profile and sets context
6. Navigate back to Stories/Documents/etc.

**Click count**: 4–6 clicks + potential panning

**After (with member-switcher flyout):**
1. Click the active member indicator in the header (shows "Evelyn")
2. Type "James" in the search field
3. Click "James Carter"
4. Content immediately rescopes to James on the current page

**Click count**: 3 clicks, no navigation required
