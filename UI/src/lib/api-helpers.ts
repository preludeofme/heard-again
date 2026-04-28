import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { validateCSRFToken } from '@/lib/security/csrf'
import { z } from 'zod'

// ============================================
// Secure Response Transformers
// ============================================

type AssetRecord = Record<string, unknown> & { storagePath?: string }
type StoryAssetRecord = Record<string, unknown> & { asset?: AssetRecord }
type StoryRecord = Record<string, unknown> & {
  generatedAudio?: AssetRecord | null
  assets?: StoryAssetRecord[]
}
type DocumentRecord = Record<string, unknown> & { asset?: AssetRecord }

/**
 * Remove storagePath from asset objects to prevent information disclosure
 */
export function sanitizeAssetResponse(asset: AssetRecord | null | undefined): Omit<AssetRecord, 'storagePath'> | null | undefined {
  if (!asset) return asset

  const { storagePath: _storagePath, ...sanitized } = asset
  return sanitized
}

/**
 * Remove storagePath from arrays of assets
 */
export function sanitizeAssetsResponse(assets: AssetRecord[]): Omit<AssetRecord, 'storagePath'>[] {
  if (!Array.isArray(assets)) return assets

  return assets.map(asset => sanitizeAssetResponse(asset) ?? asset)
}

/**
 * Remove storagePath from story responses (including nested assets)
 */
export function sanitizeStoryResponse(story: StoryRecord | null | undefined): StoryRecord | null | undefined {
  if (!story) return story

  const sanitized: StoryRecord = { ...story }

  // Remove storagePath from generatedAudioAsset if present
  if (sanitized.generatedAudio) {
    sanitized.generatedAudio = sanitizeAssetResponse(sanitized.generatedAudio) ?? {}
  }

  // Remove storagePath from nested assets
  if (sanitized.assets && Array.isArray(sanitized.assets)) {
    sanitized.assets = sanitized.assets.map((storyAsset: StoryAssetRecord) => ({
      ...storyAsset,
      asset: sanitizeAssetResponse(storyAsset.asset) ?? {}
    }))
  }

  return sanitized
}

/**
 * Remove storagePath from document responses (including nested assets)
 */
export function sanitizeDocumentResponse(document: DocumentRecord | null | undefined): DocumentRecord | null | undefined {
  if (!document) return document

  const sanitized: DocumentRecord = { ...document }

  // Remove storagePath from asset if present
  if (sanitized.asset) {
    sanitized.asset = sanitizeAssetResponse(sanitized.asset) ?? {}
  }

  return sanitized
}

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
  details?: unknown
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
  details?: unknown
) {
  const response: ApiErrorResponse = {
    success: false,
    error: message,
  }
  if (code) response.code = code
  if (details !== undefined) response.details = details
  return res.status(statusCode).json(response)
}

function formatZodError(error: z.ZodError): Record<string, string> {
  const formatted: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    formatted[path || 'root'] = issue.message
  }
  return formatted
}

// ============================================
// API Error Class
// ============================================

export class AppError extends Error {
  public statusCode: number
  public code: string
  public details?: unknown

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
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
  badRequest: (message: string, details?: unknown) =>
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

interface MethodHandler {
  handler: ApiHandler
  schema?: z.ZodSchema<any>
}

interface RouteHandlers {
  GET?: ApiHandler | MethodHandler
  POST?: ApiHandler | MethodHandler
  PUT?: ApiHandler | MethodHandler
  PATCH?: ApiHandler | MethodHandler
  DELETE?: ApiHandler | MethodHandler
}

export interface ApiHandlerOptions {
  /**
   * Enforce CSRF on non-safe methods (POST/PUT/PATCH/DELETE). Default `true`.
   *
   * Set to `false` only for routes that genuinely cannot have a CSRF token:
   *   - pre-authentication routes (signup, forgot-password, reset-password)
   *   - external webhooks (Stripe etc.)
   *   - token-bearer endpoints invoked outside a session (email invite accept)
   *
   * Authenticated state-changing routes must leave this on.
   */
  csrf?: boolean
}

export function apiHandler(handlers: RouteHandlers, options: ApiHandlerOptions = {}): ApiHandler {
  const csrfEnabled = options.csrf !== false

  return async (req: NextApiRequest, res: NextApiResponse) => {
    const method = req.method as HttpMethod
    const methodConfig = handlers[method]

    if (!methodConfig) {
      const allowed = Object.keys(handlers)
      res.setHeader('Allow', allowed.join(', '))
      return errorResponse(res, `Method ${method} not allowed`, 405, 'METHOD_NOT_ALLOWED')
    }

    const startTime = Date.now()
    const endpoint = `${method} ${req.url}`

    const actualHandler = typeof methodConfig === 'function' ? methodConfig : methodConfig.handler
    const schema = typeof methodConfig === 'object' ? methodConfig.schema : undefined

    try {
      if (csrfEnabled) {
        const csrfOk = await validateCSRFToken(req, res)
        if (!csrfOk) {
          // validateCSRFToken already wrote the error response
          const duration = Date.now() - startTime
          logger.warn(`[API] ${endpoint} - ${res.statusCode} CSRF rejected (${duration}ms)`)
          return
        }
      }

      // Validate body against schema if provided
      if (schema && ['POST', 'PUT', 'PATCH'].includes(method)) {
        const result = schema.safeParse(req.body)
        if (!result.success) {
          throw Errors.badRequest('Validation failed', formatZodError(result.error))
        }
        // Replace req.body with parsed/transformed data
        req.body = result.data
      }

      await actualHandler(req, res)
      const duration = Date.now() - startTime
      logger.info(`[API] ${endpoint} - ${res.statusCode} (${duration}ms)`)
    } catch (error: unknown) {
      const duration = Date.now() - startTime
      const err = error instanceof Error ? error : new Error(String(error))
      
      // Log extra details if it's an AppError (like validation failures)
      if (error instanceof AppError && error.details) {
        logger.error(`[API ERROR] ${endpoint} (${duration}ms): ${err.message}`, { details: error.details })
      } else {
        logger.error(`[API ERROR] ${endpoint} (${duration}ms):`, err.message)
      }

      if (error instanceof AppError) {
        return errorResponse(res, error.message, error.statusCode, error.code, error.details)
      }

      if (err && 'code' in err && err.code === 'P2002') {
        return errorResponse(res, 'A record with this data already exists', 409, 'UNIQUE_VIOLATION')
      }
      if (err && 'code' in err && err.code === 'P2025') {
        return errorResponse(res, 'Record not found', 404, 'NOT_FOUND')
      }

      return errorResponse(res, 'Internal server error', 500)
    }
  }
}
