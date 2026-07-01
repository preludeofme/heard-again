import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth-helpers'
import prisma from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Require ADMIN role — only admins can view user metrics
  await requireAdmin(req, res)

  const [total, users] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      select: {
        id: true,
        displayName: true,
        email: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const netNew = users.filter((u) => new Date(u.createdAt) >= thirtyDaysAgo).length

  return res.status(200).json({
    total,
    netNew,
    users: users.map((u) => ({
      id: u.id,
      name: u.displayName || u.email?.split('@')[0] || 'Unknown',
      email: u.email,
      createdAt: u.createdAt.toISOString(),
    })),
  })
}
