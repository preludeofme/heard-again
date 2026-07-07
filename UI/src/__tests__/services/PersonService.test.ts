import { describe, it, expect, vi, beforeEach } from '@jest/globals'
import { PersonService } from '@/services/PersonService'
import { PersonRepository } from '@/server/repositories'

// Mock the repository
vi.mock('@/server/repositories', () => ({
  PersonRepository: vi.fn(),
}))

describe('PersonService', () => {
  let personService: PersonService
  let mockPersonRepo: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create mock repository
    mockPersonRepo = {
      findById: vi.fn(),
      findByFamilyMemberId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      search: vi.fn(),
    }
    
    // Mock the repository constructor
    vi.mocked(PersonRepository).mockImplementation(() => mockPersonRepo)
    
    // Create the service instance
    personService = new PersonService()
  })

  it('should initialize correctly', () => {
    expect(personService).toBeDefined()
  })

  it('should search for persons correctly', async () => {
    const mockResult = [{ id: 'person-1', name: 'Test Person' }]
    mockPersonRepo.search.mockResolvedValue(mockResult)
    
    const result = await personService.search('query')
    expect(result).toEqual(mockResult)
    expect(mockPersonRepo.search).toHaveBeenCalledWith('query')
  })

  it('should find person by ID correctly', async () => {
    const mockResult = { id: 'person-1', name: 'Test Person' }
    mockPersonRepo.findById.mockResolvedValue(mockResult)
    
    const result = await personService.findById('person-1')
    expect(result).toEqual(mockResult)
    expect(mockPersonRepo.findById).toHaveBeenCalledWith('person-1')
  })

  it('should create person correctly', async () => {
    const mockPerson = { name: 'Test Person' }
    const mockResult = { id: 'person-1', ...mockPerson }
    mockPersonRepo.create.mockResolvedValue(mockResult)
    
    const result = await personService.create(mockPerson)
    expect(result).toEqual(mockResult)
    expect(mockPersonRepo.create).toHaveBeenCalledWith(mockPerson)
  })

  it('should handle errors when creating person', async () => {
    const mockPerson = { name: 'Test Person' }
    mockPersonRepo.create.mockRejectedValue(new Error('Database Error'))
    
    await expect(personService.create(mockPerson)).rejects.toThrow('Database Error')
  })
})