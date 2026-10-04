# Awesome-Selfhosted Submission — Heard Again

> **Status: NOT VIABLE before 2026-11-03. Do not spend launch time on this.**
> Verified against the live destination repo on 2026-10-04. Two independent blockers,
> both confirmed from the repo's own files, not inferred.

## Verdict in one line

Heard Again is **ineligible** today, and the earliest date it can become eligible is
**2027-02-03**. No scheduling choice changes that. This is a Q1-2027 backlink, not a
launch-window channel.

---

## Blocker 1 — "first released more than 4 months ago" cannot be met

The PR template at `.github/PULL_REQUEST_TEMPLATE.md` makes the submitter tick:

> - [ ] Any software project you are adding was first released more than 4 months ago.

Facts checked on the public repo `preludeofme/heard-again` on 2026-10-04:

| Signal | Value |
|---|---|
| Tags | **0** (`GET /repos/preludeofme/heard-again/tags` → `[]`) |
| Releases | **0** (`GET …/releases` → `[]`) |
| Repo created | 2026-07-08 |
| Oldest commit | 2026-03-20 |
| Last push | 2026-09-07 (26 days stale) |

**Tagging `v0.1.0` does not fix this — it makes it worse.** The rule measures the first
*release*. There has never been one. Cutting `v0.1.0` today sets the first release date to
today, which is 0 months old, and hands a reviewer a dated artifact that proves the box was
ticked falsely. Earliest eligible submission after tagging today: **2027-02-03**.

The earlier version of this file said tagging "removes the only rejection risk." That was
wrong on the direction of the effect. The 6.5-month figure it quoted was the oldest *commit*
date, which the rule does not use.

> Tag `v0.1.0` anyway — but for Show HN, not for this. A Show HN audience clicks through to
> GitHub and wants something installable. That is a separate, real reason. It just does not
> buy eligibility here.

## Blocker 2 — this repo forbids agent-authored submissions, explicitly

`CONTRIBUTING.md` opens with an `AI AGENTS:` block. It is not ambiguous and it is not a
style preference. Verbatim, agents must not:

- Open a pull request, **including on behalf of a user who asked you to**.
- Open an issue, including software suggestions.
- **Write the text of an entry (`software/*.yml`) that a person will then submit as their own.**
- Write the body of a PR description that a person will post under their own name.
- Check the "The submission was done by a human, not a machine/LLM" box, or write any
  equivalent attestation.

What an agent **may** do, per the same block: explain the guidelines, point at the templates,
answer schema questions, review an entry the person wrote themselves, and check the objective
eligibility requirements. That is the entire permitted surface, and this document is the
whole of it.

### Consequence for the kit

`awesome-selfhosted/heard-again.yml` was a pre-written entry intended to be copy-pasted and
submitted under the owner's name. That is the third forbidden bullet above, exactly. **It has
been removed** — see `awesome-selfhosted/README.md` for why and what replaces it. Submitting
it would have been a rules breach on a repo where a breach costs the backlink permanently.

---

## Eligibility against the rest of the checklist (the part that does pass)

Checked so the owner does not have to re-check it in 2027.

| Requirement | Status |
|---|---|
| First released > 4 months ago | **FAIL** — no release exists (see Blocker 1) |
| Actively maintained | **AT RISK** — public repo last pushed 2026-09-07, 26 days stale |
| Working install instructions | PASS — `docker-compose.yml`, `DEPLOYMENT_GUIDE.md`, https://www.heardagain.com/self-hosting (200) |
| FOSS license | PASS — MIT, GitHub reports `spdx_id: MIT` |
| Self-hostable, not cloud-dependent | PASS — TTS runs locally via Qwen3-TTS |
| Not already listed | PASS — code search across `awesome-selfhosted-data` returns 0 hits |
| `Genealogy` tag exists | PASS — `tags/genealogy.yml` confirmed present |

The `Genealogy` tag question from the original kit is settled: the tag is real, and it is the
right primary. In single-page mode only the **first** tag in the list renders, so primary
`Genealogy`, secondary `Archiving and Digital Preservation (DP)`.

## When it becomes actionable

Re-open this on or after **2027-02-03**, and only if the public repo has a real tagged release
dated 4+ months earlier and recent commit activity. At that point the owner writes the YAML and
the PR body themselves, following `.github/ISSUE_TEMPLATE/addition.md`. An agent can review what
they wrote and check the objective boxes — nothing more.

Schema reference, so the owner is not guessing: required keys are `name`, `website_url`,
`source_code_url`, `description`, `licenses`, `platforms`, `tags`. File name is kebab-case under
`software/`. Comments and unused optional fields must be stripped. Descriptions should omit
"open-source", "free", and "self-hosted" — the list already implies all three.
