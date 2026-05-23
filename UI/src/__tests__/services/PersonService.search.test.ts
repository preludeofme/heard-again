import { PersonService } from '@/services/PersonService'

const makePerson = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  firstName: 'Person',
  middleName: null,
  lastName: null,
  maidenName: null,
  displayName: null,
  nickname: null,
  personType: 'FAMILY',
  isDeceased: false,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  avatarAsset: null,
  _count: { storiesAsSubject: 0, voiceProfiles: 0 },
  parentInFamilies: [],
  familyChildLinks: [],
  ...overrides,
})

describe('PersonService.listPeople search', () => {
  it('queries people with case-insensitive contains matching across name fields', async () => {
    const rows = [
      makePerson('1', { firstName: 'Bryan' }),
      makePerson('2', { firstName: 'Ryan' }),
      makePerson('3', { firstName: 'Enryan' }),
      makePerson('4', { firstName: 'MARYA' }),
      makePerson('5', { firstName: 'NoMatch', nickname: 'RyAn nickname' }),
    ]

    const repo = {
      findMany: jest.fn().mockResolvedValue(rows),
    }
    const service = new PersonService(repo as any)

    const result = await service.listPeople('familyspace-1', { search: 'rya', page: 1, limit: 500 })

    expect(repo.findMany).toHaveBeenCalledWith(
      'familyspace-1',
      expect.objectContaining({
        where: expect.objectContaining({
          familyspaceId: 'familyspace-1',
          AND: [
            {
              OR: expect.arrayContaining([
                { firstName: { contains: 'rya', mode: 'insensitive' } },
                { middleName: { contains: 'rya', mode: 'insensitive' } },
                { lastName: { contains: 'rya', mode: 'insensitive' } },
                { maidenName: { contains: 'rya', mode: 'insensitive' } },
                { displayName: { contains: 'rya', mode: 'insensitive' } },
                { nickname: { contains: 'rya', mode: 'insensitive' } },
              ]),
            },
          ],
        }),
        skip: 0,
        take: 500,
      })
    )
    expect(result.map((person) => person.displayName)).toEqual([
      'Bryan',
      'Ryan',
      'Enryan',
      'MARYA',
      'NoMatch',
    ])
  })
})
