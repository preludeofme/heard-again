# Reddit Post: r/opensource
**Posting Day:** Monday (Week 1)
**Suggested Time:** 9:00–11:00 AM EST (14:00–16:00 UTC) — tech subreddits peak during US/EU workday overlap

---

## Title

Why I'm building an open-source alternative for family voice preservation instead of another AI startup

---

## Body

I've spent the last year working on something that's made me think a lot about where AI is headed.

Nearly every voice cloning platform today is closed-source, runs entirely in the cloud, and asks families to trust a company with incredibly personal recordings.

That never sat right with me.

If someone records their grandmother telling stories about her childhood, or a parent reading bedtime stories for future grandchildren, those recordings feel like they should belong entirely to that family — not to a company.

That's why I decided to build an open-source platform focused on preserving family voices and stories. It's called Heard Again.

Some principles I've been trying to follow:

- Families own their data. Not a cloud provider, not a startup.
- Consent should be built into the product — not added later as an afterthought.
- Self-hosting should always be an option, not a premium tier.
- AI should help preserve memories, not replace the people who made them.
- The platform should be transparent enough that anyone can inspect how it works.

The stack is fairly straightforward: Next.js frontend, Python FastAPI for the voice synthesis service running Qwen3-TTS, PostgreSQL + Redis on the backend. Everything is containerized with Docker so you can run it on your own hardware.

I'm still building it, and I'm sure I don't have every answer.

I'm curious — if you were designing something like this from scratch, what principles would you consider non-negotiable? And are there open-source AI models you'd recommend for voice preservation work that I should be looking at?

I'd genuinely appreciate hearing from the open-source community before taking the project much further.
