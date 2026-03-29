import { NextApiRequest, NextApiResponse } from 'next'
import { ServiceFactory } from '@/services'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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
        return await handleGetSessions(chatService, workspaceId, userId, res)
      case 'POST':
        return await handleCreateSession(chatService, workspaceId, userId, req.body, res)
      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Chat sessions error:', error)
    res.status(500).json({
      error: 'Failed to manage chat sessions',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleGetSessions(
  chatService: any,
  workspaceId: string,
  userId: string,
  res: NextApiResponse
) {
  try {
    const sessions = await chatService.listSessions(workspaceId, userId)
    
    res.status(200).json({
      success: true,
      sessions,
      count: sessions.length
    })
  } catch (error) {
    console.error('Failed to get sessions:', error)
    res.status(500).json({
      error: 'Failed to retrieve chat sessions',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleCreateSession(
  chatService: any,
  workspaceId: string,
  userId: string,
  body: any,
  res: NextApiResponse
) {
  try {
    const { personId, title } = body

    if (!personId) {
      return res.status(400).json({
        error: 'personId is required'
      })
    }

    const session = await chatService.createSession({
      workspaceId,
      personId,
      userId,
      title: title || `Chat with ${personId}`
    })

    res.status(201).json({
      success: true,
      session,
      message: 'Chat session created successfully'
    })
  } catch (error) {
    console.error('Failed to create session:', error)
    res.status(500).json({
      error: 'Failed to create chat session',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
