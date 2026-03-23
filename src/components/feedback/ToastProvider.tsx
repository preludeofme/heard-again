import React, { createContext, useContext, useState, useCallback } from 'react'
import { Alert, AlertTitle, Snackbar, IconButton } from '@mui/material'
import { Close as CloseIcon } from '@mui/icons-material'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  title?: string
  message: string
  duration?: number
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, title?: string, duration?: number) => void
  showSuccess: (message: string, title?: string) => void
  showError: (message: string, title?: string) => void
  showWarning: (message: string, title?: string) => void
  showInfo: (message: string, title?: string) => void
  clearToast: (id: string) => void
  clearAllToasts: () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: React.ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((type: ToastType, message: string, title?: string, duration = 6000) => {
    const id = Date.now().toString()
    const newToast: Toast = { id, type, title, message, duration }
    
    setToasts(prev => [...prev, newToast])
    
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, duration)
    }
  }, [])

  const showSuccess = useCallback((message: string, title?: string) => {
    showToast('success', message, title)
  }, [showToast])

  const showError = useCallback((message: string, title?: string) => {
    showToast('error', message, title, 8000) // Errors stay longer
  }, [showToast])

  const showWarning = useCallback((message: string, title?: string) => {
    showToast('warning', message, title)
  }, [showToast])

  const showInfo = useCallback((message: string, title?: string) => {
    showToast('info', message, title)
  }, [showToast])

  const clearToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const clearAllToasts = useCallback(() => {
    setToasts([])
  }, [])

  const value: ToastContextValue = {
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    clearToast,
    clearAllToasts,
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.map((toast, index) => (
        <Snackbar
          key={toast.id}
          open={true}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          sx={{ mt: index * 8 }}
        >
          <Alert
            severity={toast.type}
            variant="filled"
            action={
              <IconButton
                size="small"
                onClick={() => clearToast(toast.id)}
                sx={{ color: 'inherit' }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
            sx={{ 
              minWidth: 300,
              '& .MuiAlert-message': {
                wordBreak: 'break-word',
              }
            }}
          >
            {toast.title && <AlertTitle>{toast.title}</AlertTitle>}
            {toast.message}
          </Alert>
        </Snackbar>
      ))}
    </ToastContext.Provider>
  )
}
