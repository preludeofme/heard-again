# HackerNews "Show HN" Post

## Title Variants (A/B Test)

1. **Show HN: Heard Again — Open-source family voice preservation (consent-first, self-hosted)**
2. **Show HN: Heard Again — I built an open-source way to preserve family voices before they're gone**
3. **Show HN: Heard Again — An open-source platform for family stories that families actually own**

---

## Body

A year ago I realized something that's been eating at me ever since:

I have thousands of photos of my family. But almost no recordings of their voices.

If my kids asked me what my grandmother sounded like, I couldn't tell them. Not really. I could describe her — kind, stubborn, loved telling stories about growing up on a farm — but the actual sound of her voice? Gone.

That's why I built Heard Again.

It's an open-source platform for preserving family voices and stories. The idea is simple: record your family members telling the stories that matter to them, transcribe those recordings, and keep everything somewhere your family actually controls.

**What it does:**

- Upload and transcribe family recordings (stories, interviews, messages)
- Create voice profiles so future generations can hear what someone sounded like
- Organize everything by family member with timelines, collections, and a family tree
- Full self-hosting support via Docker Compose — your data, your hardware
- GEDCOM import for genealogy integration

**What makes it different from every voice AI company:**

Every voice cloning platform I've seen is closed-source, cloud-only, and asks families to hand over deeply personal recordings to a company they've never met. That never sat right with me.

Heard Again is built on a few non-negotiables:

1. **Families own their data.** Self-hosting is a first-class feature, not a premium tier.
2. **Consent is built in, not bolted on.** Voice profiles require explicit permission. There are guardrails around what happens to someone's voice after they pass away.
3. **AI is a preservation tool, not a replacement.** The goal is to keep real recordings accessible and searchable — not to generate synthetic versions of people that never said those things.
4. **Everything is transparent.** MIT licensed. Anyone can inspect how the voice processing works.

**The stack:**

Next.js 16 + React 19 frontend, Python FastAPI backend with Qwen3-TTS for voice synthesis, PostgreSQL + Redis, all containerized. Runs on a home server, a VPS, or anywhere Docker works.

**What I'm still figuring out:**

The hardest problems aren't technical. They're things like: what should happen to someone's voice profile after they pass away? How do you build a consent model that respects families without being paternalistic? What guardrails make sense, and which ones are performative?

I'd love feedback from this community — especially on the consent model, the self-hosting architecture, and the voice processing pipeline. The project is very much in progress, and I'd rather get the hard questions right early than patch them later.

GitHub: https://github.com/nrutledge1/heard-again
Website: https://heardagain.ai

---

## First Comment (Maker Comment)

Hey HN — builder here. A few things I wanted to add that didn't fit in the main post:

**Why open source?** I watched too many companies raise money on the promise of "preserving loved ones" while locking everything behind proprietary APIs and cloud lock-in. That feels fundamentally wrong for something this personal. If a family wants to keep every byte of their data on a hard drive in their own house, they should be able to. The MIT license is deliberate — I don't want anyone to ever wonder what the code is doing with their grandmother's voice.

**What "consent-first" actually means in practice:** Every voice profile requires an explicit consent flow. You can't create a voice profile from someone's recordings without their knowledge. There's a built-in permissions model for what can be done with a voice — transcription only, voice profile creation, story generation, etc. And there's a specific mechanism for handling what happens to voice data when someone passes away, because "delete everything" isn't always what families want, but "keep it forever with no restrictions" shouldn't be the default either.

**The voice tech:** The TTS service runs Qwen3-TTS locally (no cloud API calls for synthesis). Voice profiles are created from reference audio uploaded by the family. The quality isn't ElevenLabs-level yet — that's an active area of work — but it runs entirely on your own hardware, which was the more important trade-off for me.

**What I'd especially love feedback on:**
- The consent/deceased-person data model. I think about this a lot and still don't feel like I've nailed it.
- Self-hosting ergonomics. If you try the Docker Compose setup, I want to hear every rough edge.
- The voice pipeline. If you work in TTS/speech and see obvious improvements, please open an issue.

Happy to answer questions about any of it.
