/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Add empty Turbopack config to avoid webpack conflict
  turbopack: {},
   allowedDevOrigins: ['100.75.138.91'],
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
}

module.exports = nextConfig
