#!/bin/bash
set -e

# Use the Prisma CLI that npm install already placed in the workspace root, so
# the CLI major always matches the installed @prisma/client. `npx --yes prisma`
# resolves the registry `latest` tag instead, which silently moved to an 8.x
# release and broke every production build from 2026-09-29 onward.
PRISMA_BIN="../node_modules/.bin/prisma"
if [ ! -x "$PRISMA_BIN" ]; then
  echo "Workspace Prisma CLI not found at $PRISMA_BIN, falling back to a pinned version."
  PRISMA_VERSION="$(node -p "require('../package.json').devDependencies?.prisma ?? require('../package.json').dependencies.prisma")"
  PRISMA_BIN="npx --yes prisma@${PRISMA_VERSION#^}"
fi

echo "Prisma CLI: $PRISMA_BIN"

echo "Generating Prisma client..."
$PRISMA_BIN generate --schema=../prisma/schema.prisma

echo "Applying database migrations..."
$PRISMA_BIN migrate deploy --schema=../prisma/schema.prisma

echo "Building Next.js app..."
npm run build
