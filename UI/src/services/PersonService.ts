import type { CreatePersonInput, ListPeopleQuery } from '@/schemas'
import type { PersonListItem, CreatePersonResponse, PersonType } from '@/contracts'
import { personRepository, PersonRepository } from '@/server/repositories/PersonRepository'
import { prisma } from '@/lib/prisma'

export type TrimScope = 'person' | 'children' | 'all'
export type TrimAction = 'detach' | 'delete'

export interface BranchPreviewPerson {
  id: string
  displayName: string | null
  firstName: string
  lastName: string | null
}

export interface BranchPreview {
  people: BranchPreviewPerson[]
  familyUnitIds: string[]
  storiesCount: number
  voiceProfilesCount: number
  detachOverrides: string[]
}

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
    const { search, type, page = 1, limit = 50 } = query
    const skip = (page - 1) * limit

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { familyspaceId }

    if (search) {
      const tokens = search.trim().split(/\s+/).filter(Boolean)
      where.AND = tokens.map(token => ({
        OR: [
          { firstName: { contains: token, mode: 'insensitive' } },
          { middleName: { contains: token, mode: 'insensitive' } },
          { lastName: { contains: token, mode: 'insensitive' } },
          { maidenName: { contains: token, mode: 'insensitive' } },
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
      skip,
      take: limit,
    })

    return (people as any[]).map(p => this.mapToListItem(p))
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
      displayName: person.displayName || this.computeDisplayName(person),
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
      displayName: person.displayName || this.computeDisplayName(person),
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
      displayName: person.displayName || this.computeDisplayName(person),
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
      displayName: person.displayName || this.computeDisplayName(person),
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

  /**
   * Return a preview of all people/units affected by a branch trim operation.
   */
  async getBranchPreview(
    personId: string,
    familyspaceId: string,
    scope: TrimScope
  ): Promise<BranchPreview> {
    let descendantIds: string[] = []

    if (scope === 'children') {
      const parentFamilies = await prisma.familyParent.findMany({
        where: { parentId: personId },
        select: { familyId: true },
      })
      const familyIds = parentFamilies.map(f => f.familyId)
      if (familyIds.length > 0) {
        const children = await prisma.familyChild.findMany({
          where: { familyId: { in: familyIds } },
          select: { childId: true },
        })
        descendantIds = children.map(c => c.childId)
      }
    } else if (scope === 'all') {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        WITH RECURSIVE descendants AS (
          SELECT fc."childId", fc."familyId"
          FROM "FamilyChild" fc
          JOIN "FamilyParent" fp ON fp."familyId" = fc."familyId"
          WHERE fp."parentId" = ${personId}

          UNION ALL

          SELECT fc2."childId", fc2."familyId"
          FROM "FamilyChild" fc2
          JOIN "FamilyParent" fp2 ON fp2."familyId" = fc2."familyId"
          JOIN descendants d ON fp2."parentId" = d."childId"
        )
        SELECT DISTINCT "childId" as id FROM descendants
      `
      descendantIds = rows.map(r => r.id)
    }

    const affectedIds = [personId, ...descendantIds.filter(id => id !== personId)]
    const affectedSet = new Set(affectedIds)

    // Descendants with a parent outside the affected set must be detached only
    const detachOverrides: string[] = []
    if (descendantIds.length > 0) {
      const childFamilies = await prisma.familyChild.findMany({
        where: { childId: { in: descendantIds } },
        select: { childId: true, familyId: true },
      })
      const allFamilyIds = [...new Set(childFamilies.map(cf => cf.familyId))]
      const parentLinks = await prisma.familyParent.findMany({
        where: { familyId: { in: allFamilyIds } },
        select: { familyId: true, parentId: true },
      })

      const familyParentsMap = new Map<string, string[]>()
      for (const p of parentLinks) {
        const existing = familyParentsMap.get(p.familyId) ?? []
        existing.push(p.parentId)
        familyParentsMap.set(p.familyId, existing)
      }

      const childFamilyMap = new Map<string, string[]>()
      for (const cf of childFamilies) {
        const existing = childFamilyMap.get(cf.childId) ?? []
        existing.push(cf.familyId)
        childFamilyMap.set(cf.childId, existing)
      }

      for (const [childId, childFamilyIds] of childFamilyMap.entries()) {
        for (const fid of childFamilyIds) {
          const parentIds = familyParentsMap.get(fid) ?? []
          if (parentIds.some(pid => !affectedSet.has(pid))) {
            detachOverrides.push(childId)
            break
          }
        }
      }
    }

    const [people, storiesCount, voiceProfilesCount, parentFamilyLinks, childFamilyLinks] =
      await Promise.all([
        prisma.person.findMany({
          where: { id: { in: affectedIds }, familyspaceId },
          select: { id: true, firstName: true, lastName: true, displayName: true },
        }),
        prisma.story.count({
          where: { subjectId: { in: affectedIds }, familyspaceId },
        }),
        prisma.voiceProfile.count({
          where: { personId: { in: affectedIds } },
        }),
        prisma.familyParent.findMany({
          where: { parentId: { in: affectedIds } },
          select: { familyId: true },
        }),
        prisma.familyChild.findMany({
          where: { childId: { in: affectedIds } },
          select: { familyId: true },
        }),
      ])

    const familyUnitIdSet = new Set([
      ...parentFamilyLinks.map(l => l.familyId),
      ...childFamilyLinks.map(l => l.familyId),
    ])

    return {
      people,
      familyUnitIds: Array.from(familyUnitIdSet),
      storiesCount,
      voiceProfilesCount,
      detachOverrides,
    }
  }

  /**
   * Detach or delete a branch rooted at personId.
   */
  async trimBranch(
    personId: string,
    familyspaceId: string,
    scope: TrimScope,
    action: TrimAction
  ): Promise<{ affected: number; detachOverrides: string[] }> {
    const preview = await this.getBranchPreview(personId, familyspaceId, scope)
    const { people, familyUnitIds, detachOverrides } = preview
    const affectedIds = people.map(p => p.id)

    const toDetach = action === 'detach' ? affectedIds : detachOverrides
    const toDelete =
      action === 'delete' ? affectedIds.filter(id => !detachOverrides.includes(id)) : []

    await prisma.$transaction(async tx => {
      if (toDetach.length > 0) {
        await tx.familyParent.deleteMany({
          where: { parentId: { in: toDetach }, familyId: { in: familyUnitIds } },
        })
        await tx.familyChild.deleteMany({
          where: { childId: { in: toDetach } },
        })
      }

      if (toDelete.length > 0) {
        await tx.person.deleteMany({
          where: { id: { in: toDelete }, familyspaceId },
        })
      }

      // Clean up FamilyUnits that now have no parents or no children
      if (familyUnitIds.length > 0) {
        const remaining = await tx.familyUnit.findMany({
          where: { id: { in: familyUnitIds } },
          include: { _count: { select: { parents: true, children: true } } },
        })
        const orphanedIds = remaining
          .filter(u => u._count.parents === 0 || u._count.children === 0)
          .map(u => u.id)
        if (orphanedIds.length > 0) {
          await tx.familyUnit.deleteMany({ where: { id: { in: orphanedIds } } })
        }
      }
    })

    return { affected: affectedIds.length, detachOverrides }
  }

  /**
   * Helper to compute a display name from name parts
   */
  private computeDisplayName(person: any): string {
    const parts = [
      person.firstName,
      person.middleName,
      person.lastName
    ].filter(Boolean)
    
    return parts.join(' ') || 'Unnamed person'
  }
}
