import fs from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { withCSRFProtection } from '@/lib/security/csrf'

export default apiHandler({
  // POST /api/export/json - Export workspace data as JSON
  POST: withCSRFProtection(async (req, res) => {

    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'VIEWER')

    const workspace = await prisma.workspace.findUnique({
      where: { id: user.workspaceId },
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
        where: { workspaceId: user.workspaceId },
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
        where: { workspaceId: user.workspaceId },
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
        where: { workspaceId: user.workspaceId },
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
        where: { workspaceId: user.workspaceId },
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
        where: { workspaceId: user.workspaceId },
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
      workspace,
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

    const exportDir = path.join(process.cwd(), 'exports', user.workspaceId)
    await fs.mkdir(exportDir, { recursive: true })

    const fileName = `workspace-export-${Date.now()}.json`
    const absoluteFilePath = path.join(exportDir, fileName)
    const fileContent = JSON.stringify(exportPayload, null, 2)
    await fs.writeFile(absoluteFilePath, fileContent, 'utf-8')

    const stats = await fs.stat(absoluteFilePath)
    const relativePath = path.relative(process.cwd(), absoluteFilePath)

    const [asset, exportJob] = await prisma.$transaction(async (tx) => {
      const createdAsset = await tx.asset.create({
        data: {
          workspaceId: user.workspaceId,
          filename: fileName,
          originalName: fileName,
          mimeType: 'application/json',
          sizeBytes: BigInt(stats.size),
          storageType: 'LOCAL',
          storagePath: relativePath,
          assetType: 'DOCUMENT',
          processingStatus: 'COMPLETED',
          uploadedById: user.id,
          metadata: {
            exportType: 'JSON',
            generatedBy: 'api.export.json',
            workspaceId: user.workspaceId,
          },
        },
      })

      const createdJob = await tx.exportJob.create({
        data: {
          workspaceId: user.workspaceId,
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
  }),
})
