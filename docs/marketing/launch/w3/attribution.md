# W3 attribution — how we will know which channel worked

A post with no measurable visits teaches nothing. This is the smallest scheme
that still answers "which channel brought the person who paid."

Analytics in place: **Vercel Web Analytics** (`@vercel/analytics` is wired in
`UI/src/pages/_app.tsx`, and `https://www.heardagain.com/_vercel/insights/script.js`
returns 200 as of 2026-10-04). It records page views with referrer and UTM
parameters. That is enough for visits. It is **not** enough for trials — see the
gap at the bottom.

**Destination verified 2026-10-04** (Growth & Launch, independent fetch, not a
read of the diff). `GET https://www.heardagain.com/?utm_source=paperclip-growth&utm_medium=verify&utm_campaign=tru4-check`
→ **200**, 203,515 bytes, query string preserved on the effective URL (no
redirect strips the UTM). In that HTML: `Hear their voice again — with no setup.`
above the fold, `Why pay, when the code is free?` immediately above the
`$4.99` tier, `href="/#pricing"` in the nav, and `id="pricing"` present — so the
`/#pricing` anchor resolves for a cold visitor arriving from a comment link.
Every link in the table below now lands on that page. [TRU-4](/TRU/issues/TRU-4).

**Update, later the same day.** A standalone `/pricing` page has since deployed.
Re-fetched: `https://www.heardagain.com/pricing` → **200** (previously
`307 → /login`), and `…/pricing?utm_source=…` → **200**, so it carries UTMs too.
Reply-bank answers to "what does it cost" now point at that clean URL instead of
the `/#pricing` anchor; the anchor still resolves and is still fine for the nav.

---

## The links

| Channel | Link to use | Why |
|---|---|---|
| ProductHunt listing | `https://www.heardagain.com/?utm_source=producthunt&utm_medium=launch&utm_campaign=w3` | PH passes query strings through on the website field |
| ProductHunt maker comment | `https://www.heardagain.com/?utm_source=producthunt&utm_medium=comment&utm_campaign=w3` | Separates the listing click from the comment click |
| X / Twitter thread | `https://www.heardagain.com/?utm_source=x&utm_medium=social&utm_campaign=w3` | |
| LinkedIn founder post | `https://www.heardagain.com/?utm_source=linkedin&utm_medium=social&utm_campaign=w3` | |
| Facebook group mention | `https://www.heardagain.com/?utm_source=facebook&utm_medium=group&utm_campaign=w3` | Only if the single permitted mention happens |
| Pricing answer in any thread | `https://www.heardagain.com/pricing?utm_source=reply&utm_medium=comment&utm_campaign=w3` | Verified 200 with UTMs attached. Use when someone asks the cost directly |
| r/Genealogy | **no link in the post** | Cadence rule. Attribution comes from the referrer |
| r/FamilyHistory | **no link in the post** | Same |
| r/AskOldPeople | **no link at all** | No mention of the product in that thread, by design |

For the three Reddit threads, if someone asks for the link in a comment, reply
with `https://www.heardagain.com/?utm_source=reddit&utm_medium=comment&utm_campaign=w3`.
A UTM pasted into a reply is honest; a UTM in the original post reads as
marketing and is what gets a thread removed.

Reddit also strips referrers on some clients, so the Reddit number will be a
floor, not a true count. Say so when reporting it rather than rounding up.

---

## The baseline

Record daily totals for the seven days **before** the first W3 post. The first W3
post is now ProductHunt on **Tue 2026-10-13** (approved 2026-10-07), so the baseline
week is **Mon 2026-10-06 → Sun 2026-10-12**. Without a baseline, launch-day traffic
cannot be separated from normal traffic. One number per day: total visits, and visits
from each referrer that already appears.

Owner: Growth & Launch. The numbers come from Vercel Analytics (dashboard login — no
agent holds it; Ryan reads the dashboard, or Growth & Launch pulls them once an
analytics connection exists). To be captured **before 00:01 PT on 10-13**.

| Date | Visits | Top referrers |
|---|---|---|
| Mon 2026-10-06 | | |
| Tue 2026-10-07 | | |
| Wed 2026-10-08 | | |
| Thu 2026-10-09 | | |
| Fri 2026-10-10 | | |
| Sat 2026-10-11 | | |
| Sun 2026-10-12 | | |

Note: W2's own posts land inside this baseline week (directories 10-08, r/selfhosted
10-09, r/opensource 10-12 — per W2's re-confirmed sheet of 2026-10-07). LinkedIn moved
to Fri 10-16, outside this baseline. The baseline is "ordinary traffic with W2 already
live" — it is a delta reference for the W3 spike, not a clean-room week. Say so when
reporting.

---

## What gets recorded per channel

For every post, one row. No row, no claim.

| Field | Example |
|---|---|
| Channel | r/Genealogy |
| Posted at | 2026-10-21 19:40 ET |
| Permalink | _(the actual URL)_ |
| Visits in the 48h after | 0 |
| Signups | 0 |
| Trials started | 0 |
| Verdict | kept / dropped |

"0" is a real result and gets written down. A channel that delivered nothing is
reported as nothing and gets no further heartbeats.

---

## The gap that matters

Vercel Analytics attributes **page views**, not **conversions**. There is
currently no event on signup, trial start, or checkout, so the column that
actually decides the company goal — *which channel produced the trial* — cannot
be filled from the analytics we have.

That work is [TRU-13](/TRU/issues/TRU-13) — "Add funnel events to the pay path
(5 track calls)", currently in backlog. Until it ships, trial attribution has to
be reconstructed by hand from signup timestamps against post times, which is
guesswork once more than one channel is live in the same week.

[TRU-9](/TRU/issues/TRU-9) (Conversion, in progress) adds `track()` calls on the
Pricing nav click, the plan-card click, and checkout arrival. That overlaps
TRU-13's checkout event, so whoever ships second should check the other first
rather than double-instrumenting the same click.

**One requirement on whichever lands first, or neither fixes this gap:** the
trial-start / checkout event must carry the visitor's **first-touch
`utm_source`**, captured on the landing page view and persisted for the session.
A `checkout_started` event with no source tells us *that* a trial began, not
*which channel* produced it — and "which channel produced the trial" is the only
number the company goal actually needs. Referrer is not a substitute: Reddit
strips it on several clients, which is exactly where the traffic is coming from.

**If TRU-13 does not ship before the ProductHunt launch, the single most
important number of W3 will be an estimate.** Raised to Chief Of Staff.
