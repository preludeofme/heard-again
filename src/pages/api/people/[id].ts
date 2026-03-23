import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'

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
        relationshipsAsSource: {
          include: {
            targetPerson: {
              select: { id: true, firstName: true, lastName: true, avatarAssetId: true },
            },
          },
        },
        relationshipsAsTarget: {
          include: {
            sourcePerson: {
              select: { id: true, firstName: true, lastName: true, avatarAssetId: true },
            },
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
      avatarUrl: person.avatarAsset?.storagePath || null,
      tags: person.tags,
      voiceProfiles: person.voiceProfiles,
      relationships: [
        ...person.relationshipsAsSource.map((r) => ({
          id: r.id,
          type: r.relationshipType,
          direction: 'outgoing' as const,
          isBiological: r.isBiological,
          person: r.targetPerson,
        })),
        ...person.relationshipsAsTarget.map((r) => ({
          id: r.id,
          type: r.relationshipType,
          direction: 'incoming' as const,
          isBiological: r.isBiological,
          person: r.sourcePerson,
        })),
      ],
      counts: person._count,
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
    })
  },

  // PUT /api/people/[id] - Update person
  PUT: async (req, res) => {
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
  },

  // DELETE /api/people/[id] - Delete person
  DELETE: async (req, res) => {
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
  },
})
