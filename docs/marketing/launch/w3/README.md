# W3 Run Sheet — Genealogy communities + ProductHunt

**Window:** Mon 2026-10-20 → Mon 2026-10-26
**Prep runs before the window:** Mon 2026-10-05 → Sun 2026-10-19
**Rule:** agents draft, Ryan posts. Nothing in this folder goes out until Ryan has read it.

W2 reached self-hosters. Most of them will not pay, because they can run it themselves.
W3 reaches the people who will: genealogists, family historians, and the ProductHunt
audience that buys small, careful tools.

---

## Sign-off gates

Ryan must read and approve these before anything is posted. Each one talks about a dead
or dying family member.

| Asset | Where it goes | Approved |
|---|---|---|
| `../reddit/04-genealogy.md` | r/Genealogy | [ ] |
| `../reddit/05-familyhistory.md` | r/FamilyHistory | [ ] |
| `../reddit/06-askoldpeople.md` | r/AskOldPeople | [ ] |
| `../producthunt-maker-comment.md` | ProductHunt | [ ] |
| `facebook-genealogy-playbook.md` → "The one mention" | Facebook groups | [ ] |
| `reply-bank.md` | Replies in all of the above | [ ] |

Second gate: the ProductHunt listing is scheduled on **Sat 2026-10-17** and can be edited
until it goes live. Ryan schedules it. No agent touches the listing.

---

## Prep (before the window)

| Date | Who | Action |
|---|---|---|
| Mon 2026-10-05 | Ryan | Read and mark the six assets above. Edit anything that sounds like a pitch. |
| Mon 2026-10-05 | Ryan | Request to join the Facebook groups in `facebook-genealogy-playbook.md`. Approval takes days. |
| Tue 2026-10-06 → Sun 2026-10-19 | Ryan | Facebook warm-up. Answer other people's questions. Post nothing about Heard Again. |
| Wed 2026-10-07 | Ryan | ProductHunt maker profile: photo, bio, GitHub, X. |
| Fri 2026-10-09 | Ryan | Line up 3–5 people who will leave a real comment on launch day. Not upvotes — comments. |
| ~~Fri 2026-10-16~~ | ~~Ryan~~ | ~~**Hard gate:** five gallery images~~ — **done 2026-10-04.** Built and committed to `producthunt-gallery/`, 1270×760, two of them real screenshots of the live site. This gate no longer slips the launch. |
| Fri 2026-10-16 | Ryan | Check heardagain.com: signup works, pricing page loads, OG image renders. |
| Sat 2026-10-17 | Ryan | Schedule the ProductHunt listing for Tue 2026-10-20, 00:01 PT. |

---

## The window

### Tue 2026-10-20 — ProductHunt launch day

| Time (PT) | Action |
|---|---|
| 00:01 | Listing goes live. Confirm it renders. |
| 00:05 | Post the maker comment. |
| 00:05 → 02:00 | Reply to every comment inside 30 minutes. PH weights early maker replies heavily. |
| 06:00 | Post the launch tweet and LinkedIn post (`../x-twitter-thread.md`, `../linkedin-founder-post.md`). |
| All day | Reply to everything. Comment on 3–5 other launches, honestly. |
| 11:59 | Day closes. Screenshot the final rank, votes, comments. |

Do not post anything on Reddit today. Two launches in one day looks coordinated, which is
exactly the thing genealogy communities punish.

Why Tuesday and not Wednesday: Wednesday is the r/Genealogy slot in the cadence, and a
Tuesday launch leaves the rest of the window clear. If Ryan prefers Wednesday, move every
Reddit post down by one day and drop r/AskOldPeople to Wed 2026-10-28.

### Wed 2026-10-21 — r/Genealogy

- Post `../reddit/04-genealogy.md`, 19:00–21:00 ET.
- No link. No product name in the post.
- Reply to every comment for the first hour, then check back every few hours.
- Keep replying to ProductHunt comments through the day.

### Thu 2026-10-22 — ProductHunt follow-through

- Thank-you post or tweet to everyone who commented.
- Log every feature request as a GitHub issue, reply to the person with the issue link.
- Facebook: still answering other people's questions. Still no mention.

### Fri 2026-10-23 — quiet

- Replies only. Nothing new goes out.
- Post-launch reflection post is optional and can wait.

### Sat 2026-10-24 — r/FamilyHistory

- Post `../reddit/05-familyhistory.md`, 10:00–13:00 ET.
- This one is a question, not a story. Let the thread be about them.

### Sun 2026-10-25 — quiet

- Replies only.
- First Facebook mention is allowed from today, **only** if someone asks a question it
  actually answers. See `facebook-genealogy-playbook.md`. If no such question appears,
  say nothing. There is no deadline on this.

### Mon 2026-10-26 — r/AskOldPeople

- Post `../reddit/06-askoldpeople.md`, 09:00–12:00 ET.
- Cadence says Wednesday. Moved to Monday to stay inside the window; r/AskOldPeople reads
  in the morning on any weekday.
- This audience is the subject of the product, not the market. Listen. Do not mention
  Heard Again at all in this thread, even if asked twice.

---

## Cadence rules carried over from `docs/marketing.md`

- One Heard Again post per day, maximum.
- 2–3 days between related posts. This sheet: Wed → Sat → Mon.
- No links unless someone asks.
- Reply to every comment. Never argue. Never defend.

---

## What we count

Links, UTMs, the baseline week and the per-channel record live in
[`attribution.md`](attribution.md). Nothing gets reported as a result unless it has a
row there.

Not upvotes, not karma, not ProductHunt rank.

- People who ask what the project is.
- People who sign up from a genealogy source (check the referrer in analytics).
- Paid conversions from that traffic. This is the number W3 exists for.
- Feature requests that come from genealogists rather than developers.

Carry the numbers into TRU-9 (W4) on Tue 2026-10-27.

---

## Known risk

If W2 (TRU-5) already posted r/Genealogy or r/FamilyHistory on the original Week 2
schedule, do not repost. Replace that day with comment engagement in the existing thread
and move the remaining posts up a day.

**Checked 2026-10-04:** W2 has posted nothing yet. Its thread contains a plan and an
unanswered question card, no permalinks. So there is no repost risk — but there is a
collision, below.

---

## Two problems with these dates

Raised by Growth & Launch on 2026-10-04, before the plan is approved.

### 1. The trial clock rules out most of this week

The company goal is a payment that **clears in Stripe by 2026-11-03**. Every paid plan
has a 14-day trial. So a trial has to start on or before **2026-10-20** to be charged
by the deadline.

Lay the window against that:

| W3 item | Date | Can it produce a cleared payment by 11-03? |
|---|---|---|
| ProductHunt | Tue 10-20 | Only if someone starts a trial that same day. Zero slack. |
| r/Genealogy | Wed 10-21 | **No** |
| r/FamilyHistory | Sat 10-24 | **No** |
| r/AskOldPeople | Mon 10-26 | **No** (and it carries no mention by design) |
| Facebook mention | Sun 10-25 | **No** |

ProductHunt is the only item in W3 that can hit the goal, and it is scheduled on the
last possible day, with no room for a listing that renders wrong, a slow approval, or a
bad launch day. The Reddit and Facebook work is still worth doing — it builds the
channel that W4 and W5 run on — but it should not be counted toward 11-03.

**Recommendation: move ProductHunt to Tue 2026-10-13.** A trial started that day is
charged 10-27, a week before the deadline. The gallery images are done, so the only
remaining prep is the maker profile, a handful of people willing to comment, and
scheduling the listing — nine days is enough. Reddit and Facebook stay exactly where
they are.

### 2. W2 and W3 both claim 20 and 21 October

W2's plan ([TRU-5](/TRU/issues/TRU-5)) puts the **X thread on Tue 10-20** and
**Show HN on Wed 10-21**. W3 puts **ProductHunt on Tue 10-20** and **r/Genealogy on
Wed 10-21**. Two of the four biggest assets land on each of those two days.

That breaks the one-post-per-day rule that the rest of both plans are built on, and
Show HN against ProductHunt on consecutive days splits the founder's attention on the
only two days that can carry a spike.

Moving ProductHunt to 10-13 resolves both problems at once: PH gets a clear day, Show HN
keeps 10-21, and the X thread on 10-20 becomes launch-adjacent instead of competing.

Chief Of Staff owns the call, because it spans both issues.
