import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace } from '@/lib/auth-helpers'
import path from 'path'
import fs from 'fs'
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return errorResponse(res, 'Method not allowed', 405)
  }

  try {
    const user = await getAuthUserWithWorkspace(req, res)
    const assetId = req.query.id as string

    const asset = await prisma.asset.findFirst({
      where: { id: assetId, workspaceId: user.workspaceId },
    })

    if (!asset) {
      return errorResponse(res, 'Asset not found', 404)
    }

    const filePath = path.join(process.cwd(), asset.storagePath)

    if (!fs.existsSync(filePath)) {
      return errorResponse(res, 'File not found on disk', 404)
    }

    const stat = fs.statSync(filePath)
    res.setHeader('Content-Type', asset.mimeType)
    res.setHeader('Content-Length', stat.size)
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(asset.originalName)}"`
    )

    const stream = fs.createReadStream(filePath)
    stream.pipe(res)
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(res, error.message, error.statusCode)
    }
    return errorResponse(res, 'Download failed', 500)
  }
}
