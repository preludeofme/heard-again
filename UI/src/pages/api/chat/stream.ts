import { NextApiRequest, NextApiResponse } from 'next'
import { getAuthUserWithWorkspace } from '@/lib/auth-helpers'
import { AppError } from '@/lib/api-helpers'
import http from 'http'

// Allow long-running SSE streams (LLM generation + validation can exceed 60s)
export const config = {
  api: { bodyParser: true, responseLimit: false },
  maxDuration: 120,
}

// Proxy to chat system streaming API using Node.js http.request for true
// incremental streaming.  Node's built-in fetch (undici) buffers the
// upstream ReadableStream internally, so chunks only arrive at the proxy
// after the entire response completes — causing browser NetworkError on
// long LLM generations.  http.request delivers bytes as they arrive.
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

  // Disable socket timeouts on the browser→proxy connection so the SSE
  // stream survives long pauses (e.g. post-stream validation in the Chat service).
  req.socket.setTimeout(0)
  req.socket.setKeepAlive(true)

  // Set SSE headers and flush them immediately so the browser establishes
  // the EventSource connection before the upstream LLM starts generating.
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const upstreamUrl = new URL(
    `/api/chat/stream?sessionId=${encodeURIComponent(sessionId)}`,
    chatSystemUrl
  )
  const bodyPayload = JSON.stringify(restBody)

  return new Promise<void>((resolve) => {
    const proxyReq = http.request(
      upstreamUrl,
      {
        method: 'POST',
        timeout: 120_000,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyPayload),
          'Authorization': `Bearer ${process.env.CHAT_SERVICE_SECRET}`,
          'x-workspace-id': user.workspaceId,
          'x-user-id': user.id,
        },
      },
      (upstreamRes) => {
        // Disable socket timeout on the upstream response so it survives
        // the gap between the last LLM token and the end-of-stream event
        // (validation + DB update can take several seconds).
        upstreamRes.socket?.setTimeout(0)

        if (upstreamRes.statusCode && upstreamRes.statusCode >= 400) {
          let body = ''
          upstreamRes.on('data', (c) => { body += c })
          upstreamRes.on('end', () => {
            const errMsg = (() => { try { return JSON.parse(body).error } catch { return 'Upstream error' } })()
            res.write(`event: error\ndata: ${JSON.stringify({ error: errMsg })}\n\n`)
            res.end()
            resolve()
          })
          return
        }

        // Pipe upstream chunks to the browser in real-time
        upstreamRes.on('data', (chunk: Buffer) => {
          console.log('UPSTREAM DATA chunk length:', chunk.length)
          res.write(chunk)
          if (typeof (res as any).flush === 'function') {
            (res as any).flush()
          }
        })

        upstreamRes.on('end', () => {
          console.log('UPSTREAM END received')
          res.end()
          resolve()
        })

        upstreamRes.on('error', (err) => {
          console.error('Upstream stream error:', err)
          res.write(`event: error\ndata: ${JSON.stringify({ error: 'Upstream stream error' })}\n\n`)
          res.end()
          resolve()
        })
      }
    )

    proxyReq.on('error', (err) => {
      console.error('Chat system streaming proxy error:', err)
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Failed to connect to chat system' })}\n\n`)
      res.end()
      resolve()
    })

    proxyReq.on('timeout', () => {
      console.error('Chat system streaming proxy TIMEOUT after 120s')
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Upstream request timeout' })}\n\n`)
      res.end()
      resolve()
    })

    proxyReq.on('socket', (socket) => {
      socket.setTimeout(0)
      socket.setKeepAlive(true)
    })

    proxyReq.write(bodyPayload)
    proxyReq.end()
  })
}
