# Competitor Report — September 2026

**Scope:** Family voice preservation & digital legacy space (Heard Again competitive watch)
**Prepared:** 2026-09-26 (monthly competitor report cron)
**Cutoff:** Coverage window 2026-08-22 → 2026-09-26 (overlap applied for late indexing)
**Method:** Primary sources via direct `curl` (RSS feeds, product/KB pages) + `web_search` (Exa/Parallel fallback; SearXNG backend returned HTTP 500 throughout this cycle, as in Aug) + headless browser for JS-heavy pages (Famyl).
**Prior report:** 2026-08-22 (see `competitor-report-2026-08.md`, "Update #2")

---

## Executive Summary (Top 3 Insights)

1. **The category's central premise just flipped: direct competitors now clone real people's voices — and the "unoccupied whitespace" Heard Again held in August is gone.** Three separate consumer platforms are now live with AI voice cloning + conversational "digital twin" of a *real, living family member*: **Aeterna** (public launch Jul 15, 2026; Android live Aug 18–21; Free/$49/$159 + $1,499 "Time Capsule" offline hardware), **Living Forever — AI** (public launch Jun 1, 2026; NVIDIA Inception Feb 2026; $99¢-trial pricing), and **Famyl.ai** (public open beta, live AI voice + avatar companion, explicitly "including a loved one who has passed away"). August's conclusion — "no major competitor today clones a real family member's voice" — **no longer holds** for the startup tier. It still holds for the incumbents (MyHeritage, StoryCorps, FamilySearch).

2. **The incumbents moved *further* away from cloned voice, not toward it — with one exception worth watching.** MyHeritage's newest voice-adjacent feature, **Photo Storyteller™** (KB dated Jul 21, 2026), is a *recording* tool: users record themselves or interview relatives describing a photo. Human audio only, **no synthesis, no cloning**. Their MyStories "Audio QR codes" likewise replay the person's own recording. Ancestry (adjacent, watch-list addition) shipped **AI Stories** — AI-*narrated* audio from historical records — but its CTO explicitly disclaimed the category: *"not in the business of 'bringing your ancestors to life'"* / *"dead people dance."* The incumbents are deliberately narrating *documents*, not *people*.

3. **Two structural threats crystallized this cycle: (a) "offline/self-hosted" is being claimed by a funded rival, and (b) pricing is being anchored absurdly low.** Aeterna's **Time Capsule** is a private hardware device storing the archive + voice + digital twin "entirely offline… no subscription, no dependency on any platform, server, or company" — this attacks Heard Again's precise self-hosting differentiator from a *consumer* angle. Meanwhile Living Forever AI's **99¢ first month / $4.99 with video** and Famyl's free-tier live-minutes model anchor consumer price expectations far below any sustainable self-hosted offering. Heard Again's open-source licensing + genuinely self-owned data remain unmatchable, but they must now be *defended explicitly*, not merely asserted.

---

## 1. The startup tier — 🔴 HIGH THREAT (now directly in Heard Again's space)

### Aeterna (`helloaeterna.com`) — Tampa, FL. Founder: Roy Heller. Full product, real pricing.

Directly overlapping: AI-guided interviews → **voice cloning** → **conversational Digital Twin** ("Johnny" AI Biographer) → family Q&A answered *in the narrator's cloned voice*.

- **Voice:** "Nuanced Voice Cloning — captures and preserves the unique emotional inflections, accent, and tone of the narrator." Interactive Family Q&A returns **spoken-word answers in the relative's cloned voice.**
- **Prices (verified on-site, Sep 2026):** Free tier; **$49/mo**, **$159/mo**, **$29 one-time**, and **$1,499 one-time for the "Time Capsule"** hardware.
- **The Time Capsule (their self-hosting play):** *"a private hardware device that stores your complete digital archive, your voice, your stories, your digital twin… entirely offline, in your family's hands. No internet required. No subscription. No dependency on any platform, server, or company."* — **This is the single most material competitive development of the cycle.** It occupies Heard Again's "you own it, no vendor lock-in" position in a consumer hardware form.
- **Shipping cadence:** Public launch Jul 15, 2026 → "Send a Question" (email-based capture for non-technical elders) Jul 17–18 → Record-a-Memory video support Aug 3 → Focused theme default Aug 8 → **Android app live Aug 18–21, free, on Google Play** (`com.helloaeterna.app`).
- **Roadmap signal:** "**Offline Digital Twin**" in closed beta — on-device privacy, no continuous cloud connection. They are converging on the exact self-hosted privacy story.
- **Ethics posture (framed as a moat):** Public **"Charter"** (enacted Jan 2025, amended annually) — no selling data, no training public AI models on vault content, **verified biometric consent required for any living-person digital twin**, embedded provenance markers, legal enforcement. Distinct from the incumbents' softer KB paragraphs.
- **Keywords:** digital legacy, voice cloning, digital twin, AI biographer, family archive, private vault, "Storyworth alternative", "best digital legacy apps 2026". Aggressive comparison-content SEO aimed directly at the contested terms.
- **Sources:** https://helloaeterna.com/ · https://helloaeterna.com/charter · https://helloaeterna.com/pricing · https://apnews.com/press-release/marketersmedia/press-release-5530cefdf7eac3bed66c176dc02439c0 · https://helloaeterna.com/blog/aeterna-android-app-now-available-free

### Famyl.ai — new entrant. **Public open beta now live.**

The most *direct* product match found this cycle: consumer AI companion avatar built from photos, voice recordings, letters and stories — "an avatar you can see, hear and talk with — **including a loved one who has passed away.**"

- Voice cloning + live voice calls + video avatar; "Live Minutes" metering; free text chat.
- Explicit honest-AI framing: *"An AI interpretation of shared memories, not the real person."* + dedicated AI disclosure/consent and ethics pages.
- **Very broad scope beyond family:** use-case pages for Alzheimer's/memory loss, companionship, pets, cultural preservation, healthcare/eldercare, **enterprise knowledge, schools & universities, creators + an affiliate program.** This is a platform play, not a family-memory niche.
- **Keywords (verified from page meta):** `AI companion, family stories, preserve memories, preserve voice, AI pet companion`.
- Localized into **40+ languages** — real internationalization investment.
- **Sources:** https://famyl.ai/ (live page + meta tags, verified 2026-09-26)

### Living Forever — AI (`livingforeverai.com`) — Atlanta, GA. Founder/CEO Brian Will; COO Jenn Van Houten.

Positioned explicitly as "interactive genealogy" — turning the family tree into a conversational AI Twin.

- **Interactive video AI twins** of *living* people: RAG + video avatar rendering + voice synthesis, real-time conversation. "Patent-Pending Personality Engine", "400+ psychological and narrative identity questions."
- **Trajectory:** accepted into **NVIDIA Inception** Feb 27, 2026 → 1,000 signups in 54 days (Apr 24) → beta May 1 → **full public launch Jun 1, 2026.** Bootstrapped, raising a **$500K seed**.
- **Pricing:** **99¢ first month; $4.99 adds live video for month one.** (Aggressive consumer price anchoring.)
- Founder has a media platform (2× WSJ bestselling author, TEDx, 3 exits); featured in Entrepreneur, Forbes, Hypepotamus.
- **Source:** https://livingforeverai.com/ · https://www.usatoday.com/press-release/story/27241/... · https://www.barchart.com/press-releases/1505819/...

### Other entrants

- **Famyl / Aeterna / LFAI** are the three verifiable live consumer platforms. **Recuerdo.ai** appears in a Tracxn company record (AI-simulated voice experiences to "reconnect with voices of loved ones", privacy/ethics emphasis) but its domain **did not resolve** (`https://recuerdo.ai` → DNS failure, 2026-09-26). Treat as **unverified / possibly defunct** — coverage gap, not "active."
- **HereAfter AI — still dead.** `hereafter.ai` returns **404** (confirmed again, 2026-09-26). Second consecutive cycle.
- Infrastructure layer worth noting (not a direct competitor, but it arms the field): **Inworld Realtime TTS-2 / TTS-2 Flash** launched Sep 2, 2026 — zero-shot cloning from **5–15 seconds** of authorized audio, delivery steering across 100+ languages, 25ms TTFB on Flash. **Resemble AI** markets consumer voice cloning ("parents record 25 sentences → bedtime stories in the parent's own voice", 4.8 App Store rating) with **on-prem/Docker/Kubernetes self-hosting** and an **MIT-licensed open-source model (Chatterbox)** — commercially validating the open-source self-host thesis Heard Again rests on.

---

## 2. MyHeritage — 🟡 MEDIUM (high threat in adjacent space; still NOT cloning voice)

**New this cycle (Sept 2026):**

- **338 million historical records added (Aug 2026)** across 20 collections — blog post Sep 6, 2026. Includes AI-extracted "Names & Stories in Newspapers" records with auto-generated AI article summaries. Records/text only.
- **Editorial/content cadence:** 1926 Slavery Convention centennial (Sep 24), Belgian surnames (Sep 22), Great Miami Hurricane centennial (Sep 17), NY 250 years ago (Sep 10), Holocaust cousin reunion (Sep 9), adoption-sisters story (Sep 7), **Webtember 2026** free webinar month (Sep 2), free US/Canada census records for Labor Day (Sep 2).

**Voice posture — verified, unchanged, and worth stating precisely:**

- **Photo Storyteller™** (KB page, dated **Jul 21, 2026**) — new-ish feature on the free mobile app: record yourself or **interview a relative** telling the story behind a photo. *"When saved, the recording will be uploaded to the MyHeritage servers."* One recording per photo (multiple planned). **Human recordings only — zero synthesis, zero cloning.** This is the *closest* MyHeritage has come to the voice-preservation space, and it remains a *capture* tool.
- **MyStories Audio QR codes** (Aug 13, 2026) — replay the storyteller's **own** recording from a printed book. Human audio.
- **MyStories AI Editor** (Aug 13, 2026) — third-party AI **text** polishing; requires consent; content deleted after processing.
- **DeepStory** (their only AI-voice product) remains **discontinued** (Aug 2025); successor LiveMemory™ is photo *animation*.
- **Keywords (verified from homepage meta, 2026-09-26):** genealogy, family tree, historical records, DNA, pedigree, lineage, surnames, **old family photos** — **no voice/AI-voice/storytelling keywords.** Consistent with Aug finding.

**Threat assessment:** Unchanged in kind, upgraded in *proximity*. Photo Storyteller normalizes "record your family's voice/stories" *inside* the app millions already use — it is a demand-creation asset for the category and a distribution threat if MyHeritage ever adds synthesis to it. **The follow-up flag remains: does Photo Storyteller get an AI voice layer?** That is still the single most material potential shift.

**Sources:** https://blog.myheritage.com/2026/09/myheritage-adds-338-million-historical-records-in-august-2026/ · https://www.myheritage.com/help/en/articles/12852548-what-is-the-myheritage-photo-storyteller (verified in-browser 2026-09-26) · https://blog.myheritage.com/2026/08/new-in-mystories-ai-editor-audio-story-playback-and-more/ · https://blog.myheritage.com/feed/

---

## 3. StoryCorps — 🟢 LOW (human-first; the category's philosophical inverse)

**September 2026 activity (RSS-verified, feed lastBuild Sun 08 Sep 2026):**

- **Hispanic Heritage Month** feature (Sep 1, 2026).
- **Commemorating the Anniversary of September 11** (Sep 1, 2026) — **new phase of the September 11th Initiative with Voices Center for Resilience**, plans for **up to 1,000 additional interviews**; recordings conducted in person Sep 8–10 at the VOICES 25th Anniversary NYC Symposium.
- **Podcast:** *"It Will Always Be Yesterday: 25 Years After 9/11"* (Sep 8, 2026); *"The Friendship House"* (Sep 21–22, 2026).
- **#TheGreatListen** back-to-school participation campaign (Aug 24 / Aug 13, 2026); "Carry Sonia's Spark on the Road" (Aug 28, 2026).
- **Connect250** (flagship, with NPR *Morning Edition*, Jun 2026) continues; 2026 Mobile Tour running.

**AI posture:** Still **zero synthetic voice.** Technology framed as serving "the irreplaceable… recording of a never-again moment." The gated **AI Research Proposal** intake form (screening external AI researchers) remains their only AI surface. **More than two decades of recordings, 176k+ interviews / 42k+ hours**, archived at the Library of Congress.

**Threat:** Not commercial. Their positioning is *reinforcement* of the emotional case, and their total absence from AI voice keeps the "AI-native alternative" framing available. Note the September emphasis is institutional/commemorative, not product.

**Sources:** https://storycorps.org/feed/ · https://storycorps.org/september11/ · https://storycorps.org/podcast/it-will-always-be-yesterday/ · https://storycorps.org/podcast/friendship-house/ · https://storycorps.org/about/press-room-news/

---

## 4. FamilySearch — 🟢 LOW (records/text AI; voice still absent)

**September 2026 activity:**

- **302 million new records from 31 countries** (Sep 10, 2026), incl. 18 entirely new collections.
- **"Improved Merge Experience in Family Tree"** (Aug 17, 2026).
- **Full-Text Search graduated out of Labs** into standard search — now covering **~2 billion AI-transcribed images**; AI-generated record summaries, auto-translation, collection grouping.
- **User-Owned Trees ("User Trees")** rolling out — a structural platform shift (private, owner-controlled trees coexisting with the shared tree). Analyst coverage Sep 5, 2026.
- **Community criticism surfaced this cycle:** a well-followed genealogy blog questioned the quality of the AI Research Assistant (Sep 8, 2026) — a suggested "ancestor" was reported as an invalid record and unrelated. AI-accuracy trust issues are a live conversation.

**AI roadmap (2026):** entirely records/text/search — handwriting OCR in more languages, help chatbot, tree-extending hints, contextual/plausibility reasoning. **Zero audio, voice, narration, or voice cloning.** The "Record Your Story" content track remains dormant (most recent entry Aug 2025).

**Coverage note:** bot-protected (Incapsula). This cycle's familysearch.org/press and newsroom pages were reachable via search-indexed content and blog mirrors; treat paginated/category coverage as **partial, not complete.**

**Threat:** Minimal, unchanged. Their own 2026 AI guidance emphasises verification and warns about AI bias/hallucination — useful third-party caution language for Heard Again's trust messaging.

**Sources:** https://www.familysearch.org/en/newsroom/new-free-historical-records-from-31-countries-september-2026-update · https://www.familysearch.org/en/blog/full-text-search-leaves-familysearch-labs · https://www.familysearch.org/en/blog/what-to-expect-from-familysearch-in-2026 · https://aarr.org/ai-genealogy-tools-familysearch-myheritage-ancestry/ · https://genealogysstar.blogspot.com/2026/09/is-familysearchorg-ai-really-ai.html

---

## 5. Ancestry — 🟠 NEW WATCH-LIST ADDITION (adjacent, not direct — but moving)

Not on the original watchlist; added because it is the largest consumer family-history platform and shipped the category's most-noticed AI audio feature.

- **AI Stories** (launched Dec 2025, still beta): turns a historical record into a **narrated audio story**, grounded in the record + period context, footnoted. **940M+ records** eligible; 6–7 languages. Includes user-uploaded content (journals, letters, postcards, recipes).
- **RootsTech 2026 additions:** Transcribe button, Photo Insights, "Get Ideas" research assistant, 2.4M pages of Revolutionary War pension files made text-searchable. **Tribute Reel** (photos → memorial video with music).
- **Explicit anti-cloning stance:** CTO Sriram Thiagarajan — *"not in the business of 'bringing your ancestors to life'"* and "dead people dance"; AI Stories is deliberately restrained ("narrates rather than animating faces"). No plans to apply AI to DNA. Video narration was flagged for possible H1-2026 rollout — **watch this.**
- **Threat:** Moderate-adjacent. They narrate *documents*, not *people*, and publicly refuse the cloning lane. But they own the largest subscriber base, and their "audio story" framing competes for the same emotional spend. Their H1-2026 video-narration intention is the flag.
- **Sources:** https://www.ancestry.com/c/ancestry-blog/ancestry-news/ancestry-brings-family-history-to-life-with-new-ai-powered-stori · https://www.semafor.com/article/12/12/2025/ancestrys-new-ai-feature-narrates-ancestors-stories · https://ancestoriq.com/blog/ancestry-ai-stories-review/ · https://aarr.org/ai-genealogy-tools-familysearch-myheritage-ancestry/

---

## Coverage & Method Notes

| Competitor | Status | Method |
|---|---|---|
| Aeterna | ✅ Full | Live site, pricing, blog, AP/openPR releases |
| Famyl.ai | ✅ Full | Headless browser (JS-heavy) + meta extraction |
| Living Forever — AI | ✅ Full | Live site + syndicated press releases |
| MyHeritage | ✅ Full | RSS + Knowledge Base (browser-verified) + homepage meta |
| StoryCorps | ✅ Full | RSS feed + blog pages |
| FamilySearch | ⚠️ Partial | Search-indexed newsroom/blog; Incapsula blocks some pagination |
| Ancestry | ✅ Full | Vendor blog + Semafor + third-party review |
| HereAfter AI | ✅ Resolved (404) | Direct HTTP |
| Recuerdo.ai | ⚠️ Unresolved | DNS failure — cannot confirm existence |
| "Artefact"/"Artifact" | ⚠️ Still unresolved | No AI family/voice-memory company under either spelling found. **Ryan: please disambiguate (3rd cycle).** |

**Tooling caveat:** `web_search` backend `searxng` returned **HTTP 500 on every call this cycle**; all searches were served by fallback backends (Exa / Parallel). `web_extract` is non-functional in this profile (SearXNG is search-only; `web.extract_backend` is not set to a capable backend). Research was therefore completed with `curl` to primary sources, RSS/WordPress REST, and the headless browser. **Recommend fixing `web.extract_backend` before the next cycle to broaden source coverage.**

---

## Follow-up Watch Items (rolling)

1. **Aeterna "Offline Digital Twin" beta → public.** If it ships, a funded consumer company will have claimed *offline, on-device, no-cloud* voice-twin archiving — Heard Again's core differentiator. Watch the blog monthly. **Highest priority.**
2. **MyHeritage Photo Storyteller + AI voice layer.** Still the single most material incumbent shift available. Any "narrate in their voice" phrasing = immediate red-flag alert, not a monthly note.
3. **Ancestry video narration (H1 2026 intention).** Did it ship, and does it animate *faces* (a cloning-adjacent move) or stay document-narration? Watch.
4. **Famyl scope creep into family memory.** Currently broad (pets, enterprise, schools, creators). Watch for a family-legacy-specific campaign — and for any "self-hosted"/"export your data" claim.
5. **Open-source / self-hosted voice preservation in the wild.** Resemble AI's MIT-licensed Chatterbox + on-prem deployment commercially validates Heard Again's architecture. Verify no *consumer-facing* self-hosted OSS entrant emerged (search tools were degraded this cycle — coverage gap).
6. **"Artefact" disambiguation** — unresolved 3 consecutive cycles. Needs Ryan's input or it should be dropped from the watchlist.
7. **HereAfter shutdown cause** — still unresolved; a category-thesis signal (demand vs. ethics vs. acquisition).
8. **Pricing floor erosion.** With LFAI at 99¢/mo and Famyl free-tier, Heard Again's pricing must be justified by ownership/open-source, not feature parity.

---

## Verification

- [x] Every surfaced event cites a primary source and appears exactly once (syndicated launch coverage for Aeterna/LFAI collapsed into single events).
- [x] Source failures reported as coverage gaps (FamilySearch Incapsula, Recuerdo DNS, search backend 500s) — never as "no news."
- [x] Materiality decisions applied consistently against the watch contract (directness, authority, novelty, market impact, confidence).
- [x] Cutoff advanced only for successfully covered sources; still-unresolved items carried forward.
