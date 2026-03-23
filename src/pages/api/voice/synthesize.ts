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
      const result = await voiceService.synthesize({
        workspaceId: user.workspaceId,
        userId: user.id,
        modelId,
        text,
        language,
      })

      return successResponse(res, result, 200)
    } catch (error) {
      if (error instanceof AppError) {
        return errorResponse(res, error.message, error.statusCode, error.code)
      }

      console.error('[API] Synthesize error:', error)
      return errorResponse(res, 'Voice synthesis failed', 503, 'SYNTHESIS_FAILED')
    }
  },
})
