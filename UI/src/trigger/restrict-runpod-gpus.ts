import { task, logger } from '@trigger.dev/sdk/v3'

export interface RestrictRunpodGpusPayload {
  /** When true, log the planned change but do not apply it. */
  dryRun?: boolean
  /**
   * When true, remove the GPU restriction (revert to RunPod defaults).
   * Use after deploying a Blackwell-compatible image.
   */
  allowAll?: boolean
}

export interface RestrictRunpodGpusOutput {
  endpointId: string
  previousGpuIds: string
  newGpuIds: string
  excludedGpus: Array<{ id: string; displayName: string; memoryInGb: number }>
  applied: boolean
}

const RUNPOD_GRAPHQL_URL = 'https://api.runpod.io/graphql'

const QUERY_GPU_TYPES = `
  query GpuTypes {
    gpuTypes {
      id
      displayName
      memoryInGb
    }
  }
`

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

    // ── 1. Fetch endpoint config ──────────────────────────────────────────────
    logger.info('Fetching RunPod endpoint config', { endpointId })

    const endpointsData = await runpodGraphQL<{
      myself: { endpoints: Array<{
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
      }> }
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

    // ── 2. Determine new GPU IDs ──────────────────────────────────────────────
    let newGpuIds: string
    let excludedGpus: Array<{ id: string; displayName: string; memoryInGb: number }> = []

    if (allowAll) {
      // RunPod's default — effectively no restriction
      newGpuIds = 'AMPERE_16'
      logger.info('allowAll: resetting GPU constraint to RunPod default')
    } else {
      logger.info('Fetching RunPod GPU types')

      const gpuData = await runpodGraphQL<{
        gpuTypes: Array<{ id: string; displayName: string; memoryInGb: number }>
      }>(QUERY_GPU_TYPES, apiKey)

      excludedGpus = gpuData.gpuTypes.filter((g) =>
        g.displayName.toLowerCase().includes('blackwell')
      )
      const allowedGpus = gpuData.gpuTypes.filter(
        (g) => !g.displayName.toLowerCase().includes('blackwell')
      )

      logger.info('GPU classification', {
        total: gpuData.gpuTypes.length,
        allowed: allowedGpus.length,
        excluded: excludedGpus.map((g) => `${g.id} (${g.displayName})`),
      })

      if (allowedGpus.length === 0) {
        throw new Error('No non-Blackwell GPUs found — cannot restrict')
      }

      newGpuIds = allowedGpus.map((g) => g.id).join(',')
    }

    const output: RestrictRunpodGpusOutput = {
      endpointId: endpoint.id,
      previousGpuIds: endpoint.gpuIds,
      newGpuIds,
      excludedGpus,
      applied: false,
    }

    if (endpoint.gpuIds === newGpuIds) {
      logger.info('No change needed — GPU IDs already match target')
      return { ...output, applied: true }
    }

    // ── 3. Apply ──────────────────────────────────────────────────────────────
    if (dryRun) {
      logger.info('dryRun: would update GPU IDs', {
        from: endpoint.gpuIds,
        to: newGpuIds,
      })
      return output
    }

    logger.info('Applying GPU constraint update', { from: endpoint.gpuIds, to: newGpuIds })

    const mutation = buildSaveEndpointMutation({ ...endpoint, gpuIds: newGpuIds })
    const result = await runpodGraphQL<{
      saveEndpoint: { id: string; name: string; gpuIds: string }
    }>(mutation, apiKey)

    logger.info('Endpoint updated', result.saveEndpoint)

    return { ...output, applied: true }
  },
})
