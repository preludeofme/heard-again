import { useState, useCallback } from 'react'
import { ApiError } from '@/lib/errors'

export interface FamilyspaceMember {
  id: string
  userId: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  role: string
  joinedAt: string
  lastLoginAt: string | null
}

export interface FamilyspaceInvite {
  id: string
  email: string
  role: string
  token: string
  expiresAt: string
  status: string
  invitedBy: {
    id: string
    displayName: string | null
    email: string
  }
  createdAt: string
}

interface MembershipControllerState {
  members: FamilyspaceMember[]
  invites: FamilyspaceInvite[]
  isLoadingMembers: boolean
  isLoadingInvites: boolean
  hasError: boolean
  errorMessage: string | null
  isInviting: boolean
  isUpdatingMember: boolean
  isRemovingMember: boolean
}

interface MembershipControllerActions {
  fetchMembers: (familyspaceId: string) => Promise<void>
  fetchInvites: (familyspaceId: string) => Promise<void>
  inviteMember: (familyspaceId: string, email: string, role: string) => Promise<boolean>
  updateMemberRole: (familyspaceId: string, userId: string, role: string) => Promise<boolean>
  removeMember: (familyspaceId: string, userId: string) => Promise<boolean>
  cancelInvite: (familyspaceId: string, inviteId: string) => Promise<boolean>
  acceptInvite: (token: string) => Promise<boolean>
  declineInvite: (token: string) => Promise<boolean>
}

export function useMembershipController(): MembershipControllerState & MembershipControllerActions {
  const [state, setState] = useState<MembershipControllerState>({
    members: [],
    invites: [],
    isLoadingMembers: false,
    isLoadingInvites: false,
    hasError: false,
    errorMessage: null,
    isInviting: false,
    isUpdatingMember: false,
    isRemovingMember: false,
  })

  const fetchMembers = useCallback(async (familyspaceId: string) => {
    setState(prev => ({ ...prev, isLoadingMembers: true, hasError: false, errorMessage: null }))

    try {
      const response = await fetch(`/api/familyspaces/${familyspaceId}/members`, { credentials: 'include' })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load members')
      }

      setState(prev => ({
        ...prev,
        members: data.data || [],
        isLoadingMembers: false,
      }))
    } catch (error) {
      const apiError = ApiError.fromError(error)
      setState(prev => ({
        ...prev,
        isLoadingMembers: false,
        hasError: true,
        errorMessage: apiError.message,
      }))
    }
  }, [])

  const fetchInvites = useCallback(async (familyspaceId: string) => {
    setState(prev => ({ ...prev, isLoadingInvites: true, hasError: false, errorMessage: null }))

    try {
      const response = await fetch(`/api/familyspaces/${familyspaceId}/invite`, { credentials: 'include' })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load invites')
      }

      setState(prev => ({
        ...prev,
        invites: data.data || [],
        isLoadingInvites: false,
      }))
    } catch (error) {
      const apiError = ApiError.fromError(error)
      setState(prev => ({
        ...prev,
        isLoadingInvites: false,
        hasError: true,
        errorMessage: apiError.message,
      }))
    }
  }, [])

  const inviteMember = useCallback(async (familyspaceId: string, email: string, role: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isInviting: true, hasError: false, errorMessage: null }))

    try {
      const response = await fetch(`/api/familyspaces/${familyspaceId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, role }),
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send invite')
      }

      setState(prev => ({
        ...prev,
        invites: [data.data, ...prev.invites],
        isInviting: false,
      }))

      return true
    } catch (error) {
      const apiError = ApiError.fromError(error)
      setState(prev => ({
        ...prev,
        isInviting: false,
        hasError: true,
        errorMessage: apiError.message,
      }))
      return false
    }
  }, [])

  const updateMemberRole = useCallback(async (familyspaceId: string, userId: string, role: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isUpdatingMember: true, hasError: false, errorMessage: null }))

    try {
      const response = await fetch(`/api/familyspaces/${familyspaceId}/members/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role }),
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update member role')
      }

      setState(prev => ({
        ...prev,
        members: prev.members.map(m =>
          m.userId === userId ? { ...m, role } : m
        ),
        isUpdatingMember: false,
      }))

      return true
    } catch (error) {
      const apiError = ApiError.fromError(error)
      setState(prev => ({
        ...prev,
        isUpdatingMember: false,
        hasError: true,
        errorMessage: apiError.message,
      }))
      return false
    }
  }, [])

  const removeMember = useCallback(async (familyspaceId: string, userId: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isRemovingMember: true, hasError: false, errorMessage: null }))

    try {
      const response = await fetch(`/api/familyspaces/${familyspaceId}/members/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to remove member')
      }

      setState(prev => ({
        ...prev,
        members: prev.members.filter(m => m.userId !== userId),
        isRemovingMember: false,
      }))

      return true
    } catch (error) {
      const apiError = ApiError.fromError(error)
      setState(prev => ({
        ...prev,
        isRemovingMember: false,
        hasError: true,
        errorMessage: apiError.message,
      }))
      return false
    }
  }, [])

  const cancelInvite = useCallback(async (familyspaceId: string, inviteId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/familyspaces/${familyspaceId}/invite`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ inviteId }),
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to cancel invite')
      }

      setState(prev => ({
        ...prev,
        invites: prev.invites.filter(i => i.id !== inviteId),
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

  const acceptInvite = useCallback(async (token: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/invites/${token}/accept`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to accept invite')
      }

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

  const declineInvite = useCallback(async (token: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/invites/${token}/decline`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to decline invite')
      }

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

  return {
    ...state,
    fetchMembers,
    fetchInvites,
    inviteMember,
    updateMemberRole,
    removeMember,
    cancelInvite,
    acceptInvite,
    declineInvite,
  }
}
