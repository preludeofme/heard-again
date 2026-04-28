import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { TTS_SERVICE_URL } from '@/lib/tts-client'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

const TTS_SERVICE_TOKEN = process.env.TTS_SERVICE_TOKEN

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Add authentication and familyspace context
    const user = await getAuthUserWithFamilyspace(req, res)
    
    // Require VIEWER role for audio access (lowest privilege)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'VIEWER')

    const { id } = req.query
    const inputId = id as string

    if (!inputId) {
      return res.status(400).json({ error: 'Audio ID required' })
    }

    let audioId = inputId

    // 1. Try to find an asset by ID first (if the caller passed the Prisma Asset ID)
    let audioAsset = await prisma.asset.findFirst({
      where: {
        id: inputId,
        familyspaceId: user.familyspaceId,
        assetType: { in: ['GENERATED_AUDIO', 'AUDIO'] },
      },
      select: {
        id: true,
        metadata: true,
      }
    })

    if (audioAsset) {
      // If we found an asset, the real TTS ID is in the metadata
      const metadata = audioAsset.metadata as any
      if (metadata && typeof metadata === 'object' && metadata.ttsAudioId) {
        audioId = metadata.ttsAudioId
      }
    } else {
      // 2. If no asset found by ID, maybe the caller passed the ttsAudioId directly
      // Verify this ttsAudioId belongs to an asset in the user's familyspace
      audioAsset = await prisma.asset.findFirst({
        where: {
          familyspaceId: user.familyspaceId,
          assetType: { in: ['GENERATED_AUDIO', 'AUDIO'] },
          metadata: {
            path: ['ttsAudioId'],
            equals: inputId
          }
        },
        select: {
          id: true,
          metadata: true
        }
      })
      
      if (!audioAsset) {
        // Fallback: check if it's a direct file ID from TTS service that we haven't mapped yet
        // but only if the user is an EDITOR+ (security safeguard)
        try {
          await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')
        } catch (err) {
          return res.status(404).json({ error: 'Audio not found' })
        }
      }
    }

    // Proxy to TTS service using Service-to-Service authentication
    // This is more reliable than passing the user's session token
    const response = await fetch(`${TTS_SERVICE_URL}/api/tts/audio/${audioId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TTS_SERVICE_TOKEN}`,
        'X-Familyspace-Id': user.familyspaceId,
      },
    })

    if (!response.ok) {
      // Log security-relevant failures
      logger.error('[AUDIO_PROXY] TTS service error:', {
        status: response.status,
        audioId,
        familyspaceId: user.familyspaceId,
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
