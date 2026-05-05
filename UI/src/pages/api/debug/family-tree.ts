
import { prisma } from '@/lib/prisma'
import { successResponse } from '@/lib/api-helpers'

export default async function handler(req: any, res: any) {
  const familyspaceId = '2e91ead3-1c6e-4e56-8776-39b084df7e2b'
  const rootPersonId = 'd4178115-8586-4fd7-abda-f4a24d3b4457'

  const [allPeople, allFamilyUnits] = await Promise.all([
    prisma.person.findMany({
      where: { familyspaceId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      }
    }),
    prisma.familyUnit.findMany({
      where: { familyspaceId },
      include: {
        parents: true,
        children: true,
      }
    })
  ])

  const familiesByPersonId = new Map<string, any[]>()
  allFamilyUnits.forEach(unit => {
    unit.parents.forEach(p => {
      if (!familiesByPersonId.has(p.parentId)) familiesByPersonId.set(p.parentId, [])
      familiesByPersonId.get(p.parentId)!.push({ isParent: true, isChild: false, unit })
    })
    unit.children.forEach(c => {
      if (!familiesByPersonId.has(c.childId)) familiesByPersonId.set(c.childId, [])
      familiesByPersonId.get(c.childId)!.push({ isParent: false, isChild: true, unit })
    })
  })

  const results = new Set<string>()
  results.add(rootPersonId)

  const traverseUp = (id: string, depth: number) => {
    if (depth >= 2) return
    const families = familiesByPersonId.get(id) || []
    families.filter(f => f.isChild).forEach(f => {
      f.unit.parents.forEach((p: any) => {
        results.add(p.parentId)
        traverseUp(p.parentId, depth + 1)
      })
    })
  }

  traverseUp(rootPersonId, 0)

  return res.status(200).json({
    success: true,
    allPeopleCount: allPeople.length,
    allFamilyUnitsCount: allFamilyUnits.length,
    rootConnections: familiesByPersonId.get(rootPersonId)?.length || 0,
    resultsSize: results.size,
    results: Array.from(results)
  })
}
