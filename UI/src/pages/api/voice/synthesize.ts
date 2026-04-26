import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { apiHandler, successResponse, errorResponse } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace } from '@/lib/auth-helpers'
import { voiceService } from '@/services'
import { AppError } from '@/lib/api-helpers'
export default apiHandler({
  POST: async (req: NextApiRequest, res: NextApiResponse) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const { modelId, text, language = 'en' } = req.body

    if (!modelId || !text) {
      return errorResponse(res, 'modelId and text are required', 400, 'VALIDATION_ERROR')
    }

    try {
      // Use service-to-service authentication for the TTS pipeline.
      // The user's permission is already verified above by getAuthUserWithWorkspace.
      // We pass null for authToken to trigger the service token fallback in tts-client.
      const result = await voiceService.synthesize({
        workspaceId: user.workspaceId,
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
