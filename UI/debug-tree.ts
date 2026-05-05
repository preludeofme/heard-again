
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debug() {
  const rootId = 'd4178115-8586-4fd7-abda-f4a24d3b4457'
  console.log(`Debugging person: ${rootId}`)

  const person = await prisma.person.findUnique({
    where: { id: rootId },
    include: {
      familyChildLinks: {
        include: {
          family: {
            include: {
              parents: {
                include: {
                  parent: true
                }
              }
            }
          }
        }
      },
      parentInFamilies: {
        include: {
          family: {
            include: {
              children: {
                include: {
                  child: true
                }
              }
            }
          }
        }
      }
    }
  })

  if (!person) {
    console.log('Person not found!')
    return
  }

  console.log(`Person found: ${person.firstName} ${person.lastName} (${person.familyspaceId})`)
  console.log(`As child in families: ${person.familyChildLinks.length}`)
  person.familyChildLinks.forEach(link => {
    console.log(`  Family ${link.familyId} has ${link.family.parents.length} parents:`)
    link.family.parents.forEach(p => {
      console.log(`    Parent: ${p.parent.firstName} ${p.parent.lastName} (${p.parentId}) FS: ${p.parent.familyspaceId}`)
    })
  })

  console.log(`As parent in families: ${person.parentInFamilies.length}`)
  person.parentInFamilies.forEach(link => {
    console.log(`  Family ${link.familyId} has ${link.family.children.length} children`)
  })

  // Check counts for the familyspace
  const fsId = person.familyspaceId
  const peopleCount = await prisma.person.count({ where: { familyspaceId: fsId } })
  const unitCount = await prisma.familyUnit.count({ where: { familyspaceId: fsId } })
  console.log(`Familyspace ${fsId}: ${peopleCount} people, ${unitCount} family units`)

  // Check for orphan links in this FS
  const orphanParents = await prisma.familyParent.count({
    where: {
      family: { familyspaceId: fsId },
      parent: null // Should be impossible with FKs
    }
  })
  console.log(`Orphan parents: ${orphanParents}`)
}

debug().catch(console.error).finally(() => prisma.$disconnect())
