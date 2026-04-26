import type {
  CreateStoryInput,
  ListStoriesQuery,
} from '@/schemas'
import type {
  StoryListItem,
  CreateStoryResponse,
  ListStoriesResponse,
} from '@/contracts'
import {
  StoryType,
  StoryStatus,
  DatePrecision,
} from '@/contracts'
import { storyRepository, StoryRepository } from '@/server/repositories/StoryRepository'
import { personRepository } from '@/server/repositories/PersonRepository'

// Story inclusion type for Prisma queries
type StoryInclude = {
  subject: { select: { id: true; firstName: true; lastName: true } }
  speaker: { select: { id: true; firstName: true; lastName: true } }
  createdBy: { select: { id: true; displayName: true; email: true } }
  _count: { select: { comments: true; assets: true; favorites: true } }
}

const STORY_INCLUDE: StoryInclude = {
  subject: { select: { id: true, firstName: true, lastName: true } },
  speaker: { select: { id: true, firstName: true, lastName: true } },
  createdBy: { select: { id: true, displayName: true, email: true } },
  _count: { select: { comments: true, assets: true, favorites: true } },
}

export class StoryService {
  constructor(private repo: StoryRepository = storyRepository) {}

  /**
   * List stories for a workspace with filtering and pagination
   */
  async listStories(
    workspaceId: string,
    query: ListStoriesQuery
  ): Promise<ListStoriesResponse> {
    const { page = 1, limit = 20, search, status, subjectId, speakerId, type } = query
    const skip = (page - 1) * limit

    const where = this.buildListWhereClause(workspaceId, { search, status, subjectId, speakerId, type })

    const [stories, total] = await Promise.all([
      this.repo.findMany(workspaceId, {
        where,
        include: STORY_INCLUDE,
        skip,
        take: limit,
      }),
      this.repo.count(workspaceId, where),
    ])

    return {
      stories: (stories as any[]).map(this.mapToListItem),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Get a single story by ID
   */
  async getStory(
    storyId: string,
    workspaceId: string
  ): Promise<StoryListItem | null> {
    const story = await this.repo.findById(storyId, workspaceId, STORY_INCLUDE)

    return story ? this.mapToListItem(story as any) : null
  }

  /**
   * Create a new story
   */
  async createStory(
    workspaceId: string,
    userId: string,
    data: CreateStoryInput
  ): Promise<CreateStoryResponse> {
    // Validate subject/speaker belong to workspace if provided
    await this.validateStoryReferences(workspaceId, data.subjectId, data.speakerId)

    const story = await this.repo.create({
      workspaceId,
      createdById: userId,
      title: data.title,
      content: data.content,
      storyType: data.storyType ?? StoryType.MEMORY,
      subjectId: data.subjectId ?? null,
      speakerId: data.speakerId ?? null,
      excerpt: data.excerpt ?? data.content.substring(0, 200),
      storyDate: data.storyDate ? new Date(data.storyDate) : null,
      storyDatePrecision: data.storyDatePrecision ?? DatePrecision.EXACT,
      location: data.location ?? null,
      tags: data.tags ?? [],
      status: data.status ?? StoryStatus.PUBLISHED,
    }, userId)

    return {
      id: story.id,
      title: story.title,
      status: story.status as StoryStatus,
      createdAt: story.createdAt,
    }
  }

  /**
   * Update an existing story
   */
  async updateStory(
    storyId: string,
    workspaceId: string,
    data: Partial<CreateStoryInput>,
    userId: string
  ): Promise<CreateStoryResponse> {
    // Validate subject/speaker if changing
    if (data.subjectId || data.speakerId) {
      await this.validateStoryReferences(workspaceId, data.subjectId, data.speakerId)
    }

    const updateData: Record<string, unknown> = {}
    
    if (data.title !== undefined) updateData.title = data.title
    if (data.content !== undefined) {
      updateData.content = data.content
      // Update excerpt if content changed and no explicit excerpt provided
      if (!data.excerpt) {
        updateData.excerpt = data.content.substring(0, 200)
      }
    }
    if (data.excerpt !== undefined) updateData.excerpt = data.excerpt
    if (data.storyType !== undefined) updateData.storyType = data.storyType
    if (data.subjectId !== undefined) updateData.subjectId = data.subjectId ?? null
    if (data.speakerId !== undefined) updateData.speakerId = data.speakerId ?? null
    if (data.storyDate !== undefined) updateData.storyDate = data.storyDate ? new Date(data.storyDate) : null
    if (data.storyDatePrecision !== undefined) updateData.storyDatePrecision = data.storyDatePrecision
    if (data.tags !== undefined) updateData.tags = data.tags
    if (data.status !== undefined) updateData.status = data.status

    const story = await this.repo.update(storyId, workspaceId, updateData, userId)

    return {
      id: story.id,
      title: story.title,
      status: story.status as StoryStatus,
      createdAt: story.createdAt,
    }
  }

  /**
   * Get complex story detail including assets, comments, and narration info
   */
  async getStoryDetail(
    storyId: string,
    workspaceId: string
  ): Promise<any> {
    const story = await this.repo.findById(storyId, workspaceId, {
      subject: {
        select: { id: true, firstName: true, lastName: true, nickname: true },
      },
      speaker: {
        select: { id: true, firstName: true, lastName: true, nickname: true },
      },
      createdBy: {
        select: { id: true, displayName: true, email: true, avatarUrl: true },
      },
      voiceProfile: {
        select: { id: true, name: true },
      },
      generatedAudioAsset: {
        select: {
          id: true,
          storagePath: true,
          durationSeconds: true,
          mimeType: true,
          metadata: true,
        },
      },
      assets: {
        include: {
          asset: {
            select: {
              id: true, filename: true, originalName: true, mimeType: true,
              assetType: true, storagePath: true, durationSeconds: true, transcript: true,
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
      comments: {
        where: { parentId: null },
        include: {
          user: {
            select: { id: true, displayName: true, avatarUrl: true },
          },
          replies: {
            include: {
              user: {
                select: { id: true, displayName: true, avatarUrl: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: { favorites: true },
      },
    })

    if (!story) return null

    // Surface voiceProfileId from the asset's JSON metadata
    const generatedAudio = (story as any).generatedAudioAsset
      ? {
          id: (story as any).generatedAudioAsset.id,
          storagePath: (story as any).generatedAudioAsset.storagePath,
          durationSeconds: (story as any).generatedAudioAsset.durationSeconds,
          mimeType: (story as any).generatedAudioAsset.mimeType,
          voiceProfileId:
            ((story as any).generatedAudioAsset.metadata as { voiceProfileId?: string } | null)
              ?.voiceProfileId ?? null,
        }
      : null

    return {
      ...story,
      generatedAudio,
      assets: (story as any).assets.map((sa: any) => ({
        id: sa.id,
        role: sa.assetRole,
        sortOrder: sa.sortOrder,
        caption: sa.caption,
        asset: sa.asset,
      })),
      favoriteCount: (story as any)._count.favorites,
    }
  }

  /**
   * Delete a story
   */
  async deleteStory(storyId: string, workspaceId: string, userId: string): Promise<void> {
    await this.repo.delete(storyId, workspaceId, userId)
  }

  /**
   * Map Prisma story to list item DTO
   */
  private mapToListItem(story: any): StoryListItem {
    return {
      id: story.id,
      title: story.title,
      excerpt: story.excerpt || '',
      storyType: story.storyType as StoryType,
      status: story.status as StoryStatus,
      isPinned: story.isPinned,
      storyDate: story.storyDate,
      subject: story.subject,
      speaker: story.speaker,
      createdBy: story.createdBy,
      hasAudio: !!story.generatedAudioAssetId,
      counts: story._count,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
    }
  }

  /**
   * Build Prisma where clause for story listing
   */
  private buildListWhereClause(workspaceId: string, filters: any): any {
    const where: any = { workspaceId }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { content: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    if (filters.status) where.status = filters.status
    if (filters.type) where.storyType = filters.type
    if (filters.subjectId) where.subjectId = filters.subjectId
    if (filters.speakerId) where.speakerId = filters.speakerId

    return where
  }

  /**
   * Validate that referenced persons exist and belong to the workspace
   */
  private async validateStoryReferences(
    workspaceId: string,
    subjectId?: string,
    speakerId?: string
  ): Promise<void> {
    if (subjectId) {
      const subject = await personRepository.findById(subjectId, workspaceId)
      if (!subject) {
        throw new Error(`Subject person not found: ${subjectId}`)
      }
    }

    if (speakerId) {
      const speaker = await personRepository.findById(speakerId, workspaceId)
      if (!speaker) {
        throw new Error(`Speaker person not found: ${speakerId}`)
      }
    }
  }
}
