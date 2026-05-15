import { prisma } from '@/lib/prisma'
import { GedcomParser } from './GedcomParser'

export class GedcomImportService {
  async previewGedcom(
    userId: string,
    fileContent: string
  ): Promise<{
    potentialMatches: Array<{
      xref: string;
      fullName: string;
      firstName: string;
      lastName: string | null;
      confidence: number;
    }>;
    summary: {
      individualCount: number;
      familyCount: number;
    };
  }> {
    const { individuals, families } = GedcomParser.parse(fileContent)

    // Get user info for matching - pick the first person record created by this user (likely themselves)
    const person = await prisma.person.findFirst({
      where: { createdById: userId, personType: 'FAMILY' },
      orderBy: { createdAt: 'asc' },
    })

    if (!person) {
      return {
        potentialMatches: [],
        summary: { individualCount: individuals.length, familyCount: families.length }
      }
    }

    const potentialMatches = individuals
      .map(indi => {
        let confidence = 0
        const firstNameMatch = indi.firstName.toLowerCase() === person.firstName.toLowerCase()
        const lastNameMatch = indi.lastName?.toLowerCase() === person.lastName?.toLowerCase()

        if (firstNameMatch && lastNameMatch) confidence = 0.9
        else if (firstNameMatch) confidence = 0.5
        else if (lastNameMatch) confidence = 0.3

        // Further refine confidence with birth dates if available
        if (indi.birthDate && person.birthDate) {
          const yearsMatch = indi.birthDate.getFullYear() === person.birthDate.getFullYear()
          if (yearsMatch) confidence += 0.1
        }

        return {
          xref: indi.xref,
          fullName: indi.fullName,
          firstName: indi.firstName,
          lastName: indi.lastName,
          confidence
        }
      })
      .filter(m => m.confidence > 0.4)
      .sort((a, b) => b.confidence - a.confidence)

    return {
      potentialMatches,
      summary: { individualCount: individuals.length, familyCount: families.length }
    }
  }

  async importGedcom(
    familyspaceId: string,
    userId: string,
    fileContent: string,
    assetId: string,
    jobId: string,
    options?: {
      linkToPersonId?: string;
      gedcomXrefForLink?: string;
      motherXref?: string;
      fatherXref?: string;
    },
    onProgress?: (done: number, total: number) => void | Promise<void>
  ): Promise<Record<string, unknown>> {
    const { individuals, families } = GedcomParser.parse(fileContent)

    if (individuals.length === 0) {
      throw new Error('No GEDCOM individuals found in file')
    }

    await prisma.importJob.update({
      where: { id: jobId },
      data: { status: 'PROCESSING', startedAt: new Date() },
    })

    const importStats = {
      parsedIndividuals: individuals.length,
      parsedFamilies: families.length,
      parsedFamilyLinks: families.reduce((acc, f) => acc + f.childXrefs.length, 0),
      personUpserts: 0,
      personNamesWritten: 0,
      personEventsWritten: 0,
      personNotesWritten: 0,
      personSourceCitationsWritten: 0,
      personExternalRefUpserts: 0,
      familyUpserts: 0,
      familyChildLinksWritten: 0,
      skippedFamilyChildLinks: 0,
      idempotentUpsertEnabled: true,
    }

    const BATCH_SIZE = 100

    // Prefer explicitly supplied linkToPersonId (UI passes the root person's ID directly).
    // Fall back to createdById lookup only when xrefs are set but no explicit ID was supplied.
    // Using findFirst({ createdById }) alone is ambiguous once the user has added other people,
    // so we order by createdAt ascending to bias toward the onboarding record.
    const resolvedLinkToPersonId: string | undefined =
      options?.linkToPersonId ??
      (
        !options?.linkToPersonId && (options?.gedcomXrefForLink || options?.motherXref || options?.fatherXref)
          ? (await prisma.person.findFirst({
              where: { familyspaceId, createdById: userId },
              orderBy: { createdAt: 'asc' },
              select: { id: true },
            }))?.id
          : undefined
      )

    try {
      const importedPersonIds: Record<string, string> = {}

      for (let i = 0; i < individuals.length; i += BATCH_SIZE) {
        const batch = individuals.slice(i, i + BATCH_SIZE)

        await prisma.$transaction(async (tx) => {
          for (const individual of batch) {
            const isUserLink = options?.gedcomXrefForLink === individual.xref && resolvedLinkToPersonId
            const personIdToUse = isUserLink ? resolvedLinkToPersonId : undefined

            const p = await tx.person.upsert({
              where: personIdToUse ? { id: personIdToUse } : { familyspaceId_gedcomXref: { familyspaceId, gedcomXref: individual.xref } },
              update: {
                firstName: individual.firstName,
                lastName: individual.lastName,
                displayName: individual.fullName,
                nickname: individual.nickname,
                sex: individual.sex ?? 'U',
                birthDate: individual.birthDate,
                deathDate: individual.deathDate,
                isDeceased: individual.isDeceased,
                causeOfDeath: individual.causeOfDeath,
                bio: individual.note,
                gedcomXref: individual.xref, // Ensure the xref is set if it was a user link
              },
              create: {
                familyspaceId,
                firstName: individual.firstName,
                lastName: individual.lastName,
                displayName: individual.fullName,
                nickname: individual.nickname,
                gedcomXref: individual.xref,
                sex: individual.sex ?? 'U',
                birthDate: individual.birthDate,
                deathDate: individual.deathDate,
                isDeceased: individual.isDeceased,
                causeOfDeath: individual.causeOfDeath,
                bio: individual.note,
                tags: [],
                createdById: userId,
              },
            })

            importedPersonIds[individual.xref] = p.id

            await tx.personName.deleteMany({ where: { personId: p.id } })
            await tx.personEvent.deleteMany({ where: { personId: p.id } })
            await tx.personNote.deleteMany({ where: { personId: p.id } })
            await tx.personSourceCitation.deleteMany({ where: { personId: p.id } })

            await tx.personName.create({
              data: {
                personId: p.id,
                nameType: 'BIRTH',
                givenName: individual.firstName,
                surname: individual.lastName,
                nickname: individual.nickname,
                isPrimary: true,
                gedcomXref: `${individual.xref}:NAME:1`,
              },
            })
            importStats.personNamesWritten += 1

            for (const evt of individual.events) {
              await tx.personEvent.create({
                data: {
                  personId: p.id,
                  eventType: evt.eventType as any,
                  eventDate: evt.eventDate,
                  rawDate: evt.rawDate,
                  place: evt.place,
                  description: evt.description,
                  customType: evt.customType,
                  isPrimary: evt.eventType === 'BIRTH' || evt.eventType === 'DEATH',
                  gedcomXref: `${individual.xref}:${evt.gedcomTag}:${evt.eventIndex}`,
                },
              })
              importStats.personEventsWritten += 1
            }

            for (let n = 0; n < individual.notes.length; n++) {
              const note = individual.notes[n]
              await tx.personNote.create({
                data: {
                  personId: p.id,
                  noteType: note.noteType,
                  content: note.content,
                  sortOrder: n,
                  gedcomXref: `${individual.xref}:NOTE:${n + 1}`,
                },
              })
              importStats.personNotesWritten += 1
            }

            for (const citation of individual.sourceCitations) {
              await tx.personSourceCitation.create({
                data: {
                  personId: p.id,
                  gedcomSRef: citation.gedcomSRef,
                  page: citation.page,
                  text: citation.text,
                  sourceTitle: citation.sourceTitle,
                  sourceAuthor: citation.sourceAuthor,
                  sourceDate: citation.sourceDate,
                },
              })
              importStats.personSourceCitationsWritten += 1
            }

            await tx.personExternalRef.upsert({
              where: { personId_system_externalId: { personId: p.id, system: 'GEDCOM', externalId: individual.xref } },
              update: { metadata: { importSourceAssetId: assetId } },
              create: {
                personId: p.id,
                system: 'GEDCOM',
                externalId: individual.xref,
                metadata: { importSourceAssetId: assetId },
              },
            })

            importStats.personUpserts += 1
            importStats.personExternalRefUpserts += 1
          }
        })

        if (onProgress) {
          await onProgress(Math.min(i + BATCH_SIZE, individuals.length), individuals.length)
        }
      }

      for (let i = 0; i < families.length; i += BATCH_SIZE) {
        const batch = families.slice(i, i + BATCH_SIZE)

        await prisma.$transaction(async (tx) => {
          for (const family of batch) {
            const familyUnit = await tx.familyUnit.upsert({
              where: { familyspaceId_gedcomXref: { familyspaceId, gedcomXref: family.xref } },
              update: {
                marriageDate: family.marriageDate,
                marriagePlace: family.marriagePlace,
                divorceDate: family.divorceDate,
              },
              create: {
                familyspaceId,
                gedcomXref: family.xref,
                marriageDate: family.marriageDate,
                marriagePlace: family.marriagePlace,
                divorceDate: family.divorceDate,
              },
            })

            await tx.familyParent.deleteMany({ where: { familyId: familyUnit.id } })
            await tx.familyChild.deleteMany({ where: { familyId: familyUnit.id } })

            const parentLinks = []
            if (family.husbandXref && importedPersonIds[family.husbandXref]) {
              parentLinks.push({
                familyId: familyUnit.id,
                parentId: importedPersonIds[family.husbandXref],
                relationshipType: 'BIOLOGICAL' as const,
                sortOrder: 0,
              })
            }
            if (family.wifeXref && importedPersonIds[family.wifeXref]) {
              parentLinks.push({
                familyId: familyUnit.id,
                parentId: importedPersonIds[family.wifeXref],
                relationshipType: 'BIOLOGICAL' as const,
                sortOrder: 1,
              })
            }
            if (parentLinks.length > 0) {
              await tx.familyParent.createMany({ data: parentLinks })
            }

            const childRows = family.childXrefs
              .map((childXref, order) => ({
                familyId: familyUnit.id,
                childId: importedPersonIds[childXref],
                relationshipType: 'BIOLOGICAL' as const,
                sortOrder: order,
              }))
              .filter((row) => Boolean(row.childId))

            importStats.skippedFamilyChildLinks += family.childXrefs.length - childRows.length
            if (childRows.length > 0) {
              await tx.familyChild.createMany({ data: childRows })
              importStats.familyChildLinksWritten += childRows.length
            }

            importStats.familyUpserts += 1
          }
        })
      }

      // Final step: Link resolved person to selected parents
      if (resolvedLinkToPersonId && (options?.motherXref || options?.fatherXref)) {
        await prisma.$transaction(async (tx) => {
          const motherId = options.motherXref ? importedPersonIds[options.motherXref] : null
          const fatherId = options.fatherXref ? importedPersonIds[options.fatherXref] : null

          if (motherId || fatherId) {
            let familyId: string | null = null

            const existingFamily = await tx.familyUnit.findFirst({
              where: {
                familyspaceId,
                parents: {
                  some: { parentId: { in: [motherId, fatherId].filter(Boolean) as string[] } }
                }
              },
              include: { parents: true }
            })

            // Filter for exact match of parents if both provided
            const matchedFamily = existingFamily && (
              (!motherId || existingFamily.parents.some(p => p.parentId === motherId)) &&
              (!fatherId || existingFamily.parents.some(p => p.parentId === fatherId))
            ) ? existingFamily : null

            if (matchedFamily) {
              familyId = matchedFamily.id
            } else {
              // Create new family unit
              const newFam = await tx.familyUnit.create({
                data: { familyspaceId }
              })
              familyId = newFam.id

              if (fatherId) {
                await tx.familyParent.create({
                  data: { familyId, parentId: fatherId, relationshipType: 'BIOLOGICAL', sortOrder: 0 }
                })
              }
              if (motherId) {
                await tx.familyParent.create({
                  data: { familyId, parentId: motherId, relationshipType: 'BIOLOGICAL', sortOrder: 1 }
                })
              }
            }

            await tx.familyChild.upsert({
              where: { familyId_childId: { familyId, childId: resolvedLinkToPersonId! } },
              update: {},
              create: { familyId, childId: resolvedLinkToPersonId!, relationshipType: 'BIOLOGICAL' }
            })
          }
        })
      }

      await prisma.importJob.update({
        where: { id: jobId },
        data: { status: 'COMPLETED', completedAt: new Date(), resultSummary: importStats },
      })

      return importStats
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      await prisma.importJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', completedAt: new Date(), errorMessage: message },
      })
      throw error
    }
  }
}

export const gedcomImportService = new GedcomImportService()
