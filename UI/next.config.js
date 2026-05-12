/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development'

const nextConfig = {
  reactStrictMode: true,
  // Keep heavy server-only packages out of the serverless function bundle.
  // They are loaded from node_modules at runtime, keeping each function under 250 MB.
  serverExternalPackages: [
    '@aws-sdk/client-s3',
    '@aws-sdk/s3-request-presigner',
    '@aws-sdk/lib-storage',
    '@smithy/util-stream',
    'bullmq',
    'ioredis',
    'sharp',
  ],
  // @types/react v18/v19 dual-version conflicts from MUI internals; type-check runs in CI separately
  typescript: { ignoreBuildErrors: true },
  // standalone output is only for self-hosted Docker; Vercel manages its own output format
  ...(process.env.VERCEL !== '1' && { output: 'standalone' }),
  // Locally: pin Turbopack root to prevent monorepo root detection
  // On Vercel: empty config acknowledges Turbopack when a webpack config also exists
  turbopack: process.env.VERCEL !== '1' ? { root: __dirname } : {},
  allowedDevOrigins: ['100.75.138.91', 'trubuck-design-ai-beast.stern-mulley.ts.net', 'localhost', '127.0.0.1'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'localhost',
      },
    ],
  },
  // Configure logging for development
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // Mock Node.js modules that server-side libs depend on
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        'fs/promises': false,
        path: false,
        crypto: false,
        stream: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
        os: false,
        util: false,
        url: false,
      }

      // Aggressively ignore server-side modules on the client
      config.resolve.alias = {
        ...config.resolve.alias,
        'bullmq': false,
        'ioredis': false,
        // Match various import patterns for worker/queue/services
        '@/workers/narrationWorker': false,
        '@/lib/queues/narrationQueue': false,
        '@/services/StorageService': false,
        '@/lib/redis-client': false,
        '@aws-sdk/client-s3': false,
      }

      // Forcibly ignore these patterns during client bundling
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /bullmq|ioredis|narrationWorker|narrationQueue|StorageService|redis-client|aws-sdk/,
        })
      )
    }
    return config
  },
  // Security headers
  async headers() {
    return [
      {
        // Allow the document preview iframe to render within the same origin.
        // Must come before the wildcard so Next.js applies both, with this
        // specific rule's values winning for matching header keys.
        source: '/api/assets/:id/preview',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; frame-ancestors 'self';",
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: isDev
              ? "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' blob:; media-src 'self' blob:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
              : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' blob: https://*.r2.cloudflarestorage.com; media-src 'self' blob:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(self), camera=(), payment=(), usb=()',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
