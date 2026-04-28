import { BaseRepository } from './BaseRepository'
import type { Prisma, Familyspace } from '@prisma/client'

export class FamilyspaceRepository extends BaseRepository {
  async findById(id: string): Promise<Familyspace | null> {
    return this.prisma.familyspace.findUnique({
      where: { id },
    })
  }

  async findBySlug(slug: string): Promise<Familyspace | null> {
    return this.prisma.familyspace.findUnique({
      where: { slug },
    })
  }

  async create(data: Prisma.FamilyspaceCreateInput): Promise<Familyspace> {
    return this.prisma.familyspace.create({ data })
  }

  async update(id: string, data: Prisma.FamilyspaceUpdateInput): Promise<Familyspace> {
    return this.prisma.familyspace.update({
      where: { id },
      data,
    })
  }

  async getMembers(id: string) {
    return this.prisma.membership.findMany({
      where: { familyspaceId: id },
      include: {
        user: {
          select: { id: true, email: true, displayName: true },
        },
      },
    })
  }
}

export const familyspaceRepository = new FamilyspaceRepository()
