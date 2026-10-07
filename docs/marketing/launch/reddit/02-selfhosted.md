# Reddit Post: r/selfhosted
**Posting Day:** Friday 2026-10-09 (per `../W2-run-sheet.md`)
**Suggested Time:** 12:00–3:00 PM ET (16:00–19:00 UTC) — self-hosted community skews toward evenings/weekend tinkerers
**Posted by:** Ryan, from his own account. Warm up in the subreddit for 20 minutes first.
**Copy approved by Ryan 2026-10-07. Hold only on login readiness.**

> **Body edited 2026-10-04.** The original was written as if self-hosting were still an idea
> under consideration. It shipped — there is a `docker-compose.yml`, a `/self-hosting` page, and
> paid cloud tiers on the site. Posting the old phrasing in r/selfhosted and then having someone
> find a pricing page is how a launch gets called astroturfing. The post is still a question, it
> is just now an honest one.

---

## Title

Would you self-host something as personal as family memories?

---

## Body

I've been building an open-source platform called Heard Again focused on preserving family voices and stories. (Voice recordings, transcriptions, family trees, that kind of thing.)

When I started I assumed everyone would be happy with cloud hosting. It's 2026 — most people don't think twice about it.

The more I talked to people, the more I realized many families don't want recordings of parents or grandparents living permanently on someone else's servers. And honestly, I don't blame them.

So self-hosting ended up being a first-class path rather than an afterthought. It's MIT licensed and the whole thing runs on your own hardware:

- Audio recordings of family members telling stories
- Transcriptions and searchable text
- Voice profiles (so future generations can hear what someone sounded like)
- Family photos and timelines
- All of it encrypted on hardware you control

There's a managed cloud version for convenience, mostly for people who don't want to run a GPU, but nothing requires it. Docker Compose, point it at your own PostgreSQL instance, done.

I'm curious where this community lands on this.

Does self-hosting something like this actually matter to you? Or is the convenience of a managed service worth the trade-off when it comes to something as personal as family recordings?

And for those of you who already self-host family photos or documents — what's your setup look like? I'd love to learn from what's working.
