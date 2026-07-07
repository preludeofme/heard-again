#!/usr/bin/env bash
# Reproducible quality gate — run from a clean checkout before merge or release.
# Fails fast on the first broken gate; exit code 0 means all gates passed.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS='\033[0;32mPASS\033[0m'
FAIL='\033[0;31mFAIL\033[0m'
STEP='\033[1;34m==>\033[0m'

step() { echo -e "\n${STEP} $*"; }
ok()   { echo -e "  ${PASS} $*"; }
fail() { echo -e "  ${FAIL} $*"; exit 1; }

# ── 1. Blocked file check ─────────────────────────────────────────────────────
step "Checking for blocked files in source tree"
BLOCKED=$(git ls-files \
  'UI/scratch*.js' 'UI/scratch*.ts' \
  'UI/debug-*.ts' 'UI/debug-*.js' \
  'UI/test-api*.js' 'UI/test-api*.ts' \
  'UI/test-db*.js' \
  'UI/test-frontend*.js' \
  'UI/test-find-*.js' \
  'UI/test-import*.js' \
  'UI/test-layout*.ts' \
  'UI/quarantine/' 2>/dev/null || true)
if [[ -n "$BLOCKED" ]]; then
  fail "Blocked files tracked in git:\n$BLOCKED"
fi
ok "No blocked files"

# ── 2. Install ────────────────────────────────────────────────────────────────
step "Installing all dependencies (root & workspaces)"
npm ci --silent || fail "Root npm ci failed"
ok "All dependencies"

# ── 3. Type-check ─────────────────────────────────────────────────────────────
step "Generating Prisma Client"
npm run db:generate || fail "Prisma Client generation failed"
ok "Prisma Client"

step "Type-checking UI"
cd "$ROOT/UI" && npx tsc --noEmit || fail "UI type-check failed"
ok "UI"
cd "$ROOT"

# ── 4. Lint ───────────────────────────────────────────────────────────────────
step "Linting UI"
cd "$ROOT/UI" && npm run lint || fail "UI lint failed"
ok "UI"
cd "$ROOT"

# ── 5. Unit / integration tests ───────────────────────────────────────────────
step "Running UI tests"
cd "$ROOT/UI" && npm test -- --passWithNoTests || fail "UI tests failed"
ok "UI"
cd "$ROOT"

# ── 6. Production build ───────────────────────────────────────────────────────
step "Building UI"
cd "$ROOT/UI" && NEXTAUTH_URL=http://localhost:4777 npm run build || fail "UI build failed"
ok "UI"
cd "$ROOT"

# ── 7. Migration dry-run check ────────────────────────────────────────────────
step "Checking for pending Prisma migrations"
if command -v npx &>/dev/null; then
  STATUS=$(cd "$ROOT/UI" && npx prisma migrate status 2>&1 || true)
  if echo "$STATUS" | grep -qi "pending\|not applied"; then
    fail "Unapplied migrations detected — run 'npm run db:migrate' before deploying:\n$STATUS"
  fi
  ok "No pending migrations"
else
  echo "  SKIP  npx not available; skipping migration check"
fi

echo -e "\n\033[1;32mAll gates passed.\033[0m"
