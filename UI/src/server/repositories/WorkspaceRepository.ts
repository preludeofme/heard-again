import { BaseRepository } from './BaseRepository'
import type { Prisma, Workspace } from '@prisma/client'

export class WorkspaceRepository extends BaseRepository {
  async findById(id: string): Promise<Workspace | null> {
    return this.prisma.workspace.findUnique({
      where: { id },
    })
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    return this.prisma.workspace.findUnique({
      where: { slug },
    })
  }

  async create(data: Prisma.WorkspaceCreateInput): Promise<Workspace> {
    return this.prisma.workspace.create({ data })
  }

  async update(id: string, data: Prisma.WorkspaceUpdateInput): Promise<Workspace> {
    return this.prisma.workspace.update({
      where: { id },
      data,
    })
  }

  async getMembers(id: string) {
    return this.prisma.membership.findMany({
      where: { workspaceId: id },
      include: {
        user: {
          select: { id: true, email: true, displayName: true },
        },
      },
    })
  }
}

export const workspaceRepository = new WorkspaceRepository()
