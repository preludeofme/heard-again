import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { getStorageService } from '@/lib/storage/storage-service'
export default apiHandler({
  // POST /api/export/json - Export familyspace data as JSON
  POST: async (req, res) => {

    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'VIEWER')

    const familyspace = await prisma.familyspace.findUnique({
      where: { id: user.familyspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        planType: true,
        deploymentMode: true,
        createdAt: true,
      },
    })

    const [people, stories, assets, voiceProfiles, collections] = await Promise.all([
      prisma.person.findMany({
        where: { familyspaceId: user.familyspaceId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          nickname: true,
          personType: true,
          birthDate: true,
          deathDate: true,
          isDeceased: true,
          tags: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.story.findMany({
        where: { familyspaceId: user.familyspaceId },
        select: {
          id: true,
          title: true,
          content: true,
          excerpt: true,
          storyType: true,
          status: true,
          subjectId: true,
          speakerId: true,
          tags: true,
          storyDate: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.asset.findMany({
        where: { familyspaceId: user.familyspaceId },
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          assetType: true,
          sizeBytes: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.voiceProfile.findMany({
        where: { familyspaceId: user.familyspaceId },
        select: {
          id: true,
          name: true,
          status: true,
          personId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.collection.findMany({
        where: { familyspaceId: user.familyspaceId },
        include: {
          stories: {
            select: {
              storyId: true,
              sortOrder: true,
              addedAt: true,
            },
          },
        },
      }),
    ])

    const exportPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      familyspace,
      summary: {
        people: people.length,
        stories: stories.length,
        assets: assets.length,
        voiceProfiles: voiceProfiles.length,
        collections: collections.length,
      },
      data: {
        people,
        stories,
        assets: assets.map((asset) => ({
          ...asset,
          sizeBytes: Number(asset.sizeBytes),
        })),
        voiceProfiles,
        collections,
      },
    }

    const fileName = `familyspace-export-${Date.now()}.json`
    const fileContent = JSON.stringify(exportPayload, null, 2)
    const fileBuffer = Buffer.from(fileContent, 'utf-8')

    const storageService = getStorageService()
    const storageMode = storageService.getMode()
    const uploadResult = await storageService.uploadFile(
      fileBuffer,
      fileName,
      'application/json',
      {
        folder: `${user.familyspaceId}/exports`,
        metadata: {
          exportType: 'JSON',
          generatedBy: 'api.export.json',
          familyspaceId: user.familyspaceId,
        },
      }
    )

    const [asset, exportJob] = await prisma.$transaction(async (tx) => {
      const createdAsset = await tx.asset.create({
        data: {
          familyspaceId: user.familyspaceId,
          filename: uploadResult.filename,
          originalName: fileName,
          mimeType: 'application/json',
          sizeBytes: BigInt(fileBuffer.length),
          storageType: storageMode.toUpperCase() as any,
          storagePath: uploadResult.storagePath,
          assetType: 'DOCUMENT',
          processingStatus: 'COMPLETED',
          uploadedById: user.id,
          metadata: {
            exportType: 'JSON',
            generatedBy: 'api.export.json',
            familyspaceId: user.familyspaceId,
          },
        },
      })

      const createdJob = await tx.exportJob.create({
        data: {
          familyspaceId: user.familyspaceId,
          exportType: 'JSON',
          status: 'COMPLETED',
          requestedById: user.id,
          outputAssetId: createdAsset.id,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      })

      return [createdAsset, createdJob]
    })

    return successResponse(res, {
      jobId: exportJob.id,
      status: exportJob.status,
      exportType: exportJob.exportType,
      outputAssetId: asset.id,
      fileName,
      fileSizeBytes: Number(asset.sizeBytes),
      downloadUrl: `/api/assets/${asset.id}/download`,
      summary: exportPayload.summary,
    }, 201)
  },
})
