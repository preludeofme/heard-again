import { NextApiRequest, NextApiResponse } from 'next'
import { getAuthUserWithWorkspace } from '@/lib/auth-helpers'
import { AppError } from '@/lib/api-helpers'

// Proxy to chat system streaming API
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

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

  // Extract sessionId from body (client sends it there) and forward as query param
  const { sessionId, ...restBody } = req.body || {}
  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'sessionId is required' })
  }

  // Set SSE headers before any write
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    const response = await fetch(
      `${chatSystemUrl}/api/chat/stream?sessionId=${encodeURIComponent(sessionId)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CHAT_SERVICE_SECRET}`,
          'x-workspace-id': user.workspaceId,
          'x-user-id': user.id,
        },
        body: JSON.stringify(restBody),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Upstream error' }))
      res.write(`event: error\ndata: ${JSON.stringify({ error: errorData.error || 'Upstream error' })}\n\n`)
      res.end()
      return
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'No response body' })}\n\n`)
      res.end()
      return
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(decoder.decode(value, { stream: true }))
    }

    res.end()
  } catch (error) {
    console.error('Chat system streaming proxy error:', error)
    if (!res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Failed to connect to chat system' })}\n\n`)
    }
    res.end()
  }
}
