import type { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcrypt'
import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, errorResponse, Errors } from '@/lib/api-helpers'
import { validate, rules } from '@/lib/validation'

export default apiHandler({
  POST: async (req, res) => {
    const { token, password } = req.body

    // Validation
    const { valid, errors } = validate(req.body, {
      token: [rules.required],
      password: [rules.required, rules.minLength(8)],
    })

    if (!valid) {
      throw Errors.badRequest('Validation failed', errors)
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

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Update user's password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    // Delete the used token
    await (prisma as any).verificationToken.delete({
      where: { token },
    })

    return successResponse(res, {
      message: 'Password has been reset successfully. You can now sign in with your new password.',
    })
  },
}, { csrf: false })
