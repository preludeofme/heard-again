import { Session } from 'next-auth'

// Extend NextAuth types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email?: string | null
      name?: string | null
      image?: string | null
      displayName?: string | null
      avatarUrl?: string | null
      defaultFamilyspaceId?: string | null
      linkedPersonId?: string | null
      role?: string | null
      userRole?: string | null
      mfaEnabled?: boolean | null
    }
  }

  interface User {
    displayName?: string | null
    avatarUrl?: string | null
    defaultFamilyspaceId?: string | null
    linkedPersonId?: string | null
    mfaEnabled?: boolean | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    displayName?: string | null
    avatarUrl?: string | null
    defaultFamilyspaceId?: string | null
    linkedPersonId?: string | null
    role?: string | null
    userRole?: string | null
    mfaEnabled?: boolean | null
  }
}
