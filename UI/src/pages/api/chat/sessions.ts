import { NextApiRequest, NextApiResponse } from 'next'

// Proxy to chat system API
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const chatSystemUrl = process.env.CHAT_SYSTEM_URL || 'http://localhost:3001'
  
  try {
    const response = await fetch(`${chatSystemUrl}/api/chat/sessions`, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'x-workspace-id': req.headers['x-workspace-id'] as string,
        'x-user-id': req.headers['x-user-id'] as string,
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
