# W2 Launch Run Sheet

**Prepared 2026-10-04 · Revised 2026-10-07 after owner answers. Ryan executes. Agents do not post anything.**

Every piece of copy already exists. This sheet says what to open, when, and in what order.
Nothing here needs writing — only posting and replying.

**Owner answers 2026-10-07 (question card `ac8cacbf`):**
- **Directory accounts:** agent cannot create accounts, so directory submissions are **paused
  until Ryan creates the logins**. See "Before the first post" below.
- **Reddit drafts (r/selfhosted + r/opensource):** copy **approved as written**. Held only on
  login readiness — once Ryan's Reddit login is confirmed, the posts are go.
- **LinkedIn, X, Show HN drafts also touch loss** (grandmother's voice etc.) and have **not** been
  read by Ryan yet. Per the standing rule they need his read before posting — see schedule notes.

---

## Hard rules (from `docs/marketing.md`, unchanged)

1. Never more than **one Heard Again post per day**.
2. Prefer **2–3 days between related posts**.
3. **15–30 minutes of real engagement** in a subreddit before your first post there.
4. Reply to every comment. Never argue.
5. **Never lead with the link.** No URL in a Reddit post body. Give links only when asked.
6. If asked "what are you building?", answer short, then stop.

---

## Before the first post — do these Thu 2026-10-08

Not posts. Setup. None of this counts against the one-post-a-day rule.

- [ ] **Create the logins you do not already have:** AlternativeTo, SaaSHub, Slant (the three
  directory accounts). You told Growth & Launch 2026-10-07 that you would create these yourself.
- [ ] Confirm you can log in to: Reddit, Hacker News, LinkedIn, X.
- [ ] Check your Reddit account meets r/selfhosted and r/opensource posting minimums (both filter new/low-karma accounts).
- [ ] **r/selfhosted warm-up:** 20 minutes. Comment helpfully on 3–4 threads. Say nothing about Heard Again.
- [ ] **r/opensource warm-up:** 20 minutes. Same.
- [ ] Read the **LinkedIn, X, and Show HN drafts** before their posting days. They touch loss and
  need your read per the standing rule. Reddit drafts are already approved.
- [ ] Capture the **Baseline** table in `channel-results.md`. Every number after this is a delta from it; miss this and nothing downstream is measurable.
- [ ] Block out the first 90 minutes after each post below. Comment replies in the first hour decide whether a post lives.
- [x] Public repo pushed and tagged **v0.1.0** (verified 2026-10-07, `pushed_at` and release both live on GitHub). Done — do not re-do.

---

## Schedule — confirmed, starts 2026-10-08 (one day slip from Oct 5)

The owner answered the launch card the evening of **Wed Oct 7** and has not created the
directory logins yet, so the first posting window (r/selfhosted, Tue-wrongly-labelled Oct 7)
has passed. Schedule moves right by one day. Weekday labels corrected — the first version
was off by one everywhere (Oct 7 is a Wednesday, not a Tuesday).

| Date | Day | Action | Time (ET) | Source file |
|---|---|---|---|---|
| 2026-10-08 | Thu | Setup: create logins, both subreddit warm-ups, baseline, read remaining drafts | — | this sheet, above |
| 2026-10-08 | Thu | Directory submissions — AlternativeTo → SaaSHub → Slant, once logins exist | any | `directory-submissions.md` |
| 2026-10-09 | Fri | **r/selfhosted post** | 12:00–15:00 | `reddit/02-selfhosted.md` |
| 2026-10-10 | Sat | No post. Reply day on r/selfhosted. | — | — |
| 2026-10-11 | Sun | No post. Reply day. | — | — |
| 2026-10-12 | Mon | **r/opensource post** | 09:00–11:00 | `reddit/01-opensource.md` |
| 2026-10-13 | Tue | **ProductHunt (W3). W2 stands down — no post this day.** | 00:01 PT | `../w3/` |
| 2026-10-14 | Wed | **X thread** | 09:00–11:00 | `x-twitter-thread.md` |
| 2026-10-15 | Thu | **Show HN** | 08:00–09:00 | `hn-post.md` |
| 2026-10-16 | Fri | **LinkedIn founder post** | 08:00–10:00 | `linkedin-founder-post.md` |

Cadence check: one post a day, never two. Reddit gap is 3 days (Oct 9 → Oct 12), inside the
"2–3 days" rule. Directory submissions are not social posts, so Thu does not collide with
Fri's Reddit post. **Show HN lands Thu Oct 15 — a strong HN day, moved off Oct 13 because
that is W3's locked ProductHunt launch.** X (Oct 14) runs the day before to warm the same
dev audience, then LinkedIn closes the week on Fri Oct 16.

### Why this starts 2026-10-08 and the Show HN date holds

The deadline is a *cleared Stripe payment* by 2026-11-03, and every paid plan has a 14-day
trial. So the trial that pays has to start by about **2026-10-20**. Work backwards:

| Show HN date | Trial ends | Clears by Nov 3? |
|---|---|---|
| Thu 2026-10-15 (this sheet) | 2026-10-29 | **Yes, with 5 days of slack** |
| Wed 2026-10-14 | 2026-10-28 | Yes, 6 days of slack |
| Thu 2026-10-22 (worst case if logins take a week) | 2026-11-05 | **No** — trial clock blown |

The one-day slip (Oct 5 → Oct 8 start) costs nothing against the deadline: Show HN still
lands Thu Oct 15 and a trial started that day clears with five days of slack. The danger is
not the one-day slip — it is **if the directory logins take longer than Thu Oct 8**. Every
day logins are late pushes Show HN later. If logins are not ready by end of Thu Oct 8, tell
Growth & Launch immediately so the sequence can be compressed (X can move before the Reddit
round, LinkedIn can drop behind Show HN, Show HN must land **no later than Mon Oct 19**).

Show HN is the kit's highest-upside item and it keeps its weekday morning on Oct 15. The
original Oct 13–19 task window was never a constraint from anywhere; what constrains is the
Oct 20 trial cutoff, and this sheet clears it with five days of slack.

### Dropped from this sheet: awesome-selfhosted

It was item 1 and it is now item none. Heard Again is ineligible until ~2027-02-03 and the
destination repo forbids agent-authored submissions outright. Both verified against the repo's
own files — see `awesome-selfhosted-pr.md`. It is a Q1-2027 backlink, not a launch channel, and
it should not take another minute of launch-window time.

---

## Per-item notes

### Directories (Thu 10-08)
Copy from `directory-submissions.md`. Three separate accounts. AlternativeTo is the one that
actually sends traffic; do that one properly and do not rush the others. **Paused until you
create the accounts — you said 2026-10-07 that you would. If you want Growth & Launch to do
the pasting once the accounts exist, propose the credentials as Paperclip secrets; otherwise
you paste from this file yourself.**

### r/selfhosted (Fri 10-09)
Title: *Would you self-host something as personal as family memories?*
It is a question post, not an announcement. No link. The draft already names the project once
in the first line — that is the limit. If someone asks for the repo, give it once, in a reply.
**Copy approved by Ryan 2026-10-07.**

### r/opensource (Mon 10-12)
Title: *Why I'm building an open-source alternative for family voice preservation instead of another AI startup*
Same shape. The draft ends with a real question about open-source voice models — answer the
answers. That thread is worth more as a conversation than as traffic.
**Copy approved by Ryan 2026-10-07.**

### X (Wed 10-14)
8 tweets, posted as one thread in one sitting. Link lives in tweet 7, not tweet 1.
**Draft touches loss — needs Ryan's read before posting (not yet given).**

### Show HN (Thu 10-15)
- Title: use variant 1 — *Show HN: Heard Again — Open-source family voice preservation (consent-first, self-hosted)*. Variants 2 and 3 are more emotional; HN titles do better flat.
- Post the maker comment immediately after the submission goes live.
- **Links were wrong in the draft and are now fixed** (`heardagain.ai` → `heardagain.com`, `nrutledge1` → `preludeofme`). Re-check both before submitting.
- Clear your calendar for three hours. Show HN is won or lost in the comments.
- Expect hard questions on the consent model and on voice-clone misuse. The draft already
  concedes the open problems — stay in that posture. Do not defend.
- **Draft touches loss — needs Ryan's read before posting (not yet given).**

### LinkedIn (Fri 10-16)
Post as written. LinkedIn is the one channel where a link in the body is normal.
**Draft touches loss — needs Ryan's read before posting (not yet given).**

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
| `W2-run-sheet.md` (2026-10-07) | Weekday labels were off by one everywhere; LinkedIn collided with W3's locked ProductHunt launch on Oct 13; Oct 7 posting window passed before owner created logins | Corrected labels; schedule slid one day to start Oct 8; Show HN Thu Oct 15; LinkedIn Fri Oct 16; directories paused on login creation |
| `reddit/01-opensource.md`, `reddit/02-selfhosted.md` (2026-10-07) | Header posting dates and weekday labels matched the old (wrong) sheet | Updated to Fri 10-09 and Mon 10-12; noted owner approval 2026-10-07 |

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
