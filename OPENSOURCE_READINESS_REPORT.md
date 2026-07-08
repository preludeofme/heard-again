# Heard Again — Open Source Readiness Audit

**Date:** 2026-07-08  
**Auditor:** Hermes (qwen-local-coder)  
**Scope:** Full repo at `/home/trubuck-design/Projects/Personal/heard-again`  
**Verdict:** 🟡 **Conditional Go — 5 HIGH items must be fixed before going public**

---

## Executive Summary

Heard Again is in good shape structurally — community files are present, CI exists, no `.env` was ever committed, and the license is clean. However, **five critical blockers** related to live secrets in the current repo snapshot must be resolved before the repo can be made public. The repo also has a significant amount of data debt (TTS audio files, exports, build artifacts) that would be embarrassing but not dangerous. Fixing all HIGH items should take ~2 hours.

---

## 🔴 HIGH — Must Fix Before Public

### 1. Live `.env` files present on disk (not committed, but still on disk)

**Severity:** CRITICAL  
**Effort:** 30 min (plus immediate secret rotation)

Five `.env` files exist on disk with **live production credentials**:

| File | Critical Secrets Found |
|------|----------------------|
| `.env` (root) | Stripe live keys, Google OAuth secrets, Cloudflare tunnel token, R2 credentials, RunPod API key, NextAuth secret, Postgres password, Resend API key |
| `UI/.env` | Same as root + `ENCRYPTION_KEY`, `APP_KEY` |
| `TTS/.env` | TTS service token, RunPod credentials |
| `TTS/tts-service/.env` | TTS service configuration |
| `Exporter/.env` | Low risk (`SAVE_LOCAL=true`) |

Although **none of these files are tracked by git** (`.env` is gitignored), they exist on disk in a working directory. If this directory is ever zipped and shared, or if the repo is pushed from a different machine where `.env` isn't gitignored, all credentials leak.

**Action:**
1. **Rotate all secrets immediately** (Stripe keys, Google OAuth, Cloudflare tunnel, RunPod API, R2 credentials, Resend API, Postgres password)
2. Move `.env` files to a secure backup location outside the repo
3. Replace with `.env.example` only (already done — verified clean)
4. Consider adding a pre-commit hook that blocks `.env` from ever being staged

---

### 2. TLS Certificate Private Key on Disk

**Severity:** HIGH  
**Effort:** 5 min

`UI/certificates/localhost-key.pem` and `UI/certificates/localhost.pem` exist and the private key is tracked in git (commit `ba900f5`). For self-signed localhost certs this is low real-world risk, but it's still a cryptographic key in source control.

**Action:**
- Remove from git history: `git filter-branch` or `git rebase` to purge these files
- Add `UI/certificates/` to `.gitignore` (already present)
- Consider generating these at dev setup time instead of committing

---

### 3. Live User Data in Repo (TTS Reference Audio & Generated Audio)

**Severity:** HIGH  
**Effort:** 15 min

The repo contains real user audio data in multiple locations:

```
TTS/data/reference_audio/     — 14 real voice samples (.wav, .mp3)
TTS/tts-service/data/         — 22 more voice samples + generated audio
UI/generated/                 — Generated voice audio for users
UI/uploads/tts-staging/       — Staging voice samples
```

These are **real people's voice recordings**. Publishing these without consent is a privacy violation and potentially illegal under GDPR/CCPA.

**Action:**
1. Remove all audio files from `TTS/data/`, `TTS/tts-service/data/`, `UI/generated/`, `UI/uploads/`
2. Replace with a script that generates synthetic sample audio for development
3. Verify `.gitignore` covers all data directories (partially done — `TTS/data/**` is gitignored but files may already be tracked)
4. `git rm --cached` any tracked audio files

---

### 4. User Export Data in Repo

**Severity:** HIGH  
**Effort:** 10 min

`UI/exports/931638b2-8341-41fc-a064-0883a9911d54/familyspace-export-1777411631343.ged` contains a GEDCOM file — a real user's family tree genealogy data with names, dates, and relationships.

**Action:**
1. Remove `UI/exports/` entirely
2. Already in `.gitignore` — verify not tracked
3. `git rm --cached` if tracked

---

### 5. Personal Email Addresses Hardcoded

**Severity:** MEDIUM-HIGH  
**Effort:** 10 min

`ryan@trubuckdesign.com` and `support@heardagain.com` appear in:
- `SECURITY.md` — security contact
- `CODE_OF_CONDUCT.md` — abuse reporting contact
- `UI/src/services/EmailService.ts` — fallback support email
- `.env.example` — `SUPPORT_EMAIL` default

This is fine for the public-facing docs if you're comfortable with it. The `.env.example` default should be changed to a placeholder.

**Action:**
1. Change `.env.example` `SUPPORT_EMAIL` to `"support@example.com"` or similar
2. Decide if you want `ryan@trubuckdesign.com` public (it's already in the docs)
3. If not, replace with a generic `security@heardagain.com` or similar

---

## 🟡 MEDIUM — Should Fix Before Public (But Not Blocking)

### 6. No `PULL_REQUEST_TEMPLATE.md`

Missing. Have issue templates but no PR template. Standard for established open source projects.

**Action:** Create `.github/PULL_REQUEST_TEMPLATE.md` with checklist (tests pass, docs updated, etc.)

---

### 7. Local `.claude/` and `.hermes/` Directories

Agent artifacts present:
- `.claude/` — Claude Code settings, memory, worktrees
- `.hermes/` — Hermes plans and custom skills
- `.memory/` — Project memory bank with session logs
- `.trigger/` — Trigger.dev local state (builds, store, lock files)

These are gitignored (`.claude/`, `.hermes/`, `.memory/`, `.trigger` all in `.gitignore`). Verify none are tracked: `git ls-files .claude/ .hermes/ .memory/ .trigger/`

---

### 8. Large Binary Files Not in Dependencies

358 MB+ of large files on disk (not in `node_modules`):
- `caddy` binary (root level, gitignored)
- TTS venv (~5 GB of PyTorch/CUDA — gitignored)
- `.trigger/tmp/` build artifacts (gitignored)
- `UI/.next/` dev build output (gitignored)
- `logs/main-app.log` (gitignored)
- `screenshots/index.png` (gitignored)

✅ All properly gitignored. No action needed, but cleanup before zipping/sharing.

---

### 9. Exporter Service is Undocumented

The `Exporter/` directory contains a Puppeteer-based export service with its own `package.json`, `Dockerfile`, and source code. It's not mentioned anywhere in README, CONTRIBUTING, or architecture docs.

**Action:** Add to README architecture section or remove if deprecated.

---

### 10. `package.json` Missing Standard Fields

```json
"license": MISSING in UI/package.json
"repository": MISSING
"bugs": MISSING
"homepage": MISSING
```

**Action:** Add to `UI/package.json`:
```json
"license": "MIT",
"repository": "github.com/your-org/heard-again",
"bugs": "https://github.com/your-org/heard-again/issues",
"homepage": "https://heardagain.com"
```

---

### 11. CI is Minimal

CI covers typecheck, lint, test, build — good foundation. But:
- No PostgreSQL service container (tests likely skip DB tests)
- Dummy `NEXTAUTH_SECRET` hardcoded in CI (fine, but could use GitHub Secrets)
- No E2E test job
- No dependency audit step (`npm audit`)

**Action:** Add `npm audit --production` step and consider a scheduled security scan.

---

### 12. No `.prettierrc` Config

ESLint config exists (`UI/eslint.config.mjs`) but no Prettier config. Inconsistent formatting is a common friction point for contributors.

**Action:** Add `.prettierrc` or integrate Prettier into ESLint config.

---

### 13. Scratch/Debug Scripts Remnants

`.gitignore` has patterns to exclude `UI/scratch*.js`, `UI/debug-*.ts`, etc. — these patterns suggest such files existed at some point. Verify none are tracked.

---

## 🟢 LOW — Nice to Have

### 14. Screenshot in README

No visual screenshots in README. For a UI-heavy project, screenshots dramatically improve first impressions.

### 15. No `CHANGELOG.md`

Standard for versioned open source projects.

### 16. No Badges in README

Missing CI status, license, version, and other standard badges.

### 17. No `CITATION.cff` or `FUNDING.yml`

Optional but increasingly common.

---

## Codebase Statistics

| Metric | Value |
|--------|-------|
| Total files | 3,605 |
| TypeScript/TSX files | 463 |
| TS/TSX code lines | 65,487 |
| Python files | 29 (4,500 code lines) |
| SQL migrations | 29 |
| Markdown docs | 75 |
| Binary assets (excluded) | 1,164 files |
| Duplicate files | 168 |

**Tech stack:** Next.js 16 (Pages Router), TypeScript strict, Prisma + PostgreSQL, NextAuth.js, Material UI v7, Trigger.dev, Stripe, BullMQ + Redis

---

## License Audit

✅ **MIT License** — OSI-approved, permissive, no copyleft risk  
✅ **No GPL/LGPL/AGPL dependencies** found in `node_modules` scan  
✅ All community files present: LICENSE, README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY  
✅ `.env` never committed to git history  
✅ No `.pem`/`.key`/`.p12` files tracked (only localhost cert via `certs/` pattern)  
✅ No database files, SQL dumps, or backups in repo  
✅ No submodules or embedded `.git` directories  
✅ `.gitignore` is comprehensive and well-maintained  
✅ Issue templates present (`bug_report.yml`, `feature_request.yml`)  
✅ CI catches type errors, lint issues, and build failures  

---

## Action Item Summary (Prioritized)

| # | Item | Severity | Effort |
|---|------|----------|--------|
| 1 | Rotate all secrets exposed in `.env` files | 🔴 CRITICAL | 1 hr |
| 2 | Delete/secure `.env` files from working directory | 🔴 CRITICAL | 10 min |
| 3 | Remove TLS private keys from git history | 🔴 HIGH | 15 min |
| 4 | Remove all user audio data from repo | 🔴 HIGH | 15 min |
| 5 | Remove user GEDCOM export from repo | 🔴 HIGH | 5 min |
| 6 | Change `.env.example` SUPPORT_EMAIL default | 🟡 MEDIUM | 2 min |
| 7 | Add PULL_REQUEST_TEMPLATE.md | 🟡 MEDIUM | 5 min |
| 8 | Add package.json fields (license, repo, bugs) | 🟡 MEDIUM | 2 min |
| 9 | Document Exporter service in README | 🟡 MEDIUM | 10 min |
| 10 | Add `.prettierrc` config | 🟡 MEDIUM | 5 min |
| 11 | Clean agent artifacts (.claude, .hermes, .memory) | 🟡 MEDIUM | 5 min |
| 12 | Add screenshots to README | 🟢 LOW | 15 min |
| 13 | Add CHANGELOG.md | 🟢 LOW | 10 min |
| 14 | Add README badges | 🟢 LOW | 5 min |
| 15 | Add npm audit to CI | 🟢 LOW | 5 min |

---

## Go / No-Go Verdict

**🟡 CONDITIONAL GO** — Heard Again is well-prepared structurally for open source. The community files, CI, license, and git hygiene are all solid. The blockers are entirely around **live data on disk** — secrets and user content. Once items 1-5 above are resolved, the repo is safe to make public.

**Estimated time to public-ready:** ~2 hours (dominated by secret rotation)
