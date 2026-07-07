import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcrypt'
import { prisma } from '@/lib/prisma'
import { validatePassword, hashPassword } from './security/password-policy'
import { logger } from './logger'
import { generateMFACode, sendMFACodeEmail, storeMFACode } from '@/services/MFAEmailService'

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
        mfaToken: { label: 'MFA Token', type: 'text' },
        mfaTempToken: { label: 'MFA Temp Token', type: 'text' },
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

        // Check if MFA is enabled
        if (user.mfaEnabled) {
          if (user.mfaMethod === 'email') {
            // Check if the user has provided a valid mfaTempToken (from the mfa-verify endpoint)
            if (credentials.mfaTempToken) {
              // Verify the temp token matches what we stored
              if (
                user.mfaEmailCode === credentials.mfaTempToken &&
                user.mfaEmailCodeExpires &&
                new Date() < user.mfaEmailCodeExpires
              ) {
                // MFA passed — clear temp token and proceed
                await prisma.user.update({
                  where: { id: user.id },
                  data: {
                    mfaEmailCode: null,
                    mfaEmailCodeExpires: null,
                  },
                })
                // Continue to return user below
              } else {
                // Invalid or expired temp token
                logger.warn({ userId: user.id }, 'MFA temp token invalid or expired')
                return null
              }
            } else {
              // MFA is required — return a special signal that the login page can detect
              // We return a partial user with a marker, and throw a custom error
              const mfaRequiredError = new Error('MFA_REQUIRED')
              ;(mfaRequiredError as any).email = user.email
              ;(mfaRequiredError as any).mfaMethod = 'email'
              throw mfaRequiredError
            }
          } else if (user.mfaMethod === 'totp') {
            // For TOTP, we need the MFA token from the authenticator app
            if (!credentials.mfaToken) {
              const mfaRequiredError = new Error('MFA_REQUIRED')
              ;(mfaRequiredError as any).email = user.email
              ;(mfaRequiredError as any).mfaMethod = 'totp'
              throw mfaRequiredError
            }

            // Verify TOTP code
            try {
              const { default: speakeasy } = await import('speakeasy')
              const { decryptSecret } = await import('./security/mfa-service')

              if (user.mfaSecret) {
                const secret = decryptSecret(user.mfaSecret)
                const isValid = speakeasy.totp.verify({
                  secret,
                  encoding: 'base32',
                  token: credentials.mfaToken,
                  window: 1,
                })

                if (!isValid) {
                  // Also check backup codes
                  if (user.mfaBackupCodes) {
                    const hashedCodes: string[] = JSON.parse(user.mfaBackupCodes as string)
                    const backupCode = credentials.mfaToken
                    const bcryptModule = await import('bcrypt')

                    const codeIndex = hashedCodes.findIndex((hashed: string) =>
                      bcryptModule.compareSync(backupCode.replace('-', ''), hashed)
                    )

                    if (codeIndex !== -1) {
                      // Remove used backup code
                      hashedCodes.splice(codeIndex, 1)
                      await prisma.user.update({
                        where: { id: user.id },
                        data: { mfaBackupCodes: JSON.stringify(hashedCodes) },
                      })
                      logger.info({ userId: user.id }, 'MFA backup code used during sign in')
                    } else {
                      return null
                    }
                  } else {
                    return null
                  }
                }
              } else {
                return null
              }
            } catch (e) {
              logger.error({ userId: user.id }, 'TOTP verification error during sign in')
              return null
            }
          }
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
    async jwt({ token, user, account, trigger }) {
      // On initial sign-in, persist user info into the JWT
      if (user) {
        token.id = user.id
        token.email = user.email
        // OAuth users have 'name', local users have 'displayName'
        token.displayName = (user as any).displayName || (user as any).name || null
        token.avatarUrl = (user as any).avatarUrl || (user as any).image || null
        token.defaultFamilyspaceId = (user as any).defaultFamilyspaceId || null
        token.linkedPersonId = (user as any).linkedPersonId || null
        // Persist the user's global role (USER/ADMIN) for admin access control
        token.userRole = (user as any).role || 'USER'
      }

      // On session update (e.g. after switching familyspace), always refresh from DB
      if (trigger === 'update' && token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { defaultFamilyspaceId: true },
          })
          if (dbUser?.defaultFamilyspaceId) {
            token.defaultFamilyspaceId = dbUser.defaultFamilyspaceId
          }
        } catch (e) {
          logger.error('Failed to refresh defaultFamilyspaceId on update:', e)
        }
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
        session.user.linkedPersonId = (token.linkedPersonId as string) || null
        session.user.role = (token.role as string) || 'VIEWER'
        session.user.userRole = (token.userRole as string) || 'USER'
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      // Send to the unified memories home by default; middleware will redirect to /onboarding if needed
      if (url === baseUrl || url === `${baseUrl}/`) return `${baseUrl}/legacy`
      if (url.startsWith('/')) return `${baseUrl}${url}`
      else if (new URL(url).origin === baseUrl) return url
      return `${baseUrl}/legacy`
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
