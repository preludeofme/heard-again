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

## Before the first post — do these Sun 2026-10-05

Not posts. Setup. None of this counts against the one-post-a-day rule.

- [ ] Confirm you can log in to: Reddit, Hacker News, LinkedIn, X, AlternativeTo, SaaSHub, Slant.
- [ ] Check your Reddit account meets r/selfhosted and r/opensource posting minimums (both filter new/low-karma accounts).
- [ ] **r/selfhosted warm-up:** 20 minutes. Comment helpfully on 3–4 threads. Say nothing about Heard Again.
- [ ] **r/opensource warm-up:** 20 minutes. Same.
- [ ] Capture the **Baseline** table in `channel-results.md`. Every number after this is a delta from it; miss this and nothing downstream is measurable.
- [ ] Block out the first 90 minutes after each post below. Comment replies in the first hour decide whether a post lives.
- [ ] Push the public repo. Last push was 2026-09-07 and a Show HN audience checks that. Tag `v0.1.0` while you are there — not for awesome-selfhosted, which it does not help, but so visitors have something installable.

---

## Schedule — confirmed, starts 2026-10-05

| Date | Day | Action | Time (ET) | Source file |
|---|---|---|---|---|
| 2026-10-05 | Sun | Setup + both subreddit warm-ups + baseline capture | — | this sheet, above |
| 2026-10-06 | Mon | AlternativeTo + SaaSHub + Slant submissions | any | `directory-submissions.md` |
| 2026-10-07 | Tue | **r/selfhosted post** | 12:00–15:00 | `reddit/02-selfhosted.md` |
| 2026-10-08 | Wed | No post. Reply day on r/selfhosted. | — | — |
| 2026-10-09 | Thu | **r/opensource post** | 09:00–11:00 | `reddit/01-opensource.md` |
| 2026-10-10 | Fri | No post. Reply day. | — | — |
| 2026-10-11 | Sat | No post. Reply day. | — | — |
| 2026-10-12 | Sun | No post. Reply day. | — | — |
| 2026-10-13 | Mon | **LinkedIn founder post** | 08:00–10:00 | `linkedin-founder-post.md` |
| 2026-10-14 | Tue | **X thread** | 09:00–11:00 | `x-twitter-thread.md` |
| 2026-10-15 | Wed | **Show HN** | 08:00–09:00 | `hn-post.md` |

Cadence check: one post a day, never two. Reddit gap is 2 days, inside the "2–3 days" rule.
Directory submissions are not social posts, so Mon does not collide with Tue's Reddit post.
Show HN lands on a Wednesday morning ET, which is what it needs.

### Why this starts 2026-10-05 and not 2026-10-13

The deadline is a *cleared Stripe payment* by 2026-11-03, and every paid plan has a 14-day
trial. So the trial that pays has to start by about **2026-10-20**. Work backwards:

| Show HN date | Trial ends | Clears by Nov 3? |
|---|---|---|
| Wed 2026-10-21 (old Plan A) | 2026-11-04 | **No** — one day late |
| Mon 2026-10-19 (old Plan B) | 2026-11-02 | Yes, with one day of slack |
| **Wed 2026-10-15 (this sheet)** | **2026-10-29** | **Yes, with 5 days of slack** |

The old Plan A was labelled "recommended" but put the kit's highest-upside channel one day
past the only date that defines the goal. The old Plan B hit the date by moving LinkedIn to a
Saturday and X to a Sunday, costing roughly half the reach on both.

Starting on Oct 5 dissolves the trade-off instead of picking a side: every cadence rule holds,
nothing lands on a weekend, Show HN keeps its weekday morning, and there are five days of
slack. The Oct 13 start date was never a constraint from anywhere — it discarded nine of the
thirty remaining days for no stated reason. It also leaves Oct 16–20 free as a genuine second
shot: if Show HN underperforms, W3's ProductHunt launch and the round-two subreddits
(r/genealogy, r/familyhistory) can still start a trial before the Oct 20 cutoff. Under Plan A
there was no second shot at all.

### Dropped from this sheet: awesome-selfhosted

It was item 1 and it is now item none. Heard Again is ineligible until ~2027-02-03 and the
destination repo forbids agent-authored submissions outright. Both verified against the repo's
own files — see `awesome-selfhosted-pr.md`. It is a Q1-2027 backlink, not a launch channel, and
it should not take another minute of launch-window time.

---

## Per-item notes

### Directories (Mon 10-06)
Copy from `directory-submissions.md`. Three separate accounts. AlternativeTo is the one that
actually sends traffic; do that one properly and do not rush the others.

### r/selfhosted (Tue 10-07)
Title: *Would you self-host something as personal as family memories?*
It is a question post, not an announcement. No link. The draft already names the project once
in the first line — that is the limit. If someone asks for the repo, give it once, in a reply.

### r/opensource (Thu 10-09)
Title: *Why I'm building an open-source alternative for family voice preservation instead of another AI startup*
Same shape. The draft ends with a real question about open-source voice models — answer the
answers. That thread is worth more as a conversation than as traffic.

### LinkedIn (Mon 10-13)
Post as written. LinkedIn is the one channel where a link in the body is normal.

### X (Tue 10-14)
8 tweets, posted as one thread in one sitting. Link lives in tweet 7, not tweet 1.

### Show HN (Wed 10-15)
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
| `directory-submissions.md` | No link verification | All URLs checked 200 |
| `awesome-selfhosted-pr.md` (2nd pass) | Claimed tagging `v0.1.0` removes the only rejection risk. It does the opposite — the rule measures releases, and there are none, so tagging today dates the first release to today | Rewritten as an ineligibility verdict: earliest viable ~2027-02-03, channel dropped from W2 |
| `awesome-selfhosted/heard-again.yml` | An agent-written entry for Ryan to submit as his own — forbidden in that repo's `CONTRIBUTING.md` | Deleted; `awesome-selfhosted/README.md` records why |
| `W2-run-sheet.md` | Plan A put Show HN on Oct 21, one day past the last date a 14-day trial can clear by Nov 3 | Single schedule starting Oct 5; Show HN Wed Oct 15 with 5 days of slack |

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
