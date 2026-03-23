import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('next-auth.session-token')?.value ||
                request.cookies.get('__Secure-next-auth.session-token')?.value
  
  const { pathname } = request.nextUrl
  
  // Public paths that don't require authentication
  const publicPaths = ['/', '/login', '/signup', '/api/auth', '/forgot-password', '/reset-password', '/onboarding']
  const isPublicPath = publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  
  // Static files, API routes (API routes handle their own auth), and auth routes
  if (pathname.startsWith('/_next') || pathname.startsWith('/api/')) {
    return NextResponse.next()
  }
  
  // Allow public paths
  if (isPublicPath) {
    return NextResponse.next()
  }
  
  // Redirect to login if not authenticated
  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
