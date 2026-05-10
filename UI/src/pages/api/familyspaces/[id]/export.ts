import { prisma } from '@/lib/prisma'
import { apiHandler, Errors } from '@/lib/api-helpers'
import { getAuthUser, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { gedcomExportService } from '@/services'
import { getStorageService } from '@/lib/storage/storage-service'
// @ts-ignore
import { ZipArchive } from 'archiver'
import { logger } from '@/lib/logger'

export default apiHandler({
  // GET /api/familyspaces/[id]/export - Export full data package
  GET: async (req, res) => {
    const user = await getAuthUser(req, res)
    const familyspaceId = req.query.id as string

    await requireFamilyspaceRole(user.id, familyspaceId, 'ADMIN')

    const familyspace = await prisma.familyspace.findUnique({
      where: { id: familyspaceId },
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
    const gedcomString = await gedcomExportService.generateGedcom(familyspaceId)

    // 3. Prepare ZIP Archive
    const archive = new ZipArchive({
      zlib: { level: 9 } // Maximum compression
    })

    // Set headers for download
    const filename = `${familyspace.slug}-full-export-${new Date().toISOString().split('T')[0]}.zip`
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    // Listen for archive errors
    archive.on('error', (err) => {
      logger.error('ZIP export archive error:', err)
      // Note: Header might already be sent, so we can't send a normal error response
      res.end()
    })

    // Pipe archive to response
    archive.pipe(res)

    // Add JSON and GEDCOM files
    archive.append(jsonString, { name: 'data.json' })
    archive.append(gedcomString, { name: 'tree.ged' })

    // 4. Add All Assets
    const storageService = getStorageService()
    
    for (const asset of familyspace.assets) {
      if (!asset.storagePath) continue
      
      try {
        const buffer = await storageService.getFile(asset.storagePath)
        // Try to maintain some folder structure based on assetType
        const folder = asset.assetType ? asset.assetType.toLowerCase() + 's' : 'other'
        const filePath = `${folder}/${asset.originalName}`
        archive.append(buffer, { name: filePath })
      } catch (err) {
        logger.warn(`Failed to include asset ${asset.id} in export:`, err)
        // We continue with other assets rather than failing the whole export
      }
    }

    // 5. Finalize ZIP
    await archive.finalize()
  },
})
