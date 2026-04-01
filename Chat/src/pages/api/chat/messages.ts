import { NextApiRequest, NextApiResponse } from 'next'
import { ServiceFactory } from '@/services/index'
import { verifyServiceToken } from '@/utils/auth-guard'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!verifyServiceToken(req, res)) return

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

    const chatService = ServiceFactory.getChatService()

    switch (req.method) {
      case 'GET':
        return await handleGetMessages(chatService, sessionId, req.query, res, userId, workspaceId)
      case 'POST':
        return await handleSendMessage(chatService, sessionId, workspaceId, userId, req.body, res)
      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Chat messages error:', error)
    res.status(500).json({
      error: 'Failed to manage chat messages',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleGetMessages(
  chatService: any,
  sessionId: string,
  query: any,
  res: NextApiResponse,
  userId: string,
  workspaceId: string
) {
  try {
    const limit = parseInt(query.limit as string) || 50
    const offset = parseInt(query.offset as string) || 0

    // Verify session exists and belongs to this user/workspace (SEC-3)
    const session = await chatService.getSession(sessionId, userId, workspaceId)
    if (!session) {
      return res.status(404).json({ error: 'Chat session not found' })
    }

    const messages = await chatService.getHistory(sessionId, limit, offset)
    
    res.status(200).json({
      success: true,
      messages,
      session,
      pagination: {
        limit,
        offset,
        count: messages.length
      }
    })
  } catch (error) {
    console.error('Failed to get messages:', error)
    res.status(500).json({
      error: 'Failed to retrieve chat messages',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleSendMessage(
  chatService: any,
  sessionId: string,
  workspaceId: string,
  userId: string,
  body: any,
  res: NextApiResponse
) {
  try {
    const { message, options } = body

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

    // Verify session exists and belongs to this user/workspace (SEC-3)
    const session = await chatService.getSession(sessionId, userId, workspaceId)
    if (!session) {
      return res.status(404).json({ error: 'Chat session not found' })
    }

    // Send message — strict options allowlist (SEC-7)
    const response = await chatService.sendMessage({
      sessionId,
      message: message.trim(),
      options: {
        maxRetrievedDocuments: Math.min(Math.max(Number(options?.maxRetrievedDocuments) || 5, 1), 10),
        temperature: Math.min(Math.max(Number(options?.temperature) || 0.7, 0.0), 1.0)
      }
    })

    res.status(200).json({
      success: true,
      response,
      message: 'Message sent successfully'
    })
  } catch (error) {
    console.error('Failed to send message:', error)
    res.status(500).json({
      error: 'Failed to send message',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
