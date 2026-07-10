import { PersonService } from '@/services/PersonService'

const makePerson = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  firstName: 'Test',
  middleName: null,
  lastName: 'Person',
  maidenName: null,
  sex: null,
  displayName: null,
  nickname: null,
  personType: 'FAMILY',
  birthDate: null,
  deathDate: null,
  isDeceased: false,
  bio: null,
  tags: [],
  createdAt: new Date('2024-01-01T00:00:00Z'),
  avatarAsset: null,
  _count: { storiesAsSubject: 0, voiceProfiles: 0 },
  parentInFamilies: [],
  familyChildLinks: [],
  ...overrides,
})

describe('PersonService', () => {
  it('should initialize correctly', () => {
    const service = new PersonService({} as any)
    expect(service).toBeDefined()
  })

  it('getPerson returns null when the repository finds nothing', async () => {
    const repo = { findById: jest.fn().mockResolvedValue(null) }
    const service = new PersonService(repo as any)

    const result = await service.getPerson('missing-id', 'familyspace-1')

    expect(result).toBeNull()
    expect(repo.findById).toHaveBeenCalledWith('missing-id', 'familyspace-1', expect.anything())
  })

  it('getPerson maps a found person to a PersonListItem', async () => {
    const person = makePerson('person-1')
    const repo = { findById: jest.fn().mockResolvedValue(person) }
    const service = new PersonService(repo as any)

    const result = await service.getPerson('person-1', 'familyspace-1')

    expect(result).toEqual(
      expect.objectContaining({
        id: 'person-1',
        firstName: 'Test',
        lastName: 'Person',
        displayName: 'Test Person',
      })
    )
  })

  it('createPerson delegates to the repository and returns the created person', async () => {
    const createdAt = new Date('2024-01-01T00:00:00Z')
    const repo = {
      create: jest.fn().mockResolvedValue({
        id: 'person-1',
        firstName: 'New',
        lastName: 'Person',
        displayName: null,
        personType: 'FAMILY',
        createdAt,
      }),
    }
    const service = new PersonService(repo as any)

    const result = await service.createPerson(
      'familyspace-1',
      'user-1',
      { firstName: 'New', lastName: 'Person' } as any
    )

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        familyspaceId: 'familyspace-1',
        createdById: 'user-1',
        firstName: 'New',
        lastName: 'Person',
      }),
      'user-1'
    )
    expect(result).toEqual(
      expect.objectContaining({
        id: 'person-1',
        firstName: 'New',
        lastName: 'Person',
        displayName: 'New Person',
      })
    )
  })

  it('createPerson propagates repository errors', async () => {
    const repo = { create: jest.fn().mockRejectedValue(new Error('Database Error')) }
    const service = new PersonService(repo as any)

    await expect(
      service.createPerson('familyspace-1', 'user-1', { firstName: 'New' } as any)
    ).rejects.toThrow('Database Error')
  })

  it('deletePerson delegates to the repository', async () => {
    const repo = { delete: jest.fn().mockResolvedValue(undefined) }
    const service = new PersonService(repo as any)

    await service.deletePerson('person-1', 'familyspace-1', 'user-1')

    expect(repo.delete).toHaveBeenCalledWith('person-1', 'familyspace-1', 'user-1')
  })
})
