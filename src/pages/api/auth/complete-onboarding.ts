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

    // Update workspace with family name
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        name: familyName,
      },
    })

    // Create person record for the user
    const person = await prisma.person.create({
      data: {
        workspaceId: workspace.id,
        firstName: firstName,
        lastName: lastName || null,
        displayName: `${firstName} ${lastName || ''}`.trim(),
        personType: 'FAMILY',
        createdById: user.id,
      },
    })

    // Update user to mark onboarding as complete
    // We'll use the existing displayName field if it's not set
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
        id: workspace.id,
        name: familyName,
      },
      person: {
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
      },
    })
  },
})
