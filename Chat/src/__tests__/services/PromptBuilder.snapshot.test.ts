import { PromptBuilderImpl } from '../../services/chat/PromptBuilder'
import { FormalityLevel } from '../../types/persona'
import { DocumentType } from '../../types/retrieval'
import type { PersonaProfile, RetrievedDocument, ChatMessage } from '../../types'

// Pinned timestamps so snapshots stay deterministic across runs.
const FIXED_DATE = new Date('2026-04-01T00:00:00.000Z')

const STABLE_PERSONA: PersonaProfile = {
  id: 'persona-fixed',
  personId: 'person-fixed',
  workspaceId: 'workspace-fixed',
  version: 1,
  status: 'active',
  systemPrompt: 'You are Eleanor, a piano teacher who raised three children.',
  writingStyle: {
    vocabulary: ['dear', 'lovely', 'remember'],
    sentencePatterns: ['Well, you see...'],
    tone: { warmth: 0.9, formality: 0.4, emotionalIntensity: 0.6, optimism: 0.7, humor: 0.5, storytelling: 0.8 },
    formality: FormalityLevel.NEUTRAL,
    averageSentenceLength: 14,
    commonPhrases: ['back in those days'],
    emotionIndicators: [],
  },
  knownFacts: [],
  relationships: [],
  responseGuidelines: [],
  customInstructions: {
    relationshipInstructions: {},
    behaviorInstructions: [],
    topicInstructions: {},
    contextInstructions: {},
    styleOverrides: {},
  },
  documentSampleCount: 0,
  confidenceScore: 0.8,
  lastUpdated: FIXED_DATE,
  createdAt: FIXED_DATE,
}

function makeDocument(overrides: Partial<RetrievedDocument> = {}): RetrievedDocument {
  return {
    id: 'r-1',
    documentId: 'doc-1',
    chunkId: 'chunk-1',
    content: 'Eleanor taught piano on Saturday mornings to children in the neighborhood.',
    metadata: {
      title: 'Saturday Lessons',
      source: 'memoir.pdf',
      chunkIndex: 0,
      totalChunks: 3,
      documentType: DocumentType.STORY,
      relevanceScore: 0.875,
      extractedAt: FIXED_DATE,
      embeddingModel: 'all-MiniLM-L6-v2',
      chunkSize: 512,
      overlapSize: 64,
    },
    ...overrides,
  }
}

describe('PromptBuilder — golden snapshots', () => {
  let builder: PromptBuilderImpl

  beforeEach(() => {
    builder = new PromptBuilderImpl()
  })

  describe('buildSystemPrompt — through buildPersonaPrompt', () => {
    it('produces the expected system prompt with no documents (refusal-only path)', async () => {
      const compiled = await builder.buildPersonaPrompt(STABLE_PERSONA, 'Tell me about your childhood.')
      expect(compiled.systemPrompt).toMatchSnapshot()
    })

    it('produces the expected system prompt with one retrieved document', async () => {
      const compiled = await builder.buildPrompt(STABLE_PERSONA, [makeDocument()], 'What did you do on Saturdays?', [])
      expect(compiled.systemPrompt).toMatchSnapshot()
    })

    it('produces the expected system prompt when responseGuidelines are present', async () => {
      const personaWithGuidelines: PersonaProfile = {
        ...STABLE_PERSONA,
        responseGuidelines: ['Speak warmly about students.', 'Avoid discussing finances.'],
      }
      const compiled = await builder.buildPrompt(personaWithGuidelines, [makeDocument()], 'Hello', [])
      expect(compiled.systemPrompt).toMatchSnapshot()
    })
  })

  describe('formatContext — through buildPrompt.context', () => {
    it('snapshots the citation-formatted context block for two documents', async () => {
      const docs = [
        makeDocument(),
        makeDocument({
          id: 'r-2',
          documentId: 'doc-2',
          chunkId: 'chunk-2',
          content: 'She was known for her infinite patience with beginners.',
          metadata: {
            title: 'Patient Teacher',
            source: 'tribute.txt',
            chunkIndex: 1,
            totalChunks: 4,
            documentType: DocumentType.STORY,
            relevanceScore: 0.812,
            extractedAt: FIXED_DATE,
            embeddingModel: 'all-MiniLM-L6-v2',
            chunkSize: 512,
            overlapSize: 64,
          },
        }),
      ]
      const compiled = await builder.buildPrompt(STABLE_PERSONA, docs, 'q', [])
      expect(compiled.context).toMatchSnapshot()
    })

    it('returns the explicit "no documents" sentinel when none retrieved', async () => {
      const compiled = await builder.buildPrompt(STABLE_PERSONA, [], 'q', [])
      expect(compiled.context).toMatchInlineSnapshot(`"No relevant documents found."`)
    })
  })

  describe('CompiledPrompt metadata shape', () => {
    it('exposes the expected metadata keys for buildPrompt', async () => {
      const compiled = await builder.buildPrompt(STABLE_PERSONA, [makeDocument()], 'q', [])
      expect(Object.keys(compiled.metadata).sort()).toMatchInlineSnapshot(`
[
  "contextLength",
  "historyLength",
  "maxTokens",
  "model",
  "releaseCandidateSpec",
  "repeatPenalty",
  "retrievedDocumentCount",
  "temperature",
  "topK",
  "topP",
]
`)
    })

    it('exposes the expected metadata keys for buildStyleAnalysisPrompt', async () => {
      const compiled = await builder.buildStyleAnalysisPrompt('sample text', 'tone')
      expect(Object.keys(compiled.metadata).sort()).toMatchInlineSnapshot(`
[
  "analysisType",
  "maxTokens",
  "model",
  "releaseCandidateSpec",
  "repeatPenalty",
  "temperature",
  "textLength",
  "topK",
  "topP",
]
`)
    })
  })

  describe('formatConversationHistory', () => {
    it('keeps the most recent turns and drops system messages by default', async () => {
      const history: ChatMessage[] = [
        { id: 'm0', sessionId: 's1', role: 'system', content: 'system note', metadata: {}, createdAt: FIXED_DATE },
        { id: 'm1', sessionId: 's1', role: 'user', content: 'first question', metadata: {}, createdAt: FIXED_DATE },
        { id: 'm2', sessionId: 's1', role: 'assistant', content: 'first answer', metadata: {}, createdAt: FIXED_DATE },
        { id: 'm3', sessionId: 's1', role: 'user', content: 'second question', metadata: {}, createdAt: FIXED_DATE },
      ]
      const compiled = await builder.buildPrompt(STABLE_PERSONA, [], 'follow-up', history)
      expect(compiled.history.map((m) => ({ role: m.role, content: m.content }))).toMatchInlineSnapshot(`
[
  {
    "content": "first question",
    "role": "user",
  },
  {
    "content": "first answer",
    "role": "assistant",
  },
  {
    "content": "second question",
    "role": "user",
  },
]
`)
    })
  })
})
