import { NextApiRequest, NextApiResponse } from 'next'
import { ServiceFactory } from '@/services'
import { verifyServiceToken } from '@/utils/auth-guard'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!verifyServiceToken(req, res)) return

  const { sessionId } = req.query
  const familyspaceId = req.headers['x-familyspace-id'] as string
  const userId = req.headers['x-user-id'] as string

  if (!familyspaceId || !userId) {
    return res.status(400).json({ error: 'Missing required headers: x-familyspace-id, x-user-id' })
  }

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid sessionId' })
  }

  const chatService = ServiceFactory.getChatService()

  try {
    switch (req.method) {
      case 'GET': {
        // SEC-3: ownership enforced via userId + familyspaceId
        const session = await chatService.getSession(sessionId, userId, familyspaceId)
        if (!session) {
          return res.status(404).json({ success: false, error: 'Session not found' })
        }
        return res.status(200).json({ success: true, session })
      }

      case 'DELETE': {
        const session = await chatService.getSession(sessionId, userId, familyspaceId)
        if (!session) {
          return res.status(404).json({ success: false, error: 'Session not found' })
        }
        await chatService.deleteSession(sessionId)
        return res.status(200).json({ success: true })
      }

      case 'PATCH': {
        const session = await chatService.getSession(sessionId, userId, familyspaceId)
        if (!session) {
          return res.status(404).json({ success: false, error: 'Session not found' })
        }
        const { status } = req.body
        if (!status || !['active', 'archived'].includes(status)) {
          return res.status(400).json({ error: 'status must be active or archived' })
        }
        const updated = await chatService.updateSession(sessionId, { status })
        return res.status(200).json({ success: true, session: updated })
      }

      default:
        res.setHeader('Allow', ['GET', 'DELETE', 'PATCH'])
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` })
    }
  } catch (error) {
    console.error('Session route error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
