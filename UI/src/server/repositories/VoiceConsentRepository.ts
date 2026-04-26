import { BaseRepository } from './BaseRepository'
import type { Prisma, VoiceConsent } from '@prisma/client'

export class VoiceConsentRepository extends BaseRepository {
  async findById(id: string, workspaceId: string): Promise<VoiceConsent | null> {
    return this.prisma.voiceConsent.findFirst({
      where: { id, workspaceId },
    })
  }

  async findByPersonAndProfile(personId: string, voiceProfileId: string, workspaceId: string): Promise<VoiceConsent | null> {
    return this.prisma.voiceConsent.findFirst({
      where: { personId, voiceProfileId, workspaceId },
    })
  }

  async create(data: Prisma.VoiceConsentCreateInput): Promise<VoiceConsent> {
    return this.prisma.voiceConsent.create({ data })
  }

  async update(id: string, workspaceId: string, data: Prisma.VoiceConsentUpdateInput): Promise<VoiceConsent> {
    await this.prisma.voiceConsent.findFirstOrThrow({
      where: { id, workspaceId },
    })

    return this.prisma.voiceConsent.update({
      where: { id },
      data,
    })
  }
}

export const voiceConsentRepository = new VoiceConsentRepository()
