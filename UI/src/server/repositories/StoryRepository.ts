import { BaseRepository } from './BaseRepository'
import type { Prisma, Story } from '@prisma/client'

export class StoryRepository extends BaseRepository {
  async findById(id: string, familyspaceId?: string, include?: Prisma.StoryInclude): Promise<Story | null> {
    const where: Prisma.StoryWhereInput = { id }
    if (familyspaceId) {
      where.familyspaceId = familyspaceId
    }
    return this.prisma.story.findFirst({
      where,
      include,
    })
  }

  async findMany(familyspaceId: string, options: { 
    skip?: number, 
    take?: number,
    where?: Prisma.StoryWhereInput,
    include?: Prisma.StoryInclude 
  } = {}): Promise<Story[]> {
    return this.prisma.story.findMany({
      where: { 
        ...options.where,
        familyspaceId,
      },
      skip: options.skip,
      take: options.take,
      include: options.include,
      orderBy: { updatedAt: 'desc' },
    })
  }

  async create(data: Prisma.StoryUncheckedCreateInput, userId: string | null): Promise<Story> {
    const story = await this.prisma.story.create({ data: data as any })
    
    if (userId) {
      await this.audit({
        familyspaceId: story.familyspaceId,
        actorId: userId,
        actorType: 'USER',
        action: 'CREATE',
        resourceType: 'STORY',
        resourceId: story.id,
        afterState: story,
      })
    }

    return story
  }

  async update(id: string, familyspaceId: string, data: Prisma.StoryUncheckedUpdateInput, userId: string | null): Promise<Story> {
    const before = await this.prisma.story.findFirstOrThrow({
      where: { id, familyspaceId },
    })

    const story = await this.prisma.story.update({
      where: { id },
      data: data as any,
    })

    if (userId) {
      await this.audit({
        familyspaceId,
        actorId: userId,
        actorType: 'USER',
        action: 'UPDATE',
        resourceType: 'STORY',
        resourceId: story.id,
        beforeState: before,
        afterState: story,
      })
    }

    return story
  }

  async delete(id: string, familyspaceId: string, userId: string): Promise<Story> {
    const before = await this.prisma.story.findFirstOrThrow({
      where: { id, familyspaceId },
    })

    const story = await this.prisma.story.delete({
      where: { id },
    })

    await this.audit({
      familyspaceId,
      actorId: userId,
      actorType: 'USER',
      action: 'DELETE',
      resourceType: 'STORY',
      resourceId: story.id,
      beforeState: before,
    })

    return story
  }

  async count(familyspaceId: string, where?: Prisma.StoryWhereInput): Promise<number> {
    return this.prisma.story.count({
      where: {
        ...where,
        familyspaceId,
      },
    })
  }
}

export const storyRepository = new StoryRepository()
