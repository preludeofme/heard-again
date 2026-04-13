# AGENTS.md

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
