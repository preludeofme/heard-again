import { BaseRepository } from './BaseRepository'
import type { Prisma, Asset } from '@prisma/client'

export class AssetRepository extends BaseRepository {
  async findById(id: string, workspaceId: string): Promise<Asset | null> {
    return this.prisma.asset.findFirst({
      where: { id, workspaceId },
    })
  }

  async findMany(workspaceId: string, options: { 
    skip?: number, 
    take?: number,
    where?: Prisma.AssetWhereInput 
  } = {}): Promise<Asset[]> {
    return this.prisma.asset.findMany({
      where: { 
        ...options.where,
        workspaceId,
      },
      skip: options.skip,
      take: options.take,
      orderBy: { createdAt: 'desc' },
    })
  }

  async create(data: Prisma.AssetUncheckedCreateInput, userId: string): Promise<Asset> {
    const asset = await this.prisma.asset.create({ data: data as any })
    
    await this.audit({
      workspaceId: asset.workspaceId,
      actorId: userId,
      actorType: 'USER',
      action: 'CREATE',
      resourceType: 'ASSET',
      resourceId: asset.id,
      afterState: asset,
    })

    return asset
  }

  async delete(id: string, workspaceId: string, userId: string): Promise<Asset> {
    const before = await this.prisma.asset.findFirstOrThrow({
      where: { id, workspaceId },
    })

    const asset = await this.prisma.asset.delete({
      where: { id },
    })

    await this.audit({
      workspaceId,
      actorId: userId,
      actorType: 'USER',
      action: 'DELETE',
      resourceType: 'ASSET',
      resourceId: asset.id,
      beforeState: before,
    })

    return asset
  }
}

export const assetRepository = new AssetRepository()
