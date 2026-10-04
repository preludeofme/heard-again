# Awesome-Selfhosted Submission — Heard Again

> **Corrected 2026-10-04.** The earlier version of this file told you to edit the
> awesome-selfhosted README markdown list. That is wrong and would be closed without
> review. Entries have lived in a separate data repo as YAML files since 2022.

## Where the PR goes

Repo: `https://github.com/awesome-selfhosted/awesome-selfhosted-data`
File to add: `software/heard-again.yml`
Content: copy `docs/marketing/launch/awesome-selfhosted/heard-again.yml` (strip the comment header).

One file, one PR. Nothing else changes.

## Eligibility check (verified 2026-10-04)

| Requirement | Status |
|---|---|
| First released more than 4 months ago | Public repo first commit 2026-03-20 (~6.5 months) — **but no tagged release exists** |
| Actively developed | Yes, commits through October 2026 |
| Working install instructions | Yes — `docker-compose.yml`, `DEPLOYMENT_GUIDE.md`, https://heardagain.com/self-hosting |
| FOSS license | MIT, `LICENSE` present in public repo |
| Self-hostable, not cloud-dependent | Yes — TTS runs locally via Qwen3-TTS, no third-party API required |
| Not already listed | Confirmed absent |

**Do before opening the PR:** tag a release on the public repo (`v0.1.0`) so the
"released more than 4 months ago" rule is unarguable. Right now a reviewer can say
"there is no release." Takes two minutes and removes the only rejection risk.

## Category

There **is** a `Genealogy` tag — the earlier note claiming otherwise was wrong.
Use `Genealogy` as primary and `Archiving and Digital Preservation (DP)` as secondary.
Do not use Media Streaming; that category is for playback servers and a reviewer will
push back.

## PR title

```
Add Heard Again
```

Keep it plain. The repo maintainers prefer boring titles.

## PR body — Ryan writes this himself

The repo **requires a human attestation that the submission was not machine-generated,
and bans LLM-written contributions**. Do not paste agent prose. Write three or four
sentences in your own words covering:

- what Heard Again does, in one sentence
- that it is MIT and self-hosts via Docker Compose
- why `Genealogy` is the right tag
- confirmation you are a human submitting your own project

The YAML file itself is factual metadata (name, URL, license, tags) and is fine to use
as-is, but read the `description` line and reword it if it does not sound like you.

## After submitting

- Watch the PR for CI lint failures (the repo validates YAML schema automatically).
- Respond to maintainer comments the same day. These PRs stall when authors go quiet.
