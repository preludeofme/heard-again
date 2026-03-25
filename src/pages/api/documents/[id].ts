import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const { id } = req.query
  const documentId = id as string

  if (!documentId) {
    return res.status(400).json({ success: false, error: 'Document ID required' })
  }

  const { method } = req

  try {
    switch (method) {
      case 'GET':
        return await getDocument(req, res, documentId)
      case 'PUT':
      case 'PATCH':
        return await updateDocument(req, res, documentId, session.user.id)
      case 'DELETE':
        return await deleteDocument(req, res, documentId, session.user.id)
      default:
        return res.status(405).json({ success: false, error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Document API error:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

async function getDocument(req: NextApiRequest, res: NextApiResponse, documentId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      asset: {
        select: {
          id: true,
          filename: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          storagePath: true,
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

  return res.status(200).json({
    success: true,
    data: document,
  })
}

async function updateDocument(
  req: NextApiRequest,
  res: NextApiResponse,
  documentId: string,
  userId: string
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

  // Check document exists
  const existingDoc = await prisma.document.findUnique({
    where: { id: documentId },
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
          storagePath: true,
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

  return res.status(200).json({
    success: true,
    data: document,
  })
}

async function deleteDocument(
  req: NextApiRequest,
  res: NextApiResponse,
  documentId: string,
  userId: string
) {
  const { permanent } = req.query

  const existingDoc = await prisma.document.findUnique({
    where: { id: documentId },
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
