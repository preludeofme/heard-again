import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcrypt'
import { prisma } from '@/lib/prisma'
import { validatePassword, hashPassword } from './security/password-policy'
import { logger } from './logger'

export const authOptions: NextAuthOptions = {
  // @ts-expect-error trustHost is valid in NextAuth.js v4+ but not in type definitions
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 1 day
  },
  pages: {
    signIn: '/login',
    signOut: '/',
    error: '/login',
    newUser: '/onboarding',
  },
  providers: [
    // Email/Password Credentials Provider
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.password) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        // Don't return the password
        const { password, ...userWithoutPassword } = user
        return userWithoutPassword
      },
    }),

    // Google OAuth Provider
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          prompt: 'select_account',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // On initial sign-in, persist user info into the JWT
      if (user) {
        token.id = user.id
        token.email = user.email
        // OAuth users have 'name', local users have 'displayName'
        token.displayName = (user as any).displayName || (user as any).name || null
        token.avatarUrl = (user as any).avatarUrl || (user as any).image || null
        token.defaultFamilyspaceId = (user as any).defaultFamilyspaceId || null
      }

      // Self-heal: if defaultFamilyspaceId is missing (stale token, post-DB-reset, etc.)
      if (!token.defaultFamilyspaceId && token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { defaultFamilyspaceId: true },
          })
          if (dbUser?.defaultFamilyspaceId) {
            token.defaultFamilyspaceId = dbUser.defaultFamilyspaceId
          }
        } catch (e) {
          logger.error('Failed to re-fetch defaultFamilyspaceId:', e)
        }
      }

      // Ensure role is always present in token (for new and existing sessions)
      if (!token.role && token.id) {
        try {
          const membership = await prisma.membership.findFirst({
            where: { userId: token.id },
            select: { role: true }
          })
          token.role = membership?.role || 'VIEWER'
        } catch (e) {
          logger.error('Failed to fetch user role:', e)
          token.role = 'VIEWER'
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.email = token.email
        session.user.displayName = (token.displayName as string) || null
        session.user.avatarUrl = (token.avatarUrl as string) || null
        session.user.defaultFamilyspaceId = (token.defaultFamilyspaceId as string) || null
        session.user.role = (token.role as string) || 'VIEWER'
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      // Send to the unified archive home by default; middleware will redirect to /onboarding if needed
      if (url === baseUrl || url === `${baseUrl}/`) return `${baseUrl}/archive`
      if (url.startsWith('/')) return `${baseUrl}${url}`
      else if (new URL(url).origin === baseUrl) return url
      return `${baseUrl}/archive`
    },
  },
  events: {
    async signIn({ user, account }) {
      // Update last login timestamp
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })
      } catch (e) {
        logger.error('Failed to update lastLoginAt:', e)
      }

      // Auto-create familyspace for users who don't have one
      try {
        // Check if user already has a familyspace
        const existingMembership = await prisma.membership.findFirst({
          where: { userId: user.id },
        })

        if (!existingMembership) {
          logger.info(`No familyspace found for user ${user.id}, creating one...`)

          // Create default familyspace
          const familyspace = await prisma.familyspace.create({
            data: {
              name: 'My Familyspace',
              slug: `familyspace-${user.id.slice(0, 8)}`,
              ownerId: user.id,
              members: {
                create: {
                  userId: user.id,
                  role: 'OWNER',
                  status: 'ACTIVE',
                  joinedAt: new Date(),
                },
              },
            },
          })

          // Set as default familyspace
          await prisma.user.update({
            where: { id: user.id },
            data: { defaultFamilyspaceId: familyspace.id },
          })

          logger.info(`Auto-created familyspace ${familyspace.id} for user ${user.id}`)
        }
      } catch (e) {
        logger.error('Failed to auto-create familyspace:', e)
      }
    },
  },
}
