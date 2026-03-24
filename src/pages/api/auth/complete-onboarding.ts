import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { validate, rules } from '@/lib/validation'
import { getAuthUser } from '@/lib/auth-helpers'

export default apiHandler({
  POST: async (req, res) => {
    // Verify user is authenticated
    const user = await getAuthUser(req, res)
    if (!user) {
      throw Errors.unauthorized('Authentication required')
    }

    const { familyName, firstName, lastName } = req.body

    // Validation
    const { valid, errors } = validate(req.body, {
      familyName: [rules.required],
      firstName: [rules.required],
    })

    if (!valid) {
      throw Errors.badRequest('Validation failed', errors)
    }

    // Get user's default workspace
    const userWithWorkspace = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        defaultWorkspace: true,
      },
    })

    if (!userWithWorkspace?.defaultWorkspace) {
      throw Errors.notFound('No workspace found for user')
    }

    const workspace = userWithWorkspace.defaultWorkspace

    // Use transaction to ensure all operations succeed or fail together
    const result = await prisma.$transaction(async (tx) => {
      // Update workspace with family name
      const updatedWorkspace = await tx.workspace.update({
        where: { id: workspace.id },
        data: { name: familyName },
      })

      // Create person record for the user
      const person = await tx.person.create({
        data: {
          workspaceId: workspace.id,
          firstName: firstName,
          lastName: lastName || null,
          displayName: `${firstName} ${lastName || ''}`.trim(),
          personType: 'FAMILY',
          createdById: user.id,
        },
      })

      // Note: FamilyUnit is not auto-created - user builds family tree manually
      // This allows children, parents, or any family role to sign up without
      // incorrect assumptions about their position in the family structure

      return { updatedWorkspace, person }
    })

    // Update user display name outside transaction (optional field)
    if (!user.displayName) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          displayName: `${firstName} ${lastName || ''}`.trim(),
        },
      })
    }

    return successResponse(res, {
      message: 'Onboarding completed successfully',
      workspace: {
        id: result.updatedWorkspace.id,
        name: familyName,
      },
      person: {
        id: result.person.id,
        firstName: result.person.firstName,
        lastName: result.person.lastName,
      },
    })
  },
})
