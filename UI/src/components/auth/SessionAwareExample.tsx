
import { useState } from 'react'
import { Box, Button, Typography, Alert } from '@mui/material'
import { useApiWithSession } from '@/hooks/useApiWithSession'
import { fetchWithCSRF } from '@/lib/api-client'

/**
 * Example component showing how to use session-aware API calls
 */
export function SessionAwareExample() {
  const [message, setMessage] = useState('')
  
  // Use the session-aware hook
  const { execute, loading, error } = useApiWithSession({
    onSuccess: (data) => {
      setMessage('Operation completed successfully!')
      console.log('Success:', data)
    },
    onError: (err) => {
      if (err.message.includes('Authentication required')) {
        // Session expiration is handled automatically
        setMessage('')
      } else {
        setMessage(`Error: ${err.message}`)
      }
    }
  })

  const handleSaveSomething = async () => {
    await execute(async () => {
      const response = await fetchWithCSRF('/api/some-endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'example' })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Request failed')
      }
      
      return response.json()
    })
  }

  return (
    <Box p={3}>
      <Typography variant="h6" gutterBottom>
        Session-Aware API Example
      </Typography>
      
      {message && (
        <Alert severity={error ? 'error' : 'success'} sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}
      
      <Button
        variant="contained"
        onClick={handleSaveSomething}
        disabled={loading}
      >
        {loading ? 'Saving...' : 'Save Something'}
      </Button>
      
      {error && !error.message.includes('Authentication required') && (
        <Typography color="error" sx={{ mt: 1 }}>
          {error.message}
        </Typography>
      )}
    </Box>
  )
}
