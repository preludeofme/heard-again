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
      role?: string | null
    }
  }

  interface User {
    displayName?: string | null
    avatarUrl?: string | null
    defaultFamilyspaceId?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    displayName?: string | null
    avatarUrl?: string | null
    defaultFamilyspaceId?: string | null
    role?: string | null
  }
}
