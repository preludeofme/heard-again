import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export interface SelectedFamilyMember {
  id: string
  firstName: string
  lastName?: string | null
  displayName?: string | null
  avatarUrl?: string | null
}

interface SelectedFamilyMemberContextValue {
  selectedFamilyMember: SelectedFamilyMember | null
  setSelectedFamilyMember: (person: SelectedFamilyMember | null) => void
  clearSelectedFamilyMember: () => void
}

const SelectedFamilyMemberContext = createContext<SelectedFamilyMemberContextValue | undefined>(undefined)

export function SelectedFamilyMemberProvider({ children }: { children: ReactNode }) {
  const [selectedFamilyMember, setSelectedFamilyMemberState] = useState<SelectedFamilyMember | null>(null)

  const setSelectedFamilyMember = useCallback((person: SelectedFamilyMember | null) => {
    setSelectedFamilyMemberState(person)
  }, [])

  const clearSelectedFamilyMember = useCallback(() => {
    setSelectedFamilyMemberState(null)
  }, [])

  const value: SelectedFamilyMemberContextValue = {
    selectedFamilyMember,
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
