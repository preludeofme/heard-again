/**
 * @jest-environment node
 */

import { GedcomParser } from '@/server/services/gedcom/GedcomParser'
import { GedcomImportService } from '@/server/services/gedcom/GedcomImportService'
import { prisma } from '@/lib/prisma'
import AdmZip from 'adm-zip'

const mockUploadFile = jest.fn().mockResolvedValue({
  filename: 'secure-johndoe.jpg',
  sizeBytes: 100,
  storagePath: 'path/to/secure-johndoe.jpg',
})

const mockGetMode = jest.fn().mockReturnValue('LOCAL')

jest.mock('@/lib/storage/storage-service', () => ({
  getStorageService: () => ({
    uploadFile: mockUploadFile,
    getMode: mockGetMode,
  }),
}))

jest.mock('@/lib/security/file-validator', () => ({
  generateSecureFilename: (originalName: string) => `secure-${originalName}`,
}))

const gedcomContent = `0 HEAD
1 GEDC
2 VERS 5.5.1
2 FORM LINEAGE-LINKED
1 CHAR UTF-8
0 @I1@ INDI
1 NAME John /Doe/
2 GIVN John
2 SURN Doe
1 SEX M
1 BIRT
2 DATE 1 JAN 1990
1 OBJE
2 FILE images/johndoe.jpg
3 FORM jpg
3 TITL John Doe Portrait
0 @I2@ INDI
1 NAME Jane /Doe/
2 GIVN Jane
2 SURN Doe
1 SEX F
1 OBJE @O1@
0 @O1@ OBJE
1 FILE images/janedoe.png
2 FORM png
2 TITL Jane Doe Portrait
0 TRLR`

describe('Gedcom ZIP Media Import', () => {
  let zipBuffer: Buffer

  beforeAll(() => {
    const zip = new AdmZip()
    zip.addFile('tree.ged', Buffer.from(gedcomContent, 'utf-8'))
    zip.addFile('images/johndoe.jpg', Buffer.from('mock-jpeg-data'))
    zip.addFile('images/janedoe.png', Buffer.from('mock-png-data'))
    zipBuffer = zip.toBuffer()
  })

  it('correctly parses media links from GEDCOM content', () => {
    const { individuals } = GedcomParser.parse(gedcomContent)

    expect(individuals).toHaveLength(2)
    
    const john = individuals.find(i => i.xref === '@I1@')
    expect(john).toBeDefined()
    expect(john?.mediaLinks).toHaveLength(1)
    expect(john?.mediaLinks[0]).toEqual({
      filePath: 'images/johndoe.jpg',
      title: 'John Doe Portrait',
    })

    const jane = individuals.find(i => i.xref === '@I2@')
    expect(jane).toBeDefined()
    expect(jane?.mediaLinks).toHaveLength(1)
    expect(jane?.mediaLinks[0]).toEqual({
      filePath: 'images/janedoe.png',
      title: 'Jane Doe Portrait',
    })
  })

  it('previews a GEDCOM ZIP archive correctly', async () => {
    const service = new GedcomImportService()

    // Mock person.findFirst for matching
    const mockPerson = {
      id: 'existing-person-id',
      firstName: 'John',
      lastName: 'Doe',
      displayName: 'John Doe',
      birthDate: new Date('1990-01-01'),
      personType: 'FAMILY',
    }
    ;(prisma.person.findFirst as jest.Mock).mockResolvedValue(mockPerson)

    const preview = await service.previewGedcom('user-id', zipBuffer)

    expect(preview.summary.individualCount).toBe(2)
    expect(preview.summary.familyCount).toBe(0)
    expect(preview.potentialMatches).toHaveLength(1)
    expect(preview.potentialMatches[0]).toEqual({
      xref: '@I1@',
      fullName: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      confidence: 1,
    })
  })

  it('imports GEDCOM ZIP, extracts/uploads media, and saves relationships', async () => {
    const service = new GedcomImportService()

    // Mock Prisma transactions and methods
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(prisma)
    })

    // Setup mocks for relations that might not be mocked globally
    const prismaAny = prisma as any
    prismaAny.person.upsert = jest.fn()
    prismaAny.personExternalRef = {
      upsert: jest.fn(),
    }
    prismaAny.importJob = {
      update: jest.fn(),
      create: jest.fn(),
    }
    prismaAny.personName = {
      deleteMany: jest.fn(),
      create: jest.fn(),
    }
    prismaAny.personEvent = {
      deleteMany: jest.fn(),
      create: jest.fn(),
    }
    prismaAny.personNote = {
      deleteMany: jest.fn(),
      create: jest.fn(),
    }
    prismaAny.personSourceCitation = {
      deleteMany: jest.fn(),
      create: jest.fn(),
    }
    prismaAny.family = {
      upsert: jest.fn(),
    }
    prismaAny.familyMember = {
      createMany: jest.fn(),
    }

    const mockPerson1 = { id: 'person-1-id', gedcomXref: '@I1@', displayName: 'John Doe' }
    const mockPerson2 = { id: 'person-2-id', gedcomXref: '@I2@', displayName: 'Jane Doe' }

    ;(prisma.person.upsert as jest.Mock)
      .mockResolvedValueOnce(mockPerson1)
      .mockResolvedValueOnce(mockPerson2)

    const mockAsset1 = { id: 'asset-1-id' }
    const mockAsset2 = { id: 'asset-2-id' }
    ;(prisma.asset.create as jest.Mock)
      .mockResolvedValueOnce(mockAsset1)
      .mockResolvedValueOnce(mockAsset2)

    const mockDoc1 = { id: 'doc-1-id' }
    const mockDoc2 = { id: 'doc-2-id' }
    ;(prisma.document.create as jest.Mock)
      .mockResolvedValueOnce(mockDoc1)
      .mockResolvedValueOnce(mockDoc2)

    const mockImportJob = { id: 'job-id' }
    ;(prisma.importJob.update as jest.Mock).mockResolvedValue(mockImportJob)

    const stats = await service.importGedcom(
      'space-id',
      'user-id',
      zipBuffer,
      'source-asset-id',
      'job-id'
    )

    expect(stats.personUpserts).toBe(2)

    // Check S3/storage uploads were called
    expect(mockUploadFile).toHaveBeenCalledTimes(2)
    expect(mockUploadFile).toHaveBeenNthCalledWith(
      1,
      expect.any(Buffer),
      'secure-johndoe.jpg',
      'image/jpeg',
      { folder: 'familyspace-space-id/photos' }
    )
    expect(mockUploadFile).toHaveBeenNthCalledWith(
      2,
      expect.any(Buffer),
      'secure-janedoe.png',
      'image/png',
      { folder: 'familyspace-space-id/photos' }
    )

    // Check Asset creation in Prisma
    expect(prisma.asset.create).toHaveBeenCalledTimes(2)
    expect(prisma.asset.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          familyspaceId: 'space-id',
          filename: 'secure-johndoe.jpg',
          originalName: 'johndoe.jpg',
          mimeType: 'image/jpeg',
          assetType: 'IMAGE',
          uploadedById: 'user-id',
        }),
      })
    )

    // Check Document creation in Prisma
    expect(prisma.document.create).toHaveBeenCalledTimes(2)
    expect(prisma.document.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          familyspaceId: 'space-id',
          assetId: 'asset-1-id',
          title: 'John Doe Portrait',
          documentType: 'PHOTO',
          createdById: 'user-id',
        }),
      })
    )

    // Check linking of document to the subject
    expect(prisma.documentPerson.create).toHaveBeenCalledTimes(2)
    expect(prisma.documentPerson.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          documentId: 'doc-1-id',
          personId: 'person-1-id',
          role: 'subject',
        }),
      })
    )
  })
})
