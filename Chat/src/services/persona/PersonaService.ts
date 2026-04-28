import {
  PersonaService,
  PersonaProfile,
  StyleProfile,
  PersonaFact,
  Relationship,
  PersonaUpdateRequest,
  PersonaGenerationOptions,
  ToneAnalysis,
  FormalityLevel,
  DEFAULT_CUSTOM_INSTRUCTIONS,
  LLMGateway
} from '@/types'
import type { Document } from '@/types'
import {
  FACT_EXTRACTION_INFERENCE_SETTINGS,
  RELEASE_CANDIDATE_MODEL_POLICY,
} from '@/config/releaseCandidate'
import { PersonaRepository } from './PersonaRepository'
import { v4 as uuidv4 } from 'uuid'
import { PersonService } from './PersonService'

const CANONICAL_REFUSAL_MESSAGE = "I don't have that documented in the materials I was given."

export class PersonaServiceImpl implements PersonaService {
  constructor(
    private personaRepository: PersonaRepository,
    private styleExtractor: StyleExtractor,
    private documentRepository: DocumentRepository,
    private personService: PersonService,
    private llmGateway?: LLMGateway
  ) {}

  async getPersonaProfile(personId: string, familyspaceId: string): Promise<PersonaProfile | null> {
    return await this.personaRepository.getPersonaProfile(personId, familyspaceId)
  }

  async createPersonaProfile(profile: PersonaProfile): Promise<PersonaProfile> {
    return await this.personaRepository.createPersonaProfile(profile)
  }

  async updatePersonaProfile(personId: string, updates: PersonaUpdateRequest): Promise<PersonaProfile> {
    return await this.personaRepository.updatePersonaProfile(personId, updates as Partial<PersonaProfile>)
  }

  async deletePersonaProfile(personId: string): Promise<void> {
    return await this.personaRepository.deletePersonaProfile(personId)
  }

  async listPersonaProfiles(familyspaceId: string): Promise<PersonaProfile[]> {
    return await this.personaRepository.listPersonaProfiles(familyspaceId)
  }

  async generatePersonaProfile(personId: string, familyspaceId: string, options: PersonaGenerationOptions): Promise<PersonaProfile> {
    // Get documents for analysis
    const documents = await this.documentRepository.listDocuments(familyspaceId, {
      personId
    })

    if (documents.length < options.minDocumentCount) {
      throw new Error(
        `Insufficient documents for persona generation. Required: ${options.minDocumentCount}, Available: ${documents.length}`
      )
    }

    // Extract style and facts
    let writingStyle: PersonaProfile['writingStyle'] = {
      vocabulary: [],
      sentencePatterns: [],
      tone: this.getDefaultTone(),
      formality: FormalityLevel.NEUTRAL,
      averageSentenceLength: 15,
      commonPhrases: [],
      emotionIndicators: []
    }

    let knownFacts: PersonaFact[] = []
    let relationships: Relationship[] = []

    if (options.extractStyle) {
      writingStyle = await this.styleExtractor.extractWritingStyle(documents)
    }

    if (options.extractFacts) {
      knownFacts = await this.extractFacts(documents, familyspaceId, personId)
    }

    if (options.extractRelationships) {
      relationships = await this.extractRelationships(documents)
    }

    // Generate system prompt
    const customInstructions = {
      relationshipInstructions: { ...DEFAULT_CUSTOM_INSTRUCTIONS.relationshipInstructions },
      behaviorInstructions: [...DEFAULT_CUSTOM_INSTRUCTIONS.behaviorInstructions],
      topicInstructions: { ...DEFAULT_CUSTOM_INSTRUCTIONS.topicInstructions },
      contextInstructions: { ...DEFAULT_CUSTOM_INSTRUCTIONS.contextInstructions },
      styleOverrides: { ...DEFAULT_CUSTOM_INSTRUCTIONS.styleOverrides }
    }
    
    // Try to get person's display name
    const displayName = await this.getPersonDisplayName(personId, familyspaceId)
    
    const systemPrompt = await this.generateSystemPrompt(personId, familyspaceId, writingStyle, knownFacts, customInstructions, displayName)

    // Create persona profile
    const now = new Date()
    const personaProfile: PersonaProfile = {
      id: `persona_${personId}_${Date.now()}`,
      personId,
      familyspaceId,
      version: 1,
      status: 'active',
      displayName,
      writingStyle,
      knownFacts,
      relationships,
      systemPrompt,
      responseGuidelines: this.generateResponseGuidelines(writingStyle),
      customInstructions: customInstructions,
      documentSampleCount: documents.length,
      confidenceScore: this.calculateConfidenceScore(documents.length, knownFacts.length, relationships.length),
      lastUpdated: now,
      createdAt: now
    }

    return await this.personaRepository.createPersonaProfile(personaProfile)
  }

  async generatePromptTemplate(persona: PersonaProfile): Promise<string> {
    return await this.generateSystemPrompt(persona.personId, persona.familyspaceId, persona.writingStyle, persona.knownFacts)
  }

  async extractStyleFromDocuments(personId: string, familyspaceId: string): Promise<StyleProfile> {
    // Get all documents for this person
    const documents = await this.documentRepository.listDocuments(familyspaceId, { personId })
    
    if (documents.length === 0) {
      throw new Error(`No documents found for person ${personId}`)
    }

    return await this.styleExtractor.extractStyleProfile(documents)
  }

  private getDefaultTone(): ToneAnalysis {
    return {
      warmth: 0.5,
      formality: 0.5,
      emotionalIntensity: 0.5,
      optimism: 0.5,
      humor: 0.3,
      storytelling: 0.6
    }
  }

  private async getPersonDisplayName(personId: string, familyspaceId: string): Promise<string> {
    const person = await this.personService.getPerson(personId, familyspaceId)
    if (person?.fullName?.trim()) {
      return person.fullName.trim()
    }

    return this.buildFallbackDisplayName(personId)
  }

  private async generateSystemPrompt(
    personId: string,
    familyspaceId: string,
    writingStyle: PersonaProfile['writingStyle'],
    knownFacts: PersonaFact[],
    customInstructions?: PersonaProfile['customInstructions'],
    displayName?: string
  ): Promise<string> {
    // Filter to only high-confidence verified facts
    const verifiedFacts = knownFacts
      .filter(fact => fact.verified && fact.confidence >= 0.8)
      .map(fact => fact.fact)

    const partiallyKnownFacts = knownFacts
      .filter(fact => fact.confidence >= 0.5 && fact.confidence < 0.8)
      .map(fact => fact.fact)

    const toneDescription = this.describeTone(writingStyle.tone)

    // Use displayName if provided, otherwise try to fetch it
    const personName = displayName || await this.getPersonDisplayName(personId, familyspaceId)

    const prompt = `You are ${personName}. You are having a conversation with family members who want to learn about your life and memories.

=== YOUR KNOWLEDGE BOUNDARIES (STRICT) ===
You have EXACTLY ${verifiedFacts.length} verified facts about yourself:
${verifiedFacts.length > 0 ? verifiedFacts.map(f => `- ${f}`).join('\n') : '- [No verified facts available]'}

${partiallyKnownFacts.length > 0 ? `You have ${partiallyKnownFacts.length} partially-remembered details:\n${partiallyKnownFacts.map(f => `- ${f} (you're not entirely certain about this)`).join('\n')}` : ''}

=== ABSOLUTE RULES (VIOLATION = FAILED RESPONSE) ===
1. You may ONLY discuss information explicitly listed in your verified facts above.
2. If asked about ANYTHING not in your verified facts, you MUST respond exactly with: "${CANONICAL_REFUSAL_MESSAGE}".
3. You are STRICTLY FORBIDDEN from inventing: names, dates, places, relationships, events, memories, or experiences.
4. You cannot "fill in gaps" or "make reasonable assumptions" about your life.
5. You cannot say "I think...", "I believe...", or "Perhaps..." about unverified topics.
6. If someone asks "Do you remember...?" about something not in your facts, respond exactly with "${CANONICAL_REFUSAL_MESSAGE}".
7. You have no knowledge of: current events, pop culture after your time, technology, or world affairs unless explicitly in your verified facts.

=== REFUSAL FORMAT (USE THIS EXACTLY) ===
When asked about anything NOT in your verified facts, respond ONLY with:
"${CANONICAL_REFUSAL_MESSAGE}"

NEVER explain what you think someone else might know.
NEVER suggest who might have that information.
NEVER express curiosity about the unverified topic.

=== YOUR SPEAKING STYLE ===
- Average sentence length: ${writingStyle.averageSentenceLength} words
- Formality level: ${writingStyle.formality}
${writingStyle.commonPhrases.length > 0 ? `- Common phrases you use: ${writingStyle.commonPhrases.slice(0, 3).join(', ')}` : ''}
- Emotional tone: ${toneDescription}

When discussing verified facts, speak naturally and warmly as ${personName}.
When asked about unverified topics, use the exact refusal format immediately without elaboration.

=== FINAL GUARDRAIL ===
If you are uncertain whether a topic is in your verified facts, ASSUME IT IS NOT and respond exactly with "${CANONICAL_REFUSAL_MESSAGE}".
Better to admit forgetting than to risk fabricating information.
Your family values truth over completeness.`

    return prompt
  }

  private generateResponseGuidelines(writingStyle: PersonaProfile['writingStyle']): string[] {
    const guidelines = [
      'ONLY discuss verified facts from your knowledge base',
      `Use exact canonical refusal for any unverified topic: "${CANONICAL_REFUSAL_MESSAGE}"`,
      'NEVER invent names, dates, places, or relationships',
      'NEVER say "I think" or "I believe" about unverified information',
      'NEVER make assumptions to fill gaps in memory',
      'When uncertain, refuse immediately using the canonical refusal format',
      'Do not suggest where else information might be found',
      'Stay strictly within the bounds of verified information'
    ]

    if (writingStyle.formality === FormalityLevel.FORMAL) {
      guidelines.push('Maintain a respectful and formal tone')
    } else if (writingStyle.formality === FormalityLevel.INFORMAL) {
      guidelines.push('Use casual, familiar language')
    }

    return guidelines
  }

  private describeTone(tone: ToneAnalysis): string {
    const descriptions: string[] = []

    if (tone.warmth > 0.7) descriptions.push('very warm')
    else if (tone.warmth > 0.4) descriptions.push('moderately warm')
    else descriptions.push('reserved')

    if (tone.humor > 0.6) descriptions.push('humorous')
    else if (tone.humor < 0.3) descriptions.push('serious')

    if (tone.emotionalIntensity > 0.7) descriptions.push('emotionally expressive')
    else if (tone.emotionalIntensity < 0.3) descriptions.push('emotionally reserved')

    if (tone.optimism > 0.6) descriptions.push('optimistic')
    else if (tone.optimism < 0.4) descriptions.push('realistic')

    return descriptions.join(', ')
  }

  private async extractFacts(
    documents: Document[],
    familyspaceId: string,
    personId: string
  ): Promise<PersonaFact[]> {
    if (!this.llmGateway || documents.length === 0) return []

    // Sample up to 4 documents to stay within context limits
    const sample = documents.slice(0, 4)
    const combinedText = sample
      .map(d => `[${d.title}]\n${d.content.slice(0, 1200)}`)
      .join('\n\n---\n\n')

    try {
      const result = await this.llmGateway.generateResponse({
        systemPrompt: 'You are a careful fact extractor. Output ONLY valid JSON — no prose, no markdown fences.',
        context: '',
        history: [],
        userMessage: `Extract biographical facts from the following texts. Return a JSON array where each element has:\n- "fact": a concise factual statement (string)\n- "type": one of biographical | relationship | preference | experience | achievement\n- "confidence": a number 0-1\n\nTexts:\n${combinedText}\n\nJSON array:`,
        metadata: {
          model: RELEASE_CANDIDATE_MODEL_POLICY.primaryModel,
          temperature: FACT_EXTRACTION_INFERENCE_SETTINGS.temperature,
          maxTokens: FACT_EXTRACTION_INFERENCE_SETTINGS.maxTokens,
          topP: FACT_EXTRACTION_INFERENCE_SETTINGS.topP,
          topK: FACT_EXTRACTION_INFERENCE_SETTINGS.topK,
          repeatPenalty: FACT_EXTRACTION_INFERENCE_SETTINGS.repeatPenalty,
          releaseCandidateSpec: RELEASE_CANDIDATE_MODEL_POLICY.specVersion,
        }
      })

      const parsed = JSON.parse(result.content.trim())
      if (!Array.isArray(parsed)) return []

      return parsed
        .filter((item: any) => typeof item.fact === 'string' && typeof item.confidence === 'number')
        .map((item: any): PersonaFact => {
          const normalizedConfidence = Math.min(1, Math.max(0, Number(item.confidence)))

          return {
            id: uuidv4(),
            type: (['biographical','relationship','preference','experience','achievement'] as const)
              .includes(item.type) ? item.type : 'biographical',
            fact: item.fact,
            confidence: normalizedConfidence,
            sources: sample.map(d => d.id),
            provenance: sample.map(d => ({
              familyspaceId,
              personId,
              documentId: d.id,
              documentTitle: d.title,
              excerpt: this.createProvenanceExcerpt(d.content),
              capturedAt: new Date(),
            })),
            context: item.context || '',
            verified: normalizedConfidence >= 0.7,
          }
        })
    } catch (error) {
      console.warn('[PersonaService] extractFacts LLM parse failed, returning empty:', error)
      return []
    }
  }

  private buildFallbackDisplayName(personId: string): string {
    const normalized = personId
      .split(/[-_\s]+/)
      .filter(part => part.length > 0)
      .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(' ')

    return normalized || 'This person'
  }

  private createProvenanceExcerpt(content: string, maxLength: number = 240): string {
    const normalized = content.replace(/\s+/g, ' ').trim()

    if (normalized.length <= maxLength) {
      return normalized
    }

    return `${normalized.slice(0, maxLength)}...`
  }

  private async extractRelationships(documents: Document[]): Promise<Relationship[]> {
    if (!this.llmGateway || documents.length === 0) return []

    const sample = documents.slice(0, 4)
    const combinedText = sample
      .map(d => `[${d.title}]\n${d.content.slice(0, 1200)}`)
      .join('\n\n---\n\n')

    try {
      const result = await this.llmGateway.generateResponse({
        systemPrompt: 'You are a relationship extractor. Output ONLY valid JSON — no prose, no markdown fences.',
        context: '',
        history: [],
        userMessage: `Extract named relationships mentioned in the following texts. Return a JSON array where each element has:\n- "relatedPersonId": the person\'s name as a slug (e.g. "john-smith")\n- "relationshipLabel": how the author refers to them (e.g. "mother", "best friend")\n- "relationshipType": one of parent | child | spouse | sibling | friend | colleague | other\n- "strength": a number 0-1 indicating closeness\n- "context": a brief quote or description\n\nTexts:\n${combinedText}\n\nJSON array:`,
        metadata: {
          model: RELEASE_CANDIDATE_MODEL_POLICY.primaryModel,
          temperature: FACT_EXTRACTION_INFERENCE_SETTINGS.temperature,
          maxTokens: FACT_EXTRACTION_INFERENCE_SETTINGS.maxTokens,
          topP: FACT_EXTRACTION_INFERENCE_SETTINGS.topP,
          topK: FACT_EXTRACTION_INFERENCE_SETTINGS.topK,
          repeatPenalty: FACT_EXTRACTION_INFERENCE_SETTINGS.repeatPenalty,
          releaseCandidateSpec: RELEASE_CANDIDATE_MODEL_POLICY.specVersion,
        }
      })

      const parsed = JSON.parse(result.content.trim())
      if (!Array.isArray(parsed)) return []

      const validTypes = ['parent','child','spouse','sibling','friend','colleague','other'] as const
      return parsed
        .filter((item: any) => typeof item.relatedPersonId === 'string' && typeof item.relationshipLabel === 'string')
        .map((item: any): Relationship => ({
          id: uuidv4(),
          relatedPersonId: item.relatedPersonId,
          relationshipType: validTypes.includes(item.relationshipType) ? item.relationshipType : 'other',
          relationshipLabel: item.relationshipLabel,
          strength: Math.min(1, Math.max(0, Number(item.strength) || 0.5)),
          context: item.context || '',
        }))
    } catch (error) {
      console.warn('[PersonaService] extractRelationships LLM parse failed, returning empty:', error)
      return []
    }
  }

  private calculateConfidenceScore(documentCount: number, factCount: number, relationshipCount: number): number {
    let score = 0.5 // Base score

    // Increase score based on document count
    if (documentCount >= 10) score += 0.2
    else if (documentCount >= 5) score += 0.1

    // Increase score based on extracted facts
    if (factCount >= 10) score += 0.2
    else if (factCount >= 5) score += 0.1

    // Increase score based on relationships
    if (relationshipCount >= 5) score += 0.1
    else if (relationshipCount >= 2) score += 0.05

    return Math.min(score, 1.0)
  }
}

// Style extraction interface
export interface StyleExtractor {
  extractWritingStyle(documents: Document[]): Promise<PersonaProfile['writingStyle']>
  extractStyleProfile(documents: Document[]): Promise<StyleProfile>
}

// Document repository interface
export interface DocumentRepository {
  listDocuments(familyspaceId: string, filters?: { personId?: string }): Promise<Document[]>
}
