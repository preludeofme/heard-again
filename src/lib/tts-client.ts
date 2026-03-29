/**
 * Client for communicating with the Qwen3-TTS Python backend service.
 */

const TTS_SERVICE_URL = process.env.TTS_SERVICE_URL || 'http://localhost:8101'

interface TTSRequestOptions {
  method?: string
  body?: any
  headers?: Record<string, string>
  isFormData?: boolean
  authToken?: string
}

export async function ttsRequest<T = any>(
  path: string,
  options: TTSRequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {}, isFormData = false, authToken } = options

  const requestHeaders: Record<string, string> = isFormData 
    ? { ...headers } 
    : { 'Content-Type': 'application/json', ...headers }
  
  // Add auth token if provided
  if (authToken) {
    requestHeaders['Authorization'] = `Bearer ${authToken}`
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
