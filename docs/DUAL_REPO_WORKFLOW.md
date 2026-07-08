# Dual-Repo Workflow: heard-again-dev (private) + heard-again (public)

## Architecture

```
heard-again-dev (private, origin)     heard-again (public)
┌──────────────────────────────┐      ┌──────────────────────────────┐
│  Full commit history         │      │  Single squashed commit      │
│  All branches                │      │  main only                   │
│  CI/CD secrets               │      │  Clean, no secrets           │
│  Source of truth             │      │  Mirror / PR target          │
└──────────────────────────────┘      └──────────────────────────────┘
         ↑  push                                   ↑  push
         │                                         │
    ┌────┴─────────────────────────────────────────┴────┐
    │        Local clone (heard-again/)                 │
    │  origin  → heard-again-dev  (fetch + push)        │
    │  public  → heard-again      (fetch + push)        │
    └───────────────────────────────────────────────────┘
```

## Remotes (already configured)

```bash
origin  → https://github.com/preludeofme/heard-again-dev.git  (push)
public  → https://github.com/preludeofme/heard-again.git      (push)
```

## Daily workflow

### 1. Work on dev repo as normal

```bash
git checkout -b feat/my-feature
# ... make changes ...
git add -A
git commit -m "feat: add cool new thing"
git push origin HEAD          # pushes to heard-again-dev
```

Create PR against `origin/main` (heard-again-dev). Merge there first.

### 2. Sync to public repo

After merging to `origin/main` and pulling:

```bash
git checkout main
git pull origin main          # get latest from dev
git push public main          # push to public repo
```

This works because the public repo is a squashed snapshot — we're always pushing the latest state forward. There's no shared history to reconcile.

### 3. Handling PRs from the public repo

When someone opens a PR on `preludeofme/heard-again`:

```bash
git fetch public pull/PR_NUMBER/head:pr-public-N
git checkout pr-public-N
# review changes, test locally
git checkout main
git merge pr-public-N --squash
git commit -m "feat: merge community PR #N: description"
git push origin main          # push to dev
git push public main          # push to public
```

**CRITICAL**: Always squash-merge public PRs into dev first, then push the result to public. Never push the PR branch directly to public main.

## What NOT to do

- **Don't** push feature branches to `public` — the public repo should only have `main`
- **Don't** push to `public` before pushing to `origin` — dev is the source of truth
- **Don't** try to rebase or merge the two histories — they're intentionally separate
- **Don't** push secrets, `.env` files, or internal config to `public`

## Automated sync (optional future)

Set up a GitHub Action on heard-again-dev that pushes to heard-again on every merge to main:

```yaml
name: Sync to public repo
on:
  push:
    branches: [main]
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - run: |
          git remote add public https://x-access-token:${{ secrets.PUBLIC_REPO_TOKEN }}@github.com/preludeofme/heard-again.git
          git push public main
```

## Verifying everything is in sync

```bash
# Check if dev and public point to the same tree
diff <(git rev-parse origin/main^{tree}) <(git rev-parse public/main^{tree})
# No output = identical content
```
