import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const results: Record<string, string> = {}

  const probe = (name: string, fn: () => unknown) => {
    try {
      fn()
      results[name] = 'ok'
    } catch (err: unknown) {
      results[name] = (err as Error).message ?? String(err)
    }
  }

  probe('isomorphic-dompurify', () => require('isomorphic-dompurify'))
  probe('jsdom', () => require('jsdom'))
  probe('@prisma/client', () => require('@prisma/client'))

  // Probe the services barrel — this is the import that was crashing API routes
  try {
    await import('@/services')
    results['@/services'] = 'ok'
  } catch (err: unknown) {
    results['@/services'] = (err as Error).message ?? String(err)
  }

  const allOk = Object.values(results).every((v) => v === 'ok')
  res.status(allOk ? 200 : 500).json({ ok: allOk, results })
}
