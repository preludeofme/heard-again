# Reddit Post: r/opensource
**Posting Day:** Monday 2026-10-12 (per `../W2-run-sheet.md`)
**Suggested Time:** 9:00–11:00 AM ET (14:00–16:00 UTC) — tech subreddits peak during US/EU workday overlap
**Posted by:** Ryan, from his own account. Three days after the r/selfhosted post.
**Copy approved by Ryan 2026-10-07. Hold only on login readiness.**

> **Body edited 2026-10-04.** Two factual corrections: "the last year" became "since the spring"
> (first commit is 2026-03-20), and the closing question no longer implies the project is
> pre-build. Everything else is as written.

---

## Title

Why I'm building an open-source alternative for family voice preservation instead of another AI startup

---

## Body

I've spent the months since the spring working on something that's made me think a lot about where AI is headed.

Nearly every voice cloning platform today is closed-source, runs entirely in the cloud, and asks families to trust a company with incredibly personal recordings.

That never sat right with me.

If someone records their grandmother telling stories about her childhood, or a parent reading bedtime stories for future grandchildren, those recordings feel like they should belong entirely to that family — not to a company.

That's why I built an open-source platform focused on preserving family voices and stories. It's called Heard Again, it's MIT licensed, and it self-hosts on Docker Compose.

Some principles I've been trying to follow:

- Families own their data. Not a cloud provider, not a startup.
- Consent should be built into the product — not added later as an afterthought.
- Self-hosting should always be an option, not a premium tier.
- AI should help preserve memories, not replace the people who made them.
- The platform should be transparent enough that anyone can inspect how it works.

The stack is fairly straightforward: Next.js frontend, Python FastAPI for the voice synthesis service running Qwen3-TTS, PostgreSQL + Redis on the backend. Everything is containerized with Docker so you can run it on your own hardware.

It's usable today and I'm still sure I don't have every answer.

I'm curious — of the principles above, which would you consider non-negotiable, and which do you think I've got wrong? And are there open-source AI models you'd recommend for voice preservation work that I should be looking at?

I'd genuinely appreciate hearing from the open-source community on this.
