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
      const voiceProfiles = await prisma.voiceProfile.findMany({
        where: {
          personId,
          familyspaceId: person.familyspaceId,
        },
        select: {
          id: true,
          name: true,
          isDefault: true,
          isCloned: true,
          status: true,
          createdAt: true,
          modelArtifactAssetId: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return res.json({
        success: true,
        data: voiceProfiles,
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    logger.error('Voice profiles API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
