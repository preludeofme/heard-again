import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'

/**
 * GET /api/instance/health - Public health check endpoint
 * This endpoint is called by the tunnel service (cloudflared) 
 * or external monitors to verify the instance is healthy.
 * It supports a token-based auth for the instance itself.
 */
export default apiHandler({
  GET: async (req, res) => {
    const { token, familyspaceId } = req.query

    // If token provided, validate it against an instance
    if (token && typeof token === 'string' && familyspaceId && typeof familyspaceId === 'string') {
      const instance = await prisma.instance.findFirst({
        where: {
          familyspaceId,
          tunnelToken: token,
          tunnelEnabled: true,
        },
      })

      if (!instance) {
        throw Errors.unauthorized('Invalid token or familyspace')
      }

      // Check if token is expired
      if (instance.tunnelTokenExpiresAt && new Date() > instance.tunnelTokenExpiresAt) {
        throw Errors.unauthorized('Token expired')
      }

      // Update heartbeat
      await prisma.instance.update({
        where: { id: instance.id },
        data: {
          lastHeartbeatAt: new Date(),
          status: 'ACTIVE',
        },
      })

      return successResponse(res, {
        healthy: true,
        instanceId: instance.id,
        familyspaceId: instance.familyspaceId,
        tunnelEnabled: instance.tunnelEnabled,
        timestamp: new Date().toISOString(),
      })
    }

    // Public health check (no auth required)
    // Returns basic system status without sensitive data
    return successResponse(res, {
      status: 'ok',
      service: 'heard-again-api',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      features: {
        database: await checkDatabase(),
      },
    })
  },
})

async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch {
    return false
  }
}
