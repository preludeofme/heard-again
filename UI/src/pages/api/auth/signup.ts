import type { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcrypt'
import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, errorResponse, Errors } from '@/lib/api-helpers'
import { validate, rules } from '@/lib/validation'

export default apiHandler({
  POST: async (req, res) => {
    const { email, password, displayName, workspaceName } = req.body

    // Validation
    const { valid, errors } = validate(req.body, {
      email: [rules.required, rules.email],
      password: [rules.required, rules.minLength(8)],
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

    // Generate a slug from workspace name or email
    const baseName = workspaceName || displayName || email.split('@')[0]
    const slug = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 40)

    // Ensure slug uniqueness
    const existingSlug = await prisma.workspace.findUnique({ where: { slug } })
    const finalSlug = existingSlug ? `${slug}-${Date.now().toString(36)}` : slug

    // Get the Free plan
    const freePlan = await prisma.plan.findFirst({
      where: { planType: 'FREE', isActive: true },
    })

    // Create user, workspace, membership, and subscription in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the user
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          displayName: displayName || null,
        },
      })

      // Create default workspace
      const workspace = await tx.workspace.create({
        data: {
          name: workspaceName || `${displayName || email.split('@')[0]}'s Family`,
          slug: finalSlug,
          ownerId: user.id,
          planType: 'FREE',
          deploymentMode: 'LOCAL',
        },
      })

      // Create OWNER membership
      await tx.membership.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      })

      // Create subscription if free plan exists
      if (freePlan) {
        await tx.subscription.create({
          data: {
            workspaceId: workspace.id,
            planId: freePlan.id,
            billingStatus: 'ACTIVE',
          },
        })
      }

      // Set default workspace
      await tx.user.update({
        where: { id: user.id },
        data: { defaultWorkspaceId: workspace.id },
      })

      return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        defaultWorkspaceId: workspace.id,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
        },
      }
    })

    return successResponse(res, {
      message: 'Account created successfully',
      user: result,
    }, 201)
  },
})
