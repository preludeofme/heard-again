# Heard Again — Patent Strategy Summary for Initial Lawyer Review

> **From:** Ryan Buck  
> **Date:** June 1, 2026  
> **Project:** heardagain.com — Family Story Preservation Platform  
> **Purpose:** Provisional patent filing strategy — priority recommendations
> **Review status:** Draft invention notes only. Read [`08-PATENT_REVIEW_CRITIQUE.md`](./08-PATENT_REVIEW_CRITIQUE.md) before sending this packet to counsel. That review identifies implementation gaps, prior-art leads, and legal wording corrections.

---

## The Ask

I'm building a platform that combines interactive family trees, AI voice cloning of family members, and document-grounded AI persona chat. I want to **open-source the code** (AGPL or Apache 2.0) while running a paid hosted version. I need to know:

1. Which of my inventions are worth patenting?
2. Can I still open-source after filing?
3. What's the risk of someone else patenting my ideas?

---

## Recommended Priority: 3 Areas to Screen Before Any Filing Decision

### Priority #1 — Consent-Gated Voice Cloning (Highest Internal Priority for Prior-Art Screening)

**The Problem:** Voice cloning services raise difficult authorization questions for deceased family members. We want counsel to assess whether a policy-driven workflow requiring defined relatives, representatives, or other approvers before cloning or synthesis differs materially from the prior art.

**Current implementation and proposed embodiments:**
- **Implemented:** `VoiceConsent` records capture grantor, timestamp, revocation timestamp, and granular generation, cloud-processing, and sharing permissions
- **Partially wired:** HMAC-SHA256 token issuance exists, but end-to-end enforcement across active synthesis providers must be completed and verified
- **Proposed embodiment:** policy-driven multi-party approval for defined relatives or representatives
- **Proposed embodiment:** per-profile or per-familyspace envelope encryption and cryptographic disablement on revocation
- **Proposed embodiment:** tamper-evident consent grant, use, and revocation audit trail

**Potential point for counsel to assess:** A professional prior-art search is still required. The current repository implements single-record consent gating and contains partially wired token logic; policy-driven multi-party approval and cryptographic revocation should be treated as proposed embodiments unless separately demonstrated. See the critique.

---

### Priority #2 — Evidence-Gated AI Persona System (Requires Narrower Claim Strategy)

**The Problem:** AI chatbots hallucinate freely. Character.AI and Replika use prompt-based personality instructions but don't prevent fabrication. For family history, accuracy is paramount — you can't have "Grandma" making up stories.

**Implemented product workflow (patentability requires narrower analysis):**
- **Evidence Gate** — configurable thresholds (`minTopScore >= 0.12`, `minSources >= 1`) that block the AI from answering if documentary support is insufficient
- **Natural-language refusals** — instead of "I don't know," the persona says things like "My memory is fuzzy on that one" — maintaining character even when refusing
- **Automatic persona generation** — the system reads uploaded family documents (letters, diaries, recordings) and generates the persona's vocabulary, tone, formality, and known facts WITHOUT manual prompting
- **RAG pipeline with ChromaDB** — document ingestion → embedding → vector search → evidence gate → LLM

**Potential point for counsel to assess:** The implemented evidence gate is useful product logic, but retrieval thresholds, refusal behavior, document-grounded question answering, and persona modeling require a careful prior-art search and a narrower technical-improvement theory. See the critique.

---

### Priority #3 — Tile-and-Stitch Gigapixel Graph Export (Low-Priority Search Candidate)

**The Problem:** Large family trees (500+ people) can't be exported at print resolution. Browser canvas rendering crashes above ~4000×4000 pixels, fonts get blurry due to texture scaling.

**My Solution:**
- **Puppeteer headless capture** — hidden render route with no UI chrome
- **Tile capture** — captures 2000×2000 browser-coordinate tiles with a 2× device scale factor, then composites them into a 2× PNG raster output
- **Sharp stitching** — mathematically stitches tiles into a single gigapixel PNG buffer
- **Async job model** — export runs as a background job (RunPod serverless), client polls for completion

**Potential point for counsel to assess:** The implemented tiled raster export solves a real scaling problem, but tiled rendering, browser capture, compositing, and background jobs require prior-art review. The current exporter produces a 2× PNG raster output, not vector output. See the critique.

---

## Open Source + Patent: Timing and License Scope Require Counsel Review

**Yes, you can do both.** Here's how it works:

| Concern | Answer |
|---------|--------|
| "Can I file a patent after releasing code?" | **Sometimes in the U.S., but ask counsel before release** — an inventor disclosure may start a U.S. grace-period clock, while pre-filing disclosure may impair foreign rights. Public use and offers for sale also require review. |
| "Can I open source after filing?" | **Potentially, after counsel review** — filing before release is preferable, but later priority benefit depends on adequate disclosure and timely follow-up filings. |
| "Does the open-source license grant a patent license?" | **Yes, potentially** — Apache 2.0 § 3 and AGPLv3 § 11 both contain contributor patent-license language. Scope and release strategy require counsel review. |
| "Can I sue someone using my open-source code?" | **License- and facts-dependent** — ask counsel to distinguish copyright-license enforcement, patent-license scope, and proprietary implementations outside any granted license. |
| "Can I still enforce the patent on open-source users?" | **License-dependent** — do not assume unrestricted enforcement against users of the open-source implementation. Ask counsel to map the patent-license scope, contributor policy, and dual-licensing strategy. |

**Recommended approach:** Before any public release, ask counsel to confirm the disclosure timeline, foreign filing goals, and license strategy. Quote an initial prior-art screen and go/no-go review separately from drafting. Both AGPLv3 and Apache 2.0 require careful patent-license analysis.

---

## What I Need From the Lawyer

1. **Review the 5 invention areas** in the full docs at `docs/patent/` and tell me which to prioritize
2. **Conduct a prior art search** — especially for multi-party consent voice cloning and evidence-gated AI personas
3. **Quote a search and go/no-go assessment separately from drafting** — the documents require implementation corrections, prior-art review, and narrower technical framing before filing
4. **Advise on open-source license choice** — Apache 2.0 vs AGPL v3 vs custom, balancing patent protection with open-source goals
5. **Advise on disclosure timeline** — confirm when `heardagain.com` first went public and whether we're inside the 1-year grace period

---

## Quick Reference: What Exists

| Item | Location |
|------|----------|
| **Invention disclosures and critique** | `docs/patent/01-08_*.md` |
| **Live website** | heardagain.com |
| **GitHub repo** | [link if applicable] — visibility: [public/private] |
| **Tech stack** | TypeScript, Next.js, Python FastAPI, Qwen3-TTS, PostgreSQL, Prisma, ChromaDB, Docker, Vercel, RunPod |
| **Codebase size** | ~20 Prisma models, ~50 API endpoints, 3 services (UI/Chat/TTS), 1 shared database |
