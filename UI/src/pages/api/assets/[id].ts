import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors, sanitizeAssetResponse } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'

export default apiHandler({
  // GET /api/assets/[id] - Get asset details
  GET: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const assetId = req.query.id as string

    const asset = await prisma.asset.findFirst({
      where: { id: assetId, familyspaceId: user.familyspaceId },
      include: {
        uploadedBy: {
          select: { id: true, displayName: true, email: true },
        },
        storyAssets: {
          include: {
            story: { select: { id: true, title: true } },
          },
        },
        document: {
          select: { documentType: true },
        },
      },
    })

    if (!asset) throw Errors.notFound('Asset')

    // Sanitize response to remove storage path information
    const sanitizedAsset = sanitizeAssetResponse({
      id: asset.id,
      filename: asset.filename,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      sizeBytes: Number(asset.sizeBytes),
      assetType: asset.assetType,
      storagePath: asset.storagePath, // Will be removed by sanitizer
      durationSeconds: asset.durationSeconds,
      width: asset.width,
      height: asset.height,
      transcript: asset.transcript,
      processingStatus: asset.processingStatus,
      processingError: asset.processingError,
      uploadedBy: asset.uploadedBy,
      stories: asset.storyAssets.map((sa) => ({
        storyId: sa.story.id,
        storyTitle: sa.story.title,
        role: sa.assetRole,
      })),
      createdAt: asset.createdAt,
      documentType: asset.document?.documentType,
    })

    return successResponse(res, sanitizedAsset)
  },

  // PUT /api/assets/[id] - Update asset/document details
  PUT: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')
    const assetId = req.query.id as string
    const { documentType, title, description } = req.body

    const document = await prisma.document.findFirst({
      where: { assetId, familyspaceId: user.familyspaceId },
    })

    if (!document) throw Errors.notFound('Document for asset')

    const updatedDocument = await prisma.document.update({
      where: { id: document.id },
      data: {
        documentType: documentType || undefined,
        title: title || undefined,
        description: description || undefined,
      },
    })

    return successResponse(res, updatedDocument)
  },

  // PATCH /api/assets/[id] - Link or unlink a person from the document for this asset
  PATCH: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')
    const assetId = req.query.id as string
    const { personId, action } = req.body as { personId?: string; action?: 'link' | 'unlink' }

    if (!personId || !action) {
      return res.status(400).json({ success: false, error: 'personId and action (link|unlink) are required' })
    }

    // Find the Document associated with this asset (familyspace-scoped)
    const document = await prisma.document.findFirst({
      where: { assetId, familyspaceId: user.familyspaceId },
    })
    if (!document) throw Errors.notFound('Document for asset')

    // Verify person belongs to the familyspace (IDOR guard)
    const person = await prisma.person.findFirst({
      where: { id: personId, familyspaceId: user.familyspaceId },
      select: { id: true },
    })
    if (!person) throw Errors.notFound('Person')

    if (action === 'link') {
      await prisma.documentPerson.upsert({
        where: { documentId_personId: { documentId: document.id, personId } },
        update: {},
        create: { documentId: document.id, personId },
      })

      // Trigger RAG re-ingestion for the Chat service so the AI Profile Builder
      // can use this document even though it was linked retroactively.
      const asset = await prisma.asset.findFirst({
        where: { id: assetId, familyspaceId: user.familyspaceId },
        select: { storagePath: true, mimeType: true, originalName: true, filename: true },
      })
      const chatServiceUrl = process.env.CHAT_SERVICE_URL
      const chatServiceSecret = process.env.CHAT_SERVICE_SECRET
      if (asset && chatServiceUrl && chatServiceSecret) {
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
        if (RAG_EXTRACTABLE_TYPES.has(asset.mimeType)) {
          const rawPath = asset.storagePath
          const publicPath = rawPath.startsWith('http') || rawPath.startsWith('/')
            ? rawPath
            : `/api/assets/${rawPath}`
          const storageUrl = publicPath.startsWith('http')
            ? publicPath
            : `${process.env.NEXTAUTH_URL || 'http://localhost:4777'}${publicPath}`
          fetch(`${chatServiceUrl}/api/ingestion/ingest`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-chat-service-secret': chatServiceSecret,
            },
            body: JSON.stringify({
              assetId,
              familyspaceId: user.familyspaceId,
              storageUrl,
              mimeType: asset.mimeType,
              title: asset.originalName || asset.filename,
              personId,
            }),
          }).catch(err =>
            logger.warn({ err: err?.message }, 'RAG re-ingestion on link failed (non-fatal)')
          )
        }
      }
    } else {
      await prisma.documentPerson.deleteMany({
        where: { documentId: document.id, personId },
      })
    }

    return successResponse(res, { documentId: document.id, personId, action })
  },

  // DELETE /api/assets/[id] - Delete asset
  DELETE: async (req, res) => {

    const user = await getAuthUserWithFamilyspace(req, res)
    const assetId = req.query.id as string
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const asset = await prisma.asset.findFirst({
      where: { id: assetId, familyspaceId: user.familyspaceId },
    })
    if (!asset) throw Errors.notFound('Asset')

    const chatServiceUrl = process.env.CHAT_SERVICE_URL
    const chatServiceSecret = process.env.CHAT_SERVICE_SECRET

    if (chatServiceUrl && chatServiceSecret) {
      fetch(`${chatServiceUrl}/api/ingestion/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-chat-service-secret': chatServiceSecret,
        },
        body: JSON.stringify({
          assetId,
          familyspaceId: user.familyspaceId,
        }),
      }).catch(err =>
        logger.warn({ assetId, err: err?.message }, 'RAG ingestion delete trigger failed (non-fatal)')
      )
    }

    await prisma.asset.delete({ where: { id: assetId } })

    return successResponse(res, { deleted: true })
  },
})
