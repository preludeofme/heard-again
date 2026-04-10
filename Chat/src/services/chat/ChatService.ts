import {
  ChatSession,
  ChatMessage,
  CreateSessionRequest,
  SendMessageRequest,
  StreamChunk,
  StrictChatResponse,
  StrictAssistantEnvelope,
  PersonaResponseMode,
  EvidenceGate,
  DocumentType,
} from '@/types'
import { v4 as uuidv4 } from 'uuid'
import { PromptBuilderImpl } from './PromptBuilder'
import { EvidenceGateImpl } from './EvidenceGate'
import { runtimeSafetyMetricsCollector } from '@/services/monitoring/RuntimeSafetyMetrics'

const CANONICAL_REFUSAL_MESSAGE = "I don't have that documented in the materials I was given."
const DEBUG_CHAT_REFUSAL_PATHS = process.env.DEBUG_CHAT_REFUSAL_PATHS === 'true'
const CHAT_EVIDENCE_THRESHOLDS = {
  minTopScore: 0.12,
  minAvgTop3: 0.08,
  minSources: 1,
}

const REFUSAL_PREFIX_OPTIONS = [
  "I don't have that documented in the materials I was given.",
  'That detail isn\'t in the records I have available.',
  'I can\'t find that in the materials I was given.',
  "I don't recall that from the information I have.",
  "That's not something I have documented in my memories.",
  "I don't have any record of that in the materials I was given.",
  "That detail isn't mentioned in the information I have access to.",
  "I don't remember that being documented in my materials.",
  "I don't have that information in the records available to me.",
  "That's not something I can find in the materials I was given.",
  "I don't have any documentation about that.",
  "That isn't mentioned in the memories and facts I have.",
]

const TOKEN_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'about', 'what',
  'when', 'where', 'which', 'have', 'been', 'were', 'them', 'they', 'would', 'could',
  'should', 'into', 'over', 'under', 'then', 'than', 'also', 'just', 'you', 'are',
  'who', 'how', 'why', 'can', 'tell',
])

export interface ChatService {
  createSession(request: CreateSessionRequest): Promise<ChatSession>
  sendMessage(request: SendMessageRequest): Promise<StrictChatResponse>
  streamResponse(request: SendMessageRequest): Promise<AsyncIterable<StreamChunk>>
  getHistory(sessionId: string, limit?: number, offset?: number): Promise<ChatMessage[]>
  getSession(sessionId: string, userId?: string, workspaceId?: string): Promise<ChatSession | null>
  updateSession(sessionId: string, updates: Partial<ChatSession>): Promise<ChatSession>
  deleteSession(sessionId: string): Promise<void>
  listSessions(workspaceId: string, userId: string): Promise<ChatSession[]>
  storeUserMessage(sessionId: string, message: string): Promise<ChatMessage>
  updateAssistantMessage(messageId: string, content: string, metadata?: any): Promise<ChatMessage>
}

export class ChatServiceImpl implements ChatService {
  constructor(
    private chatRepository: ChatRepository,
    private retrievalService: RetrievalService,
    private personaService: PersonaService,
    private llmGateway: LLMGateway,
    private promptBuilder: PromptBuilderImpl = new PromptBuilderImpl(),
    private evidenceGate: EvidenceGate = new EvidenceGateImpl()
  ) {}

  async createSession(request: CreateSessionRequest): Promise<ChatSession> {
    const session: ChatSession = {
      id: uuidv4(),
      workspaceId: request.workspaceId,
      personId: request.personId,
      userId: request.userId,
      title: request.title,
      status: 'active',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    }

    return await this.chatRepository.createSession(session)
  }

  async sendMessage(request: SendMessageRequest): Promise<StrictChatResponse> {
    const startTime = Date.now()

    // Get session
    const session = await this.chatRepository.getSession(request.sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    // Get persona profile
    const personaProfile = await this.personaService.getPersonaProfile(session.personId, session.workspaceId)
    if (!personaProfile) {
      throw new Error('Persona profile not found')
    }

    // Store user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      sessionId: request.sessionId,
      role: 'user',
      content: request.message,
      metadata: {},
      createdAt: new Date()
    }

    await this.chatRepository.addMessage(userMessage)

    // Retrieve relevant documents
    const retrievedDocuments = await this.retrievalService.searchDocuments(
      request.message,
      {
        workspaceId: session.workspaceId,
        personId: session.personId,
        maxResults: request.options?.maxRetrievedDocuments ?? 5
      }
    )

    const evidenceDocuments = this.buildEvidenceDocuments(
      request.message,
      retrievedDocuments,
      personaProfile
    )

    const evidencePacket = this.evidenceGate.buildEvidencePacket(
      request.message,
      {
        workspaceId: session.workspaceId,
        personId: session.personId,
        maxResults: request.options?.maxRetrievedDocuments ?? 5
      },
      evidenceDocuments,
      CHAT_EVIDENCE_THRESHOLDS
    )

    this.logRefusalDebug('sendMessage.evidenceGate', {
      sessionId: request.sessionId,
      retrievedDocumentCount: retrievedDocuments.length,
      evidenceDocumentCount: evidenceDocuments.length,
      rawTopScore: retrievedDocuments[0]?.metadata.relevanceScore ?? 0,
      topScore: evidencePacket.items[0]?.relevanceScore ?? 0,
      avgTop3: this.average(evidencePacket.items.slice(0, 3).map(item => item.relevanceScore)),
      distinctSources: new Set(evidencePacket.items.map(item => item.source)).size,
      thresholds: evidencePacket.thresholds,
      passed: evidencePacket.passed,
      messagePreview: this.debugPreview(request.message),
    })

    if (!evidencePacket.passed) {
      this.logRefusalDebug('sendMessage.refusal', {
        sessionId: request.sessionId,
        reason: 'EVIDENCE_GATE_FAILED',
        retrievedDocumentCount: retrievedDocuments.length,
      })

      const refusalAnswer = this.buildRefusalMessage(personaProfile, request.message)

      const refusalEnvelope: StrictAssistantEnvelope = {
        mode: 'INSUFFICIENT_EVIDENCE',
        answer: refusalAnswer,
        citations: [],
        confidence: 0,
        validation: {
          isValid: true,
          violations: []
        }
      }

      const refusalMessage: ChatMessage = {
        id: uuidv4(),
        sessionId: request.sessionId,
        role: 'assistant',
        content: refusalEnvelope.answer,
        metadata: {
          processingTime: Date.now() - startTime,
          retrievedDocuments: evidenceDocuments,
          tokenCount: 0
        },
        createdAt: new Date()
      }

      await this.chatRepository.addMessage(refusalMessage)

      runtimeSafetyMetricsCollector.recordOutcome({
        retrievedDocumentCount: retrievedDocuments.length,
        refusalApplied: true,
        hadViolations: false,
        citationCount: 0,
      })

      return {
        message: refusalMessage,
        sessionId: request.sessionId,
        metadata: {
          processingTime: Date.now() - startTime,
          retrievedDocumentCount: evidenceDocuments.length,
          llmModel: 'none',
          tokensUsed: 0,
          evidencePassed: false,
          refusalApplied: true,
          responseMode: 'INSUFFICIENT_EVIDENCE'
        },
        envelope: refusalEnvelope
      }
    }

    // Build prompt
    const prompt = await this.promptBuilder.buildPrompt(
      personaProfile,
      evidenceDocuments,
      request.message,
      await this.getHistory(request.sessionId, 10, 0, session.workspaceId)
    )

    // Generate response
    const llmResponse = await this.llmGateway.generateResponse(prompt)

    // Prepare document content for validation context
    const documentContents = evidenceDocuments.map(d => `${d.metadata.title}: ${d.content}`)
    
    // Validate response for injection / PII / hallucinations before returning to caller
    const validated = await this.llmGateway.validateResponse(llmResponse.content, {
      documents: documentContents,
      knownFacts: personaProfile.knownFacts?.map(f => f.fact) || []
    })

    const modelReturnedCanonicalRefusal = this.isCanonicalRefusal(llmResponse.content)
    
    const hasHighViolation = validated.violations.some(v => v.severity === 'high')
    const hasHallucination = validated.violations.some(v => 
      v.type === 'potential_hallucination' || v.type === 'unsupported_claim'
    )

    const validationSummary = {
      isValid: validated.isValid,
      violations: validated.violations.map(v => ({
        type: v.type,
        severity: v.severity,
        description: v.description
      }))
    }

    const supportedCitations = this.evidenceGate.toCitations(evidencePacket, 3)
    
    if (hasHighViolation || hasHallucination) {
      console.error('[SEC/HALLUCINATION] Violation detected — logging details', {
        sessionId: request.sessionId,
        violations: validated.violations.map(v => ({ type: v.type, severity: v.severity, desc: v.description }))
      })
    }
    
    // Determine safe content:
    // - High-severity and hallucination violations: canonical refusal
    // - Medium violations: use filtered content
    // - Valid: use original content
    let safeContent: string
    let responseMode: PersonaResponseMode = 'FACT_SUPPORTED'
    let refusalApplied = false
    let refusalReason: string | null = null

    if (hasHighViolation || hasHallucination) {
      safeContent = this.buildRefusalMessage(personaProfile, request.message)
      responseMode = 'INSUFFICIENT_EVIDENCE'
      refusalApplied = true
      refusalReason = hasHighViolation ? 'VALIDATION_HIGH_VIOLATION' : 'VALIDATION_HALLUCINATION'
    } else if (!validated.isValid) {
      safeContent = validated.filteredContent ?? llmResponse.content
    } else {
      safeContent = llmResponse.content
    }

    if (!refusalReason && this.isCanonicalRefusal(safeContent)) {
      refusalReason = modelReturnedCanonicalRefusal
        ? 'MODEL_RETURNED_CANONICAL_REFUSAL'
        : 'FILTERED_TO_CANONICAL_REFUSAL'
    }

    this.logRefusalDebug('sendMessage.decision', {
      sessionId: request.sessionId,
      responseMode,
      refusalApplied,
      refusalReason,
      modelReturnedCanonicalRefusal,
      validatedIsValid: validated.isValid,
      violationTypes: validated.violations.map(v => v.type),
      violationSeverities: validated.violations.map(v => v.severity),
      llmResponsePreview: this.debugPreview(llmResponse.content),
      safeContentPreview: this.debugPreview(safeContent),
      citationCount: responseMode === 'INSUFFICIENT_EVIDENCE' ? 0 : supportedCitations.length,
    })

    const envelope: StrictAssistantEnvelope = {
      mode: responseMode,
      answer: safeContent,
      citations: responseMode === 'INSUFFICIENT_EVIDENCE' ? [] : supportedCitations,
      confidence: responseMode === 'INSUFFICIENT_EVIDENCE'
        ? 0
        : Math.max(0, Math.min(1, evidencePacket.items[0]?.relevanceScore ?? 0)),
      validation: validationSummary
    }

    // Store assistant message
    const assistantMessage: ChatMessage = {
      id: uuidv4(),
      sessionId: request.sessionId,
      role: 'assistant',
      content: safeContent,
      metadata: {
        processingTime: Date.now() - startTime,
        retrievedDocuments: evidenceDocuments,
        tokenCount: llmResponse.metadata.totalTokens
      },
      createdAt: new Date()
    }

    await this.chatRepository.addMessage(assistantMessage)

    runtimeSafetyMetricsCollector.recordOutcome({
      retrievedDocumentCount: retrievedDocuments.length,
      refusalApplied,
      hadViolations: validated.violations.length > 0,
      citationCount: envelope.citations.length,
    })

    return {
      message: assistantMessage,
      sessionId: request.sessionId,
      metadata: {
        processingTime: Date.now() - startTime,
        retrievedDocumentCount: evidenceDocuments.length,
        llmModel: llmResponse.metadata.model,
        tokensUsed: llmResponse.metadata.totalTokens,
        evidencePassed: true,
        refusalApplied,
        responseMode
      },
      envelope
    }
  }

  async getHistory(sessionId: string, limit?: number, offset?: number, workspaceId?: string): Promise<ChatMessage[]> {
    const actualLimit = limit ?? 50
    const actualOffset = offset ?? 0
    return await this.chatRepository.getMessages(sessionId, actualLimit, actualOffset, undefined, workspaceId)
  }

  async getSession(sessionId: string, userId?: string, workspaceId?: string): Promise<ChatSession | null> {
    return await this.chatRepository.getSession(sessionId, userId, workspaceId)
  }

  async updateSession(sessionId: string, updates: Partial<ChatSession>): Promise<ChatSession> {
    const session = await this.chatRepository.getSession(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    const updatedSession = {
      ...session,
      ...updates,
      updatedAt: new Date()
    }

    return await this.chatRepository.updateSession(updatedSession)
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.chatRepository.deleteSession(sessionId)
  }

  async listSessions(workspaceId: string, userId: string): Promise<ChatSession[]> {
    return await this.chatRepository.listSessions(workspaceId, userId)
  }

  async streamResponse(request: SendMessageRequest): Promise<AsyncIterable<StreamChunk>> {
    const startTime = Date.now()

    // Get session
    const session = await this.chatRepository.getSession(request.sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    // Get persona profile
    const personaProfile = await this.personaService.getPersonaProfile(session.personId, session.workspaceId)
    if (!personaProfile) {
      throw new Error('Persona profile not found')
    }

    // Retrieve relevant documents
    const retrievedDocuments = await this.retrievalService.searchDocuments(
      request.message,
      {
        workspaceId: session.workspaceId,
        personId: session.personId,
        maxResults: request.options?.maxRetrievedDocuments ?? 5
      }
    )

    const evidenceDocuments = this.buildEvidenceDocuments(
      request.message,
      retrievedDocuments,
      personaProfile
    )

    const evidencePacket = this.evidenceGate.buildEvidencePacket(
      request.message,
      {
        workspaceId: session.workspaceId,
        personId: session.personId,
        maxResults: request.options?.maxRetrievedDocuments ?? 5
      },
      evidenceDocuments,
      CHAT_EVIDENCE_THRESHOLDS
    )

    this.logRefusalDebug('streamResponse.evidenceGate', {
      sessionId: request.sessionId,
      retrievedDocumentCount: retrievedDocuments.length,
      evidenceDocumentCount: evidenceDocuments.length,
      rawTopScore: retrievedDocuments[0]?.metadata.relevanceScore ?? 0,
      topScore: evidencePacket.items[0]?.relevanceScore ?? 0,
      avgTop3: this.average(evidencePacket.items.slice(0, 3).map(item => item.relevanceScore)),
      distinctSources: new Set(evidencePacket.items.map(item => item.source)).size,
      thresholds: evidencePacket.thresholds,
      passed: evidencePacket.passed,
      messagePreview: this.debugPreview(request.message),
    })

    if (!evidencePacket.passed) {
      const messageId = uuidv4()

      this.logRefusalDebug('streamResponse.refusal', {
        sessionId: request.sessionId,
        messageId,
        reason: 'EVIDENCE_GATE_FAILED',
        retrievedDocumentCount: retrievedDocuments.length,
      })

      const refusalContent = this.buildRefusalMessage(personaProfile, request.message)

      const refusalMessage: ChatMessage = {
        id: messageId,
        sessionId: request.sessionId,
        role: 'assistant',
        content: refusalContent,
        metadata: {
          processingTime: Date.now() - startTime,
          retrievedDocuments: evidenceDocuments,
          tokenCount: 0
        },
        createdAt: new Date()
      }

      await this.chatRepository.addMessage(refusalMessage)

      runtimeSafetyMetricsCollector.recordOutcome({
        retrievedDocumentCount: retrievedDocuments.length,
        refusalApplied: true,
        hadViolations: false,
        citationCount: 0,
      })

      return this.createRefusalStreamGenerator(
        messageId,
        startTime,
        evidenceDocuments.length,
        refusalContent
      )
    }

    // Build prompt
    const prompt = await this.promptBuilder.buildPrompt(
      personaProfile,
      evidenceDocuments,
      request.message,
      await this.getHistory(request.sessionId, 10, 0, session.workspaceId)
    )

    // Generate streaming response
    const supportedCitationCount = this.evidenceGate.toCitations(evidencePacket, 3).length
    const messageId = uuidv4()
    
    // Create assistant message placeholder immediately
    const assistantMessage: ChatMessage = {
      id: messageId,
      sessionId: request.sessionId,
      role: 'assistant',
      content: '',
      metadata: {
        processingTime: 0,
        retrievedDocuments: evidenceDocuments,
        tokenCount: 0
      },
      createdAt: new Date()
    }
    await this.chatRepository.addMessage(assistantMessage)
    
    return this.createStreamGenerator(
      messageId,
      prompt,
      startTime,
      evidenceDocuments,
      personaProfile,
      supportedCitationCount,
      retrievedDocuments.length
    )
  }

  async storeUserMessage(sessionId: string, message: string): Promise<ChatMessage> {
    const userMessage: ChatMessage = {
      id: uuidv4(),
      sessionId,
      role: 'user',
      content: message,
      metadata: {},
      createdAt: new Date()
    }

    return await this.chatRepository.addMessage(userMessage)
  }

  async updateAssistantMessage(messageId: string, content: string, metadata?: any): Promise<ChatMessage> {
    const updated = await this.chatRepository.updateMessage(messageId, content, metadata)
    if (!updated) {
      throw new Error(`Message ${messageId} not found`)
    }
    return updated
  }

  private async* createStreamGenerator(
    messageId: string,
    prompt: CompiledPrompt,
    startTime: number,
    retrievedDocuments: RetrievedDocument[],
    personaProfile: PersonaProfile,
    supportedCitationCount: number,
    retrievedDocumentCountForMetrics: number
  ): AsyncIterable<StreamChunk> {
    try {
      yield {
        type: 'start',
        messageId,
        metadata: {
          startTime,
          retrievedDocumentCount: retrievedDocuments.length
        }
      }

      // Generate streaming response — collect full content for end-of-stream validation
      const stream = await this.llmGateway.streamResponse(prompt)
      let fullContent = ''

      for await (const chunk of stream) {
        fullContent += chunk
        yield {
          type: 'chunk',
          messageId,
          content: chunk,
          metadata: {
            processingTime: Date.now() - startTime
          }
        }
      }

      // SEC-6: Validate assembled response before storing with context for hallucination detection
      const documentContents = retrievedDocuments.map(d => `${d.metadata.title}: ${d.content}`)
      const validated = await this.llmGateway.validateResponse(fullContent, {
        documents: documentContents,
        knownFacts: personaProfile.knownFacts?.map((f: { fact: string }) => f.fact) || []
      })
      
      const hasHighViolation = validated.violations.some(v => v.severity === 'high')
      const hasHallucination = validated.violations.some(v => 
        v.type === 'potential_hallucination' || v.type === 'unsupported_claim'
      )
      const modelReturnedCanonicalRefusal = this.isCanonicalRefusal(fullContent)
      
      if (hasHighViolation || hasHallucination) {
        console.error('[SEC/HALLUCINATION] Stream violation detected', {
          messageId,
          violations: validated.violations.map(v => ({ type: v.type, severity: v.severity }))
        })
      }

      // Determine safe content with deterministic hallucination handling
      let safeStreamContent: string | undefined
      let refusalApplied = false
      if (hasHighViolation || hasHallucination) {
        safeStreamContent = this.buildRefusalMessage(personaProfile, prompt.userMessage)
        refusalApplied = true
      } else if (!validated.isValid) {
        safeStreamContent = validated.filteredContent ?? fullContent
      } else {
        safeStreamContent = undefined // Use streamed content
      }

      const citationCount = refusalApplied ? 0 : supportedCitationCount
      const finalContent = safeStreamContent ?? fullContent

      let refusalReason: string | null = null
      if (hasHighViolation || hasHallucination) {
        refusalReason = hasHighViolation ? 'VALIDATION_HIGH_VIOLATION' : 'VALIDATION_HALLUCINATION'
      } else if (this.isCanonicalRefusal(finalContent)) {
        refusalReason = modelReturnedCanonicalRefusal
          ? 'MODEL_RETURNED_CANONICAL_REFUSAL'
          : 'FILTERED_TO_CANONICAL_REFUSAL'
      }

      this.logRefusalDebug('streamResponse.decision', {
        messageId,
        refusalApplied,
        refusalReason,
        modelReturnedCanonicalRefusal,
        validatedIsValid: validated.isValid,
        violationTypes: validated.violations.map(v => v.type),
        violationSeverities: validated.violations.map(v => v.severity),
        streamedContentPreview: this.debugPreview(fullContent),
        finalContentPreview: this.debugPreview(finalContent),
        citationCount,
      })

      runtimeSafetyMetricsCollector.recordOutcome({
        retrievedDocumentCount: retrievedDocumentCountForMetrics,
        refusalApplied,
        hadViolations: validated.violations.length > 0,
        citationCount,
      })

      yield {
        type: 'end',
        messageId,
        metadata: {
          totalProcessingTime: Date.now() - startTime,
          totalTokens: 0,
          filteredContent: safeStreamContent
        }
      }
    } catch (error) {
      yield {
        type: 'error',
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          processingTime: Date.now() - startTime
        }
      }
    }
  }

  private async* createRefusalStreamGenerator(
    messageId: string,
    startTime: number,
    retrievedDocumentCount: number,
    refusalContent: string
  ): AsyncIterable<StreamChunk> {
    yield {
      type: 'start',
      messageId,
      metadata: {
        startTime,
        retrievedDocumentCount
      }
    }

    yield {
      type: 'chunk',
      messageId,
      content: refusalContent,
      metadata: {
        processingTime: Date.now() - startTime
      }
    }

    yield {
      type: 'end',
      messageId,
      metadata: {
        totalProcessingTime: Date.now() - startTime,
        totalTokens: 0,
        filteredContent: refusalContent
      }
    }
  }

  private buildEvidenceDocuments(
    userMessage: string,
    retrievedDocuments: RetrievedDocument[],
    personaProfile: PersonaProfile
  ): RetrievedDocument[] {
    const normalizedRetrievedDocuments = retrievedDocuments.map((doc) => ({
      ...doc,
      metadata: {
        ...doc.metadata,
        relevanceScore: this.normalizeEvidenceScore(doc.metadata.relevanceScore),
      },
    }))

    return [
      ...normalizedRetrievedDocuments,
      ...this.buildPersonaEvidenceDocuments(userMessage, personaProfile),
    ]
  }

  private buildPersonaEvidenceDocuments(
    userMessage: string,
    personaProfile: PersonaProfile
  ): RetrievedDocument[] {
    const personaFacts = new Set<string>()

    if (personaProfile.displayName) {
      personaFacts.add(`My name is ${personaProfile.displayName}.`)
    }

    for (const fact of personaProfile.knownFacts ?? []) {
      if (fact.verified || fact.confidence >= 0.6) {
        personaFacts.add(fact.fact)
      }

      if (personaFacts.size >= 8) {
        break
      }
    }

    const factList = Array.from(personaFacts)
    const extractedAt = new Date()

    return factList.map((fact, index) => ({
      id: `persona_fact_${personaProfile.personId}_${index}`,
      documentId: `persona_profile_${personaProfile.personId}`,
      chunkId: `persona_fact_${index}`,
      content: fact,
      metadata: {
        title: personaProfile.displayName
          ? `${personaProfile.displayName} profile facts`
          : 'Persona profile facts',
        source: 'persona_profile',
        chunkIndex: index,
        totalChunks: factList.length,
        personId: personaProfile.personId,
        documentType: DocumentType.OTHER,
        relevanceScore: this.computePersonaFactRelevance(userMessage, fact),
        extractedAt,
        embeddingModel: 'persona-facts',
        chunkSize: fact.length,
        overlapSize: 0,
      }
    }))
  }

  private normalizeEvidenceScore(rawScore: number): number {
    if (!Number.isFinite(rawScore)) {
      return 0
    }

    if (rawScore >= 0 && rawScore <= 1) {
      return rawScore
    }

    const inferredDistance = Math.max(0, 1 - rawScore)
    return 1 / (1 + inferredDistance)
  }

  private computePersonaFactRelevance(userMessage: string, fact: string): number {
    const normalizedMessage = userMessage.toLowerCase()
    const normalizedFact = fact.toLowerCase()

    if (this.isIdentityQuestion(normalizedMessage) && normalizedFact.includes('name')) {
      return 0.95
    }

    const messageTokens = this.tokenize(normalizedMessage)
    if (messageTokens.length === 0) {
      return 0.15
    }

    const factTokens = new Set(this.tokenize(normalizedFact))
    const overlapCount = messageTokens.filter(token => factTokens.has(token)).length
    const overlapRatio = overlapCount / messageTokens.length

    return Math.max(0.08, Math.min(0.9, overlapRatio))
  }

  private buildRefusalMessage(personaProfile: PersonaProfile, userMessage: string): string {
    const topics = this.getRefusalTopics(personaProfile)
    const topicSummary = topics.length > 0
      ? topics.slice(0, 2).join(' or ')
      : 'the memories and facts I do have'
    const prefix = REFUSAL_PREFIX_OPTIONS[Math.floor(Math.random() * REFUSAL_PREFIX_OPTIONS.length)]

    if (this.isIdentityQuestion(userMessage.toLowerCase()) && personaProfile.displayName) {
      return `You are talking to ${personaProfile.displayName}. ${prefix} Ask me about ${topicSummary}.`
    }

    return `${prefix} Ask me about ${topicSummary}.`
  }

  private getRefusalTopics(personaProfile: PersonaProfile): string[] {
    const topics = new Set<string>()
    const facts = personaProfile.knownFacts ?? []

    // Check for specific biographical facts
    if (facts.some(fact => fact.type === 'biographical' && fact.fact.toLowerCase().includes('born'))) {
      topics.add('when and where I was born')
    } else if (facts.some(fact => fact.type === 'biographical')) {
      topics.add('my background')
    }

    // Check for work/career facts
    if (facts.some(fact => fact.fact.toLowerCase().match(/work|job|career|plumber/))) {
      topics.add('my work as a plumber')
    }

    // Check for family relationships
    if (facts.some(fact => fact.type === 'relationship')) {
      if (facts.some(fact => fact.fact.toLowerCase().includes('wife'))) {
        topics.add('my wife')
      }
      if (facts.some(fact => fact.fact.toLowerCase().includes('children'))) {
        topics.add('my children')
      }
      topics.add('my family')
    }

    // Check for specific experiences
    if (facts.some(fact => fact.type === 'experience')) {
      if (facts.some(fact => fact.fact.toLowerCase().match(/childhood|grew up/))) {
        topics.add('my childhood')
      }
      topics.add('stories from my life')
    }

    // Check for achievements
    if (facts.some(fact => fact.type === 'achievement')) {
      topics.add('things I accomplished')
    }

    // Check for preferences
    if (facts.some(fact => fact.type === 'preference')) {
      topics.add('what I liked')
    }

    // Fallback if no specific topics found
    if (topics.size === 0 && facts.length > 0) {
      topics.add('the memories and facts I do have')
    }

    return Array.from(topics)
  }

  private isIdentityQuestion(userMessage: string): boolean {
    return /(who are you|what(?:'s| is) your name|who am i talking to|tell me about yourself)/i.test(userMessage)
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2 && !TOKEN_STOP_WORDS.has(token))
  }

  private logRefusalDebug(event: string, payload: Record<string, unknown>): void {
    if (!DEBUG_CHAT_REFUSAL_PATHS) {
      return
    }

    console.info(`[CHAT_REFUSAL_DEBUG] ${event}`, payload)
  }

  private isCanonicalRefusal(content: string): boolean {
    return content.trim().toLowerCase() === CANONICAL_REFUSAL_MESSAGE.toLowerCase()
  }

  private debugPreview(content: string, maxLength: number = 180): string {
    const normalized = content.replace(/\s+/g, ' ').trim()
    if (normalized.length <= maxLength) {
      return normalized
    }

    return `${normalized.slice(0, maxLength)}...`
  }

  private average(values: number[]): number {
    if (values.length === 0) {
      return 0
    }

    const total = values.reduce((sum, value) => sum + value, 0)
    return total / values.length
  }

  private async buildPrompt(
    personaProfile: PersonaProfile,
    retrievedDocuments: RetrievedDocument[],
    userMessage: string,
    chatHistory: ChatMessage[]
  ): Promise<CompiledPrompt> {
    return await this.promptBuilder.buildPrompt(
      personaProfile,
      retrievedDocuments,
      userMessage,
      chatHistory
    )
  }

  private formatContext(documents: RetrievedDocument[]): string {
    return documents
      .map((doc, index) => {
        return `[Document ${index + 1}]: ${doc.metadata.title}\n${doc.content}`
      })
      .join('\n\n')
  }
}

// Repository interface for data access
export interface ChatRepository {
  createSession(session: ChatSession): Promise<ChatSession>
  getSession(sessionId: string, userId?: string, workspaceId?: string): Promise<ChatSession | null>
  updateSession(session: ChatSession): Promise<ChatSession>
  deleteSession(sessionId: string): Promise<void>
  listSessions(workspaceId: string, userId: string): Promise<ChatSession[]>
  addMessage(message: ChatMessage): Promise<ChatMessage>
  updateMessage(messageId: string, content: string, metadata?: any): Promise<ChatMessage | null>
  getMessages(sessionId: string, limit?: number, offset?: number, userId?: string, workspaceId?: string): Promise<ChatMessage[]>
}

// Import types (these will be resolved when we implement the other services)
import type { RetrievedDocument } from '@/types/retrieval'
import type { PersonaProfile } from '@/types/persona'
import type { CompiledPrompt } from '@/types/llm'
import type { RetrievalService } from '@/types/retrieval'
import type { PersonaService } from '@/types/persona'
import type { LLMGateway } from '@/types/llm'

// Import actual implementations for the ServiceFactory to work
import { RetrievalServiceImpl } from '../retrieval/RetrievalService'
import { PersonaServiceImpl } from '../persona/PersonaService'
import { LLMGatewayImpl } from '../llm/LLMGateway'
