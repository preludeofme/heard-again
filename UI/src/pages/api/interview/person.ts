import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'

const CHAT_SERVICE_URL =
  process.env.CHAT_SERVICE_URL || process.env.CHAT_SYSTEM_URL || 'http://localhost:4778'

if (CHAT_SERVICE_URL.includes('localhost') || CHAT_SERVICE_URL.includes('127.0.0.1')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

interface InterviewMessage {
  role: 'user' | 'assistant'
  content: string
}

export default apiHandler({
  POST: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)

    const { messages } = req.body as { messages?: InterviewMessage[] }
    if (!Array.isArray(messages)) {
      throw Errors.badRequest('messages array is required')
    }

    const secret = process.env.CHAT_SERVICE_SECRET
    if (!secret) {
      logger.error('[interview] CHAT_SERVICE_SECRET not configured')
      return res.status(503).json({ success: false, error: 'Interview service not configured' })
    }

    try {
      const response = await fetch(`${CHAT_SERVICE_URL}/api/interview/person`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
          'x-familyspace-id': user.familyspaceId,
          'x-user-id': user.id,
        },
        body: JSON.stringify({ messages }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.success) {
        const message = payload?.error || `Interview service error (${response.status})`
        logger.error({ status: response.status, payload }, '[interview] chat service returned error')
        throw Errors.badRequest(message)
      }

      return successResponse(res, payload.data)
    } catch (error) {
      if ((error as any)?.statusCode) throw error
      logger.error({ error: error instanceof Error ? error.message : String(error) }, '[interview] proxy error')
      return res.status(502).json({ success: false, error: 'Interview service unavailable' })
    }
  },
})
