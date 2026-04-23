/**
 * Client for communicating with the Qwen3-TTS Python backend service.
 */

const TTS_SERVICE_URL = process.env.TTS_SERVICE_URL || 'http://localhost:4779'
const TTS_SERVICE_TOKEN = process.env.TTS_SERVICE_TOKEN

interface TTSRequestOptions {
  method?: string
  body?: any
  headers?: Record<string, string>
  isFormData?: boolean
  authToken?: string
  workspaceId?: string
}

export async function ttsRequest<T = any>(
  path: string,
  options: TTSRequestOptions = {}
): Promise<T> {
  const { 
    method = 'GET', 
    body, 
    headers = {}, 
    isFormData = false, 
    authToken,
    workspaceId 
  } = options

  const requestHeaders: Record<string, string> = isFormData 
    ? { ...headers } 
    : { 'Content-Type': 'application/json', ...headers }
  
  // 1. Use explicit authToken if provided (usually a user session token)
  if (authToken) {
    requestHeaders['Authorization'] = `Bearer ${authToken}`
  } 
  // 2. Fallback to service-to-service token if available
  else if (TTS_SERVICE_TOKEN) {
    requestHeaders['Authorization'] = `Bearer ${TTS_SERVICE_TOKEN}`
  }

  // Internal service-to-service calls MUST provide the workspace context
  if (workspaceId) {
    requestHeaders['X-Workspace-Id'] = workspaceId
  }

  const fetchOptions: RequestInit = {
    method,
    headers: requestHeaders,
  }

  if (body) {
    fetchOptions.body = isFormData ? body : JSON.stringify(body)
  }

  const url = `${TTS_SERVICE_URL}${path}`
  
  try {
    const response = await fetch(url, fetchOptions)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`TTS service error (${response.status}): ${errorText}`)
    }

    return response.json()
  } catch (error: any) {
    if (error.cause?.code === 'ECONNREFUSED') {
      throw new Error('TTS service is not running. Start it with: cd tts-service && ./start.sh')
    }
    throw error
  }
}

export async function ttsStreamResponse(path: string): Promise<Response> {
  const url = `${TTS_SERVICE_URL}${path}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`TTS audio fetch failed (${response.status})`)
  }
  return response
}

export { TTS_SERVICE_URL }
