import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { validate, rules } from '@/lib/validation'

// Generate a secure random token
function generateToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export default apiHandler({
  // POST /api/instance/tunnel - Configure or regenerate tunnel
  POST: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'OWNER')

    const { valid, errors } = validate(req.body, {
      action: [rules.required, rules.oneOf(['enable', 'disable', 'regenerate', 'rotate-token'])],
    })

    if (!valid) {
      throw Errors.badRequest('Validation failed', errors)
    }

    const { action } = req.body

    let instance = await prisma.instance.findFirst({
      where: { workspaceId: user.workspaceId },
    })

    // Auto-create instance if enabling tunnel and none exists
    if (!instance && action === 'enable') {
      instance = await prisma.instance.create({
        data: {
          workspaceId: user.workspaceId,
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
      where: { workspaceId: user.workspaceId },
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
        const workspace = await prisma.workspace.findUnique({
          where: { id: user.workspaceId },
          select: { slug: true },
        })
        
        const baseSlug = workspace?.slug || 'instance'
        const subdomain = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`.toLowerCase()
        
        updatedInstance = await prisma.instance.update({
          where: { id: instance.id },
          data: {
            tunnelEnabled: true,
            tunnelSubdomain: subdomain,
            tunnelToken: generateToken(48),
            tunnelTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          },
        })
        
        // Update workspace deployment mode
        await prisma.workspace.update({
          where: { id: user.workspaceId },
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
        
        // Update workspace deployment mode
        await prisma.workspace.update({
          where: { id: user.workspaceId },
          data: { deploymentMode: 'LOCAL' },
        })
        break

      case 'regenerate':
        // Generate completely new subdomain
        const ws = await prisma.workspace.findUnique({
          where: { id: user.workspaceId },
          select: { slug: true },
        })
        
        const newSubdomain = `${ws?.slug || 'instance'}-${Math.random().toString(36).substring(2, 6)}`.toLowerCase()
        
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
