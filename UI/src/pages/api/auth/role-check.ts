import { logger } from '@/lib/logger'
import { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from 'next-auth/react'
import { prisma } from '@/lib/prisma'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Get the session - this validates the token
    const session = await getSession({ req })
    
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { workspace_id } = req.query
    
    if (!workspace_id || typeof workspace_id !== 'string') {
      return res.status(400).json({ error: 'workspace_id is required' })
    }

    // Check if user is member of the workspace
    const membership = await prisma.membership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace_id,
          userId: session.user.id
        }
      },
      select: {
        role: true
      }
    })

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this workspace' })
    }

    // Return the user's role in the workspace
    return res.status(200).json({
      role: membership.role,
      userId: session.user.id,
      workspaceId: workspace_id
    })

  } catch (error) {
    logger.error('Role check error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
