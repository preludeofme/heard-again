import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
}

export default apiHandler({
  // GET /api/voice/profiles - List voice profiles from DB
  GET: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const { personId } = req.query

    const where: any = {
      familyspaceId: user.familyspaceId,
    }
    if (personId && typeof personId === 'string') {
      where.personId = personId
    }

    const profiles = await prisma.voiceProfile.findMany({
      where,
      include: {
        person: {
          select: { 
            id: true, 
            firstName: true, 
            lastName: true,
            voiceConsents: {
              where: {
                revokedAt: null,
                allowsGeneration: true,
                voiceProfileId: null,
              },
              take: 1,
            },
          },
        },
        createdBy: {
          select: { id: true, displayName: true },
        },
        voiceConsents: {
          where: {
            revokedAt: null,
            allowsGeneration: true,
          },
          take: 1,
        },
        _count: {
          select: { stories: true, generationJobs: true },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })

    const result = profiles.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      person: p.person,
      hasConsent: p.voiceConsents.length > 0 || (p.person?.voiceConsents?.length || 0) > 0,
      modelType: p.modelType,
      engineName: p.engineName,
      isDefault: p.isDefault,
      isCloned: p.isCloned,
      status: p.status,
      styleParams: p.styleParams,
      createdBy: p.createdBy,
      counts: p._count,
      createdAt: p.createdAt,
    }))

    return successResponse(res, result)
  },

  // POST /api/voice/profiles - Create a voice profile (DB record)
  POST: async (req, res) => {

    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const { name, description, personId, isCloned, modelType, styleParams, engineName, engineVersion } = req.body

    if (!name) {
      throw Errors.badRequest('Name is required')
    }

    // Verify person belongs to familyspace if provided
    if (personId) {
      const person = await prisma.person.findFirst({
        where: { id: personId, familyspaceId: user.familyspaceId },
      })
      if (!person) throw Errors.notFound('Person')
    }

    const profile = await prisma.voiceProfile.create({
      data: {
        familyspaceId: user.familyspaceId,
        createdById: user.id,
        name,
        description: description || null,
        personId: personId || null,
        isCloned: isCloned !== false,
        modelType: modelType || 'QWEN3_BASE',
        engineName: engineName || 'qwen3',
        engineVersion: engineVersion || '1.7B-base',
        styleParams: styleParams || null,
        status: 'READY',
      },
    })

    return successResponse(res, {
      id: profile.id,
      name: profile.name,
      status: profile.status,
      createdAt: profile.createdAt,
    }, 201)
  },
})
