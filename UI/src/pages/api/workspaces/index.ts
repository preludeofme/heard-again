import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUser } from '@/lib/auth-helpers'
import { validate, rules } from '@/lib/validation'
export default apiHandler({
  // GET /api/workspaces - List user's workspaces
  GET: async (req, res) => {
    const user = await getAuthUser(req, res)

    const memberships = await prisma.membership.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      include: {
        workspace: {
          include: {
            _count: {
              select: {
                members: true,
                people: true,
                stories: true,
                voiceProfiles: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    })

    const workspaces = memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      planType: m.workspace.planType,
      deploymentMode: m.workspace.deploymentMode,
      role: m.role,
      isDefault: m.workspace.id === user.defaultWorkspaceId,
      counts: m.workspace._count,
      createdAt: m.workspace.createdAt,
    }))

    return successResponse(res, workspaces)
  },

  // POST /api/workspaces - Create a new workspace
  POST: async (req, res) => {

    const user = await getAuthUser(req, res)

    const { valid, errors } = validate(req.body, {
      name: [rules.required, rules.minLength(2), rules.maxLength(100)],
    })

    if (!valid) {
      throw Errors.badRequest('Validation failed', errors)
    }

    const { name } = req.body

    // Generate slug
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 40)

    const existingSlug = await prisma.workspace.findUnique({ where: { slug: baseSlug } })
    const slug = existingSlug ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug

    // Get free plan
    const freePlan = await prisma.plan.findFirst({
      where: { planType: 'FREE', isActive: true },
    })

    const workspace = await prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          name,
          slug,
          ownerId: user.id,
          planType: 'FREE',
          deploymentMode: 'LOCAL',
        },
      })

      await tx.membership.create({
        data: {
          workspaceId: ws.id,
          userId: user.id,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      })

      if (freePlan) {
        await tx.subscription.create({
          data: {
            workspaceId: ws.id,
            planId: freePlan.id,
            billingStatus: 'ACTIVE',
          },
        })
      }

      return ws
    })

    return successResponse(res, {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      planType: workspace.planType,
    }, 201)
  },
})
