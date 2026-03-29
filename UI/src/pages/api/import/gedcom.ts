import fs from 'fs/promises'
import path from 'path'
import formidable from 'formidable'
import type { NextApiRequest, NextApiResponse } from 'next'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { validateFileContent, generateSecureFilename } from '@/lib/security/file-validator'

export const config = {
  api: {
    bodyParser: false,
  },
}

const IMPORT_DIR = path.join(process.cwd(), 'imports')

// Allowed MIME types for GEDCOM files
const ALLOWED_GEDCOM_MIME_TYPES = [
  'text/plain',
  'application/octet-stream',
] as const

interface ParsedIndividual {
  xref: string
  firstName: string
  lastName: string | null
  fullName: string
  nickname: string | null
  sex: 'M' | 'F' | 'U' | 'X' | null
  birthDate: Date | null
  birthPlace: string | null
  deathDate: Date | null
  deathPlace: string | null
  note: string | null
}

interface ParsedFamily {
  xref: string
  husbandXref: string | null
  wifeXref: string | null
  childXrefs: string[]
  marriageDate: Date | null
  marriagePlace: string | null
  divorceDate: Date | null
}

function parseGedcomDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const input = value.trim().toUpperCase()
  const months: Record<string, number> = {
    JAN: 0,
    FEB: 1,
    MAR: 2,
    APR: 3,
    MAY: 4,
    JUN: 5,
    JUL: 6,
    AUG: 7,
    SEP: 8,
    OCT: 9,
    NOV: 10,
    DEC: 11,
  }

  const dayMonthYear = input.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/)
  if (dayMonthYear) {
    const day = Number(dayMonthYear[1])
    const month = months[dayMonthYear[2]]
    const year = Number(dayMonthYear[3])
    if (Number.isInteger(month)) return new Date(Date.UTC(year, month, day))
  }

  const monthYear = input.match(/^([A-Z]{3})\s+(\d{4})$/)
  if (monthYear) {
    const month = months[monthYear[1]]
    const year = Number(monthYear[2])
    if (Number.isInteger(month)) return new Date(Date.UTC(year, month, 1))
  }

  const yearOnly = input.match(/^(\d{4})$/)
  if (yearOnly) {
    return new Date(Date.UTC(Number(yearOnly[1]), 0, 1))
  }

  return null
}

function parseNameValue(raw: string): { firstName: string; lastName: string | null; fullName: string } {
  const normalized = raw.trim()
  const match = normalized.match(/^(.*?)\s*\/(.*?)\//)

  if (match) {
    const firstName = match[1].trim() || 'Unknown'
    const lastName = match[2].trim() || null
    const fullName = [firstName, lastName].filter(Boolean).join(' ')
    return { firstName, lastName, fullName }
  }

  const parts = normalized.split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return { firstName: 'Unknown', lastName: null, fullName: 'Unknown' }
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null, fullName: parts[0] }
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
    fullName: parts.join(' '),
  }
}

function parseGedcom(content: string): { individuals: ParsedIndividual[]; families: ParsedFamily[] } {
  const lines = content.split(/\r?\n/)
  const individuals: ParsedIndividual[] = []
  const families: ParsedFamily[] = []

  let index = 0
  while (index < lines.length) {
    const line = lines[index].trim()
    const level0 = line.match(/^0\s+(@[^@]+@)\s+(INDI|FAM)$/)
    if (!level0) {
      index += 1
      continue
    }

    const xref = level0[1]
    const recordType = level0[2]
    const block: string[] = []
    index += 1

    while (index < lines.length && !/^0\s+/.test(lines[index].trim())) {
      block.push(lines[index].trim())
      index += 1
    }

    if (recordType === 'INDI') {
      let firstName = 'Unknown'
      let lastName: string | null = null
      let fullName = 'Unknown'
      let nickname: string | null = null
      let sex: 'M' | 'F' | 'U' | 'X' | null = null
      let birthDate: Date | null = null
      let birthPlace: string | null = null
      let deathDate: Date | null = null
      let deathPlace: string | null = null
      const notes: string[] = []

      for (let i = 0; i < block.length; i += 1) {
        const entry = block[i]
        const nameMatch = entry.match(/^1\s+NAME\s+(.+)$/)
        if (nameMatch && fullName === 'Unknown') {
          const parsed = parseNameValue(nameMatch[1])
          firstName = parsed.firstName
          lastName = parsed.lastName
          fullName = parsed.fullName
        }

        const nickMatch = entry.match(/^1\s+NICK\s+(.+)$/)
        if (nickMatch) {
          nickname = nickMatch[1].trim()
        }

        const sexMatch = entry.match(/^1\s+SEX\s+([MFXU])$/)
        if (sexMatch) {
          sex = sexMatch[1] as 'M' | 'F' | 'U' | 'X'
        }

        if (/^1\s+BIRT$/.test(entry)) {
          for (let j = i + 1; j < block.length; j += 1) {
            if (/^1\s+/.test(block[j])) break
            const dateMatch = block[j].match(/^2\s+DATE\s+(.+)$/)
            const placeMatch = block[j].match(/^2\s+PLAC\s+(.+)$/)
            if (dateMatch) birthDate = parseGedcomDate(dateMatch[1])
            if (placeMatch) birthPlace = placeMatch[1].trim()
          }
        }

        if (/^1\s+DEAT/.test(entry)) {
          for (let j = i + 1; j < block.length; j += 1) {
            if (/^1\s+/.test(block[j])) break
            const dateMatch = block[j].match(/^2\s+DATE\s+(.+)$/)
            const placeMatch = block[j].match(/^2\s+PLAC\s+(.+)$/)
            if (dateMatch) deathDate = parseGedcomDate(dateMatch[1])
            if (placeMatch) deathPlace = placeMatch[1].trim()
          }
        }

        const noteMatch = entry.match(/^1\s+NOTE\s+(.+)$/)
        if (noteMatch) {
          notes.push(noteMatch[1].trim())
        }
      }

      individuals.push({
        xref,
        firstName,
        lastName,
        fullName,
        nickname,
        sex,
        birthDate,
        birthPlace,
        deathDate,
        deathPlace,
        note: notes.length > 0 ? notes.join('\n') : null,
      })
      continue
    }

    let husbandXref: string | null = null
    let wifeXref: string | null = null
    const childXrefs: string[] = []
    let marriageDate: Date | null = null
    let marriagePlace: string | null = null
    let divorceDate: Date | null = null

    for (let i = 0; i < block.length; i += 1) {
      const entry = block[i]
      const husbMatch = entry.match(/^1\s+HUSB\s+(@[^@]+@)$/)
      if (husbMatch) husbandXref = husbMatch[1]

      const wifeMatch = entry.match(/^1\s+WIFE\s+(@[^@]+@)$/)
      if (wifeMatch) wifeXref = wifeMatch[1]

      const childMatch = entry.match(/^1\s+CHIL\s+(@[^@]+@)$/)
      if (childMatch) childXrefs.push(childMatch[1])

      if (/^1\s+MARR$/.test(entry)) {
        for (let j = i + 1; j < block.length; j += 1) {
          if (/^1\s+/.test(block[j])) break
          const dateMatch = block[j].match(/^2\s+DATE\s+(.+)$/)
          const placeMatch = block[j].match(/^2\s+PLAC\s+(.+)$/)
          if (dateMatch) marriageDate = parseGedcomDate(dateMatch[1])
          if (placeMatch) marriagePlace = placeMatch[1].trim()
        }
      }

      if (/^1\s+DIV/.test(entry)) {
        for (let j = i + 1; j < block.length; j += 1) {
          if (/^1\s+/.test(block[j])) break
          const dateMatch = block[j].match(/^2\s+DATE\s+(.+)$/)
          if (dateMatch) divorceDate = parseGedcomDate(dateMatch[1])
        }
      }
    }

    families.push({
      xref,
      husbandXref,
      wifeXref,
      childXrefs,
      marriageDate,
      marriagePlace,
      divorceDate,
    })
  }

  return { individuals, families }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return errorResponse(res, 'Method not allowed', 405)
  }

  try {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const workspaceDir = path.join(IMPORT_DIR, user.workspaceId, 'gedcom')
    await fs.mkdir(workspaceDir, { recursive: true })

    const form = formidable({
      keepExtensions: false, // Don't trust original extensions
      maxFileSize: 100 * 1024 * 1024,
      uploadDir: workspaceDir, // Restrict to secure workspace directory
      filename: () => `${uuidv4()}.tmp`, // Use temporary extension
    })

    const [, files] = await form.parse(req)
    const fileArray = files.file

    if (!fileArray || fileArray.length === 0) {
      return errorResponse(res, 'No GEDCOM file provided', 400)
    }

    const file = fileArray[0]

    // Validate file content to prevent malicious uploads
    const fileBuffer = await fs.readFile(file.filepath)
    
    const validationResult = await validateFileContent(
      fileBuffer,
      file.originalFilename || 'gedcom.ged',
      file.mimetype || undefined
    )

    if (!validationResult.isValid) {
      console.error('GEDCOM file validation failed:', {
        filename: file.originalFilename,
        error: validationResult.error,
        securityRisk: validationResult.securityRisk,
        detectedType: validationResult.detectedType
      })
      
      // Clean up temporary file
      await fs.unlink(file.filepath).catch(() => {})
      
      return errorResponse(
        res,
        validationResult.error || 'GEDCOM file validation failed',
        400
      )
    }

    // Ensure file is an allowed type for GEDCOM
    if (!ALLOWED_GEDCOM_MIME_TYPES.includes(validationResult.detectedType! as any)) {
      await fs.unlink(file.filepath).catch(() => {})
      return errorResponse(res, `File type '${validationResult.detectedType}' is not allowed for GEDCOM import`, 400)
    }

    // Generate secure filename with .ged extension
    const secureFilename = generateSecureFilename(
      file.originalFilename || 'gedcom.ged',
      'text/plain' // Force plain text MIME for GEDCOM
    ).replace(/\.[^.]+$/, '.ged') // Force .ged extension

    // Move to final location with secure name
    const finalPath = path.join(workspaceDir, secureFilename)
    await fs.rename(file.filepath, finalPath)

    const content = await fs.readFile(finalPath, 'utf-8')
    const { individuals, families } = parseGedcom(content)
    const relativePath = path.relative(process.cwd(), finalPath)

    if (individuals.length === 0) {
      return errorResponse(res, 'No GEDCOM individuals found in file', 400)
    }

    const [asset, importJob] = await prisma.$transaction(async (tx) => {
      const createdAsset = await tx.asset.create({
        data: {
          workspaceId: user.workspaceId,
          filename: path.basename(finalPath),
          originalName: file.originalFilename || 'import.ged',
          mimeType: 'text/plain',
          sizeBytes: BigInt(fileBuffer.length),
          storageType: 'LOCAL',
          storagePath: relativePath,
          assetType: 'DOCUMENT',
          processingStatus: 'COMPLETED',
          uploadedById: user.id,
          metadata: {
            importType: 'GEDCOM',
            validatedType: 'text/plain',
            secureFilename: secureFilename,
          },
        },
      })

      const importedPersonIds: Record<string, string> = {}
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

      for (const individual of individuals) {
        const person = await tx.person.upsert({
          where: {
            workspaceId_gedcomXref: {
              workspaceId: user.workspaceId,
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
            workspaceId: user.workspaceId,
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
            createdById: user.id,
          },
        })
        importStats.personUpserts += 1

        importedPersonIds[individual.xref] = person.id

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
            metadata: {
              importSourceAssetId: createdAsset.id,
            },
          },
          create: {
            personId: person.id,
            system: 'GEDCOM',
            externalId: individual.xref,
            metadata: {
              importSourceAssetId: createdAsset.id,
            },
          },
        })
        importStats.personExternalRefUpserts += 1
      }

      for (const family of families) {
        const familyUnit = await tx.familyUnit.upsert({
          where: {
            workspaceId_gedcomXref: {
              workspaceId: user.workspaceId,
              gedcomXref: family.xref,
            },
          },
          update: {
            marriageDate: family.marriageDate,
            marriagePlace: family.marriagePlace,
            divorceDate: family.divorceDate,
          },
          create: {
            workspaceId: user.workspaceId,
            gedcomXref: family.xref,
            marriageDate: family.marriageDate,
            marriagePlace: family.marriagePlace,
            divorceDate: family.divorceDate,
          },
        })
        importStats.familyUpserts += 1

        // Delete existing parent/child links for this family
        await tx.familyParent.deleteMany({ where: { familyId: familyUnit.id } })
        await tx.familyChild.deleteMany({ where: { familyId: familyUnit.id } })

        // Create parent links - GEDCOM HUSB/WIFE become parents with BIOLOGICAL relationship
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

      const createdJob = await tx.importJob.create({
        data: {
          workspaceId: user.workspaceId,
          sourceType: 'GEDCOM',
          sourceAssetId: createdAsset.id,
          status: 'COMPLETED',
          importedById: user.id,
          startedAt: new Date(),
          completedAt: new Date(),
          resultSummary: importStats,
        },
      })

      return [createdAsset, createdJob]
    })

    return successResponse(res, {
      jobId: importJob.id,
      status: importJob.status,
      sourceType: importJob.sourceType,
      sourceAssetId: asset.id,
      fileName: asset.originalName,
      resultSummary: importJob.resultSummary,
    }, 201)
  } catch (error: any) {
    return errorResponse(res, error.message || 'GEDCOM import failed', error.statusCode || 500)
  }
}
