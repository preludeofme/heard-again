# Multi-stage build for production
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies from UI folder
COPY UI/package.json UI/package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules

# Copy UI application code
COPY UI/ .

# Copy shared prisma schema from root
COPY prisma/ ./prisma/

# Generate Prisma client (clean up multi-generator paths for container)
RUN sed -i '/generator client_ui/,/}/d' prisma/schema.prisma && \
    sed -i '/generator client_chat/,/}/d' prisma/schema.prisma && \
    npx prisma generate --schema=./prisma/schema.prisma

# Build the application
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Create uploads directory
RUN mkdir -p uploads && chown nextjs:nodejs uploads

USER nextjs

EXPOSE 4777

ENV PORT=4777
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4777/api/instance/health || exit 1

CMD ["node", "server.js"]
