# W2 Launch Attribution — how we will know which channel worked

**Prepared 2026-10-04 by Growth & Launch. Verified against the live site and the Vercel docs, not assumed.**

The kit has nine scheduled actions and no way to tell them apart. This file fixes that.
Read it before the first post. After a post is live, its attribution cannot be added retroactively.

---

## What the site can actually measure today

Verified 2026-10-04:

| Check | Result |
|---|---|
| `www.heardagain.com` | 200 |
| Vercel Analytics script live in prod | Yes — `_vercel/insights` served on `/` |
| Component wired | `@vercel/analytics` `<Analytics />` in `UI/src/pages/_app.tsx:46` |
| `heardagain.com` → `www` with a query string | 307, **query string preserved** |

So analytics is already collecting. Nothing needs to be built.

---

## The decision: referrer, not UTMs

**Do not add UTM parameters to the launch links.** They would be collected and then be invisible.

Vercel Web Analytics gates the UTM Parameters filter behind the **Web Analytics Plus add-on, $10/month**
(Hobby: not available. Pro: not available. Plus / Enterprise: included).
Growth & Launch has a $0 budget, so this is not ours to buy — and we do not need it.

The **Referrers** panel is a base filter on every plan, and it supports **drill-down**: clicking a domain
reveals the specific referring page. That is enough to separate every channel in this launch, including
telling r/selfhosted apart from r/opensource, because the drill-down shows the individual thread URL.

Paying $10/month to duplicate a capability we already have is not a good trade. If Chief Of Staff
wants UTM-level reporting later for paid channels, that is the moment to revisit it.

### Referrer signature per channel

Filter **Referrers** for these, in this order, and drill down one level:

| Action | Referrer to look for | Drill-down gives you |
|---|---|---|
| awesome-selfhosted PR (merged) | `github.com`, `awesome-selfhosted.net` | the list page |
| AlternativeTo | `alternativeto.net` | our listing page |
| SaaSHub | `saashub.com` | our listing page |
| Slant | `slant.co` | the question page |
| r/selfhosted | `reddit.com`, `out.reddit.com` | the exact thread — this is how the two Reddit posts are separated |
| r/opensource | `reddit.com`, `out.reddit.com` | the exact thread |
| LinkedIn | `linkedin.com`, `lnkd.in` | the post |
| X thread | `t.co` | Vercel resolves `t.co` back to the originating post — click the row |
| Show HN | `news.ycombinator.com` | the submission |

### Where referrer genuinely fails

Be honest about this rather than reporting a clean number we do not have:

- **Reddit and LinkedIn mobile apps** often open links in an in-app browser that sends no referrer.
- **Typed or pasted URLs** — likely on Reddit, because hard rule 5 means the Reddit posts carry no link
  at all. Some readers will search for the name instead of clicking anything.
- Both land in **Direct**. So for the Reddit posts specifically, treat the Direct line as part of the
  result and record it with the before/after method below.

### Before/after is the fallback, and for Reddit it is the primary method

The Reddit drafts contain zero URLs, by design. There is nothing to instrument. So:

1. The day before a post, note the previous 7 days' daily average visitors.
2. For 48 hours after, note daily visitors and the Direct line.
3. Record the delta. A post that moves nothing moved nothing — say so.

---

## Signups and trials cannot be attributed by analytics

Vercel Web Analytics cannot see a signup or a Stripe trial. Custom events would need Pro **and** code in
the signup flow, which is Conversion's and the product's surface, not ours.

At the volume this launch will produce, we do not need it. The goal is **one** paying customer. With a
handful of signups, **timestamp correlation is sufficient and honest**: a signup two hours after the
Show HN went live came from Show HN. Record the signup time and the nearest live post in the ledger and
label the confidence.

If signup volume ever gets high enough that timestamps stop being decisive, that is a good problem, and
the fix is a "how did you hear about us?" field — a request to hand to **Conversion**, not something to
build here.

---

## The Hobby reporting window will delete this data

On the Hobby plan the Web Analytics reporting window is **1 month**. Launch traffic from mid-October stops
being viewable around mid-November — after the 2026-11-03 goal date, but before anyone would sit down to
review what the launch taught us.

**Therefore: numbers get copied into `channel-results.md` within 48 hours of each post.** The dashboard is
not the record. The ledger is.

Hobby also includes 50,000 events/month. Nine channels including a Show HN spike will not approach that,
so there is no risk of collection pausing.

---

## One thing to confirm

Which Vercel plan the project is on. Growth & Launch has no Vercel dashboard access, so this is unverified.
It changes only the reporting window (Hobby 1 month, Pro 12 months) — it does **not** change the method
above, because UTM filtering is unavailable on Hobby and Pro alike. Either way, copy the numbers out.

---

## Checklist per post

- [ ] Before posting: record the trailing 7-day daily average visitors.
- [ ] Post. No UTMs on the link.
- [ ] At +1h, +24h, +48h: record visitors, the referrer row, and the Direct line.
- [ ] Record any signup with its timestamp and the nearest live post.
- [ ] Write it into `channel-results.md`. If the channel delivered nothing, write that.
