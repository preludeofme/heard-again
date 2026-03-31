import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { validatePassword, hashPassword, verifyPassword } from '@/lib/security/password-policy'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const userId = session.user.id

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { currentPassword, newPassword } = req.body

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password required' })
  }

  try {
    // Validate new password against policy
    const validation = validatePassword(newPassword)
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Password does not meet security requirements',
        details: validation.errors,
        suggestions: validation.suggestions
      })
    }

    // Get user with current password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true, email: true }
    })

    if (!user || !user.password) {
      return res.status(400).json({ error: 'User not found or OAuth account' })
    }

    // Verify current password
    const isCurrentValid = await verifyPassword(currentPassword, user.password)
    if (!isCurrentValid) {
      return res.status(400).json({ error: 'Current password is incorrect' })
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword)

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    })

    logger.info({ userId }, 'Password changed successfully')

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully',
      strength: validation.strength
    })

  } catch (error) {
    logger.error({ userId, error }, 'Password change failed')
    return res.status(500).json({ error: 'Failed to update password' })
  }
}
