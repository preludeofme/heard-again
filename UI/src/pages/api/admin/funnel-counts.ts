import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth-helpers'
import { readFunnelCounts } from '@/lib/analytics/funnel-counters'
import { FUNNEL_EVENT_NAMES, FUNNEL_SERVER_EVENTS } from '@/lib/analytics/funnel-steps'

/**
 * Reads the pay-funnel step counts.
 *
 * This route is the reason the Redis counter sink exists: the log sink can only
 * be read from the Vercel dashboard, so without this the question "how many
 * people reached checkout" could only be answered by the account owner.
 *
 * Returns counts and dates only — never a user, email, or Stripe identifier.
 */

const DEFAULT_DAYS = 14
const MAX_DAYS = 120

/** The steps in funnel order, so a zero step is visible rather than absent. */
const ALL_STEPS: readonly string[] = [
  ...FUNNEL_EVENT_NAMES,
  ...Object.values(FUNNEL_SERVER_EVENTS),
].sort()

function parseDays(value: unknown): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : NaN
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_DAYS
  return Math.min(parsed, MAX_DAYS)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  await requireAdmin(req, res)

  const days = parseDays(req.query.days)
  const { sink, days: byDay } = await readFunnelCounts(days)

  // Totals across the window, with every known step present at zero so a step
  // that never fired reads as a real zero and not as missing instrumentation.
  const totals: Record<string, number> = Object.fromEntries(ALL_STEPS.map((step) => [step, 0]))
  for (const day of byDay) {
    for (const [step, count] of Object.entries(day.steps)) {
      totals[step] = (totals[step] ?? 0) + count
    }
  }

  return res.status(200).json({
    range: {
      days,
      from: byDay[0]?.date ?? null,
      to: byDay[byDay.length - 1]?.date ?? null,
    },
    // Anything other than "ok" means these zeros are not evidence about
    // conversion. Read the `funnel` log lines instead before concluding
    // anything about drop-off.
    sink,
    totals,
    byDay,
  })
}
