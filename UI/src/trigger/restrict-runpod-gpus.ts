import { task, logger } from '@trigger.dev/sdk/v3'

// RunPod GPU pool IDs — fixed set defined by RunPod's API.
// https://docs.runpod.io/references/gpu-types#gpu-pools
const ALL_GPU_POOLS = [
  'AMPERE_16',
  'AMPERE_24',
  'ADA_24',
  'ADA_32_PRO',
  'AMPERE_48',
  'ADA_48_PRO',
  'AMPERE_80',
  'ADA_80_PRO',
  'BLACKWELL_96',
  'HOPPER_141',
  'BLACKWELL_180',
] as const

type GpuPool = (typeof ALL_GPU_POOLS)[number]

const BLACKWELL_POOLS: readonly GpuPool[] = ['BLACKWELL_96', 'BLACKWELL_180']

const NON_BLACKWELL_POOLS = ALL_GPU_POOLS.filter(
  (p): p is GpuPool => !BLACKWELL_POOLS.includes(p as GpuPool)
)

export interface RestrictRunpodGpusPayload {
  /** When true, log the planned change but do not apply it. */
  dryRun?: boolean
  /**
   * When true, remove the Blackwell restriction (restores all GPU pools).
   * Use after deploying a Blackwell-compatible image.
   */
  allowAll?: boolean
}

export interface RestrictRunpodGpusOutput {
  endpointId: string
  previousGpuIds: string
  newGpuIds: string
  excludedPools: string[]
  applied: boolean
}

const RUNPOD_GRAPHQL_URL = 'https://api.runpod.io/graphql'

const QUERY_ENDPOINTS = `
  query Query {
    myself {
      endpoints {
        id
        name
        templateId
        gpuIds
        workersMin
        workersMax
        idleTimeout
        scalerType
        scalerValue
        networkVolumeId
        locations
      }
    }
  }
`

function buildSaveEndpointMutation(endpoint: {
  id: string
  name: string
  templateId: string
  gpuIds: string
  workersMin: number
  workersMax: number
  idleTimeout: number
  scalerType: string
  scalerValue: number
  networkVolumeId: string | null
  locations: string | null
}): string {
  return `
    mutation {
      saveEndpoint(input: {
        id: "${endpoint.id}"
        name: "${endpoint.name}"
        templateId: "${endpoint.templateId}"
        gpuIds: "${endpoint.gpuIds}"
        workersMin: ${endpoint.workersMin}
        workersMax: ${endpoint.workersMax}
        idleTimeout: ${endpoint.idleTimeout}
        scalerType: "${endpoint.scalerType}"
        scalerValue: ${endpoint.scalerValue}
        networkVolumeId: "${endpoint.networkVolumeId ?? ''}"
        locations: "${endpoint.locations ?? ''}"
      }) {
        id
        name
        gpuIds
        workersMin
        workersMax
      }
    }
  `
}

async function runpodGraphQL<T>(query: string, apiKey: string): Promise<T> {
  const res = await fetch(RUNPOD_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query }),
  })

  if (!res.ok) {
    throw new Error(`RunPod GraphQL request failed (${res.status}): ${await res.text()}`)
  }

  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> }

  if (json.errors?.length) {
    throw new Error(`RunPod GraphQL error: ${json.errors.map((e) => e.message).join(', ')}`)
  }

  if (!json.data) {
    throw new Error('RunPod GraphQL returned no data')
  }

  return json.data
}

export const restrictRunpodGpus = task({
  id: 'restrict-runpod-gpus',
  retry: { maxAttempts: 1 },
  run: async (payload: RestrictRunpodGpusPayload): Promise<RestrictRunpodGpusOutput> => {
    const { dryRun = false, allowAll = false } = payload

    const apiKey = process.env.RUNPOD_API_KEY
    const endpointId = process.env.RUNPOD_TTS_ENDPOINT_ID

    if (!apiKey) throw new Error('RUNPOD_API_KEY is not set in environment')
    if (!endpointId) throw new Error('RUNPOD_TTS_ENDPOINT_ID is not set in environment')

    // ── 1. Fetch current endpoint config ─────────────────────────────────────
    logger.info('Fetching RunPod endpoint config', { endpointId })

    const endpointsData = await runpodGraphQL<{
      myself: {
        endpoints: Array<{
          id: string
          name: string
          templateId: string
          gpuIds: string
          workersMin: number
          workersMax: number
          idleTimeout: number
          scalerType: string
          scalerValue: number
          networkVolumeId: string | null
          locations: string | null
        }>
      }
    }>(QUERY_ENDPOINTS, apiKey)

    const endpoint = endpointsData.myself.endpoints.find((e) => e.id === endpointId)

    if (!endpoint) {
      const ids = endpointsData.myself.endpoints.map((e) => e.id)
      throw new Error(`Endpoint '${endpointId}' not found. Available: ${ids.join(', ')}`)
    }

    logger.info('Current endpoint config', {
      id: endpoint.id,
      name: endpoint.name,
      gpuIds: endpoint.gpuIds,
    })

    // ── 2. Determine target pool IDs ─────────────────────────────────────────
    const newGpuIds = allowAll
      ? ALL_GPU_POOLS.join(',')
      : NON_BLACKWELL_POOLS.join(',')

    const excludedPools = allowAll ? [] : [...BLACKWELL_POOLS]

    logger.info('Target GPU pools', { newGpuIds, excludedPools, allowAll })

    const output: RestrictRunpodGpusOutput = {
      endpointId: endpoint.id,
      previousGpuIds: endpoint.gpuIds,
      newGpuIds,
      excludedPools,
      applied: false,
    }

    if (endpoint.gpuIds === newGpuIds) {
      logger.info('No change needed — GPU pool IDs already match target')
      return { ...output, applied: true }
    }

    // ── 3. Apply or dry-run ───────────────────────────────────────────────────
    if (dryRun) {
      logger.info('dryRun: would update GPU pool IDs', {
        from: endpoint.gpuIds,
        to: newGpuIds,
      })
      return output
    }

    logger.info('Applying GPU pool constraint', { from: endpoint.gpuIds, to: newGpuIds })

    const mutation = buildSaveEndpointMutation({ ...endpoint, gpuIds: newGpuIds })
    const result = await runpodGraphQL<{
      saveEndpoint: { id: string; name: string; gpuIds: string }
    }>(mutation, apiKey)

    logger.info('Endpoint updated successfully', result.saveEndpoint)

    return { ...output, applied: true }
  },
})
