import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Define allowed origins - read from env in production
const getAllowedOrigins = () => {
  const envOrigins = process.env.ALLOWED_ORIGINS
  if (envOrigins) {
    return envOrigins.split(',').map(o => o.trim())
  }
  return [
    'https://trubuck-design-ai-beast.stern-mulley.ts.net:4777',
    'http://localhost:4777',
    'http://localhost:3000'
  ]
}

const ALLOWED_ORIGINS = getAllowedOrigins()

// Helper to add CORS headers
function addCorsHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const origin = request.headers.get('origin')
  
  // Allow requests with no origin (same-origin) or from allowed origins
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin || '*')
  }
  
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  
  return response
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 })
    return addCorsHeaders(response, request)
  }
  
  // Public paths that don't require authentication
  const publicPaths = ['/', '/login', '/signup', '/api/auth', '/forgot-password', '/reset-password', '/onboarding', '/pricing', '/self-hosting', '/privacy', '/terms']
  const isPublicPath = publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  
  // Static files, API routes (API routes handle their own auth), and auth routes
  if (pathname.startsWith('/_next') || pathname.startsWith('/api/')) {
    const response = NextResponse.next()
    return addCorsHeaders(response, request)
  }
  
  // Allow public paths
  if (isPublicPath) {
    const response = NextResponse.next()
    return addCorsHeaders(response, request)
  }
  
  // Redirect to login if not authenticated
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return addCorsHeaders(NextResponse.redirect(loginUrl), request)
  }
  
  const response = NextResponse.next()
  return addCorsHeaders(response, request)
}

export const config = {
  matcher: [
    '/_next/:path*',
    '/((?!_next/image|favicon.ico).*)',
  ],
}
