import { BaseRepository } from './BaseRepository'
import type { Prisma, Person } from '@prisma/client'

export class PersonRepository extends BaseRepository {
  async findById(id: string, workspaceId: string, include?: Prisma.PersonInclude): Promise<Person | null> {
    return this.prisma.person.findFirst({
      where: { id, workspaceId },
      include,
    })
  }

  async findMany(workspaceId: string, options: { 
    skip?: number, 
    take?: number,
    where?: Prisma.PersonWhereInput,
    include?: Prisma.PersonInclude 
  } = {}): Promise<Person[]> {
    return this.prisma.person.findMany({
      where: { 
        ...options.where,
        workspaceId,
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
      workspaceId: person.workspaceId,
      actorId: userId,
      actorType: 'USER',
      action: 'CREATE',
      resourceType: 'PERSON',
      resourceId: person.id,
      afterState: person,
    })

    return person
  }

  async update(id: string, workspaceId: string, data: Prisma.PersonUncheckedUpdateInput, userId: string): Promise<Person> {
    // Ensure it belongs to workspace before update
    const before = await this.prisma.person.findFirstOrThrow({
      where: { id, workspaceId },
    })

    const person = await this.prisma.person.update({
      where: { id },
      data: data as any,
    })

    await this.audit({
      workspaceId,
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

  async delete(id: string, workspaceId: string, userId: string): Promise<Person> {
    // Ensure it belongs to workspace before delete
    const before = await this.prisma.person.findFirstOrThrow({
      where: { id, workspaceId },
    })

    const person = await this.prisma.person.delete({
      where: { id },
    })

    await this.audit({
      workspaceId,
      actorId: userId,
      actorType: 'USER',
      action: 'DELETE',
      resourceType: 'PERSON',
      resourceId: person.id,
      beforeState: before,
    })

    return person
  }

  async count(workspaceId: string): Promise<number> {
    return this.prisma.person.count({
      where: { workspaceId },
    })
  }
}

export const personRepository = new PersonRepository()
