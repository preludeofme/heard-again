import { BaseRepository } from './BaseRepository'
import type { Prisma, VoiceConsent } from '@prisma/client'

export class VoiceConsentRepository extends BaseRepository {
  async findById(id: string, familyspaceId: string): Promise<VoiceConsent | null> {
    return this.prisma.voiceConsent.findFirst({
      where: { id, familyspaceId },
    })
  }

  async findByPersonAndProfile(personId: string, voiceProfileId: string, familyspaceId: string): Promise<VoiceConsent | null> {
    return this.prisma.voiceConsent.findFirst({
      where: { personId, voiceProfileId, familyspaceId },
    })
  }

  async create(data: Prisma.VoiceConsentCreateInput): Promise<VoiceConsent> {
    return this.prisma.voiceConsent.create({ data })
  }

  async update(id: string, familyspaceId: string, data: Prisma.VoiceConsentUpdateInput): Promise<VoiceConsent> {
    await this.prisma.voiceConsent.findFirstOrThrow({
      where: { id, familyspaceId },
    })

    return this.prisma.voiceConsent.update({
      where: { id },
      data,
    })
  }
}

export const voiceConsentRepository = new VoiceConsentRepository()
