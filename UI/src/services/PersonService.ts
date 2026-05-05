import type { CreatePersonInput, ListPeopleQuery } from '@/schemas'
import type { PersonListItem, CreatePersonResponse, PersonType } from '@/contracts'
import { personRepository, PersonRepository } from '@/server/repositories/PersonRepository'

// Person inclusion type for Prisma queries
type PersonInclude = {
  avatarAsset: { select: { id: true; storagePath: true; mimeType: true } }
  _count: { select: { storiesAsSubject: true; voiceProfiles: true } }
  parentInFamilies: { select: { id: true } }
  familyChildLinks: { select: { id: true } }
}

const PERSON_INCLUDE: PersonInclude = {
  avatarAsset: { select: { id: true, storagePath: true, mimeType: true } },
  _count: { select: { storiesAsSubject: true, voiceProfiles: true } },
  parentInFamilies: { select: { id: true } },
  familyChildLinks: { select: { id: true } },
}

export class PersonService {
  constructor(private repo: PersonRepository = personRepository) {}

  /**
   * List people in a familyspace
   */
  async listPeople(
    familyspaceId: string,
    query: ListPeopleQuery
  ): Promise<PersonListItem[]> {
    const { search, type } = query

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { familyspaceId }

    if (search) {
      const tokens = search.trim().split(/\s+/).filter(Boolean)
      where.AND = tokens.map(token => ({
        OR: [
          { firstName: { contains: token, mode: 'insensitive' } },
          { lastName: { contains: token, mode: 'insensitive' } },
          { displayName: { contains: token, mode: 'insensitive' } },
          { nickname: { contains: token, mode: 'insensitive' } },
        ],
      }))
    }

    if (type) {
      where.personType = type.toUpperCase()
    }

    const people = await this.repo.findMany(familyspaceId, {
      where,
      include: PERSON_INCLUDE,
    })

    return (people as any[]).map(this.mapToListItem)
  }

  /**
   * Get a single person by ID
   */
  async getPerson(
    personId: string,
    familyspaceId: string
  ): Promise<PersonListItem | null> {
    const person = await this.repo.findById(personId, familyspaceId, PERSON_INCLUDE)

    return person ? this.mapToListItem(person as any) : null
  }

  /**
   * Create a new person
   */
  async createPerson(
    familyspaceId: string,
    userId: string,
    data: CreatePersonInput
  ): Promise<CreatePersonResponse> {
    const person = await this.repo.create({
      familyspaceId,
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
    }, userId)

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
    familyspaceId: string,
    data: Partial<CreatePersonInput>,
    userId: string
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

    const person = await this.repo.update(personId, familyspaceId, updateData, userId)

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
   * Get complex person detail including relationships and voice profiles
   */
  async getPersonDetail(
    personId: string,
    familyspaceId?: string
  ): Promise<any> {
    const person = await this.repo.findById(personId, familyspaceId, {
      avatarAsset: {
        select: { id: true, storagePath: true, mimeType: true },
      },
      voiceProfiles: {
        where: { status: 'READY' },
        select: {
          id: true,
          name: true,
          isDefault: true,
          isCloned: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          storiesAsSubject: true,
          storiesAsSpeaker: true,
          voiceProfiles: true,
        },
      },
    })

    if (!person) {
      return null
    }

    const familyUnits = await (this.repo as any).prisma.familyUnit.findMany({
      where: {
        familyspaceId,
        OR: [
          { parents: { some: { parentId: personId } } },
          { children: { some: { childId: personId } } },
        ],
      },
      include: {
        parents: {
          include: {
            parent: {
              select: { id: true, firstName: true, lastName: true, avatarAssetId: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        children: {
          include: {
            child: {
              select: { id: true, firstName: true, lastName: true, avatarAssetId: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    const relationships: any[] = []

    for (const family of familyUnits) {
      const isParent = (family.parents as any[]).some((p) => p.parentId === personId)
      const isChild = (family.children as any[]).some((c) => c.childId === personId)

      if (isParent) {
        for (const parentLink of (family.parents as any[])) {
          if (parentLink.parentId !== personId) {
            relationships.push({
              id: `fam:${family.id}:spouse:${parentLink.parent.id}`,
              type: 'SPOUSE',
              direction: 'outgoing',
              isBiological: parentLink.relationshipType === 'BIOLOGICAL',
              person: parentLink.parent,
            })
          }
        }
        for (const childLink of (family.children as any[])) {
          relationships.push({
            id: `fc:${family.id}:${childLink.childId}:child`,
            type: 'CHILD',
            direction: 'outgoing',
            isBiological: childLink.relationshipType === 'BIOLOGICAL',
            person: childLink.child,
          })
        }
      }

      if (isChild) {
        for (const parentLink of (family.parents as any[])) {
          relationships.push({
            id: `fc:${family.id}:${personId}:parent:${parentLink.parent.id}`,
            type: 'PARENT',
            direction: 'incoming',
            isBiological: parentLink.relationshipType === 'BIOLOGICAL',
            person: parentLink.parent,
          })
        }
      }
    }

    return {
      ...person,
      displayName: person.displayName || `${person.firstName}${person.lastName ? ' ' + person.lastName : ''}`,
      avatarUrl: (person as any).avatarAsset ? `/api/assets/serve/${(person as any).avatarAsset.id}` : null,
      relationships,
      counts: (person as any)._count,
    }
  }

  /**
   * Delete a person
   */
  async deletePerson(personId: string, familyspaceId: string, userId: string): Promise<void> {
    await this.repo.delete(personId, familyspaceId, userId)
  }

  /**
   * Map Prisma person to list item DTO
   */
  private mapToListItem(person: any): PersonListItem {
    return {
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      displayName: person.displayName || `${person.firstName}${person.lastName ? ' ' + person.lastName : ''}`,
      nickname: person.nickname ?? null,
      personType: person.personType as PersonType,
      birthDate: person.birthDate ?? null,
      deathDate: person.deathDate ?? null,
      isDeceased: person.isDeceased ?? false,
      bio: person.bio ?? null,
      tags: person.tags ?? [],
      avatarUrl: person.avatarAsset ? `/api/assets/serve/${person.avatarAsset.id}` : null,
      counts: {
        stories: person._count.storiesAsSubject,
        voiceProfiles: person._count.voiceProfiles,
        relationships: person.parentInFamilies.length + person.familyChildLinks.length,
      },
      createdAt: person.createdAt,
    }
  }
}
