import { logger } from '@/lib/logger'
import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getStorageService } from '@/lib/storage/storage-service'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'
import path from 'path'
import fs from 'fs'

const PREVIEWABLE_MIME_TYPES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Asset ID is required' })
  }

  try {
    const user = await getAuthUserWithFamilyspace(req, res)

    const asset = await prisma.asset.findFirst({
      where: { id, familyspaceId: user.familyspaceId },
      select: {
        id: true,
        filename: true,
        originalName: true,
        mimeType: true,
        storagePath: true,
        storageType: true,
        familyspaceId: true,
      },
    })

    if (!asset) return res.status(404).json({ error: 'Asset not found' })

    if (!PREVIEWABLE_MIME_TYPES.has(asset.mimeType)) {
      return res.status(415).json({ error: 'Preview not supported for this file type' })
    }

    // Read file buffer
    let buffer: Buffer
    const storageService = getStorageService()

    if (storageService.getMode() === 'local') {
      const uploadDir = process.env.UPLOAD_DIR || './uploads'
      const filePath = path.join(uploadDir, asset.storagePath || '')
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found on disk' })
      }
      buffer = fs.readFileSync(filePath)
    } else {
      // Cloud: fetch from signed URL
      const publicUrl = await storageService.getPublicUrl(asset.storagePath || '')
      const response = await fetch(publicUrl, { signal: AbortSignal.timeout(30000) })
      if (!response.ok) throw new Error(`Storage fetch failed: ${response.status}`)
      buffer = Buffer.from(await response.arrayBuffer())
    }

    // .docx → rich HTML via mammoth; .doc (binary) → plain text via word-extractor
    const isDocx = asset.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    let bodyHtml: string

    if (isDocx) {
      const mammoth = await import('mammoth')
      const result = await mammoth.convertToHtml({ buffer })
      const warnings = result.messages.filter(m => m.type === 'warning')
      if (warnings.length > 0) {
        logger.warn({ name: asset.originalName, warnings: warnings.map(w => w.message) }, 'mammoth warnings')
      }
      bodyHtml = result.value
    } else {
      // Old binary .doc — word-extractor gives us plain text
      try {
        const WordExtractor = (await import('word-extractor')).default
        const extractor = new WordExtractor()
        const doc = await extractor.extract(buffer)
        const text = doc.getBody() || ''
        // Preserve paragraph breaks; escape HTML entities
        const escaped = text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
        bodyHtml = escaped
          .split(/\r?\n\r?\n+/)
          .filter((p: string) => p.trim())
          .map((p: string) => `<p>${p.replace(/\r?\n/g, '<br/>')}</p>`)
          .join('\n')
      } catch (docErr) {
        logger.warn({ name: asset.originalName, error: docErr }, 'word-extractor failed')
        // Graceful fallback — show download prompt inside the iframe
        bodyHtml = `<div style="text-align:center;padding:40px">
          <p style="font-size:16px;color:#555">Preview is not available for this legacy .doc file.</p>
          <a href="/api/assets/serve/${id}" download="${asset.originalName}"
             style="display:inline-block;margin-top:16px;padding:10px 24px;background:#1976d2;color:#fff;border-radius:6px;text-decoration:none;font-size:14px">
            Download to view
          </a>
        </div>`
      }
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 14px;
      line-height: 1.7;
      color: #16334a;
      max-width: 800px;
      margin: 0 auto;
      padding: 32px 24px;
      background: #fff;
    }
    h1, h2, h3, h4, h5, h6 { font-family: Georgia, serif; color: #16334a; }
    p { margin: 0 0 1em; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
    td, th { border: 1px solid #ccc; padding: 6px 10px; }
    img { max-width: 100%; }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'private, max-age=300')
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; frame-ancestors 'self';")
    return res.status(200).send(html)

  } catch (error) {
    logger.error('Document preview error:', error)
    return res.status(500).json({ error: 'Failed to generate preview' })
  }
}
