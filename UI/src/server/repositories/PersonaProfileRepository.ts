import { BaseRepository } from './BaseRepository'
import type { Prisma, PersonaProfile } from '@prisma/client'

export class PersonaProfileRepository extends BaseRepository {
  async findById(id: string, familyspaceId: string): Promise<PersonaProfile | null> {
    return this.prisma.personaProfile.findFirst({
      where: { id, familyspaceId },
    })
  }

  async findByPersonId(personId: string, familyspaceId: string): Promise<PersonaProfile | null> {
    return this.prisma.personaProfile.findFirst({
      where: { personId, familyspaceId },
    })
  }

  async create(data: Prisma.PersonaProfileCreateInput): Promise<PersonaProfile> {
    return this.prisma.personaProfile.create({ data })
  }

  async update(id: string, familyspaceId: string, data: Prisma.PersonaProfileUpdateInput): Promise<PersonaProfile> {
    await this.prisma.personaProfile.findFirstOrThrow({
      where: { id, familyspaceId },
    })

    return this.prisma.personaProfile.update({
      where: { id },
      data,
    })
  }

  async delete(id: string, familyspaceId: string): Promise<PersonaProfile> {
    await this.prisma.personaProfile.findFirstOrThrow({
      where: { id, familyspaceId },
    })

    return this.prisma.personaProfile.delete({
      where: { id },
    })
  }
}

export const personaProfileRepository = new PersonaProfileRepository()
