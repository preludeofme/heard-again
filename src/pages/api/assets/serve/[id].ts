import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getStorageService } from '@/lib/storage/storage-service'
import { getAuthUserWithWorkspace } from '@/lib/auth-helpers'
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
    const user = await getAuthUserWithWorkspace(req, res)
    
    // Get asset from database with tenant validation
    const asset = await prisma.asset.findFirst({
      where: { 
        id,
        workspaceId: user.workspaceId // Enforce tenant isolation
      },
      select: {
        id: true,
        filename: true,
        originalName: true,
        mimeType: true,
        storagePath: true,
        storageType: true,
        sizeBytes: true,
        workspaceId: true,
      }
    })

    if (!asset) {
      // Don't reveal whether asset exists or not - just return 404
      return res.status(404).json({ error: 'Asset not found' })
    }

    // Additional tenant verification
    if (asset.workspaceId !== user.workspaceId) {
      console.error('Tenant isolation violation attempt:', {
        assetId: asset.id,
        assetWorkspaceId: asset.workspaceId,
        userWorkspaceId: user.workspaceId,
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
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' })
      }

      // Get file stats
      const stats = fs.statSync(filePath)
      
      // Set security headers
      res.setHeader('Content-Type', asset.mimeType || 'application/octet-stream')
      res.setHeader('Content-Length', stats.size)
      res.setHeader('Cache-Control', 'private, max-age=3600') // Reduced cache time for security
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Security-Policy', "default-src 'none'")
      res.setHeader('Content-Disposition', `inline; filename="${asset.originalName}"`)
      
      // Log access for audit
      console.log('Asset served:', {
        assetId: asset.id,
        workspaceId: asset.workspaceId,
        userId: user.id,
        originalName: asset.originalName,
        mimeType: asset.mimeType,
        size: stats.size
      })
      
      // Stream the file
      const fileStream = fs.createReadStream(filePath)
      fileStream.pipe(res)
      
      return
    }

    // For cloud storage, redirect to the signed URL
    const publicUrl = await storageService.getPublicUrl(asset.storagePath || '')
    
    // Set cache headers before redirect
    res.setHeader('Cache-Control', 'private, max-age=3600')
    
    // Log access for audit
    console.log('Asset redirect:', {
      assetId: asset.id,
      workspaceId: asset.workspaceId,
      userId: user.id,
      originalName: asset.originalName,
      publicUrl: publicUrl.replace(/\/[^\/]+$/, '/***') // Redact sensitive parts
    })
    
    res.redirect(302, publicUrl)
    
  } catch (error) {
    console.error('File serving error:', error)
    return errorResponse(res, 'Failed to serve file', 500)
  }
}))
