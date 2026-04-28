import { BaseRepository } from './BaseRepository'
import type { Prisma, Document } from '@prisma/client'

export class DocumentRepository extends BaseRepository {
  async findById(id: string, familyspaceId: string, include?: Prisma.DocumentInclude): Promise<Document | null> {
    return this.prisma.document.findFirst({
      where: { id, familyspaceId },
      include,
    })
  }

  async findMany(familyspaceId: string, options: { 
    skip?: number, 
    take?: number,
    where?: Prisma.DocumentWhereInput,
    include?: Prisma.DocumentInclude 
  } = {}): Promise<Document[]> {
    return this.prisma.document.findMany({
      where: { 
        ...options.where,
        familyspaceId,
      },
      skip: options.skip,
      take: options.take,
      include: options.include,
      orderBy: { createdAt: 'desc' },
    })
  }

  async create(data: Prisma.DocumentCreateInput): Promise<Document> {
    return this.prisma.document.create({ data })
  }

  async update(id: string, familyspaceId: string, data: Prisma.DocumentUpdateInput): Promise<Document> {
    await this.prisma.document.findFirstOrThrow({
      where: { id, familyspaceId },
    })

    return this.prisma.document.update({
      where: { id },
      data,
    })
  }

  async delete(id: string, familyspaceId: string): Promise<Document> {
    await this.prisma.document.findFirstOrThrow({
      where: { id, familyspaceId },
    })

    return this.prisma.document.delete({
      where: { id },
    })
  }
}

export const documentRepository = new DocumentRepository()
