FROM ghcr.io/puppeteer/puppeteer:latest

USER root

WORKDIR /app

# Download Chrome for Testing into /app so pptruser can access it at runtime.
# The puppeteer post-install script respects this env var.
ENV PUPPETEER_CACHE_DIR=/app/.puppeteer-cache

COPY package*.json ./
RUN npm install

COPY src/ ./src/

# Give pptruser ownership so the Chrome cache is readable at runtime
RUN chown -R pptruser:pptruser /app

USER pptruser

CMD ["node", "src/handler.js"]
