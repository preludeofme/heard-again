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
  subject: { select: { id: true; firstName: true; lastName: true; avatarAssetId: true } }
  speaker: { select: { id: true; firstName: true; lastName: true; avatarAssetId: true } }
  createdBy: { select: { id: true; displayName: true; email: true; avatarUrl: true } }
  generatedAudioAsset: { select: { id: true; storagePath: true; durationSeconds: true } }
  _count: { select: { comments: true; assets: true; favorites: true } }
}

const STORY_INCLUDE: StoryInclude = {
  subject: { select: { id: true, firstName: true, lastName: true, avatarAssetId: true } },
  speaker: { select: { id: true, firstName: true, lastName: true, avatarAssetId: true } },
  createdBy: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
  generatedAudioAsset: { select: { id: true, storagePath: true, durationSeconds: true } },
  _count: { select: { comments: true, assets: true, favorites: true } },
}

export class StoryService {
  constructor(private repo: StoryRepository = storyRepository) {}

  /**
   * List stories for a familyspace with filtering and pagination
   */
  async listStories(
    familyspaceId: string,
    query: ListStoriesQuery
  ): Promise<ListStoriesResponse> {
    const { page = 1, limit = 20, search, status, subjectId, speakerId, type } = query
    const skip = (page - 1) * limit

    const where = this.buildListWhereClause(familyspaceId, { search, status, subjectId, speakerId, type })

    const [stories, total] = await Promise.all([
      this.repo.findMany(familyspaceId, {
        where,
        include: STORY_INCLUDE,
        skip,
        take: limit,
      }),
      this.repo.count(familyspaceId, where),
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
    familyspaceId: string
  ): Promise<StoryListItem | null> {
    const story = await this.repo.findById(storyId, familyspaceId, STORY_INCLUDE)

    return story ? this.mapToListItem(story as any) : null
  }

  /**
   * Create a new story
   */
  async createStory(
    familyspaceId: string,
    userId: string | null,
    data: CreateStoryInput
  ): Promise<CreateStoryResponse> {
    // Validate subject/speaker belong to familyspace if provided
    await this.validateStoryReferences(familyspaceId, data.subjectId ?? undefined, data.speakerId ?? undefined)

    // Handle audio asset for recordings
    let generatedAudioAssetId = null
    if (data.storyType === StoryType.RECORDING && data.assetIds?.length) {
      generatedAudioAssetId = data.assetIds[0]
    }

    const excerpt = data.excerpt ?? (data.content ? data.content.replace(/<[^>]*>/g, '').substring(0, 200) : '')

    const story = await this.repo.create({
      familyspaceId,
      createdById: userId,
      title: data.title,
      content: data.content,
      storyType: data.storyType ?? StoryType.MEMORY,
      subjectId: data.subjectId ?? null,
      speakerId: data.speakerId ?? null,
      generatedAudioAssetId,
      excerpt: excerpt,
      storyDate: data.storyDate ? new Date(data.storyDate) : null,
      storyDatePrecision: data.storyDatePrecision ?? DatePrecision.EXACT,
      location: data.location ?? null,
      tags: data.tags ?? [],
      status: data.status ?? StoryStatus.PUBLISHED,
      authorRelationship: data.authorRelationship ?? null,
      isPublic: data.isPublic ?? false,
    }, userId)

    // Link other assets if any
    if (data.assetIds && data.assetIds.length > 0) {
      // In a real implementation, we would create StoryAsset records here
      // For now, focusing on the primary audio recording
    }

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
    familyspaceId: string,
    data: Partial<CreateStoryInput>,
    userId: string
  ): Promise<CreateStoryResponse> {
    // Validate subject/speaker if changing
    if (data.subjectId || data.speakerId) {
      await this.validateStoryReferences(familyspaceId, data.subjectId ?? undefined, data.speakerId ?? undefined)
    }

    const updateData: Record<string, unknown> = {}
    
    if (data.title !== undefined) updateData.title = data.title
    if (data.content !== undefined) {
      updateData.content = data.content
      // Update excerpt if content changed and no explicit excerpt provided
      if (!data.excerpt) {
        updateData.excerpt = data.content.replace(/<[^>]*>/g, '').substring(0, 200)
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
    if (data.authorRelationship !== undefined) updateData.authorRelationship = data.authorRelationship ?? null
    if (data.isPublic !== undefined) updateData.isPublic = data.isPublic ?? false

    // Handle audio asset for recordings if provided
    if (data.assetIds?.length) {
      // Determine if this is currently a recording or being changed to one
      const currentStory = await this.repo.findById(storyId, familyspaceId)
      const isRecording = data.storyType === StoryType.RECORDING || 
                         (!data.storyType && currentStory?.storyType === StoryType.RECORDING)
      
      if (isRecording) {
        updateData.generatedAudioAssetId = data.assetIds[0]
      }
    }

    const story = await this.repo.update(storyId, familyspaceId, updateData, userId)

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
    familyspaceId?: string
  ): Promise<any> {
    const story = await this.repo.findById(storyId, familyspaceId, {
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
          person: {
            select: { id: true, firstName: true, lastName: true, displayName: true },
          },
          replies: {
            include: {
              user: {
                select: { id: true, displayName: true, avatarUrl: true },
              },
              person: {
                select: { id: true, firstName: true, lastName: true, displayName: true },
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
  async deleteStory(storyId: string, familyspaceId: string, userId: string): Promise<void> {
    await this.repo.delete(storyId, familyspaceId, userId)
  }

  /**
   * Map Prisma story to list item DTO
   */
  private mapToListItem(story: any): StoryListItem {
    const subjectAvatarUrl = story.subject?.avatarAssetId
      ? `/api/assets/serve/${story.subject.avatarAssetId}`
      : null
    const speakerAvatarUrl = story.speaker?.avatarAssetId
      ? `/api/assets/serve/${story.speaker.avatarAssetId}`
      : null
    return {
      id: story.id,
      title: story.title,
      content: story.content,
      excerpt: story.excerpt || '',
      storyType: story.storyType as StoryType,
      status: story.status as StoryStatus,
      isPinned: story.isPinned,
      storyDate: story.storyDate,
      storyDatePrecision: story.storyDatePrecision as DatePrecision,
      tags: story.tags,
      authorRelationship: story.authorRelationship,
      isPublic: story.isPublic,
      subject: story.subject ? { ...story.subject, avatarUrl: subjectAvatarUrl } : null,
      speaker: story.speaker ? { ...story.speaker, avatarUrl: speakerAvatarUrl } : null,
      createdBy: story.createdBy,
      hasAudio: !!story.generatedAudioAssetId,
      audioUrl: story.generatedAudioAsset?.storagePath || null,
      durationSeconds: story.generatedAudioAsset?.durationSeconds || null,
      counts: story._count,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
    }
  }

  /**
   * Build Prisma where clause for story listing
   */
  private buildListWhereClause(familyspaceId: string, filters: any): any {
    const where: any = { familyspaceId }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { content: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    if (filters.status) where.status = filters.status
    if (filters.type) where.storyType = filters.type
    
    // If a subjectId is provided, show stories where they are subject OR speaker
    if (filters.subjectId) {
      where.OR = [
        { subjectId: filters.subjectId },
        { speakerId: filters.subjectId },
      ]
    } else if (filters.speakerId) {
      // Fallback for speakerId if subjectId not provided
      where.OR = [
        { subjectId: filters.speakerId },
        { speakerId: filters.speakerId },
      ]
    }

    return where
  }

  /**
   * Validate that referenced persons exist and belong to the familyspace
   */
  private async validateStoryReferences(
    familyspaceId: string,
    subjectId?: string,
    speakerId?: string
  ): Promise<void> {
    if (subjectId) {
      const subject = await personRepository.findById(subjectId, familyspaceId)
      if (!subject) {
        throw new Error(`Subject person not found: ${subjectId}`)
      }
    }

    if (speakerId) {
      const speaker = await personRepository.findById(speakerId, familyspaceId)
      if (!speaker) {
        throw new Error(`Speaker person not found: ${speakerId}`)
      }
    }
  }
}
