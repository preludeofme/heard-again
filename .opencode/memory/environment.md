# Environment: Heard Again

## Development Environment
- **Platform**: Linux
- **Runtime**: Node.js
- **Database**: PostgreSQL
- **Networking**: Tailscale (used for secure access to certain development services)

## DevOps & Workflow
- **ORM Management**: Any modifications to `prisma/schema.prisma` **require** running `npx prisma generate` immediately after to update the Prisma Client and maintain type safety.
- **Deployment Foundation**: The infrastructure is optimized for containerized or server-based environments suitable for continuous deployment.

## Critical Dependencies
- **Prisma Client**: Must stay in sync with the PostgreSQL schema.
- **MUI/Emotion**: UI styling depends on correct provider configuration for theme consistency.
