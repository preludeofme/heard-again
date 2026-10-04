import { funnelDayKey, funnelField, readFunnelCounts } from '@/lib/analytics/funnel-counters'
import { getRedisConnection } from '@/lib/redis-client'
import { isFunnelEventName, normalizePlanSlug } from '@/lib/analytics/funnel-steps'

jest.mock('@/lib/redis-client', () => ({ getRedisConnection: jest.fn() }))

const mockGetRedisConnection = getRedisConnection as jest.MockedFunction<typeof getRedisConnection>

/** Stand-in for the one ioredis call `readFunnelCounts` makes. */
function redisReturning(hashes: Record<string, Record<string, string>>) {
  return {
    hgetall: jest.fn(async (key: string) => hashes[key] ?? {}),
  } as unknown as ReturnType<typeof getRedisConnection>
}

describe('funnel counters', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('readFunnelCounts', () => {
    const now = new Date('2026-10-04T12:00:00.000Z')

    it('should total a step across plans and keep the per-plan split when a day has counts', async () => {
      mockGetRedisConnection.mockReturnValue(
        redisReturning({
          'ha:funnel:2026-10-04': {
            'pay_1_plan_selected|cloud_mid': '7',
            'pay_1_plan_selected|cloud_min': '3',
            'pay_5_checkout_opened|cloud_mid': '2',
          },
        })
      )

      const { sink, days } = await readFunnelCounts(2, now)
      const today = days[1]

      expect(sink).toBe('ok')

      expect(today.date).toBe('2026-10-04')
      expect(today.steps['pay_1_plan_selected']).toBe(10)
      expect(today.steps['pay_5_checkout_opened']).toBe(2)
      expect(today.byPlan['pay_1_plan_selected']).toEqual({ cloud_mid: 7, cloud_min: 3 })
    })

    it('should return one entry per requested day, oldest first, when days are empty', async () => {
      mockGetRedisConnection.mockReturnValue(redisReturning({}))

      const { sink, days } = await readFunnelCounts(3, now)

      expect(sink).toBe('ok')
      expect(days.map((d) => d.date)).toEqual(['2026-10-02', '2026-10-03', '2026-10-04'])
      expect(days.every((d) => Object.keys(d.steps).length === 0)).toBe(true)
    })

    it('should report no days when Redis is not configured, so zero is not mistaken for no conversions', async () => {
      mockGetRedisConnection.mockReturnValue(null)

      await expect(readFunnelCounts(7, now)).resolves.toEqual({
        sink: 'not_configured',
        days: [],
      })
    })

    it('should report an unreachable sink rather than zeros when the read fails', async () => {
      mockGetRedisConnection.mockReturnValue({
        hgetall: jest.fn(async () => {
          throw new Error('ECONNREFUSED')
        }),
      } as unknown as ReturnType<typeof getRedisConnection>)

      await expect(readFunnelCounts(7, now)).resolves.toEqual({
        sink: 'unreachable',
        days: [],
      })
    })

    it('should ignore a field whose stored value is not a number', async () => {
      mockGetRedisConnection.mockReturnValue(
        redisReturning({
          'ha:funnel:2026-10-04': { 'pay_1_plan_selected|cloud_mid': 'not-a-number' },
        })
      )

      const { days } = await readFunnelCounts(1, now)

      expect(days[0].steps).toEqual({})
    })
  })

  describe('key layout', () => {
    it('should bucket by UTC day so a count always has a date range', () => {
      expect(funnelDayKey(new Date('2026-10-04T23:59:59.000Z'))).toBe('ha:funnel:2026-10-04')
      expect(funnelDayKey(new Date('2026-10-05T00:00:01.000Z'))).toBe('ha:funnel:2026-10-05')
    })

    it('should round-trip a step and plan through the field encoding', async () => {
      mockGetRedisConnection.mockReturnValue(
        redisReturning({
          'ha:funnel:2026-10-04': { [funnelField('pay_6_checkout_completed', 'cloud_max')]: '1' },
        })
      )

      const { days } = await readFunnelCounts(1, new Date('2026-10-04T12:00:00.000Z'))

      expect(days[0].byPlan['pay_6_checkout_completed']).toEqual({ cloud_max: 1 })
    })
  })
})

describe('funnel event vocabulary', () => {
  it('should accept only the six browser-owned step names', () => {
    expect(isFunnelEventName('pay_1_plan_selected')).toBe(true)
    expect(isFunnelEventName('pay_6_checkout_completed')).toBe(true)
  })

  it('should reject a server-only step so the browser cannot post it', () => {
    expect(isFunnelEventName('pay_5_checkout_blocked')).toBe(false)
  })

  it('should reject anything that is not a known step', () => {
    expect(isFunnelEventName('arbitrary_event')).toBe(false)
    expect(isFunnelEventName(42)).toBe(false)
    expect(isFunnelEventName(undefined)).toBe(false)
  })

  it('should collapse an unknown plan slug so a crafted query string cannot fragment the split', () => {
    expect(normalizePlanSlug('cloud_mid')).toBe('cloud_mid')
    expect(normalizePlanSlug('../../etc/passwd')).toBe('unknown')
    expect(normalizePlanSlug(undefined)).toBe('none')
    expect(normalizePlanSlug('')).toBe('none')
  })
})
