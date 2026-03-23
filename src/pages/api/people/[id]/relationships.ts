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

    const [asSource, asTarget] = await Promise.all([
      prisma.personRelationship.findMany({
        where: { sourcePersonId: personId },
        include: {
          targetPerson: {
            select: { id: true, firstName: true, lastName: true, nickname: true, avatarAssetId: true },
          },
        },
      }),
      prisma.personRelationship.findMany({
        where: { targetPersonId: personId },
        include: {
          sourcePerson: {
            select: { id: true, firstName: true, lastName: true, nickname: true, avatarAssetId: true },
          },
        },
      }),
    ])

    const relationships = [
      ...asSource.map((r) => ({
        id: r.id,
        type: r.relationshipType,
        direction: 'outgoing' as const,
        isBiological: r.isBiological,
        notes: r.notes,
        relatedPerson: r.targetPerson,
      })),
      ...asTarget.map((r) => ({
        id: r.id,
        type: r.relationshipType,
        direction: 'incoming' as const,
        isBiological: r.isBiological,
        notes: r.notes,
        relatedPerson: r.sourcePerson,
      })),
    ]

    return successResponse(res, relationships)
  },

  // POST /api/people/[id]/relationships - Create a relationship
  POST: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const personId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const { valid, errors } = validate(req.body, {
      targetPersonId: [rules.required, rules.uuid],
      relationshipType: [rules.required, rules.oneOf([
        'PARENT', 'CHILD', 'SPOUSE', 'SIBLING', 'GRANDPARENT',
        'GRANDCHILD', 'AUNT_UNCLE', 'NIECE_NEPHEW', 'COUSIN',
        'FRIEND', 'COLLEAGUE', 'OTHER',
      ])],
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

    const relationship = await prisma.personRelationship.create({
      data: {
        sourcePersonId: personId,
        targetPersonId,
        relationshipType,
        isBiological,
        notes: notes || null,
      },
      include: {
        targetPerson: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    })

    return successResponse(res, {
      id: relationship.id,
      type: relationship.relationshipType,
      isBiological: relationship.isBiological,
      relatedPerson: relationship.targetPerson,
    }, 201)
  },
})
