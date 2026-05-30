import { task, metadata, logger as triggerLogger } from '@trigger.dev/sdk/v3'
import { prisma } from '@/lib/prisma'
import { getStorageService } from '@/lib/storage/storage-service'
import { gedcomImportService } from '@/server/services/gedcom/GedcomImportService'
import { geocodePlacesTask } from '@/trigger/geocode-places-task'

export interface GedcomImportTaskPayload {
  familyspaceId: string
  userId: string
  storagePath: string
  assetId: string
  jobId: string
  options?: {
    linkToPersonId?: string
    gedcomXrefForLink?: string
    motherXref?: string
    fatherXref?: string
  }
}

export interface GedcomImportTaskOutput {
  personUpserts: number
  familyUpserts: number
  parsedIndividuals: number
  parsedFamilies: number
}

export const gedcomImportTask = task({
  id: 'gedcom-import',
  maxDuration: 3600,
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 30000,
    factor: 2,
  },
  onFailure: async ({ payload, error }: { payload: GedcomImportTaskPayload; error: unknown }) => {
    const message = error instanceof Error ? error.message : String(error)
    await prisma.importJob.update({
      where: { id: payload.jobId },
      data: { status: 'FAILED', completedAt: new Date(), errorMessage: message },
    })
  },
  run: async (payload: GedcomImportTaskPayload): Promise<GedcomImportTaskOutput> => {
    const { familyspaceId, userId, storagePath, assetId, jobId, options } = payload

    metadata.set('phase', 'downloading')
    triggerLogger.info('Downloading GEDCOM file from storage', { storagePath })

    const storageService = getStorageService()
    const fileBuffer = await storageService.getFile(storagePath)
    const fileContent = fileBuffer.toString('utf-8')

    metadata.set('phase', 'importing')
    triggerLogger.info('Starting GEDCOM import', { jobId })

    const stats = await gedcomImportService.importGedcom(
      familyspaceId,
      userId,
      fileContent,
      assetId,
      jobId,
      options,
      async (done, total) => {
        metadata.set('progress', { done, total })
      }
    )

    metadata.set('phase', 'complete')
    metadata.set('stats', JSON.stringify(stats))

    triggerLogger.info('GEDCOM import completed', { jobId, stats })

    // Fire geocoding as a background task — non-blocking, does not affect import status
    if (process.env.GOOGLE_MAPS_API_KEY) {
      await geocodePlacesTask.trigger(
        { familyspaceId },
        { idempotencyKey: `geocode-places:${jobId}` }
      )
      triggerLogger.info('Triggered geocode-places task', { familyspaceId, jobId })
    }

    return {
      personUpserts: (stats.personUpserts as number) ?? 0,
      familyUpserts: (stats.familyUpserts as number) ?? 0,
      parsedIndividuals: (stats.parsedIndividuals as number) ?? 0,
      parsedFamilies: (stats.parsedFamilies as number) ?? 0,
    }
  },
})
