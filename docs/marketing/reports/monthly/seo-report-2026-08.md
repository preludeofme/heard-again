# Monthly SEO Performance Report — heardagain.com

**Reporting period:** August 2026 (month-to-date, launch month)  
**Compiled:** 2026-08-23 (monthly SEO report cron)  
**Analyst:** Hermes (SEO Cron)  
**Property:** [www.heardagain.com](https://www.heardagain.com) — "Heard Again" (family voice & memory preservation, open source)

> **Data caveat:** Google Search Console is still not connected, and no GA4/web-analytics data is available for organic-keyword or traffic measurement. This report measures what is currently measurable: content production, technical health (live HTTP checks), blog structure, backlink/mention signal, social draft inventory, and keyword gaps. The `web_search` backend (SearXNG) was again down this cycle (HTTP 500), so off-site backlink/reference scanning remains a measurement gap; off-site signal is reconstructed from the launch asset inventory instead.
>
> **Prior report note:** This supersedes the mid-month "launch special" (`seo-report-2026-08.md`, compiled 2026-08-16). Progress is tracked against that baseline throughout.

---

## 1. Content Production

| Metric | Value |
|---|---|
| Posts published this month (Aug) | **5** (all August 2026) |
| New posts since prior report (Aug 16) | **1** — the "grandparents voices" post (Aug 17) |
| Total posts live | **5** |
| Total words (prose, JSX stripped) | **~7,144** across 5 files |
| Publishing cadence | Bursty — 4 posts Aug 9–10, then 1 post Aug 17. No posts since Aug 17. |

| # | Post | Date | Read time | Approx. words | Tags |
|---|---|---|---|---|---|
| 1 | How to Preserve Your Family's Voices Before It's Too Late | 2026-08-09 | 6 min | ~1,386 | family voices, oral history, legacy preservation, storytelling |
| 2 | Why Open Source Matters for Your Family's Digital Legacy | 2026-08-09 | 5 min | ~1,284 | open source, digital legacy, privacy, data sovereignty |
| 3 | AI Voice Cloning and Your Family: Ethics, Consent, and What You Should Know | 2026-08-09 | 7 min | ~1,168 | AI ethics, voice cloning, consent, family technology |
| 4 | How to Preserve Family Memories Digitally (Without Losing What Matters) | 2026-08-10 | 7 min | ~1,708 | family memories, digital preservation, oral history, legacy, recording tips |
| 5 | How to Record Your Grandparents' Voices Before the Stories Go Quiet | **2026-08-17** | 7 min | ~1,598 | grandparents, voice recording, oral history, family stories, legacy |

**Assessment:** Post #5 is a strong, on-target addition — it directly targets the #1 keyword opportunity flagged in the prior report ("record grandparents' voices") and is the emotionally strongest piece yet (first-person grandfather/dance-hall narrative). Content quality and brand voice remain excellent (human-first, consent-led, no AI hype). The gap is still **cadence**: the weekly Monday publish rhythm defined in `SEO_AUTOMATION_PLAN.md` is not active, and there has been a 6-day silence since the last post.

---

## 2. Technical Health (live checks, 2026-08-23)

| Check | Result | Status | Δ vs. Aug 16 |
|---|---|---|---|
| Homepage (`/`) | 200, ~0.46s | ✅ | stable |
| Blog index (`/blog`) | 200, ~0.34s | ✅ | stable |
| Blog post (deep link, new) | 200, ~0.27s | ✅ | — |
| `sitemap.xml` | 200, `application/xml`, 14 URLs | ✅ | +1 URL (new post) |
| `og-image.png` | 200, `image/png` | ✅ | stable |
| **`robots.txt`** | **200, `text/plain`** | 🟡 **served, but STALE content** | 🔴→🟡 (404 FIXED) |
| Non-www → www redirect | **307 (temporary)** | 🟡 still open | unchanged |
| RSS / Atom feed | 404 (`rss.xml`, `feed.xml`) | 🟡 still missing | unchanged |

### 🟡 robots.txt now serves — but the fix is half-deployed

The critical 404 is **resolved**: `https://www.heardagain.com/robots.txt` now returns `200` with `text/plain`, so crawlers do receive directives. **However, the deployed content is stale:**

- **On-disk** (`UI/public/robots.txt`) correctly reads `Sitemap: https://www.heardagain.com/sitemap.xml` (www-consistent).
- **Production** still serves `Sitemap: https://heardagain.com/sitemap.xml` (non-www).
- **Root cause:** `git status` shows `UI/public/robots.txt` and `UI/public/sitemap.xml` are **modified but UNCOMMITTED** — the fix exists locally but was never committed/pushed/deployed. The last commit touching robots.txt is `74bbaf60` (Aug 9).

**This is the single most important action item this month.** The robots.txt correction and the sitemap gains are sitting uncommitted on disk. Everything else in the report is secondary to committing and redeploying.

### 🟡 307 redirect still unconsolidated
`https://heardagain.com/` → `https://www.heardagain.com/` still returns **307 Temporary** (confirmed live, `server: Vercel`). This splits ranking signals across two host variants and must be changed to **301 Permanent** at the Vercel/DNS layer. Carried over from the Aug 12 audit — still open.

### Page speed
All key pages load in **0.26–0.46s** server-side with clean 200s. No render-blocking or slowness observed. (Core Web Vitals field data unavailable without Search Console/GA.)

---

## 3. Blog Performance

### Internal linking — 🔴 still zero (unchanged)
**There are still zero internal links and zero external links in any of the 5 blog posts.** Confirmed by source scan: `href=` count = 0 and `https://` URL count = 0 across all five post `.tsx` files.

The `getRelatedPosts` engine *does* render a "Related Posts" section on each post page (based on shared tags), so there is **dynamically-generated** cross-linking at the template level — but the post *bodies* contain no hand-placed contextual links. Consequences:
- No link equity flows between posts at the anchor-text/body level.
- No "hub" post consolidates topical authority.
- The template's related-posts block only surfaces posts that share *exact* tags, which (per §3 tag analysis) are still highly fragmented — so many posts render zero related content.

### Tag usage
19 unique tags across 5 posts. Distribution:

| Frequency | Tags |
|---|---|
| 3× | `oral history` |
| 2× | `legacy` |
| 1× (everything else) | family voices, legacy preservation, storytelling, open source, digital legacy, privacy, data sovereignty, AI ethics, voice cloning, consent, family technology, family memories, digital preservation, recording tips, grandparents, voice recording, family stories |

Progress: `oral history` consolidated from 2× → 3× and `legacy` from 1× → 2×, so the related-posts engine now has slightly more overlap to work with. But 19 tags for 5 posts is still too many — a smaller canonical tag set (6–8 core tags) would make the tag graph dense enough to actually drive related-post recommendations and topic authority.

### Accuracy & relevance of older posts
All 5 posts are ≤ 14 days old (launch month), so nothing is materially stale. **Watch items from the Aug 22 competitor report (update #2):**
- MyHeritage's MyStories **audio QR codes** (Aug 13) play a loved one's *own human recording* — not AI-cloned voice. This is a differentiation opportunity, not a threat: no major competitor clones a real family member's voice, and the competitor report confirms **"the whitespace Heard Again owns is still empty."**
- StoryCorps launched **Connect250** (human-first time capsule) and a physical **Prego** recorder; they are explicitly *moving away from* AI voice. Heard Again's "AI-native, self-owned alternative to StoryCorps" framing remains a viable positioning.
- The "digital legacy planning" angle (#2 keyword from prior report) is still not owned by any post; none of the 5 posts addresses estate/digital-death planning directly.

---

## 4. Backlink / Mention Check

**Method limitation:** `web_search` (SearXNG) again returned HTTP 500 this cycle; DuckDuckGo HTML scrape via the browser tool was blocked (Chrome remote-debugging requires interactive user approval, unavailable in cron). GitHub code-search requires auth. So automated SERP/backlink scanning remains unavailable.

**What we can confirm:**
- **GitHub public repo** `preludeofme/heard-again` exists, **0 stars, 0 forks**, last pushed **2026-08-10**. The repo has **no `homepage` URL set** (a small but real fix — GitHub links to the homepage and it's a free citation/backlink surface).
- **No new inbound links or citations detected** — but this is still largely a measurement gap, not proof of zero.
- The site launched Aug 9; zero backlinks at this stage is normal and expected.

**Backlink opportunities (drafted but not yet executed — all in `docs/marketing/launch/`):**
- **Awesome-Selfhosted PR** — full submission draft ready (`awesome-selfhosted-pr.md`), including the exact one-liner and category placement. A merged PR = a high-value, authoritative backlink + the `r/selfhosted` halo. **This is the highest-leverage single backlink available and it is ready to submit.**
- **Show HN post** — draft complete with 3 A/B title variants + body (`hn-post.md`).
- **ProductHunt launch** — checklist + maker comment + images plan drafted.
- **Reddit** (r/opensource, r/selfhosted, r/SideProject, r/genealogy, r/familyhistory, r/AskOldPeople) + **LinkedIn founder post** — all drafted.

None of these have been confirmed as submitted/posted yet. The backlink pipeline is *built* but **not yet fired**.

---

## 5. Social Signals

Social content is **drafted but not yet published** (per Ryan's standing preference: agent drafts, Ryan reviews/posts — no auto-publish).

**Drafts this month** (`docs/marketing/drafts/social/`):

| Batch | Files | Notes |
|---|---|---|
| 2026-08-11 | facebook-group-post, linkedin-post, reddit-post, twitter-thread | From the "preserve family memories digitally" post |
| 2026-08-18 | facebook-group-post, linkedin-post, reddit-post, x-twitter-thread | From the NEW grandparents post (Aug 17) — X thread is a 7-tweet narrative ending `#FamilyHistory #OralHistory` |

**Engagement metrics:** None available — all drafts are unreviewed/unpublished as of report time. No live social analytics found for any channel.

**Assessment:** 8 high-quality platform-adapted drafts exist (the Aug 18 X thread is notably strong — first-person, no AI hype, links the grandparents post). The gap remains **publication, not creation**. Two full social batches are sitting idle.

---

## 6. Keyword Opportunities (3–5 new targets)

Grounded in the Aug 22 competitor report (update #2) + current content gaps:

1. **"audio QR code memory keepsake" / "voice in a photo book"** — *Highest priority, time-sensitive.* MyHeritage's MyStories audio QR codes (Aug 13) are generating fresh search volume around a brand-new feature term. A comparison/differentiator post ("Heard Again's approach: a living voice, not a one-time recording") captures this rising query **before it's crowded** and directly counters the closest competitor move. The competitor report confirms the competitive whitespace is still open — this is the moment to stake it.

2. **"what happens to my digital memories when I die" / "digital legacy plan"** — Still un-owned. None of the 5 posts addresses estate/digital-death planning. Under-served, adjacent to estate-planning SEO where FamilySearch/MyHeritage are weak. Feeds directly into the product's "data ownership / permanence" pillar.

3. **"self-hosted family memory archive" / "own your family data"** — The open-source self-hosting differentiator remains the clearest defensive moat (competitor report: "no major competitor clones a real family member's voice + self-host"). A post optimized for self-hosted/GitHub-audience keywords pairs with the pending Awesome-Selfhosted PR and the `r/selfhosted` play.

4. **"grandchildren questions for grandparents" / "interview questions for elderly relatives"** — The Aug 17 grandparents post covers *how* to record and *how* to ask, but does not yet rank for the *list-resource* variant (a "50 Questions to Ask Your Grandparents" listicle). The SEO plan's Week 2 keyword targets exactly this. High click-through list intent, low competition.

5. **"consent-first voice AI" / "ethical voice cloning for family"** — Post #3 already covers the ethics angle; a targeted rewrite to own the broader *ethics* query (rather than the *family* framing) builds topical authority that directly supports the differentiator ("we're the consent-first, open-source option").

**Priority:** #1 (ride the MyHeritage audio-QR trend now) and #3 (pair with the Awesome-Selfhosted PR) are the fastest, highest-leverage wins.

---

## 7. Action Items for Next Month

1. 🔴 **Commit & deploy the uncommitted robots.txt + sitemap fixes.** `UI/public/robots.txt` and `UI/public/sitemap.xml` are modified **but uncommitted** on disk — production is serving a stale robots.txt pointing at the non-www sitemap. Run `git add UI/public/robots.txt UI/public/sitemap.xml && git commit` (plus the other modified files if they're intended), push, redeploy, then re-verify `https://www.heardagain.com/robots.txt` serves the `www` sitemap URL. **This is the single highest-leverage technical action — the fix already exists, it just isn't deployed.**

2. 🔴 **Change 307 → 301 redirect** at Vercel/DNS for `heardagain.com` → `www.heardagain.com`. Consolidates all ranking signals to one canonical host. Low effort, been open since the Aug 12 audit.

3. 🟡 **Submit the Awesome-Selfhosted PR and set the GitHub repo homepage URL.** The PR draft is complete and ready. A merged PR delivers the single most authoritative backlink available right now. Separately, set `homepage: https://heardagain.com` on `preludeofme/heard-again` (free citation surface).

4. 🟡 **Add internal links + consolidate tags.** Add 3–5 contextual cross-links across the 5 posts (e.g. "Preserve Voices" ↔ "Preserve Memories Digitally" ↔ "Grandparents Voices" as the practical-guide cluster; "AI Ethics" ↔ "Open Source" as the trust/consent cluster). Shrink the tag set from 19 to a ~8-tag canonical vocabulary so the related-posts engine actually fires. Zero body-level internal links remains the largest content-side deficit.

5. 🟢 **Fire the distribution pipeline + activate the weekly cadence.** Publish the 2 social draft batches (8 drafts ready). Activate the `heard-again-blog-draft` Monday cron from `SEO_AUTOMATION_PLAN.md` to publish one post/week, starting with keyword #1 ("audio QR code memory keepsake") to ride the MyHeritage trend. Also connect Search Console + GA4 so next month's report can measure real impressions/clicks/keywords instead of reconstructing everything from HTTP checks.

---

## Appendix — Deliverables & Status

| Deliverable | File / Location | Status |
|---|---|---|
| 5 blog posts (launch) | `UI/src/content/blog/*.tsx` | ✅ Live (5th added Aug 17) |
| Blog index + post templates | `UI/src/pages/blog/index.tsx`, `[slug].tsx` | ✅ Live |
| Sitemap (14 URLs, www-canonical) | `UI/public/sitemap.xml` | ⚠️ on-disk updated, **uncommitted** |
| robots.txt | `UI/public/robots.txt` | 🟡 now 200, but **stale content deployed** (fix uncommitted) |
| 307→301 redirect | Vercel/DNS | 🟡 Open (3rd consecutive cycle) |
| Internal link graph | (blog source) | 🔴 Absent (0 links in 5 posts) |
| RSS/Atom feed | — | 🟡 Missing |
| Social drafts (8) | `docs/marketing/drafts/social/2026-08-11/` + `2026-08-18/` | ✅ Drafted, unpublished |
| Backlink pipeline (PH/HN/Reddit/awe-some/selfhosted) | `docs/marketing/launch/` | ✅ Drafted, not fired |
| Public GitHub repo | `preludeofme/heard-again` | ⚠️ 0 stars/forks, no homepage URL |
| SEO automation plan | `docs/marketing/SEO_AUTOMATION_PLAN.md` | ✅ Ready, cron not active |
| Competitor report (update #2) | `docs/marketing/reports/competitor/competitor-report-2026-08.md` | ✅ Informs §6 |

---

## Summary Scorecard

| Area | Grade | Δ | Note |
|---|---|---|---|
| Content production | **B** | — | 5 strong posts; still bursty, no cadence |
| Technical health | **C+** | ▲ (from C) | robots.txt 404 FIXED, but stale content + 307 drag it down |
| Blog structure | **C** | — | zero body-level internal links; 19 fragmented tags |
| Backlinks | **n/a** | — | unmeasurable this cycle (tooling down); pipeline drafted but unfired |
| Social | **B-** | — | 8 good drafts, nothing published |
| Keyword positioning | **A-** | ▲ | competitor-report-backed; #1 target now explicitly owned by grandparents post |

**Overall: ~74% (B-), a modest improvement.** The single biggest unlock this month is not new work — it's **committing and deploying the robots.txt/sitemap fix that's already written on disk but sitting uncommitted**. Right behind it: firing the already-drafted backlink pipeline (Awesome-Selfhosted PR + GitHub homepage URL) and activating the weekly publish cadence. The content and positioning fundamentals are strong; the blockers are now operational (deploy + distribute), not creative.
