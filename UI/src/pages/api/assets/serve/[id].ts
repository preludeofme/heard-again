import { logger } from '@/lib/logger'
import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getStorageService } from '@/lib/storage/storage-service'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'
import { errorResponse } from '@/lib/api-helpers'
import { withRateLimit } from '@/lib/security/rate-limiter'
import { withSecurityHeaders, getSecurityConfig } from '@/lib/security/security-headers'
import path from 'path'

export default withSecurityHeaders(withRateLimit('general', async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Asset ID is required' })
  }

  try {
    // CRITICAL: Validate authentication and tenant access
    const user = await getAuthUserWithFamilyspace(req, res)
    
    // Get asset from database with tenant validation
    const asset = await prisma.asset.findFirst({
      where: { 
        id,
        familyspaceId: user.familyspaceId // Enforce tenant isolation
      },
      select: {
        id: true,
        filename: true,
        originalName: true,
        mimeType: true,
        storagePath: true,
        storageType: true,
        sizeBytes: true,
        familyspaceId: true,
      }
    })

    if (!asset) {
      // Don't reveal whether asset exists or not - just return 404
      return res.status(404).json({ error: 'Asset not found' })
    }

    // Additional tenant verification
    if (asset.familyspaceId !== user.familyspaceId) {
      logger.error('Tenant isolation violation attempt:', {
        assetId: asset.id,
        assetFamilyspaceId: asset.familyspaceId,
        userFamilyspaceId: user.familyspaceId,
        userId: user.id
      })
      return res.status(404).json({ error: 'Asset not found' })
    }

    const storageService = getStorageService()
    
    // For local storage, serve the file directly
    if (storageService.getMode() === 'local') {
      const fs = require('fs')
      const uploadDir = process.env.UPLOAD_DIR || './uploads'
      const filePath = path.join(uploadDir, asset.storagePath || '')

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' })
      }

      const stats = fs.statSync(filePath)
      const totalSize = stats.size
      const mimeType = asset.mimeType || 'application/octet-stream'

      res.setHeader('Content-Type', mimeType)
      res.setHeader('Accept-Ranges', 'bytes')
      res.setHeader('Cache-Control', 'private, max-age=3600')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Security-Policy', "default-src 'none'")
      res.setHeader('Content-Disposition', `inline; filename="${asset.originalName}"`)

      const rangeHeader = req.headers.range
      if (rangeHeader) {
        const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-')
        const start = parseInt(startStr, 10)
        const end = endStr ? parseInt(endStr, 10) : totalSize - 1
        const chunkSize = end - start + 1

        res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`)
        res.setHeader('Content-Length', chunkSize)
        res.status(206)

        const fileStream = fs.createReadStream(filePath, { start, end })
        fileStream.pipe(res)
        return
      }

      res.setHeader('Content-Length', totalSize)

      logger.info('Asset served:', {
        assetId: asset.id,
        familyspaceId: asset.familyspaceId,
        userId: user.id,
        originalName: asset.originalName,
        mimeType,
        size: totalSize,
      })

      const fileStream = fs.createReadStream(filePath)
      fileStream.pipe(res)
      return
    }

    // For cloud storage, proxy the file content directly rather than issuing a 302
    // redirect to R2. A redirect would be blocked by the page-level CSP
    // (media-src 'self' blob:) because browsers check media-src against the
    // final redirect destination, not the same-origin API route URL.
    const mimeType = asset.mimeType || 'application/octet-stream'
    const fileBuffer = await storageService.getFile(asset.storagePath || '')
    const totalSize = fileBuffer.length

    res.setHeader('Content-Type', mimeType)
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Disposition', `inline; filename="${asset.originalName || asset.filename}"`)

    logger.info('Asset served:', {
      assetId: asset.id,
      familyspaceId: asset.familyspaceId,
      userId: user.id,
      originalName: asset.originalName,
      mimeType,
      size: totalSize,
    })

    const rangeHeader = req.headers.range
    if (rangeHeader) {
      const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-')
      const start = parseInt(startStr, 10)
      const end = endStr ? parseInt(endStr, 10) : totalSize - 1
      const chunkSize = end - start + 1

      res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`)
      res.setHeader('Content-Length', chunkSize)
      res.writeHead(206)
      res.end(fileBuffer.subarray(start, end + 1))
      return
    }

    res.setHeader('Content-Length', totalSize)
    res.status(200).end(fileBuffer)
    
  } catch (error) {
    logger.error('File serving error:', error)
    return errorResponse(res, 'Failed to serve file', 500)
  }
}))
