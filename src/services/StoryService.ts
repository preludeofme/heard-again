/**
 * StoryService - Business logic for story operations
 * Finding 5.1: Create Service Layer
 * Extracts business logic from API routes for testability and reusability
 */

import type { PrismaClient } from '@prisma/client'
import type {
  CreateStoryInput,
  ListStoriesQuery,
} from '@/schemas'
import type {
  StoryListItem,
  CreateStoryResponse,
  ListStoriesResponse,
  StorySubject,
  StorySpeaker,
  StoryCreator,
  StoryCounts,
} from '@/contracts'
import {
  StoryType,
  StoryStatus,
  DatePrecision,
} from '@/contracts'

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
  constructor(private prisma: PrismaClient) {}

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
      this.prisma.story.findMany({
        where,
        include: STORY_INCLUDE,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.story.count({ where }),
    ])

    return {
      stories: stories.map(this.mapToListItem),
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
    const story = await this.prisma.story.findFirst({
      where: { id: storyId, workspaceId },
      include: STORY_INCLUDE,
    })

    return story ? this.mapToListItem(story) : null
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

    const story = await this.prisma.story.create({
      data: {
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
        tags: data.tags ?? [],
        status: data.status ?? StoryStatus.DRAFT,
      },
    })

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
    data: Partial<CreateStoryInput>
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

    const story = await this.prisma.story.update({
      where: { id: storyId, workspaceId },
      data: updateData,
    })

    return {
      id: story.id,
      title: story.title,
      status: story.status as StoryStatus,
      createdAt: story.createdAt,
    }
  }

  /**
   * Delete a story
   */
  async deleteStory(storyId: string, workspaceId: string): Promise<void> {
    await this.prisma.story.delete({
      where: { id: storyId, workspaceId },
    })
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
      const subject = await this.prisma.person.findFirst({
        where: { id: subjectId, workspaceId },
      })
      if (!subject) {
        throw new Error(`Subject person not found: ${subjectId}`)
      }
    }

    if (speakerId) {
      const speaker = await this.prisma.person.findFirst({
        where: { id: speakerId, workspaceId },
      })
      if (!speaker) {
        throw new Error(`Speaker person not found: ${speakerId}`)
      }
    }
  }

  /**
   * Build Prisma where clause for story listing
   */
  private buildListWhereClause(
    workspaceId: string,
    filters: {
      search?: string
      status?: string
      subjectId?: string
      speakerId?: string
      type?: string
    }
  ) {
    const { search, status, subjectId, speakerId, type } = filters

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { workspaceId }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (status) where.status = status.toUpperCase()
    if (subjectId) where.subjectId = subjectId
    if (speakerId) where.speakerId = speakerId
    if (type) where.storyType = type.toUpperCase()

    return where
  }

  /**
   * Map Prisma story to list item DTO
   */
  private mapToListItem(
    story: {
      id: string
      title: string
      excerpt: string | null
      content: string
      storyType: string
      status: string
      isPinned: boolean
      storyDate: Date | null
      storyDatePrecision: string
      tags: string[]
      generatedAudioAssetId: string | null
      createdAt: Date
      updatedAt: Date
      subject: { id: string; firstName: string; lastName: string | null } | null
      speaker: { id: string; firstName: string; lastName: string | null } | null
      createdBy: { id: string; displayName: string | null; email: string }
      _count: { comments: number; assets: number; favorites: number }
    }
  ): StoryListItem {
    return {
      id: story.id,
      title: story.title,
      excerpt: story.excerpt || story.content.substring(0, 200),
      storyType: story.storyType as StoryType,
      status: story.status as StoryStatus,
      isPinned: story.isPinned,
      storyDate: story.storyDate,
      storyDatePrecision: story.storyDatePrecision as DatePrecision,
      tags: story.tags,
      subject: story.subject,
      speaker: story.speaker,
      createdBy: story.createdBy,
      hasAudio: !!story.generatedAudioAssetId,
      counts: story._count,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
    }
  }
}
