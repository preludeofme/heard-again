import { prisma } from '@/lib/prisma'
import { getStorageService } from './storage-service'
import { logger } from '@/lib/logger'

interface UrlRequest {
  assetId: string
  familyspaceId: string
  userId: string
  ipAddress: string
  userAgent: string
}

interface SignedUrlResponse {
  url: string
  expiresAt: Date
  requestId: string
}

export async function generateSecureAssetUrl(
  request: UrlRequest
): Promise<SignedUrlResponse | null> {
  // Verify asset belongs to familyspace
  const asset = await prisma.asset.findFirst({
    where: {
      id: request.assetId,
      familyspaceId: request.familyspaceId,
    },
  })
  
  if (!asset) {
    logger.warn({
      assetId: request.assetId,
      familyspaceId: request.familyspaceId,
      userId: request.userId,
      ipAddress: request.ipAddress,
    }, 'Attempted access to non-existent or unauthorized asset')
    return null
  }
  
  const storage = getStorageService()
  const requestId = crypto.randomUUID()
  
  // Generate signed URL
  const signedUrl = await storage.getProvider().getSignedUrl?.(
    asset.storagePath || '',
    3600 // 1 hour expiration
  )
  
  if (!signedUrl) {
    // Fallback to public URL if signed URL not supported
    const publicUrl = await storage.getPublicUrl(asset.storagePath || '')
    return { 
      url: publicUrl, 
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      requestId 
    }
  }
  
  // Log access for audit
  logger.info({
    audit: true,
    action: 'asset.access',
    assetId: request.assetId,
    familyspaceId: request.familyspaceId,
    userId: request.userId,
    requestId,
    ipAddress: request.ipAddress,
  }, 'Asset access granted')
  
  return { 
    url: signedUrl, 
    expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
    requestId 
  }
}
