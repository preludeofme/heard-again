import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { useRouter, NextRouter } from 'next/router'

export interface SelectedFamilyMember {
  id: string
  firstName: string
  middleName?: string | null
  lastName?: string | null
  displayName?: string | null
  avatarUrl?: string | null
}

interface SelectedFamilyMemberContextValue {
  selectedFamilyMember: SelectedFamilyMember | null
  recentlyViewedMembers: SelectedFamilyMember[]
  setSelectedFamilyMember: (person: SelectedFamilyMember | null) => void
  clearSelectedFamilyMember: () => void
}

const STORAGE_KEY = 'heard-again:selected-member'
const RECENT_KEY = 'heard-again:recent-members'
const MAX_RECENT = 8

// Pages that should maintain the personId in the URL
const PERSON_AWARE_PAGES = [
  '/legacy',
  '/contribute',
  '/family-tree',
  '/favorites',
  '/voice-lab',
  '/chat',
  '/collections',
  '/documents',
  '/stories',
  '/timeline',
  '/profile',
]

function readStorage<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage may be unavailable (private browsing quota)
  }
}

function removeStorage(key: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

function addToRecent(
  incoming: SelectedFamilyMember,
  current: SelectedFamilyMember[],
): SelectedFamilyMember[] {
  const deduped = current.filter((m) => m.id !== incoming.id)
  return [incoming, ...deduped].slice(0, MAX_RECENT)
}

const SelectedFamilyMemberContext = createContext<SelectedFamilyMemberContextValue | undefined>(undefined)

export function SelectedFamilyMemberProvider({ 
  children,
  router: propRouter 
}: { 
  children: ReactNode,
  router?: NextRouter
}) {
  // Use propRouter if provided, otherwise fallback to hook (but handle potential failure)
  let hookRouter: NextRouter | null = null
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    hookRouter = useRouter()
  } catch (e) {
    // Ignore - router not mounted (e.g. during some build phases)
  }

  const router = propRouter || hookRouter
  
  // Must start null on both server and client to avoid SSR/client tree mismatch.
  // localStorage is read in a useEffect (client-only, post-mount) below.
  const [selectedFamilyMember, setSelectedFamilyMemberState] = useState<SelectedFamilyMember | null>(null)
  const [recentlyViewedMembers, setRecentlyViewedMembers] = useState<SelectedFamilyMember[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Hydrate from localStorage after mount (client-only, runs one render after SSR)
  useEffect(() => {
    const stored = readStorage<SelectedFamilyMember>(STORAGE_KEY)
    if (stored) setSelectedFamilyMemberState(stored)

    const storedRecent = readStorage<SelectedFamilyMember[]>(RECENT_KEY)
    if (storedRecent?.length) setRecentlyViewedMembers(storedRecent)
  }, [])

  // 1. URL and async hydration
  useEffect(() => {
    const hydrate = async () => {
      if (!router) {
        setIsInitialized(true)
        return
      }

      // URL takes precedence over localStorage
      const { personId } = router.query
      if (personId && typeof personId === 'string') {
        try {
          const response = await fetch(`/api/people/${personId}`)
          const data = await response.json()
          if (data.success) {
            setSelectedFamilyMemberState(data.data)
            writeStorage(STORAGE_KEY, data.data)
          }
        } catch (e) {
          console.error('Failed to fetch person from URL personId', e)
        }
      }
      setIsInitialized(true)
    }

    if (router && router.isReady) {
      hydrate()
    } else if (!router) {
      setIsInitialized(true)
    }
  }, [router?.isReady])

  // 2. Sync State -> URL
  useEffect(() => {
    if (!router || !isInitialized || !router.isReady) return

    const isAwarePage = PERSON_AWARE_PAGES.some(path => router.pathname.startsWith(path))
    if (!isAwarePage) return

    const urlPersonId = router.query.personId as string
    const statePersonId = selectedFamilyMember?.id

    if (statePersonId && urlPersonId !== statePersonId) {
      // Add personId to URL
      const newQuery = { ...router.query, personId: statePersonId }
      router.replace({ pathname: router.pathname, query: newQuery }, undefined, { shallow: true })
    } else if (!statePersonId && urlPersonId) {
      // Remove personId from URL
      const { personId, ...restQuery } = router.query
      router.replace({ pathname: router.pathname, query: restQuery }, undefined, { shallow: true })
    }
  }, [selectedFamilyMember?.id, router?.pathname, isInitialized, router?.isReady])

  // 3. Sync URL -> State (for manual URL changes or back/forward)
  useEffect(() => {
    if (!router || !isInitialized || !router.isReady) return

    const urlPersonId = router.query.personId as string
    const statePersonId = selectedFamilyMember?.id

    if (urlPersonId && urlPersonId !== statePersonId) {
      fetch(`/api/people/${urlPersonId}`)
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            setSelectedFamilyMemberState(data.data)
            writeStorage(STORAGE_KEY, data.data)
          }
        })
        .catch(e => console.error('Failed to sync URL personId to state', e))
    } else if (!urlPersonId && statePersonId) {
      // If we're on a profile page and the ID is removed from URL, we should probably keep the state
      // unless it's a deliberate clear. For now, maintain existing logic but be careful.
      if (router.pathname.startsWith('/profile/')) return 
      
      setSelectedFamilyMemberState(null)
      removeStorage(STORAGE_KEY)
    }
  }, [router?.query.personId])

  const setSelectedFamilyMember = useCallback((person: SelectedFamilyMember | null) => {
    setSelectedFamilyMemberState(person)
    if (person) {
      writeStorage(STORAGE_KEY, person)
      setRecentlyViewedMembers((prev) => {
        const updated = addToRecent(person, prev)
        writeStorage(RECENT_KEY, updated)
        return updated
      })
    } else {
      removeStorage(STORAGE_KEY)
    }
  }, [])

  const clearSelectedFamilyMember = useCallback(() => {
    setSelectedFamilyMemberState(null)
    removeStorage(STORAGE_KEY)
    // Also clear recently-viewed list so members from the old space don't bleed into the new space's flyout
    setRecentlyViewedMembers([])
    removeStorage(RECENT_KEY)
  }, [])

  const value: SelectedFamilyMemberContextValue = {
    selectedFamilyMember,
    recentlyViewedMembers,
    setSelectedFamilyMember,
    clearSelectedFamilyMember,
  }

  return (
    <SelectedFamilyMemberContext.Provider value={value}>
      {children}
    </SelectedFamilyMemberContext.Provider>
  )
}

export function useSelectedFamilyMember(): SelectedFamilyMemberContextValue {
  const context = useContext(SelectedFamilyMemberContext)
  if (context === undefined) {
    throw new Error('useSelectedFamilyMember must be used within a SelectedFamilyMemberProvider')
  }
  return context
}
