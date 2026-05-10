import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Box, Typography, Button, Alert, CircularProgress } from '@mui/material'
import { NextRouter, useRouter } from 'next/router'
import { isSessionExpiredError, redirectToLogin } from '@/lib/session-handler'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  router: NextRouter | null
}

interface State {
  hasError: boolean
  error: Error | null
  isRedirecting: boolean
}

export class ErrorBoundaryInner extends Component<Props, State> {
  private redirectTimeoutRef: NodeJS.Timeout | null = null

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      isRedirecting: false
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      isRedirecting: false
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SessionErrorBoundary caught an error:', error, errorInfo)
    
    // Check if this is a session expiration error
    if (isSessionExpiredError(error)) {
      this.setState({ isRedirecting: true })
      redirectToLogin()
    }
  }

  componentWillUnmount() {
    if (this.redirectTimeoutRef) {
      clearTimeout(this.redirectTimeoutRef)
    }
  }

  handleRetry = () => {
    // Reset error state
    this.setState({
      hasError: false,
      error: null,
      isRedirecting: false
    })

    // Reload the page
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback
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
                onClick={() => this.props.router?.push('/login')}
                disabled={this.state.isRedirecting || !this.props.router}
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
                  onClick={this.handleRetry}
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

interface SessionErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

export default function SessionErrorBoundaryWrapper({ children, fallback }: SessionErrorBoundaryProps) {
  let router: NextRouter | null = null
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter()
  } catch (e) {
    // During prerendering or if not in router context, useRouter might throw
    console.warn('SessionErrorBoundaryWrapper: Router not available')
  }

  return (
    <ErrorBoundaryInner router={router} fallback={fallback}>
      {children}
    </ErrorBoundaryInner>
  )
}
