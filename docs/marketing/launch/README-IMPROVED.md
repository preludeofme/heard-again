# Heard Again

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/preludeofme/heard-again/blob/main/CONTRIBUTING.md)
[![Self-Hosted](https://img.shields.io/badge/Self--Hosted-ready-9cf)](https://heardagain.com/self-hosting)
[![Website](https://img.shields.io/badge/Website-heardagain.com-blue)](https://heardagain.com)

</div>

---

## Why Heard Again?

Everyone has a voice they wish they could hear one more time. A grandparent's laugh, a parent's accent from the old country, a story told around a kitchen table that never got written down. These are the sounds that make a family — and they're slipping away faster than any of us want to admit.

Heard Again gives families a place to hold onto those voices. Record a conversation. Upload an old cassette. Type out a memory you never want to forget. The platform transcribes, organizes, and — when you're ready — speaks those stories back in a voice that sounds like home.

No paywalls. No lock-in. No AI hype. Just a quiet, thoughtful tool for the work that matters most: making sure the people you love are *heard again*.

## ✨ What You Can Do

- 🎙️ **Record & upload** — Capture conversations directly or upload existing audio files. Old cassette tapes, voicemail recordings, that one video from 2007 — it all belongs here.
- 🗣️ **Voice Lab** — Clone a family member's voice from reference audio, then synthesize new narration. Hear your grandmother read the story she told you fifty years ago.
- 📖 **Story management** — Write, edit, and organize family stories. Add dates, tag people, attach photos and documents.
- 🌳 **Family tree** — Build and visualize relationships. Import GEDCOM files from existing genealogy research.
- 📚 **Collections** — Group stories into themed collections: "Grandpa's War Stories," "Holiday Traditions," "Mom's Recipes."
- ⏳ **Timeline** — Browse your family history chronologically. Watch the story of your family unfold across generations.
- 🔐 **Private by design** — Every family gets their own isolated familyspace. Stories stay where they belong: with the people who need to hear them.
- 🏠 **Self-hosted** — Run it on your own hardware. Your family's voices stay on your drives.

## 🚀 Try It

Heard Again is live at **[heardagain.com](https://heardagain.com)** — create a free account and start preserving your family's stories today.

Prefer to run it yourself? Head over to the [self-hosting guide](https://heardagain.com/self-hosting) for step-by-step instructions.

## 🧱 Architecture

A monorepo with two main services and shared infrastructure:

```
heard-again/
├── UI/          Next.js 16 web application (Pages Router)
├── TTS/         Python FastAPI voice synthesis service
├── prisma/      Shared database schema (PostgreSQL)
├── Scripts/     Dev and ops utilities
├── docs/        Documentation and design specs
└── uploads/     Shared file storage
```

### UI — Web Application

`Next.js 16` · `React 19` · `TypeScript` · `Material UI v7` · `Emotion` · `NextAuth.js` · `Prisma`

The main interface — dashboard, family tree, story editor, timeline, voice lab, collections, import/export, and authentication with MFA.

### TTS — Voice Synthesis

`Python` · `FastAPI` · `Qwen3-TTS` · `PyTorch`

Voice cloning from reference audio, voice design from natural language descriptions, style preset control (warm, gentle, excited, nostalgic). GPU-accelerated.

### Infrastructure

`PostgreSQL 15+` · `Redis 7+` · `Docker` · `Docker Compose`

## 🛠 Quick Start (Local Dev)

```bash
# One command setup
./Scripts/install.sh

# Start everything with live logging
./Scripts/start-dev.sh --live
```

- **UI** → http://localhost:4777
- **TTS API** → http://localhost:4779
- **PostgreSQL** → localhost:5432
- **Redis** → localhost:6379

For Docker production deployment: `docker compose up -d` (add `--profile with-tts` for voice synthesis).

## 📰 Latest Updates

Follow the **[Heard Again Blog](https://heardagain.com/blog)** for release notes, feature walkthroughs, and stories from families using the platform.

## ⭐ Community & Contributing

We welcome contributions of all kinds — code, docs, bug reports, feature ideas, and stories.

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — development setup, pull request process
- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** — community guidelines
- **[SECURITY.md](SECURITY.md)** — vulnerability reporting
- **[Issues](https://github.com/preludeofme/heard-again/issues)** — bug reports and feature requests

If Heard Again matters to you, starring the repo 🌟 helps other families find it.

---

<div align="center">

**Your family's legacy, preserved with care.**

[MIT License](LICENSE) · [heardagain.com](https://heardagain.com) · [Blog](https://heardagain.com/blog)

</div>
