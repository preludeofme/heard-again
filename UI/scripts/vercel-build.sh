#!/bin/bash
set -e

echo "Generating Prisma client..."
# Generate standard client to root node_modules
npx --yes prisma generate --schema=../prisma/schema.prisma

echo "Applying database migrations..."
npx --yes prisma migrate deploy --schema=../prisma/schema.prisma

echo "Building Next.js app..."
npm run build
