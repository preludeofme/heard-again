import type { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcrypt'
import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, errorResponse, Errors } from '@/lib/api-helpers'
import { validate, rules } from '@/lib/validation'
import { EmailService } from '@/services/EmailService'
import { logger } from '@/lib/logger'

export default apiHandler({
  POST: async (req, res) => {
    const { email, password, firstName, lastName, familyspaceName } = req.body
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || undefined

    // Validation
    const { valid, errors } = validate(req.body, {
      email: [rules.required, rules.email],
      password: [rules.required, rules.minLength(8)],
      firstName: [rules.required],
    })

    if (!valid) {
      throw Errors.badRequest('Validation failed', errors)
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      throw Errors.conflict('User already exists with this email')
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Generate a slug from familyspace name or display name or email
    const baseName = familyspaceName || displayName || email.split('@')[0]
    const slug = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 40)

    // Ensure slug uniqueness
    const existingSlug = await prisma.familyspace.findUnique({ where: { slug } })
    const finalSlug = existingSlug ? `${slug}-${Date.now().toString(36)}` : slug

    // Get the Free plan
    const freePlan = await prisma.plan.findFirst({
      where: { planType: 'FREE', isActive: true },
    })

    // Create user, familyspace, membership, and subscription in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the user
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          displayName: displayName ?? null,
          name: displayName ?? null,
        },
      })

      // Create default familyspace
      const familyspace = await tx.familyspace.create({
        data: {
          name: familyspaceName || `${displayName || email.split('@')[0]}'s Family`,
          slug: finalSlug,
          ownerId: user.id,
          planType: 'FREE',
          deploymentMode: 'LOCAL',
        },
      })

      // Create OWNER membership
      await tx.membership.create({
        data: {
          familyspaceId: familyspace.id,
          userId: user.id,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      })

      // Create subscription if free plan exists
      if (freePlan) {
        await tx.subscription.create({
          data: {
            familyspaceId: familyspace.id,
            planId: freePlan.id,
            billingStatus: 'ACTIVE',
          },
        })
      }

      // Set default familyspace
      await tx.user.update({
        where: { id: user.id },
        data: { defaultFamilyspaceId: familyspace.id },
      })

      return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        defaultFamilyspaceId: familyspace.id,
        familyspace: {
          id: familyspace.id,
          name: familyspace.name,
          slug: familyspace.slug,
        },
      }
    })

    // Send welcome email (fire-and-forget — don't block signup response)
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:4777'
    EmailService.sendWelcomeEmail({
      to: result.email,
      userName: result.displayName || result.email.split('@')[0],
      baseUrl,
    }).catch((err) => {
      logger.error('[auth/signup] Failed to send welcome email:', err)
    })

    return successResponse(res, {
      message: 'Account created successfully',
      user: result,
    }, 201)
  },
}, { csrf: false })
