'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { ReactNode, useEffect } from 'react'
import { Box, CircularProgress } from '@mui/material'

interface AuthGuardProps {
  children: ReactNode
  fallback?: ReactNode
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    // Wait until session status is determined
    if (status === 'loading') return

    // Redirect to login if not authenticated
    if (status === 'unauthenticated') {
      const currentPath = router.asPath
      router.push(`/login?callbackUrl=${encodeURIComponent(currentPath)}`)
    }
  }, [status, router])

  // Show loading state while checking authentication
  if (status === 'loading') {
    if (fallback) return <>{fallback}</>
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    )
  }

  // Don't render children while redirecting
  if (status === 'unauthenticated') {
    return null
  }

  // User is authenticated, render children
  return <>{children}</>
}
