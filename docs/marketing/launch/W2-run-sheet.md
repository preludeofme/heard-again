# W2 Launch Run Sheet

**Prepared 2026-10-04. Ryan executes. Agents do not post anything.**

Every piece of copy already exists. This sheet says what to open, when, and in what order.
Nothing here needs writing — only posting and replying.

---

## Hard rules (from `docs/marketing.md`, unchanged)

1. Never more than **one Heard Again post per day**.
2. Prefer **2–3 days between related posts**.
3. **15–30 minutes of real engagement** in a subreddit before your first post there.
4. Reply to every comment. Never argue.
5. **Never lead with the link.** No URL in a Reddit post body. Give links only when asked.
6. If asked "what are you building?", answer short, then stop.

---

## Before the window — do these on Sun 2026-10-11 and Mon 2026-10-12

Not posts. Setup. None of this counts against the one-post-a-day rule.

- [ ] Tag `v0.1.0` on the public repo. This removes the only awesome-selfhosted rejection risk.
- [ ] Confirm you can log in to: Reddit, Hacker News, LinkedIn, X, AlternativeTo, SaaSHub, Slant.
- [ ] Check your Reddit account meets r/selfhosted and r/opensource posting minimums (both filter new/low-karma accounts).
- [ ] **r/selfhosted warm-up:** 20 minutes. Comment helpfully on 3–4 threads. Say nothing about Heard Again.
- [ ] **r/opensource warm-up:** 20 minutes. Same.
- [ ] Block out the first 90 minutes after each post below. Comment replies in the first hour decide whether a post lives.

---

## Schedule — Plan A (recommended)

| Date | Day | Action | Time (ET) | Source file |
|---|---|---|---|---|
| 2026-10-13 | Tue | awesome-selfhosted PR | any | `awesome-selfhosted-pr.md` + `awesome-selfhosted/heard-again.yml` |
| 2026-10-13 | Tue | AlternativeTo + SaaSHub + Slant submissions | any | `directory-submissions.md` |
| 2026-10-14 | Wed | **r/selfhosted post** | 12:00–15:00 | `reddit/02-selfhosted.md` |
| 2026-10-15 | Thu | No post. Reply day on r/selfhosted. | — | — |
| 2026-10-16 | Fri | **r/opensource post** | 09:00–11:00 | `reddit/01-opensource.md` |
| 2026-10-17 | Sat | No post. Reply day. | — | — |
| 2026-10-18 | Sun | No post. Reply day. | — | — |
| 2026-10-19 | Mon | **LinkedIn founder post** | 08:00–10:00 | `linkedin-founder-post.md` |
| 2026-10-20 | Tue | **X thread** | 09:00–11:00 | `x-twitter-thread.md` |
| 2026-10-21 | Wed | **Show HN** | 08:00–09:00 | `hn-post.md` |

The PR and the directory listings are not social posts, so Tue carries both.
Reddit gap is 2 days, inside the "2–3 days" rule.

### Why X and HN sit 1–2 days past Oct 19

Six channels, a 2–3 day Reddit gap, and one-post-a-day do not fit in seven days without
putting something on a weekend. LinkedIn on a Saturday and Show HN on a Sunday both
underperform badly. Show HN is the single highest-upside item in the kit — it gets a
weekday morning or it is wasted. Plan A protects it.

### Plan B — everything inside Oct 13–19

Only if hitting Oct 19 matters more than channel timing:
LinkedIn Sat 10-17 · X Sun 10-18 · Show HN Mon 10-19 08:00 ET.
Costs roughly half the reach on LinkedIn and X. Show HN still lands on a weekday.

---

## Per-item notes

### awesome-selfhosted (Tue 10-13)
Read `awesome-selfhosted-pr.md` first — the submission process in the old draft was wrong
and has been corrected. One YAML file, PR against `awesome-selfhosted-data`, not the README.
**You must write the PR body yourself.** That repo bans LLM-written submissions and requires
a human attestation.

### Directories (Tue 10-13)
Copy from `directory-submissions.md`. Three separate accounts. AlternativeTo is the one that
actually sends traffic; do that one properly and do not rush the others.

### r/selfhosted (Wed 10-14)
Title: *Would you self-host something as personal as family memories?*
It is a question post, not an announcement. No link. The draft already names the project once
in the first line — that is the limit. If someone asks for the repo, give it once, in a reply.

### r/opensource (Fri 10-16)
Title: *Why I'm building an open-source alternative for family voice preservation instead of another AI startup*
Same shape. The draft ends with a real question about open-source voice models — answer the
answers. That thread is worth more as a conversation than as traffic.

### LinkedIn (Mon 10-19)
Post as written. LinkedIn is the one channel where a link in the body is normal.

### X (Tue 10-20)
8 tweets, posted as one thread in one sitting. Link lives in tweet 7, not tweet 1.

### Show HN (Wed 10-21)
- Title: use variant 1 — *Show HN: Heard Again — Open-source family voice preservation (consent-first, self-hosted)*. Variants 2 and 3 are more emotional; HN titles do better flat.
- Post the maker comment immediately after the submission goes live.
- **Links were wrong in the draft and are now fixed** (`heardagain.ai` → `heardagain.com`, `nrutledge1` → `preludeofme`). Re-check both before submitting.
- Clear your calendar for three hours. Show HN is won or lost in the comments.
- Expect hard questions on the consent model and on voice-clone misuse. The draft already
  concedes the open problems — stay in that posture. Do not defend.

---

## Fixed in the kit on 2026-10-04

| File | Problem | Fix |
|---|---|---|
| `hn-post.md` | Linked `heardagain.ai` and `github.com/nrutledge1/heard-again` — both dead | Corrected to `heardagain.com` and `preludeofme` |
| `awesome-selfhosted-pr.md` | Told you to edit the README markdown; said no Genealogy category exists | Rewritten: YAML in `awesome-selfhosted-data`, Genealogy tag confirmed to exist |
| `awesome-selfhosted/heard-again.yml` | Did not exist | Created, schema-correct, ready to copy |
| `directory-submissions.md` | No link verification | All URLs checked 200 |

---

## What counts as success

Not upvotes. Per `docs/marketing.md`: thoughtful conversations, feature requests, people
asking for the project unprompted, GitHub stars, contributors. Log anything that looks like
a customer signal — that is what W3 builds on.

## How it gets measured

Read `attribution.md` **before the first post** — attribution cannot be added to a post after it is live.
Short version: referrer-based, no UTMs on any link (Vercel gates UTM filtering behind a $10/month add-on
we do not need, because referrer drill-down already separates every channel including the two subreddits).

Record every result in `channel-results.md` within 48 hours. On the Hobby plan Vercel's reporting window
is one month, so the dashboard is not the record — the ledger is. Capture the **baseline** section of the
ledger before the first action, or every delta afterwards is unmeasurable.
