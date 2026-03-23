/**
 * ApiError Class
 * Finding 4: Standardize Error Handling
 * 
 * Provides consistent error classification across the application:
 * - NETWORK_ERROR: Retryable network issues
 * - VALIDATION_ERROR: Input validation failures
 * - NOT_FOUND: Resource doesn't exist
 * - PERMISSION_DENIED: Authorization failures
 * - UNKNOWN: Catch-all for unexpected errors
 */

export type ErrorCode = 
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'CONFLICT'
  | 'TIMEOUT'
  | 'UNKNOWN'

interface ApiErrorOptions {
  code: ErrorCode
  message: string
  statusCode?: number
  retryable?: boolean
  details?: Record<string, unknown>
}

export class ApiError extends Error {
  code: ErrorCode
  statusCode: number
  retryable: boolean
  details?: Record<string, unknown>

  constructor(options: ApiErrorOptions) {
    super(options.message)
    this.name = 'ApiError'
    this.code = options.code
    this.statusCode = options.statusCode ?? getDefaultStatusCode(options.code)
    this.retryable = options.retryable ?? isRetryableByDefault(options.code)
    this.details = options.details
  }

  static fromHttpResponse(response: Response, message?: string): ApiError {
    const code = mapStatusCodeToErrorCode(response.status)
    return new ApiError({
      code,
      message: message || `HTTP ${response.status}: ${response.statusText}`,
      statusCode: response.status,
    })
  }

  static fromError(error: unknown): ApiError {
    if (error instanceof ApiError) {
      return error
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return new ApiError({
        code: 'NETWORK_ERROR',
        message: 'Network connection failed. Please check your internet connection.',
        retryable: true,
      })
    }

    if (error instanceof Error) {
      return new ApiError({
        code: 'UNKNOWN',
        message: error.message,
      })
    }

    return new ApiError({
      code: 'UNKNOWN',
      message: 'An unexpected error occurred',
    })
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      retryable: this.retryable,
      details: this.details,
    }
  }
}

function getDefaultStatusCode(code: ErrorCode): number {
  const statusMap: Record<ErrorCode, number> = {
    'NETWORK_ERROR': 0,
    'VALIDATION_ERROR': 400,
    'NOT_FOUND': 404,
    'PERMISSION_DENIED': 403,
    'CONFLICT': 409,
    'TIMEOUT': 408,
    'UNKNOWN': 500,
  }
  return statusMap[code]
}

function isRetryableByDefault(code: ErrorCode): boolean {
  return code === 'NETWORK_ERROR' || code === 'TIMEOUT'
}

function mapStatusCodeToErrorCode(status: number): ErrorCode {
  if (status === 400) return 'VALIDATION_ERROR'
  if (status === 401 || status === 403) return 'PERMISSION_DENIED'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'CONFLICT'
  if (status === 408) return 'TIMEOUT'
  if (status >= 500) return 'NETWORK_ERROR'
  return 'UNKNOWN'
}

/**
 * Helper to handle API responses consistently
 */
export async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw ApiError.fromHttpResponse(
      response,
      data?.error || data?.message || undefined
    )
  }

  const data = await response.json()
  
  if (!data.success) {
    throw new ApiError({
      code: 'UNKNOWN',
      message: data.error || 'Request failed',
    })
  }

  return data.data as T
}

/**
 * Type guard for ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
