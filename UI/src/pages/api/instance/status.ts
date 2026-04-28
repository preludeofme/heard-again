import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  // GET /api/instance/status - Get instance connection status
  GET: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'VIEWER')

    const instance = await prisma.instance.findFirst({
      where: { familyspaceId: user.familyspaceId },
    })

    if (!instance) {
      return successResponse(res, {
        registered: false,
        message: 'No instance registered for this familyspace',
      })
    }

    // Calculate tunnel health
    const now = new Date()
    const tokenExpired = instance.tunnelTokenExpiresAt && instance.tunnelTokenExpiresAt < now
    const lastHeartbeatMinutes = instance.lastHeartbeatAt
      ? Math.floor((now.getTime() - new Date(instance.lastHeartbeatAt).getTime()) / 60000)
      : null
    
    // Consider offline if no heartbeat in 5 minutes
    const isOffline = lastHeartbeatMinutes !== null && lastHeartbeatMinutes > 5
    
    // Determine connection status
    let connectionStatus: 'connected' | 'disconnected' | 'error' | 'unknown' = 'unknown'
    if (instance.tunnelEnabled) {
      if (isOffline || instance.status === 'OFFLINE') {
        connectionStatus = 'disconnected'
      } else if (instance.lastErrorAt && instance.lastErrorMessage) {
        connectionStatus = 'error'
      } else if (instance.lastHeartbeatAt) {
        connectionStatus = 'connected'
      }
    }

    return successResponse(res, {
      registered: true,
      instance: {
        id: instance.id,
        type: instance.type,
        status: instance.status,
        version: instance.version,
        computeMode: instance.computeMode,
        dataMode: instance.dataMode,
        registeredAt: instance.registeredAt,
        lastHeartbeatAt: instance.lastHeartbeatAt,
      },
      tunnel: instance.tunnelEnabled ? {
        enabled: true,
        type: instance.tunnelId ? 'named' : 'quick',
        id: instance.tunnelId,
        name: instance.tunnelName,
        subdomain: instance.tunnelSubdomain,
        publicUrl: instance.tunnelId 
          ? `https://${instance.tunnelSubdomain}` 
          : `https://${instance.tunnelSubdomain}.heardagain.com`,
        tokenExpired,
        tokenExpiresAt: instance.tunnelTokenExpiresAt,
        lastAuthenticatedAt: instance.lastAuthenticatedAt,
        connectionStatus,
        lastHeartbeatMinutes,
      } : {
        enabled: false,
      },
      health: {
        connectionStatus,
        isOffline,
        lastError: instance.lastErrorAt ? {
          at: instance.lastErrorAt,
          message: instance.lastErrorMessage,
        } : null,
      },
    })
  },
})
