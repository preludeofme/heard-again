import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { TTS_SERVICE_URL } from '@/lib/tts-client'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '@/lib/prisma'

const TTS_SERVICE_TOKEN = process.env.TTS_SERVICE_TOKEN

// Lazy S3/R2 client (init only when needed for cloud storage fetch)
let _s3Client: S3Client | null = null
function getS3Client(): S3Client | null {
  if (_s3Client) return _s3Client
  const endpoint = process.env.R2_ENDPOINT ?? process.env.S3_ENDPOINT
  const accessKey = process.env.R2_ACCESS_KEY_ID ?? process.env.S3_ACCESS_KEY
  const secretKey = process.env.R2_SECRET_ACCESS_KEY ?? process.env.S3_SECRET_KEY
  const bucket = process.env.R2_BUCKET_NAME ?? process.env.R2_BUCKET ?? process.env.S3_BUCKET
  if (!endpoint || !accessKey || !secretKey || !bucket) {
    return null
  }
  _s3Client = new S3Client({
    region: process.env.R2_REGION ?? 'auto',
    endpoint,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true,
  })
  return _s3Client
}

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
        storagePath: true,
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
          metadata: true,
          storagePath: true,
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

    // When the asset has a storage path (from R2/cloud storage), serve from there directly
    if (audioAsset && audioAsset.storagePath) {
      const s3 = getS3Client()
      if (s3) {
        try {
          const bucket = process.env.R2_BUCKET_NAME ?? process.env.R2_BUCKET ?? process.env.S3_BUCKET ?? ''
          const command = new GetObjectCommand({ Bucket: bucket, Key: audioAsset.storagePath })
          const response = await s3.send(command)

          if (response.Body) {
            const chunks: any[] = []
            for await (const chunk of response.Body as any) {
              chunks.push(chunk)
            }
            const buffer = Buffer.concat(chunks)

            res.setHeader('Content-Type', response.ContentType ?? 'audio/wav')
            res.setHeader('Content-Length', buffer.length)
            res.setHeader('Cache-Control', 'private, max-age=3600')
            res.setHeader('X-Content-Type-Options', 'nosniff')

            return res.send(buffer)
          }
        } catch (storageErr) {
          logger.warn('[AUDIO_PROXY] Cloud storage fetch failed, falling back to TTS proxy:', storageErr)
        }
      }
    }

    // Fallback: proxy to TTS service
    const response = await fetch(`${TTS_SERVICE_URL}/api/tts/audio/${audioId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TTS_SERVICE_TOKEN}`,
        'X-Familyspace-Id': user.familyspaceId,
      },
    })

    if (!response.ok) {
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

    const contentType = response.headers.get('content-type') || 'audio/wav'

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', buffer.length)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.setHeader('X-Content-Type-Options', 'nosniff')

    return res.send(buffer)

  } catch (error: any) {
    logger.error('[AUDIO_PROXY] Error:', error)
    
    if (error.statusCode === 401 || error.statusCode === 403) {
      return res.status(error.statusCode).json({ 
        error: error.message || 'Access denied' 
      })
    }
    
    return res.status(503).json({ error: 'Audio service unavailable' })
  }
}
