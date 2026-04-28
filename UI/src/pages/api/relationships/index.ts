import { logger } from '@/lib/logger'
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions)
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { personId } = req.query
    if (!personId || typeof personId !== 'string') {
      return res.status(400).json({ error: 'Missing personId parameter' })
    }

    // Check user has access to this person
    const person = await prisma.person.findFirst({
      where: {
        id: personId,
        familyspace: {
          members: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    })

    if (!person) {
      return res.status(404).json({ error: 'Person not found' })
    }

    if (req.method === 'GET') {
      // Get families where this person is a parent
      const parentFamilies = await prisma.familyParent.findMany({
        where: { parentId: personId },
        include: {
          family: {
            include: {
              parents: {
                include: {
                  parent: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      displayName: true,
                    },
                  },
                },
              },
              children: {
                include: {
                  child: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      displayName: true,
                    },
                  },
                },
              },
            },
          },
        },
      })

      // Get families where this person is a child
      const childFamilies = await prisma.familyChild.findMany({
        where: { childId: personId },
        include: {
          family: {
            include: {
              parents: {
                include: {
                  parent: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      displayName: true,
                    },
                  },
                },
              },
              children: {
                include: {
                  child: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      displayName: true,
                    },
                  },
                },
              },
            },
          },
        },
      })

      // Transform into relationships
      const relationships = []

      // Parents from child families
      for (const fc of childFamilies) {
        for (const parent of fc.family.parents) {
          if (parent.parentId !== personId) {
            relationships.push({
              id: `fam:${fc.family.id}:${parent.parentId}`,
              type: 'PARENT',
              person: parent.parent,
              relationshipType: parent.relationshipType,
            })
          }
        }
      }

      // Children from parent families
      for (const fp of parentFamilies) {
        for (const child of fp.family.children) {
          if (child.childId !== personId) {
            relationships.push({
              id: `fam:${fp.family.id}:${child.childId}`,
              type: 'CHILD',
              person: child.child,
              relationshipType: child.relationshipType,
            })
          }
        }
      }

      // Spouses from parent families
      for (const fp of parentFamilies) {
        for (const otherParent of fp.family.parents) {
          if (otherParent.parentId !== personId) {
            relationships.push({
              id: `fam:${fp.family.id}:${otherParent.parentId}`,
              type: 'SPOUSE',
              person: otherParent.parent,
            })
          }
        }
      }

      return res.json({
        success: true,
        data: relationships,
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    logger.error('Relationships API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
