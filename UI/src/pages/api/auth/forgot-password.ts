import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { validate, rules } from '@/lib/validation'
import crypto from 'crypto'

async function sendPasswordResetEmail(params: {
  to: string
  resetUrl: string
  userName: string
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.EMAIL_FROM

  if (!apiKey || !fromEmail) {
    logger.warn('[auth/forgot-password] Email service not configured; logging reset URL for development')
    logger.info(`Password reset URL for ${params.to}: ${params.resetUrl}`)
    return
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [params.to],
      subject: 'Reset your Heard Again password',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #16334a;">
          <h2>Password reset request</h2>
          <p>Hi ${params.userName},</p>
          <p>We received a request to reset your Heard Again password.</p>
          <p>
            <a href="${params.resetUrl}" style="display:inline-block;padding:10px 16px;background:#16334a;color:#fff;text-decoration:none;border-radius:6px;">
              Reset password
            </a>
          </p>
          <p>If you did not request this, you can safely ignore this email.</p>
          <p>This link expires in 1 hour.</p>
        </div>
      `,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Failed to send reset email: ${body}`)
  }
}

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
      await sendPasswordResetEmail({
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
})
