import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'

interface RelationshipEdge {
  id: string
  type: 'SPOUSE' | 'PARENT' | 'CHILD' | 'SIBLING'
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
  sex: any
  relationshipEdges: RelationshipEdge[]
}

export default apiHandler({
  // GET /api/people/family-tree - Get people with relationships for family tree
  GET: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const { rootPersonId, depthUp, depthDown, includeSiblings, expandUp, expandDown, expandSiblings } = req.query

    // Fix: Properly handle "0" as a valid depth
    const dUp = (depthUp !== undefined && depthUp !== '') ? parseInt(depthUp as string, 10) : 2
    const dDown = (depthDown !== undefined && depthDown !== '') ? parseInt(depthDown as string, 10) : 2
    const shouldIncludeSiblings = includeSiblings === 'true'
    const expandUpIds = expandUp ? (expandUp as string).split(',').filter(Boolean) : []
    const expandDownIds = expandDown ? (expandDown as string).split(',').filter(Boolean) : []
    const expandSiblingIds = expandSiblings ? (expandSiblings as string).split(',').filter(Boolean) : []

    logger.info({ familyspaceId: user.familyspaceId, rootPersonId: rootPersonId || 'none' }, 'Family Tree API started')

    // 1. Fetch all people and family units for this familyspace
    const [allPeople, allFamilyUnits] = await Promise.all([
      prisma.person.findMany({
        where: { familyspaceId: user.familyspaceId },
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
          sex: true,
          createdById: true,
          createdAt: true,
          updatedAt: true,
        }
      }),
      prisma.familyUnit.findMany({
        where: { familyspaceId: user.familyspaceId },
        include: {
          parents: { 
            include: { 
              parent: { select: { id: true, firstName: true, lastName: true, nickname: true, avatarAssetId: true } } 
            } 
          },
          children: { 
            include: { 
              child: { select: { id: true, firstName: true, lastName: true, nickname: true, avatarAssetId: true } } 
            } 
          }
        }
      })
    ])

    logger.info({ familyspaceId: user.familyspaceId, allPeople: allPeople.length, allFamilyUnits: allFamilyUnits.length }, 'Family Tree API data fetched')
    if (allPeople.length === 0) return successResponse(res, [])

    // 2. Build graph and lookup maps in memory
    const peopleMap = new Map(allPeople.map(p => [p.id, p]))
    const familiesByPersonId = new Map<string, { isParent: boolean, isChild: boolean, unit: any }[]>()

    allFamilyUnits.forEach(unit => {
      unit.parents.forEach((p: { parentId: string }) => {
        if (!familiesByPersonId.has(p.parentId)) familiesByPersonId.set(p.parentId, [])
        familiesByPersonId.get(p.parentId)!.push({ isParent: true, isChild: false, unit })
      })
      unit.children.forEach((c: { childId: string }) => {
        if (!familiesByPersonId.has(c.childId)) familiesByPersonId.set(c.childId, [])
        familiesByPersonId.get(c.childId)!.push({ isParent: false, isChild: true, unit })
      })
    })

    // 3. Determine root person
    let rootId = rootPersonId as string
    if (!rootId) {
      // Prioritize the person record created by the current user during onboarding
      // Pick the earliest one to ensure we get the user themselves
      const userPerson = allPeople
        .filter(p => p.createdById === user.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]
      
      if (userPerson) {
        rootId = userPerson.id
      } else {
        // Fallback: Find the youngest person (newest member) who is connected to the tree
        const connectedPeople = allPeople.filter(p => (familiesByPersonId.get(p.id)?.length || 0) > 0)
        const searchPool = connectedPeople.length > 0 ? connectedPeople : allPeople
        
        rootId = searchPool.reduce((newest, current) => {
          if (newest.birthDate && current.birthDate) {
            const newDate = new Date(newest.birthDate).getTime()
            const currDate = new Date(current.birthDate).getTime()
            if (!isNaN(newDate) && !isNaN(currDate)) {
              return currDate > newDate ? current : newest
            }
          }
          if (current.birthDate && !isNaN(new Date(current.birthDate).getTime())) return current
          if (newest.birthDate && !isNaN(new Date(newest.birthDate).getTime())) return newest
          
          // Fallback to most connections if no valid birth dates
          const prevCount = familiesByPersonId.get(newest.id)?.length || 0
          const currCount = familiesByPersonId.get(current.id)?.length || 0
          return currCount > prevCount ? current : newest
        }).id
      }
    }

    console.log(`[Family Tree API] Root selection: ${rootId}. Connections: ${familiesByPersonId.get(rootId)?.length || 0}`)
    if (familiesByPersonId.has(rootId)) {
      console.log(`[Family Tree API] Root connections detail:`, familiesByPersonId.get(rootId)?.map(f => ({ isChild: f.isChild, isParent: f.isParent, unitId: f.unit.id })))
    }

    // 4. Balanced Traversal (Include full family units at each step)
    const results = new Set<string>()
    results.add(rootId)

    // Helper to add a full family unit to results
    const addFamilyUnit = (unit: any) => {
      unit.parents.forEach((p: any) => results.add(p.parentId))
      unit.children.forEach((c: any) => results.add(c.childId))
    }

    // A. Ancestry Pass (UP)
    const traverseUp = (id: string, currentDepth: number) => {
      if (currentDepth >= dUp) return
      const families = familiesByPersonId.get(id) || []
      console.log(`[Family Tree API] traverseUp(id=${id}, depth=${currentDepth}) found ${families.length} families`)
      
      // Find families where this person is a child (i.e. their parents' unit)
      families.filter(f => f.isChild).forEach(f => {
        console.log(`[Family Tree API] traverseUp - processing unit ${f.unit.id} where person is child. Unit has ${f.unit.parents.length} parents.`)
        // Always include direct parents
        f.unit.parents.forEach((p: any) => {
          results.add(p.parentId)
          traverseUp(p.parentId, currentDepth + 1)
        })
        // Only include siblings (other children of this unit) when explicitly requested
        if (shouldIncludeSiblings) {
          f.unit.children.forEach((c: any) => results.add(c.childId))
        }
      })
    }
    traverseUp(rootId, 0)


    // B. Descendancy Pass (DOWN)
    const traverseDown = (id: string, currentDepth: number) => {
      if (currentDepth >= dDown) return
      const families = familiesByPersonId.get(id) || []
      // For anyone in the tree, find families where they are a parent (their children's unit)
      families.filter(f => f.isParent).forEach(f => {
        addFamilyUnit(f.unit)
        f.unit.children.forEach((c: { childId: string }) => {
          traverseDown(c.childId, currentDepth + 1)
        })
      })
    }
    traverseDown(rootId, 0)

    // C. Targeted branch expansions
    expandUpIds.forEach(id => { if (familiesByPersonId.has(id)) traverseUp(id, dUp - 1) })
    expandDownIds.forEach(id => { if (familiesByPersonId.has(id)) traverseDown(id, dDown - 1) })
    expandSiblingIds.forEach(id => {
      const families = familiesByPersonId.get(id) || []
      families.filter(f => f.isChild).forEach(f => {
        addFamilyUnit(f.unit)
      })
    })

    // D. Siblings Pass (Keep for backward compatibility with query param)
    if (shouldIncludeSiblings) {
      const rootFamilies = familiesByPersonId.get(rootId) || []
      rootFamilies.filter(f => f.isChild).forEach(f => {
        addFamilyUnit(f.unit)
      })
    }

    // E. Spousal Pass (Include spouses of everyone collected so far)
    // This is now largely covered by addFamilyUnit, but we check again for anyone missed
    const baseCollected = Array.from(results)
    baseCollected.forEach(id => {
      const families = familiesByPersonId.get(id) || []
      families.forEach(f => {
        if (f.unit.parents.some((p: { parentId: string }) => p.parentId === id)) {
          f.unit.parents.forEach((p: { parentId: string }) => results.add(p.parentId))
        }
      })
    })

    // 5. Construct response
    const peopleToReturn = allPeople.filter(p => results.has(p.id))
    const peopleIdsInResult = new Set(peopleToReturn.map(p => p.id))
    
    const responseData = peopleToReturn.map(person => {
      const edges: RelationshipEdge[] = []
      const families = familiesByPersonId.get(person.id) || []
      
      families.forEach(({ isParent, isChild, unit }) => {
        if (isParent) {
          // Spouses
          unit.parents.forEach((p: any) => {
            if (p.parentId !== person.id && peopleIdsInResult.has(p.parentId)) {
              edges.push({
                id: `spouse-${person.id}-${p.parentId}`,
                type: 'SPOUSE',
                direction: 'outgoing',
                isBiological: true,
                notes: null,
                relatedPerson: p.parent as any
              })
            }
          })
          // Children
          unit.children.forEach((c: any) => {
            edges.push({
              id: `parent-${person.id}-${c.childId}`,
              type: 'CHILD',
              direction: 'outgoing',
              isBiological: c.relationshipType === 'BIOLOGICAL',
              notes: null,
              relatedPerson: c.child as any
            })
          })
        }
        
        if (isChild) {
          // Parents
          unit.parents.forEach((p: any) => {
            edges.push({
              id: `child-${person.id}-${p.parentId}`,
              type: 'PARENT',
              direction: 'incoming',
              isBiological: p.relationshipType === 'BIOLOGICAL',
              notes: null,
              relatedPerson: p.parent as any
            })
          })

          // Siblings
          unit.children.forEach((c: any) => {
            if (c.childId !== person.id) {
              edges.push({
                id: `sibling-${person.id}-${c.childId}`,
                type: 'SIBLING',
                direction: 'outgoing',
                isBiological: true,
                notes: null,
                relatedPerson: c.child as any
              })
            }
          })
        }
      })
      
      return { ...person, relationshipEdges: edges }
    })

    console.log(`[Family Tree API] Returning ${responseData.length} people. Root ID: ${rootId}`);
    if (responseData.length > 1) {
      console.log(`[Family Tree API] Sample edges for root:`, responseData.find(p => p.id === rootId)?.relationshipEdges);
      console.log(`[Family Tree API] Sample edges for second person:`, responseData.find(p => p.id !== rootId)?.relationshipEdges);
    }

    return res.status(200).json({
      success: true,
      data: responseData,
      rootPersonId: rootId
    })
  },
})
