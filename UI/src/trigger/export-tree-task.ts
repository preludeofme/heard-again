import { task, logger } from '@trigger.dev/sdk/v3'

export interface ExportTreePayload {
  renderUrl: string
  sessionCookie: string
  publicBaseUrl: string
  isLocal: boolean
}

export interface ExportTreeOutput {
  downloadUrl: string
}

const POLL_INTERVAL_MS = 5_000
const POLL_MAX_ATTEMPTS = 72 // 6 minutes

export const exportTreeTask = task({
  id: 'export-tree',
  maxDuration: 420, // 7 minutes — covers render + upload
  retry: { maxAttempts: 1 },

  run: async (payload: ExportTreePayload): Promise<ExportTreeOutput> => {
    const { renderUrl, sessionCookie, publicBaseUrl, isLocal } = payload

    logger.info('Starting family tree export', { renderUrl, isLocal })

    const workerUrl = isLocal
      ? 'http://localhost:8001/run'
      : `https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_ID}/run`

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (!isLocal) {
      if (!process.env.RUNPOD_API_KEY) throw new Error('Missing RUNPOD_API_KEY')
      headers['Authorization'] = `Bearer ${process.env.RUNPOD_API_KEY}`
    }

    const submitRes = await fetch(workerUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ input: { url: renderUrl, sessionCookie, publicBaseUrl } }),
    })

    if (!submitRes.ok) {
      const errText = await submitRes.text()
      throw new Error(`Worker submit failed (${submitRes.status}): ${errText}`)
    }

    const submitData = await submitRes.json() as Record<string, unknown>

    // Local Docker worker responds synchronously
    if (isLocal) {
      if (submitData.status !== 'COMPLETED') {
        throw new Error((submitData.error as string | undefined) ?? 'Local worker failed')
      }
      const output = submitData.output as { downloadUrl: string }
      logger.info('Local export complete', { downloadUrl: output.downloadUrl })
      return { downloadUrl: output.downloadUrl }
    }

    // Production RunPod is async — poll until COMPLETED or FAILED
    const jobId = submitData.id as string
    logger.info('RunPod job queued', { jobId })

    const statusUrl = `https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_ID}/status/${jobId}`

    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))

      const statusRes = await fetch(statusUrl, {
        headers: { Authorization: `Bearer ${process.env.RUNPOD_API_KEY}` },
      })

      const statusData = await statusRes.json() as Record<string, unknown>
      logger.info('RunPod poll', { attempt, status: statusData.status, jobId })

      if (statusData.status === 'COMPLETED') {
        const output = statusData.output as { downloadUrl: string }
        return { downloadUrl: output.downloadUrl }
      }

      if (statusData.status === 'FAILED') {
        throw new Error((statusData.error as string | undefined) ?? 'RunPod job failed')
      }
    }

    throw new Error(`RunPod job ${jobId} timed out after ${(POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS) / 60_000} minutes`)
  },
})
