import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { personService } from '@/services'
import { withRateLimit } from '@/lib/security/rate-limiter'

export default withRateLimit(
  'public',
  apiHandler(
    {
      // GET /api/people/[id]/public?token=... - public, no-login profile view
      GET: async (req, res) => {
        const personId = req.query.id as string
        const profile = await personService.getPublicProfile(personId, req.query.token)
        if (!profile) throw Errors.notFound('Profile')

        return successResponse(res, profile)
      },
    },
    { csrf: false }
  )
)
