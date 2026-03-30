import React, { Component, ErrorInfo, ReactNode, useState, useEffect, useRef } from 'react'
import { Box, Typography, Button, Alert, CircularProgress } from '@mui/material'
import { useRouter } from 'next/router'
import { handleApiError, isSessionExpiredError, redirectToLogin } from '@/lib/session-handler'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  isRedirecting: boolean
}

// Functional component wrapper for the error boundary
function SessionErrorBoundaryWrapper({ children, fallback }: Props) {
  const router = useRouter()
  const [state, setState] = useState<State>({
    hasError: false,
    error: null,
    isRedirecting: false
  })
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Reset redirect flag when component mounts
  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current)
      }
    }
  }, [])

  const handleError = (error: Error, errorInfo: ErrorInfo) => {
    console.error('SessionErrorBoundary caught an error:', error, errorInfo)
    
    // Check if this is a session expiration error
    if (isSessionExpiredError(error)) {
      setState(prev => ({ ...prev, isRedirecting: true }))
      redirectToLogin()
    } else {
      setState({ hasError: true, error, isRedirecting: false })
    }
  }

  const handleRetry = () => {
    // Clear any pending redirect
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current)
      redirectTimeoutRef.current = null
    }

    // Reset error state
    setState({
      hasError: false,
      error: null,
      isRedirecting: false
    })

    // Reload the page
    window.location.reload()
  }

  // Custom error boundary implementation
  class ErrorBoundaryInner extends Component<{ children: ReactNode }, State> {
    constructor(props: { children: ReactNode }) {
      super(props)
      this.state = {
        hasError: false,
        error: null,
        isRedirecting: false
      }
    }

    static getDerivedStateFromError(error: Error): State {
      return {
        hasError: true,
        error,
        isRedirecting: false
      }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
      handleError(error, errorInfo)
    }

    render() {
      if (this.state.hasError) {
        // If a custom fallback is provided, use it
        if (fallback) {
          return fallback
        }

        // Default error UI
        if (this.state.isRedirecting) {
          return (
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              minHeight="100vh"
              p={3}
            >
              <CircularProgress size={40} sx={{ mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Session Expired
              </Typography>
              <Typography variant="body2" color="text.secondary" align="center">
                Redirecting to login page...
              </Typography>
            </Box>
          )
        }

        // Check if it's a session error
        const isSessionError = this.state.error && isSessionExpiredError(this.state.error)

        return (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            minHeight="100vh"
            p={3}
          >
            <Alert 
              severity={isSessionError ? "warning" : "error"} 
              sx={{ mb: 3, maxWidth: 500 }}
            >
              {isSessionError ? (
                <>
                  <Typography variant="h6" gutterBottom>
                    Session Expired
                  </Typography>
                  <Typography variant="body2">
                    Your session has expired. You will be redirected to the login page.
                  </Typography>
                </>
              ) : (
                <>
                  <Typography variant="h6" gutterBottom>
                    Something went wrong
                  </Typography>
                  <Typography variant="body2">
                    {this.state.error?.message || 'An unexpected error occurred'}
                  </Typography>
                </>
              )}
            </Alert>
            
            <Box display="flex" gap={2}>
              {isSessionError ? (
                <Button
                  variant="contained"
                  onClick={() => router.push('/login')}
                  disabled={this.state.isRedirecting}
                >
                  Go to Login
                </Button>
              ) : (
                <>
                  <Button
                    variant="outlined"
                    onClick={() => window.history.back()}
                  >
                    Go Back
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleRetry}
                  >
                    Try Again
                  </Button>
                </>
              )}
            </Box>
          </Box>
        )
      }

      return this.props.children
    }
  }

  return (
    <ErrorBoundaryInner>
      {children}
    </ErrorBoundaryInner>
  )
}

export default SessionErrorBoundaryWrapper
