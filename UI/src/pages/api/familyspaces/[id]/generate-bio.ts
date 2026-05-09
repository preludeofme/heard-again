import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || process.env.CHAT_SYSTEM_URL || 'https://localhost:4778'

export default apiHandler({
  /**
   * POST /api/familyspaces/[id]/generate-bio
   * Generates a narrative family biography using the Chat service and saves it to the familyspace.
   */
  POST: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    
    // Only EDITOR or higher can generate and save the family bio
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')
    
    const urlId = req.query.id as string
    if (urlId !== user.familyspaceId) {
      throw Errors.forbidden('Invalid familyspace context')
    }

    const secret = process.env.CHAT_SERVICE_SECRET
    if (!secret) {
      logger.error('CHAT_SERVICE_SECRET not configured')
      throw Errors.internal('Generation service not configured')
    }

    try {
      logger.info({ familyspaceId: user.familyspaceId }, 'Requesting family bio generation from chat service')
      
      const chatRes = await fetch(`${CHAT_SERVICE_URL}/api/generate/family-bio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secret}`,
          'x-familyspace-id': user.familyspaceId,
          'x-user-id': user.id,
        },
      })

      if (!chatRes.ok) {
        const errorText = await chatRes.text()
        logger.error({ status: chatRes.status, errorText }, 'Chat service failed to generate bio')
        throw Errors.badRequest('Generation service returned an error')
      }

      const payload = await chatRes.json()
      if (!payload.success || !payload.data?.bio) {
        throw Errors.badRequest(payload.error || 'Failed to generate bio')
      }

      const { bio } = payload.data

      // Persist the generated bio to the familyspace record
      await prisma.familyspace.update({
        where: { id: user.familyspaceId },
        data: { 
          bio,
          updatedAt: new Date(),
        },
      })

      logger.info({ familyspaceId: user.familyspaceId }, 'Family bio generated and saved successfully')

      return successResponse(res, { bio })
    } catch (error) {
      if ((error as any).statusCode) throw error
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Family bio proxy error')
      throw Errors.internal('Failed to generate family biography. Please try again later.')
    }
  },

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
  }
})
