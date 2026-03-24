import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

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

  // Decode token to get user ID (NextAuth JWT tokens are base64 encoded JSON)
  try {
    const tokenPayload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
    const userId = tokenPayload.sub

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { defaultWorkspace: true }
      })

      // No workspace at all - must onboard
      if (!user?.defaultWorkspace) {
        if (pathname !== '/onboarding') {
          return NextResponse.redirect(new URL('/onboarding', request.url))
        }
        return NextResponse.next()
      }

      // Has workspace but onboarding incomplete
      const isDefaultName = user.defaultWorkspace.name === 'My Workspace'
      const peopleCount = await prisma.person.count({
        where: { workspaceId: user.defaultWorkspace.id }
      })
      
      const onboardingComplete = !isDefaultName && peopleCount > 0
      
      if (!onboardingComplete && pathname !== '/onboarding') {
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }
    }
  } catch {
    // Token parsing failed, let the request through and let API routes handle auth
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
