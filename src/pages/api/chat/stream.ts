import { NextApiRequest, NextApiResponse } from 'next'

// Proxy to chat system streaming API
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const chatSystemUrl = process.env.CHAT_SYSTEM_URL || 'http://localhost:3001'
  
  try {
    const response = await fetch(`${chatSystemUrl}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-workspace-id': req.headers['x-workspace-id'] as string,
        'x-user-id': req.headers['x-user-id'] as string,
      },
      body: JSON.stringify(req.body),
    })

    if (!response.ok) {
      const errorData = await response.json()
      return res.status(response.status).json(errorData)
    }

    // Set up Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      return res.status(500).json({ error: 'No response body' })
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      res.write(chunk)
    }

    res.end()
  } catch (error) {
    console.error('Chat system streaming proxy error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to connect to chat system'
    })
  }
}
