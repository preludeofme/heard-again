import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'
import { auth } from '@trigger.dev/sdk/v3'
import { exportTreeTask } from '@/trigger/export-tree-task'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  if (!process.env.RUNPOD_ENDPOINT_ID) {
    return res.status(500).json({
      success: false,
      error: 'Export is not configured. Missing RUNPOD_ENDPOINT_ID.',
    })
  }

  const isLocal = process.env.RUNPOD_ENDPOINT_ID === 'local'

  const { rootId } = req.body as { rootId?: string }

  try {
    // Render URL: the hidden export-tree page Puppeteer will visit.
    // Local: bypass Caddy (HTTPS/4777) and hit Next.js directly on its HTTP port.
    const nextjsPort = process.env.NEXTJS_INTERNAL_PORT ?? '4776'
    const renderUrl = isLocal
      ? `http://host.docker.internal:${nextjsPort}/export-tree?rootId=${rootId ?? ''}`
      : `https://${req.headers.host ?? ''}/export-tree?rootId=${rootId ?? ''}`

    // Forward the user's session cookie so Puppeteer can authenticate API calls.
    // NextAuth uses "__Secure-next-auth.session-token" over HTTPS and the plain
    // "next-auth.session-token" over HTTP — check both.
    const cookies = (req.headers.cookie ?? '').split(';').map((c) => c.trim())
    const sessionCookie =
      cookies.find((c) => c.startsWith('__Secure-next-auth.session-token=')) ??
      cookies.find((c) => c.startsWith('next-auth.session-token=')) ??
      ''

    // Public base URL the browser will use to download the finished PNG.
    const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)
      ?.split(',')[0]
      .trim()
    const publicBaseUrl = `${forwardedProto ?? 'https'}://${req.headers.host ?? 'localhost:4777'}`

    const run = await exportTreeTask.trigger(
      { renderUrl, sessionCookie, publicBaseUrl, isLocal },
      { tags: [`export:tree`] }
    )

    const publicAccessToken = await auth.createPublicToken({
      scopes: { read: { runs: [run.id] } },
      expirationTime: '1h',
    })

    // Include the platform URL so the client-side useRealtimeRun hook connects to the
    // correct server (self-hosted local instance vs cloud).
    const triggerApiUrl = process.env.TRIGGER_API_URL ?? 'https://api.trigger.dev'

    return res.status(200).json({
      success: true,
      runId: run.id,
      publicAccessToken,
      triggerApiUrl,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Failed to trigger export task:', message)
    return res.status(500).json({ success: false, error: 'Internal Server Error' })
  }
}
