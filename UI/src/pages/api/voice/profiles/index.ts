import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { withCSRFProtection } from '@/lib/security/csrf'

export default apiHandler({
  // GET /api/voice/profiles - List voice profiles from DB
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const { personId } = req.query

    const where: any = {
      workspaceId: user.workspaceId,
    }
    if (personId && typeof personId === 'string') {
      where.personId = personId
    }

    const profiles = await prisma.voiceProfile.findMany({
      where,
      include: {
        person: {
          select: { id: true, firstName: true, lastName: true },
        },
        createdBy: {
          select: { id: true, displayName: true },
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
  POST: withCSRFProtection(async (req, res) => {

    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const { name, description, personId, isCloned, modelType, styleParams, engineName, engineVersion } = req.body

    if (!name) {
      throw Errors.badRequest('Name is required')
    }

    // Verify person belongs to workspace if provided
    if (personId) {
      const person = await prisma.person.findFirst({
        where: { id: personId, workspaceId: user.workspaceId },
      })
      if (!person) throw Errors.notFound('Person')
    }

    const profile = await prisma.voiceProfile.create({
      data: {
        workspaceId: user.workspaceId,
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
  }),
})
