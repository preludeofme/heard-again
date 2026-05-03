import { useState, useCallback, useEffect } from 'react'
import { ApiError } from '@/lib/errors'
import { fetchWithCSRF } from '@/lib/api-client'

export interface Familyspace {
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

export interface FamilyspaceDetail extends Familyspace {
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

interface FamilyspaceControllerState {
  familyspaces: Familyspace[]
  currentFamilyspace: FamilyspaceDetail | null
  isLoading: boolean
  hasError: boolean
  errorMessage: string | null
  isCreating: boolean
  isUpdating: boolean
  isDeleting: boolean
}

interface FamilyspaceControllerActions {
  fetchFamilyspaces: () => Promise<void>
  fetchFamilyspaceDetails: (id: string) => Promise<void>
  createFamilyspace: (name: string) => Promise<Familyspace | null>
  updateFamilyspace: (id: string, data: { name?: string }) => Promise<boolean>
  deleteFamilyspace: (id: string) => Promise<boolean>
  switchFamilyspace: (id: string) => Promise<boolean>
  setDefaultFamilyspace: (id: string) => void
}

export function useFamilyspaceController(): FamilyspaceControllerState & FamilyspaceControllerActions {
  const [state, setState] = useState<FamilyspaceControllerState>({
    familyspaces: [],
    currentFamilyspace: null,
    isLoading: false,
    hasError: false,
    errorMessage: null,
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
  })

  const fetchFamilyspaces = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, hasError: false, errorMessage: null }))

    try {
      const response = await fetch('/api/familyspaces', { credentials: 'include' })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load familyspaces')
      }

      setState(prev => ({
        ...prev,
        familyspaces: data.data || [],
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

  const fetchFamilyspaceDetails = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, isLoading: true, hasError: false, errorMessage: null }))

    try {
      const response = await fetch(`/api/familyspaces/${id}`, { credentials: 'include' })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load familyspace details')
      }

      setState(prev => ({
        ...prev,
        currentFamilyspace: data.data,
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

  const createFamilyspace = useCallback(async (name: string): Promise<Familyspace | null> => {
    setState(prev => ({ ...prev, isCreating: true, hasError: false, errorMessage: null }))

    try {
      const response = await fetchWithCSRF('/api/familyspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create familyspace')
      }

      const newFamilyspace = data.data as Familyspace

      setState(prev => ({
        ...prev,
        familyspaces: [...prev.familyspaces, newFamilyspace],
        isCreating: false,
      }))

      return newFamilyspace
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

  const updateFamilyspace = useCallback(async (id: string, data: { name?: string }): Promise<boolean> => {
    setState(prev => ({ ...prev, isUpdating: true, hasError: false, errorMessage: null }))

    try {
      const response = await fetchWithCSRF(`/api/familyspaces/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update familyspace')
      }

      setState(prev => ({
        ...prev,
        familyspaces: prev.familyspaces.map(w =>
          w.id === id ? { ...w, ...result.data } : w
        ),
        currentFamilyspace: prev.currentFamilyspace?.id === id
          ? { ...prev.currentFamilyspace, ...result.data }
          : prev.currentFamilyspace,
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

  const deleteFamilyspace = useCallback(async (id: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isDeleting: true, hasError: false, errorMessage: null }))

    try {
      const response = await fetchWithCSRF(`/api/familyspaces/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete familyspace')
      }

      setState(prev => ({
        ...prev,
        familyspaces: prev.familyspaces.filter(w => w.id !== id),
        currentFamilyspace: prev.currentFamilyspace?.id === id ? null : prev.currentFamilyspace,
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

  const switchFamilyspace = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetchWithCSRF(`/api/familyspaces/${id}/switch`, {
        method: 'POST',
        credentials: 'include',
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to switch familyspace')
      }

      setState(prev => ({
        ...prev,
        familyspaces: prev.familyspaces.map(w => ({
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

  const setDefaultFamilyspace = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      familyspaces: prev.familyspaces.map(w => ({
        ...w,
        isDefault: w.id === id,
      })),
    }))
  }, [])

  return {
    ...state,
    fetchFamilyspaces,
    fetchFamilyspaceDetails,
    createFamilyspace,
    updateFamilyspace,
    deleteFamilyspace,
    switchFamilyspace,
    setDefaultFamilyspace,
  }
}
