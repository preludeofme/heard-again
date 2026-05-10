import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { getStorageService } from '@/lib/storage/storage-service'
import { gedcomExportService } from '@/services'
// @ts-ignore
import { ZipArchive } from 'archiver'
import { Buffer } from 'buffer'

export default apiHandler({
  // POST /api/export/zip - Create a background export job for full data ZIP
  POST: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'ADMIN')

    const familyspace = await prisma.familyspace.findUnique({
      where: { id: user.familyspaceId },
      include: {
        people: {
          include: {
            names: true,
            events: true,
          }
        },
        stories: {
          include: {
            assets: true,
            comments: true,
          }
        },
        assets: true,
        documents: true,
        voiceProfiles: true,
        members: {
          include: {
            user: {
              select: {
                displayName: true,
                email: true
              }
            }
          }
        }
      }
    })

    if (!familyspace) {
      throw Errors.notFound('Familyspace')
    }

    // Create a COMPLETED job immediately for now (simple implementation)
    // In a real production system, this would be queued via BullMQ
    
    // 1. Generate JSON Data
    const exportData = {
      version: '1.1.0',
      exportedAt: new Date().toISOString(),
      familyspace: {
        id: familyspace.id,
        name: familyspace.name,
        slug: familyspace.slug,
        createdAt: familyspace.createdAt,
      },
      data: {
        people: familyspace.people,
        stories: familyspace.stories,
        assets: familyspace.assets.map(a => ({
          ...a,
          sizeBytes: Number(a.sizeBytes)
        })),
        documents: familyspace.documents,
        voiceProfiles: familyspace.voiceProfiles,
        members: familyspace.members.map(m => ({
          email: m.user.email,
          displayName: m.user.displayName,
          role: m.role,
          joinedAt: m.joinedAt
        }))
      }
    }
    const jsonString = JSON.stringify(exportData, (_, v) => 
      typeof v === 'bigint' ? v.toString() : v
    , 2)

    // 2. Generate GEDCOM
    const gedcomString = await gedcomExportService.generateGedcom(user.familyspaceId)

    // 3. Collect ZIP in memory (Warning: might consume too much memory for huge exports)
    const storageService = getStorageService()
    const archive = new ZipArchive({ zlib: { level: 9 } })
    const chunks: Buffer[] = []
    
    archive.on('data', (chunk) => chunks.push(chunk))
    
    const finalizePromise = new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(chunks)))
      archive.on('error', reject)
    })

    // Add files
    archive.append(jsonString, { name: 'data.json' })
    archive.append(gedcomString, { name: 'tree.ged' })

    for (const asset of familyspace.assets) {
      if (!asset.storagePath) continue
      try {
        const buffer = await storageService.getFile(asset.storagePath)
        const folder = asset.assetType ? asset.assetType.toLowerCase() + 's' : 'other'
        archive.append(buffer, { name: `${folder}/${asset.originalName}` })
      } catch (err) {
        // Skip missing files
      }
    }

    archive.finalize()
    const zipBuffer = await finalizePromise

    // 4. Upload ZIP to storage
    const fileName = `${familyspace.slug}-full-export-${Date.now()}.zip`
    const uploadResult = await storageService.uploadFile(
      zipBuffer,
      fileName,
      'application/zip',
      {
        folder: `${user.familyspaceId}/exports`,
        metadata: {
          exportType: 'ZIP',
          generatedBy: 'api.export.zip',
          familyspaceId: user.familyspaceId,
        },
      }
    )

    // 5. Create Asset and Job records
    const storageMode = storageService.getMode()
    const [asset, exportJob] = await prisma.$transaction(async (tx) => {
      const createdAsset = await tx.asset.create({
        data: {
          familyspaceId: user.familyspaceId,
          filename: uploadResult.filename,
          originalName: fileName,
          mimeType: 'application/zip',
          sizeBytes: BigInt(zipBuffer.length),
          storageType: storageMode.toUpperCase() as any,
          storagePath: uploadResult.storagePath,
          assetType: 'DOCUMENT',
          processingStatus: 'COMPLETED',
          uploadedById: user.id,
          metadata: {
            exportType: 'ZIP',
            generatedBy: 'api.export.zip',
            familyspaceId: user.familyspaceId,
          },
        },
      })

      const createdJob = await tx.exportJob.create({
        data: {
          familyspaceId: user.familyspaceId,
          exportType: 'ZIP',
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
    }, 201)
  },
})
