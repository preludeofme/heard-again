import { task, metadata, logger as triggerLogger } from '@trigger.dev/sdk/v3'
import { prisma } from '@/lib/prisma'
import { getStorageService } from '@/lib/storage/storage-service'
import { gedcomImportService } from '@/server/services/gedcom/GedcomImportService'
import { geocodePlacesTask } from '@/trigger/geocode-places-task'
import { findPersonMatches } from '@/pages/api/family-merge/analyze'

export interface GedcomImportTaskPayload {
  familyspaceId: string
  userId: string
  storagePath: string
  assetId: string
  jobId: string
  targetFamilyspaceId?: string
  options?: {
    linkToPersonId?: string
    gedcomXrefForLink?: string
    motherXref?: string
    fatherXref?: string
    deduplicate?: boolean
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
    const { familyspaceId, userId, storagePath, assetId, jobId, targetFamilyspaceId, options } = payload

    metadata.set('phase', 'downloading')
    triggerLogger.info('Downloading GEDCOM file from storage', { storagePath })

    const storageService = getStorageService()
    const fileBuffer = await storageService.getFile(storagePath)

    metadata.set('phase', 'importing')
    triggerLogger.info('Starting GEDCOM import', { jobId })

    const stats = await gedcomImportService.importGedcom(
      familyspaceId,
      userId,
      fileBuffer,
      assetId,
      jobId,
      options,
      async (done, total) => {
        metadata.set('progress', { done, total })
      }
    )

    if (options?.deduplicate && targetFamilyspaceId) {
      metadata.set('phase', 'analyzing_duplicates')
      triggerLogger.info('Analyzing duplicates and creating merge proposal', { targetFamilyspaceId, sourceFamilyspaceId: familyspaceId })

      const matches = await findPersonMatches(targetFamilyspaceId, familyspaceId, 0.6)
      const totalSourcePeople = await prisma.person.count({
        where: { familyspaceId }
      })

      const overallMatchScore = matches.length > 0
        ? matches.reduce((sum, m) => sum + m.matchScore, 0) / matches.length
        : 0

      const proposal = await prisma.$transaction(async (tx) => {
        const newProposal = await tx.familyMergeProposal.create({
          data: {
            targetFamilyspaceId,
            sourceFamilyspaceId: familyspaceId,
            proposedById: userId,
            status: 'PENDING',
            overallMatchScore,
            matchedPeopleCount: matches.length,
            totalSourcePeople,
          }
        })

        if (matches.length > 0) {
          await tx.familyMergePersonMatch.createMany({
            data: matches.map(match => ({
              proposalId: newProposal.id,
              targetPersonId: match.targetPersonId,
              sourcePersonId: match.sourcePersonId,
              matchScore: match.matchScore,
              matchReason: match.matchReason,
              isIncluded: true,
              userOverride: false,
              status: 'PENDING'
            }))
          })
        }

        return newProposal
      })

      metadata.set('proposalId', proposal.id)
      triggerLogger.info('Created family merge proposal', { proposalId: proposal.id })

      // Finalize the ImportJob status to COMPLETED and save proposalId in resultSummary
      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          resultSummary: {
            ...(stats as any),
            proposalId: proposal.id,
          },
        },
      })
    }

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
