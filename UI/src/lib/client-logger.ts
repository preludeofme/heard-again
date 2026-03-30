// Client-side error logging utility
export class ClientLogger {
  private static instance: ClientLogger
  private logEndpoint = '/api/logs/client'
  
  static getInstance(): ClientLogger {
    if (!ClientLogger.instance) {
      ClientLogger.instance = new ClientLogger()
    }
    return ClientLogger.instance
  }
  
  // Log errors to server
  async logError(error: Error | string, context?: any) {
    // Only run on client side
    if (typeof window === 'undefined') return
    
    const errorData = {
      timestamp: new Date().toISOString(),
      type: 'error',
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'string' ? null : error.stack,
      context: context || {},
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getUserId(),
    }
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Client Error:', errorData)
    }
    
    // Send to server
    try {
      await fetch(this.logEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(errorData),
      })
    } catch (e) {
      console.error('Failed to log error to server:', e)
    }
  }
  
  // Log API errors
  async logApiError(endpoint: string, error: any, request?: any) {
    // Only run on client side
    if (typeof window === 'undefined') return
    
    const errorData = {
      timestamp: new Date().toISOString(),
      type: 'api_error',
      endpoint,
      status: error.status,
      message: error.message || 'Unknown API error',
      response: error.error || error,
      request: request ? {
        method: request.method,
        url: request.url,
        headers: this.sanitizeHeaders(request.headers),
      } : null,
      userAgent: navigator.userAgent,
      userId: this.getUserId(),
    }
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', errorData)
    }
    
    // Send to server
    try {
      await fetch(this.logEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(errorData),
      })
    } catch (e) {
      console.error('Failed to log API error to server:', e)
    }
  }
  
  // Log performance issues
  async logPerformance(metric: string, value: number, context?: any) {
    // Only run on client side
    if (typeof window === 'undefined') return
    
    const perfData = {
      timestamp: new Date().toISOString(),
      type: 'performance',
      metric,
      value,
      context: context || {},
      userAgent: navigator.userAgent,
      userId: this.getUserId(),
    }
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('Performance Issue:', perfData)
    }
    
    // Send to server
    try {
      await fetch(this.logEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(perfData),
      })
    } catch (e) {
      console.error('Failed to log performance to server:', e)
    }
  }
  
  private getUserId(): string | null {
    // Only run on client side
    if (typeof window === 'undefined') return null
    
    // Try to get user ID from localStorage or context
    return localStorage.getItem('userId') || null
  }
  
  private sanitizeHeaders(headers: HeadersInit): any {
    const sanitized: any = {}
    Object.entries(headers).forEach(([key, value]) => {
      // Don't log sensitive headers
      if (!['authorization', 'cookie'].includes(key.toLowerCase())) {
        sanitized[key] = value
      }
    })
    return sanitized
  }
}

// Global error handlers - only on client side
if (typeof window !== 'undefined') {
  // Global error handler
  window.addEventListener('error', (event) => {
    ClientLogger.getInstance().logError(event.error, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    })
  })

  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    ClientLogger.getInstance().logError(event.reason, {
      type: 'unhandled_promise_rejection',
    })
  })
}

// Export singleton instance
export const logger = ClientLogger.getInstance()
