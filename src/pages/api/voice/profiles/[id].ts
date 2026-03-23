import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  // GET /api/voice/profiles/[id] - Get profile details
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const profileId = req.query.id as string

    const profile = await prisma.voiceProfile.findFirst({
      where: { id: profileId, workspaceId: user.workspaceId },
      include: {
        person: {
          select: { id: true, firstName: true, lastName: true, nickname: true },
        },
        createdBy: {
          select: { id: true, displayName: true, email: true },
        },
        sourceAsset: {
          select: { id: true, storagePath: true, durationSeconds: true, transcript: true },
        },
        _count: {
          select: { stories: true, generationJobs: true },
        },
      },
    })

    if (!profile) throw Errors.notFound('Voice profile')

    return successResponse(res, {
      id: profile.id,
      name: profile.name,
      description: profile.description,
      person: profile.person,
      modelType: profile.modelType,
      engineName: profile.engineName,
      engineVersion: profile.engineVersion,
      isDefault: profile.isDefault,
      isCloned: profile.isCloned,
      status: profile.status,
      styleParams: profile.styleParams,
      sourceAsset: profile.sourceAsset,
      sourceTranscript: profile.sourceTranscript,
      createdBy: profile.createdBy,
      counts: profile._count,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    })
  },

  // PUT /api/voice/profiles/[id] - Update profile metadata
  PUT: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const profileId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const existing = await prisma.voiceProfile.findFirst({
      where: { id: profileId, workspaceId: user.workspaceId },
    })
    if (!existing) throw Errors.notFound('Voice profile')

    const { name, description, personId, styleParams, isDefault } = req.body

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (personId !== undefined) updateData.personId = personId || null
    if (styleParams !== undefined) updateData.styleParams = styleParams
    if (isDefault !== undefined) {
      updateData.isDefault = isDefault
      // If setting as default, unset other defaults for same person
      if (isDefault && existing.personId) {
        await prisma.voiceProfile.updateMany({
          where: {
            personId: existing.personId,
            workspaceId: user.workspaceId,
            id: { not: profileId },
          },
          data: { isDefault: false },
        })
      }
    }

    const profile = await prisma.voiceProfile.update({
      where: { id: profileId },
      data: updateData,
    })

    return successResponse(res, {
      id: profile.id,
      name: profile.name,
      isDefault: profile.isDefault,
      updatedAt: profile.updatedAt,
    })
  },

  // DELETE /api/voice/profiles/[id] - Delete profile
  DELETE: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const profileId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const existing = await prisma.voiceProfile.findFirst({
      where: { id: profileId, workspaceId: user.workspaceId },
    })
    if (!existing) throw Errors.notFound('Voice profile')

    await prisma.voiceProfile.delete({ where: { id: profileId } })

    return successResponse(res, { deleted: true })
  },
})
