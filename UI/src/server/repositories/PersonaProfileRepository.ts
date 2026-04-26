import { BaseRepository } from './BaseRepository'
import type { Prisma, PersonaProfile } from '@prisma/client'

export class PersonaProfileRepository extends BaseRepository {
  async findById(id: string, workspaceId: string): Promise<PersonaProfile | null> {
    return this.prisma.personaProfile.findFirst({
      where: { id, workspaceId },
    })
  }

  async findByPersonId(personId: string, workspaceId: string): Promise<PersonaProfile | null> {
    return this.prisma.personaProfile.findFirst({
      where: { personId, workspaceId },
    })
  }

  async create(data: Prisma.PersonaProfileCreateInput): Promise<PersonaProfile> {
    return this.prisma.personaProfile.create({ data })
  }

  async update(id: string, workspaceId: string, data: Prisma.PersonaProfileUpdateInput): Promise<PersonaProfile> {
    await this.prisma.personaProfile.findFirstOrThrow({
      where: { id, workspaceId },
    })

    return this.prisma.personaProfile.update({
      where: { id },
      data,
    })
  }

  async delete(id: string, workspaceId: string): Promise<PersonaProfile> {
    await this.prisma.personaProfile.findFirstOrThrow({
      where: { id, workspaceId },
    })

    return this.prisma.personaProfile.delete({
      where: { id },
    })
  }
}

export const personaProfileRepository = new PersonaProfileRepository()
