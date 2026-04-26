import { prisma } from '@/lib/prisma'
import { ActorType } from '@prisma/client'

export abstract class BaseRepository {
  protected prisma = prisma

  /**
   * Helper to ensure workspace isolation.
   */
  protected async validateWorkspaceAccess(workspaceId: string, resourceWorkspaceId: string) {
    if (workspaceId !== resourceWorkspaceId) {
      throw new Error('Unauthorized workspace access')
    }
  }

  /**
   * Helper to log audit events
   */
  protected async audit(params: {
    workspaceId: string
    actorId?: string
    actorType: ActorType
    action: string
    resourceType: string
    resourceId?: string
    beforeState?: any
    afterState?: any
    metadata?: any
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          workspaceId: params.workspaceId,
          actorId: params.actorId ?? null,
          actorType: params.actorType,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId ?? null,
          beforeState: params.beforeState ?? null,
          afterState: params.afterState ?? null,
          metadata: params.metadata ?? null,
        },
      })
    } catch (error) {
      // Don't fail the main operation if audit logging fails, but log it
      console.error('Failed to write audit log:', error)
    }
  }
}
