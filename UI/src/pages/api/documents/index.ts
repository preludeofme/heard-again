import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const { method } = req
  const workspaceId = req.query.workspaceId as string || session.user.defaultWorkspaceId

  if (!workspaceId) {
    return res.status(400).json({ success: false, error: 'Workspace ID required' })
  }

  try {
    switch (method) {
      case 'GET':
        return await getDocuments(req, res, workspaceId)
      case 'POST':
        return await createDocument(req, res, workspaceId, session.user.id)
      default:
        return res.status(405).json({ success: false, error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Documents API error:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

async function getDocuments(req: NextApiRequest, res: NextApiResponse, workspaceId: string) {
  const {
    personId,
    documentType,
    search,
    dateFrom,
    dateTo,
    includeDeleted,
    page = '1',
    limit = '20',
  } = req.query

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string)
  const take = parseInt(limit as string)

  const where: any = {
    workspaceId,
    isDeleted: includeDeleted === 'true' ? undefined : false,
  }

  if (personId) {
    where.people = {
      some: {
        personId: personId as string,
      },
    }
  }

  if (documentType) {
    where.documentType = documentType as string
  }

  if (search) {
    where.OR = [
      { title: { contains: search as string, mode: 'insensitive' } },
      { description: { contains: search as string, mode: 'insensitive' } },
    ]
  }

  if (dateFrom || dateTo) {
    where.dateOccurred = {}
    if (dateFrom) where.dateOccurred.gte = new Date(dateFrom as string)
    if (dateTo) where.dateOccurred.lte = new Date(dateTo as string)
  }

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      include: {
        asset: {
          select: {
            id: true,
            filename: true,
            mimeType: true,
            sizeBytes: true,
            storagePath: true,
            metadata: true,
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
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.document.count({ where }),
  ])

  return res.status(200).json({
    success: true,
    data: documents,
    pagination: {
      page: parseInt(page as string),
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  })
}

async function createDocument(
  req: NextApiRequest,
  res: NextApiResponse,
  workspaceId: string,
  userId: string
) {
  const {
    assetId,
    title,
    description,
    documentType,
    dateOccurred,
    dateOccurredPrecision,
    people,
  } = req.body

  if (!assetId || !title) {
    return res.status(400).json({
      success: false,
      error: 'assetId and title are required',
    })
  }

  // Verify asset exists and belongs to workspace
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, workspaceId },
  })

  if (!asset) {
    return res.status(404).json({
      success: false,
      error: 'Asset not found',
    })
  }

  // Check if asset is already linked to a document
  const existingDoc = await prisma.document.findUnique({
    where: { assetId },
  })

  if (existingDoc) {
    return res.status(409).json({
      success: false,
      error: 'Asset is already linked to a document',
    })
  }

  const document = await prisma.document.create({
    data: {
      workspaceId,
      assetId,
      title,
      description,
      documentType: documentType || 'OTHER',
      dateOccurred: dateOccurred ? new Date(dateOccurred) : null,
      dateOccurredPrecision: dateOccurredPrecision || 'EXACT',
      createdById: userId,
      people: people?.length > 0 ? {
        create: people.map((p: { personId: string; role?: string }) => ({
          personId: p.personId,
          role: p.role,
        })),
      } : undefined,
    },
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

  return res.status(201).json({
    success: true,
    data: document,
  })
}
