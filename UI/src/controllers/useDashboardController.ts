import { useState, useCallback, useEffect } from 'react'
import { ApiError } from '@/lib/errors'

export type FamilyspaceRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' | 'LEGACY'

export interface DashboardStats {
  people: number
  stories: number
  voiceProfiles: number
  publishedStories: number
  draftStories: number
  documents: number
  members: number
  generations: number
}

export interface DashboardFamilyspace {
  id: string
  name: string
  planType: string
  avatarAssetId: string | null
}

export interface DashboardUserContext {
  userId: string
  displayName: string | null
  role: FamilyspaceRole
}

export interface OnboardingState {
  hasFirstPerson: boolean
  hasFirstStory: boolean
  hasFirstDocument: boolean
  hasFirstVoice: boolean
  hasInvitedMember: boolean
}

export interface ContinueWork {
  lastDraftStory: {
    id: string
    title: string
    updatedAt: string
    subjectId: string | null
  } | null
  inProgressVoiceJob: {
    id: string
    status: string
    queuedAt: string
    voiceProfileId: string
    voiceProfileName: string
  } | null
}

export interface DashboardStory {
  id: string
  title: string
  excerpt: string
  storyDate: string | null
  status: string
  isPinned: boolean
  tags: string[]
  createdAt: string
  hasNarration: boolean
  subject: { id: string; name: string; avatarAssetId: string | null } | null
  createdBy: string
}

export interface DashboardFamilyMember {
  id: string
  name: string
  firstName: string
  lastName: string | null
  displayName: string | null
  avatarAssetId: string | null
  storyCount: number
  voiceProfileCount: number
  isDeceased: boolean
}

export interface BillingUsage {
  storage: { percentUsed: number; formattedUsed: string; formattedQuota: string }
  generation: { minutesUsed: number; minutesQuota: number; percentUsed: number }
  members: { count: number; quota: number }
  voiceProfiles: { count: number; quota: number }
}

export interface ActivityEntry {
  kind: 'comment' | 'upload' | 'generation'
  at: string
  title: string
  detail: string
  href: string | null
  actor: string
}

export interface FeaturedPerson {
  id: string
  name: string
  firstName: string
  bio: string | null
  birthDate: string | null
  deathDate: string | null
  isDeceased: boolean
  avatarAssetId: string | null
  storyCount: number
}

export interface Suggestion {
  key: string
  label: string
  href: string
}

interface DashboardControllerState {
  familyspace: DashboardFamilyspace | null
  userContext: DashboardUserContext | null
  stats: DashboardStats
  onboardingState: OnboardingState
  continueWork: ContinueWork
  pendingInvites: number
  latestStories: DashboardStory[]
  familyMembers: DashboardFamilyMember[]
  recentActivity: ActivityEntry[]
  featuredPerson: FeaturedPerson | null
  suggestions: Suggestion[]
  billingUsage: BillingUsage | null
  isLoading: boolean
  hasError: boolean
  errorMessage: string | null
}

interface DashboardControllerActions {
  refresh: () => Promise<void>
}

const EMPTY_STATS: DashboardStats = {
  people: 0,
  stories: 0,
  voiceProfiles: 0,
  publishedStories: 0,
  draftStories: 0,
  documents: 0,
  members: 0,
  generations: 0,
}

const EMPTY_ONBOARDING: OnboardingState = {
  hasFirstPerson: false,
  hasFirstStory: false,
  hasFirstDocument: false,
  hasFirstVoice: false,
  hasInvitedMember: false,
}

const EMPTY_CONTINUE: ContinueWork = {
  lastDraftStory: null,
  inProgressVoiceJob: null,
}

export function useDashboardController(): DashboardControllerState & DashboardControllerActions {
  const [state, setState] = useState<DashboardControllerState>({
    familyspace: null,
    userContext: null,
    stats: EMPTY_STATS,
    onboardingState: EMPTY_ONBOARDING,
    continueWork: EMPTY_CONTINUE,
    pendingInvites: 0,
    latestStories: [],
    familyMembers: [],
    recentActivity: [],
    featuredPerson: null,
    suggestions: [],
    billingUsage: null,
    isLoading: true,
    hasError: false,
    errorMessage: null,
  })

  const fetchDashboard = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, hasError: false, errorMessage: null }))

    try {
      const statsRes = await fetch('/api/dashboard/stats', { credentials: 'include' })
      const statsData = await statsRes.json()

      if (!statsData.success) {
        throw new Error(statsData.error || 'Failed to load dashboard')
      }

      const payload = statsData.data
      const role: FamilyspaceRole = payload.userContext?.role ?? 'VIEWER'
      const isAdminOrOwner = role === 'OWNER' || role === 'ADMIN'

      let billingUsage: BillingUsage | null = null
      if (isAdminOrOwner) {
        try {
          const usageRes = await fetch('/api/billing/usage', { credentials: 'include' })
          if (usageRes.ok) {
            const usageData = await usageRes.json()
            if (usageData.success) {
              billingUsage = usageData.data.usage as BillingUsage
            }
          }
        } catch {
          // Billing is optional — familyspaces without subscriptions return 404
        }
      }

      setState({
        familyspace: payload.familyspace,
        userContext: payload.userContext,
        stats: payload.stats,
        onboardingState: payload.onboardingState,
        continueWork: payload.continueWork,
        pendingInvites: payload.pendingInvites ?? 0,
        latestStories: payload.latestStories ?? [],
        familyMembers: payload.familyMembers ?? [],
        recentActivity: payload.recentActivity ?? [],
        featuredPerson: payload.featuredPerson ?? null,
        suggestions: payload.suggestions ?? [],
        billingUsage,
        isLoading: false,
        hasError: false,
        errorMessage: null,
      })
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

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const refresh = useCallback(async () => {
    await fetchDashboard()
  }, [fetchDashboard])

  return {
    ...state,
    refresh,
  }
}
