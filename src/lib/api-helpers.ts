import type { NextApiRequest, NextApiResponse } from 'next'

// ============================================
// API Response Helpers (Pages Router)
// ============================================

export interface ApiSuccessResponse<T = any> {
  success: true
  data: T
}

export interface ApiErrorResponse {
  success: false
  error: string
  code?: string
  details?: any
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse

export function successResponse<T>(res: NextApiResponse, data: T, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data } as ApiSuccessResponse<T>)
}

export function errorResponse(
  res: NextApiResponse,
  message: string,
  statusCode = 500,
  code?: string,
  details?: any
) {
  return res.status(statusCode).json({
    success: false,
    error: message,
    ...(code && { code }),
    ...(details && { details }),
  } as ApiErrorResponse)
}

// ============================================
// API Error Class
// ============================================

export class AppError extends Error {
  public statusCode: number
  public code: string
  public details?: any

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: any) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }
}

// Common error factories
export const Errors = {
  notFound: (resource = 'Resource') =>
    new AppError(`${resource} not found`, 404, 'NOT_FOUND'),
  unauthorized: (message = 'Not authenticated') =>
    new AppError(message, 401, 'UNAUTHORIZED'),
  forbidden: (message = 'Not authorized') =>
    new AppError(message, 403, 'FORBIDDEN'),
  badRequest: (message: string, details?: any) =>
    new AppError(message, 400, 'BAD_REQUEST', details),
  conflict: (message: string) =>
    new AppError(message, 409, 'CONFLICT'),
  methodNotAllowed: (allowed: string[]) =>
    new AppError(`Method not allowed. Allowed: ${allowed.join(', ')}`, 405, 'METHOD_NOT_ALLOWED'),
  internal: (message = 'Internal server error') =>
    new AppError(message, 500, 'INTERNAL_ERROR'),
}

// ============================================
// API Route Handler Wrapper
// ============================================

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

type ApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void>

interface RouteHandlers {
  GET?: ApiHandler
  POST?: ApiHandler
  PUT?: ApiHandler
  PATCH?: ApiHandler
  DELETE?: ApiHandler
}

export function apiHandler(handlers: RouteHandlers): ApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const method = req.method as HttpMethod

    if (!handlers[method]) {
      const allowed = Object.keys(handlers)
      res.setHeader('Allow', allowed.join(', '))
      return errorResponse(res, `Method ${method} not allowed`, 405, 'METHOD_NOT_ALLOWED')
    }

    const startTime = Date.now()
    const endpoint = `${method} ${req.url}`

    try {
      await handlers[method]!(req, res)
      const duration = Date.now() - startTime
      console.log(`[API] ${endpoint} - ${res.statusCode} (${duration}ms)`)
    } catch (error: any) {
      const duration = Date.now() - startTime
      console.error(`[API ERROR] ${endpoint} (${duration}ms):`, error.message)

      if (error instanceof AppError) {
        return errorResponse(res, error.message, error.statusCode, error.code, error.details)
      }

      if (error.code === 'P2002') {
        return errorResponse(res, 'A record with this data already exists', 409, 'UNIQUE_VIOLATION')
      }
      if (error.code === 'P2025') {
        return errorResponse(res, 'Record not found', 404, 'NOT_FOUND')
      }

      return errorResponse(res, 'Internal server error', 500)
    }
  }
}
