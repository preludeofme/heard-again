# Deployment & Code Quality Review (PCF Focus)

Date: 2026-05-07

## Verdict

**Not fully ready for PCF production deployment yet.**

The repository contains strong production-hardening work (container security, health checks, explicit secrets, and infra artifacts), but there are still practical deployment blockers and hygiene concerns that should be addressed before a go-live.

## What looks good

1. **Container hardening and security posture are strong**
   - `read_only` root FS and dropped Linux capabilities are set for the main app service.
   - internal-only service networking is used (`expose` for internal services).
   - required secrets are enforced via compose variable guards.

2. **Health checks are broadly defined**
   - app/chat/tts/db/redis/chromadb services all declare health checks in compose.

3. **Production readiness work is documented**
   - `PRODUCTION_READINESS_ASSESSMENT.md` and `GCP_READINESS_PLAN.md` show completed foundational work and known limitations.

## Gaps to close before PCF deployment

### 1) Build/test pipeline is not reproducible in this working copy
- `UI` lint command currently fails in this environment with `next: not found`, indicating dependencies are not installed in the checked workspace.
- This means we cannot currently validate quality gates from the repo alone.

**Action**
- Ensure CI runs from a clean checkout with deterministic install (`npm ci`) and required lockfiles for each service.
- Add a single root verification script that fails fast on install/build/test/lint for all services.

### 2) Runtime topology mismatch vs PCF expectations
- The stack depends on multiple side services (Postgres, Redis, ClamAV, ChromaDB, Ollama, optional TTS/worker), and current deployment assets are optimized for Docker Compose + GCP (Cloud Run/GKE/Terraform), not plain PCF buildpack deployment.

**Action**
- Produce a dedicated `PCF_DEPLOYMENT.md` with:
  - service broker requirements (DB/Redis/object storage),
  - routes and env vars,
  - process definitions (web/worker),
  - scaling policy,
  - health endpoint mapping,
  - rolling deployment and rollback steps.

### 3) Repository hygiene / code bloat issues
- The `UI` project root includes multiple ad-hoc scripts and scratch/test files (`test-api*.js/ts`, `test-db3.js`, `scratch.js`, etc.) that should not ship with production source.
- The `UI/quarantine/` folder contains suspicious temporary payload files checked into source.

**Action**
- Move all ad-hoc scripts into a non-deploy `tools/` or `scripts/dev-only/` location and exclude from production image context.
- Remove tracked quarantine artifacts from git and enforce `.gitignore`/artifact rules.
- Add CI check to block `scratch*`, `test-*` root files, and quarantine payloads from being committed.

### 4) Dependency governance needs a formal pass
- `UI/package.json` has a large dependency surface across UI, media processing, storage, and auth.
- There is no evidence in this run that unused dependencies were audited recently.

**Action**
- Run `depcheck`/`knip` and bundle analyzer in CI.
- Remove unused runtime dependencies; move any test-only packages to `devDependencies`.
- Track dep size/security budget (e.g., max JS bundle delta thresholds).

### 5) Documentation consistency risk
- README claims specific architecture and workflows, but operational practices appear split across multiple readiness documents.

**Action**
- Consolidate deployment truth into one canonical runbook per target (PCF vs GCP), and mark legacy docs clearly as historical.

## Code quality observations

1. **Good:** modern TypeScript + Prisma + structured multi-service layout.
2. **Risk:** large codebase with mixed maturity zones (production-ready modules alongside ad-hoc utility/test artifacts).
3. **Risk:** readiness claims in docs should be validated continuously by CI, not only by one-time audits.

## Recommended release gate for PCF

Before production approval, require the following to pass in CI from a clean checkout:
1. install (`npm ci` for root/UI/Chat + Python deps for TTS)
2. lint (UI + Chat)
3. typecheck (UI + Chat)
4. unit/integration tests
5. image build(s) used in PCF path
6. migration dry-run check
7. smoke tests against ephemeral env

## Final recommendation

**Status: HOLD (changes required before PCF production).**

Most infrastructure/security fundamentals are present, but deployment-target alignment (PCF runbook/process model), repo hygiene cleanup, and repeatable CI evidence should be completed before go-live.
