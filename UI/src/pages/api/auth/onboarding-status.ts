import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUser } from '@/lib/auth-helpers'

export default apiHandler({
  GET: async (req, res) => {
    // Verify user is authenticated
    const user = await getAuthUser(req, res)
    if (!user) {
      throw Errors.unauthorized('Authentication required')
    }

    // Get user's default workspace
    const userWithWorkspace = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        defaultWorkspace: true,
      },
    })

    if (!userWithWorkspace?.defaultWorkspace) {
      return successResponse(res, {
        onboardingComplete: false,
        reason: 'no_workspace',
      })
    }

    const workspace = userWithWorkspace.defaultWorkspace

    // Check if workspace still has the default "My Workspace" name
    // or if the user doesn't have a person record in the workspace
    const isDefaultWorkspaceName = workspace.name === 'My Workspace'

    // Count people in the workspace
    const peopleCount = await prisma.person.count({
      where: { workspaceId: workspace.id },
    })

    const onboardingComplete = !isDefaultWorkspaceName && peopleCount > 0

    return successResponse(res, {
      onboardingComplete,
      workspace: {
        id: workspace.id,
        name: workspace.name,
      },
      peopleCount,
      needsFamilyName: isDefaultWorkspaceName,
      needsPerson: peopleCount === 0,
    })
  },
})
