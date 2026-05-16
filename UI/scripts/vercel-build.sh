#!/bin/bash
set -e

echo "Preparing Prisma schema for Vercel build..."
mkdir -p prisma
cp ../prisma/schema.prisma ./prisma/schema.prisma

echo "Removing extraneous generators..."
# Use a different delimiter for sed since paths might contain slashes (though unlikely here)
# or just escape properly. Here we use standard / as it's safe for these patterns.
sed -i '/generator client_ui/,/}/d' prisma/schema.prisma
sed -i '/generator client_chat/,/}/d' prisma/schema.prisma

echo "Generating Prisma client..."
npx --yes prisma generate

echo "Applying database migrations..."
npx --yes prisma migrate deploy

echo "Building Next.js app..."
npm run build
