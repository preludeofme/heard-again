import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { validate, rules } from '@/lib/validation'

// Generate a cryptographically secure random token
function generateToken(length = 32): string {
  return crypto.randomBytes(length).toString('base64url')
}

export default apiHandler({
  // POST /api/instance/tunnel - Configure or regenerate tunnel
  POST: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'OWNER')

    const { valid, errors } = validate(req.body, {
      action: [rules.required, rules.oneOf(['enable', 'disable', 'regenerate', 'rotate-token'])],
    })

    if (!valid) {
      throw Errors.badRequest('Validation failed', errors)
    }

    const { action } = req.body

    let instance = await prisma.instance.findFirst({
      where: { familyspaceId: user.familyspaceId },
    })

    // Auto-create instance if enabling tunnel and none exists
    if (!instance && action === 'enable') {
      instance = await prisma.instance.create({
        data: {
          familyspaceId: user.familyspaceId,
          type: 'LOCAL',
          status: 'ACTIVE',
          version: '1.0.0',
          computeMode: 'LOCAL',
          dataMode: 'LOCAL',
          tunnelEnabled: false,
          registeredAt: new Date(),
        },
      })
    }

    if (!instance) {
      throw Errors.notFound('Instance')
    }

    // Check plan supports tunnel
    const subscription = await prisma.subscription.findUnique({
      where: { familyspaceId: user.familyspaceId },
      include: { plan: true },
    })

    if (!subscription?.plan?.tunnelEnabled) {
      throw Errors.forbidden('Your plan does not support tunnel/connected mode. Please upgrade.')
    }

    let updatedInstance

    switch (action) {
      case 'enable':
        if (instance.tunnelEnabled) {
          throw Errors.badRequest('Tunnel is already enabled')
        }
        
        // Generate new tunnel config
        const familyspace = await prisma.familyspace.findUnique({
          where: { id: user.familyspaceId },
          select: { slug: true },
        })
        
        const baseSlug = familyspace?.slug || 'instance'
        const subdomain = `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`.toLowerCase()
        
        updatedInstance = await prisma.instance.update({
          where: { id: instance.id },
          data: {
            tunnelEnabled: true,
            tunnelSubdomain: subdomain,
            tunnelToken: generateToken(48),
            tunnelTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          },
        })
        
        // Update familyspace deployment mode
        await prisma.familyspace.update({
          where: { id: user.familyspaceId },
          data: { deploymentMode: 'TUNNELED' },
        })
        break

      case 'disable':
        if (!instance.tunnelEnabled) {
          throw Errors.badRequest('Tunnel is already disabled')
        }
        
        updatedInstance = await prisma.instance.update({
          where: { id: instance.id },
          data: {
            tunnelEnabled: false,
            tunnelSubdomain: null,
            tunnelToken: null,
            tunnelTokenExpiresAt: null,
          },
        })
        
        // Update familyspace deployment mode
        await prisma.familyspace.update({
          where: { id: user.familyspaceId },
          data: { deploymentMode: 'LOCAL' },
        })
        break

      case 'regenerate':
        // Generate completely new subdomain
        const ws = await prisma.familyspace.findUnique({
          where: { id: user.familyspaceId },
          select: { slug: true },
        })
        
        const newSubdomain = `${ws?.slug || 'instance'}-${crypto.randomBytes(3).toString('hex')}`.toLowerCase()
        
        updatedInstance = await prisma.instance.update({
          where: { id: instance.id },
          data: {
            tunnelSubdomain: newSubdomain,
            tunnelToken: generateToken(48),
            tunnelTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        })
        break

      case 'rotate-token':
        // Keep same subdomain, just rotate token
        updatedInstance = await prisma.instance.update({
          where: { id: instance.id },
          data: {
            tunnelToken: generateToken(48),
            tunnelTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        })
        break

      default:
        throw Errors.badRequest('Invalid action')
    }

    return successResponse(res, {
      tunnel: updatedInstance.tunnelEnabled ? {
        enabled: true,
        subdomain: updatedInstance.tunnelSubdomain,
        publicUrl: `https://${updatedInstance.tunnelSubdomain}.heardagain.com`,
        token: updatedInstance.tunnelToken,
        expiresAt: updatedInstance.tunnelTokenExpiresAt,
        instructions: [
          'Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/',
          `Run: cloudflared tunnel --url http://localhost:4777 --hostname ${updatedInstance.tunnelSubdomain}.heardagain.com`,
          'For persistent tunnel, save credentials and run as a service.',
        ],
      } : {
        enabled: false,
      },
      message: `Tunnel ${action}d successfully`,
    })
  },
})
