/**
 * SearchService - Business logic for global search across entities
 * Finding 5.1: Create Service Layer - Extracted from /api/search/index.ts
 */

import type { PrismaClient } from '@prisma/client'

export interface SearchQuery {
  familyspaceId: string
  query: string
  limit: number
}

export interface SearchResult {
  stories: Array<{
    id: string
    title: string
    excerpt: string | null
    storyType: string
    status: string
    createdAt: Date
    subject: {
      id: string
      firstName: string
      lastName: string | null
    } | null
  }>
  people: Array<{
    id: string
    firstName: string
    lastName: string | null
    displayName: string | null
    personType: string
    isDeceased: boolean
    avatarAssetId: string | null
  }>
  assets: Array<{
    id: string
    originalName: string
    assetType: string
    mimeType: string
    createdAt: Date
  }>
  totalResults: number
}

export interface SearchSuggestion {
  id: string
  type: 'person' | 'story' | 'asset'
  label: string
  subtitle?: string
}

const MAX_SEARCH_LIMIT = 50
const DEFAULT_SEARCH_LIMIT = 10

export class SearchService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Search across stories, people, and assets
   */
  async search(request: SearchQuery): Promise<SearchResult> {
    const { familyspaceId, query, limit } = request
    const searchLimit = Math.min(limit || DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT)

    // Return empty results for empty query
    if (!query.trim()) {
      return { stories: [], people: [], assets: [], totalResults: 0 }
    }

    const [stories, people, assets] = await Promise.all([
      this.searchStories(familyspaceId, query, searchLimit),
      this.searchPeople(familyspaceId, query, searchLimit),
      this.searchAssets(familyspaceId, query, searchLimit),
    ])

    return {
      stories,
      people,
      assets,
      totalResults: stories.length + people.length + assets.length,
    }
  }

  /**
   * Search stories by title, content, or tags
   */
  private async searchStories(
    familyspaceId: string,
    query: string,
    limit: number
  ): Promise<SearchResult['stories']> {
    const tokens = query.split(/\s+/).filter(Boolean)
    return this.prisma.story.findMany({
      where: {
        familyspaceId,
        AND: tokens.map(token => ({
          OR: [
            { title: { contains: token, mode: 'insensitive' } },
            { content: { contains: token, mode: 'insensitive' } },
            { tags: { hasSome: [token] } },
          ],
        }))
      },
      select: {
        id: true,
        title: true,
        excerpt: true,
        storyType: true,
        status: true,
        createdAt: true,
        subject: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    })
  }

  /**
   * Search people by name or bio
   */
  private async searchPeople(
    familyspaceId: string,
    query: string,
    limit: number
  ): Promise<SearchResult['people']> {
    const tokens = query.split(/\s+/).filter(Boolean)
    return this.prisma.person.findMany({
      where: {
        familyspaceId,
        AND: tokens.map(token => ({
          OR: [
            { firstName: { contains: token, mode: 'insensitive' } },
            { middleName: { contains: token, mode: 'insensitive' } },
            { lastName: { contains: token, mode: 'insensitive' } },
            { maidenName: { contains: token, mode: 'insensitive' } },
            { displayName: { contains: token, mode: 'insensitive' } },
            { nickname: { contains: token, mode: 'insensitive' } },
            { bio: { contains: token, mode: 'insensitive' } },
          ],
        }))
      },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        displayName: true,
        personType: true,
        isDeceased: true,
        avatarAssetId: true,
      },
      orderBy: { firstName: 'asc' },
      take: limit,
    })
  }

  /**
   * Search assets by name or transcript
   */
  private async searchAssets(
    familyspaceId: string,
    query: string,
    limit: number
  ): Promise<SearchResult['assets']> {
    const tokens = query.split(/\s+/).filter(Boolean)
    return this.prisma.asset.findMany({
      where: {
        familyspaceId,
        AND: tokens.map(token => ({
          OR: [
            { originalName: { contains: token, mode: 'insensitive' } },
            { transcript: { contains: token, mode: 'insensitive' } },
          ],
        }))
      },
      select: {
        id: true,
        originalName: true,
        assetType: true,
        mimeType: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  /**
   * Get search suggestions (lightweight autocomplete)
   */
  async getSuggestions(
    familyspaceId: string,
    query: string,
    limit: number = 5
  ): Promise<SearchSuggestion[]> {
    if (!query.trim()) return []
    const tokens = query.split(/\s+/).filter(Boolean)

    const [people, stories, assets] = await Promise.all([
      this.prisma.person.findMany({
        where: {
          familyspaceId,
          AND: tokens.map(token => ({
            OR: [
              { firstName: { contains: token, mode: 'insensitive' } },
              { middleName: { contains: token, mode: 'insensitive' } },
              { lastName: { contains: token, mode: 'insensitive' } },
              { maidenName: { contains: token, mode: 'insensitive' } },
              { displayName: { contains: token, mode: 'insensitive' } },
              { nickname: { contains: token, mode: 'insensitive' } },
            ],
          }))
        },
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          displayName: true,
          personType: true,
        },
        orderBy: { firstName: 'asc' },
        take: limit,
      }),
      this.prisma.story.findMany({
        where: {
          familyspaceId,
          AND: tokens.map(token => ({
            OR: [
              { title: { contains: token, mode: 'insensitive' } },
              { content: { contains: token, mode: 'insensitive' } },
            ],
          }))
        },
        select: {
          id: true,
          title: true,
          excerpt: true,
          storyType: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
      this.prisma.asset.findMany({
        where: {
          familyspaceId,
          AND: tokens.map(token => ({
            OR: [
              { originalName: { contains: token, mode: 'insensitive' } },
              { transcript: { contains: token, mode: 'insensitive' } },
            ],
          }))
        },
        select: {
          id: true,
          originalName: true,
          assetType: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ])

    const personSuggestions: SearchSuggestion[] = people.map((person) => {
      const fullName = [person.firstName, person.middleName, person.lastName].filter(Boolean).join(' ')
      const label = person.displayName || fullName || 'Unnamed person'

      return {
        id: person.id,
        type: 'person',
        label,
        subtitle: person.personType,
      }
    })

    const storySuggestions: SearchSuggestion[] = stories.map((story) => ({
      id: story.id,
      type: 'story',
      label: story.title,
      subtitle: story.excerpt || story.storyType,
    }))

    const assetSuggestions: SearchSuggestion[] = assets.map((asset) => ({
      id: asset.id,
      type: 'asset',
      label: asset.originalName,
      subtitle: asset.assetType,
    }))

    return [...personSuggestions, ...storySuggestions, ...assetSuggestions].slice(0, limit * 2)
  }
}
