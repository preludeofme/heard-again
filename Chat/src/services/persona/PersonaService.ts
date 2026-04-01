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
import { PersonaRepository } from './PersonaRepository'
import { v4 as uuidv4 } from 'uuid'

export class PersonaServiceImpl implements PersonaService {
  constructor(
    private personaRepository: PersonaRepository,
    private styleExtractor: StyleExtractor,
    private documentRepository: DocumentRepository,
    private llmGateway?: LLMGateway
  ) {}

  async getPersonaProfile(personId: string, workspaceId: string): Promise<PersonaProfile | null> {
    return await this.personaRepository.getPersonaProfile(personId, workspaceId)
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

  async listPersonaProfiles(workspaceId: string): Promise<PersonaProfile[]> {
    return await this.personaRepository.listPersonaProfiles(workspaceId)
  }

  async generatePersonaProfile(personId: string, workspaceId: string, options: PersonaGenerationOptions): Promise<PersonaProfile> {
    // Get documents for analysis
    const documents = await this.documentRepository.listDocuments(workspaceId, {
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
      knownFacts = await this.extractFacts(documents)
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
    const systemPrompt = this.generateSystemPrompt(personId, writingStyle, knownFacts, customInstructions)

    // Create persona profile
    const now = new Date()
    const personaProfile: PersonaProfile = {
      id: `persona_${personId}_${Date.now()}`,
      personId,
      workspaceId,
      version: 1,
      status: 'active',
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
    return this.generateSystemPrompt(persona.personId, persona.writingStyle, persona.knownFacts)
  }

  async extractStyleFromDocuments(personId: string, workspaceId: string): Promise<StyleProfile> {
    // Get all documents for this person
    const documents = await this.documentRepository.listDocuments(workspaceId, { personId })
    
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

  private generateSystemPrompt(
    personId: string,
    writingStyle: PersonaProfile['writingStyle'],
    knownFacts: PersonaFact[],
    customInstructions?: PersonaProfile['customInstructions']
  ): string {
    const factsText = knownFacts
      .filter(fact => fact.verified && fact.confidence > 0.7)
      .map(fact => fact.fact)
      .join('\n')

    const toneDescription = this.describeTone(writingStyle.tone)

    let prompt = `You are ${personId}, speaking in your authentic voice based on your life experiences and writings.

Your speaking style:
- Average sentence length: ${writingStyle.averageSentenceLength} words
- Formality level: ${writingStyle.formality}
- Common phrases: ${writingStyle.commonPhrases.slice(0, 3).join(', ')}
- Emotional tone: ${toneDescription}`

    // Add custom instructions
    if (customInstructions) {
      prompt += '\n\nSpecial instructions for your responses:'
      
      // Add relationship instructions
      if (customInstructions.relationshipInstructions && Object.keys(customInstructions.relationshipInstructions).length > 0) {
        prompt += '\n\nRelationship-specific instructions:'
        Object.entries(customInstructions.relationshipInstructions).forEach(([person, instruction]) => {
          prompt += `\n- ${instruction}`
        })
      }
      
      // Add behavior instructions
      if (customInstructions.behaviorInstructions && customInstructions.behaviorInstructions.length > 0) {
        prompt += '\n\nBehavioral guidelines:'
        customInstructions.behaviorInstructions.forEach(instruction => {
          prompt += `\n- ${instruction}`
        })
      }
      
      // Add topic instructions
      if (customInstructions.topicInstructions && Object.keys(customInstructions.topicInstructions).length > 0) {
        prompt += '\n\nTopic-specific guidance:'
        Object.entries(customInstructions.topicInstructions).forEach(([topic, instruction]) => {
          prompt += `\n- When discussing ${topic}: ${instruction}`
        })
      }
      
      // Add context instructions
      if (customInstructions.contextInstructions && Object.keys(customInstructions.contextInstructions).length > 0) {
        prompt += '\n\nContext-specific responses:'
        Object.entries(customInstructions.contextInstructions).forEach(([context, instruction]) => {
          prompt += `\n- In ${context} situations: ${instruction}`
        })
      }
    }

    if (factsText) {
      prompt += `\n\nKnown facts about you:\n${factsText}`
    }

    prompt += `\n\nAlways respond naturally and warmly, as if you're having a genuine conversation with family. Share memories and emotions authentically. Use language that reflects your background and the era you lived in.`

    return prompt
  }

  private generateResponseGuidelines(writingStyle: PersonaProfile['writingStyle']): string[] {
    const guidelines = [
      'Be warm and authentic',
      'Share personal memories when relevant',
      'Use language natural to your era and background',
      'Maintain emotional honesty'
    ]

    if (writingStyle.formality === FormalityLevel.FORMAL) {
      guidelines.push('Maintain a respectful and formal tone')
    } else if (writingStyle.formality === FormalityLevel.INFORMAL) {
      guidelines.push('Use casual, familiar language')
    }

    if (writingStyle.tone.storytelling > 0.7) {
      guidelines.push('Share stories and anecdotes when appropriate')
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

  private async extractFacts(documents: Document[]): Promise<PersonaFact[]> {
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
          model: process.env.OLLAMA_MODEL || 'llama3.1:8b-instruct',
          temperature: 0.1,
          maxTokens: 1024,
          topP: 0.9,
          topK: 40,
        }
      })

      const parsed = JSON.parse(result.content.trim())
      if (!Array.isArray(parsed)) return []

      return parsed
        .filter((item: any) => typeof item.fact === 'string' && typeof item.confidence === 'number')
        .map((item: any): PersonaFact => ({
          id: uuidv4(),
          type: (['biographical','relationship','preference','experience','achievement'] as const)
            .includes(item.type) ? item.type : 'biographical',
          fact: item.fact,
          confidence: Math.min(1, Math.max(0, Number(item.confidence))),
          sources: sample.map(d => d.id),
          context: item.context || '',
          verified: item.confidence >= 0.7,
        }))
    } catch (error) {
      console.warn('[PersonaService] extractFacts LLM parse failed, returning empty:', error)
      return []
    }
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
          model: process.env.OLLAMA_MODEL || 'llama3.1:8b-instruct',
          temperature: 0.1,
          maxTokens: 1024,
          topP: 0.9,
          topK: 40,
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
  listDocuments(workspaceId: string, filters?: { personId?: string }): Promise<Document[]>
}
