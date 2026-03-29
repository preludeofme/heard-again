import { NextApiRequest, NextApiResponse } from 'next'
import { getStorageService } from '@/lib/storage/storage-service'
import { getAuthUserWithWorkspace } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import path from 'path'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { slug } = req.query
  const storagePath = Array.isArray(slug) ? slug.join('/') : slug

  if (!storagePath) {
    return res.status(400).json({ error: 'File path is required' })
  }

  try {
    // Authenticate user and get workspace
    const user = await getAuthUserWithWorkspace(req, res)
    
    // Look up asset by storagePath and verify workspace ownership
    const asset = await prisma.asset.findFirst({
      where: { 
        storagePath: storagePath,
        workspaceId: user.workspaceId 
      },
      select: { id: true, mimeType: true }
    })

    if (!asset) {
      // Return 404 to prevent information leakage about file existence
      return res.status(404).json({ error: 'File not found' })
    }

    const storageService = getStorageService()
    
    // For local storage, serve the file directly
    if (storageService.getMode() === 'local') {
      const fs = require('fs')
      const uploadDir = process.env.UPLOAD_DIR || './uploads'
      const filePath = path.join(uploadDir, storagePath)
      
      // Additional path traversal check
      const resolvedPath = path.resolve(filePath)
      const resolvedUploadDir = path.resolve(uploadDir)
      if (!resolvedPath.startsWith(resolvedUploadDir)) {
        return res.status(403).json({ error: 'Access denied' })
      }
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' })
      }

      // Get file stats
      const stats = fs.statSync(filePath)
      
      // Set appropriate headers - use stored mime type if available
      res.setHeader('Content-Type', asset.mimeType || getContentType(path.extname(filePath)))
      res.setHeader('Content-Length', stats.size)
      res.setHeader('Cache-Control', 'private, max-age=3600') // 1 hour cache for private content
      
      // Stream the file
      const fileStream = fs.createReadStream(filePath)
      fileStream.pipe(res)
      
      return
    }

    // For cloud storage, redirect to the public URL
    const publicUrl = await storageService.getPublicUrl(storagePath)
    res.redirect(302, publicUrl)
    
  } catch (error: any) {
    // Handle authentication errors
    if (error.statusCode === 401) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    if (error.statusCode === 404) {
      return res.status(404).json({ error: 'File not found' })
    }
    
    console.error('File serving error:', error)
    res.status(500).json({ error: 'Failed to serve file' })
  }
}

function getContentType(extension: string): string {
  const mimeTypes: { [key: string]: string } = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.txt': 'text/plain',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  }
  
  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream'
}
