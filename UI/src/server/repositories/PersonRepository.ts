import { BaseRepository } from './BaseRepository'
import type { Prisma, Person } from '@prisma/client'

export class PersonRepository extends BaseRepository {
  async findById(id: string, familyspaceId?: string, include?: Prisma.PersonInclude): Promise<Person | null> {
    const where: Prisma.PersonWhereInput = { id }
    if (familyspaceId) {
      where.familyspaceId = familyspaceId
    }
    return this.prisma.person.findFirst({
      where,
      include,
    })
  }

  async findMany(familyspaceId: string, options: { 
    skip?: number, 
    take?: number,
    where?: Prisma.PersonWhereInput,
    include?: Prisma.PersonInclude 
  } = {}): Promise<Person[]> {
    return this.prisma.person.findMany({
      where: { 
        ...options.where,
        familyspaceId,
      },
      skip: options.skip,
      take: options.take,
      include: options.include,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    })
  }

  async create(data: Prisma.PersonUncheckedCreateInput, userId: string): Promise<Person> {
    const person = await this.prisma.person.create({ data: data as any })
    
    await this.audit({
      familyspaceId: person.familyspaceId,
      actorId: userId,
      actorType: 'USER',
      action: 'CREATE',
      resourceType: 'PERSON',
      resourceId: person.id,
      afterState: person,
    })

    return person
  }

  async update(id: string, familyspaceId: string, data: Prisma.PersonUncheckedUpdateInput, userId: string): Promise<Person> {
    // Ensure it belongs to familyspace before update
    const before = await this.prisma.person.findFirstOrThrow({
      where: { id, familyspaceId },
    })

    const person = await this.prisma.person.update({
      where: { id },
      data: data as any,
    })

    await this.audit({
      familyspaceId,
      actorId: userId,
      actorType: 'USER',
      action: 'UPDATE',
      resourceType: 'PERSON',
      resourceId: person.id,
      beforeState: before,
      afterState: person,
    })

    return person
  }

  async delete(id: string, familyspaceId: string, userId: string): Promise<Person> {
    // Ensure it belongs to familyspace before delete
    const before = await this.prisma.person.findFirstOrThrow({
      where: { id, familyspaceId },
    })

    const person = await this.prisma.person.delete({
      where: { id },
    })

    await this.audit({
      familyspaceId,
      actorId: userId,
      actorType: 'USER',
      action: 'DELETE',
      resourceType: 'PERSON',
      resourceId: person.id,
      beforeState: before,
    })

    return person
  }

  async count(familyspaceId: string): Promise<number> {
    return this.prisma.person.count({
      where: { familyspaceId },
    })
  }

  async findFamilyUnits(personId: string, familyspaceId?: string) {
    return this.prisma.familyUnit.findMany({
      where: {
        ...(familyspaceId ? { familyspaceId } : {}),
        OR: [
          { parents: { some: { parentId: personId } } },
          { children: { some: { childId: personId } } },
        ],
      },
      include: {
        parents: {
          include: {
            parent: {
              select: { id: true, firstName: true, lastName: true, avatarAssetId: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        children: {
          include: {
            child: {
              select: { id: true, firstName: true, lastName: true, avatarAssetId: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })
  }
}

export const personRepository = new PersonRepository()
