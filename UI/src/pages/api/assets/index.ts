import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  // GET /api/assets - List assets in workspace
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const { type, search, personId, page = '1', limit = '20' } = req.query

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20))
    const skip = (pageNum - 1) * pageSize

    const where: any = { workspaceId: user.workspaceId }

    if (type && typeof type === 'string') {
      where.assetType = type.toUpperCase()
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { originalName: { contains: search, mode: 'insensitive' } },
        { filename: { contains: search, mode: 'insensitive' } },
      ]
    }

    // When personId is provided, return ALL assets but annotate each with
    // whether it is linked to that person. Filtering to only linked assets
    // prevented unlinked docs from appearing at all, making it impossible
    // to link them retroactively from the UI.
    let linkedAssetIds: Set<string> | null = null
    if (personId && typeof personId === 'string') {
      const linkedDocs = await prisma.documentPerson.findMany({
        where: {
          personId,
          document: { workspaceId: user.workspaceId, isDeleted: false },
        },
        select: { document: { select: { assetId: true } } },
      })
      linkedAssetIds = new Set(linkedDocs.map((d) => d.document.assetId))
    }

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        include: {
          uploadedBy: {
            select: { id: true, displayName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.asset.count({ where }),
    ])

    const result = assets.map((a) => ({
      id: a.id,
      filename: a.filename,
      originalName: a.originalName,
      mimeType: a.mimeType,
      sizeBytes: Number(a.sizeBytes),
      assetType: a.assetType,
      storagePath: a.storagePath,
      durationSeconds: a.durationSeconds,
      processingStatus: a.processingStatus,
      uploadedBy: a.uploadedBy,
      createdAt: a.createdAt,
      linkedToPerson: linkedAssetIds ? linkedAssetIds.has(a.id) : undefined,
    }))

    return successResponse(res, {
      assets: result,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  },
})
