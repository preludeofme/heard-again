import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'

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
  const [selectedFamilyMember, setSelectedFamilyMemberState] = useState<SelectedFamilyMember | null>(null)
  const [recentlyViewedMembers, setRecentlyViewedMembers] = useState<SelectedFamilyMember[]>([])

  // Hydrate from localStorage once on client mount
  useEffect(() => {
    const persisted = readStorage<SelectedFamilyMember>(STORAGE_KEY)
    if (persisted) setSelectedFamilyMemberState(persisted)

    const recent = readStorage<SelectedFamilyMember[]>(RECENT_KEY)
    if (recent) setRecentlyViewedMembers(recent)
  }, [])

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
    // Keep recently viewed — clearing context is just "unscope", not "forget"
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
