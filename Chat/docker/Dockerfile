FROM node:18-alpine AS builder

WORKDIR /app

# Install all deps (including devDeps needed for tsc)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS runtime

# Install required system packages
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

WORKDIR /app

# Install production deps only in runtime stage
COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.js ./next.config.js
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Prisma client is generated into node_modules — regenerate against production node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Create required directories
RUN mkdir -p /app/uploads /app/logs
RUN chown -R nextjs:nodejs /app/uploads /app/logs

USER nextjs

EXPOSE 4778

ENV NODE_ENV=production
ENV PORT=4778

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:4778/api/health || exit 1

CMD ["npm", "start"]
