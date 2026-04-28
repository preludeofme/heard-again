import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUser, requireFamilyspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  // GET /api/familyspaces/[id]/export - Export full data package
  GET: async (req, res) => {
    const user = await getAuthUser(req, res)
    const familyspaceId = req.query.id as string

    await requireFamilyspaceRole(user.id, familyspaceId, 'ADMIN')

    const familyspace = await prisma.familyspace.findUnique({
      where: { id: familyspaceId },
      include: {
        people: {
          include: {
            names: true,
            events: true,
          }
        },
        stories: {
          include: {
            assets: true,
            comments: true,
          }
        },
        assets: true,
        documents: true,
        voiceProfiles: true,
        members: {
          include: {
            user: {
              select: {
                displayName: true,
                email: true
              }
            }
          }
        }
      }
    })

    if (!familyspace) {
      throw Errors.notFound('Familyspace')
    }

    const exportPackage = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      familyspace: {
        id: familyspace.id,
        name: familyspace.name,
        slug: familyspace.slug,
        createdAt: familyspace.createdAt,
      },
      data: {
        people: familyspace.people,
        stories: familyspace.stories,
        assets: familyspace.assets.map(a => ({
          ...a,
          sizeBytes: Number(a.sizeBytes)
        })),
        documents: familyspace.documents,
        voiceProfiles: familyspace.voiceProfiles,
        members: familyspace.members.map(m => ({
          email: m.user.email,
          displayName: m.user.displayName,
          role: m.role,
          joinedAt: m.joinedAt
        }))
      }
    }

    // Use a custom stringifier to handle any remaining BigInts just in case
    const jsonString = JSON.stringify(exportPackage, (_, v) => 
      typeof v === 'bigint' ? v.toString() : v
    )
    
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).send(jsonString)
  },
})
