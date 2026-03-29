import { NextApiRequest, NextApiResponse } from 'next'
import { ServiceFactory } from '@/services'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query

  if (!id || typeof id !== 'string') {
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
        return await handleGetSession(chatService, id, res)
      case 'PUT':
        return await handleUpdateSession(chatService, id, req.body, res)
      case 'DELETE':
        return await handleDeleteSession(chatService, id, res)
      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Session management error:', error)
    res.status(500).json({
      error: 'Failed to manage chat session',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleGetSession(
  chatService: any,
  sessionId: string,
  res: NextApiResponse
) {
  try {
    const session = await chatService.getSession(sessionId)
    
    if (!session) {
      return res.status(404).json({ error: 'Chat session not found' })
    }

    res.status(200).json({
      success: true,
      session
    })
  } catch (error) {
    console.error('Failed to get session:', error)
    res.status(500).json({
      error: 'Failed to retrieve chat session',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleUpdateSession(
  chatService: any,
  sessionId: string,
  body: any,
  res: NextApiResponse
) {
  try {
    const { title, status } = body

    // Verify session exists
    const existingSession = await chatService.getSession(sessionId)
    if (!existingSession) {
      return res.status(404).json({ error: 'Chat session not found' })
    }

    const updates: any = {}
    if (title !== undefined) updates.title = title
    if (status !== undefined) updates.status = status

    const updatedSession = await chatService.updateSession(sessionId, updates)

    res.status(200).json({
      success: true,
      session: updatedSession,
      message: 'Session updated successfully'
    })
  } catch (error) {
    console.error('Failed to update session:', error)
    res.status(500).json({
      error: 'Failed to update chat session',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleDeleteSession(
  chatService: any,
  sessionId: string,
  res: NextApiResponse
) {
  try {
    // Verify session exists
    const existingSession = await chatService.getSession(sessionId)
    if (!existingSession) {
      return res.status(404).json({ error: 'Chat session not found' })
    }

    await chatService.deleteSession(sessionId)

    res.status(200).json({
      success: true,
      message: 'Session deleted successfully'
    })
  } catch (error) {
    console.error('Failed to delete session:', error)
    res.status(500).json({
      error: 'Failed to delete chat session',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
