# AGENTS.md

## Copy that touches death or loss

Ryan approves it before it ships. No exceptions, and raising an approval card is
not the same as holding the copy back.

**An unpushed commit is not a hold.** Several agents share one checkout. When any
run pushes `main`, it carries every local `main` commit with it, including yours.
That is how the TRU-4 hero line reached production while its card was still
pending.

Hold gated copy one of these two ways:

1. **Keep it unreachable in production.** Write the file, leave it out of the
   registry or behind a flag, so the route 404s until approval. `UI/src/content/blog/index.ts`
   does this for the two unapproved TRU-6 posts — copy that pattern.
2. **Keep it off `main`.** Commit on a side branch. Never land a gated string on
   `main` in this checkout.

Then add a gate so the mistake cannot happen quietly: drop a `.gate` file in
`Scripts/copy-gates/` naming the paths. `Scripts/git-hooks/pre-push` refuses to
push them. See `Scripts/copy-gates/README.md`. Install once per clone with
`git config core.hooksPath Scripts/git-hooks`.

Delete the gate file when the card resolves.

## Core Architecture: Contextual Design
The application relies heavily on a "Contextual" design pattern. Use of `SelectedFamilyMemberContext` (and related providers) is critical. Many views, components, and data fetches change dynamically based on which family member is currently active in the context.

## Tech Stack
- **Framework**: Next.js (Pages Router)
- **UI Library**: MUI (Material UI) with Emotion
- **Database**: PostgreSQL via Prisma ORM
- **Authentication**: NextAuth.js

## Key Workflows
- **Contextual UI**: Always check if a component or page depends on the active family member context before implementing logic.
- **Navigation**: The app uses a dual-mode navigation strategy: Sidebar for Desktop and Bottom Navigation for Mobile.

## Operational Gotchas
- **Prisma Updates**: Whenever `prisma/schema.prisma` is modified, you **must** run `npx prisma generate` to update the Prisma Client and maintain type safety.
- **Type Safety**: Ensure all new data fetches or transformations are reflected in the generated Prisma types.
