import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { personService, storyService } from '@/services'
import { validate, rules } from '@/lib/validation'
import { withRateLimit, getClientIp } from '@/lib/security/rate-limiter'
import { verifyTurnstileToken } from '@/lib/security/turnstile'
import { EmailService } from '@/services/EmailService'
import { prisma } from '@/lib/prisma'

// Anonymous, unauthenticated submitter input — escape before interpolating
// into the moderator notification email's HTML body.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default withRateLimit(
  'public',
  apiHandler(
    {
      // POST /api/people/[id]/public-stories?token=... - anonymous story
      // submission about a publicly-shared person. Always lands in REVIEW
      // status pending moderation (see docs/sharing.md) — never published
      // directly.
      POST: async (req, res) => {
        const personId = req.query.id as string

        const profile = await personService.getPublicProfile(personId, req.query.token)
        if (!profile) throw Errors.notFound('Profile')

        const { title, content, submitterName, submitterEmail, turnstileToken } = req.body ?? {}

        const { valid, errors } = validate(req.body ?? {}, {
          title: [rules.required, rules.string, rules.maxLength(200)],
          content: [rules.required, rules.string, rules.maxLength(20000)],
          submitterName: [rules.required, rules.string, rules.maxLength(100)],
          submitterEmail: [rules.required, rules.email, rules.maxLength(200)],
        })
        if (!valid) {
          throw Errors.badRequest('Validation failed', errors)
        }

        const captchaOk = await verifyTurnstileToken(turnstileToken, getClientIp(req))
        if (!captchaOk) {
          throw Errors.badRequest('CAPTCHA verification failed, please try again')
        }

        // Look up the person's familyspace directly — getPublicProfile()
        // intentionally doesn't expose it.
        const person = await prisma.person.findUnique({
          where: { id: personId },
          select: { familyspaceId: true },
        })
        if (!person) throw Errors.notFound('Profile')

        const { id } = await storyService.createPublicSubmission(person.familyspaceId, personId, {
          title,
          content,
          submittedByName: submitterName,
          submittedByEmail: submitterEmail,
        })

        // Best-effort notification to familyspace owners/admins — a failure
        // here shouldn't fail the submission itself.
        try {
          const moderators = await prisma.membership.findMany({
            where: { familyspaceId: person.familyspaceId, role: { in: ['OWNER', 'ADMIN'] } },
            include: { user: { select: { email: true, displayName: true } } },
          })
          await Promise.all(
            moderators.map((m) =>
              EmailService.sendEmail({
                to: m.user.email,
                subject: 'A new story is waiting for your review',
                html: `<p>${escapeHtml(submitterName)} submitted a story about a family member for review.</p>` +
                  `<p><strong>${escapeHtml(title)}</strong></p>`,
              })
            )
          )
        } catch {
          // non-fatal
        }

        return successResponse(res, { id, status: 'pending_review' }, 201)
      },
    },
    { csrf: false }
  )
)
