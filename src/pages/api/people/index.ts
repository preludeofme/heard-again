import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { validate, rules } from '@/lib/validation'

export default apiHandler({
  // GET /api/people - List people in workspace
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const { search, type } = req.query

    const where: any = {
      workspaceId: user.workspaceId,
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { nickname: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (type && typeof type === 'string') {
      where.personType = type.toUpperCase()
    }

    const people = await prisma.person.findMany({
      where,
      include: {
        avatarAsset: {
          select: { id: true, storagePath: true, mimeType: true },
        },
        _count: {
          select: {
            storiesAsSubject: true,
            voiceProfiles: true,
            relationshipsAsSource: true,
            relationshipsAsTarget: true,
          },
        },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    })

    const result = people.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      displayName: p.displayName || `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}`,
      nickname: p.nickname,
      personType: p.personType,
      birthDate: p.birthDate,
      deathDate: p.deathDate,
      isDeceased: p.isDeceased,
      bio: p.bio,
      avatarUrl: p.avatarAsset?.storagePath || null,
      tags: p.tags,
      counts: {
        stories: p._count.storiesAsSubject,
        voiceProfiles: p._count.voiceProfiles,
        relationships: p._count.relationshipsAsSource + p._count.relationshipsAsTarget,
      },
      createdAt: p.createdAt,
    }))

    return successResponse(res, result)
  },

  // POST /api/people - Create a person
  POST: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const { valid, errors } = validate(req.body, {
      firstName: [rules.required, rules.minLength(1), rules.maxLength(100)],
    })

    if (!valid) {
      throw Errors.badRequest('Validation failed', errors)
    }

    const {
      firstName, lastName, displayName, nickname, maidenName, suffix, middleName,
      birthDate, deathDate, isDeceased, bio, personType, tags,
    } = req.body

    const person = await prisma.person.create({
      data: {
        workspaceId: user.workspaceId,
        createdById: user.id,
        firstName,
        lastName: lastName || null,
        displayName: displayName || null,
        nickname: nickname || null,
        maidenName: maidenName || null,
        suffix: suffix || null,
        middleName: middleName || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        deathDate: deathDate ? new Date(deathDate) : null,
        isDeceased: isDeceased || false,
        bio: bio || null,
        personType: personType || 'FAMILY',
        tags: tags || [],
      },
      include: {
        _count: {
          select: { storiesAsSubject: true, voiceProfiles: true },
        },
      },
    })

    return successResponse(res, {
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      displayName: person.displayName || `${person.firstName}${person.lastName ? ' ' + person.lastName : ''}`,
      personType: person.personType,
      createdAt: person.createdAt,
    }, 201)
  },
})
