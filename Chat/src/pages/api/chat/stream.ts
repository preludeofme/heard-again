import { NextApiRequest, NextApiResponse } from 'next'
import { ServiceFactory } from '@/services'
import { verifyServiceToken } from '@/utils/auth-guard'

// Allow long-running SSE streams (LLM generation + validation can exceed 60s)
export const config = {
  api: { bodyParser: true, responseLimit: false },
  maxDuration: 600,
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!verifyServiceToken(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { sessionId } = req.query

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Session ID is required' })
  }

  try {
    // Extract familyspace and user info from headers
    const familyspaceId = req.headers['x-familyspace-id'] as string
    const userId = req.headers['x-user-id'] as string

    if (!familyspaceId || !userId) {
      return res.status(400).json({ 
        error: 'Missing required headers: x-familyspace-id, x-user-id' 
      })
    }

    const { message, options } = req.body

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Message is required and must be a string'
      })
    }

    if (message.trim().length === 0) {
      return res.status(400).json({
        error: 'Message cannot be empty'
      })
    }

    if (message.length > 10000) {
      return res.status(400).json({
        error: 'Message too long (max 10,000 characters)'
      })
    }

    // Disable socket timeouts so the SSE stream survives long pauses
    // (post-stream validation + DB update can take several seconds).
    req.socket.setTimeout(0)
    req.socket.setKeepAlive(true)

    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control')
    res.flushHeaders()

    const chatService = ServiceFactory.getChatService()

    // Verify session exists and belongs to this familyspace (SEC-3).
    // userId ownership is enforced at the UI proxy layer; here we scope to familyspace only.
    const session = await chatService.getSession(sessionId, undefined, familyspaceId)
    if (!session) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Chat session not found' })}\n\n`)
      res.end()
      return
    }

    // Store user message immediately
    const userMessage = await chatService.storeUserMessage(sessionId, message.trim())

    // Send user message confirmation
    res.write(`event: user_message\ndata: ${JSON.stringify({ message: userMessage })}\n\n`)

    try {
      // Stream the response — strict options allowlist (SEC-7)
      const stream = await chatService.streamResponse({
        sessionId,
        message: message.trim(),
        options: {
          maxRetrievedDocuments: Math.min(Math.max(Number(options?.maxRetrievedDocuments) || 5, 1), 10),
          temperature: Math.min(Math.max(Number(options?.temperature) || 0.7, 0.0), 1.0)
        }
      }) as AsyncIterable<any>

      let fullResponse = ''
      let messageId: string | null = null

      for await (const chunk of stream) {
        try {
          if (chunk.type === 'start') {
            messageId = chunk.messageId || null
            // Bug-2 fix: include type in data JSON so client can use data.type
            const data = JSON.stringify({ type: 'start', messageId })
            res.write(`event: start\ndata: ${data}\n\n`)
            res.flush()
          } else if (chunk.type === 'chunk') {
            fullResponse += chunk.content
            // Sanitize content to prevent JSON parsing errors
            const sanitizedContent = chunk.content.replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
            const data = JSON.stringify({ type: 'chunk', content: sanitizedContent })
            res.write(`event: chunk\ndata: ${data}\n\n`)
            res.flush()
          } else if (chunk.type === 'metadata') {
            const data = JSON.stringify({ type: 'metadata', ...chunk.metadata })
            res.write(`event: metadata\ndata: ${data}\n\n`)
            res.flush()
          } else if (chunk.type === 'end') {
            // Use filteredContent if validation found violations; otherwise use the streamed content
            const contentToStore = chunk.metadata?.filteredContent || fullResponse
            if (messageId && contentToStore) {
              await chatService.updateAssistantMessage(messageId, contentToStore, chunk.metadata || {})
            }
            const data = JSON.stringify({ 
              type: 'end',
              messageId,
              processingTime: chunk.metadata?.totalProcessingTime,
              tokensUsed: chunk.metadata?.totalTokens,
              filteredContent: chunk.metadata?.filteredContent || null
            })
            res.write(`event: end\ndata: ${data}\n\n`)
            res.flush()
            break
          } else if (chunk.type === 'error') {
            const data = JSON.stringify({ type: 'error', error: chunk.error })
            res.write(`event: error\ndata: ${data}\n\n`)
            res.flush()
            break
          }
        } catch (jsonError) {
          console.error('Failed to serialize chunk:', chunk, jsonError)
          res.write(`event: error\ndata: ${JSON.stringify({ 
            type: 'error', 
            error: 'Failed to serialize response chunk',
            details: jsonError instanceof Error ? jsonError.message : 'Unknown error'
          })}\n\n`)
          res.flush()
          break
        }
      }

      res.end()
    } catch (streamError) {
      console.error('Streaming error:', streamError)
      res.write(`event: error\ndata: ${JSON.stringify({ 
        error: 'Failed to stream response',
        details: streamError instanceof Error ? streamError.message : 'Unknown error'
      })}\n\n`)
      res.flush()
      res.end()
    }

  } catch (error) {
    console.error('Chat stream error:', error)
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to stream chat response',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })}\n\n`)
      res.end()
    }
  }
}
