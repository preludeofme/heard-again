# Heard Again — Patent Strategy Summary for Initial Lawyer Review

> **From:** Ryan Buck  
> **Date:** June 1, 2026  
> **Project:** heardagain.com — Family Story Preservation Platform  
> **Purpose:** Provisional patent filing strategy — priority recommendations

---

## The Ask

I'm building a platform that combines interactive family trees, AI voice cloning of family members, and document-grounded AI persona chat. I want to **open-source the code** (AGPL or Apache 2.0) while running a paid hosted version. I need to know:

1. Which of my inventions are worth patenting?
2. Can I still open-source after filing?
3. What's the risk of someone else patenting my ideas?

---

## Recommended Priority: 3 Inventions to File Now

### Priority #1 — Multi-Party Consent-Gated Voice Cloning (Strongest)

**The Problem:** Voice cloning services (ElevenLabs, Resemble) let one person clone a voice. For deceased family members, multiple living relatives (spouse, children, siblings) should all consent before a voice is cloned from surviving recordings. Nobody handles this.

**My Solution (novel technical system):**
- **VoiceConsent database table** — records who consented, when, at what level (generation only? cloud processing? sharing?)
- **HMAC-SHA256 signed tokens** — the TTS service validates a signed token on every synthesis request, proving active consent
- **Per-familyspace AES-256-GCM encryption** — voice profile weights encrypted at rest with a key derived per-family group
- **Revocation with cryptographic effect** — setting `revokedAt` invalidates all tokens and encrypts the profile inaccessible
- **Full audit trail** — each consent grant/revoke logged with before/after snapshots

**Why patentable:** Novel combination of biometric consent management + cryptographic enforcement + family genealogy context. I cannot find any prior art combining multi-party attestation with voice cloning.

---

### Priority #2 — Evidence-Gated AI Persona System (Very Strong)

**The Problem:** AI chatbots hallucinate freely. Character.AI and Replika use prompt-based personality instructions but don't prevent fabrication. For family history, accuracy is paramount — you can't have "Grandma" making up stories.

**My Solution (novel technical system):**
- **Evidence Gate** — configurable thresholds (`minTopScore >= 0.12`, `minSources >= 1`) that block the AI from answering if documentary support is insufficient
- **Natural-language refusals** — instead of "I don't know," the persona says things like "My memory is fuzzy on that one" — maintaining character even when refusing
- **Automatic persona generation** — the system reads uploaded family documents (letters, diaries, recordings) and generates the persona's vocabulary, tone, formality, and known facts WITHOUT manual prompting
- **RAG pipeline with ChromaDB** — document ingestion → embedding → vector search → evidence gate → LLM

**Why patentable:** The evidence gate with configurable thresholds is a novel invention. No existing persona chatbot has this. The combination of document-grounded persona generation + evidence-gated responses is unique.

---

### Priority #3 — Tile-and-Stitch Gigapixel Graph Export (Moderate)

**The Problem:** Large family trees (500+ people) can't be exported at print resolution. Browser canvas rendering crashes above ~4000×4000 pixels, fonts get blurry due to texture scaling.

**My Solution:**
- **Puppeteer headless capture** — hidden render route with no UI chrome
- **Tile capture** — captures 2000×2000 pixel tiles at 1:1 scale (within GPU limits, preserves fonts)
- **Sharp stitching** — mathematically stitches tiles into a single gigapixel PNG buffer
- **Async job model** — export runs as a background job (RunPod serverless), client polls for completion

**Why patentable:** Novel approach to a known scaling problem. The tile-and-stitch pattern with 1:1 scale preservation of vector text quality is distinct from prior art.

---

## Open Source + Patent: No Conflict

**Yes, you can do both.** Here's how it works:

| Concern | Answer |
|---------|--------|
| "Can I file a patent after releasing code?" | **Yes** — you have 1 year from first public disclosure in the US (35 U.S.C. § 102(b)) |
| "Can I open source after filing?" | **Yes** — the patent is already filed with priority date secured |
| "Does the open-source license grant a patent license?" | **Depends on license** — Apache 2.0 grants an explicit patent license to users; AGPL v3 does not. Your lawyer will advise |
| "Can I sue someone using my open-source code?" | **Yes** — if they violate the license terms, or if a company uses the *invention* in a proprietary product that competes with your hosted version |
| "Can I still enforce the patent on open-source users?" | **Typically no** — you'd grant a patent covenant to open-source users. The patent is for protecting against *competitors*, not users |

**Recommended approach:** File provisional patents ASAP (establishes priority date). Then release the code under **AGPL v3** — this allows free use but requires companies to open-source their modifications, making it hard for competitors to commercialize your invention without paying for a commercial license.

---

## What I Need From the Lawyer

1. **Review the 5 invention areas** in the full docs at `docs/patent/` and tell me which to prioritize
2. **Conduct a prior art search** — especially for multi-party consent voice cloning and evidence-gated AI personas
3. **Draft and file provisional patent(s)** — the documents are 80% ready, just need legal framing
4. **Advise on open-source license choice** — Apache 2.0 vs AGPL v3 vs custom, balancing patent protection with open-source goals
5. **Advise on disclosure timeline** — confirm when `heardagain.com` first went public and whether we're inside the 1-year grace period

---

## Quick Reference: What Exists

| Item | Location |
|------|----------|
| **Full invention disclosures (7 docs)** | `docs/patent/01-07_*.md` |
| **Live website** | heardagain.com |
| **GitHub repo** | [link if applicable] — visibility: [public/private] |
| **Tech stack** | TypeScript, Next.js, Python FastAPI, Qwen3-TTS, PostgreSQL, Prisma, ChromaDB, Docker, Vercel, RunPod |
| **Codebase size** | ~20 Prisma models, ~50 API endpoints, 3 services (UI/Chat/TTS), 1 shared database |
