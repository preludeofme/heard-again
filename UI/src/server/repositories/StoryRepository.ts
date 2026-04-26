import { BaseRepository } from './BaseRepository'
import type { Prisma, Story } from '@prisma/client'

export class StoryRepository extends BaseRepository {
  async findById(id: string, workspaceId: string, include?: Prisma.StoryInclude): Promise<Story | null> {
    return this.prisma.story.findFirst({
      where: { id, workspaceId },
      include,
    })
  }

  async findMany(workspaceId: string, options: { 
    skip?: number, 
    take?: number,
    where?: Prisma.StoryWhereInput,
    include?: Prisma.StoryInclude 
  } = {}): Promise<Story[]> {
    return this.prisma.story.findMany({
      where: { 
        ...options.where,
        workspaceId,
      },
      skip: options.skip,
      take: options.take,
      include: options.include,
      orderBy: { updatedAt: 'desc' },
    })
  }

  async create(data: Prisma.StoryUncheckedCreateInput, userId: string): Promise<Story> {
    const story = await this.prisma.story.create({ data: data as any })
    
    await this.audit({
      workspaceId: story.workspaceId,
      actorId: userId,
      actorType: 'USER',
      action: 'CREATE',
      resourceType: 'STORY',
      resourceId: story.id,
      afterState: story,
    })

    return story
  }

  async update(id: string, workspaceId: string, data: Prisma.StoryUncheckedUpdateInput, userId: string): Promise<Story> {
    const before = await this.prisma.story.findFirstOrThrow({
      where: { id, workspaceId },
    })

    const story = await this.prisma.story.update({
      where: { id },
      data: data as any,
    })

    await this.audit({
      workspaceId,
      actorId: userId,
      actorType: 'USER',
      action: 'UPDATE',
      resourceType: 'STORY',
      resourceId: story.id,
      beforeState: before,
      afterState: story,
    })

    return story
  }

  async delete(id: string, workspaceId: string, userId: string): Promise<Story> {
    const before = await this.prisma.story.findFirstOrThrow({
      where: { id, workspaceId },
    })

    const story = await this.prisma.story.delete({
      where: { id },
    })

    await this.audit({
      workspaceId,
      actorId: userId,
      actorType: 'USER',
      action: 'DELETE',
      resourceType: 'STORY',
      resourceId: story.id,
      beforeState: before,
    })

    return story
  }

  async count(workspaceId: string, where?: Prisma.StoryWhereInput): Promise<number> {
    return this.prisma.story.count({
      where: {
        ...where,
        workspaceId,
      },
    })
  }
}

export const storyRepository = new StoryRepository()
