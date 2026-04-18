import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { TTS_SERVICE_URL } from '@/lib/tts-client'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Add authentication and workspace context
    const user = await getAuthUserWithWorkspace(req, res)
    
    // Require VIEWER role for audio access (lowest privilege)
    await requireWorkspaceRole(user.id, user.workspaceId, 'VIEWER')

    const { id } = req.query
    const audioId = id as string

    if (!audioId) {
      return res.status(400).json({ error: 'Audio ID required' })
    }

    // Get session token for TTS service auth
    const sessionToken = req.cookies['next-auth.session-token']
    if (!sessionToken) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    // Verify audio asset belongs to user's workspace
    // The audioId is the TTS service audio ID, stored in asset metadata
    const audioAsset = await prisma.asset.findFirst({
      where: {
        workspaceId: user.workspaceId,
        assetType: 'GENERATED_AUDIO',
        metadata: {
          path: ['ttsAudioId'],
          equals: audioId
        }
      },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        createdAt: true,
        storagePath: true
      }
    })

    if (!audioAsset) {
      return res.status(404).json({ error: 'Audio not found' })
    }

    // Proxy to TTS service with authentication
    const response = await fetch(`${TTS_SERVICE_URL}/api/tts/audio/${audioId}`, {
      method: 'GET',
      headers: {
        // Pass session token for TTS service auth
        'Authorization': `Bearer ${sessionToken}`,
        'X-Workspace-ID': user.workspaceId,
        'X-User-ID': user.id,
      },
    })

    if (!response.ok) {
      // Log security-relevant failures
      logger.error('[AUDIO_PROXY] TTS service error:', {
        status: response.status,
        audioId,
        workspaceId: user.workspaceId,
        userId: user.id
      })
      
      if (response.status === 404) {
        return res.status(404).json({ error: 'Audio file not found' })
      }
      
      return res.status(503).json({ error: 'TTS service unavailable' })
    }

    // Get content type from TTS service
    const contentType = response.headers.get('content-type') || 'audio/wav'
    
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Secure response headers
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', buffer.length)
    res.setHeader('Cache-Control', 'private, max-age=3600') // Private cache
    res.setHeader('X-Content-Type-Options', 'nosniff')
    
    return res.send(buffer)

  } catch (error: any) {
    logger.error('[AUDIO_PROXY] Error:', error)
    
    // Handle authorization errors specifically
    if (error.statusCode === 401 || error.statusCode === 403) {
      return res.status(error.statusCode).json({ 
        error: error.message || 'Access denied' 
      })
    }
    
    return res.status(503).json({ error: 'Audio service unavailable' })
  }
}
