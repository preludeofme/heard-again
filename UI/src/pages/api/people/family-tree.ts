import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace } from '@/lib/auth-helpers'

interface RelationshipEdge {
  id: string
  type: 'SPOUSE' | 'PARENT' | 'CHILD'
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

interface PersonWithRelationships {
  id: string
  firstName: string
  lastName: string | null
  displayName: string | null
  nickname: string | null
  avatarAssetId: string | null
  birthDate: string | null
  deathDate: string | null
  personType: string
  bio: string | null
  relationshipEdges: RelationshipEdge[]
}

export default apiHandler({
  // GET /api/people/family-tree - Get all people with relationships for family tree
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)

    // Get all people in workspace with minimal fields
    const people = await prisma.person.findMany({
      where: { workspaceId: user.workspaceId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        nickname: true,
        avatarAssetId: true,
        birthDate: true,
        deathDate: true,
        personType: true,
        bio: true,
      },
      orderBy: [
        { birthDate: 'asc' },
        { firstName: 'asc' },
        { lastName: 'asc' },
      ],
    })

    // Get all family units for these people in one query
    const familyUnits = await prisma.familyUnit.findMany({
      where: {
        workspaceId: user.workspaceId,
        OR: [
          { parents: { some: { parentId: { in: people.map((p: any) => p.id) } } } },
          { children: { some: { childId: { in: people.map((p: any) => p.id) } } } },
        ],
      },
      include: {
        parents: {
          include: {
            parent: {
              select: { id: true, firstName: true, lastName: true, nickname: true, avatarAssetId: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
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

    // Build relationships map for quick lookup
    const relationshipsMap = new Map<string, RelationshipEdge[]>()

    // Initialize empty relationships for all people
    people.forEach((person: any) => {
      relationshipsMap.set(person.id, [])
    })

    // Process family units to build relationships
    for (const family of familyUnits) {
      // Build parent and child lookup maps for this family
      const parentMap = new Map(family.parents.map((p: any) => [p.parentId, p.parent]))
      const childMap = new Map(family.children.map((c: any) => [c.childId, c.child]))

      // Process each parent to find their relationships
      for (const parentLink of family.parents) {
        const relationships: RelationshipEdge[] = relationshipsMap.get(parentLink.parentId) || []
        
        // Spouse relationships (other parents in same family)
        for (const otherParent of family.parents) {
          if (otherParent.parentId !== parentLink.parentId) {
            relationships.push({
              id: `spouse-${parentLink.parentId}-${otherParent.parentId}`,
              type: 'SPOUSE',
              direction: 'outgoing',
              isBiological: true,
              notes: null,
              relatedPerson: otherParent.parent,
            })
          }
        }

        // Parent-child relationships (to children)
        for (const childLink of family.children) {
          relationships.push({
            id: `parent-${parentLink.parentId}-${childLink.childId}`,
            type: 'PARENT',
            direction: 'outgoing',
            isBiological: parentLink.relationshipType === 'BIOLOGICAL',
            notes: null,
            relatedPerson: childLink.child,
          })
        }

        relationshipsMap.set(parentLink.parentId, relationships)
      }

      // Process each child to find their parent relationships
      for (const childLink of family.children) {
        const relationships: RelationshipEdge[] = relationshipsMap.get(childLink.childId) || []
        
        // Child-parent relationships (to parents)
        for (const parentLink of family.parents) {
          relationships.push({
            id: `child-${childLink.childId}-${parentLink.parentId}`,
            type: 'CHILD',
            direction: 'incoming',
            isBiological: parentLink.relationshipType === 'BIOLOGICAL',
            notes: null,
            relatedPerson: parentLink.parent,
          })
        }

        relationshipsMap.set(childLink.childId, relationships)
      }
    }

    // Combine people with their relationships
    const peopleWithRelationships: PersonWithRelationships[] = people.map((person: any) => ({
      ...person,
      relationshipEdges: relationshipsMap.get(person.id) || [],
    }))

    return successResponse(res, peopleWithRelationships)
  },
})
