import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { validate, rules } from '@/lib/validation'

export default apiHandler({
  // GET /api/people/[id]/relationships - Get person's relationships
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const personId = req.query.id as string

    const person = await prisma.person.findFirst({
      where: { id: personId, workspaceId: user.workspaceId },
    })
    if (!person) throw Errors.notFound('Person')

    const familyUnits = await prisma.familyUnit.findMany({
      where: {
        workspaceId: user.workspaceId,
        OR: [
          { husbandId: personId },
          { wifeId: personId },
          { children: { some: { childId: personId } } },
        ],
      },
      include: {
        husband: {
          select: { id: true, firstName: true, lastName: true, nickname: true, avatarAssetId: true },
        },
        wife: {
          select: { id: true, firstName: true, lastName: true, nickname: true, avatarAssetId: true },
        },
        children: {
          include: {
            child: {
              select: { id: true, firstName: true, lastName: true, nickname: true, avatarAssetId: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    const relationships: Array<{
      id: string
      type: 'SPOUSE' | 'PARENT' | 'CHILD'
      direction: 'outgoing' | 'incoming'
      isBiological: boolean
      notes: string | null
      relatedPerson: {
        id: string
        firstName: string
        lastName: string | null
        nickname: string | null
        avatarAssetId: string | null
      }
    }> = []

    for (const family of familyUnits) {
      if (family.husbandId === personId && family.wife) {
        relationships.push({
          id: `fam:${family.id}:spouse:${family.wife.id}`,
          type: 'SPOUSE',
          direction: 'outgoing',
          isBiological: true,
          notes: family.notes,
          relatedPerson: family.wife,
        })
      }

      if (family.wifeId === personId && family.husband) {
        relationships.push({
          id: `fam:${family.id}:spouse:${family.husband.id}`,
          type: 'SPOUSE',
          direction: 'outgoing',
          isBiological: true,
          notes: family.notes,
          relatedPerson: family.husband,
        })
      }

      const isParent = family.husbandId === personId || family.wifeId === personId
      if (isParent) {
        for (const childLink of family.children) {
          relationships.push({
            id: `fc:${family.id}:${childLink.childId}:child`,
            type: 'CHILD',
            direction: 'outgoing',
            isBiological: childLink.relationshipType === 'BIOLOGICAL',
            notes: family.notes,
            relatedPerson: childLink.child,
          })
        }
      }

      let isChild = false
      for (const child of family.children) {
        if (child.childId === personId) {
          isChild = true
          break
        }
      }
      if (isChild) {
        if (family.husband && family.husband.id !== personId) {
          relationships.push({
            id: `fc:${family.id}:${personId}:parent:${family.husband.id}`,
            type: 'PARENT',
            direction: 'incoming',
            isBiological: true,
            notes: family.notes,
            relatedPerson: family.husband,
          })
        }
        if (family.wife && family.wife.id !== personId) {
          relationships.push({
            id: `fc:${family.id}:${personId}:parent:${family.wife.id}`,
            type: 'PARENT',
            direction: 'incoming',
            isBiological: true,
            notes: family.notes,
            relatedPerson: family.wife,
          })
        }
      }
    }

    return successResponse(res, relationships)
  },

  // POST /api/people/[id]/relationships - Create a relationship
  POST: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const personId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const { valid, errors } = validate(req.body, {
      targetPersonId: [rules.required, rules.uuid],
      relationshipType: [rules.required, rules.oneOf(['PARENT', 'CHILD', 'SPOUSE'])],
    })

    if (!valid) throw Errors.badRequest('Validation failed', errors)

    const { targetPersonId, relationshipType, isBiological = true, notes } = req.body

    if (personId === targetPersonId) {
      throw Errors.badRequest('Cannot create a relationship with oneself')
    }

    // Verify both people belong to the same workspace
    const [source, target] = await Promise.all([
      prisma.person.findFirst({ where: { id: personId, workspaceId: user.workspaceId } }),
      prisma.person.findFirst({ where: { id: targetPersonId, workspaceId: user.workspaceId } }),
    ])

    if (!source) throw Errors.notFound('Source person')
    if (!target) throw Errors.notFound('Target person')

    if (relationshipType === 'SPOUSE') {
      const existing = await prisma.familyUnit.findFirst({
        where: {
          workspaceId: user.workspaceId,
          OR: [
            { husbandId: personId, wifeId: targetPersonId },
            { husbandId: targetPersonId, wifeId: personId },
          ],
        },
      })

      const family = existing || await prisma.familyUnit.create({
        data: {
          workspaceId: user.workspaceId,
          husbandId: personId,
          wifeId: targetPersonId,
          notes: notes || null,
        },
      })

      return successResponse(res, {
        id: `fam:${family.id}:spouse:${target.id}`,
        type: 'SPOUSE',
        isBiological: true,
        relatedPerson: {
          id: target.id,
          firstName: target.firstName,
          lastName: target.lastName,
        },
      }, 201)
    }

    const parentId = relationshipType === 'PARENT' ? personId : targetPersonId
    const childId = relationshipType === 'PARENT' ? targetPersonId : personId

    const existingParentChildLink = await prisma.familyChild.findFirst({
      where: {
        childId,
        family: {
          workspaceId: user.workspaceId,
          OR: [
            { husbandId: parentId },
            { wifeId: parentId },
          ],
        },
      },
      include: {
        family: {
          select: { id: true },
        },
      },
    })

    if (existingParentChildLink) {
      return successResponse(res, {
        id: `fc:${existingParentChildLink.family.id}:${childId}:child`,
        type: relationshipType,
        isBiological: existingParentChildLink.relationshipType === 'BIOLOGICAL',
        relatedPerson: {
          id: target.id,
          firstName: target.firstName,
          lastName: target.lastName,
        },
      }, 200)
    }

    let family = await prisma.familyUnit.findFirst({
      where: {
        workspaceId: user.workspaceId,
        OR: [
          { husbandId: parentId },
          { wifeId: parentId },
        ],
      },
      orderBy: { createdAt: 'asc' },
    })

    if (!family) {
      family = await prisma.familyUnit.create({
        data: {
          workspaceId: user.workspaceId,
          husbandId: parentId,
          wifeId: null,
          notes: notes || null,
        },
      })
    }

    const childLink = await prisma.familyChild.upsert({
      where: {
        familyId_childId: {
          familyId: family.id,
          childId,
        },
      },
      update: {
        relationshipType: isBiological ? 'BIOLOGICAL' : 'ADOPTED',
      },
      create: {
        familyId: family.id,
        childId,
        relationshipType: isBiological ? 'BIOLOGICAL' : 'ADOPTED',
      },
      include: {
        child: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    })

    return successResponse(res, {
      id: `fc:${family.id}:${childLink.childId}:child`,
      type: relationshipType,
      isBiological: childLink.relationshipType === 'BIOLOGICAL',
      relatedPerson: {
        id: target.id,
        firstName: target.firstName,
        lastName: target.lastName,
      },
    }, 201)
  },
})
