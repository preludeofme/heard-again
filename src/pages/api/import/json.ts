import fs from 'fs/promises'
import path from 'path'
import formidable from 'formidable'
import type { NextApiRequest, NextApiResponse } from 'next'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'

export const config = {
  api: {
    bodyParser: false,
  },
}

const IMPORT_DIR = path.join(process.cwd(), 'imports')

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return errorResponse(res, 'Method not allowed', 405)
  }

  try {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const workspaceDir = path.join(IMPORT_DIR, user.workspaceId, 'json')
    await fs.mkdir(workspaceDir, { recursive: true })

    const form = formidable({
      uploadDir: workspaceDir,
      keepExtensions: true,
      maxFileSize: 100 * 1024 * 1024,
      filename: (_name, ext) => `${uuidv4()}${ext || '.json'}`,
    })

    const [, files] = await form.parse(req)
    const fileArray = files.file

    if (!fileArray || fileArray.length === 0) {
      return errorResponse(res, 'No JSON file provided', 400)
    }

    const file = fileArray[0]
    const content = await fs.readFile(file.filepath, 'utf-8')

    let parsed: any = null
    try {
      parsed = JSON.parse(content)
    } catch {
      return errorResponse(res, 'Invalid JSON file', 400)
    }

    const peopleCount = Array.isArray(parsed?.data?.people) ? parsed.data.people.length : 0
    const storiesCount = Array.isArray(parsed?.data?.stories) ? parsed.data.stories.length : 0
    const assetsCount = Array.isArray(parsed?.data?.assets) ? parsed.data.assets.length : 0
    const relativePath = path.relative(process.cwd(), file.filepath)

    const [asset, importJob] = await prisma.$transaction(async (tx) => {
      const createdAsset = await tx.asset.create({
        data: {
          workspaceId: user.workspaceId,
          filename: path.basename(file.filepath),
          originalName: file.originalFilename || 'backup.json',
          mimeType: file.mimetype || 'application/json',
          sizeBytes: BigInt(file.size),
          storageType: 'LOCAL',
          storagePath: relativePath,
          assetType: 'DOCUMENT',
          processingStatus: 'COMPLETED',
          uploadedById: user.id,
          metadata: {
            importType: 'JSON',
          },
        },
      })

      const createdJob = await tx.importJob.create({
        data: {
          workspaceId: user.workspaceId,
          sourceType: 'JSON',
          sourceAssetId: createdAsset.id,
          status: 'COMPLETED',
          importedById: user.id,
          startedAt: new Date(),
          completedAt: new Date(),
          resultSummary: {
            importedPeopleEstimate: peopleCount,
            importedStoriesEstimate: storiesCount,
            importedAssetsEstimate: assetsCount,
          },
        },
      })

      return [createdAsset, createdJob]
    })

    return successResponse(res, {
      jobId: importJob.id,
      status: importJob.status,
      sourceType: importJob.sourceType,
      sourceAssetId: asset.id,
      fileName: asset.originalName,
      resultSummary: importJob.resultSummary,
    }, 201)
  } catch (error: any) {
    return errorResponse(res, error.message || 'JSON import failed', error.statusCode || 500)
  }
}
