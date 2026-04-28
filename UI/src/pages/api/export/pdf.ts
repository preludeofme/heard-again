import fs from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function buildSimplePdf(lines: string[]): Buffer {
  const contentLines = ['BT', '/F1 11 Tf', '50 780 Td']
  lines.forEach((line, index) => {
    const escaped = escapePdfText(line)
    if (index === 0) {
      contentLines.push(`(${escaped}) Tj`)
    } else {
      contentLines.push('0 -16 Td')
      contentLines.push(`(${escaped}) Tj`)
    }
  })
  contentLines.push('ET')

  const contentStream = contentLines.join('\n')

  const objects: string[] = []
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n')
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n')
  objects.push(`5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`)

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'))
    pdf += obj
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8')
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'

  for (let i = 1; i <= objects.length; i += 1) {
    const offset = String(offsets[i]).padStart(10, '0')
    pdf += `${offset} 00000 n \n`
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return Buffer.from(pdf, 'utf8')
}

export default apiHandler({
  // POST /api/export/pdf - Generate PDF summary of stories
  POST: async (req, res) => {

    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'VIEWER')

    const [familyspace, stories] = await Promise.all([
      prisma.familyspace.findUnique({
        where: { id: user.familyspaceId },
        select: { id: true, name: true, slug: true },
      }),
      prisma.story.findMany({
        where: { familyspaceId: user.familyspaceId },
        select: {
          id: true,
          title: true,
          excerpt: true,
          storyType: true,
          createdAt: true,
          subject: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 120,
      }),
    ])

    const header = familyspace?.name ? `${familyspace.name} - Story Export` : 'Heard Again - Story Export'

    const lines: string[] = [
      header,
      `Generated: ${new Date().toISOString()}`,
      `Total stories: ${stories.length}`,
      '----------------------------------------',
    ]

    stories.forEach((story, index) => {
      const subjectName = story.subject
        ? `${story.subject.firstName}${story.subject.lastName ? ` ${story.subject.lastName}` : ''}`
        : 'Unknown Subject'

      lines.push(`${index + 1}. ${story.title}`)
      lines.push(`   Type: ${story.storyType} | Subject: ${subjectName}`)
      if (story.excerpt) {
        lines.push(`   ${story.excerpt.slice(0, 120)}`)
      }
      lines.push('')
    })

    const pdfBuffer = buildSimplePdf(lines.slice(0, 180))

    const exportDir = path.join(process.cwd(), 'exports', user.familyspaceId)
    await fs.mkdir(exportDir, { recursive: true })

    const fileName = `familyspace-stories-${Date.now()}.pdf`
    const absoluteFilePath = path.join(exportDir, fileName)
    await fs.writeFile(absoluteFilePath, pdfBuffer)

    const stats = await fs.stat(absoluteFilePath)
    const relativePath = path.relative(process.cwd(), absoluteFilePath)

    const [asset, exportJob] = await prisma.$transaction(async (tx) => {
      const createdAsset = await tx.asset.create({
        data: {
          familyspaceId: user.familyspaceId,
          filename: fileName,
          originalName: fileName,
          mimeType: 'application/pdf',
          sizeBytes: BigInt(stats.size),
          storageType: 'LOCAL',
          storagePath: relativePath,
          assetType: 'DOCUMENT',
          processingStatus: 'COMPLETED',
          uploadedById: user.id,
          metadata: {
            exportType: 'PDF',
            generatedBy: 'api.export.pdf',
            familyspaceId: user.familyspaceId,
            storyCount: stories.length,
          },
        },
      })

      const createdJob = await tx.exportJob.create({
        data: {
          familyspaceId: user.familyspaceId,
          exportType: 'PDF',
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
        stories: stories.length,
      },
    }, 201)
  },
})
