## Heard Again Requirements

### Source of truth
- [ ] Stitch mock files live in `stitch/` (HTML + screenshots) and are the authoritative UI/UX reference.
- [ ] `stitch/digital_heirloom/DESIGN.md` is the design system north star (“The Living Archive”).

### Product intent
- [ ] Build a “living archive” for a person (the “Legacy Subject”) that lets a user:
  - [ ] Preserve voice (recordings + voice clone calibration).
  - [ ] Preserve documents/artifacts (PDFs, photos, scans, handwritten).
  - [ ] Preserve stories/memories (written + audio).
  - [ ] “Talk” to the legacy subject via a conversational interface (STT + TTS).

### Information architecture (routes/pages)
- [ ] `Home` / Dashboard (Legacy home)
  - [ ] Matches `stitch/dashboard_legacy_home/screen.png`.
- [ ] `Stories` / Story Collection Portal (public-ish contribution page)
  - [ ] Matches `stitch/story_collection_portal/screen.png`.
- [ ] `Voice Lab` / Voice & Documents Lab
  - [ ] Matches `stitch/voice_documents_lab/screen.png`.
- [ ] `Documents` (Document Archive view)
  - [ ] Can be the same page/route as the right-side “Document Archive” section in Voice & Documents Lab, but must be navigable from “Documents”.
- [ ] `Talk` / AI Conversation Interface
  - [ ] Matches `stitch/ai_conversation_interface/screen.png`.

### Global layout & navigation (must match mock)
- [ ] Desktop layout uses:
  - [ ] Top app bar (brand “Heard Again”, primary nav links, search, notification/settings icons, user avatar).
  - [ ] Left side rail (“The Living Archive”) for primary sections.
- [ ] Side rail items and labels:
  - [ ] Home
  - [ ] Talk
  - [ ] Voice Lab
  - [ ] Documents
  - [ ] Stories
- [ ] Side rail footer links:
  - [ ] Support
  - [ ] Privacy Settings
- [ ] Selected nav item state (filled card / highlighted) matches mock.
- [ ] Responsive behavior:
  - [ ] On small screens, side rail collapses/hidden.
  - [ ] Mobile bottom navigation exists (Home / Lab / central Add button / Stories / Profile) as shown in dashboard mock.

### Design system requirements (from “Digital Heirloom”)
- [ ] “Warm Minimalism” with intentional asymmetry (avoid rigid SaaS grid feel).
- [ ] Surface architecture (tonal layers; avoid heavy borders):
  - [ ] Base background `surface` (#fcf9f4)
  - [ ] Section panels `surface-container-low` (#f6f3ee)
  - [ ] Cards `surface-container-lowest` (#ffffff)
  - [ ] Inset elements `surface-dim` (#dcdad5)
- [ ] “No-Line Rule”:
  - [ ] Avoid 1px solid separators. Use background shifts + spacing.
  - [ ] If a boundary is required, use `outline-variant` at ~15–20% opacity.
- [ ] Typography pairing:
  - [ ] Headlines/display in an editorial serif (Newsreader-like).
  - [ ] Body/UI in a modern sans (Manrope-like).
  - [ ] Generous line-height (~1.6) and generous section spacing.
- [ ] Primary CTAs use subtle gradient (primary -> primary-container) rather than flat fills.
- [ ] Glassmorphism panels for floating/overlay elements:
  - [ ] White surface at ~80% opacity + ~24px backdrop blur.
- [ ] Rounded corners throughout; avoid sharp corners.

### Core data models (UI-first, can be mock data initially)
- [ ] **LegacySubject**
  - [ ] `id`, `fullName`, `lifespanText` (e.g. “1942 — Present”), `bio`, `avatarUrl`, `accentIcon` (heart).
- [ ] **AudioSample** (voice cloning sample)
  - [ ] `id`, `title`, `recordedAt`, `durationSeconds`, `status` (uploaded/processing/ready).
- [ ] **VoiceCloneStatus**
  - [ ] `percentComplete`, `uploadedCount`, `remainingCount`, `statusText`.
- [ ] **DocumentArtifact**
  - [ ] `id`, `title`, `type` (PDF/Letter/Photo/Handwritten), `uploadedAt`, `thumbnailUrl`, `shareAction`.
- [ ] **Story/MemoryContribution**
  - [ ] `id`, `authorName`, `authorRole` (Friend/Nephew/Colleague), `authorAvatarUrl`, `content`, `createdAt`, `type` (text/audio), `audioDurationSeconds` (optional).
- [ ] **ConversationMessage**
  - [ ] `id`, `sender` (LegacySubject/User/System), `timestamp`, `content`, `state` (sent/typing/listening).

### Page requirements — Home / Dashboard (Legacy Home)
- [ ] Hero area has two primary cards (as in mock):
  - [ ] Profile card for legacy subject (avatar + heart badge, name, lifespan, short bio).
  - [ ] Voice sample card:
    - [ ] Title “Voice Sample”
    - [ ] Subtitle “Generated Legacy Clone — High Fidelity”
    - [ ] Large circular play button.
    - [ ] Soft rounded-bar waveform visualization.
    - [ ] Time labels (0:00, a quote snippet, 2:45).
- [ ] “Memory Wall” section:
  - [ ] Title “Memory Wall” and “View All Stories” link.
  - [ ] Bento grid of mixed card types:
    - [ ] Story quote card with category label and play icon.
    - [ ] Larger “Audio Memory” card with image thumbnail, title, description, “Listen to Legacy” action.
    - [ ] Short quote card with author chip + “2 DAYS AGO”.
    - [ ] “The Archive Collection” stats card with counts + small thumbnail placeholders + “+31”.
- [ ] “Preserve the Present” quick actions section:
  - [ ] Title “Preserve the Present” and descriptive subtitle.
  - [ ] 3 action cards:
    - [ ] Start Conversation
    - [ ] New Story
    - [ ] Upload Recording
- [ ] Side rail includes “Start Recording” primary CTA near bottom (desktop), matching mock placement.
- [ ] Search input in top bar (“Search memories…”) (desktop).

### Page requirements — Stories / Story Collection Portal
- [ ] Landing hero:
  - [ ] Headline “Help us tell Arthur’s story.”
  - [ ] Supporting paragraph describing living archive.
  - [ ] Right-side hero portrait (tilted image) with a floating glass quote card:
    - [ ] Quote “The best way to remember is to share.”
    - [ ] Attribution “— The Living Archive”
- [ ] Contribution hub (two-column cards):
  - [ ] “Record a Memory” card:
    - [ ] Description text.
    - [ ] Waveform placeholder.
    - [ ] Primary CTA “Start Recording” with mic icon.
  - [ ] “Write a Story” card:
    - [ ] Optional title input.
    - [ ] Main textarea (“Share your memory here…”).
    - [ ] Attach file + add photo actions.
    - [ ] Submit CTA “Post Memory”.
- [ ] “Recent Contributions” section:
  - [ ] Title + subtitle + “View Archive” action.
  - [ ] Grid of contribution cards including:
    - [ ] Text contributions with author avatar/name/role and relative time.
    - [ ] Highlight audio contribution card with embedded mini player (play button, progress bar, duration).
- [ ] Footer exists and matches mock content blocks:
  - [ ] Brand summary paragraph.
  - [ ] “Archive Sections” links.
  - [ ] “Community” links.
  - [ ] Bottom copyright line.

### Page requirements — Voice & Documents Lab
- [ ] Header:
  - [ ] Title “Voice & Documents Lab”
  - [ ] Description paragraph.
- [ ] Left column: Voice Cloning
  - [ ] Status row with:
    - [ ] “Voice Cloning” title.
    - [ ] Status text “Status: Calibration in progress”.
    - [ ] Badge “Active”.
  - [ ] Progress ring showing percent (e.g., 75%).
  - [ ] Stats list:
    - [ ] “15 recordings uploaded”
    - [ ] “5 more needed” (italic).
  - [ ] Soft waveform card.
  - [ ] Primary CTA “Record Sample”.
  - [ ] “Recent Samples” list:
    - [ ] Each row has play icon button, title, meta (date + duration), and overflow/menu icon.
- [ ] Right column: Document Archive
  - [ ] Title “Document Archive”.
  - [ ] Filter chips:
    - [ ] All (selected)
    - [ ] PDFs
    - [ ] Handwritten
  - [ ] Document grid cards with:
    - [ ] Thumbnail area with type pill (Letter/PDF/Photo).
    - [ ] Title + uploaded date.
    - [ ] Share icon/action.
  - [ ] “Upload Artifact” dashed card with:
    - [ ] Plus icon button.
    - [ ] Supporting text “PDF, JPG, or Handwritten Scans”.
- [ ] Side rail includes “Start Recording” CTA (desktop).

### Page requirements — Talk / AI Conversation Interface
- [ ] Left side rail exists (Talk selected).
- [ ] Talk header:
  - [ ] Back button.
  - [ ] Title “Conversation with Evelyn”.
  - [ ] “Live Presence” indicator with pulsing dot.
  - [ ] Right-side avatar + notification + settings icons.
- [ ] Message list:
  - [ ] Legacy subject message bubble (left) with sender label (“EVELYN”) + timestamp.
  - [ ] User message bubble (right) with timestamp + sender label (“YOU”).
- [ ] Listening state centerpiece:
  - [ ] Animated orb / concentric rings around a mic icon.
  - [ ] Status text “Evelyn is listening…” (editorial/italic).
- [ ] Typing indicator bubble (three dots) as a reduced opacity message.
- [ ] Bottom input bar (sticky):
  - [ ] Mute button (mic off) with label.
  - [ ] Text input with placeholder “Type a memory or just say hello…”.
  - [ ] Image attachment button.
  - [ ] Mic button.
  - [ ] Primary “Send” button with send icon.
- [ ] Footer microcopy under input bar:
  - [ ] “Encrypted Connection • Archive Active”.

### Interaction + states checklist (minimum)
- [ ] Hover states are tonal (surface shifts) not harsh.
- [ ] Active/pressed states: subtle scale/opacity similar to mock.
- [ ] Loading/progress states:
  - [ ] Voice clone calibration progress shown as ring + counts.
  - [ ] Talk: listening and typing states.
- [ ] Empty states:
  - [ ] Document archive empty.
  - [ ] Recent samples empty.
  - [ ] Contributions empty.
- [ ] Error states:
  - [ ] Recording failed.
  - [ ] Upload failed.
  - [ ] Post memory failed.
- [ ] Accessibility:
  - [ ] Keyboard focus visible (ghost border, not harsh outline).
  - [ ] Sufficient contrast while preserving warm palette.

### Functional scope (phased, but align UI now)
- [ ] UI-first implementation should support mock data for all screens.
- [ ] Recording flows (later functionality) implied by UI:
  - [ ] Start Recording (general).
  - [ ] Record Sample (voice calibration).
  - [ ] Upload Recording.
- [ ] Document upload flow implied by “Upload Artifact” card.
- [ ] Story creation flow implied by “Write a Story” card.
- [ ] Talk flow implied by chat input + mic.

