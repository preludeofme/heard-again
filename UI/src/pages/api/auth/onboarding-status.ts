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

    // Get user's default familyspace
    const userWithFamilyspace = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        defaultFamilyspace: true,
      },
    })

    if (!userWithFamilyspace?.defaultFamilyspace) {
      return successResponse(res, {
        onboardingComplete: false,
        reason: 'no_familyspace',
      })
    }

    const familyspace = userWithFamilyspace.defaultFamilyspace

    // Check if familyspace still has the default "My Familyspace" name
    // or if the user doesn't have a person record in the familyspace
    const isDefaultFamilyspaceName = familyspace.name === 'My Familyspace'

    // Count people in the familyspace
    const peopleCount = await prisma.person.count({
      where: { familyspaceId: familyspace.id },
    })

    const onboardingComplete = !isDefaultFamilyspaceName && peopleCount > 0

    return successResponse(res, {
      onboardingComplete,
      familyspace: {
        id: familyspace.id,
        name: familyspace.name,
      },
      peopleCount,
      needsFamilyName: isDefaultFamilyspaceName,
      needsPerson: peopleCount === 0,
    })
  },
})
