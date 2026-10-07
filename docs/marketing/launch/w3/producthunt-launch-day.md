# ProductHunt — dated launch plan

**Launch:** Tuesday 2026-10-13, 00:01 PT — **confirmed by Ryan 2026-10-07**
**Schedule the listing:** Saturday 2026-10-10 (PH allows scheduling 3 days ahead)
**Who:** Ryan. Agents do not touch the listing or the comments.

Source assets live one level up in `docs/marketing/launch/`. This file only adds dates,
decisions, and the things that are not done yet.

---

## Decisions already made

| Field | Value | Source |
|---|---|---|
| Tagline | Family stories, preserved with care. | `../producthunt-tagline.txt` |
| Description | "An open-source platform for preserving family voices and stories — with care, not AI trickery…" (primary) | `../producthunt-description.txt` |
| Topics | Open Source, Family, Voice & Audio, Artificial Intelligence, Memory | `../producthunt-topics.txt` |
| Maker comment | Primary, unedited | `../producthunt-maker-comment.md` |
| Gallery, 5 × 1270×760 | **Built.** Upload in filename order | `producthunt-gallery/` |
| Thumbnail, 240×240 | **Built.** `thumbnail-240.png` — separate PH field, not the gallery | `producthunt-gallery/` |
| Website | `https://www.heardagain.com/?utm_source=producthunt&utm_medium=launch&utm_campaign=w3` | `attribution.md`. **Paste the UTM, not the bare domain** — PH passes the query string through, and without it the launch is unattributable |
| Repo | https://github.com/preludeofme/heard-again | |
| Pricing | Free self-hosted; $4.99–$39.99/mo cloud | Link `heardagain.com/pricing` (verified 200) if asked in a comment |

Tuesday over Wednesday: Wednesday was the r/Genealogy slot in the original cadence, and a
Tuesday launch leaves the rest of the window clear. With PH confirmed for Tue 10-13, the
Wednesday-r/Genealogy reason no longer binds — r/Genealogy is now Wed 10-21 — but the
date is set and nothing in W3 moves.

---

## Not done — these gate the launch

Artwork is no longer on this list — all six images are built and committed. What is
left is three things only Ryan can do, plus one that belongs to another ticket.

| Item | Needed by | Owner | Note |
|---|---|---|---|
| Maker profile complete | Wed 2026-10-07 | Ryan | Photo, bio, GitHub, X. An empty maker profile reads as a drive-by launch. |
| 3–5 real first comments | Thu 2026-10-08 | Ryan | Ask for a comment, never an upvote. Tell them the date and that any time on launch day is fine. |
| Signup path verified | Fri 2026-10-09 | Ryan | Overlaps TRU-2. Launch traffic hitting a broken checkout is the worst outcome of the week. |
| Trial/signup events instrumented | Fri 2026-10-09 | [TRU-13](/TRU/issues/TRU-13) | Visits are attributable today; trials are not. Without this the one number the week exists for is an estimate. |
| Listing scheduled | Sat 2026-10-10 | Ryan | PH allows scheduling 3 days ahead of Tue 10-13. |

~~If the images are not done by Fri 2026-10-16, slip the launch to Tue 2026-10-27.~~
**That clause is dead** — the images are done, so artwork can no longer slip the date.
Still true: do not launch with placeholder art, and do not launch into a broken signup
path. The signup check, not the artwork, is now the thing that can sink the day.

---

## Launch day — Tue 2026-10-13 (all times PT)

| Time | Action |
|---|---|
| 00:01 | Listing live. Check all six images render, the thumbnail is the square one, and the website field still has `?utm_source=producthunt…` on it — PH has been known to strip it on edit. |
| 00:05 | Maker comment posted if it was not pre-filled. |
| 00:05–02:00 | Reply to every comment within 30 minutes. This window carries the most algorithmic weight. |
| 02:00 | Sleep. Set an alarm for 06:00. |
| 06:00 | **No W2 post today.** W2 stands down on PH day; its sheet moves the **LinkedIn founder post to Fri 10-16**. Do not post it here. |
| 06:00–12:00 | Replies. Comment honestly on 3–5 other launches. |
| 12:00 | Check the leaderboard. Top 5 by mid-morning usually holds. If close, share once more. |
| 12:00–23:00 | Replies. Check heardagain.com analytics for referral traffic and signups. |
| 23:00 | Thank the commenters publicly, by name. |
| 23:59 | Screenshot final rank, votes, comments, and the day's traffic. |

No Reddit or LinkedIn posts today. The **X thread is W2's Wed 10-14 asset — do not post
it today.** The **LinkedIn founder post is W2's Fri 10-16 asset — W2 stands down on PH
day.** One post, one day.

---

## Day after — Wed 2026-10-14

- W2 posts the X thread today. W3 posts nothing new; keep replying to ProductHunt
  comments and log feature requests as they come in.

## Follow-through — Fri 2026-10-16

- Log every feature request as a GitHub issue; reply to the commenter with the link.
- Email anyone who signed up from PH traffic. Plain text, no campaign template. Overlaps
  TRU-8.
- Add the PH badge to the README only if the result is worth showing.

---

## Hard no

- Never ask for upvotes, including softly ("if you like it…"). Against PH rules and it
  shows.
- No fake accounts. PH detects them and removes listings.
- Banned words: resurrect, reanimate, bring back, digital immortality.
- Do not lead with AI language in any reply. Warm and plain.
- Do not leave a comment unanswered.

---

## What gets measured

Rank is not the point. Record these and hand them to TRU-9 on Tue 2026-10-27:

- Signups attributable to ProductHunt referrer.
- Paid conversions from those signups.
- GitHub stars before and after.
- Feature requests, and which ones came from non-developers.