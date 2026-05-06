import { logger } from '@/lib/logger'
import { NextApiRequest, NextApiResponse } from 'next'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'
import { apiHandler, Errors } from '@/lib/api-helpers'

async function generatePersona(req: NextApiRequest, res: NextApiResponse) {
  // Authenticate user and get familyspace context
  const user = await getAuthUserWithFamilyspace(req, res)

  const { personId } = req.query
  const chatSystemUrl = process.env.CHAT_SYSTEM_URL || 'https://localhost:4778'

  if (!personId || typeof personId !== 'string') {
    throw Errors.badRequest('Missing or invalid personId')
  }

  // Proxy the request to Chat service
  const response = await fetch(`${chatSystemUrl}/api/persona/${personId}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.CHAT_SERVICE_SECRET}`,
      'x-familyspace-id': user.familyspaceId,
      'x-user-id': user.id,
    },
    credentials: 'include',
    body: JSON.stringify(req.body),
  })

  // Forward the response
  const data = await response.json()
  
  return res.status(response.status).json(data)
}

export default apiHandler({
  POST: generatePersona
})
