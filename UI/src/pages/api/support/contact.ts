import type { NextApiRequest, NextApiResponse } from 'next'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { validate, rules } from '@/lib/validation'
import { EmailService } from '@/services/EmailService'
import { withRateLimit } from '@/lib/security/rate-limiter'

async function handleContact(req: NextApiRequest, res: NextApiResponse) {
  const { name, email, subject, message } = req.body

  // Validation
  const { valid, errors } = validate(req.body, {
    name: [rules.string, rules.maxLength(100)],
    email: [rules.required, rules.email, rules.maxLength(100)],
    subject: [rules.required, rules.string, rules.maxLength(200)],
    message: [rules.required, rules.string, rules.maxLength(5000)],
  })

  if (!valid) {
    throw Errors.badRequest('Validation failed', errors)
  }

  // Send the support email
  const success = await EmailService.sendSupportContactEmail({
    name,
    email,
    subject,
    message,
  })

  if (!success) {
    throw Errors.internal('Failed to send support email')
  }

  return successResponse(res, {
    message: 'Support request sent successfully',
  })
}

export default withRateLimit(
  'general',
  apiHandler(
    {
      POST: handleContact,
    },
    { csrf: false }
  )
)
