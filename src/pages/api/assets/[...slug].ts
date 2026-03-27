import { NextApiRequest, NextApiResponse } from 'next'
import { getStorageService } from '@/lib/storage/storage-service'
import path from 'path'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slug } = req.query
  const storagePath = Array.isArray(slug) ? slug.join('/') : slug

  if (!storagePath) {
    return res.status(400).json({ error: 'File path is required' })
  }

  try {
    const storageService = getStorageService()
    
    // For local storage, serve the file directly
    if (storageService.getMode() === 'local') {
      const fs = require('fs')
      const uploadDir = process.env.UPLOAD_DIR || './uploads'
      const filePath = path.join(uploadDir, storagePath)
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' })
      }

      // Get file stats
      const stats = fs.statSync(filePath)
      
      // Set appropriate headers
      res.setHeader('Content-Type', getContentType(path.extname(filePath)))
      res.setHeader('Content-Length', stats.size)
      res.setHeader('Cache-Control', 'public, max-age=31536000') // 1 year cache
      
      // Stream the file
      const fileStream = fs.createReadStream(filePath)
      fileStream.pipe(res)
      
      return
    }

    // For cloud storage, redirect to the public URL
    const publicUrl = await storageService.getPublicUrl(storagePath)
    res.redirect(302, publicUrl)
    
  } catch (error) {
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
