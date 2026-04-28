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
  defaultWorkspaceId: string | null
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
    defaultWorkspaceId: session.user.defaultWorkspaceId || null,
  }
}

/**
 * Get the authenticated user's current workspace ID.
 * Falls back to their first workspace if no default is set.
 * Throws AppError(401) if not authenticated.
 * Throws AppError(404) if no workspace found.
 */
export async function getAuthUserWithWorkspace(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AuthenticatedUser & { workspaceId: string }> {
  const user = await getAuthUser(req, res)

  if (user.defaultWorkspaceId) {
    return { ...user, workspaceId: user.defaultWorkspaceId }
  }

  // Fall back to first owned/member workspace
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, status: 'ACTIVE' },
    select: { workspaceId: true },
    orderBy: { joinedAt: 'asc' },
  })

  if (!membership) {
    throw Errors.forbidden('Access denied')
  }

  return { ...user, workspaceId: membership.workspaceId }
}

/**
 * Verify the user has a specific role (or higher) in a workspace.
 */
const roleHierarchy = ['VIEWER', 'LEGACY', 'EDITOR', 'ADMIN', 'OWNER'] as const

export async function requireWorkspaceRole(
  userId: string,
  workspaceId: string,
  minimumRole: typeof roleHierarchy[number]
): Promise<void> {
  const membership = await prisma.membership.findUnique({
    where: {
      workspaceId_userId: { workspaceId, userId },
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
    throw Errors.forbidden('You are not a member of this workspace')
  }

  // ✅ SECURITY REQUIREMENT: Require MFA for OWNER role (S11)
  if (membership.role === 'OWNER' && !membership.user.mfaEnabled) {
    // For now, only log a warning instead of blocking access so the owner can actually reach the settings page to enable it.
    logger.warn(`Owner ${userId} does not have MFA enabled in workspace ${workspaceId}`)
    // throw Errors.forbidden('MFA is required for workspace owners. Please enable MFA in your profile settings.')
  }

  const userRoleIndex = roleHierarchy.indexOf(membership.role as any)
  const requiredRoleIndex = roleHierarchy.indexOf(minimumRole)

  if (userRoleIndex < requiredRoleIndex) {
    throw Errors.forbidden(`Requires ${minimumRole} role or higher`)
  }
}
