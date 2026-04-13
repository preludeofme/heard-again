import { NextApiRequest, NextApiResponse } from 'next'
import { getAuthUserWithWorkspace } from '@/lib/auth-helpers'
import { AppError } from '@/lib/api-helpers'

// Proxy to chat system API
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const chatSystemUrl = process.env.CHAT_SYSTEM_URL || 'http://localhost:4778'

  let user: Awaited<ReturnType<typeof getAuthUserWithWorkspace>>
  try {
    user = await getAuthUserWithWorkspace(req, res)
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ success: false, error: err.message })
    }
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  try {
    const { sessionId } = req.query
    const url = `${chatSystemUrl}/api/chat/messages${sessionId ? `?sessionId=${sessionId}` : ''}`
    
    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CHAT_SERVICE_SECRET}`,
        'x-workspace-id': user.workspaceId,
        'x-user-id': user.id,
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    })

    const data = await response.json()
    
    return res.status(response.status).json(data)
  } catch (error) {
    console.error('Chat system proxy error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to connect to chat system'
    })
  }
}
