# Open Source Readiness and Repository Cleanup Plan: Heard Again

This document is the working plan for getting **Heard Again** ready for a public open-source release. It focuses first on removing local artifacts, private data, stale docs, and generated files, then on adding the minimum project governance and automation expected in a healthy public repository.

## Release Goals

- Make the repository safe to publish without personal data, credentials, machine-specific configuration, or generated artifacts.
- Keep only source code, reproducible configuration, and documentation that helps a new contributor or self-hoster succeed.
- Consolidate scattered notes into a small, intentional documentation set.
- Add guardrails so artifacts do not re-enter the repository after cleanup.

## Phase 0: Safety Freeze and Baseline Inventory

1. Create a dedicated cleanup branch, then avoid feature work until the open-source prep branch lands.
2. Run a full tracked-file inventory:
   - `git ls-files`
   - `git status --ignored --short`
   - `git log --all --stat --summary`
3. Capture current validation commands and expected failures before deleting anything:
   - `npm run type-check`
   - `npm run lint`
   - `npm test`
   - `npm run build`
4. Decide whether historical private files require a history rewrite. If any secrets, certificates, private GEDCOM data, or private logs were committed, use a fresh public repository or rewrite history with `git filter-repo` before publishing.

## Phase 1: Immediate Remove-or-Ignore Targets

These files and directories appear to be artifacts, local data, private data, or generated outputs that should not be in a public source repository unless a maintainer explicitly confirms otherwise.

| Path | Recommended action | Reason |
| --- | --- | --- |
| `.claude/settings.local.json` | Remove from git; keep ignored | Local assistant/editor state. |
| `.scannerwork/` | Remove from git; ignore | Sonar scanner output. |
| `certs/` | Remove from git; keep ignored | TLS certificates are environment-specific and may be sensitive. |
| `Buck-Claxton Tree_2026-04-01.ged` | Remove or replace with sanitized fixture | Likely private family-tree data. |
| `family-tree.json` | Remove or replace with sanitized fixture | Likely private or generated import data. |
| `build-logs-*.txt` | Remove; ignore `build-logs-*.txt` | Generated build output. |
| `logs(1).txt` | Remove; ignore `logs*.txt` | Local log artifact. |
| `runpodctl.tar.gz` | Remove; document installation instead | Binary download artifact. |
| `tsconfig.tsbuildinfo` | Remove; already ignored | TypeScript incremental build output. |
| `screenshots/debug_post_login.png` | Remove or move to private QA evidence | Debug screenshot may expose private UI state. |
| `qa_report*.md`, `qa_fixes.md`, `qa_validation_report.md` | Archive outside repo or consolidate | Stale point-in-time QA notes clutter public docs. |
| `runpod-verification.md`, `vercel-env-setup.md`, `OPERATOR_ACTION_REQUIRED.md` | Consolidate into deployment docs or remove | Operator-specific notes are not contributor-facing. |
| `todo.md`, `user-validation.md` | Move to issues or roadmap | Public repositories should track work in issues/roadmap. |
| `rename.py`, `test-bcrypt.js`, `test-verify.js`, `stress-test.ts` | Move under documented scripts/tests or remove | Ad-hoc scripts are hard to maintain without ownership. |
| `archived-dev-docs/` | Move out of repo or collapse into a small `/docs/archive/README.md` index | Large historical document dump obscures current docs. |

## Phase 2: Documentation Consolidation

Target public documentation structure:

```text
README.md
CONTRIBUTING.md
CODE_OF_CONDUCT.md
SECURITY.md
LICENSE
docs/
  architecture.md
  configuration.md
  deployment.md
  development.md
  self-hosting.md
  troubleshooting.md
Chat/README.md
TTS/README.md
Exporter/README.md
```

Recommended moves:

1. Keep `README.md` focused on product value, architecture overview, quick start, and links to deeper docs.
2. Merge `DEPLOYMENT_GUIDE.md`, `vercel-env-setup.md`, `TTS/RUNPOD_CONFIG.md`, `TTS/RUNPOD_ENDPOINT_SETUP.md`, and relevant deployment notes into `docs/deployment.md`.
3. Merge `Chat/WORKER_SETUP.md` into `Chat/README.md` or `docs/development.md`.
4. Convert useful QA and audit findings into GitHub issues, then remove the stale markdown reports.
5. Keep screenshots only if they are used by `README.md` or documentation. Move retained images to `docs/assets/screenshots/` and delete duplicate or debug screenshots.
6. Remove model/vendor-specific operational notes unless they are part of supported self-hosting setup.

## Phase 3: Public Repo Essentials

Add or verify these files before publishing:

- `LICENSE` with the chosen open-source license.
- `CONTRIBUTING.md` covering local setup, branch names, tests, commit style, and PR expectations.
- `CODE_OF_CONDUCT.md` using a standard community covenant or project-specific policy.
- `SECURITY.md` with vulnerability reporting instructions and supported versions.
- `.env.example` files for root, `UI`, `Chat`, and `TTS`, with placeholder values and comments only.
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/feature_request.yml`
- `.github/pull_request_template.md`
- `.github/workflows/ci.yml`

## Phase 4: Secret and Privacy Audit

1. Search for committed secrets and private endpoints:
   - `gitleaks detect --source .`
   - `trufflehog git file://. --only-verified`
   - `rg -n "(secret|token|password|api[_-]?key|private[_-]?key|BEGIN CERTIFICATE|BEGIN RSA|BEGIN PRIVATE)" -g '!node_modules'`
2. Remove hardcoded fallback secrets from application code, especially production paths.
3. Ensure real `.env` files remain ignored and are not tracked.
4. Replace private family/person data with synthetic fixtures in a clearly named test fixture directory.
5. If sensitive data ever existed in Git history, do not publish this repository as-is. Rewrite history or create a clean public import.

## Phase 5: Ignore Rules and Artifact Prevention

Update ignore rules to prevent common artifacts from returning:

```gitignore
# Local tool state
.claude/
.scannerwork/

# Logs and reports
*.log
logs*.txt
build-logs-*.txt
qa_report*.md
qa_validation_report.md
qa_fixes.md

# Archives and downloaded binaries
*.tar.gz
*.zip

# Private genealogy exports / local imports
*.ged
family-tree.json

# Screenshots generated during local QA
screenshots/debug_*.png
```

Before adding broad ignore rules, move any intentionally tracked example fixtures to explicit paths such as `fixtures/` and unignore them with narrow exceptions.

## Phase 6: Automation and Quality Gates

Minimum GitHub Actions workflow:

1. Install dependencies with `npm ci --workspaces`.
2. Generate Prisma client if required by type checks.
3. Run linting.
4. Run TypeScript type checks.
5. Run unit tests.
6. Run build.
7. Optionally run Playwright smoke tests behind a separate workflow if browser setup is expensive.

Suggested local verification command before each cleanup PR:

```bash
npm run verify
```

If `npm run verify` is too environment-specific, split it into deterministic public commands and document required services for integration tests.

## Phase 7: Proposed Cleanup Pull Requests

Keep cleanup PRs small enough to review safely:

1. **PR 1: Artifact removal and ignore rules**
   - Remove tracked logs, scanner output, certs, generated build info, downloaded archives, private genealogy files, and debug screenshots.
   - Update `.gitignore`.
2. **PR 2: Documentation consolidation**
   - Move current docs into the target docs structure.
   - Delete stale point-in-time reports after useful content is preserved.
3. **PR 3: Open-source governance files**
   - Add license, contribution guide, code of conduct, security policy, issue templates, and PR template.
4. **PR 4: Environment examples and setup docs**
   - Add `.env.example` files and simplify local setup instructions.
5. **PR 5: CI and release checks**
   - Add GitHub Actions and document the release checklist.
6. **PR 6: History/privacy final review**
   - Run secret scans and decide whether history rewrite or clean-repo import is required.

## Open Questions for Maintainers

- Which license should Heard Again use?
- Should `Exporter/` remain a first-class package or move to an examples/tools area?
- Are `TTS` RunPod instructions part of the supported public deployment path?
- Should screenshots be maintained as docs assets, generated during tests, or removed entirely?
- Which archived design docs are still authoritative enough to keep?
- Can private genealogy examples be replaced with synthetic sample data?

## Previous Open Source Readiness Backlog

The cleanup plan above should be completed before or alongside the broader readiness work below.

### Project Health and Infrastructure

- [ ] Audit `.env.example` coverage for every service.
- [ ] Remove hardcoded production secret fallbacks.
- [ ] Document supported AI backend modes:
  - [ ] Local-only mode with local LLM/TTS dependencies.
  - [ ] Cloud-augmented mode with documented provider configuration.
  - [ ] Backend swapping guidance.
- [ ] Audit NPM and Python dependency licenses.
- [ ] Verify lockfile and requirements consistency.
- [ ] Optimize Dockerfiles for production where they are part of the public deployment story.
- [ ] Add CI for linting, type checking, automated tests, and security scanning.

### Security and Compliance

- [ ] Add `SECURITY.md`.
- [ ] Verify data export, account deletion, and privacy-policy flows.
- [ ] Verify sensitive user data is encrypted at rest where required.
- [ ] Document OAuth provider setup for self-hosters.
- [ ] Document MFA recovery or administrative disable flow.

### Community and Documentation

- [ ] Refresh `README.md` with value proposition, architecture overview, and quick start.
- [ ] Add a 5-minute developer setup path.
- [ ] Add deployment guides for supported targets.
- [ ] Add API documentation for public Chat, TTS, and Exporter surfaces.
- [ ] Add contribution guidelines, code of conduct, and issue templates.

### Branding and Assets

- [ ] Verify logos, icons, images, and screenshots are original or properly licensed.
- [ ] Remove hardcoded private company names, hostnames, and URLs that should not be public.
