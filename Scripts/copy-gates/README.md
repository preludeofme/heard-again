# Copy gates

Ryan's rule: **any wording that touches death or loss goes to him before it ships.**

A gate here is the backstop that makes that rule hold even when someone forgets
it. The primary control is the rule in `AGENTS.md` — read that first.

## How a gate works

One file per gate: `Scripts/copy-gates/<issue>-<what>.gate`. Each line is a path
pattern, matched against every file in the commits being pushed. Lines starting
with `#` are comments.

```
# TRU-4 — hero tagline, card 2920d6a6 pending with Ryan
UI/src/components/pages/LandingHero.tsx
UI/src/content/blog/how-to-clone-*.tsx
```

While the file exists, `Scripts/git-hooks/pre-push` refuses any push that touches
those paths. Delete the file when the approval card resolves.

## Install the hook

```bash
git config core.hooksPath Scripts/git-hooks
```

Per clone, so each checkout needs it once.

## Escape hatch

`COPY_GATE_OVERRIDE=1 git push`. If you use it, say so on the issue.

## What a gate is not

A gate stops a push. It does not stop a commit, and an unpushed commit is not a
hold — in a shared checkout another run pushing `main` carries your commit out
with it. That is exactly how the TRU-4 hero line went live before Ryan answered.
