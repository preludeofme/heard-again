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

// Generate a subdomain from workspace slug
function generateSubdomain(slug: string): string {
  const base = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 20)
  const random = Math.random().toString(36).substring(2, 6)
  return `${base}-${random}`
}

export default apiHandler({
  // POST /api/instance/register - Register a new local instance
  POST: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'OWNER')

    const { valid, errors } = validate(req.body, {
      type: [rules.required, rules.oneOf(['LOCAL', 'HYBRID'])],
      version: [rules.required],
      computeMode: [rules.required, rules.oneOf(['LOCAL', 'CLOUD', 'HYBRID'])],
      dataMode: [rules.required, rules.oneOf(['LOCAL', 'CLOUD', 'SYNCED'])],
    })

    if (!valid) {
      throw Errors.badRequest('Validation failed', errors)
    }

    const { type, version, computeMode, dataMode, metadata } = req.body

    // Check if workspace has an instance already
    const existingInstance = await prisma.instance.findFirst({
      where: { workspaceId: user.workspaceId },
    })

    if (existingInstance) {
      throw Errors.conflict('An instance is already registered for this workspace')
    }

    // Check if plan supports tunnel for non-local types
    const subscription = await prisma.subscription.findUnique({
      where: { workspaceId: user.workspaceId },
      include: { plan: true },
    })

    // Get workspace for slug
    const workspace = await prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: { slug: true },
    })

    const wantsTunnel = type === 'HYBRID' || (computeMode !== 'LOCAL' || dataMode !== 'LOCAL')
    
    if (wantsTunnel && !subscription?.plan?.tunnelEnabled) {
      throw Errors.forbidden('Your plan does not support tunnel/connected mode. Please upgrade.')
    }

    // Generate tunnel config if needed
    const tunnelEnabled = wantsTunnel && subscription?.plan?.tunnelEnabled
    const tunnelSubdomain = tunnelEnabled ? generateSubdomain(workspace?.slug || 'instance') : null
    const tunnelToken = tunnelEnabled ? generateToken(48) : null
    const tunnelTokenExpiresAt = tunnelEnabled 
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      : null

    const instance = await prisma.instance.create({
      data: {
        workspaceId: user.workspaceId,
        type: type as any,
        status: 'ACTIVE',
        version,
        computeMode: computeMode as any,
        dataMode: dataMode as any,
        tunnelEnabled: tunnelEnabled || false,
        tunnelSubdomain,
        tunnelToken,
        tunnelTokenExpiresAt,
        lastAuthenticatedAt: new Date(),
        metadata: metadata || {},
      },
    })

    // Update workspace deployment mode
    const deploymentMode = tunnelEnabled ? 'TUNNELED' : 'LOCAL'
    await prisma.workspace.update({
      where: { id: user.workspaceId },
      data: { deploymentMode: deploymentMode as any },
    })

    return successResponse(res, {
      instance: {
        id: instance.id,
        type: instance.type,
        status: instance.status,
        version: instance.version,
        computeMode: instance.computeMode,
        dataMode: instance.dataMode,
        tunnelEnabled: instance.tunnelEnabled,
        tunnelSubdomain: instance.tunnelSubdomain,
        registeredAt: instance.registeredAt,
      },
      tunnel: tunnelEnabled ? {
        subdomain: instance.tunnelSubdomain,
        publicUrl: `https://${instance.tunnelSubdomain}.heardagain.com`,
        token: instance.tunnelToken,
        expiresAt: instance.tunnelTokenExpiresAt,
        instructions: [
          'Install cloudflared on your server: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/',
          `Run: cloudflared tunnel --url http://localhost:3002 --hostname ${instance.tunnelSubdomain}.heardagain.com`,
          'Or use Docker: docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token YOUR_TOKEN',
        ],
      } : null,
    }, 201)
  },
})
