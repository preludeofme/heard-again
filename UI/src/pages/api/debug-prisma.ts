import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { PrismaClient } = require('@prisma/client')
    const prisma = new PrismaClient()
    res.status(200).json({ success: true, message: 'Prisma loaded successfully', generated: true })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, stack: error.stack })
  }
}
