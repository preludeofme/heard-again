import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'
import { auth } from '@trigger.dev/sdk/v3'
import type { MachinePresetName } from '@trigger.dev/core/v3'
import { exportTreeTask } from '@/trigger/export-tree-task'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

const TRIGGER_CONNECT_TIMEOUT_MS = 3_000

// Node count thresholds that determine what machine Trigger.dev provisions for the task.
// Using at least medium-1x (1 vCPU, 2 GB) for all exports; large-1x (4 vCPU, 8 GB) for
// large trees where Sharp may need to rasterize a very wide canvas.
const LARGE_TREE_THRESHOLD = 500

const RequestSchema = z.object({
  rootId: z.string().optional(),
  format: z.enum(['svg', 'png']).default('png'),
})

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Trigger.dev connection timed out')), ms),
    ),
  ])
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const parsed = RequestSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten() })
  }

  const { rootId, format } = parsed.data

  let user: Awaited<ReturnType<typeof getAuthUserWithFamilyspace>>
  try {
    user = await getAuthUserWithFamilyspace(req, res)
  } catch (authErr: unknown) {
    const message = authErr instanceof Error ? authErr.message : 'Unauthorized'
    return res.status(403).json({ success: false, error: message })
  }

  // Quick count so we can provision the right machine size before dispatching the task.
  // This is a fast index-only query and does not add meaningful latency.
  const nodeCount = await prisma.person.count({ where: { familyspaceId: user.familyspaceId } })
  const machinePreset: MachinePresetName = nodeCount > LARGE_TREE_THRESHOLD ? 'large-1x' : 'medium-1x'

  logger.info({ nodeCount, machinePreset, format }, 'Dispatching export task')

  try {
    const run = await withTimeout(
      exportTreeTask.trigger(
        {
          familyspaceId: user.familyspaceId,
          rootPersonId: rootId,
          userId: user.id,
          format,
        },
        {
          machine: machinePreset,
          tags: ['export:tree'],
        },
      ),
      TRIGGER_CONNECT_TIMEOUT_MS,
    )

    const publicAccessToken = await withTimeout(
      auth.createPublicToken({
        scopes: { read: { runs: [run.id] } },
        expirationTime: '1h',
      }),
      TRIGGER_CONNECT_TIMEOUT_MS,
    )

    const triggerApiUrl = process.env.TRIGGER_API_URL ?? 'https://api.trigger.dev'

    return res.status(200).json({
      success: true,
      runId: run.id,
      publicAccessToken,
      triggerApiUrl,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const isConnectError = message.includes('timed out') || message.includes('Connection error')
    if (isConnectError) {
      logger.warn({ message }, 'Trigger.dev unavailable — client will use local export fallback')
    } else {
      logger.error({ message }, 'Failed to trigger export task')
    }
    return res.status(503).json({ success: false, error: message })
  }
}
