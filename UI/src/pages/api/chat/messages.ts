import { logger } from '@/lib/logger'
import { NextApiRequest, NextApiResponse } from 'next'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'
import { apiHandler } from '@/lib/api-helpers'

async function proxyToChatSystem(req: NextApiRequest, res: NextApiResponse) {
  const chatSystemUrl = process.env.CHAT_SYSTEM_URL || 'http://localhost:4778'
  const user = await getAuthUserWithFamilyspace(req, res)

  const { sessionId } = req.query
  const url = `${chatSystemUrl}/api/chat/messages${sessionId ? `?sessionId=${sessionId}` : ''}`
  
  const response = await fetch(url, {
    method: req.method as string,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.CHAT_SERVICE_SECRET}`,
      'x-familyspace-id': user.familyspaceId,
      'x-user-id': user.id,
    },
    body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
  })

  const data = await response.json()
  
  return res.status(response.status).json(data)
}

export default apiHandler({
  GET: proxyToChatSystem,
  POST: proxyToChatSystem
})
