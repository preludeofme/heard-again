/** @type {import('next').NextConfig} */
const path = require('path')
const isDev = process.env.NODE_ENV === 'development'

// @trigger.dev/* packages are hoisted to the workspace root node_modules by npm
// workspaces. Turbopack's module resolver doesn't always traverse parent dirs, so
// we provide explicit aliases pointing to the resolved locations.
const workspaceRoot = path.resolve(__dirname, '..')
function workspacePkg(name) {
  return path.resolve(workspaceRoot, 'node_modules', name)
}

const nextConfig = {
  reactStrictMode: true,
  // Keep heavy server-only packages out of the serverless function bundle.
  // They are loaded from node_modules at runtime, keeping each function under 250 MB.
  serverExternalPackages: [
    '@aws-sdk/client-s3',
    '@aws-sdk/s3-request-presigner',
    '@aws-sdk/lib-storage',
    '@smithy/util-stream',
    '@trigger.dev/sdk',
    '@trigger.dev/core',
    'bullmq',
    'ioredis',
    'sharp',
    // GCP storage and its CJS deps are Node-only — traced via instrumentation but
    // must not be bundled by Turbopack (inherits, duplexify, readable-stream etc.)
    '@google-cloud/storage',
    'duplexify',
    'readable-stream',
    'end-of-stream',
    'stream-shift',
    'teeny-request',
    'google-auth-library',
    // isomorphic-dompurify depends on jsdom which pulls in native-dependent and
    // dynamic-require-heavy code that Turbopack cannot bundle. Load at runtime.
    'isomorphic-dompurify',
    'jsdom',
  ],
  // NFT tracing: the download API route does fs/path operations to serve local
  // uploads. This tells Turbopack to include the uploads directory in the trace
  // so the NFT warning doesn't fire.
  outputFileTracingIncludes: {
    '/api/assets/**': ['./uploads/**'],
  },
  // @trigger.dev/react-hooks is ESM-only and hoisted to workspace root
  // node_modules — transpilePackages tells Turbopack to bundle it rather than
  // try to resolve it as an external CJS module.
  transpilePackages: ['@trigger.dev/react-hooks'],
  // @types/react v18/v19 dual-version conflicts from MUI internals; type-check runs in CI separately
  typescript: { ignoreBuildErrors: true },
  // standalone output is only for self-hosted Docker; Vercel manages its own output format
  ...(process.env.VERCEL !== '1' && { output: 'standalone' }),
  // root set to the npm workspace root so Turbopack can find packages hoisted there
  // (e.g. @trigger.dev/*, use-sync-external-store). tsconfig path aliases (@/*) are
  // resolved via tsconfig.json which Next.js reads independently of this root.
  turbopack: {
    root: workspaceRoot,
  },
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
    const path = require('path')
    // Force a single React instance across the monorepo.
    // Ensure all workspaces use identical react versions (19.2.6) for natural hoisting.

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
              ? "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' blob: http://localhost:3030 ws://localhost:3030 https://api.trigger.dev wss://api.trigger.dev; media-src 'self' blob:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
              : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' blob: https://*.r2.cloudflarestorage.com https://api.trigger.dev; media-src 'self' blob:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
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
