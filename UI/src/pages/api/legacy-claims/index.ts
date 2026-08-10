import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const initiateSchema = z.object({
  deceasedEmail: z.string().email(),
  proofType: z.enum(['OBITUARY_LINK', 'DEATH_CERTIFICATE']),
  proofData: z.string().min(5),
  notes: z.string().optional(),
})

export default apiHandler({
  // GET /api/legacy-claims - List claims related to the current user (as claimant or target)
  GET: async (req, res) => {
    const user = await getAuthUser(req, res)

    const initiatedClaims = await prisma.legacyClaim.findMany({
      where: { claimantId: user.id },
      include: {
        deceasedUser: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
      orderBy: { initiatedAt: 'desc' },
    })

    const claimsAgainstMe = await prisma.legacyClaim.findMany({
      where: { deceasedUserId: user.id },
      include: {
        claimant: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
      orderBy: { initiatedAt: 'desc' },
    })

    // If global admin, they can view all pending claims
    const currentUserDetails = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    })

    let allClaims: any[] = []
    if (currentUserDetails?.role === 'ADMIN') {
      allClaims = await prisma.legacyClaim.findMany({
        where: { status: 'COOLING_OFF' },
        include: {
          deceasedUser: { select: { id: true, email: true, displayName: true } },
          claimant: { select: { id: true, email: true, displayName: true } },
        },
        orderBy: { initiatedAt: 'desc' },
      })
    }

    return successResponse(res, {
      initiatedClaims,
      claimsAgainstMe,
      pendingAdminReview: allClaims,
    })
  },

  // POST /api/legacy-claims - Initiate a legacy claim
  POST: async (req, res) => {
    const user = await getAuthUser(req, res)

    const parsed = initiateSchema.safeParse(req.body)
    if (!parsed.success) {
      throw Errors.badRequest('Validation failed', parsed.error.format())
    }

    const { deceasedEmail, proofType, proofData, notes } = parsed.data

    // Find the target deceased user
    const deceased = await prisma.user.findUnique({
      where: { email: deceasedEmail.toLowerCase() },
      select: {
        id: true,
        status: true,
        legacySuccessorId: true,
        legacySuccessorStatus: true,
      },
    })

    if (!deceased) {
      throw Errors.notFound('Account not found with this email.')
    }

    // Security check: Must be designated and accepted legacy successor
    if (
      deceased.legacySuccessorId !== user.id ||
      deceased.legacySuccessorStatus !== 'ACCEPTED'
    ) {
      throw Errors.forbidden('You are not authorized to make a legacy claim for this user. You must be pre-designated as their successor.')
    }

    // Security check: Prevent claiming if they are already marked deceased
    if (deceased.status === 'DECEASED') {
      throw Errors.badRequest('This account is already marked as deceased.')
    }

    // Security check: Check if there's already an active claim on this user
    const activeClaim = await prisma.legacyClaim.findFirst({
      where: {
        deceasedUserId: deceased.id,
        status: { in: ['COOLING_OFF', 'APPROVED'] },
      },
    })

    if (activeClaim) {
      throw Errors.badRequest('A legacy claim has already been filed and is currently active or approved for this user.')
    }

    // Create the claim with 14 days cooling-off period
    const coolingOffDays = 14
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + coolingOffDays)

    const claim = await prisma.legacyClaim.create({
      data: {
        deceasedUserId: deceased.id,
        claimantId: user.id,
        status: 'COOLING_OFF',
        proofType,
        proofData,
        notes: notes || null,
        expiresAt,
      },
    })

    // Log the claim initiation in the system
    // In a real production app, we would dispatch warning emails to `deceasedEmail` here.
    
    return successResponse(res, claim)
  },
})
