import { NextApiRequest, NextApiResponse } from 'next'
import { ServiceFactory } from '@/services'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { sessionId } = req.query

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Session ID is required' })
  }

  try {
    // Extract workspace and user info from headers
    const workspaceId = req.headers['x-workspace-id'] as string
    const userId = req.headers['x-user-id'] as string

    if (!workspaceId || !userId) {
      return res.status(400).json({ 
        error: 'Missing required headers: x-workspace-id, x-user-id' 
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

    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control')

    const chatService = ServiceFactory.getChatService()

    // Verify session exists
    const session = await chatService.getSession(sessionId)
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
      // Stream the response
      const stream = await chatService.streamResponse({
        sessionId,
        message: message.trim(),
        options: {
          maxRetrievedDocuments: options?.maxRetrievedDocuments || 5,
          temperature: options?.temperature || 0.7,
          ...options
        }
      }) as AsyncIterable<any>

      let fullResponse = ''
      let messageId: string | null = null

      for await (const chunk of stream) {
        if (chunk.type === 'start') {
          messageId = chunk.messageId || null
          res.write(`event: start\ndata: ${JSON.stringify({ messageId })}\n\n`)
        } else if (chunk.type === 'chunk') {
          fullResponse += chunk.content
          res.write(`event: chunk\ndata: ${JSON.stringify({ content: chunk.content })}\n\n`)
        } else if (chunk.type === 'metadata') {
          res.write(`event: metadata\ndata: ${JSON.stringify(chunk.metadata)}\n\n`)
        } else if (chunk.type === 'end') {
          // Store the complete assistant message
          if (messageId && fullResponse) {
            await chatService.updateAssistantMessage(messageId, fullResponse, chunk.metadata || {})
          }
          res.write(`event: end\ndata: ${JSON.stringify({ 
            messageId,
            processingTime: chunk.processingTime,
            tokensUsed: chunk.tokensUsed
          })}\n\n`)
          break
        } else if (chunk.type === 'error') {
          res.write(`event: error\ndata: ${JSON.stringify({ error: chunk.error })}\n\n`)
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
