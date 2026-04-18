import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { apiHandler, successResponse, errorResponse } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace } from '@/lib/auth-helpers'
import { voiceService } from '@/services'
import { AppError } from '@/lib/api-helpers'
import { withCSRFProtection } from '@/lib/security/csrf'

export default apiHandler({
  POST: withCSRFProtection(async (req: NextApiRequest, res: NextApiResponse) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const { modelId, text, language = 'en' } = req.body

    if (!modelId || !text) {
      return errorResponse(res, 'modelId and text are required', 400, 'VALIDATION_ERROR')
    }

    try {
      // Get the raw JWT token from the request cookie for TTS service auth
      const rawToken = req.cookies['next-auth.session-token']
      if (!rawToken) {
        return errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED')
      }

      const result = await voiceService.synthesize({
        workspaceId: user.workspaceId,
        userId: user.id,
        modelId,
        text,
        language,
        authToken: rawToken,
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
  }),
})
