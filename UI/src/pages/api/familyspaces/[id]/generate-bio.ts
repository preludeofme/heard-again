import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export default apiHandler({
  /**
   * GET /api/familyspaces/[id]/generate-bio
   * Retrieves the current family biography.
   */
  GET: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)

    const urlId = req.query.id as string
    if (urlId !== user.familyspaceId) {
      throw Errors.forbidden('Invalid familyspace context')
    }

    const familyspace = await prisma.familyspace.findUnique({
      where: { id: user.familyspaceId },
      select: { bio: true },
    })

    return successResponse(res, { bio: familyspace?.bio || null })
  },

  /**
   * PUT /api/familyspaces/[id]/generate-bio
   * Updates/saves the family biography manually.
   */
  PUT: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)

    // Only EDITOR or higher can save the family bio
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const urlId = req.query.id as string
    if (urlId !== user.familyspaceId) {
      throw Errors.forbidden('Invalid familyspace context')
    }

    const { bio } = req.body as { bio?: string }
    if (typeof bio !== 'string') {
      throw Errors.badRequest('Invalid biography content')
    }

    await prisma.familyspace.update({
      where: { id: user.familyspaceId },
      data: {
        bio: bio.trim() || null,
        updatedAt: new Date(),
      },
    })

    logger.info({ familyspaceId: user.familyspaceId }, 'Family bio updated and saved manually')

    return successResponse(res, { bio: bio.trim() || null })
  },
})
