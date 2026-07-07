/**
 * @jest-environment node
 */
import { getToken } from 'next-auth/jwt'
import { getServerSession } from 'next-auth/next'
import { assertContract, TEST_SESSION } from './contractHelpers'

// List of routes to test
import peopleHandler from '@/pages/api/people/index'
import personDetailHandler from '@/pages/api/people/[id]'
import storiesHandler from '@/pages/api/stories/index'
import storyDetailHandler from '@/pages/api/stories/[id]'
import assetsHandler from '@/pages/api/assets/index'
import assetDetailHandler from '@/pages/api/assets/[id]'
import uploadAssetHandler from '@/pages/api/assets/upload'
import familyspacesHandler from '@/pages/api/familyspaces/index'
import familyspaceInviteHandler from '@/pages/api/familyspaces/[id]/invite'
import signupHandler from '@/pages/api/auth/signup'
import forgotPasswordHandler from '@/pages/api/auth/forgot-password'
import resetPasswordHandler from '@/pages/api/auth/reset-password'
import completeOnboardingHandler from '@/pages/api/auth/complete-onboarding'
import voiceProfilesHandler from '@/pages/api/voice/profiles/index'
import voiceTrainHandler from '@/pages/api/voice/train'
import voiceConsentHandler from '@/pages/api/voice/consent/[id]'
import billingWebhookHandler from '@/pages/api/billing/webhook'
import billingSubscribeHandler from '@/pages/api/billing/subscribe'

const mockGetToken = getToken as jest.MockedFunction<typeof getToken>
const mockGetSession = getServerSession as jest.MockedFunction<typeof getServerSession>
import { prisma } from '@/lib/prisma'
const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('API Contract Tests', () => {
  const hooks = {
    setUnauthenticated: () => {
      mockGetToken.mockResolvedValue(null)
      mockGetSession.mockResolvedValue(null)
      mockPrisma.$queryRaw.mockResolvedValue([])
    },
    setAuthenticated: () => {
      const session = {
        user: {
          id: TEST_SESSION.sub,
          email: 'test@example.com',
          displayName: 'Test User',
          defaultFamilyspaceId: 'ws-1'
        }
      }
      mockGetToken.mockResolvedValue(TEST_SESSION as any)
      mockGetSession.mockResolvedValue(session as any)
      mockPrisma.$queryRaw.mockResolvedValue([{ 
        id: TEST_SESSION.sub, 
        email: 'test@example.com',
        mfaEnabled: false,
        mfaSecret: null 
      }])
    }
  }

  // 1. People
  it('contract: /api/people', async () => {
    await assertContract({
      label: 'GET/POST /api/people',
      handler: peopleHandler,
      supportedMethods: ['GET', 'POST'],
      unsupportedMethod: 'DELETE',
    }, hooks)
  })

  // 2. Person Detail
  it('contract: /api/people/[id]', async () => {
    await assertContract({
      label: 'GET/PUT/DELETE /api/people/[id]',
      handler: personDetailHandler,
      supportedMethods: ['GET', 'PUT', 'DELETE'],
      unsupportedMethod: 'POST',
      query: { id: 'p1' },
      unauthAllowedMethods: ['GET']
    }, hooks)
  })

  // 3. Stories
  it('contract: /api/stories', async () => {
    await assertContract({
      label: 'GET/POST /api/stories',
      handler: storiesHandler,
      supportedMethods: ['GET', 'POST'],
      unsupportedMethod: 'DELETE',
    }, hooks)
  })

  // 4. Story Detail
  it('contract: /api/stories/[id]', async () => {
    await assertContract({
      label: 'GET/PUT/DELETE /api/stories/[id]',
      handler: storyDetailHandler,
      supportedMethods: ['GET', 'PUT', 'DELETE'],
      unsupportedMethod: 'POST',
      query: { id: 's1' },
      unauthAllowedMethods: ['GET']
    }, hooks)
  })

  // 5. Assets
  it('contract: /api/assets', async () => {
    await assertContract({
      label: 'GET /api/assets',
      handler: assetsHandler,
      supportedMethods: ['GET'],
      unsupportedMethod: 'POST',
    }, hooks)
  })

  // 6. Asset Detail
  it('contract: /api/assets/[id]', async () => {
    await assertContract({
      label: 'GET/DELETE /api/assets/[id]',
      handler: assetDetailHandler,
      supportedMethods: ['GET', 'DELETE'],
      unsupportedMethod: 'POST',
      query: { id: 'a1' }
    }, hooks)
  })

  // 7. Upload Asset
  it('contract: /api/assets/upload', async () => {
    await assertContract({
      label: 'POST /api/assets/upload',
      handler: uploadAssetHandler,
      supportedMethods: ['POST'],
      unsupportedMethod: 'GET',
    }, hooks)
  })

  // 8. Familyspaces
  it('contract: /api/familyspaces', async () => {
    await assertContract({
      label: 'GET/POST /api/familyspaces',
      handler: familyspacesHandler,
      supportedMethods: ['GET', 'POST'],
      unsupportedMethod: 'DELETE',
    }, hooks)
  })

  // 9. Familyspace Invite
  it('contract: /api/familyspaces/[id]/invite', async () => {
    await assertContract({
      label: 'POST /api/familyspaces/[id]/invite',
      handler: familyspaceInviteHandler,
      supportedMethods: ['GET', 'POST'],
      unsupportedMethod: 'DELETE',
      query: { id: 'ws1' }
    }, hooks)
  })

  // 10. Signup (CSRF opt-out)
  it('contract: /api/auth/signup', async () => {
    await assertContract({
      label: 'POST /api/auth/signup',
      handler: signupHandler,
      supportedMethods: ['POST'],
      unsupportedMethod: 'GET',
      csrfDefaultOn: false
    }, hooks)
  })

  // 11. Forgot Password (CSRF opt-out)
  it('contract: /api/auth/forgot-password', async () => {
    await assertContract({
      label: 'POST /api/auth/forgot-password',
      handler: forgotPasswordHandler,
      supportedMethods: ['POST'],
      unsupportedMethod: 'GET',
      csrfDefaultOn: false
    }, hooks)
  })

  // 12. Reset Password (CSRF opt-out)
  it('contract: /api/auth/reset-password', async () => {
    await assertContract({
      label: 'POST /api/auth/reset-password',
      handler: resetPasswordHandler,
      supportedMethods: ['POST'],
      unsupportedMethod: 'GET',
      csrfDefaultOn: false
    }, hooks)
  })

  // 13. Complete Onboarding
  it('contract: /api/auth/complete-onboarding', async () => {
    await assertContract({
      label: 'POST /api/auth/complete-onboarding',
      handler: completeOnboardingHandler,
      supportedMethods: ['POST'],
      unsupportedMethod: 'GET',
    }, hooks)
  })

  // 14. Voice Profiles
  it('contract: /api/voice/profiles', async () => {
    await assertContract({
      label: 'GET/POST /api/voice/profiles',
      handler: voiceProfilesHandler,
      supportedMethods: ['GET', 'POST'],
      unsupportedMethod: 'DELETE',
    }, hooks)
  })

  // 15. Voice Train
  it('contract: /api/voice/train', async () => {
    await assertContract({
      label: 'POST /api/voice/train',
      handler: voiceTrainHandler,
      supportedMethods: ['POST'],
      unsupportedMethod: 'GET',
    }, hooks)
  })

  // 16. Voice Consent Detail
  it('contract: /api/voice/consent/[id]', async () => {
    await assertContract({
      label: 'PUT /api/voice/consent/[id]',
      handler: voiceConsentHandler,
      supportedMethods: ['PUT'],
      unsupportedMethod: 'GET',
      query: { id: 'c1' }
    }, hooks)
  })

  // 17. Billing Webhook (CSRF opt-out)
  it('contract: /api/billing/webhook', async () => {
    await assertContract({
      label: 'POST /api/billing/webhook',
      handler: billingWebhookHandler,
      supportedMethods: ['POST'],
      unsupportedMethod: 'GET',
      csrfDefaultOn: false
    }, hooks)
  })

  // 18. Billing Subscribe
  it('contract: /api/billing/subscribe', async () => {
    await assertContract({
      label: 'POST /api/billing/subscribe',
      handler: billingSubscribeHandler,
      supportedMethods: ['POST'],
      unsupportedMethod: 'GET',
    }, hooks)
  })

})
