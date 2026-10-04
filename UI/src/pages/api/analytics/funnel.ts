import { apiHandler, Errors } from '@/lib/api-helpers'
import { withRateLimit } from '@/lib/security/rate-limiter'
import { recordFunnelEvent, type FunnelProperties } from '@/lib/analytics/funnel-server'
import { isFunnelEventName } from '@/lib/analytics/funnel-steps'

/**
 * First-party collector for the pay-funnel steps the browser owns (plan click,
 * signup form reached). Vercel Web Analytics custom events need a Pro plan, so
 * this endpoint is the $0 path that makes those steps countable at all.
 *
 * Anonymous by design: a visitor has no account at step 1, so there is nothing
 * to authenticate and nothing about them worth storing. The body is reduced to
 * an allowlisted event name plus low-cardinality scalars before it is logged.
 */

const MAX_PROPERTIES = 8
const MAX_VALUE_LENGTH = 64

/** Rejects anything that would turn a step counter into free-text storage. */
function sanitizeProperties(input: unknown): FunnelProperties {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return {}

  const sanitized: FunnelProperties = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (Object.keys(sanitized).length >= MAX_PROPERTIES) break
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(key)) continue

    if (typeof value === 'string') {
      sanitized[key] = value.slice(0, MAX_VALUE_LENGTH)
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      sanitized[key] = value
    } else if (typeof value === 'boolean' || value === null) {
      sanitized[key] = value
    }
  }
  return sanitized
}

/** Same-site only: an app path, never an absolute URL from another origin. */
function sanitizePath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return 'unknown'
  return value.split('?')[0].slice(0, MAX_VALUE_LENGTH)
}

const handler = apiHandler(
  {
    POST: async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>

      if (!isFunnelEventName(body.event)) {
        throw Errors.badRequest('Unknown funnel event')
      }

      recordFunnelEvent(body.event, {
        ...sanitizeProperties(body.properties),
        path: sanitizePath(body.path),
        source: 'client',
      })

      // No body: the browser sends this with sendBeacon and never reads a reply.
      res.status(204).end()
    },
  },
  // Unauthenticated visitors have no session and therefore no CSRF token. The
  // endpoint stores no state and returns nothing, so there is nothing to forge.
  { csrf: false }
)

export default withRateLimit('general', handler)
