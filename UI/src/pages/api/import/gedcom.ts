import { logger } from '@/lib/logger'
import fs from 'fs/promises'
import path from 'path'
import formidable from 'formidable'
import type { NextApiRequest, NextApiResponse } from 'next'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, apiHandler } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { validateFileContent, generateSecureFilename } from '@/lib/security/file-validator'
import { getStorageService } from '@/lib/storage/storage-service'
import { gedcomImportTask } from '@/trigger/gedcom-import-task'

export const config = {
  api: {
    bodyParser: false,
  },
}

const ALLOWED_GEDCOM_MIME_TYPES = [
  'text/plain',
  'application/octet-stream',
] as const

function storageTypeFromMode(mode: string): 'LOCAL' | 'S3' | 'CLOUDFLARE_R2' | 'GOOGLE_CLOUD' {
  switch (mode) {
    case 'r2': return 'CLOUDFLARE_R2'
    case 's3': return 'S3'
    case 'gcs':
    case 'gcp': return 'GOOGLE_CLOUD'
    default: return 'LOCAL'
  }
}

async function importGedcom(req: NextApiRequest, res: NextApiResponse) {
  const user = await getAuthUserWithFamilyspace(req, res)
  await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

  // JSON body: committing a file already uploaded during the preview step
  const contentType = req.headers['content-type']
  if (contentType?.includes('application/json')) {
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(chunk as Buffer)
    }
    const body = JSON.parse(Buffer.concat(chunks).toString()) as {
      assetId?: string
      options?: {
        linkToPersonId?: string
        gedcomXrefForLink?: string
        motherXref?: string
        fatherXref?: string
      }
    }

    const { assetId, options } = body
    if (!assetId) return errorResponse(res, 'Asset ID required', 400)

    const asset = await prisma.asset.findUnique({
      where: { id: assetId, familyspaceId: user.familyspaceId },
    })
    if (!asset) return errorResponse(res, 'Asset not found', 404)

    const importJob = await prisma.importJob.create({
      data: {
        familyspaceId: user.familyspaceId,
        sourceType: 'GEDCOM',
        sourceAssetId: asset.id,
        status: 'PENDING',
        importedById: user.id,
      },
    })

    const run = await gedcomImportTask.trigger(
      {
        familyspaceId: user.familyspaceId,
        userId: user.id,
        storagePath: asset.storagePath,
        assetId: asset.id,
        jobId: importJob.id,
        options,
      },
      { idempotencyKey: `gedcom-import:${importJob.id}` }
    )

    await prisma.importJob.update({
      where: { id: importJob.id },
      data: { triggerRunId: run.id },
    })

    return successResponse(res, { jobId: importJob.id, runId: run.id, status: 'PENDING' })
  }

  // Multipart: fresh upload + immediate import trigger
  const tmpDir = path.join('/tmp', 'heard-again-gedcom-tmp')
  await fs.mkdir(tmpDir, { recursive: true })

  const form = formidable({
    keepExtensions: false,
    maxFileSize: 100 * 1024 * 1024,
    uploadDir: tmpDir,
    filename: () => `${uuidv4()}.tmp`,
  })

  const [, files] = await form.parse(req)
  const fileArray = files.file

  if (!fileArray || fileArray.length === 0) {
    return errorResponse(res, 'No GEDCOM file provided', 400)
  }

  const file = fileArray[0]

  const fileBuffer = await fs.readFile(file.filepath)
  await fs.unlink(file.filepath).catch(() => {})

  const validationResult = await validateFileContent(
    fileBuffer,
    file.originalFilename || 'gedcom.ged',
    file.mimetype || undefined
  )

  if (!validationResult.isValid) {
    return errorResponse(res, validationResult.error || 'Validation failed', 400)
  }

  if (!ALLOWED_GEDCOM_MIME_TYPES.includes(validationResult.detectedType! as 'text/plain' | 'application/octet-stream')) {
    return errorResponse(res, `File type '${validationResult.detectedType}' not allowed`, 400)
  }

  const secureFilename = generateSecureFilename(
    file.originalFilename || 'gedcom.ged',
    'text/plain'
  ).replace(/\.[^.]+$/, '.ged')

  const storageService = getStorageService()
  const uploadResult = await storageService.uploadFile(
    fileBuffer,
    secureFilename,
    'text/plain',
    { folder: `familyspace-${user.familyspaceId}/gedcom` }
  )

  const [asset, importJob] = await prisma.$transaction(async (tx) => {
    const createdAsset = await tx.asset.create({
      data: {
        familyspaceId: user.familyspaceId,
        filename: uploadResult.filename,
        originalName: file.originalFilename || 'import.ged',
        mimeType: 'text/plain',
        sizeBytes: BigInt(uploadResult.sizeBytes),
        storageType: storageTypeFromMode(storageService.getMode()) as any,
        storagePath: uploadResult.storagePath,
        assetType: 'DOCUMENT',
        processingStatus: 'PENDING',
        uploadedById: user.id,
        metadata: {
          importType: 'GEDCOM',
          secureFilename,
        },
      },
    })

    const createdJob = await tx.importJob.create({
      data: {
        familyspaceId: user.familyspaceId,
        sourceType: 'GEDCOM',
        sourceAssetId: createdAsset.id,
        status: 'PENDING',
        importedById: user.id,
      },
    })

    return [createdAsset, createdJob]
  })

  const run = await gedcomImportTask.trigger(
    {
      familyspaceId: user.familyspaceId,
      userId: user.id,
      storagePath: asset.storagePath,
      assetId: asset.id,
      jobId: importJob.id,
    },
    { idempotencyKey: `gedcom-import:${importJob.id}` }
  )

  await prisma.importJob.update({
    where: { id: importJob.id },
    data: { triggerRunId: run.id },
  })

  logger.info(`Triggered Trigger.dev GEDCOM import job ${importJob.id} run ${run.id}`)

  return successResponse(
    res,
    {
      jobId: importJob.id,
      status: importJob.status,
      sourceAssetId: asset.id,
      fileName: asset.originalName,
    },
    202
  )
}

export default apiHandler({
  POST: importGedcom
})
