import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getStorageService } from '@/lib/storage/storage-service'
import path from 'path'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Asset ID is required' })
  }

  try {
    // Get asset from database
    const asset = await prisma.asset.findUnique({
      where: { id },
      select: {
        id: true,
        filename: true,
        originalName: true,
        mimeType: true,
        storagePath: true,
        storageType: true,
        sizeBytes: true,
      }
    })

    if (!asset) {
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
      
      // Set appropriate headers
      res.setHeader('Content-Type', asset.mimeType || 'application/octet-stream')
      res.setHeader('Content-Length', stats.size)
      res.setHeader('Cache-Control', 'public, max-age=31536000') // 1 year cache
      res.setHeader('Content-Disposition', `inline; filename="${asset.originalName}"`)
      
      // Stream the file
      const fileStream = fs.createReadStream(filePath)
      fileStream.pipe(res)
      
      return
    }

    // For cloud storage, redirect to the public URL
    const publicUrl = await storageService.getPublicUrl(asset.storagePath || '')
    
    // Set cache headers before redirect
    res.setHeader('Cache-Control', 'public, max-age=31536000')
    res.redirect(302, publicUrl)
    
  } catch (error) {
    console.error('File serving error:', error)
    res.status(500).json({ error: 'Failed to serve file' })
  }
}
