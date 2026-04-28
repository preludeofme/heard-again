import { BaseRepository } from './BaseRepository'
import type { Prisma, VoiceProfile } from '@prisma/client'

export class VoiceProfileRepository extends BaseRepository {
  async findById(id: string, familyspaceId: string): Promise<VoiceProfile | null> {
    return this.prisma.voiceProfile.findFirst({
      where: { id, familyspaceId },
    })
  }

  async findMany(familyspaceId: string, options: { 
    skip?: number, 
    take?: number,
    where?: Prisma.VoiceProfileWhereInput 
  } = {}): Promise<VoiceProfile[]> {
    return this.prisma.voiceProfile.findMany({
      where: { 
        ...options.where,
        familyspaceId,
      },
      skip: options.skip,
      take: options.take,
      orderBy: { updatedAt: 'desc' },
    })
  }

  async create(data: Prisma.VoiceProfileUncheckedCreateInput, userId: string): Promise<VoiceProfile> {
    const profile = await this.prisma.voiceProfile.create({ data: data as any })
    
    await this.audit({
      familyspaceId: profile.familyspaceId,
      actorId: userId,
      actorType: 'USER',
      action: 'CREATE',
      resourceType: 'VOICE_PROFILE',
      resourceId: profile.id,
      afterState: profile,
    })

    return profile
  }

  async update(id: string, familyspaceId: string, data: Prisma.VoiceProfileUncheckedUpdateInput, userId: string): Promise<VoiceProfile> {
    const before = await this.prisma.voiceProfile.findFirstOrThrow({
      where: { id, familyspaceId },
    })

    const profile = await this.prisma.voiceProfile.update({
      where: { id },
      data: data as any,
    })

    await this.audit({
      familyspaceId,
      actorId: userId,
      actorType: 'USER',
      action: 'UPDATE',
      resourceType: 'VOICE_PROFILE',
      resourceId: profile.id,
      beforeState: before,
      afterState: profile,
    })

    return profile
  }

  async delete(id: string, familyspaceId: string, userId: string): Promise<VoiceProfile> {
    const before = await this.prisma.voiceProfile.findFirstOrThrow({
      where: { id, familyspaceId },
    })

    const profile = await this.prisma.voiceProfile.delete({
      where: { id },
    })

    await this.audit({
      familyspaceId,
      actorId: userId,
      actorType: 'USER',
      action: 'DELETE',
      resourceType: 'VOICE_PROFILE',
      resourceId: profile.id,
      beforeState: before,
    })

    return profile
  }
}

export const voiceProfileRepository = new VoiceProfileRepository()
