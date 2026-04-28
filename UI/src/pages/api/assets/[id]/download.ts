import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'
import { withRateLimit } from '@/lib/security/rate-limiter'
import { withSecurityHeaders } from '@/lib/security/security-headers'
import { logger } from '@/lib/logger'
import path from 'path'
import fs from 'fs'
import type { NextApiRequest, NextApiResponse } from 'next'

const STORAGE_ROOT = path.resolve(process.cwd())
const INLINE_MIME_PREFIXES = ['audio/', 'image/', 'video/']

function isMediaMimeType(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false
  return INLINE_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))
}

function sanitizeFilename(name: string): string {
  let cleaned = ''
  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i)
    // Skip control chars (0-31), DEL (127), double-quote, and backslash.
    if (code < 32 || code === 127 || code === 34 || code === 92) continue
    cleaned += name[i]
  }
  cleaned = cleaned.replace(/\s+/g, ' ').trim().slice(0, 200)
  return cleaned || 'download'
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', ['GET', 'HEAD'])
    return errorResponse(res, 'Method not allowed', 405)
  }

  try {
    const user = await getAuthUserWithFamilyspace(req, res)
    const assetId = req.query.id as string

    if (!assetId || typeof assetId !== 'string') {
      return errorResponse(res, 'Asset ID is required', 400)
    }

    const asset = await prisma.asset.findFirst({
      where: { id: assetId, familyspaceId: user.familyspaceId },
      select: {
        id: true,
        familyspaceId: true,
        mimeType: true,
        originalName: true,
        storagePath: true,
        storageType: true,
      },
    })

    if (!asset) {
      return errorResponse(res, 'Asset not found', 404)
    }

    // Defense-in-depth: the familyspace filter above already enforces tenant isolation,
    // but log+reject any row that somehow leaks across familyspaces.
    if (asset.familyspaceId !== user.familyspaceId) {
      logger.error('Tenant isolation violation attempt on asset download', {
        assetId: asset.id,
        assetFamilyspaceId: asset.familyspaceId,
        userFamilyspaceId: user.familyspaceId,
        userId: user.id,
      })
      return errorResponse(res, 'Asset not found', 404)
    }

    if (asset.storageType !== 'LOCAL') {
      // Non-local storage (S3/R2) is served by /api/assets/serve/[id]; this endpoint is local-only.
      logger.warn('Download endpoint hit for non-local asset', {
        assetId: asset.id,
        storageType: asset.storageType,
      })
      return errorResponse(res, 'Asset not found', 404)
    }

    if (!asset.storagePath) {
      return errorResponse(res, 'Asset not found', 404)
    }

    // Path traversal protection: resolve and confirm the file lives inside STORAGE_ROOT.
    const resolved = path.resolve(STORAGE_ROOT, asset.storagePath)
    if (resolved !== STORAGE_ROOT && !resolved.startsWith(STORAGE_ROOT + path.sep)) {
      logger.error('Path traversal attempt on asset download', {
        assetId: asset.id,
        userId: user.id,
        storagePath: asset.storagePath,
      })
      return errorResponse(res, 'Asset not found', 404)
    }

    let stat: fs.Stats
    try {
      stat = fs.statSync(resolved)
    } catch {
      return errorResponse(res, 'Asset not found', 404)
    }
    if (!stat.isFile()) {
      return errorResponse(res, 'Asset not found', 404)
    }

    const filename = sanitizeFilename(asset.originalName || asset.id)
    const disposition = isMediaMimeType(asset.mimeType) ? 'inline' : 'attachment'

    res.setHeader('Content-Type', asset.mimeType || 'application/octet-stream')
    res.setHeader('Content-Length', stat.size)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`)
    res.setHeader('Content-Security-Policy', "default-src 'none'")

    logger.info('Asset download served', {
      assetId: asset.id,
      familyspaceId: asset.familyspaceId,
      userId: user.id,
      mimeType: asset.mimeType,
      sizeBytes: stat.size,
      disposition,
    })

    if (req.method === 'HEAD') {
      res.status(200).end()
      return
    }

    const stream = fs.createReadStream(resolved)
    stream.on('error', (err) => {
      logger.error('Asset stream error', { assetId: asset.id, err })
      if (!res.headersSent) {
        res.status(500).end()
      } else {
        res.destroy(err)
      }
    })
    stream.pipe(res)
  } catch (error) {
    const err = error as { statusCode?: number; message?: string }
    if (err.statusCode) {
      return errorResponse(res, err.message || 'Download failed', err.statusCode)
    }
    logger.error('Asset download failure', { error })
    return errorResponse(res, 'Download failed', 500)
  }
}

export default withSecurityHeaders(withRateLimit('general', handler))
