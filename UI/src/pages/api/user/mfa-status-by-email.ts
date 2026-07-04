import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'

/**
 * API endpoint to check if a user has MFA enabled and get their MFA method.
 * Used by the login page to determine whether to show the MFA challenge.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email } = req.body

  if (!email) {
    return res.status(400).json({ error: 'Email is required' })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        email: true,
        mfaEnabled: true,
        mfaMethod: true,
      },
    })

    if (!user) {
      return res.status(200).json({ mfaEnabled: false })
    }

    return res.status(200).json({
      email: user.email,
      mfaEnabled: user.mfaEnabled,
      mfaMethod: user.mfaMethod || null,
    })
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default handler
