import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const patchSchema = z.object({
  personId: z.string().uuid(),
})

export default apiHandler({
  GET: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        linkedPersonId: true,
        linkedPerson: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            nickname: true,
            familyspaceId: true,
          },
        },
      },
    })
    return successResponse(res, record)
  },

  PATCH: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const parsed = patchSchema.safeParse(req.body)
    if (!parsed.success) throw Errors.badRequest('personId is required and must be a UUID')

    const { personId } = parsed.data

    const person = await prisma.person.findFirst({
      where: { id: personId, familyspaceId: user.familyspaceId },
      select: { id: true, firstName: true, lastName: true, nickname: true },
    })
    if (!person) throw Errors.notFound('Person')

    await prisma.user.update({
      where: { id: user.id },
      data: { linkedPersonId: personId },
    })

    return successResponse(res, { linkedPersonId: personId, linkedPerson: person })
  },

  DELETE: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    await prisma.user.update({
      where: { id: user.id },
      data: { linkedPersonId: null },
    })
    return successResponse(res, { linkedPersonId: null })
  },
})
