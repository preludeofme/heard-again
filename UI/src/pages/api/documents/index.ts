import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let user: Awaited<ReturnType<typeof getAuthUserWithFamilyspace>>
  try {
    user = await getAuthUserWithFamilyspace(req, res)
  } catch {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const { method } = req
  const familyspaceId = (req.query.familyspaceId as string) || user.familyspaceId

  if (!familyspaceId) {
    return res.status(400).json({ success: false, error: 'Familyspace ID required' })
  }

  try {
    switch (method) {
      case 'GET':
        return await getDocuments(req, res, familyspaceId)
      case 'POST':
        return await createDocument(req, res, familyspaceId, user.id)
      default:
        return res.status(405).json({ success: false, error: 'Method not allowed' })
    }
  } catch (error) {
    logger.error('Documents API error:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

async function getDocuments(req: NextApiRequest, res: NextApiResponse, familyspaceId: string) {
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

  // Hide AI-generated narration audio and voice-training/voice-generation assets
  // — these get an Asset+Document row but aren't user-curated documents.
  const where: any = {
    familyspaceId,
    isDeleted: includeDeleted === 'true' ? undefined : false,
    asset: {
      isAISynthesized: false,
      voiceGenerationOutputs: { none: {} },
      voiceProfileSources: { none: {} },
      modelArtifactFor: { none: {} },
      generatedAudioForStories: { none: {} },
    },
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

  const serialized = documents.map(doc => ({
    ...doc,
    asset: doc.asset ? { ...doc.asset, sizeBytes: doc.asset.sizeBytes !== null ? Number(doc.asset.sizeBytes) : null } : null,
  }))

  return res.status(200).json({
    success: true,
    data: serialized,
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
  familyspaceId: string,
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

  // Verify asset exists and belongs to familyspace
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, familyspaceId },
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
      familyspaceId,
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

  const serializedDoc = {
    ...document,
    asset: document.asset ? { ...document.asset, sizeBytes: document.asset.sizeBytes !== null ? Number(document.asset.sizeBytes) : null } : null,
  }

  return res.status(201).json({
    success: true,
    data: serializedDoc,
  })
}
