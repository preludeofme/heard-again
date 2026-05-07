
import { PrismaClient } from '@prisma/client'
import handler from './src/pages/api/people/family-tree'
import { NextApiRequest, NextApiResponse } from 'next'

// Mocking NextAuth and Prisma for the test
const prisma = new PrismaClient()

async function test() {
  const familyspaceId = '2e91ead3-1c6e-4e56-8776-39b084df7e2b'
  const rootPersonId = 'd4178115-8586-4fd7-abda-f4a24d3b4457'

  console.log(`Testing Family Tree API for FS: ${familyspaceId}, Root: ${rootPersonId}`)

  // Instead of mocking the whole request/response which is hard with apiHandler wrapper,
  // let's just extract the logic and run it here.

  const [allPeople, allFamilyUnits] = await Promise.all([
    prisma.person.findMany({
      where: { familyspaceId },
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
      }
    }),
    prisma.familyUnit.findMany({
      where: { familyspaceId },
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

  console.log(`allPeople: ${allPeople.length}`)
  console.log(`allFamilyUnits: ${allFamilyUnits.length}`)

  const familiesByPersonId = new Map<string, { isParent: boolean, isChild: boolean, unit: any }[]>()

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

  console.log(`familiesByPersonId keys: ${familiesByPersonId.size}`)
  console.log(`Root has families? ${familiesByPersonId.has(rootPersonId)}`)
  if (familiesByPersonId.has(rootPersonId)) {
    console.log(`Root families:`, familiesByPersonId.get(rootPersonId)?.map(f => ({ isChild: f.isChild, isParent: f.isParent, unitId: f.unit.id })))
  }

  const results = new Set<string>()
  results.add(rootPersonId)

  const dUp = 2
  const traverseUp = (id: string, currentDepth: number) => {
    if (currentDepth >= dUp) return
    const families = familiesByPersonId.get(id) || []
    console.log(`traverseUp(id=${id}, depth=${currentDepth}) found ${families.length} families`)
    
    families.filter(f => f.isChild).forEach(f => {
      console.log(`  Processing unit ${f.unit.id} as child. Unit has ${f.unit.parents.length} parents.`)
      f.unit.parents.forEach((p: any) => {
        console.log(`    Adding parent: ${p.parentId}`)
        results.add(p.parentId)
        traverseUp(p.parentId, currentDepth + 1)
      })
    })
  }

  traverseUp(rootPersonId, 0)
  console.log(`Results after traverseUp: ${results.size}`)
  console.log(`People in results:`, Array.from(results))
}

test().catch(console.error).finally(() => prisma.$disconnect())
