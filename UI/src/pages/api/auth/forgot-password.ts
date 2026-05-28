import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { validate, rules } from '@/lib/validation'
import crypto from 'crypto'
import { EmailService } from '@/services/EmailService'

export default apiHandler({
  POST: async (req, res) => {
    const { email } = req.body

    // Validation
    const { valid, errors } = validate(req.body, {
      email: [rules.required, rules.email],
    })

    if (!valid) {
      throw Errors.badRequest('Validation failed', errors)
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    // Don't reveal if user exists or not for security
    if (!user) {
      return successResponse(res, {
        message: 'If an account exists with this email, you will receive password reset instructions.',
      })
    }

    // Check if user has a password (OAuth-only users can't reset password)
    if (!user.password) {
      return successResponse(res, {
        message: 'If an account exists with this email, you will receive password reset instructions.',
      })
    }

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now

    // Store the token in VerificationToken table
    // Using email as identifier and token for the reset flow
    await (prisma as any).verificationToken.create({
      data: {
        identifier: `password-reset:${user.id}`,
        token,
        expires,
      },
    })

    const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:4777'}/reset-password?token=${token}`

    try {
      await EmailService.sendPasswordResetEmail({
        to: user.email,
        resetUrl,
        userName: user.displayName || user.email,
      })
    } catch (emailError) {
      logger.error('[auth/forgot-password] Failed to send reset email:', emailError)
    }

    return successResponse(res, {
      message: 'If an account exists with this email, you will receive password reset instructions.',
    })
  },
}, { csrf: false })
