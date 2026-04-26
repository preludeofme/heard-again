import fs from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
function formatGedcomDate(date: Date | null | undefined): string | null {
  if (!date) return null
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = months[date.getUTCMonth()]
  const year = date.getUTCFullYear()
  return `${day} ${month} ${year}`
}

function personGedcomId(personId: string): string {
  return `@I${personId.replace(/-/g, '').slice(0, 12).toUpperCase()}@`
}

function familyGedcomId(familyId: string, index: number): string {
  return `@F${familyId.replace(/-/g, '').slice(0, 10).toUpperCase() || index + 1}@`
}

export default apiHandler({
  // POST /api/export/gedcom - Export people and families as GEDCOM from normalized genealogy schema
  POST: async (req, res) => {

    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'VIEWER')

    const [workspace, people, families] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: user.workspaceId },
        select: { id: true, name: true, slug: true },
      }),
      prisma.person.findMany({
        where: { workspaceId: user.workspaceId },
        include: {
          names: {
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          },
          events: {
            where: {
              eventType: {
                in: ['BIRTH', 'DEATH'],
              },
            },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          },
        },
        orderBy: [{ createdAt: 'asc' }],
      }),
      prisma.familyUnit.findMany({
        where: { workspaceId: user.workspaceId },
        include: {
          parents: {
            include: { parent: true },
            orderBy: { sortOrder: 'asc' },
          },
          children: {
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    const exportValidation = {
      peopleTotal: people.length,
      familiesTotal: families.length,
      fallbackPersonXrefCount: 0,
      fallbackFamilyXrefCount: 0,
      peopleMissingPrimaryNameCount: 0,
      peopleWithBirthEventCount: 0,
      peopleWithDeathEventCount: 0,
    }

    const personXrefById = new Map<string, string>()
    for (const person of people) {
      const resolved = person.gedcomXref || personGedcomId(person.id)
      if (!person.gedcomXref) exportValidation.fallbackPersonXrefCount += 1
      if (person.names.length === 0) exportValidation.peopleMissingPrimaryNameCount += 1
      personXrefById.set(person.id, resolved)
    }

    const familyXrefById = new Map<string, string>()
    families.forEach((family, index) => {
      const resolved = family.gedcomXref || familyGedcomId(family.id, index)
      if (!family.gedcomXref) exportValidation.fallbackFamilyXrefCount += 1
      familyXrefById.set(family.id, resolved)
    })

    const familiesByPerson = new Map<string, { spouse: string[]; child: string[] }>()
    const ensureFamilyRefs = (personId: string) => {
      const existing = familiesByPerson.get(personId)
      if (existing) return existing
      const created = { spouse: [] as string[], child: [] as string[] }
      familiesByPerson.set(personId, created)
      return created
    }

    for (const family of families) {
      const famXref = familyXrefById.get(family.id)!
      for (const parentLink of family.parents) {
        ensureFamilyRefs(parentLink.parentId).spouse.push(famXref)
      }
      for (const child of family.children) {
        ensureFamilyRefs(child.childId).child.push(famXref)
      }
    }

    const lines: string[] = []
    lines.push('0 HEAD')
    lines.push('1 SOUR HEARD_AGAIN')
    lines.push('2 NAME Heard Again')
    lines.push('1 GEDC')
    lines.push('2 VERS 5.5.1')
    lines.push('2 FORM LINEAGE-LINKED')
    lines.push('1 CHAR UTF-8')
    if (workspace?.name) {
      lines.push('1 SUBM @SUB1@')
      lines.push('0 @SUB1@ SUBM')
      lines.push(`1 NAME ${workspace.name}`)
    }

    for (const person of people) {
      const personId = personXrefById.get(person.id)!
      const primaryName = person.names[0]
      const givenParts = primaryName?.givenName || 'Unknown'
      const surname = primaryName?.surname || 'UNKNOWN'
      lines.push(`0 ${personId} INDI`)
      lines.push(`1 NAME ${givenParts || 'UNKNOWN'} /${surname}/`)

      if (person.sex && person.sex !== 'U') {
        lines.push(`1 SEX ${person.sex}`)
      }

      const nickname = primaryName?.nickname
      if (nickname) {
        lines.push(`1 NICK ${nickname}`)
      }

      for (let idx = 1; idx < person.names.length; idx += 1) {
        const altName = person.names[idx]
        lines.push(`1 NAME ${altName.givenName || 'Unknown'} /${altName.surname || 'UNKNOWN'}/`)
        if (altName.nameType === 'MARRIED') {
          lines.push('2 TYPE married')
        } else if (altName.nameType === 'AKA') {
          lines.push('2 TYPE aka')
        }
      }

      const birthEvent = person.events.find((event) => event.eventType === 'BIRTH')
      if (birthEvent) exportValidation.peopleWithBirthEventCount += 1
      const birthDate = formatGedcomDate(birthEvent?.eventDate)
      const birthPlace = birthEvent?.place || null
      if (birthDate || birthPlace) {
        lines.push('1 BIRT')
        if (birthDate) lines.push(`2 DATE ${birthDate}`)
        if (birthPlace) lines.push(`2 PLAC ${birthPlace}`)
      }

      const deathEvent = person.events.find((event) => event.eventType === 'DEATH')
      if (deathEvent) exportValidation.peopleWithDeathEventCount += 1
      const deathDate = formatGedcomDate(deathEvent?.eventDate)
      const deathPlace = deathEvent?.place || null
      if (deathDate || deathPlace) {
        lines.push('1 DEAT Y')
        if (deathDate) lines.push(`2 DATE ${deathDate}`)
        if (deathPlace) lines.push(`2 PLAC ${deathPlace}`)
      }

      if (person.bio) {
        lines.push(`1 NOTE ${person.bio.replace(/\n/g, ' ')}`)
      }

      const refs = familiesByPerson.get(person.id)
      if (refs) {
        for (const famId of refs.spouse) {
          lines.push(`1 FAMS ${famId}`)
        }
        for (const famId of refs.child) {
          lines.push(`1 FAMC ${famId}`)
        }
      }
    }

    families.forEach((family, index) => {
      const familyId = familyXrefById.get(family.id) || familyGedcomId(family.id, index)
      lines.push(`0 ${familyId} FAM`)

      // Export parents - GEDCOM 5.5.1 only supports 2 parents (HUSB/WIFE)
      // Export first parent as HUSB, second as WIFE for compatibility
      const parents = family.parents || []
      if (parents[0]) {
        lines.push(`1 HUSB ${personXrefById.get(parents[0].parentId) || personGedcomId(parents[0].parentId)}`)
      }
      if (parents[1]) {
        lines.push(`1 WIFE ${personXrefById.get(parents[1].parentId) || personGedcomId(parents[1].parentId)}`)
      }

      const marriageDate = formatGedcomDate(family.marriageDate)
      if (marriageDate || family.marriagePlace) {
        lines.push('1 MARR')
        if (marriageDate) lines.push(`2 DATE ${marriageDate}`)
        if (family.marriagePlace) lines.push(`2 PLAC ${family.marriagePlace}`)
      }

      const divorceDate = formatGedcomDate(family.divorceDate)
      if (divorceDate) {
        lines.push('1 DIV')
        lines.push(`2 DATE ${divorceDate}`)
      }

      for (const childLink of family.children) {
        const childId = childLink.childId
        lines.push(`1 CHIL ${personXrefById.get(childId) || personGedcomId(childId)}`)
      }
    })

    lines.push('0 TRLR')

    const exportDir = path.join(process.cwd(), 'exports', user.workspaceId)
    await fs.mkdir(exportDir, { recursive: true })

    const fileName = `workspace-export-${Date.now()}.ged`
    const absoluteFilePath = path.join(exportDir, fileName)
    const gedcomContent = `${lines.join('\n')}\n`
    await fs.writeFile(absoluteFilePath, gedcomContent, 'utf-8')

    const stats = await fs.stat(absoluteFilePath)
    const relativePath = path.relative(process.cwd(), absoluteFilePath)

    const [asset, exportJob] = await prisma.$transaction(async (tx) => {
      const createdAsset = await tx.asset.create({
        data: {
          workspaceId: user.workspaceId,
          filename: fileName,
          originalName: fileName,
          mimeType: 'application/octet-stream',
          sizeBytes: BigInt(stats.size),
          storageType: 'LOCAL',
          storagePath: relativePath,
          assetType: 'DOCUMENT',
          processingStatus: 'COMPLETED',
          uploadedById: user.id,
          metadata: {
            exportType: 'GEDCOM',
            generatedBy: 'api.export.gedcom',
            workspaceId: user.workspaceId,
            peopleCount: people.length,
            familyCount: families.length,
            validation: exportValidation,
          },
        },
      })

      const createdJob = await tx.exportJob.create({
        data: {
          workspaceId: user.workspaceId,
          exportType: 'GEDCOM',
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
      summary: {
        people: people.length,
        familyUnits: families.length,
        validation: exportValidation,
      },
    }, 201)
  },
})
