import { getRedisConnection } from '@/lib/redis-client'
import type { FunnelEventName, FunnelServerEventName } from '@/lib/analytics/funnel-steps'

/**
 * Readable sink for the pay funnel.
 *
 * The log sink in `funnel-server.ts` costs nothing but can only be read from
 * the Vercel dashboard, which means every step count would be owner-gated.
 * Redis is already in the stack for rate limiting, so a counter hash per day
 * makes the same numbers readable through `/api/admin/funnel-counts` at no
 * extra cost and with no schema change.
 *
 * One hash per UTC day: `ha:funnel:2026-10-04` -> { "pay_1_plan_selected|cloud_mid": 3 }
 * Day-bucketing is what gives a count a date range instead of a running total.
 */

const KEY_PREFIX = 'ha:funnel'

/** Long enough to cover a launch retrospective, short enough to stay tiny. */
const RETENTION_SECONDS = 120 * 24 * 60 * 60

export function funnelDayKey(date: Date): string {
  return `${KEY_PREFIX}:${date.toISOString().slice(0, 10)}`
}

/**
 * Field is `step|plan` so a step total and its per-tier split come from the
 * same hash. `plan` is already normalized to a known slug by the callers, so
 * this cannot grow unbounded fields.
 */
export function funnelField(step: string, plan: string): string {
  return `${step}|${plan}`
}

/**
 * Fire-and-forget: a counter must never add latency to, or fail, the pay path.
 * The log line in `recordFunnelEvent` is the backstop if Redis is unreachable.
 */
export function incrementFunnelCounter(
  step: FunnelEventName | FunnelServerEventName,
  plan: string,
  now: Date = new Date()
): void {
  const redis = getRedisConnection()
  if (!redis) return

  const key = funnelDayKey(now)

  void (async () => {
    try {
      await redis
        .multi()
        .hincrby(key, funnelField(step, plan), 1)
        .expire(key, RETENTION_SECONDS)
        .exec()
    } catch {
      // Counting is best-effort. Losing a data point is acceptable; failing a
      // checkout to record one is not.
    }
  })()
}

export type FunnelDayCounts = {
  /** UTC date, `YYYY-MM-DD`. */
  date: string
  /** Step name -> total across all plans. */
  steps: Record<string, number>
  /** Step name -> plan slug -> count. */
  byPlan: Record<string, Record<string, number>>
}

/**
 * `sink` is the point of this shape. An all-zero funnel has two completely
 * different meanings — nobody converted, or we never recorded anything — and
 * reporting the first when the truth is the second is how a measurement task
 * produces a confidently wrong number.
 */
export type FunnelCountsResult = {
  sink: 'ok' | 'not_configured' | 'unreachable'
  days: FunnelDayCounts[]
}

/** A dead Redis must not hang an admin request; ioredis retries indefinitely. */
const READ_TIMEOUT_MS = 3000

/** Reads the last `days` UTC days inclusive of today, oldest first. */
export async function readFunnelCounts(
  days: number,
  now: Date = new Date()
): Promise<FunnelCountsResult> {
  const redis = getRedisConnection()
  if (!redis) return { sink: 'not_configured', days: [] }

  const dates: Date[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    dates.push(new Date(now.getTime() - i * 24 * 60 * 60 * 1000))
  }

  let hashes: Record<string, string>[]
  try {
    hashes = await Promise.race([
      Promise.all(dates.map((date) => redis.hgetall(funnelDayKey(date)))),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('redis read timed out')), READ_TIMEOUT_MS)
      ),
    ])
  } catch {
    return { sink: 'unreachable', days: [] }
  }

  const parsed = dates.map((date, i) => {
    const steps: Record<string, number> = {}
    const byPlan: Record<string, Record<string, number>> = {}

    for (const [field, raw] of Object.entries(hashes[i] ?? {})) {
      const count = Number.parseInt(raw, 10)
      if (!Number.isFinite(count)) continue

      const separator = field.lastIndexOf('|')
      const step = separator === -1 ? field : field.slice(0, separator)
      const plan = separator === -1 ? 'none' : field.slice(separator + 1)

      steps[step] = (steps[step] ?? 0) + count
      byPlan[step] = { ...(byPlan[step] ?? {}), [plan]: count }
    }

    return { date: date.toISOString().slice(0, 10), steps, byPlan }
  })

  return { sink: 'ok', days: parsed }
}
