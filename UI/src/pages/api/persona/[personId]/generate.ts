import { NextApiRequest, NextApiResponse } from 'next'
import { getAuthUserWithWorkspace } from '@/lib/auth-helpers'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Authenticate user and get workspace context
    const user = await getAuthUserWithWorkspace(req, res)
    if (!user) return

    const { personId } = req.query
    const chatSystemUrl = process.env.CHAT_SYSTEM_URL || 'http://localhost:4778'

    if (!personId || typeof personId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid personId'
      })
    }

    // Proxy the request to Chat service
    const response = await fetch(`${chatSystemUrl}/api/persona/${personId}/generate`, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CHAT_SERVICE_SECRET}`,
        'x-workspace-id': user.workspaceId,
        'x-user-id': user.id,
      },
      credentials: 'include',
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    })

    // Forward the response
    const data = await response.json()
    
    return res.status(response.status).json(data)
  } catch (error) {
    console.error('Persona generation proxy error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}
