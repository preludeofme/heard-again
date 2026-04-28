import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { sanitizeDocumentResponse } from '@/lib/api-helpers'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Authenticate user and get familyspace context
    const user = await getAuthUserWithFamilyspace(req, res)
    
    // Require EDITOR role for document operations
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const { id } = req.query
    const documentId = id as string

    if (!documentId) {
      return res.status(400).json({ success: false, error: 'Document ID required' })
    }

    const { method } = req

    switch (method) {
      case 'GET':
        return await getDocument(req, res, documentId, user.familyspaceId)
      case 'PUT':
      case 'PATCH':
        return await updateDocument(req, res, documentId, user.id, user.familyspaceId)
      case 'DELETE':
        return await deleteDocument(req, res, documentId, user.id, user.familyspaceId)
      default:
        return res.status(405).json({ success: false, error: 'Method not allowed' })
    }
  } catch (error: any) {
    logger.error('Document API error:', error)
    
    // Handle authorization errors specifically
    if (error.statusCode === 401 || error.statusCode === 403) {
      return res.status(error.statusCode).json({ 
        success: false, 
        error: error.message || 'Access denied' 
      })
    }
    
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

async function getDocument(req: NextApiRequest, res: NextApiResponse, documentId: string, familyspaceId: string) {
  const document = await prisma.document.findFirst({
    where: { 
      id: documentId,
      familyspaceId: familyspaceId // ✅ Critical: Familyspace-scoped query
    },
    include: {
      asset: {
        select: {
          id: true,
          filename: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          // storagePath: true, // ❌ Remove: Information disclosure
          metadata: true,
          width: true,
          height: true,
        },
      },
      people: {
        include: {
          person: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatarAssetId: true,
            },
          },
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  if (!document) {
    return res.status(404).json({ success: false, error: 'Document not found' })
  }

  // ✅ Sanitize response to remove storage paths
  const sanitizedDocument = sanitizeDocumentResponse(document)

  return res.status(200).json({
    success: true,
    data: sanitizedDocument,
  })
}

async function updateDocument(
  req: NextApiRequest,
  res: NextApiResponse,
  documentId: string,
  userId: string,
  familyspaceId: string
) {
  const {
    title,
    description,
    documentType,
    dateOccurred,
    dateOccurredPrecision,
    people,
    aiSummary,
  } = req.body

  // Check document exists and user has access to it
  const existingDoc = await prisma.document.findFirst({
    where: { 
      id: documentId,
      familyspaceId: familyspaceId // ✅ Critical: Familyspace-scoped query
    },
    include: { people: true },
  })

  if (!existingDoc) {
    return res.status(404).json({ success: false, error: 'Document not found' })
  }

  // Build update data
  const updateData: any = {}
  if (title !== undefined) updateData.title = title
  if (description !== undefined) updateData.description = description
  if (documentType !== undefined) updateData.documentType = documentType
  if (dateOccurred !== undefined) updateData.dateOccurred = dateOccurred ? new Date(dateOccurred) : null
  if (dateOccurredPrecision !== undefined) updateData.dateOccurredPrecision = dateOccurredPrecision
  if (aiSummary !== undefined) updateData.aiSummary = aiSummary

  // Handle people updates if provided
  if (people && Array.isArray(people)) {
    // Delete existing people links and create new ones
    await prisma.documentPerson.deleteMany({
      where: { documentId },
    })

    if (people.length > 0) {
      await prisma.documentPerson.createMany({
        data: people.map((p: { personId: string; role?: string; aiSuggested?: boolean; aiConfidence?: number }) => ({
          documentId,
          personId: p.personId,
          role: p.role,
          aiSuggested: p.aiSuggested || false,
          aiConfidence: p.aiConfidence,
        })),
      })
    }
  }

  const document = await prisma.document.update({
    where: { id: documentId },
    data: updateData,
    include: {
      asset: {
        select: {
          id: true,
          filename: true,
          mimeType: true,
          sizeBytes: true,
          // storagePath: true, // ❌ Remove: Information disclosure
        },
      },
      people: {
        include: {
          person: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
        },
      },
    },
  })

  // ✅ Sanitize response to remove storage paths
  const sanitizedDocument = sanitizeDocumentResponse(document)

  return res.status(200).json({
    success: true,
    data: sanitizedDocument,
  })
}

async function deleteDocument(
  req: NextApiRequest,
  res: NextApiResponse,
  documentId: string,
  userId: string,
  familyspaceId: string
) {
  const { permanent } = req.query

  // Verify document exists and user has access
  const existingDoc = await prisma.document.findFirst({
    where: { 
      id: documentId,
      familyspaceId: familyspaceId // ✅ Critical: Familyspace-scoped query
    },
  })

  if (!existingDoc) {
    return res.status(404).json({ success: false, error: 'Document not found' })
  }

  if (permanent === 'true') {
    // Hard delete
    await prisma.document.delete({
      where: { id: documentId },
    })
  } else {
    // Soft delete
    await prisma.document.update({
      where: { id: documentId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedById: userId,
      },
    })
  }

  return res.status(200).json({
    success: true,
    message: permanent === 'true' ? 'Document permanently deleted' : 'Document moved to trash',
  })
}
