import { task, metadata, logger as triggerLogger } from '@trigger.dev/sdk/v3'
import { prisma } from '@/lib/prisma'

export const processLegacyClaimsTask = task({
  id: 'process-legacy-claims',
  maxDuration: 600, // 10 minutes
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 30000,
    factor: 2,
  },
  run: async (): Promise<{ processedCount: number }> => {
    triggerLogger.info('Scanning for legacy claims that have finished their cooling-off period...')

    // Find all legacy claims in COOLING_OFF status whose expiresAt date has passed
    const now = new Date()
    const expiredClaims = await prisma.legacyClaim.findMany({
      where: {
        status: 'COOLING_OFF',
        expiresAt: {
          lte: now,
        },
      },
      include: {
        deceasedUser: {
          select: {
            id: true,
            email: true,
            linkedPersonId: true,
          },
        },
        claimant: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    })

    triggerLogger.info(`Found ${expiredClaims.length} claims ready to process.`)

    let processedCount = 0

    for (const claim of expiredClaims) {
      const deceasedUserId = claim.deceasedUserId
      const claimantId = claim.claimantId

      try {
        triggerLogger.info(`Processing claim ${claim.id} for deceased user ${claim.deceasedUser.email} takeover...`)

        // Run transaction: approve claim, set deceased status, mark tree profile, transfer space ownership
        await prisma.$transaction(async (tx) => {
          // 1. Update the claim status
          await tx.legacyClaim.update({
            where: { id: claim.id },
            data: {
              status: 'APPROVED',
              resolvedAt: new Date(),
              resolutionNotes: 'Automatically approved by background task after cooling-off period ended.',
            },
          })

          // 2. Mark the deceased user account as DECEASED
          await tx.user.update({
            where: { id: deceasedUserId },
            data: { status: 'DECEASED' },
          })

          // 3. Update the deceased user's linked Person in the family tree
          if (claim.deceasedUser.linkedPersonId) {
            await tx.person.update({
              where: { id: claim.deceasedUser.linkedPersonId },
              data: {
                isDeceased: true,
                deathDate: new Date(),
              },
            })
          }

          // 4. Find all Familyspaces owned by the deceased user
          const ownedSpaces = await tx.familyspace.findMany({
            where: { ownerId: deceasedUserId },
            select: { id: true },
          })

          for (const space of ownedSpaces) {
            // 5. Transfer ownership of the Familyspace
            await tx.familyspace.update({
              where: { id: space.id },
              data: { ownerId: claimantId },
            })

            // 6. Update/create Successor's membership with role OWNER
            const claimantMembership = await tx.membership.findUnique({
              where: {
                familyspaceId_userId: {
                  familyspaceId: space.id,
                  userId: claimantId,
                },
              },
            })

            if (claimantMembership) {
              await tx.membership.update({
                where: { id: claimantMembership.id },
                data: { role: 'OWNER', status: 'ACTIVE' },
              })
            } else {
              await tx.membership.create({
                data: {
                  familyspaceId: space.id,
                  userId: claimantId,
                  role: 'OWNER',
                  status: 'ACTIVE',
                },
              })
            }

            // 7. Demote deceased user's membership to LEGACY
            const deceasedMembership = await tx.membership.findUnique({
              where: {
                familyspaceId_userId: {
                  familyspaceId: space.id,
                  userId: deceasedUserId,
                },
              },
            })

            if (deceasedMembership) {
              await tx.membership.update({
                where: { id: deceasedMembership.id },
                data: { role: 'LEGACY' },
              })
            }
          }
        })

        processedCount++
        triggerLogger.info(`Successfully completed takeover for claim ${claim.id}.`)

      } catch (err: any) {
        triggerLogger.error(`Failed to process takeover for claim ${claim.id}: ${err.message}`, {
          claimId: claim.id,
          error: err,
        })
      }
    }

    return { processedCount }
  },
})
