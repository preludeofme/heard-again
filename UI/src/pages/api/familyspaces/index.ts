import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUser } from '@/lib/auth-helpers'
import { validate, rules } from '@/lib/validation'
export default apiHandler({
  // GET /api/familyspaces - List user's familyspaces
  GET: async (req, res) => {
    const user = await getAuthUser(req, res)

    const memberships = await prisma.membership.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      include: {
        familyspace: {
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

    const familyspaces = memberships.map((m) => ({
      id: m.familyspace.id,
      name: m.familyspace.name,
      slug: m.familyspace.slug,
      planType: m.familyspace.planType,
      deploymentMode: m.familyspace.deploymentMode,
      role: m.role,
      isDefault: m.familyspace.id === user.defaultFamilyspaceId,
      counts: m.familyspace._count,
      createdAt: m.familyspace.createdAt,
    }))

    return successResponse(res, familyspaces)
  },

  // POST /api/familyspaces - Create a new familyspace
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

    const existingSlug = await prisma.familyspace.findUnique({ where: { slug: baseSlug } })
    const slug = existingSlug ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug

    // Get free plan
    const freePlan = await prisma.plan.findFirst({
      where: { planType: 'FREE', isActive: true },
    })

    // Resolve the creator's name for the root Person record
    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: { displayName: true, name: true, email: true, linkedPersonId: true },
    })
    const rawName = userRecord?.displayName || userRecord?.name || ''
    const nameParts = rawName.trim().split(/\s+/)
    const firstName = nameParts[0] || userRecord?.email?.split('@')[0] || 'Unknown'
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null

    const familyspace = await prisma.$transaction(async (tx) => {
      const ws = await tx.familyspace.create({
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
          familyspaceId: ws.id,
          userId: user.id,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      })

      if (freePlan) {
        await tx.subscription.create({
          data: {
            familyspaceId: ws.id,
            planId: freePlan.id,
            billingStatus: 'ACTIVE',
          },
        })
      }

      // Create the root Person record for the creator
      const rootPerson = await tx.person.create({
        data: {
          familyspaceId: ws.id,
          firstName,
          lastName,
          personType: 'FAMILY',
          createdById: user.id,
        },
      })

      // Link the User to their Person record in this familyspace.
      // Always update both linkedPersonId AND defaultFamilyspaceId so the user's
      // node is discoverable when viewing the family tree for this space.
      await tx.user.update({
        where: { id: user.id },
        data: {
          linkedPersonId: rootPerson.id,
          defaultFamilyspaceId: ws.id,
        },
      })

      return ws
    })

    return successResponse(res, {
      id: familyspace.id,
      name: familyspace.name,
      slug: familyspace.slug,
      planType: familyspace.planType,
    }, 201)
  },
})
