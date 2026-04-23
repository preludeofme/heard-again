/** @type {import('next').NextConfig} */
const path = require('path')
const isDev = process.env.NODE_ENV === 'development'

const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, '..'),
  // Add empty Turbopack config to avoid webpack conflict
  turbopack: {},
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
              ? "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
              : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
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
