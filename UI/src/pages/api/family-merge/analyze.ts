import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'

interface PersonWithRelations {
  id: string
  firstName: string
  lastName: string | null
  birthDate: Date | null
  deathDate: Date | null
  sex: string | null
  names: { givenName: string; surname: string | null }[]
  familyChildLinks: { family: { parents: { parentId: string }[] } }[]
}

interface MatchCandidate {
  targetPersonId: string
  sourcePersonId: string
  matchScore: number
  matchReason: string
  details: {
    nameScore: number
    dateScore: number
    parentScore: number
  }
}

// Normalize name for comparison
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
}

// Calculate name similarity (0-1)
function calculateNameScore(
  targetPerson: PersonWithRelations,
  sourcePerson: PersonWithRelations
): number {
  const targetNames = [
    normalizeName(targetPerson.firstName),
    ...targetPerson.names.map(n => normalizeName(n.givenName))
  ].filter(Boolean)
  
  const targetSurnames = [
    normalizeName(targetPerson.lastName || ''),
    ...targetPerson.names.map(n => normalizeName(n.surname || ''))
  ].filter(Boolean)
  
  const sourceNames = [
    normalizeName(sourcePerson.firstName),
    ...sourcePerson.names.map(n => normalizeName(n.givenName))
  ].filter(Boolean)
  
  const sourceSurnames = [
    normalizeName(sourcePerson.lastName || ''),
    ...sourcePerson.names.map(n => normalizeName(n.surname || ''))
  ].filter(Boolean)
  
  // Check for any name match
  let nameMatch = false
  let surnameMatch = false
  
  for (const tName of targetNames) {
    for (const sName of sourceNames) {
      if (tName === sName || tName.includes(sName) || sName.includes(tName)) {
        nameMatch = true
        break
      }
    }
    if (nameMatch) break
  }
  
  for (const tSurname of targetSurnames) {
    for (const sSurname of sourceSurnames) {
      if (tSurname === sSurname) {
        surnameMatch = true
        break
      }
    }
    if (surnameMatch) break
  }
  
  if (nameMatch && surnameMatch) return 1.0
  if (surnameMatch) return 0.7
  if (nameMatch) return 0.5
  return 0
}

// Calculate date similarity (0-1)
function calculateDateScore(
  targetPerson: PersonWithRelations,
  sourcePerson: PersonWithRelations
): number {
  let score = 0
  let factors = 0
  
  if (targetPerson.birthDate && sourcePerson.birthDate) {
    factors++
    const targetBirth = new Date(targetPerson.birthDate)
    const sourceBirth = new Date(sourcePerson.birthDate)
    
    // Exact match
    if (targetBirth.toISOString().split('T')[0] === sourceBirth.toISOString().split('T')[0]) {
      score += 1.0
    } else if (targetBirth.getFullYear() === sourceBirth.getFullYear()) {
      // Same year
      if (targetBirth.getMonth() === sourceBirth.getMonth()) {
        score += 0.8 // Same year and month
      } else {
        score += 0.6 // Same year only
      }
    } else if (Math.abs(targetBirth.getFullYear() - sourceBirth.getFullYear()) <= 2) {
      score += 0.3 // Within 2 years
    }
  }
  
  if (targetPerson.deathDate && sourcePerson.deathDate) {
    factors++
    const targetDeath = new Date(targetPerson.deathDate)
    const sourceDeath = new Date(sourcePerson.deathDate)
    
    if (targetDeath.toISOString().split('T')[0] === sourceDeath.toISOString().split('T')[0]) {
      score += 1.0
    } else if (targetDeath.getFullYear() === sourceDeath.getFullYear()) {
      score += 0.8
    }
  }
  
  return factors > 0 ? score / factors : 0.5 // Neutral if no dates to compare
}

// Calculate parent similarity (0-1)
function calculateParentScore(
  targetPerson: PersonWithRelations,
  sourcePerson: PersonWithRelations,
  targetPeopleMap: Map<string, PersonWithRelations>,
  sourcePeopleMap: Map<string, PersonWithRelations>
): number {
  // Get parent IDs for both persons
  const targetParentIds = new Set<string>()
  const sourceParentIds = new Set<string>()
  
  for (const link of targetPerson.familyChildLinks) {
    for (const parent of link.family.parents) {
      targetParentIds.add(parent.parentId)
    }
  }
  
  for (const link of sourcePerson.familyChildLinks) {
    for (const parent of link.family.parents) {
      sourceParentIds.add(parent.parentId)
    }
  }
  
  if (targetParentIds.size === 0 || sourceParentIds.size === 0) {
    return 0.5 // Neutral if no parents known
  }
  
  // Check if any parents match by name
  let matchingParents = 0
  
  for (const tParentId of Array.from(targetParentIds)) {
    const tParent = targetPeopleMap.get(tParentId)
    if (!tParent) continue
    
    for (const sParentId of Array.from(sourceParentIds)) {
      const sParent = sourcePeopleMap.get(sParentId)
      if (!sParent) continue
      
      // Check if parents match by name
      const nameScore = calculateNameScore(tParent, sParent)
      if (nameScore >= 0.7) {
        matchingParents++
        break
      }
    }
  }
  
  const maxParents = Math.max(targetParentIds.size, sourceParentIds.size)
  return matchingParents / maxParents
}

// Main matching function
export async function findPersonMatches(
  targetFamilyspaceId: string,
  sourceFamilyspaceId: string,
  minScore: number = 0.6
): Promise<MatchCandidate[]> {
  // Fetch all people from both familyspaces with their relations
  const [targetPeople, sourcePeople] = await Promise.all([
    prisma.person.findMany({
      where: { familyspaceId: targetFamilyspaceId },
      include: {
        names: { select: { givenName: true, surname: true } },
        familyChildLinks: {
          include: {
            family: {
              include: {
                parents: { select: { parentId: true } }
              }
            }
          }
        }
      }
    }) as Promise<PersonWithRelations[]>,
    prisma.person.findMany({
      where: { familyspaceId: sourceFamilyspaceId },
      include: {
        names: { select: { givenName: true, surname: true } },
        familyChildLinks: {
          include: {
            family: {
              include: {
                parents: { select: { parentId: true } }
              }
            }
          }
        }
      }
    }) as Promise<PersonWithRelations[]>
  ])
  
  const targetPeopleMap = new Map(targetPeople.map(p => [p.id, p]))
  const sourcePeopleMap = new Map(sourcePeople.map(p => [p.id, p]))
  
  const candidates: MatchCandidate[] = []
  
  // Compare each source person against each target person
  for (const sourcePerson of sourcePeople) {
    let bestMatch: MatchCandidate | null = null
    
    for (const targetPerson of targetPeople) {
      const nameScore = calculateNameScore(targetPerson, sourcePerson)
      
      // Skip if names don't match at all
      if (nameScore === 0) continue
      
      const dateScore = calculateDateScore(targetPerson, sourcePerson)
      const parentScore = calculateParentScore(targetPerson, sourcePerson, targetPeopleMap, sourcePeopleMap)
      
      // Weighted overall score
      const overallScore = (nameScore * 0.5) + (dateScore * 0.3) + (parentScore * 0.2)
      
      if (overallScore >= minScore) {
        const reasons: string[] = []
        if (nameScore >= 0.9) reasons.push('exact name')
        else if (nameScore >= 0.7) reasons.push('matching surname')
        else reasons.push('partial name match')
        
        if (dateScore >= 0.8) reasons.push('matching birth date')
        else if (dateScore >= 0.5) reasons.push('similar dates')
        
        if (parentScore >= 0.5) reasons.push('matching parents')
        
        const candidate: MatchCandidate = {
          targetPersonId: targetPerson.id,
          sourcePersonId: sourcePerson.id,
          matchScore: overallScore,
          matchReason: reasons.join(' + '),
          details: {
            nameScore,
            dateScore,
            parentScore
          }
        }
        
        // Keep the best match for this source person
        if (!bestMatch || candidate.matchScore > bestMatch.matchScore) {
          bestMatch = candidate
        }
      }
    }
    
    if (bestMatch) {
      candidates.push(bestMatch)
    }
  }
  
  // Sort by match score descending
  return candidates.sort((a, b) => b.matchScore - a.matchScore)
}

export default apiHandler({
  // POST /api/family-merge/analyze - Analyze potential matches between familyspaces
  POST: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'ADMIN')
    
    const { sourceFamilyspaceId, minScore = 0.6 } = req.body
    
    if (!sourceFamilyspaceId) {
      throw Errors.badRequest('sourceFamilyspaceId is required')
    }
    
    // Verify user has access to source familyspace
    const sourceMembership = await prisma.membership.findFirst({
      where: {
        userId: user.id,
        familyspaceId: sourceFamilyspaceId,
        status: 'ACTIVE'
      }
    })
    
    if (!sourceMembership) {
      throw Errors.forbidden('You do not have access to the source familyspace')
    }
    
    // Find matches
    const matches = await findPersonMatches(
      user.familyspaceId,
      sourceFamilyspaceId,
      minScore
    )
    
    // Fetch person details for the matches
    const targetPersonIds = Array.from(new Set(matches.map(m => m.targetPersonId)))
    const sourcePersonIds = Array.from(new Set(matches.map(m => m.sourcePersonId)))
    
    const [targetPersons, sourcePersons] = await Promise.all([
      prisma.person.findMany({
        where: { id: { in: targetPersonIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          birthDate: true,
          deathDate: true,
          sex: true
        }
      }),
      prisma.person.findMany({
        where: { id: { in: sourcePersonIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          birthDate: true,
          deathDate: true,
          sex: true
        }
      })
    ])
    
    const targetPersonMap = new Map(targetPersons.map(p => [p.id, p]))
    const sourcePersonMap = new Map(sourcePersons.map(p => [p.id, p]))
    
    const enrichedMatches = matches.map(match => ({
      ...match,
      targetPerson: targetPersonMap.get(match.targetPersonId),
      sourcePerson: sourcePersonMap.get(match.sourcePersonId)
    }))
    
    // Calculate summary stats
    const sourcePersonCount = await prisma.person.count({
      where: { familyspaceId: sourceFamilyspaceId }
    })
    
    return successResponse(res, {
      targetFamilyspaceId: user.familyspaceId,
      sourceFamilyspaceId,
      totalSourcePeople: sourcePersonCount,
      matchedPeopleCount: matches.length,
      overallMatchScore: matches.length > 0
        ? matches.reduce((sum, m) => sum + m.matchScore, 0) / matches.length
        : 0,
      matches: enrichedMatches
    })
  }
})
