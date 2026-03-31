import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, errorResponse, Errors } from '@/lib/api-helpers'
import { validate, rules } from '@/lib/validation'

export default apiHandler({
  POST: async (req, res) => {
    const { token } = req.body

    // Validation
    const { valid, errors } = validate(req.body, {
      token: [rules.required],
    })

    if (!valid) {
      throw Errors.badRequest('Token is required', errors)
    }

    // Find the verification token
    const verificationToken = await (prisma as any).verificationToken.findUnique({
      where: { token },
    })

    if (!verificationToken) {
      throw Errors.badRequest('Invalid or expired token')
    }

    // Check if token is expired
    if (new Date() > verificationToken.expires) {
      throw Errors.badRequest('Token has expired')
    }

    // Verify it's a password reset token
    if (!verificationToken.identifier.startsWith('password-reset:')) {
      throw Errors.badRequest('Invalid token type')
    }

    // Extract user ID from identifier (format: password-reset:userId)
    const userId = verificationToken.identifier.replace('password-reset:', '')

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw Errors.badRequest('User not found')
    }

    return successResponse(res, {
      valid: true,
      email: user.email,
    })
  },
})
