/**
 * RelationshipService - Business logic for family relationships
 * Finding 5.1: Create Service Layer - Extracted from /api/people/[id]/relationships.ts
 */

import type { PrismaClient } from '@prisma/client'
import { AppError } from '@/lib/api-helpers'

export type RelationshipType = 'SPOUSE' | 'PARENT' | 'CHILD'

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
  }
}

export interface CreateRelationshipInput {
  workspaceId: string
  sourcePersonId: string
  targetPersonId: string
  relationshipType: RelationshipType
  isBiological: boolean
  notes?: string
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
    workspaceId: string,
    personId: string
  ): Promise<Relationship[]> {
    // Verify person exists in workspace
    const person = await this.prisma.person.findFirst({
      where: { id: personId, workspaceId },
    })
    if (!person) {
      throw new AppError('Person not found', 404, 'PERSON_NOT_FOUND')
    }

    const familyUnits = await this.prisma.familyUnit.findMany({
      where: {
        workspaceId,
        OR: [
          { husbandId: personId },
          { wifeId: personId },
          { children: { some: { childId: personId } } },
        ],
      },
      include: {
        husband: {
          select: { id: true, firstName: true, lastName: true, nickname: true, avatarAssetId: true },
        },
        wife: {
          select: { id: true, firstName: true, lastName: true, nickname: true, avatarAssetId: true },
        },
        children: {
          include: {
            child: {
              select: { id: true, firstName: true, lastName: true, nickname: true, avatarAssetId: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    const relationships: Relationship[] = []

    for (const family of familyUnits) {
      // Spouse relationships
      if (family.husbandId === personId && family.wife) {
        relationships.push({
          id: `fam:${family.id}:spouse:${family.wife.id}`,
          type: 'SPOUSE',
          direction: 'outgoing',
          isBiological: true,
          notes: family.notes,
          relatedPerson: family.wife,
        })
      }

      if (family.wifeId === personId && family.husband) {
        relationships.push({
          id: `fam:${family.id}:spouse:${family.husband.id}`,
          type: 'SPOUSE',
          direction: 'outgoing',
          isBiological: true,
          notes: family.notes,
          relatedPerson: family.husband,
        })
      }

      // Parent -> Child relationships
      const isParent = family.husbandId === personId || family.wifeId === personId
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
      const isChild = family.children.some((c) => c.childId === personId)
      if (isChild) {
        if (family.husband && family.husband.id !== personId) {
          relationships.push({
            id: `fc:${family.id}:${personId}:parent:${family.husband.id}`,
            type: 'PARENT',
            direction: 'incoming',
            isBiological: true,
            notes: family.notes,
            relatedPerson: family.husband,
          })
        }
        if (family.wife && family.wife.id !== personId) {
          relationships.push({
            id: `fc:${family.id}:${personId}:parent:${family.wife.id}`,
            type: 'PARENT',
            direction: 'incoming',
            isBiological: true,
            notes: family.notes,
            relatedPerson: family.wife,
          })
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
      workspaceId,
      sourcePersonId,
      targetPersonId,
      relationshipType,
      isBiological,
      notes,
    } = input

    // Validate not self-referencing
    if (sourcePersonId === targetPersonId) {
      throw new AppError('Cannot create a relationship with oneself', 400, 'SELF_RELATIONSHIP')
    }

    // Verify both people exist in workspace
    const [source, target] = await Promise.all([
      this.prisma.person.findFirst({ where: { id: sourcePersonId, workspaceId } }),
      this.prisma.person.findFirst({ where: { id: targetPersonId, workspaceId } }),
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
        workspaceId,
        sourcePersonId,
        targetPersonId,
        target,
        notes
      )
    }

    // Handle parent/child relationship
    return this.createParentChildRelationship(
      workspaceId,
      sourcePersonId,
      targetPersonId,
      relationshipType,
      isBiological,
      target,
      notes
    )
  }

  /**
   * Create spouse relationship
   */
  private async createSpouseRelationship(
    workspaceId: string,
    sourceId: string,
    targetId: string,
    target: { id: string; firstName: string; lastName: string | null },
    notes?: string
  ): Promise<RelationshipResult> {
    const existing = await this.prisma.familyUnit.findFirst({
      where: {
        workspaceId,
        OR: [
          { husbandId: sourceId, wifeId: targetId },
          { husbandId: targetId, wifeId: sourceId },
        ],
      },
    })

    const family =
      existing ||
      (await this.prisma.familyUnit.create({
        data: {
          workspaceId,
          husbandId: sourceId,
          wifeId: targetId,
          notes: notes || null,
        },
      }))

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
    workspaceId: string,
    sourceId: string,
    targetId: string,
    relationshipType: 'PARENT' | 'CHILD',
    isBiological: boolean,
    target: { id: string; firstName: string; lastName: string | null },
    notes?: string
  ): Promise<RelationshipResult> {
    const parentId = relationshipType === 'PARENT' ? sourceId : targetId
    const childId = relationshipType === 'PARENT' ? targetId : sourceId

    // Check for existing relationship
    const existingParentChildLink = await this.prisma.familyChild.findFirst({
      where: {
        childId,
        family: {
          workspaceId,
          OR: [{ husbandId: parentId }, { wifeId: parentId }],
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

    // Find or create family unit for parent
    let family = await this.prisma.familyUnit.findFirst({
      where: {
        workspaceId,
        OR: [{ husbandId: parentId }, { wifeId: parentId }],
      },
      orderBy: { createdAt: 'asc' },
    })

    if (!family) {
      family = await this.prisma.familyUnit.create({
        data: {
          workspaceId,
          husbandId: parentId,
          wifeId: null,
          notes: notes || null,
        },
      })
    }

    // Create or update child link
    const childLink = await this.prisma.familyChild.upsert({
      where: {
        familyId_childId: {
          familyId: family.id,
          childId,
        },
      },
      update: {
        relationshipType: isBiological ? 'BIOLOGICAL' : 'ADOPTED',
      },
      create: {
        familyId: family.id,
        childId,
        relationshipType: isBiological ? 'BIOLOGICAL' : 'ADOPTED',
      },
      include: {
        child: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return {
      id: `fc:${family.id}:${childLink.childId}:child`,
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
