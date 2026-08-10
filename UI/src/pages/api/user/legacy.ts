import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const designateSchema = z.object({
  email: z.string().email(),
})

const respondSchema = z.object({
  proposerId: z.string().uuid(),
  accept: z.boolean(),
})

export default apiHandler({
  // GET /api/user/legacy - Fetch legacy status and pending invitations
  GET: async (req, res) => {
    const user = await getAuthUser(req, res)

    // Get who this user has designated as their successor
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        legacySuccessorId: true,
        legacySuccessorStatus: true,
        legacySuccessor: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    })

    // Get pending invitations where THIS user is proposed as a successor by someone else
    const invitations = await prisma.user.findMany({
      where: {
        legacySuccessorId: user.id,
        legacySuccessorStatus: 'PENDING',
      },
      select: {
        id: true,
        email: true,
        displayName: true,
      },
    })

    return successResponse(res, {
      successor: currentUser?.legacySuccessor || null,
      status: currentUser?.legacySuccessorStatus || null,
      invitations,
    })
  },

  // POST /api/user/legacy - Designate successor or Respond to invitation
  POST: async (req, res) => {
    const user = await getAuthUser(req, res)
    
    // Check if responding to an invitation
    if (req.body.proposerId !== undefined) {
      const parsed = respondSchema.safeParse(req.body)
      if (!parsed.success) {
        throw Errors.badRequest('Invalid respond body. Required: proposerId (UUID) and accept (boolean)')
      }
      
      const { proposerId, accept } = parsed.data
      
      // Find the user who proposed this user
      const proposer = await prisma.user.findFirst({
        where: {
          id: proposerId,
          legacySuccessorId: user.id,
          legacySuccessorStatus: 'PENDING',
        },
      })
      
      if (!proposer) {
        throw Errors.notFound('No pending legacy invitation found from this user')
      }
      
      if (accept) {
        await prisma.user.update({
          where: { id: proposerId },
          data: { legacySuccessorStatus: 'ACCEPTED' },
        })
        return successResponse(res, { success: true, status: 'ACCEPTED' })
      } else {
        await prisma.user.update({
          where: { id: proposerId },
          data: {
            legacySuccessorId: null,
            legacySuccessorStatus: null,
          },
        })
        return successResponse(res, { success: true, status: 'DECLINED' })
      }
    }

    // Otherwise, designate a new successor
    const parsed = designateSchema.safeParse(req.body)
    if (!parsed.success) {
      throw Errors.badRequest('email is required and must be valid')
    }

    const { email } = parsed.data

    if (email.toLowerCase() === user.email.toLowerCase()) {
      throw Errors.badRequest('You cannot designate yourself as a legacy contact')
    }

    // Find successor user
    const successor = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true },
    })

    if (!successor) {
      throw Errors.notFound('No user found with this email address. They must register first.')
    }

    // Security check: Must share at least one active Familyspace
    const mySpaces = await prisma.membership.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      select: { familyspaceId: true },
    })

    const successorSpaces = await prisma.membership.findMany({
      where: {
        userId: successor.id,
        familyspaceId: { in: mySpaces.map(s => s.familyspaceId) },
        status: 'ACTIVE',
      },
      select: { familyspaceId: true },
    })

    if (successorSpaces.length === 0) {
      throw Errors.badRequest('The designated successor must be a member of at least one of your familyspaces.')
    }

    // Update current user's legacy configuration
    await prisma.user.update({
      where: { id: user.id },
      data: {
        legacySuccessorId: successor.id,
        legacySuccessorStatus: 'PENDING',
      },
    })

    return successResponse(res, {
      successorId: successor.id,
      email: successor.email,
      status: 'PENDING',
    })
  },

  // DELETE /api/user/legacy - Revoke designated legacy successor
  DELETE: async (req, res) => {
    const user = await getAuthUser(req, res)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        legacySuccessorId: null,
        legacySuccessorStatus: null,
      },
    })

    return successResponse(res, { revoked: true })
  },
})
