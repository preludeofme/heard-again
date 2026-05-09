import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/router'

export interface SelectedFamilyMember {
  id: string
  firstName: string
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
  '/memories',
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

export function SelectedFamilyMemberProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [selectedFamilyMember, setSelectedFamilyMemberState] = useState<SelectedFamilyMember | null>(null)
  const [recentlyViewedMembers, setRecentlyViewedMembers] = useState<SelectedFamilyMember[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // 1. Initial hydration from localStorage and URL
  useEffect(() => {
    const hydrate = async () => {
      const recent = readStorage<SelectedFamilyMember[]>(RECENT_KEY)
      if (recent) setRecentlyViewedMembers(recent)

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
      } else {
        const persisted = readStorage<SelectedFamilyMember>(STORAGE_KEY)
        if (persisted) setSelectedFamilyMemberState(persisted)
      }
      setIsInitialized(true)
    }

    if (router.isReady) {
      hydrate()
    }
  }, [router.isReady]) // Only run once when router is ready

  // 2. Sync State -> URL
  useEffect(() => {
    if (!isInitialized || !router.isReady) return

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
  }, [selectedFamilyMember?.id, router.pathname, isInitialized, router.isReady])

  // 3. Sync URL -> State (for manual URL changes or back/forward)
  useEffect(() => {
    if (!isInitialized || !router.isReady) return

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
      setSelectedFamilyMemberState(null)
      removeStorage(STORAGE_KEY)
    }
  }, [router.query.personId])

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
