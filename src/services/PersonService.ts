/**
 * PersonService - Business logic for person operations
 * Finding 5.1: Create Service Layer
 */

import type { PrismaClient } from '@prisma/client'
import type { CreatePersonInput, ListPeopleQuery } from '@/schemas'
import type { PersonListItem, CreatePersonResponse, PersonType } from '@/contracts'

// Person inclusion type for Prisma queries
type PersonInclude = {
  avatarAsset: { select: { id: true; storagePath: true; mimeType: true } }
  _count: { select: { storiesAsSubject: true; voiceProfiles: true } }
  husbandInFamilies: { select: { id: true } }
  wifeInFamilies: { select: { id: true } }
  familyChildLinks: { select: { id: true } }
}

const PERSON_INCLUDE: PersonInclude = {
  avatarAsset: { select: { id: true, storagePath: true, mimeType: true } },
  _count: { select: { storiesAsSubject: true, voiceProfiles: true } },
  husbandInFamilies: { select: { id: true } },
  wifeInFamilies: { select: { id: true } },
  familyChildLinks: { select: { id: true } },
}

export class PersonService {
  constructor(private prisma: PrismaClient) {}

  /**
   * List people in a workspace
   */
  async listPeople(
    workspaceId: string,
    query: ListPeopleQuery
  ): Promise<PersonListItem[]> {
    const { search, type } = query

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { workspaceId }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { nickname: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (type) {
      where.personType = type.toUpperCase()
    }

    const people = await this.prisma.person.findMany({
      where,
      include: PERSON_INCLUDE,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    })

    return people.map(this.mapToListItem)
  }

  /**
   * Get a single person by ID
   */
  async getPerson(
    personId: string,
    workspaceId: string
  ): Promise<PersonListItem | null> {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, workspaceId },
      include: PERSON_INCLUDE,
    })

    return person ? this.mapToListItem(person) : null
  }

  /**
   * Create a new person
   */
  async createPerson(
    workspaceId: string,
    userId: string,
    data: CreatePersonInput
  ): Promise<CreatePersonResponse> {
    const person = await this.prisma.person.create({
      data: {
        workspaceId,
        createdById: userId,
        firstName: data.firstName,
        lastName: data.lastName ?? null,
        displayName: data.displayName ?? null,
        nickname: data.nickname ?? null,
        maidenName: data.maidenName ?? null,
        suffix: data.suffix ?? null,
        middleName: data.middleName ?? null,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        deathDate: data.deathDate ? new Date(data.deathDate) : null,
        isDeceased: data.isDeceased ?? false,
        bio: data.bio ?? null,
        personType: data.personType ?? 'FAMILY',
        tags: data.tags ?? [],
      },
    })

    return {
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      displayName: person.displayName || `${person.firstName}${person.lastName ? ' ' + person.lastName : ''}`,
      personType: person.personType as PersonType,
      createdAt: person.createdAt,
    }
  }

  /**
   * Update an existing person
   */
  async updatePerson(
    personId: string,
    workspaceId: string,
    data: Partial<CreatePersonInput>
  ): Promise<CreatePersonResponse> {
    const updateData: Record<string, unknown> = {}

    if (data.firstName !== undefined) updateData.firstName = data.firstName
    if (data.lastName !== undefined) updateData.lastName = data.lastName ?? null
    if (data.displayName !== undefined) updateData.displayName = data.displayName ?? null
    if (data.nickname !== undefined) updateData.nickname = data.nickname ?? null
    if (data.maidenName !== undefined) updateData.maidenName = data.maidenName ?? null
    if (data.suffix !== undefined) updateData.suffix = data.suffix ?? null
    if (data.middleName !== undefined) updateData.middleName = data.middleName ?? null
    if (data.birthDate !== undefined) updateData.birthDate = data.birthDate ? new Date(data.birthDate) : null
    if (data.deathDate !== undefined) updateData.deathDate = data.deathDate ? new Date(data.deathDate) : null
    if (data.isDeceased !== undefined) updateData.isDeceased = data.isDeceased
    if (data.bio !== undefined) updateData.bio = data.bio ?? null
    if (data.personType !== undefined) updateData.personType = data.personType
    if (data.tags !== undefined) updateData.tags = data.tags

    const person = await this.prisma.person.update({
      where: { id: personId, workspaceId },
      data: updateData,
    })

    return {
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      displayName: person.displayName || `${person.firstName}${person.lastName ? ' ' + person.lastName : ''}`,
      personType: person.personType as PersonType,
      createdAt: person.createdAt,
    }
  }

  /**
   * Delete a person
   */
  async deletePerson(personId: string, workspaceId: string): Promise<void> {
    await this.prisma.person.delete({
      where: { id: personId, workspaceId },
    })
  }

  /**
   * Map Prisma person to list item DTO
   */
  private mapToListItem(
    person: {
      id: string
      firstName: string
      lastName: string | null
      displayName: string | null
      nickname: string | null
      personType: string
      birthDate: Date | null
      deathDate: Date | null
      isDeceased: boolean
      bio: string | null
      avatarAsset: { storagePath: string | null } | null
      tags: string[]
      _count: { storiesAsSubject: number; voiceProfiles: number }
      husbandInFamilies: { id: string }[]
      wifeInFamilies: { id: string }[]
      familyChildLinks: { id: string }[]
      createdAt: Date
    }
  ): PersonListItem {
    return {
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      displayName: person.displayName || `${person.firstName}${person.lastName ? ' ' + person.lastName : ''}`,
      nickname: person.nickname,
      personType: person.personType as PersonType,
      birthDate: person.birthDate,
      deathDate: person.deathDate,
      isDeceased: person.isDeceased,
      bio: person.bio,
      avatarUrl: person.avatarAsset?.storagePath || null,
      tags: person.tags,
      counts: {
        stories: person._count.storiesAsSubject,
        voiceProfiles: person._count.voiceProfiles,
        relationships: person.husbandInFamilies.length + person.wifeInFamilies.length + person.familyChildLinks.length,
      },
      createdAt: person.createdAt,
    }
  }
}
