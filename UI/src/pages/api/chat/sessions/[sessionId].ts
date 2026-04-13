import { NextApiRequest, NextApiResponse } from 'next'
import { getAuthUserWithWorkspace } from '@/lib/auth-helpers'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let user: Awaited<ReturnType<typeof getAuthUserWithWorkspace>>
  try {
    user = await getAuthUserWithWorkspace(req, res)
    if (!user) return
  } catch {
    return
  }

  const { sessionId } = req.query
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing or invalid sessionId' })
  }

  const chatSystemUrl = process.env.CHAT_SYSTEM_URL || 'http://localhost:4778'

  try {
    const response = await fetch(`${chatSystemUrl}/api/chat/sessions/${sessionId}`, {
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
    console.error('Session proxy error:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
