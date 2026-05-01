# Heard Again — UX/UI Refactor Spec

**Status:** Active design specification  
**Branch:** prod-twwo  
**Last Updated:** 2026-04-29

---

## Original Design Vision

This application must feel like **entering a loved one's living archive** — not dashboard software, not a document manager. Think Apple-level simplicity, museum exhibit warmth, ancestry-style storytelling, and high-trust archival design.

**Keywords:** timeless · heirloom · editorial · museum · legacy · calm · human

---

## 1. Information Architecture

### Current State (as-built)

The ArchiveShell lens-switching pattern is already correct and must be preserved. The sidebar nav in `Layout.tsx` is archive-centric. The core IA works.

**What's broken** is how sub-items relate to the primary nav. The sidebar lists both `/archive` (root) and `/archive?lens=voices` + `/archive?lens=keepsakes` as separate nav items — this creates false hierarchy where lenses look like destinations.

### Target IA

```
Primary Navigation (sidebar rail)
├── Archive              → /archive (defaults to Life Journey lens)
├── Contribute           → /contribute
├── Family Members       → /family-tree
└── ──────────────────
    Support              → /support (footer)
    Privacy Settings     → /privacy (footer)

Within Archive (lens switcher — NOT separate nav items)
├── Life Journey         (default)
├── Stories
├── Keepsakes
└── Voices
```

**Remove from sidebar nav items array in `Layout.tsx`:**
- `Voice Memories → /archive?lens=voices`
- `Keepsakes → /archive?lens=keepsakes`

These are lenses inside Archive, not navigation destinations. Their presence in the sidebar creates the impression of separate products.

**Mobile bottom nav (4 slots + More):**
```
Archive  |  Contribute  |  Family  |  [+ FAB]  |  More
```
The FAB (SpeedDial) covers Add Story / Upload Keepsake / Add Person.
More → Favorites, Account.
Remove "Voices" from primary bottom nav — it's a lens within Archive.

### Navigation Hierarchy Rules

1. Archive is the primary destination. It is the home.
2. Lenses (Journey, Stories, Keepsakes, Voices) are views within Archive — not siblings of Archive.
3. The person selector (Autocomplete in ArchiveShell) is the pivot for person-centered browsing, not a separate "Family Members" lens.
4. Family Members (family-tree) is a management and navigation tool — you go there to manage people, then return to Archive anchored to that person.
5. Contribute is a focused creation flow, not a section of the archive.

---

## 2. User Flow — First-Time Experience

### Entry Condition
New user, no familyspace data, onboarding state: all false.

### Step 1 — Name Your Archive
**Route:** `/archive` (new user)  
**UI State:** ArchiveShell hero renders with placeholder data  
**What shows:** OnboardingChecklist is visible above RecentStoriesFeed  
**Checklist copy for Step 1:**

> **Add your first family member**  
> Every archive begins with a person. Who are you preserving this for?

**CTA:** "Add a Person" → `/family-tree?add=1`  
**What unlocks:** Step 2 becomes actionable; ArchiveShell hero begins showing the person's name

### Step 2 — Capture the First Memory
**Route:** `/contribute` (post Step 1 complete)  
**UI State:** ContributePage shows person name prominently in the hero headline  
**Checklist copy for Step 2:**

> **Capture your first memory for [Person Name]**  
> A story. A moment. Even one sentence changes everything.

**CTA:** "Write a Memory" or "Record a Story" (two equal options, no default hierarchy yet)  
**What unlocks:** Life Journey lens populates with first timeline event; Stories lens shows first entry

### Step 3 — Add a Keepsake
**Route:** `/archive?lens=keepsakes` (post Step 2)  
**Checklist copy for Step 3:**

> **Add a photo or keepsake for [Person Name]**  
> A photo, a letter, a certificate. These are the artifacts that prove a life was lived.

**CTA:** "Upload a Keepsake" → opens upload flow within Keepsakes lens  
**What unlocks:** Keepsakes lens fills; ArchiveShell stats update

### Step 4 — Bring Their Voice to Life
**Route:** `/archive?lens=voices` (post Step 3)  
**Checklist copy for Step 4:**

> **Preserve [Person Name]'s voice**  
> Let future generations hear them tell their own story.

**CTA:** "Create a Voice" → opens VoiceTrainingModal  
**Framing:** Not "Voice Lab" or "Training" — frame it as "preserving a voice"  
**What unlocks:** Stories can be narrated; a "Hear this story" button appears on story cards

### Step 5 — Invite Family (OWNER/ADMIN only)
**Checklist copy:**

> **Invite family to contribute**  
> Memories grow richer when more people share them.

**CTA:** "Send an Invitation" → familyspace settings  
**What unlocks:** Contributor count in ArchiveShell stats becomes meaningful

### After All Steps Complete
OnboardingChecklist returns `null` (already implemented correctly).  
Dashboard shifts to `RecentStoriesFeed` + `QuickActionsRail` as the primary surface.

---

## 3. Page-Level Redesigns

### A. Archive Landing (ArchiveShell + Dashboard Content)

**File:** `UI/src/components/archive/ArchiveShell.tsx`  
**File:** `UI/src/pages/archive.tsx`

**Current problems:**
- Archive stats row shows computed nonsense: `Life Events = stats.stories + stats.documents` — this is a lie
- Person selector label says "Viewing" — confusing; "Whose archive?" is clearer
- Contribute CTA in the hero is competing with the lens switcher

**Required changes:**

1. Fix stat calculation in `archiveCounts` — remove the fabricated `Life Events` count; replace with `Milestones` (from actual timeline event count, not stories+documents)

2. Rename Autocomplete label from `"Viewing"` to `"Whose archive?"` and placeholder from `"Entire family archive"` to `"Everyone"` — this communicates the person-centered model immediately

3. Move the "Help tell their story" Contribute CTA out of the ArchiveShell hero. It belongs on the Contribute page and in the Stories lens empty state — not competing with archive navigation.

4. Replace with a smaller secondary action in the hero: `"+ Add Memory"` as a quiet icon button — not a full gradient button

5. The archive hero should show a **lifespan** below the person's name when a person is selected:
   - If birth and death year are known: `1934 – 2018`
   - If only birth year: `Born 1934`
   - If no dates: omit entirely

**Hero layout for person-selected state:**
```
[128px avatar/photo]  [Person Name, large serif]
                       [Born 1934 – 2018, secondary serif italic]
                       [Preserving memories across generations.]
                  
[84 Stories]  [12 Voices]  [37 Keepsakes]  [5 Contributors]
```

**Hero layout for family-wide state:**
```
[Crest/initial]   [Buck Family Archive]
                   [Preserving memories across generations]
                   
[84 Stories]  [12 Voices]  [37 Keepsakes]  [8 Family Members]
```

---

### B. Life Journey Lens (Timeline)

**File:** `UI/src/components/pages/TimelinePage.tsx`  
**File:** `UI/src/components/archive/lenses/LifeJourneyLens.tsx`

**Current problems:**
1. The filter bar has `FormControl` / `Select` / `TextField date pickers` — enterprise form controls that break the "exploring a life" feeling
2. `Add a Milestone` button is prominent in the header competing with the storytelling experience
3. Horizontal view "drag to explore" hint is good, but the card offsetting (`mb: 24 / mt: 24`) creates visual chaos at sparse data

**Required changes:**

1. **Remove** the date range `TextField` inputs (`dateFrom`, `dateTo`). Replace with decade buttons if filtering by era is needed later. For now, type filters are sufficient.

2. **Move** `Add a Milestone` to a FAB-style button that floats at bottom-right of the timeline content, or to a ghost timeline item at the end of the list:
   ```
   [last event card]
   [+ Add the next chapter →]  (ghost card, dashed border)
   ```

3. **Rename** the "Add Timeline Event" dialog title to `"Add a Life Moment"` — emotionally warmer language

4. The filter button group labels: keep `All | Stories | Milestones | Keepsakes | Life Events` but reduce pill size for mobile — they currently overflow

5. **Empty state** — see Section 4

6. For the horizontal view, only activate stagger (even/odd offsets) when there are 4+ events — prevents the chaos of 1-2 event layouts

---

### C. Stories Lens

**File:** `UI/src/components/pages/StoriesPage.tsx`  
**File:** `UI/src/components/archive/lenses/StoriesLens.tsx`

**Current problems:**
1. The featured story card uses `authorAvatarUrl` as the background image — this is never populated from real data; the featured card always renders as a color block
2. Story submission form (title, content, date, location, relationship) is buried below the stories grid — users who want to contribute never find it
3. The inline story creation form competes with the reading experience

**Required changes:**

1. **Remove** the inline story form from `StoriesPage`. All story creation goes through `/contribute`. The Stories lens is for **reading**, not writing. Replace with a single contextual CTA at the top:
   - If no stories: empty state (see Section 4)
   - If stories exist: quiet "+ Add to this story" link that routes to `/contribute?subjectId=xxx`

2. **Featured story card**: when `authorAvatarUrl` is null (which is always), use a warm gradient background keyed to the person's `ProfileColors` variant — not a transparent color block. The featured card should feel curated, not broken.

3. The `StoriesLens` randomly shuffles 6 stories from the family archive when no person is selected. This is good behavior but should be labeled:
   ```
   "From across the family archive"   [Browse all →]
   ```
   Not just an unlabeled random grid.

4. Story cards: remove the `type` chip ("Spoken" / "Written"). Instead, use an icon: 🎙 for audio stories, 📖 for written. Chips feel like metadata tags; icons feel like natural affordances.

---

### D. Voices Lens (VoiceLab → Voice Memories)

**File:** `UI/src/components/pages/VoiceLabPage.tsx`  
**File:** `UI/src/components/archive/lenses/VoicesLens.tsx`

**Current problems:**
1. Everything is named in technical terms: "Training Samples", "Voice Model", "Voice Lab", "Synthesize"
2. The UX is optimized for the operator (the person doing voice training) not the beneficiary (family member hearing it)
3. No explanation of what the voice will be used for — users don't understand the end result

**Required redesign framing:**

The Voices lens has two states that must be designed separately:

**State 1 — No voice created yet (empty)**
See Section 4 for empty state copy.

**State 2 — Voice exists (listening experience)**
When a voice profile exists, the primary surface should be **audio playback**, not voice management.

Layout:
```
[Person photo / avatar — large, warm]
[Person Name]'s Voice
────────────────────────────────────
"Hear [Person Name] tell a story"

[Story title] ▶ Play
[Story title] ▶ Play
[Story title] ▶ Play
                       [+ Add another story to read →]
────────────────────────────────────
[Manage voice profile ↗]  (small, secondary link — not prominent)
```

The voice management UI (upload training samples, retrain, delete) is **secondary** — accessible via a "Manage voice profile" link that opens a separate management sheet/dialog. It is not the primary surface.

**Language changes throughout VoiceLabPage:**
| Current | Replace with |
|---------|-------------|
| "Voice Lab" | "Voice Memories" |
| "Training Samples" | "Voice recordings" |
| "Start Voice Training" | "Create the voice" |
| "Voice Model" | "Voice profile" |
| "Synthesize Speech" | "Hear this story" |
| "Delete Voice Profile" | "Remove this voice" |

---

### E. Keepsakes Lens (Documents)

**File:** `UI/src/components/pages/DocumentsPage.tsx`  
**File:** `UI/src/components/archive/lenses/KeepsakesLens.tsx`

**Current problems:**
1. The filter labels are `All | Photo | Letter | Handwritten | Document | Other` — "Document" and "Other" are catch-all tech categories that break the "heirloom drawer" metaphor
2. The `EmptyState` component is used but the messaging is still generic

**Required changes:**

1. Rename filter labels:
   | Current | Replace with |
   |---------|-------------|
   | Document | Papers |
   | Other | Everything else |
   
   Better yet, use: `All · Photos · Letters · Handwritten · Papers`

2. The upload interaction: currently `FileUpload` component is shown inline. Move upload to a prominent "Add a keepsake" button at the top that opens a contextual upload sheet. The keepsake grid should feel like a museum collection, not a file manager with an upload widget embedded.

3. Card layout: the current `DocumentThumbnail` component should be used. Ensure cards have a warm shadow and slightly rotated treatment for handwritten items (optional `transform: rotate(-0.5deg)` on `Letter` and `Handwritten` types).

---

### F. Family Tree (Navigation, Not Feature)

**File:** `UI/src/components/pages/FamilyTreePage.tsx`

The family tree needs one key behavioral change: selecting a person in the family tree should **anchor the archive to that person**, then navigate back to `/archive`. The tree is a navigation system for the archive.

The "View Profile" button already exists in the `FamilyTreeSidebar`. Add a second action:
- "Open Archive" → sets `SelectedFamilyMemberContext` + routes to `/archive`

This closes the loop: user discovers a relative in the tree → clicks "Open Archive" → sees their lens-switched archive anchored to that person.

---

## 4. Empty State Rewrites

All empty states must:
- Name the person (when one is selected)
- Explain what will exist here when it's populated
- Provide exactly one action

### Life Journey — No Events

**Current:**
> "The journey hasn't begun yet"  
> "Start adding stories, milestones, and keepsakes to map out the life journey."

**Replace with (person selected):**
> **[Person Name]'s story is waiting to be written.**  
> Add the first chapter — a birth, a milestone, a memory.  
> `[Add a Life Moment]`

**Replace with (no person selected):**
> **Your family's story starts here.**  
> Add a milestone to begin the life journey for any family member.  
> `[Add a Life Moment]`

---

### Stories — No Stories

**Current (`StoriesPage.tsx:154`):**
> "No stories told yet"  
> "Be the first to share a memory of [Name]."

**Replace with (person selected):**
> **No one has shared a memory of [Person Name] yet.**  
> The first story you share will become the heart of this archive.  
> `[Share a memory →]`

**Replace with (no person selected):**
> **Your family archive is empty.**  
> Start with a moment that matters — one memory, one voice, one story.  
> `[Share the first story →]`

---

### Stories — No Narrated Stories (audio filter active)

**Current:**
> "No stories told yet" (generic)

**Replace with:**
> **No spoken stories yet.**  
> When [Person Name] has a voice profile, their stories can be read aloud in their own voice.  
> `[Create a voice profile →]`

---

### Keepsakes — No Keepsakes

**Current (`EmptyState` component — generic):**
> (whatever the default EmptyState text is)

**Replace with (person selected):**
> **[Person Name]'s keepsake drawer is empty.**  
> Add a photo, a letter, a document — anything that proves this life was lived.  
> `[Add a keepsake →]`

**Replace with (no person selected):**
> **This archive holds no keepsakes yet.**  
> Letters, photos, certificates, recipes — add what you have.  
> `[Upload a keepsake →]`

---

### Voices — No Voice Profile

**Current:** Technical empty state with upload instructions

**Replace with (person selected):**
> **[Person Name]'s voice hasn't been preserved yet.**  
> Upload a recording of them speaking — even a few minutes — and we'll create a voice that can tell their stories for generations to come.  
> `[Preserve their voice →]`

**Replace with (no person selected):**
> **Select a family member to create a voice memory.**  
> Use the "Whose archive?" selector above to choose a person first.  

---

### RecentStoriesFeed — No Stories

**Current (`RecentStoriesFeed.tsx:88`):**
> "No stories yet"  
> "Record one in 2 minutes →"

**Replace with:**
> **No memories have been shared yet.**  
> Be the first to capture a moment — a story, a memory, a voice.  
> `[Share a memory →]` (routes to `/contribute`)

---

### OnboardingChecklist — Step Labels

**Current → Replace with:**

| Current | Replace with |
|---------|-------------|
| "Add your first family member" | "Who are you preserving this for?" |
| hint: "A name and a few details to start the tree" | "Start the archive with a person's name." |
| "Capture your first story" | "Share the first memory" |
| hint: "Write a memory or record one" | "One moment — written or spoken." |
| "Upload a photo or document" | "Add a keepsake" |
| hint: "Add to the archive — letters, photos, certificates" | "A photo, a letter, or any artifact worth preserving." |
| "Create a voice profile" | "Preserve their voice" |
| hint: "Clone a voice to read stories aloud" | "Upload a recording to create a voice that lasts." |
| "Invite a family member" | "Invite family to contribute" |
| hint: "Share the vault with relatives" | "More voices make the archive richer." |

---

## 5. CTA Strategy

### Primary CTA per Screen

| Screen | Primary CTA | Copy | Destination |
|--------|-------------|------|-------------|
| Archive (empty) | Button, full-width warm | "Add your first person" | `/family-tree?add=1` |
| Archive (has data, no person selected) | Button, ghost | "Whose archive?" (or auto-opens person selector) | — |
| Archive (person selected) | Button, primary | "Share a memory" | `/contribute?subjectId=xxx` |
| Life Journey (empty) | Button, contained | "Add a Life Moment" | Opens add dialog |
| Life Journey (has data) | FAB / ghost card | "+ Add the next chapter" | Opens add dialog |
| Stories (empty) | Button, contained | "Share the first memory" | `/contribute` |
| Stories (has data) | Link, quiet | "+ Add to this archive" | `/contribute?subjectId=xxx` |
| Keepsakes (empty) | Button, contained | "Add a keepsake" | Opens upload sheet |
| Keepsakes (has data) | Button, secondary | "Add another" | Opens upload sheet |
| Voices (empty) | Button, contained | "Preserve their voice" | Opens VoiceTrainingModal |
| Voices (has voice) | Primary (playback) | "▶ Hear this story" | Inline audio player |
| Contribute | Button, contained | "Submit Memory" | POST `/api/stories` |
| Family Tree | Button on member card | "Open Archive" | Sets context → `/archive` |

### Button Hierarchy Rules

1. **One contained button per view.** If you see two `variant="contained"` buttons on the same screen, one is wrong.
2. **Rounded pill shape** (`borderRadius: '999px'`) for primary actions — consistent with the current treatment in ArchiveShell.
3. **Ghost/outlined buttons** for secondary actions (cancel, manage, see all).
4. **Text/link buttons** for tertiary destructive or navigational actions (delete, sign out, "manage voice profile").
5. **Never place two equally weighted CTAs side by side** without a clear primary/secondary relationship.

### QuickActionsRail — Rename Actions

**File:** `UI/src/components/dashboard/QuickActionsRail.tsx`

| Current label | Replace with |
|---------------|-------------|
| "Voice Lab" | "Voice Memories" |
| "New Story" | "Share a Memory" |
| "Upload" | "Add Keepsake" |
| "Add Person" | "Add to Family" |
| "Browse Stories" (VIEWER) | "Read Stories" |

---

## 6. Component System

### PersonHeader

**Used in:** ArchiveShell hero, FamilyTreeSidebar, VoicesLens  
**Purpose:** Person identity block — photo, name, lifespan, role  
**Props:**
```typescript
interface PersonHeaderProps {
  name: string
  lifespan?: { birth?: number; death?: number }
  avatarUrl?: string | null
  size: 'sm' | 'md' | 'lg'
  subtitle?: string
}
```
**Variants:**
- `lg` — ArchiveShell hero (128px avatar, large serif name, italic lifespan)
- `md` — FamilyTreeSidebar, StoryCard subject chip
- `sm` — Inline in timeline events, story author attribution

---

### TimelineItem

**Used in:** LifeJourneyLens (vertical + horizontal views)  
**Current file:** `TimelinePage.tsx`  
**Purpose:** Single life event in the timeline  
**Behavior:**
- Click opens event detail sheet (not a full Dialog — use MUI Drawer on mobile, Dialog on desktop)
- Hover shows `translateY(-4px)` lift
- Icon dot color keyed to event type
- Empty image slot: render a solid color bar (keyed to event type color) instead of nothing — eliminates the "broken image" appearance

---

### ArtifactCard

**Used in:** KeepsakesLens, search results, Story embedded artifacts  
**Purpose:** Document/photo/letter as heirloom object  
**Behavior:**
- `Letter` and `Handwritten` types: subtle `rotate(-0.5deg)` transform — suggests physicality
- Click opens DocumentViewer (already exists)
- No delete affordance visible by default — delete only on hover/long-press

---

### VoicePlayer

**Used in:** VoicesLens, StoryDetail, TimelineItem when audio is attached  
**Purpose:** Audio playback with emotional framing  
**Design:**
```
[Person Name]'s Voice
[Story title]
[waveform visualization — simple, not technical]
[▶ 00:00 ────────────── 4:32]
```
- Waveform is decorative static bars, not live — avoids Web Audio API complexity
- "Hear [Person Name] tell this story" — not "Play audio"

---

### MemoryComposer

**Used in:** /contribute, Stories lens (removed from here per Section 3-C)  
**Purpose:** Create a text or audio story  
**Variants:**
- `text` — RichTextEditor with title, date, location (optional, collapsed)
- `audio` — AudioRecorder with title (optional)
- `upload` — FileUpload for documents/photos
- Tab or pill switcher between modes

**Single primary action:** "Save Memory" (not "Submit", not "Post")

---

### AddMemoryModule

**Used in:** LifeJourneyLens (ghost card at end of timeline)  
**Purpose:** Persistent prompt to add the next entry  
**Appearance:** Dashed border card, `opacity: 0.6`, text "Add the next chapter →"  
**Behavior:** Opens the Add Life Moment dialog on click

---

## 7. Visual Hierarchy Adjustments

### Typography System (no changes to tokens — fix application)

The Newsreader/Manrope pairing is correct. The issue is inconsistent sizing decisions:

**Headings (serif, Newsreader):**
- H1 (archive title): `3.5rem` desktop / `2.5rem` mobile — KEEP AS-IS
- H2 (lens section titles): `3.5rem` desktop / `2.5rem` mobile — currently `fontStyle: 'italic'` — KEEP
- H3 (card title): `1.5rem–2rem` — reduce to `1.4rem` for story cards; current `2.5rem` on featured card is correct
- Body long-form: Newsreader `1.1rem`, `lineHeight: 1.7` — KEEP

**Labels (sans, Manrope):**
- Section overline: `0.85rem`, `fontWeight: 600`, `letterSpacing: '0.12em'`, uppercase — KEEP
- Body: `1rem`, `fontWeight: 400`
- Caption: `0.78rem`, muted color

**Current violations to fix:**
1. `StoriesPage.tsx:143` — Section overline "The Chronicles" is fine. But `"Collected Stories"` at `3.5rem` italic is too large when immediately below the ArchiveShell hero's own `3.5rem` heading — within the lens, reduce to `2.5rem`
2. `TimelinePage.tsx:319` — "The Lifespan" / "Life Journey" header inside the lens should be `2rem`, not `3.5rem` — the ArchiveShell already provides the primary heading hierarchy
3. Reduce all within-lens section headers by one scale step from current — the ArchiveShell hero is the H1; lens content begins at H2.

### Spacing Scale

**Problem:** Cards use inconsistent padding (`p: 4` = 32px in some places, `p: 2.5` = 20px in others for the same card component).

**Rule:** Story cards → `p: 3` (24px). Feature story card → `p: { xs: 4, md: 8 }`. Timeline card → `p: 4`. Onboarding/feed cards → `p: { xs: 4, md: 5 }`.

### Button Sizing

`py: 1.5, px: 3` for large primary actions — KEEP AS-IS throughout.  
`py: 1, px: 2.5` for secondary/filter pills — KEEP.  
`py: 0.5, px: 1.5` for chip-style inline actions — KEEP.

### Color System

`ProfileColors` is well-defined. Key rules being violated:
1. `ProfileColors.primary` (`#16334a`) used on body text — correct
2. `ProfileColors.onSurfaceVariant` for secondary text — correct
3. Empty state icons: use `ProfileColors.outlineVariant` with `opacity: 0.5` — KEEP
4. Active nav items: `backgroundColor: '#ffffff'` hardcoded in Layout — should use `ProfileColors.surfaceContainerLowest` for system consistency

---

## 8. Tradeoffs & Risks

### What Is Being Simplified

| Removed | Reason |
|---------|--------|
| Sidebar nav entries for Voice Memories and Keepsakes | They are lens destinations, not top-level products — their presence in the sidebar teaches the wrong mental model |
| Inline story creation form in StoriesPage | Creates a mixed reading/writing context; all creation flows through /contribute |
| Date range filter inputs in TimelinePage | Enterprise form controls that break the "exploring a life" aesthetic |
| "Voice Lab" branding throughout VoiceLabPage | Technical framing that alienates family contributors; replaced with "Voice Memories" and emotional language |
| Featured story using `authorAvatarUrl` as hero image | Data is never populated; creates broken-looking default cards |

### What Complexity Is Being Removed

- Multiple places to create stories (StoriesPage inline form + /contribute page) → consolidated to `/contribute`
- Voice management as the primary voice surface → voice management is secondary to playback
- Navigation items that are redundant with lens switcher → clean up sidebar nav

### What Must Be Carefully Implemented

1. **Person selector state synchronization** — The `SelectedFamilyMemberContext` drives lens content across all four lenses. Removing nav items that link directly to lenses means users must first go to `/archive` and use the person selector. Ensure the person selector UX is prominent and immediately obvious to new users.

2. **Empty states with person name** — All empty state rewrites reference `[Person Name]`. This requires the component to receive the selected person's name as a prop or read from context. Every lens component already receives `selectedFamilyMember` — use it.

3. **VoiceLabPage framing change** — Renaming "Voice Lab" to "Voice Memories" and restructuring the primary surface to be playback-first means the management UI must be behind a secondary interaction. This is a behavioral change that affects the creation flow for operators (family admins). Test that VoiceTrainingModal is still accessible from the secondary path.

4. **OnboardingChecklist label changes** — These are cosmetic string changes only; logic and step ordering remain intact. No structural risk.

5. **Family Tree → Archive navigation** — Adding "Open Archive" to FamilyTreeSidebar requires the Sidebar component to have access to the router. It currently uses `PersonDetailModal` for actions — verify the routing integration doesn't break the modal flow.

6. **Sidebar nav reduction** — Removing Voice Memories and Keepsakes from nav reduces the sidebar from 5 items to 3 (Archive, Contribute, Family Members). This may feel sparse. Consider adding a "Recently Viewed Person" shortcut below Archive — or leave it sparse as a feature, not a bug.

---

## Implementation Priority

### Phase 1 — High Impact, Low Risk (no behavior change)
- [ ] Fix `OnboardingChecklist` step labels (string changes only)
- [ ] Fix `QuickActionsRail` action labels (string changes only)  
- [ ] Rewrite all empty state copy across StoriesPage, TimelinePage, VoiceLabPage, DocumentsPage, RecentStoriesFeed
- [ ] Rename "Voice Lab" → "Voice Memories" throughout VoiceLabPage
- [ ] Fix Autocomplete label "Viewing" → "Whose archive?" in ArchiveShell
- [ ] Remove `Life Events` fake stat from ArchiveShell `archiveCounts`
- [ ] Fix active nav item color `'#ffffff'` → `ProfileColors.surfaceContainerLowest`

### Phase 2 — Medium Impact, Behavioral Change
- [ ] Remove Voice Memories and Keepsakes from `Layout.tsx` sidebar navItems array
- [ ] Remove inline story form from `StoriesPage.tsx` (creation moves to `/contribute`)
- [ ] Add "Open Archive" button to FamilyTreeSidebar
- [ ] Restructure `VoiceLabPage` to show playback-first when voice exists
- [ ] Fix date range filters in `TimelinePage` — remove TextField date pickers

### Phase 3 — High Impact, Structural Work
- [ ] Build lifespan display in ArchiveShell hero (requires API to return birth/death dates in person object)
- [ ] Build `VoicePlayer` component for within-lens audio playback
- [ ] Redesign featured story card in StoriesPage (gradient fallback when no avatar)
- [ ] Add ghost "Add the next chapter" card at end of timeline

---

## Gap Analysis — Original Checklist Status

- [x] **Remove Standalone Legacy Pages:** Deprecated, all nav flows through ArchiveShell lenses
- [x] **Redesign Keepsakes:** DocumentsPage has heirloom aesthetic, filter categories, upload integration
- [x] **Revamp Life Journey:** TimelinePage warm card treatment, vertical/horizontal views, editorial header
- [x] **Overhaul Voice Memories:** VoicesLens exists; VoiceLabPage needs Phase 2 playback-first restructure
- [x] **Refine Stories Lens:** Featured story + editorial grid; inline form removal is Phase 2

---

## Elder-Friendly Accessibility Requirements

These apply across all views:

- **Minimum tap target:** 48px height for all interactive elements — verify `ToggleButton` pills meet this
- **Font sizes:** Body text minimum `1rem` (16px) — enforce via MUI `theme.typography.body1`
- **Color contrast:** `ProfileColors.onSurfaceVariant` (#73777d) against `ProfileColors.surfaceContainerLowest` (#faf7f2) — check AA compliance; this pair may fail at smaller text sizes
- **Navigation orientation:** The sticky lens switcher nav bar provides persistent orientation cues — keep it
- **Label clarity:** No icons-only controls — every interactive element must have a visible text label or tooltip
- **Shallow navigation:** Maximum 2 clicks from Archive to any piece of content — verified by current IA
