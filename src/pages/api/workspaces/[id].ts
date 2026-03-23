import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUser, requireWorkspaceRole } from '@/lib/auth-helpers'
import { validate, rules } from '@/lib/validation'

export default apiHandler({
  // GET /api/workspaces/[id] - Get workspace details
  GET: async (req, res) => {
    const user = await getAuthUser(req, res)
    const workspaceId = req.query.id as string

    await requireWorkspaceRole(user.id, workspaceId, 'VIEWER')

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: {
          select: { id: true, email: true, displayName: true, avatarUrl: true },
        },
        subscription: {
          include: { plan: true },
        },
        _count: {
          select: {
            members: true,
            people: true,
            stories: true,
            voiceProfiles: true,
            assets: true,
          },
        },
      },
    })

    if (!workspace) {
      throw Errors.notFound('Workspace')
    }

    return successResponse(res, {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      planType: workspace.planType,
      deploymentMode: workspace.deploymentMode,
      tunnelEnabled: workspace.tunnelEnabled,
      cloudGpuEnabled: workspace.cloudGpuEnabled,
      owner: workspace.owner,
      subscription: workspace.subscription
        ? {
            planName: workspace.subscription.plan.name,
            billingStatus: workspace.subscription.billingStatus,
            renewalDate: workspace.subscription.renewalDate,
          }
        : null,
      counts: workspace._count,
      createdAt: workspace.createdAt,
    })
  },

  // PUT /api/workspaces/[id] - Update workspace
  PUT: async (req, res) => {
    const user = await getAuthUser(req, res)
    const workspaceId = req.query.id as string

    await requireWorkspaceRole(user.id, workspaceId, 'ADMIN')

    const { valid, errors } = validate(req.body, {
      name: [rules.string, rules.minLength(2), rules.maxLength(100)],
    })

    if (!valid) {
      throw Errors.badRequest('Validation failed', errors)
    }

    const { name } = req.body
    const updateData: any = {}
    if (name !== undefined) updateData.name = name

    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: updateData,
      select: {
        id: true,
        name: true,
        slug: true,
        planType: true,
        updatedAt: true,
      },
    })

    return successResponse(res, workspace)
  },

  // DELETE /api/workspaces/[id] - Delete workspace
  DELETE: async (req, res) => {
    const user = await getAuthUser(req, res)
    const workspaceId = req.query.id as string

    await requireWorkspaceRole(user.id, workspaceId, 'OWNER')

    // Prevent deleting the user's only workspace
    const membershipCount = await prisma.membership.count({
      where: { userId: user.id, status: 'ACTIVE' },
    })

    if (membershipCount <= 1) {
      throw Errors.badRequest('Cannot delete your only workspace')
    }

    await prisma.workspace.delete({
      where: { id: workspaceId },
    })

    // If this was the default workspace, clear it
    if (user.defaultWorkspaceId === workspaceId) {
      const nextWorkspace = await prisma.membership.findFirst({
        where: { userId: user.id, status: 'ACTIVE' },
        select: { workspaceId: true },
      })
      await prisma.user.update({
        where: { id: user.id },
        data: { defaultWorkspaceId: nextWorkspace?.workspaceId || null },
      })
    }

    return successResponse(res, { deleted: true })
  },
})
