import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Errors } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

// ============================================
// Auth Helpers for API Routes (Pages Router)
// ============================================

export interface AuthenticatedUser {
  id: string
  email: string
  displayName: string | null
  defaultFamilyspaceId: string | null
}

/**
 * Get the authenticated user from the session.
 * Throws AppError(401) if not authenticated.
 */
export async function getAuthUser(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AuthenticatedUser> {
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user?.id) {
    throw Errors.unauthorized()
  }

  return {
    id: session.user.id,
    email: session.user.email || '',
    displayName: session.user.displayName || null,
    defaultFamilyspaceId: session.user.defaultFamilyspaceId || null,
  }
}

/**
 * Get the authenticated user's current familyspace ID.
 * Falls back to their first familyspace if no default is set.
 * Throws AppError(401) if not authenticated.
 * Throws AppError(404) if no familyspace found.
 */
export async function getAuthUserWithFamilyspace(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AuthenticatedUser & { familyspaceId: string }> {
  const user = await getAuthUser(req, res)

  if (user.defaultFamilyspaceId) {
    return { ...user, familyspaceId: user.defaultFamilyspaceId }
  }

  // Fall back to first owned/member familyspace
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, status: 'ACTIVE' },
    select: { familyspaceId: true },
    orderBy: { joinedAt: 'asc' },
  })

  if (!membership) {
    throw Errors.forbidden('Access denied')
  }

  return { ...user, familyspaceId: membership.familyspaceId }
}

/**
 * Verify the user has a specific role (or higher) in a familyspace.
 */
const roleHierarchy = ['VIEWER', 'LEGACY', 'EDITOR', 'ADMIN', 'OWNER'] as const

/**
 * Require the user to have a global ADMIN role.
 * Call this in admin-only API routes before processing the request.
 * Throws AppError(401) if not authenticated, AppError(403) if not admin.
 */
export async function requireAdmin(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AuthenticatedUser> {
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user?.id) {
    throw Errors.unauthorized()
  }

  if (session.user.userRole !== 'ADMIN') {
    throw Errors.forbidden('Admin access required')
  }

  return {
    id: session.user.id,
    email: session.user.email || '',
    displayName: session.user.displayName || null,
    defaultFamilyspaceId: session.user.defaultFamilyspaceId || null,
  }
}

export async function requireFamilyspaceRole(
  userId: string,
  familyspaceId: string,
  minimumRole: typeof roleHierarchy[number]
): Promise<void> {
  const membership = await prisma.membership.findUnique({
    where: {
      familyspaceId_userId: { familyspaceId, userId },
    },
    select: { 
      role: true, 
      status: true,
      user: {
        select: { mfaEnabled: true }
      }
    },
  })

  if (!membership || membership.status !== 'ACTIVE') {
    throw Errors.forbidden('You are not a member of this familyspace')
  }

  // MFA enforcement is handled client-side via a global blocking modal (MFAEnforcementModal)
  // in Layout.tsx, which prevents hard 403 API errors from breaking the user session.

  const userRoleIndex = roleHierarchy.indexOf(membership.role as any)
  const requiredRoleIndex = roleHierarchy.indexOf(minimumRole)

  if (userRoleIndex < requiredRoleIndex) {
    throw Errors.forbidden(`Requires ${minimumRole} role or higher`)
  }
}
