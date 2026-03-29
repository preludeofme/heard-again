import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors, sanitizeAssetResponse } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { withCSRFProtection } from '@/lib/security/csrf'

export default apiHandler({
  // GET /api/people/[id] - Get person details
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const personId = req.query.id as string

    const person = await prisma.person.findFirst({
      where: { id: personId, workspaceId: user.workspaceId },
      include: {
        avatarAsset: {
          select: { id: true, storagePath: true, mimeType: true },
        },
        voiceProfiles: {
          where: { status: 'READY' },
          select: {
            id: true,
            name: true,
            isDefault: true,
            isCloned: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            storiesAsSubject: true,
            storiesAsSpeaker: true,
            voiceProfiles: true,
          },
        },
      },
    })

    if (!person) {
      throw Errors.notFound('Person')
    }

    const familyUnits = await prisma.familyUnit.findMany({
      where: {
        workspaceId: user.workspaceId,
        OR: [
          { parents: { some: { parentId: personId } } },
          { children: { some: { childId: personId } } },
        ],
      },
      include: {
        parents: {
          include: {
            parent: {
              select: { id: true, firstName: true, lastName: true, avatarAssetId: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        children: {
          include: {
            child: {
              select: { id: true, firstName: true, lastName: true, avatarAssetId: true },
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
      person: {
        id: string
        firstName: string
        lastName: string | null
        avatarAssetId: string | null
      }
    }> = []

    for (const family of familyUnits) {
      const isParent = family.parents.some((p) => p.parentId === personId)
      const isChild = family.children.some((c) => c.childId === personId)

      // Parent -> Spouse relationships (other parents in same family)
      if (isParent) {
        for (const parentLink of family.parents) {
          if (parentLink.parentId !== personId) {
            relationships.push({
              id: `fam:${family.id}:spouse:${parentLink.parent.id}`,
              type: 'SPOUSE',
              direction: 'outgoing',
              isBiological: parentLink.relationshipType === 'BIOLOGICAL',
              person: parentLink.parent,
            })
          }
        }
      }

      // Parent -> Child relationships
      if (isParent) {
        for (const childLink of family.children) {
          relationships.push({
            id: `fc:${family.id}:${childLink.childId}:child`,
            type: 'CHILD',
            direction: 'outgoing',
            isBiological: childLink.relationshipType === 'BIOLOGICAL',
            person: childLink.child,
          })
        }
      }

      // Child -> Parent relationships
      if (isChild) {
        for (const parentLink of family.parents) {
          relationships.push({
            id: `fc:${family.id}:${personId}:parent:${parentLink.parent.id}`,
            type: 'PARENT',
            direction: 'incoming',
            isBiological: parentLink.relationshipType === 'BIOLOGICAL',
            person: parentLink.parent,
          })
        }
      }
    }

    return successResponse(res, {
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      displayName: person.displayName || `${person.firstName}${person.lastName ? ' ' + person.lastName : ''}`,
      middleName: person.middleName,
      nickname: person.nickname,
      maidenName: person.maidenName,
      suffix: person.suffix,
      personType: person.personType,
      birthDate: person.birthDate,
      deathDate: person.deathDate,
      isDeceased: person.isDeceased,
      bio: person.bio,
      avatarUrl: person.avatarAsset ? `/api/assets/serve/${person.avatarAsset.id}` : null,
      tags: person.tags,
      voiceProfiles: person.voiceProfiles,
      relationships,
      counts: person._count,
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
    })
  },

  // PUT /api/people/[id] - Update person
  PUT: withCSRFProtection(async (req, res) => {

    const user = await getAuthUserWithWorkspace(req, res)
    const personId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    // Verify person belongs to workspace
    const existing = await prisma.person.findFirst({
      where: { id: personId, workspaceId: user.workspaceId },
    })
    if (!existing) {
      throw Errors.notFound('Person')
    }

    const {
      firstName, lastName, displayName, nickname, maidenName, suffix, middleName,
      birthDate, deathDate, isDeceased, bio, personType, tags,
    } = req.body

    const updateData: any = {}
    if (firstName !== undefined) updateData.firstName = firstName
    if (lastName !== undefined) updateData.lastName = lastName
    if (displayName !== undefined) updateData.displayName = displayName
    if (nickname !== undefined) updateData.nickname = nickname
    if (maidenName !== undefined) updateData.maidenName = maidenName
    if (suffix !== undefined) updateData.suffix = suffix
    if (middleName !== undefined) updateData.middleName = middleName
    if (birthDate !== undefined) updateData.birthDate = birthDate ? new Date(birthDate) : null
    if (deathDate !== undefined) updateData.deathDate = deathDate ? new Date(deathDate) : null
    if (isDeceased !== undefined) updateData.isDeceased = isDeceased
    if (bio !== undefined) updateData.bio = bio
    if (personType !== undefined) updateData.personType = personType
    if (tags !== undefined) updateData.tags = tags

    const person = await prisma.person.update({
      where: { id: personId },
      data: updateData,
    })

    return successResponse(res, {
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      displayName: person.displayName || `${person.firstName}${person.lastName ? ' ' + person.lastName : ''}`,
      updatedAt: person.updatedAt,
    })
  }),

  // DELETE /api/people/[id] - Delete person
  DELETE: withCSRFProtection(async (req, res) => {

    const user = await getAuthUserWithWorkspace(req, res)
    const personId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'ADMIN')

    const existing = await prisma.person.findFirst({
      where: { id: personId, workspaceId: user.workspaceId },
    })
    if (!existing) {
      throw Errors.notFound('Person')
    }

    await prisma.person.delete({ where: { id: personId } })

    return successResponse(res, { deleted: true })
  }),
})
