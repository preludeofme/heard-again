import { PersonaServiceImpl } from '../../services/persona/PersonaService'
import { FormalityLevel } from '../../types/persona'

const mockWritingStyle = {
  vocabulary: ['family', 'home'],
  sentencePatterns: ['short declarative'],
  tone: {
    warmth: 0.8,
    formality: 0.4,
    emotionalIntensity: 0.6,
    optimism: 0.7,
    humor: 0.3,
    storytelling: 0.7,
  },
  formality: FormalityLevel.NEUTRAL,
  averageSentenceLength: 14,
  commonPhrases: ['back then'],
  emotionIndicators: [],
}

function createService(overrides?: {
  personName?: string | null
  personId?: string
  workspaceId?: string
}) {
  const personId = overrides?.personId ?? 'person-123'
  const workspaceId = overrides?.workspaceId ?? 'ws-1'

  const personaRepository = {
    getPersonaProfile: jest.fn(),
    createPersonaProfile: jest.fn(async (profile) => profile),
    updatePersonaProfile: jest.fn(),
    deletePersonaProfile: jest.fn(),
    listPersonaProfiles: jest.fn(),
  }

  const styleExtractor = {
    extractWritingStyle: jest.fn(async () => mockWritingStyle),
    extractStyleProfile: jest.fn(),
  }

  const documentRepository = {
    listDocuments: jest.fn(async () => [
      {
        id: 'doc-1',
        workspaceId,
        personId,
        title: 'Memoir Draft',
        content: 'I grew up on a farm and later restored old radios for fun.',
      },
    ]),
  }

  const personService = {
    getPerson: jest.fn(async () => {
      if (overrides?.personName === null) {
        return null
      }
      return {
        id: personId,
        firstName: 'Evelyn',
        lastName: 'Carter',
        fullName: overrides?.personName ?? 'Evelyn Carter',
        workspaceId,
      }
    }),
  }

  const llmGateway = {
    generateResponse: jest.fn(async () => ({
      content: JSON.stringify([
        {
          fact: 'I grew up on a farm and later restored old radios for fun.',
          type: 'experience',
          confidence: 0.91,
        },
      ]),
      metadata: {
        model: 'test-model',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        processingTime: 0,
        finishReason: 'stop',
        temperature: 0,
      },
    })),
  }

  const service = new PersonaServiceImpl(
    personaRepository as any,
    styleExtractor as any,
    documentRepository as any,
    personService as any,
    llmGateway as any
  )

  return { service, personId, workspaceId }
}

describe('PersonaServiceImpl.generatePersonaProfile', () => {
  it('uses person service full name instead of hardcoded identity', async () => {
    const { service, personId, workspaceId } = createService({
      personName: 'Evelyn Carter',
    })

    const profile = await service.generatePersonaProfile(personId, workspaceId, {
      documentIds: [],
      extractStyle: true,
      extractFacts: true,
      extractRelationships: false,
      minDocumentCount: 1,
      confidenceThreshold: 0.5,
    })

    expect(profile.displayName).toBe('Evelyn Carter')
    expect(profile.displayName).not.toBe('Keith Buck')
  })

  it('adds workspace/person/document provenance to extracted facts', async () => {
    const { service, personId, workspaceId } = createService({
      personName: null,
      personId: 'john-doe',
      workspaceId: 'workspace-22',
    })

    const profile = await service.generatePersonaProfile(personId, workspaceId, {
      documentIds: [],
      extractStyle: true,
      extractFacts: true,
      extractRelationships: false,
      minDocumentCount: 1,
      confidenceThreshold: 0.5,
    })

    expect(profile.displayName).toBe('John Doe')
    expect(profile.knownFacts[0].provenance?.[0]).toMatchObject({
      workspaceId,
      personId,
      documentId: 'doc-1',
      documentTitle: 'Memoir Draft',
    })
    expect(profile.knownFacts[0].provenance?.[0].excerpt).toContain('I grew up on a farm')
  })
})
