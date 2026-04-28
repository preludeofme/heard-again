import { BaseRepository } from './BaseRepository'
import type { Prisma, Asset } from '@prisma/client'

export class AssetRepository extends BaseRepository {
  async findById(id: string, familyspaceId: string): Promise<Asset | null> {
    return this.prisma.asset.findFirst({
      where: { id, familyspaceId },
    })
  }

  async findMany(familyspaceId: string, options: { 
    skip?: number, 
    take?: number,
    where?: Prisma.AssetWhereInput 
  } = {}): Promise<Asset[]> {
    return this.prisma.asset.findMany({
      where: { 
        ...options.where,
        familyspaceId,
      },
      skip: options.skip,
      take: options.take,
      orderBy: { createdAt: 'desc' },
    })
  }

  async create(data: Prisma.AssetUncheckedCreateInput, userId: string): Promise<Asset> {
    const asset = await this.prisma.asset.create({ data: data as any })
    
    await this.audit({
      familyspaceId: asset.familyspaceId,
      actorId: userId,
      actorType: 'USER',
      action: 'CREATE',
      resourceType: 'ASSET',
      resourceId: asset.id,
      afterState: asset,
    })

    return asset
  }

  async delete(id: string, familyspaceId: string, userId: string): Promise<Asset> {
    const before = await this.prisma.asset.findFirstOrThrow({
      where: { id, familyspaceId },
    })

    const asset = await this.prisma.asset.delete({
      where: { id },
    })

    await this.audit({
      familyspaceId,
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
