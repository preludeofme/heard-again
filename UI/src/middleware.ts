import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Define allowed origins - add your Tailscale domain here
const ALLOWED_ORIGINS = [
  'https://trubuck-design-ai-beast.stern-mulley.ts.net:4777',
  'http://trubuck-design-ai-beast.stern-mulley.ts.net:4777',
]

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

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('next-auth.session-token')?.value ||
                request.cookies.get('__Secure-next-auth.session-token')?.value
  
  const { pathname } = request.nextUrl
  
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 })
    return addCorsHeaders(response, request)
  }
  
  // Public paths that don't require authentication
  const publicPaths = ['/', '/login', '/signup', '/api/auth', '/forgot-password', '/reset-password', '/onboarding', '/pricing', '/self-hosting']
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
