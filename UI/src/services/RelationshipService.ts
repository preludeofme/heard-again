/**
 * RelationshipService - Business logic for family relationships
 * Finding 5.1: Create Service Layer - Extracted from /api/people/[id]/relationships.ts
 */

import type { PrismaClient } from '@prisma/client'
import { AppError } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

export type RelationshipType = 'SPOUSE' | 'PARENT' | 'CHILD' | 'SIBLING'

export interface Relationship {
  id: string
  type: RelationshipType
  direction: 'outgoing' | 'incoming'
  isBiological: boolean
  notes: string | null
  relatedPerson: {
    id: string
    firstName: string
    lastName: string | null
    nickname: string | null
    avatarAssetId: string | null
    sex: string | null
  }
}

export interface CreateRelationshipInput {
  familyspaceId: string
  sourcePersonId: string
  targetPersonId: string
  relationshipType: RelationshipType
  relationshipKind?: 'BIOLOGICAL' | 'ADOPTED' | 'STEP'
  isBiological: boolean
  notes?: string
  marriageDate?: string
  marriagePlace?: string
}

export interface RelationshipResult {
  id: string
  type: RelationshipType
  isBiological: boolean
  relatedPerson: {
    id: string
    firstName: string
    lastName: string | null
  }
}

export class RelationshipService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get all relationships for a person
   */
  async getRelationships(
    familyspaceId: string,
    personId: string
  ): Promise<Relationship[]> {
    // Verify person exists in familyspace
    const person = await this.prisma.person.findFirst({
      where: { id: personId, familyspaceId },
    })
    if (!person) {
      throw new AppError('Person not found', 404, 'PERSON_NOT_FOUND')
    }

    const familyUnits = await this.prisma.familyUnit.findMany({
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
              select: { id: true, firstName: true, lastName: true, nickname: true, avatarAssetId: true, sex: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        children: {
          include: {
            child: {
              select: { id: true, firstName: true, lastName: true, nickname: true, avatarAssetId: true, sex: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    const relationships: Relationship[] = []

    for (const family of familyUnits) {
      const isParent = family.parents.some((p) => p.parentId === personId)
      const isChild = family.children.some((c) => c.childId === personId)

      // Parent -> Spouse relationships (other parents in same family)
      if (isParent) {
        for (const parentLink of family.parents) {
          if (parentLink.parentId !== personId) {
            relationships.push({
              id: `fam:${family.id}:spouse:${parentLink.parent.id}`,
              type: 'SPOUSE',
              direction: 'outgoing',
              isBiological: parentLink.relationshipType === 'BIOLOGICAL',
              notes: family.notes,
              relatedPerson: parentLink.parent,
            })
          }
        }
      }

      // Parent -> Child relationships
      if (isParent) {
        for (const childLink of family.children) {
          relationships.push({
            id: `fc:${family.id}:${childLink.childId}:child`,
            type: 'CHILD',
            direction: 'outgoing',
            isBiological: childLink.relationshipType === 'BIOLOGICAL',
            notes: family.notes,
            relatedPerson: childLink.child,
          })
        }
      }

      // Child -> Parent relationships
      if (isChild) {
        for (const parentLink of family.parents) {
          relationships.push({
            id: `fc:${family.id}:${personId}:parent:${parentLink.parent.id}`,
            type: 'PARENT',
            direction: 'incoming',
            isBiological: parentLink.relationshipType === 'BIOLOGICAL',
            notes: family.notes,
            relatedPerson: parentLink.parent,
          })
        }

        // Child -> Sibling relationships (other children in same family)
        for (const childLink of family.children) {
          if (childLink.childId !== personId) {
            relationships.push({
              id: `fc:${family.id}:${personId}:sibling:${childLink.child.id}`,
              type: 'SIBLING',
              direction: 'outgoing',
              isBiological: true, // Assuming biological for simplicity in siblings
              notes: family.notes,
              relatedPerson: childLink.child,
            })
          }
        }
      }
    }

    return relationships
  }

  /**
   * Create a new relationship
   */
  async createRelationship(
    input: CreateRelationshipInput
  ): Promise<RelationshipResult> {
    const {
      familyspaceId,
      sourcePersonId,
      targetPersonId,
      relationshipType,
      relationshipKind,
      isBiological,
      notes,
      marriageDate,
      marriagePlace,
    } = input

    // Validate not self-referencing
    if (sourcePersonId === targetPersonId) {
      throw new AppError('Cannot create a relationship with oneself', 400, 'SELF_RELATIONSHIP')
    }

    // Verify both people exist in familyspace
    const [source, target] = await Promise.all([
      this.prisma.person.findFirst({ where: { id: sourcePersonId, familyspaceId } }),
      this.prisma.person.findFirst({ where: { id: targetPersonId, familyspaceId } }),
    ])

    if (!source) {
      throw new AppError('Source person not found', 404, 'SOURCE_NOT_FOUND')
    }
    if (!target) {
      throw new AppError('Target person not found', 404, 'TARGET_NOT_FOUND')
    }

    // Handle spouse relationship
    if (relationshipType === 'SPOUSE') {
      return this.createSpouseRelationship(
        familyspaceId,
        sourcePersonId,
        targetPersonId,
        target,
        notes,
        marriageDate,
        marriagePlace
      )
    }

    // Handle parent/child relationship
    return this.createParentChildRelationship(
      familyspaceId,
      sourcePersonId,
      targetPersonId,
      relationshipType,
      relationshipKind,
      isBiological,
      target,
      notes
    )
  }

  /**
   * Create spouse relationship
   */
  private async createSpouseRelationship(
    familyspaceId: string,
    sourceId: string,
    targetId: string,
    target: { id: string; firstName: string; lastName: string | null },
    notes?: string,
    marriageDate?: string,
    marriagePlace?: string
  ): Promise<RelationshipResult> {
    const existing = await this.prisma.familyUnit.findFirst({
      where: {
        familyspaceId,
        AND: [
          { parents: { some: { parentId: sourceId } } },
          { parents: { some: { parentId: targetId } } },
        ],
      },
      include: {
        parents: true,
      },
    })

    let family
    if (existing) {
      // Update existing family with marriage date/place if provided
      if (marriageDate || marriagePlace) {
        family = await this.prisma.familyUnit.update({
          where: { id: existing.id },
          data: {
            marriageDate: marriageDate ? new Date(marriageDate) : existing.marriageDate,
            marriagePlace: marriagePlace || existing.marriagePlace,
          },
          include: { parents: true },
        })
      } else {
        family = existing
      }
    } else {
      const candidateFamilies = await this.prisma.familyUnit.findMany({
        where: {
          familyspaceId,
          OR: [
            { parents: { some: { parentId: sourceId } } },
            { parents: { some: { parentId: targetId } } },
          ],
        },
        include: {
          parents: true,
          _count: {
            select: {
              children: true,
            },
          },
        },
      })

      const bestCandidate = candidateFamilies
        .sort((a, b) => {
          const aScore = a._count.children * 100 + a.parents.length
          const bScore = b._count.children * 100 + b.parents.length
          return bScore - aScore
        })[0]

      if (bestCandidate) {
        const hasSource = bestCandidate.parents.some((parent) => parent.parentId === sourceId)
        const hasTarget = bestCandidate.parents.some((parent) => parent.parentId === targetId)

        if (!hasSource) {
          await this.prisma.familyParent.create({
            data: {
              familyId: bestCandidate.id,
              parentId: sourceId,
              relationshipType: 'BIOLOGICAL',
              sortOrder: bestCandidate.parents.length,
            },
          })
        }

        if (!hasTarget) {
          await this.prisma.familyParent.create({
            data: {
              familyId: bestCandidate.id,
              parentId: targetId,
              relationshipType: 'BIOLOGICAL',
              sortOrder: bestCandidate.parents.length + (hasSource ? 0 : 1),
            },
          })
        }

        // Update marriage date/place if provided
        if (marriageDate || marriagePlace) {
          family = await this.prisma.familyUnit.update({
            where: { id: bestCandidate.id },
            data: {
              marriageDate: marriageDate ? new Date(marriageDate) : undefined,
              marriagePlace: marriagePlace || undefined,
            },
            include: { parents: true },
          })
        } else {
          family = bestCandidate
        }
      } else {
        // Create new family with both parents
        family = await this.prisma.familyUnit.create({
          data: {
            familyspaceId,
            notes: notes || null,
            marriageDate: marriageDate ? new Date(marriageDate) : undefined,
            marriagePlace: marriagePlace || undefined,
            parents: {
              create: [
                { parentId: sourceId, relationshipType: 'BIOLOGICAL', sortOrder: 0 },
                { parentId: targetId, relationshipType: 'BIOLOGICAL', sortOrder: 1 },
              ],
            },
          },
        })
      }
    }

    return {
      id: `fam:${family.id}:spouse:${target.id}`,
      type: 'SPOUSE',
      isBiological: true,
      relatedPerson: {
        id: target.id,
        firstName: target.firstName,
        lastName: target.lastName,
      },
    }
  }

  /**
   * Create parent/child relationship
   */
  private async createParentChildRelationship(
    familyspaceId: string,
    sourceId: string,
    targetId: string,
    relationshipType: 'PARENT' | 'CHILD',
    relationshipKind: 'BIOLOGICAL' | 'ADOPTED' | 'STEP' | undefined,
    isBiological: boolean,
    target: { id: string; firstName: string; lastName: string | null },
    notes?: string
  ): Promise<RelationshipResult> {
    const parentId = relationshipType === 'PARENT' ? sourceId : targetId
    const childId = relationshipType === 'PARENT' ? targetId : sourceId
    const childRelationshipType = relationshipKind || (isBiological ? 'BIOLOGICAL' : 'ADOPTED')

    // Check for existing relationship
    const existingParentChildLink = await this.prisma.familyChild.findFirst({
      where: {
        childId,
        family: {
          familyspaceId,
          parents: { some: { parentId } },
        },
      },
      include: { family: { select: { id: true } } },
    })

    if (existingParentChildLink) {
      return {
        id: `fc:${existingParentChildLink.family.id}:${childId}:child`,
        type: relationshipType,
        isBiological: existingParentChildLink.relationshipType === 'BIOLOGICAL',
        relatedPerson: {
          id: target.id,
          firstName: target.firstName,
          lastName: target.lastName,
        },
      }
    }

    // Find or create family unit for parent (prefer family with children and two parents)
    const candidateFamilies = await this.prisma.familyUnit.findMany({
      where: {
        familyspaceId,
        parents: { some: { parentId } },
      },
      include: {
        parents: true,
        _count: {
          select: {
            children: true,
          },
        },
      },
    })

    const preferredFamily = candidateFamilies
      .sort((a, b) => {
        const aScore = a._count.children * 100 + a.parents.length
        const bScore = b._count.children * 100 + b.parents.length
        return bScore - aScore
      })[0]

    const familyId = preferredFamily
      ? preferredFamily.id
      : (await this.prisma.familyUnit.create({
        data: {
          familyspaceId,
          notes: notes || null,
          parents: {
            create: {
              parentId,
              relationshipType: 'BIOLOGICAL',
              sortOrder: 0,
            },
          },
        },
      })).id

    // Create or update child link
    logger.info('Creating child link with data:', {
      familyId,
      childId,
      relationshipType: childRelationshipType,
    })

    const childLink = await this.prisma.familyChild.upsert({
      where: {
        familyId_childId: {
          familyId,
          childId,
        },
      },
      update: {
        relationshipType: childRelationshipType,
      },
      create: {
        familyId,
        childId,
        relationshipType: childRelationshipType,
      },
      include: {
        child: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    logger.info('Child link created/updated:', childLink)

    return {
      id: `fc:${familyId}:${childLink.childId}:child`,
      type: relationshipType,
      isBiological: childLink.relationshipType === 'BIOLOGICAL',
      relatedPerson: {
        id: target.id,
        firstName: target.firstName,
        lastName: target.lastName,
      },
    }
  }
}
