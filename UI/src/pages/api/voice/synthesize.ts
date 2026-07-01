import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { apiHandler, successResponse, errorResponse } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'
import { voiceService } from '@/services'
import { AppError } from '@/lib/api-helpers'
import { checkQuota } from '@/lib/entitlements'

export default apiHandler({
  POST: async (req: NextApiRequest, res: NextApiResponse) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const { modelId, text, language = 'en' } = req.body

    if (!modelId || !text) {
      return errorResponse(res, 'modelId and text are required', 400, 'VALIDATION_ERROR')
    }

    // Check generation quota before synthesizing
    const quota = await checkQuota(user.familyspaceId, 'generation')
    if (!quota.allowed) {
      return res.status(402).json({
        success: false,
        error: quota.reason,
        code: 'QUOTA_EXCEEDED',
        upgradeUrl: quota.upgradeUrl,
      })
    }

    try {
      // Use service-to-service authentication for the TTS pipeline.
      // The user's permission is already verified above by getAuthUserWithFamilyspace.
      // We pass null for authToken to trigger the service token fallback in tts-client.
      const result = await voiceService.synthesize({
        familyspaceId: user.familyspaceId,
        userId: user.id,
        modelId,
        text,
        language,
        authToken: '', // Triggers service-to-service token
      })

      return successResponse(res, result, 200)
    } catch (error) {
      if (error instanceof AppError) {
        return errorResponse(res, error.message, error.statusCode, error.code)
      }

      logger.error('[API] Synthesize error:', error)
      const message = error instanceof Error ? error.message : 'Voice synthesis failed'
      return errorResponse(res, message, 503, 'SYNTHESIS_FAILED')
    }
  },
})
