import { NextRequest, NextResponse } from 'next/server'

export class ApiError extends Error {
  public statusCode: number
  public code: string
  public details?: unknown

  constructor(message: string, statusCode: number = 500, code?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code || 'INTERNAL_ERROR'
    this.details = details
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError)
    }
  }
}

export function logApiError(error: unknown, context: {
  endpoint: string
  method: string
  userId?: string
  requestId?: string
  body?: unknown
}) {
  const timestamp = new Date().toISOString()
  const { endpoint, method, userId, requestId, body } = context
  const err = error instanceof Error ? error : new Error(String(error))
  
  console.error(`\n=== API ERROR LOG ===`)
  console.error(`Timestamp: ${timestamp}`)
  console.error(`Endpoint: ${method} ${endpoint}`)
  console.error(`Request ID: ${requestId || 'N/A'}`)
  console.error(`User ID: ${userId || 'N/A'}`)
  
  if (error instanceof ApiError) {
    console.error(`Error Type: ApiError`)
    console.error(`Status Code: ${error.statusCode}`)
    console.error(`Error Code: ${error.code}`)
    console.error(`Message: ${error.message}`)
    if (error.details) {
      console.error(`Details:`, error.details)
    }
  } else {
    console.error(`Error Type: ${err.constructor.name}`)
    console.error(`Message: ${err.message}`)
  }
  
  if (body && typeof body === 'object' && Object.keys(body).length > 0) {
    console.error(`Request Body:`, JSON.stringify(body, null, 2))
  }
  
  console.error(`Stack Trace:\n${err.stack}`)
  console.error(`=== END ERROR LOG ===\n`)
}

export function createApiResponse(success: boolean, data?: unknown, error?: string, statusCode: number = 200) {
  const response: { success: boolean; data?: unknown; error?: string; statusCode?: number } = { success }
  
  if (success && data !== undefined) {
    response.data = data
  }
  
  if (!success && error) {
    response.error = error
    response.statusCode = statusCode
  }
  
  return response
}

export function handleApiRoute(handler: (req: Request, context?: unknown) => Promise<unknown>) {
  return async (req: Request, context?: unknown) => {
    const startTime = Date.now()
    const requestId = req.headers.get('x-request-id') || 'unknown'
    const url = new URL(req.url)
    const endpoint = `${req.method} ${url.pathname}`
    
    try {
      // Log request start
      console.log(`[${new Date().toISOString()}] Processing: ${endpoint} (Request ID: ${requestId})`)
      
      // Execute handler
      const result = await handler(req, context)
      
      // Log success
      const duration = Date.now() - startTime
      console.log(`[${new Date().toISOString()}] Success: ${endpoint} (${duration}ms)`)
      
      return result
    } catch (error: unknown) {
      const duration = Date.now() - startTime
      const err = error instanceof Error ? error : new Error(String(error))
      
      // Log error with full context
      logApiError(error, {
        endpoint,
        method: req.method,
        requestId,
        body: req.method !== 'GET' ? await safeCloneJson(req) : undefined
      })
      
      // Return appropriate error response
      if (error instanceof ApiError) {
        return NextResponse.json(
          createApiResponse(false, undefined, error.message, error.statusCode),
          { status: error.statusCode }
        )
      }
      
      // Handle Prisma errors
      if (err.name === 'PrismaClientKnownRequestError') {
        return NextResponse.json(
          createApiResponse(false, undefined, 'Database operation failed', 500),
          { status: 500 }
        )
      }
      
      // Handle validation errors
      if (err.name === 'ZodError') {
        return NextResponse.json(
          createApiResponse(false, undefined, 'Invalid input data', 400),
          { status: 400 }
        )
      }
      
      // Default error response
      return NextResponse.json(
        createApiResponse(false, undefined, 'Internal server error', 500),
        { status: 500 }
      )
    }
  }
}

async function safeCloneJson(req: Request): Promise<unknown> {
  try {
    const clone = req.clone()
    return await clone.json()
  } catch {
    return null
  }
}
