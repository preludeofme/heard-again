#!/bin/bash
set -e

echo "Generating Prisma client..."
# Use the client_ui generator — it has an explicit output path
# (../UI/node_modules/.prisma/client relative to the root schema) which avoids
# the workspace-hoisting issue where Prisma can't resolve @prisma/client via
# require.resolve when @prisma/client is in the workspace-root node_modules.
npx --yes prisma generate --generator client_ui --schema=../prisma/schema.prisma

echo "Applying database migrations..."
npx --yes prisma migrate deploy --schema=../prisma/schema.prisma

echo "Building Next.js app..."
npm run build
