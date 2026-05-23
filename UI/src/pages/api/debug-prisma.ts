import type { NextApiRequest, NextApiResponse } from 'next'
import { personService } from '@/services'
import { createPersonSchema } from '@/schemas'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'
import { apiHandler } from '@/lib/api-helpers'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ 
    success: true, 
    personService: !!personService,
    schema: !!createPersonSchema,
    auth: !!getAuthUserWithFamilyspace,
    api: !!apiHandler
  })
}
