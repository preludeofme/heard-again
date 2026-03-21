import { NextRequest, NextResponse } from 'next/server'

export class ApiError extends Error {
  public statusCode: number
  public code: string
  public details?: any

  constructor(message: string, statusCode: number = 500, code?: string, details?: any) {
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

export function logApiError(error: any, context: {
  endpoint: string
  method: string
  userId?: string
  requestId?: string
  body?: any
}) {
  const timestamp = new Date().toISOString()
  const { endpoint, method, userId, requestId, body } = context
  
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
    console.error(`Error Type: ${error.constructor.name}`)
    console.error(`Message: ${error.message}`)
  }
  
  if (body && Object.keys(body).length > 0) {
    console.error(`Request Body:`, JSON.stringify(body, null, 2))
  }
  
  console.error(`Stack Trace:\n${error.stack}`)
  console.error(`=== END ERROR LOG ===\n`)
}

export function createApiResponse(success: boolean, data?: any, error?: string, statusCode: number = 200) {
  const response: any = { success }
  
  if (success && data !== undefined) {
    response.data = data
  }
  
  if (!success && error) {
    response.error = error
    response.statusCode = statusCode
  }
  
  return response
}

export function handleApiRoute(handler: (req: Request, context?: any) => Promise<any>) {
  return async (req: Request, context?: any) => {
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
    } catch (error: any) {
      const duration = Date.now() - startTime
      
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
      if (error.name === 'PrismaClientKnownRequestError') {
        return NextResponse.json(
          createApiResponse(false, undefined, 'Database operation failed', 500),
          { status: 500 }
        )
      }
      
      // Handle validation errors
      if (error.name === 'ZodError') {
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

async function safeCloneJson(req: Request): Promise<any> {
  try {
    const clone = req.clone()
    return await clone.json()
  } catch {
    return null
  }
}
