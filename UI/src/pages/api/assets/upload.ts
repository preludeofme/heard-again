import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { getStorageService } from '@/lib/storage/storage-service'
import { FileOptimizer } from '@/lib/file-optimizer'
import { validateFileContent, generateSecureFilename } from '@/lib/security/file-validator'
import { scanAndQuarantineFile } from '@/lib/security/malware-scanner'
import { rateLimitCheck } from '@/lib/redis-client'
import { logger } from '@/lib/logger'
import { withCSRFProtection } from '@/lib/security/csrf'
import formidable from 'formidable'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import type { NextApiRequest, NextApiResponse } from 'next'

// Disable Next.js body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
}

async function uploadHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return errorResponse(res, 'Method not allowed', 405)
  }

  let fileArray: formidable.File[] | undefined = undefined
  let tempDir: string | undefined = undefined
  let fields: formidable.Fields | undefined = undefined
  
  try {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const storageService = getStorageService()
    const storageMode = storageService.getMode()
    const fileOptimizer = new FileOptimizer()

    // Create secure temporary upload directory
    tempDir = path.join(process.cwd(), 'temp-uploads', user.workspaceId)
    await fs.promises.mkdir(tempDir, { recursive: true })

    const form = formidable({
      keepExtensions: false, // Don't trust original extensions - will be validated and renamed
      maxFileSize: 100 * 1024 * 1024, // 100MB
      uploadDir: tempDir, // Restrict to secure workspace directory
      filename: () => `${uuidv4()}.tmp`, // Use temporary extension
    })

    try {
      const [parsedFields, files] = await form.parse(req)
      fields = parsedFields
      fileArray = files.file

      if (!fileArray || fileArray.length === 0) {
        return errorResponse(res, 'No file provided', 400)
      }
    } catch (parseError: any) {
      return errorResponse(res, 'Failed to parse upload: ' + parseError.message, 400)
    }

    const file = fileArray[0]

    // Convert formidable file to buffer for optimization
    const fileBuffer = require('fs').readFileSync(file.filepath)
    const originalSize = fileBuffer.length

    // CRITICAL: Validate file content to prevent malicious uploads
    const validationResult = await validateFileContent(
      fileBuffer,
      file.originalFilename || 'unknown',
      file.mimetype || undefined
    )

    if (!validationResult.isValid) {
      console.error('File validation failed:', {
        filename: file.originalFilename,
        error: validationResult.error,
        securityRisk: validationResult.securityRisk,
        detectedType: validationResult.detectedType
      })
      
      // Clean up temporary file
      require('fs').unlinkSync(file.filepath)
      
      return errorResponse(
        res,
        validationResult.error || 'File validation failed',
        400
      )
    }

    // Generate secure filename to prevent path traversal and collisions
    const secureFilename = generateSecureFilename(
      file.originalFilename || 'unknown',
      validationResult.detectedType!
    )

    console.log(`File validated successfully:`, {
      originalName: file.originalFilename,
      secureFilename,
      detectedType: validationResult.detectedType,
      size: (originalSize / 1024 / 1024).toFixed(2) + 'MB'
    })

    // CRITICAL: Scan for malware
    console.log('Starting malware scan...')
    const { scanResult, quarantined } = await scanAndQuarantineFile(file.filepath)
    
    if (!scanResult.isClean) {
      console.error('Malware detected:', {
        filename: file.originalFilename,
        threats: scanResult.threats,
        quarantined,
        scanTime: scanResult.scanTime,
        engine: scanResult.engine
      })
      
      // Clean up temporary file if not already quarantined
      if (!quarantined) {
        require('fs').unlinkSync(file.filepath)
      }
      
      return errorResponse(
        res,
        `Malware detected: ${scanResult.threats.join(', ')}`,
        403
      )
    }
    
    console.log('Malware scan passed:', {
      filename: file.originalFilename,
      scanTime: scanResult.scanTime,
      engine: scanResult.engine
    })

    // Check if file can be optimized
    const canOptimize = fileOptimizer.canOptimize(validationResult.detectedType!)
    
    let optimizedBuffer = fileBuffer
    let optimizationResult = null

    if (canOptimize) {
      try {
        optimizationResult = await fileOptimizer.optimizeFile(
          optimizedBuffer,
          validationResult.detectedType!,
          secureFilename,
          {
            quality: 85, // Default quality
            maxWidth: 2048,
            maxHeight: 2048,
            maxFileSize: 50 * 1024 * 1024, // 50MB target
          }
        )
        optimizedBuffer = optimizationResult.optimizedFile
        
        console.log(`File optimization completed:`, {
          originalSize: (originalSize / 1024 / 1024).toFixed(2) + 'MB',
          optimizedSize: (optimizationResult.optimizedSize / 1024 / 1024).toFixed(2) + 'MB',
          compressionRatio: (1 - optimizationResult.compressionRatio).toFixed(2) + '% reduction',
          method: optimizationResult.optimizationMethod
        })
      } catch (error) {
        console.error('File optimization failed, using original:', error)
        // Continue with original file if optimization fails
      }
    }

    // Upload file using storage service
    const uploadResult = await storageService.uploadFile(
      optimizedBuffer,
      secureFilename,
      validationResult.detectedType!,
      {
        folder: `workspace-${user.workspaceId}`,
        metadata: {
          uploadedById: user.id,
          workspaceId: user.workspaceId,
          originalName: file.originalFilename || 'unknown',
          validatedType: validationResult.detectedType!,
          originalSize: originalSize.toString(),
          optimizedSize: optimizedBuffer.length.toString(),
          optimizationMethod: optimizationResult?.optimizationMethod || 'none',
          compressionRatio: optimizationResult?.compressionRatio?.toString() || '1',
        },
      }
    )

    // Create asset record in database
    const asset = await prisma.asset.create({
      data: {
        workspaceId: user.workspaceId,
        filename: uploadResult.filename,
        originalName: file.originalFilename || 'unknown',
        mimeType: validationResult.detectedType!,
        sizeBytes: BigInt(uploadResult.sizeBytes),
        storageType: storageMode.toUpperCase() as any,
        storagePath: uploadResult.storagePath,
        assetType: uploadResult.assetType as any,
        processingStatus: uploadResult.processingStatus,
        uploadedById: user.id,
      },
    })

    // Validate personId from form fields against caller's workspace (IDOR guard)
    let personId: string | null = (fields as any)?.personId?.[0] || null
    if (personId) {
      const personBelongsToWorkspace = await prisma.person.findFirst({
        where: { id: personId, workspaceId: user.workspaceId },
        select: { id: true },
      })
      if (!personBelongsToWorkspace) {
        personId = null
        logger.warn({ workspaceId: user.workspaceId }, 'personId does not belong to workspace — ignoring')
      }
    }

    // Create UI Document record linking the asset, and optionally a DocumentPerson join
    // so the /api/assets?personId=... filter can locate this asset.
    const document = await prisma.document.create({
      data: {
        assetId: asset.id,
        workspaceId: user.workspaceId,
        title: file.originalFilename || asset.filename,
        createdById: user.id,
      },
    })
    if (personId) {
      await prisma.documentPerson.create({
        data: { documentId: document.id, personId },
      })
    }

    // Clean up temporary file
    try {
      require('fs').unlinkSync(file.filepath)
    } catch (error) {
      console.warn('Failed to clean up temporary file:', error)
    }

    // Clean up temporary directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch (error) {
      console.warn('Failed to clean up temporary directory:', error)
    }

    // Trigger RAG ingestion in the Chat service for text-extractable document types.
    // Fire-and-forget — never blocks or fails the upload response.
    const RAG_EXTRACTABLE_TYPES = new Set([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/csv',
      'text/markdown',
      'image/jpeg',
      'image/png',
      'image/tiff',
    ])
    const chatServiceUrl = process.env.CHAT_SERVICE_URL
    const chatServiceSecret = process.env.CHAT_SERVICE_SECRET
    if (RAG_EXTRACTABLE_TYPES.has(validationResult.detectedType!)) {
      if (!chatServiceUrl || !chatServiceSecret) {
        logger.warn({ detectedType: validationResult.detectedType }, 'CHAT_SERVICE_URL or CHAT_SERVICE_SECRET not set — RAG ingestion skipped')
      } else {
        logger.info({ assetId: asset.id, mimeType: validationResult.detectedType }, 'Triggering RAG ingestion')
        const rawPublicUrl = uploadResult.publicUrl
        const absoluteStorageUrl = rawPublicUrl.startsWith('http')
          ? rawPublicUrl
          : `${process.env.NEXTAUTH_URL || 'http://localhost:4777'}${rawPublicUrl}`
        fetch(`${chatServiceUrl}/api/ingestion/ingest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-chat-service-secret': chatServiceSecret,
          },
          body: JSON.stringify({
            assetId: asset.id,
            workspaceId: user.workspaceId,
            storageUrl: absoluteStorageUrl,
            mimeType: validationResult.detectedType!,
            title: file.originalFilename || asset.filename,
            personId,
          }),
        }).catch(err =>
          logger.warn({ err: err?.message }, 'RAG ingestion trigger failed (non-fatal)')
        )
      }
    }

    return successResponse(res, {
      id: asset.id,
      filename: asset.filename,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      sizeBytes: Number(asset.sizeBytes),
      assetType: asset.assetType,
      processingStatus: asset.processingStatus,
      storageType: asset.storageType,
      publicUrl: uploadResult.publicUrl,
      createdAt: asset.createdAt,
      validation: {
        validatedType: validationResult.detectedType,
        securityRisk: validationResult.securityRisk,
        secureFilename: secureFilename
      },
      optimization: optimizationResult ? {
        originalSize,
        optimizedSize: optimizationResult.optimizedSize,
        compressionRatio: optimizationResult.compressionRatio,
        method: optimizationResult.optimizationMethod,
        sizeSaved: originalSize - optimizationResult.optimizedSize,
        sizeSavedPercentage: ((originalSize - optimizationResult.optimizedSize) / originalSize * 100).toFixed(1) + '%'
      } : null
    }, 201)

  } catch (error: any) {
    console.error('Upload error:', error)
    
    // Clean up temporary file on error
    if (fileArray && fileArray.length > 0) {
      try {
        require('fs').unlinkSync(fileArray[0].filepath)
      } catch (cleanupError) {
        console.warn('Failed to clean up temporary file on error:', cleanupError)
      }
    }
    
    // Clean up temporary directory on error
    try {
      if (tempDir) {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary directory on error:', cleanupError)
    }
    
    if (error.statusCode) {
      return errorResponse(res, error.message, error.statusCode)
    }
    return errorResponse(res, error.message || 'Upload failed', 500)
  }
}

// Export with CSRF protection
export default withCSRFProtection(uploadHandler)