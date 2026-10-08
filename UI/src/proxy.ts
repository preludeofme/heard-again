import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { isBypassedPath, requiresAuth } from '@/lib/security/route-access'

// Define allowed origins - read from env in production
const getAllowedOrigins = () => {
  const envOrigins = process.env.ALLOWED_ORIGINS
  if (envOrigins) {
    return envOrigins.split(',').map(o => o.trim())
  }
  return [
    'https://your-tailscale-node-name.ts.net:4777',
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

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 })
    return addCorsHeaders(response, request)
  }
  
  // Framework internals, API routes (they handle their own auth) and static
  // assets are never guarded here.
  if (isBypassedPath(pathname)) {
    return addCorsHeaders(NextResponse.next(), request)
  }

  // Only known private routes demand a session. Unknown paths fall through to
  // Next.js so they render 404.tsx instead of a login form — see
  // @/lib/security/route-access for the rule and the lists.
  if (requiresAuth(pathname)) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (!token) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return addCorsHeaders(NextResponse.redirect(loginUrl), request)
    }
  }

  return addCorsHeaders(NextResponse.next(), request)
}

export const config = {
  matcher: [
    '/_next/:path*',
    '/((?!_next/image|favicon.ico|robots.txt).*)',
  ],
}
