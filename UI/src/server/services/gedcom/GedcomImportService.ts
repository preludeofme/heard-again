import { prisma } from '@/lib/prisma'
import { GedcomParser, ParsedIndividual, ParsedFamily } from './GedcomParser'
import fs from 'fs/promises'

export class GedcomImportService {
  async importGedcom(
    familyspaceId: string,
    userId: string,
    filePath: string,
    assetId: string,
    jobId: string
  ): Promise<any> {
    const content = await fs.readFile(filePath, 'utf-8')
    const { individuals, families } = GedcomParser.parse(content)

    if (individuals.length === 0) {
      throw new Error('No GEDCOM individuals found in file')
    }

    // Update job status to processing
    await prisma.importJob.update({
      where: { id: jobId },
      data: { status: 'PROCESSING', startedAt: new Date() },
    })

    const importStats = {
      parsedIndividuals: individuals.length,
      parsedFamilies: families.length,
      parsedFamilyLinks: families.reduce((acc, family) => acc + family.childXrefs.length, 0),
      personUpserts: 0,
      personNamesWritten: 0,
      personEventsWritten: 0,
      personExternalRefUpserts: 0,
      familyUpserts: 0,
      familyChildLinksWritten: 0,
      skippedFamilyChildLinks: 0,
      idempotentUpsertEnabled: true,
    }

    const BATCH_SIZE = 100
    try {
      const importedPersonIds: Record<string, string> = {}

      // 1. Process individuals in batches
      for (let i = 0; i < individuals.length; i += BATCH_SIZE) {
        const batch = individuals.slice(i, i + BATCH_SIZE)
        
        await prisma.$transaction(async (tx) => {
          for (const individual of batch) {
            const p = await tx.person.upsert({
              where: {
                familyspaceId_gedcomXref: {
                  familyspaceId,
                  gedcomXref: individual.xref,
                },
              },
              update: {
                firstName: individual.firstName,
                lastName: individual.lastName,
                displayName: individual.fullName,
                nickname: individual.nickname,
                sex: individual.sex || 'U',
                birthDate: individual.birthDate,
                deathDate: individual.deathDate,
                isDeceased: Boolean(individual.deathDate),
                bio: individual.note,
              },
              create: {
                familyspaceId,
                firstName: individual.firstName,
                lastName: individual.lastName,
                displayName: individual.fullName,
                nickname: individual.nickname,
                gedcomXref: individual.xref,
                sex: individual.sex || 'U',
                birthDate: individual.birthDate,
                deathDate: individual.deathDate,
                isDeceased: Boolean(individual.deathDate),
                bio: individual.note,
                tags: [],
                createdById: userId,
              },
            })

            // Store for family processing
            importedPersonIds[individual.xref] = p.id

            // Clean up related data
            await tx.personName.deleteMany({ where: { personId: p.id } })
            await tx.personEvent.deleteMany({ where: { personId: p.id } })

            // Create primary name
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

            // Create primary events
            if (individual.birthDate || individual.birthPlace) {
              await tx.personEvent.create({
                data: {
                  personId: p.id,
                  eventType: 'BIRTH',
                  eventDate: individual.birthDate,
                  place: individual.birthPlace,
                  isPrimary: true,
                  gedcomXref: `${individual.xref}:BIRT:1`,
                },
              })
              importStats.personEventsWritten += 1
            }

            if (individual.deathDate || individual.deathPlace) {
              await tx.personEvent.create({
                data: {
                  personId: p.id,
                  eventType: 'DEATH',
                  eventDate: individual.deathDate,
                  place: individual.deathPlace,
                  isPrimary: true,
                  gedcomXref: `${individual.xref}:DEAT:1`,
                },
              })
              importStats.personEventsWritten += 1
            }

            await tx.personExternalRef.upsert({
              where: {
                personId_system_externalId: {
                  personId: p.id,
                  system: 'GEDCOM',
                  externalId: individual.xref,
                },
              },
              update: { metadata: { importSourceAssetId: assetId } },
              create: {
                personId: p.id,
                system: 'GEDCOM',
                externalId: individual.xref,
                metadata: { importSourceAssetId: assetId },
              },
            })

            importStats.personUpserts += 1
            importStats.personNamesWritten += 1
            importStats.personExternalRefUpserts += 1
          }
        })
      }

      // 2. Process families in batches
      for (let i = 0; i < families.length; i += BATCH_SIZE) {
        const batch = families.slice(i, i + BATCH_SIZE)
        
        await prisma.$transaction(async (tx) => {
          for (const family of batch) {
            const familyUnit = await tx.familyUnit.upsert({
              where: {
                familyspaceId_gedcomXref: {
                  familyspaceId,
                  gedcomXref: family.xref,
                },
              },
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

            const skipped = family.childXrefs.length - childRows.length
            importStats.skippedFamilyChildLinks += skipped
            if (childRows.length > 0) {
              await tx.familyChild.createMany({ data: childRows })
              importStats.familyChildLinksWritten += childRows.length
            }

            importStats.familyUpserts += 1
          }
        })
      }

      const result = importStats

      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          resultSummary: importStats,
        },
      })

      return importStats
    } catch (error: any) {
      // Mark job as failed
      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: error.message,
        },
      })
      throw error
    }
  }
}

export const gedcomImportService = new GedcomImportService()
