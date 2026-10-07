# W2 Channel Results Ledger

**The record of what each launch action actually delivered.** Method: `attribution.md`.

Fill this in within 48 hours of each post. The Vercel dashboard is not the record — on the Hobby plan
its reporting window is one month and this data disappears in mid-November.

Dates below follow the confirmed schedule in `W2-run-sheet.md`, revised 2026-10-07 (one-day
slip to start Oct 8; weekday labels corrected; LinkedIn moved off Oct 13 which is W3's locked
ProductHunt launch; Show HN stays Thu Oct 15).

Status values: `not posted` · `posted` · `measured` · `dead` (delivered nothing; stop spending time on it)

---

## Baseline

Record this **once**, before the first action, so every delta has something to subtract from.
The GitHub row is already filled from the API. The Vercel and Stripe rows need a dashboard login,
which no agent holds — Ryan fills those on Thu 2026-10-08 before the first submission goes out.

| Metric | Value | Captured on |
|---|---|---|
| Visitors, trailing 7-day daily average | | |
| Visitors, trailing 7-day total | | |
| Top 3 referrers | | |
| Direct visitors, 7-day total | | |
| GitHub stars on `preludeofme/heard-again` | **0** (also 0 forks, 0 watchers) | 2026-10-04 |
| Total signups to date | | |
| Active Stripe trials | | |
| Cleared Stripe payments | | |

---

## Actions

### 1. awesome-selfhosted PR
- **Destination:** PR against `awesome-selfhosted/awesome-selfhosted-data`
- **Planned:** — · **Posted:** never · **Status:** `dead` for the W2 window (recheck 2027-02-03)
- **PR URL:** — (no PR opened, and none should be)
- Referrer that would have been watched: `github.com`, `awesome-selfhosted.net`
- **Why dead, verified 2026-10-04 against the destination repo's own files:**
  1. The PR template requires ticking "first released more than 4 months ago". `preludeofme/heard-again`
     has **0 tags and 0 releases**. Tagging `v0.1.0` now dates the first release to now, so the earliest
     honest submission is **2027-02-03** — four months past the company deadline.
  2. `CONTRIBUTING.md` forbids agents from opening the PR, writing the entry YAML for a human to submit
     as their own, writing the PR body, or ticking the human attestation box.
- Secondary risk if revisited: public repo last pushed 2026-09-07, which also strains "actively maintained".
- Full reasoning: `awesome-selfhosted-pr.md`. Do not spend more W2 time here.

| | +24h | +48h | on merge |
|---|---|---|---|
| Visitors | | | |
| Stars | | | |

---

### 2. AlternativeTo
- **Destination:** https://alternativeto.net/ — listed as alternative to StoryCorps, MyHeritage DeepStory
- **Planned:** 2026-10-08 · **Posted:** — · **Status:** not posted — **paused: owner creating the account** (Ryan, 2026-10-07)
- **Listing URL:** —
- Referrer: `alternativeto.net`
- Note: of the three directories this is the one that actually sends traffic. Do it properly.

| | +48h | +7d |
|---|---|---|
| Visitors | | |

---

### 3. SaaSHub
- **Destination:** https://www.saashub.com/
- **Planned:** 2026-10-08 · **Posted:** — · **Status:** not posted — **paused: owner creating the account** (Ryan, 2026-10-07)
- **Listing URL:** —
- Referrer: `saashub.com`

| | +48h | +7d |
|---|---|---|
| Visitors | | |

---

### 4. Slant
- **Destination:** https://www.slant.co/ — "What is the best tool for preserving family voices and stories?"
- **Planned:** 2026-10-08 · **Posted:** — · **Status:** not posted — **paused: owner creating the account** (Ryan, 2026-10-07)
- **Answer URL:** —
- Referrer: `slant.co`

| | +48h | +7d |
|---|---|---|
| Visitors | | |

---

### 5. r/selfhosted
- **Destination:** r/selfhosted — *"Would you self-host something as personal as family memories?"*
- **Planned:** 2026-10-09, 12:00–15:00 ET · **Posted:** — · **Status:** not posted — **copy approved 2026-10-07, held on login readiness**
- **Thread URL:** —
- **No link in the body.** Attribution is before/after plus the Direct line. If the repo link is given in
  a reply, note the reply time here: —

| | +1h | +24h | +48h |
|---|---|---|---|
| Visitors | | | |
| Direct visitors | | | |
| Referrals from this thread | | | |
| Upvotes | | | |
| Comments | | | |

**Signal worth more than traffic** — thoughtful replies, feature requests, people asking for the repo
unprompted, offers to contribute:

---

### 6. r/opensource
- **Destination:** r/opensource — *"Why I'm building an open-source alternative for family voice preservation instead of another AI startup"*
- **Planned:** 2026-10-12, 09:00–11:00 ET · **Posted:** — · **Status:** not posted — **copy approved 2026-10-07, held on login readiness**
- **Thread URL:** —
- Same method as above. The draft ends on a real question about open-source voice models; this thread is
  worth more as a conversation than as traffic.

| | +1h | +24h | +48h |
|---|---|---|---|
| Visitors | | | |
| Direct visitors | | | |
| Referrals from this thread | | | |
| Upvotes | | | |
| Comments | | | |

**Signal:**

---

### 7. LinkedIn founder post
- **Planned:** 2026-10-16, 08:00–10:00 ET · **Posted:** — · **Status:** not posted — **draft touches loss, needs Ryan's read before posting**
- **Post URL:** —
- Referrer: `linkedin.com`, `lnkd.in`. Expect a chunk in Direct — the LinkedIn mobile app strips referrers.
- The only channel in the kit where a link in the body is normal.

| | +24h | +48h |
|---|---|---|
| Visitors | | |
| Impressions | | |
| Reactions / comments | | |

---

### 8. X thread
- **Planned:** 2026-10-14, 09:00–11:00 ET · **Posted:** — · **Status:** not posted — **draft touches loss, needs Ryan's read before posting**
- **Thread URL:** —
- Referrer: `t.co`. Use Vercel's `t.co` drill-down to resolve it back to the thread.
- Link is in tweet 7, not tweet 1.

| | +24h | +48h |
|---|---|---|
| Visitors | | |
| Impressions | | |
| Reposts | | |

---

### 9. Show HN
- **Destination:** Hacker News — *Show HN: Heard Again — Open-source family voice preservation (consent-first, self-hosted)*
- **Planned:** 2026-10-15, 08:00–09:00 ET · **Posted:** — · **Status:** not posted — **draft touches loss, needs Ryan's read before posting**
- **Submission URL:** —
- Referrer: `news.ycombinator.com`
- **The highest-upside item in the kit.** A front-page Show HN is the one event that can deliver the
  300–1,000 in-market visitors one conversion needs. Everything else is a supporting act.
- Maker comment posted at: —
- Peak rank / did it reach the front page: —

| | +1h | +6h | +24h | +48h |
|---|---|---|---|---|
| Visitors | | | | |
| Points | | | | |
| Comments | | | | |
| Stars | | | | |
| Signups | | | | |

**Hard questions that came up** (feeds the W3 reply bank):

---

## Signups and trials

Attributed by timestamp — see `attribution.md`. Label the confidence honestly.

| # | Signup time (ET) | Nearest live post | Confidence | Trial started | Trial ends | Payment cleared |
|---|---|---|---|---|---|---|
| | | | | | | |

**Goal:** one cleared Stripe payment by 2026-11-03. A 14-day trial means the trial that produces it must
start by **2026-10-20** at the latest.

---

## Verdict per channel

Fill in after measuring. Channel honesty: if it delivered nothing, write that and stop spending
heartbeats on it. Do not pad.

| Channel | Visitors | Signups | Verdict |
|---|---|---|---|
| awesome-selfhosted | | | |
| AlternativeTo | | | |
| SaaSHub | | | |
| Slant | | | |
| r/selfhosted | | | |
| r/opensource | | | |
| LinkedIn | | | |
| X | | | |
| Show HN | | | |
