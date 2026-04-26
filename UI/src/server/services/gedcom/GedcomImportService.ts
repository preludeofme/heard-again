import { prisma } from '@/lib/prisma'
import { GedcomParser, ParsedIndividual, ParsedFamily } from './GedcomParser'
import fs from 'fs/promises'
import { personRepository } from '@/server/repositories/PersonRepository'

export class GedcomImportService {
  async importGedcom(
    workspaceId: string,
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

    try {
      const result = await prisma.$transaction(async (tx) => {
        const importedPersonIds: Record<string, string> = {}

        for (const individual of individuals) {
          const person = await tx.person.upsert({
            where: {
              workspaceId_gedcomXref: {
                workspaceId,
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
              workspaceId,
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
          importStats.personUpserts += 1
          importedPersonIds[individual.xref] = person.id

          // Clean up old names/events before recreating
          await tx.personName.deleteMany({ where: { personId: person.id } })
          await tx.personEvent.deleteMany({ where: { personId: person.id } })

          await tx.personName.create({
            data: {
              personId: person.id,
              nameType: 'BIRTH',
              givenName: individual.firstName,
              surname: individual.lastName,
              nickname: individual.nickname,
              isPrimary: true,
              gedcomXref: `${individual.xref}:NAME:1`,
            },
          })
          importStats.personNamesWritten += 1

          if (individual.birthDate || individual.birthPlace) {
            await tx.personEvent.create({
              data: {
                personId: person.id,
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
                personId: person.id,
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
                personId: person.id,
                system: 'GEDCOM',
                externalId: individual.xref,
              },
            },
            update: {
              metadata: { importSourceAssetId: assetId },
            },
            create: {
              personId: person.id,
              system: 'GEDCOM',
              externalId: individual.xref,
              metadata: { importSourceAssetId: assetId },
            },
          })
          importStats.personExternalRefUpserts += 1
        }

        for (const family of families) {
          const familyUnit = await tx.familyUnit.upsert({
            where: {
              workspaceId_gedcomXref: {
                workspaceId,
                gedcomXref: family.xref,
              },
            },
            update: {
              marriageDate: family.marriageDate,
              marriagePlace: family.marriagePlace,
              divorceDate: family.divorceDate,
            },
            create: {
              workspaceId,
              gedcomXref: family.xref,
              marriageDate: family.marriageDate,
              marriagePlace: family.marriagePlace,
              divorceDate: family.divorceDate,
            },
          })
          importStats.familyUpserts += 1

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
        }

        return importStats
      })

      // Mark job as completed
      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          resultSummary: result,
        },
      })

      return result
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
