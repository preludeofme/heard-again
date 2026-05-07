FROM node:18-alpine AS builder

WORKDIR /app

# Install all deps (including devDeps needed for tsc)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Compile TypeScript
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
RUN adduser -S nodejs -u 1001

WORKDIR /app

# Install production deps only in runtime stage
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled output and config
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# Prisma client is generated into node_modules — regenerate against production node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Create required directories
RUN mkdir -p /app/uploads /app/logs
RUN chown -R nodejs:nodejs /app/uploads /app/logs

USER nodejs

EXPOSE 4778

ENV NODE_ENV=production
ENV PORT=4778

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:4778/api/health || exit 1

CMD ["node", "-r", "tsconfig-paths/register", "dist/server.js"]
