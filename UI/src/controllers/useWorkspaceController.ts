import { useState, useCallback, useEffect } from 'react'
import { ApiError } from '@/lib/errors'

export interface Workspace {
  id: string
  name: string
  slug: string
  planType: string
  deploymentMode: string
  role: string
  isDefault: boolean
  counts?: {
    members: number
    people: number
    stories: number
    voiceProfiles: number
  }
  createdAt: string
}

export interface WorkspaceDetail extends Workspace {
  owner: {
    id: string
    email: string
    displayName: string | null
    avatarUrl: string | null
  }
  subscription: {
    planName: string
    billingStatus: string
    renewalDate: string | null
  } | null
  tunnelEnabled: boolean
  cloudGpuEnabled: boolean
}

interface WorkspaceControllerState {
  workspaces: Workspace[]
  currentWorkspace: WorkspaceDetail | null
  isLoading: boolean
  hasError: boolean
  errorMessage: string | null
  isCreating: boolean
  isUpdating: boolean
  isDeleting: boolean
}

interface WorkspaceControllerActions {
  fetchWorkspaces: () => Promise<void>
  fetchWorkspaceDetails: (id: string) => Promise<void>
  createWorkspace: (name: string) => Promise<Workspace | null>
  updateWorkspace: (id: string, data: { name?: string }) => Promise<boolean>
  deleteWorkspace: (id: string) => Promise<boolean>
  switchWorkspace: (id: string) => Promise<boolean>
  setDefaultWorkspace: (id: string) => void
}

export function useWorkspaceController(): WorkspaceControllerState & WorkspaceControllerActions {
  const [state, setState] = useState<WorkspaceControllerState>({
    workspaces: [],
    currentWorkspace: null,
    isLoading: false,
    hasError: false,
    errorMessage: null,
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
  })

  const fetchWorkspaces = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, hasError: false, errorMessage: null }))

    try {
      const response = await fetch('/api/workspaces', { credentials: 'include' })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load workspaces')
      }

      setState(prev => ({
        ...prev,
        workspaces: data.data || [],
        isLoading: false,
      }))
    } catch (error) {
      const apiError = ApiError.fromError(error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true,
        errorMessage: apiError.message,
      }))
    }
  }, [])

  const fetchWorkspaceDetails = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, isLoading: true, hasError: false, errorMessage: null }))

    try {
      const response = await fetch(`/api/workspaces/${id}`, { credentials: 'include' })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load workspace details')
      }

      setState(prev => ({
        ...prev,
        currentWorkspace: data.data,
        isLoading: false,
      }))
    } catch (error) {
      const apiError = ApiError.fromError(error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true,
        errorMessage: apiError.message,
      }))
    }
  }, [])

  const createWorkspace = useCallback(async (name: string): Promise<Workspace | null> => {
    setState(prev => ({ ...prev, isCreating: true, hasError: false, errorMessage: null }))

    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create workspace')
      }

      const newWorkspace = data.data as Workspace

      setState(prev => ({
        ...prev,
        workspaces: [...prev.workspaces, newWorkspace],
        isCreating: false,
      }))

      return newWorkspace
    } catch (error) {
      const apiError = ApiError.fromError(error)
      setState(prev => ({
        ...prev,
        isCreating: false,
        hasError: true,
        errorMessage: apiError.message,
      }))
      return null
    }
  }, [])

  const updateWorkspace = useCallback(async (id: string, data: { name?: string }): Promise<boolean> => {
    setState(prev => ({ ...prev, isUpdating: true, hasError: false, errorMessage: null }))

    try {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update workspace')
      }

      setState(prev => ({
        ...prev,
        workspaces: prev.workspaces.map(w =>
          w.id === id ? { ...w, ...result.data } : w
        ),
        currentWorkspace: prev.currentWorkspace?.id === id
          ? { ...prev.currentWorkspace, ...result.data }
          : prev.currentWorkspace,
        isUpdating: false,
      }))

      return true
    } catch (error) {
      const apiError = ApiError.fromError(error)
      setState(prev => ({
        ...prev,
        isUpdating: false,
        hasError: true,
        errorMessage: apiError.message,
      }))
      return false
    }
  }, [])

  const deleteWorkspace = useCallback(async (id: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isDeleting: true, hasError: false, errorMessage: null }))

    try {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete workspace')
      }

      setState(prev => ({
        ...prev,
        workspaces: prev.workspaces.filter(w => w.id !== id),
        currentWorkspace: prev.currentWorkspace?.id === id ? null : prev.currentWorkspace,
        isDeleting: false,
      }))

      return true
    } catch (error) {
      const apiError = ApiError.fromError(error)
      setState(prev => ({
        ...prev,
        isDeleting: false,
        hasError: true,
        errorMessage: apiError.message,
      }))
      return false
    }
  }, [])

  const switchWorkspace = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/workspaces/${id}/switch`, {
        method: 'POST',
        credentials: 'include',
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to switch workspace')
      }

      setState(prev => ({
        ...prev,
        workspaces: prev.workspaces.map(w => ({
          ...w,
          isDefault: w.id === id,
        })),
      }))

      return true
    } catch (error) {
      const apiError = ApiError.fromError(error)
      setState(prev => ({
        ...prev,
        hasError: true,
        errorMessage: apiError.message,
      }))
      return false
    }
  }, [])

  const setDefaultWorkspace = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      workspaces: prev.workspaces.map(w => ({
        ...w,
        isDefault: w.id === id,
      })),
    }))
  }, [])

  return {
    ...state,
    fetchWorkspaces,
    fetchWorkspaceDetails,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    switchWorkspace,
    setDefaultWorkspace,
  }
}
