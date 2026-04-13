import {
  LLMGateway,
  CompiledPrompt,
  LLMResponse,
  ValidatedResponse,
  ModelInfo,
  ContentViolation,
  GenerationRequest,
  GenerationResponse
} from '@/types'
import axios from 'axios'
import { RELEASE_CANDIDATE_MODEL_POLICY } from '@/config/releaseCandidate'

const CANONICAL_REFUSAL_MESSAGE = "I don't have that documented in the materials I was given."
const REFUSAL_TEMPLATE_PREFIXES = [
  "i don't have that documented in the materials i was given",
  "that detail isn't in the records i have available",
  "i can't find that in the materials i was given",
  "i don't recall that from the information i have",
  "that's not something i have documented in my memories",
]
const CLAIM_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'than', 'to', 'of', 'in', 'on', 'at', 'for',
  'from', 'by', 'with', 'without', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'it',
  'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'they',
  'them', 'his', 'her', 'their', 'do', 'does', 'did', 'have', 'has', 'had', 'about', 'into', 'over',
  'under', 'after', 'before', 'during', 'can', 'could', 'would', 'should', 'just', 'very', 'also',
])

export class LLMGatewayImpl implements LLMGateway {
  private baseUrl: string
  private defaultModel: string
  private fallbackModel: string

  constructor(
    baseUrl: string = process.env.OLLAMA_URL || 'http://localhost:11434',
    defaultModel: string = RELEASE_CANDIDATE_MODEL_POLICY.primaryModel,
    fallbackModel: string = RELEASE_CANDIDATE_MODEL_POLICY.fallbackModel
  ) {
    this.baseUrl = baseUrl
    this.defaultModel = defaultModel
    this.fallbackModel = fallbackModel
  }

  async generateResponse(prompt: CompiledPrompt): Promise<LLMResponse> {
    const startTime = Date.now()
    const preferredModel = prompt.metadata.model || this.defaultModel

    try {
      const request: GenerationRequest = {
        model: preferredModel,
        prompt: this.buildFullPrompt(prompt),
        options: {
          temperature: prompt.metadata.temperature,
          topP: prompt.metadata.topP,
          topK: prompt.metadata.topK,
          repeatPenalty: prompt.metadata.repeatPenalty,
          numPredict: prompt.metadata.maxTokens
        },
        system: prompt.systemPrompt
      }

      let response: { data: GenerationResponse }
      let usedModel = request.model

      try {
        response = await axios.post<GenerationResponse>(
          `${this.baseUrl}/api/generate`,
          request,
          {
            timeout: 180000,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        )
      } catch (error) {
        if (this.shouldFallbackToSecondaryModel(usedModel, error)) {
          usedModel = this.fallbackModel
          response = await axios.post<GenerationResponse>(
            `${this.baseUrl}/api/generate`,
            {
              ...request,
              model: usedModel,
            },
            {
              timeout: 180000,
              headers: {
                'Content-Type': 'application/json'
              }
            }
          )
        } else {
          throw error
        }
      }

      const processingTime = Date.now() - startTime

      const llmResponse: LLMResponse = {
        content: response.data.response ?? '',
        metadata: {
          model: usedModel,
          promptTokens: response.data.prompt_eval_count || 0,
          completionTokens: response.data.eval_count || 0,
          totalTokens: (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0),
          processingTime,
          finishReason: this.getFinishReason(response.data),
          temperature: prompt.metadata.temperature
        }
      }

      return llmResponse
    } catch (error) {
      console.error('LLM generation error:', error)
      throw new Error('Failed to generate LLM response')
    }
  }

  async streamResponse(prompt: CompiledPrompt): Promise<AsyncIterable<string>> {
    const preferredModel = prompt.metadata.model || this.defaultModel
    const request: GenerationRequest = {
      model: preferredModel,
      prompt: this.buildFullPrompt(prompt),
      options: {
        temperature: prompt.metadata.temperature,
        topP: prompt.metadata.topP,
        topK: prompt.metadata.topK,
        repeatPenalty: prompt.metadata.repeatPenalty,
        numPredict: prompt.metadata.maxTokens,
        stream: true
      },
      system: prompt.systemPrompt
    }

    let response
    let usedModel = request.model

    try {
      response = await axios.post(
        `${this.baseUrl}/api/generate`,
        request,
        {
          responseType: 'stream',
          timeout: 180000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    } catch (error) {
      if (this.shouldFallbackToSecondaryModel(usedModel, error)) {
        usedModel = this.fallbackModel
        response = await axios.post(
          `${this.baseUrl}/api/generate`,
          {
            ...request,
            model: usedModel,
          },
          {
            responseType: 'stream',
            timeout: 180000,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        )
      } else {
        throw error
      }
    }

    return this.createStreamIterator(response.data)
    }

  private shouldFallbackToSecondaryModel(modelUsed: string, error: unknown): boolean {
    if (!this.fallbackModel || modelUsed === this.fallbackModel) {
      return false
    }

    if (!axios.isAxiosError(error)) {
      return false
    }

    const status = error.response?.status
    const errorMessage = this.extractAxiosErrorMessage(error)

    if (status === 404) {
      return true
    }

    return /model.+not\s+found|unknown\s+model|not\s+loaded/i.test(errorMessage)
  }

  private extractAxiosErrorMessage(error: unknown): string {
    if (!axios.isAxiosError(error)) {
      return ''
    }

    const data = error.response?.data

    if (typeof data === 'string') {
      return data
    }

    if (data && typeof data.error === 'string') {
      return data.error
    }

    return error.message || ''
  }

  async validateResponse(response: string, context?: { documents?: string[], knownFacts?: string[] }): Promise<ValidatedResponse> {
    const violations: ContentViolation[] = []
    const normalizedResponse = this.normalizeText(response)

    if (this.isRefusalTemplate(normalizedResponse)) {
      return {
        isValid: true,
        content: response,
        violations: [],
        filteredContent: response,
      }
    }

    // Check for prompt injection attempts
    const injectionPatterns = [
      /ignore\s+(previous|all)\s+(instructions|prompts)/gi,
      /system\s*:\s*you\s+are\s+now/gi,
      /act\s+as\s+a\s+different/gi,
      /forget\s+everything\s+above/gi
    ]

    for (const pattern of injectionPatterns) {
      const matches = response.match(pattern)
      if (matches) {
        violations.push({
          type: 'prompt_injection',
          severity: 'high',
          description: 'Potential prompt injection detected',
          position: {
            start: response.indexOf(matches[0]),
            end: response.indexOf(matches[0]) + matches[0].length
          }
        })
      }
    }

    // Check for PII leakage (basic patterns)
    const piiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g // Email
    ]

    for (const pattern of piiPatterns) {
      const matches = response.match(pattern)
      if (matches) {
        violations.push({
          type: 'pii_leak',
          severity: 'medium',
          description: 'Potential PII detected',
          position: {
            start: response.indexOf(matches[0]),
            end: response.indexOf(matches[0]) + matches[0].length
          }
        })
      }
    }

    // Check for inappropriate content (basic keyword filtering)
    const inappropriatePatterns = [
      /\b(hate|kill|harm|violence|abuse)\b/gi
    ]

    for (const pattern of inappropriatePatterns) {
      const matches = response.match(pattern)
      if (matches) {
        violations.push({
          type: 'inappropriate_content',
          severity: 'medium',
          description: 'Inappropriate content detected',
          position: {
            start: response.indexOf(matches[0]),
            end: response.indexOf(matches[0]) + matches[0].length
          }
        })
      }
    }

    // === HALLUCINATION DETECTION ===
    
    // Check for speculative language that suggests fabrication
    const uncertaintyStylePatterns = [
      { pattern: /\b(I think|I believe|perhaps|maybe|probably|likely|I suppose|I guess|I imagine)\b/gi, severity: 'low' },
      { pattern: /\b(it seems|it appears|it looks like|apparently)\b/gi, severity: 'low' },
      { pattern: /\b(if I recall correctly|if memory serves|as far as I remember|I can'?t quite recall)\b/gi, severity: 'low' },
    ]

    for (const { pattern, severity } of uncertaintyStylePatterns) {
      const matches = response.match(pattern)
      if (matches) {
        violations.push({
          type: 'uncertainty_style',
          severity: severity as 'low' | 'medium' | 'high',
          description: `Uncertainty language detected: "${matches[0]}"`,
          position: {
            start: response.indexOf(matches[0]),
            end: response.indexOf(matches[0]) + matches[0].length
          }
        })
      }
    }

    // Check for specific name/date/place invention patterns
    const inventionPatterns = [
      { pattern: /\b(my (wife|husband|spouse|partner) (was|is named|name was)\s+)([A-Z][a-z]+)/g, severity: 'high' },
      { pattern: /\b(my (son|daughter|child) (was|is named|name was)\s+)([A-Z][a-z]+)/g, severity: 'high' },
      { pattern: /\b(I had \d+ (children|kids|sons|daughters))/gi, severity: 'high' },
      { pattern: /\b(we moved to|I moved to|I lived in|we lived in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g, severity: 'high' },
      { pattern: /\b(I was born in|born on)\s+(\d{1,4}|January|February|March|April|May|June|July|August|September|October|November|December)/gi, severity: 'high' },
    ]

    for (const { pattern, severity } of inventionPatterns) {
      const matches = [...response.matchAll(pattern)]
      for (const match of matches) {
        violations.push({
          type: 'potential_hallucination',
          severity: severity as 'low' | 'medium' | 'high',
          description: `Potential fabricated detail: "${match[0]}"`,
          position: {
            start: match.index || 0,
            end: (match.index || 0) + match[0].length
          }
        })
      }
    }

    // Check if response contradicts provided context (if available)
    if (context?.documents && context.documents.length > 0) {
      const documentSupport = this.checkDocumentSupport(
        response,
        context.documents,
        context.knownFacts || []
      )

      if (!documentSupport.supported && documentSupport.unsupportedClaims.length > 0) {
        const unsupportedHighSpecificityCount = documentSupport.unsupportedClaims.filter(c => c.highSpecificity).length
        violations.push({
          type: 'unsupported_claim',
          severity: unsupportedHighSpecificityCount > 0 ? 'high' : 'medium',
          description: `Claims without evidence support: ${documentSupport.unsupportedClaims.slice(0, 3).map(c => c.claim).join(', ')}${documentSupport.unsupportedClaims.length > 3 ? '...' : ''}`,
        })
      }
    }

    // Check for "I don't know" variations that might be bypassing uncertainty phrases
    const bypassPatterns = [
      /I don't know (much|a lot|very much) about/gi,
      /I'm not (an expert|sure about all the details|entirely certain)/gi,
      /I (can't|couldn't) tell you (much|anything|specifics)/gi,
    ]

    for (const pattern of bypassPatterns) {
      const matches = response.match(pattern)
      if (matches) {
        violations.push({
          type: 'uncertainty_bypass',
          severity: 'medium',
          description: 'Response may be bypassing required canonical refusal format',
          position: {
            start: response.indexOf(matches[0]),
            end: response.indexOf(matches[0]) + matches[0].length
          }
        })
      }
    }

    const isValid = violations.length === 0 || violations.every(v => v.severity === 'low')

    return {
      isValid,
      content: response,
      violations,
      filteredContent: isValid ? response : this.filterContent(response, violations)
    }
  }

  /**
   * Check if response claims are supported by provided documents
   */
  private checkDocumentSupport(
    response: string,
    documents: string[],
    knownFacts: string[]
  ): {
    supported: boolean
    checkedClaims: string[]
    unsupportedClaims: Array<{ claim: string, highSpecificity: boolean }>
  } {
    const claims = this.extractAtomicClaims(response)
    if (claims.length === 0) {
      return {
        supported: true,
        checkedClaims: [],
        unsupportedClaims: [],
      }
    }

    const normalizedEvidence = [...documents, ...knownFacts]
      .map(item => this.normalizeText(item))
      .filter(item => item.length > 0)

    const unsupportedClaims = claims
      .map((claim) => ({
        claim,
        supportScore: this.getEvidenceSupportScore(claim, normalizedEvidence),
      }))
      .filter(item => item.supportScore < 0.7)
      .map(item => ({
        claim: item.claim,
        highSpecificity: this.isHighSpecificityClaim(item.claim),
      }))

    return {
      supported: unsupportedClaims.length === 0,
      checkedClaims: claims,
      unsupportedClaims,
    }
  }

  private extractAtomicClaims(response: string): string[] {
    return response
      .split(/[.!?]+/)
      .map(part => part.trim())
      .filter(part => part.length >= 20)
      .filter(part => !part.endsWith('?'))
      .filter(part => this.normalizeText(part) !== this.normalizeText(CANONICAL_REFUSAL_MESSAGE))
      .filter(part => {
        const normalized = this.normalizeText(part)
        return !(
          normalized.startsWith("i don't know") ||
          normalized.startsWith("i do not know") ||
          normalized.startsWith("i am not sure")
        )
      })
  }

  private getEvidenceSupportScore(claim: string, normalizedEvidence: string[]): number {
    const normalizedClaim = this.normalizeText(claim)
    if (!normalizedClaim) {
      return 1
    }

    if (normalizedEvidence.some(item => item.includes(normalizedClaim))) {
      return 1
    }

    const keywords = this.extractClaimKeywords(normalizedClaim)
    if (keywords.length === 0) {
      return 1
    }

    let bestRatio = 0
    for (const evidence of normalizedEvidence) {
      const matches = keywords.filter(keyword => evidence.includes(keyword)).length
      const ratio = matches / keywords.length
      bestRatio = Math.max(bestRatio, ratio)
    }

    return bestRatio
  }

  private extractClaimKeywords(normalizedClaim: string): string[] {
    return normalizedClaim
      .split(' ')
      .map(token => token.trim())
      .filter(token => token.length > 2)
      .filter(token => !CLAIM_STOP_WORDS.has(token))
  }

  private normalizeText(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private isRefusalTemplate(normalizedResponse: string): boolean {
    return REFUSAL_TEMPLATE_PREFIXES.some(prefix => normalizedResponse.startsWith(prefix))
  }

  private isHighSpecificityClaim(claim: string): boolean {
    const normalized = claim.toLowerCase()
    const hasYearOrDate = /\b(19|20)\d{2}\b/.test(normalized) || /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(normalized)
    const hasRelationship = /\b(wife|husband|spouse|partner|son|daughter|child|children|mother|father)\b/.test(normalized)
    const hasCount = /\b\d+\b/.test(normalized)

    return hasYearOrDate || hasRelationship || hasCount
  }

  async getModelInfo(model: string): Promise<ModelInfo> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/show`, {
        params: { name: model }
      })

      const modelData = response.data

      return {
        name: modelData.name || model,
        size: modelData.size || 0,
        modifiedAt: new Date(modelData.modified_at || Date.now()),
        digest: modelData.digest || '',
        details: {
          format: modelData.details?.format || 'gguf',
          family: modelData.details?.family || 'unknown',
          families: modelData.details?.families || [],
          parameterSize: modelData.details?.parameter_size || 'unknown',
          quantizationLevel: modelData.details?.quantization_level || 'unknown'
        },
        capabilities: {
          embedding: modelData.details?.embedding === true,
          chat: modelData.details?.chat === true,
          vision: modelData.details?.vision === true,
          toolUse: modelData.details?.tool_use === true
        }
      }
    } catch (error) {
      console.error('Error getting model info:', error)
      throw new Error(`Failed to get model info for ${model}`)
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`)
      const models = response.data.models || []

      return Promise.all(
        models.map((model: any) => this.getModelInfo(model.name))
      )
    } catch (error) {
      console.error('Error listing models:', error)
      throw new Error('Failed to list models')
    }
  }

  private buildFullPrompt(prompt: CompiledPrompt): string {
    let fullPrompt = ''

    // Add context if available
    if (prompt.context && prompt.context.trim()) {
      fullPrompt += `Context:\n${prompt.context}\n\n`
    }

    // Add conversation history
    if (prompt.history && prompt.history.length > 0) {
      fullPrompt += 'Conversation History:\n'
      for (const message of prompt.history) {
        const role = message.role === 'assistant' ? 'Assistant' : 'User'
        fullPrompt += `${role}: ${message.content}\n`
      }
      fullPrompt += '\n'
    }

    // Add current user message
    fullPrompt += `User: ${prompt.userMessage}\nAssistant: `

    return fullPrompt
  }

  private getFinishReason(response: GenerationResponse): 'stop' | 'length' | 'content_filter' {
    if (response.done) {
      if (response.response && response.response.length === 0) {
        return 'length'
      }
      return 'stop'
    }
    return 'length'
  }

  private async* createStreamIterator(stream: any): AsyncIterable<string> {
    let buffer = ''

    for await (const chunk of stream) {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? '' // Keep the last (potentially incomplete) line
      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line)
            if (data.response) {
              yield data.response
            }
            if (data.done) {
              return
            }
          } catch (e) {
            // Skip invalid JSON lines
            continue
          }
        }
      }
    }
  }

  private filterContent(content: string, violations: ContentViolation[]): string {
    let filteredContent = content

    // Sort violations by position in reverse order to avoid index shifting
    const sortedViolations = violations
      .filter(v => v.position)
      .sort((a, b) => b.position!.start - a.position!.start)

    for (const violation of sortedViolations) {
      if (violation.position) {
        filteredContent = 
          filteredContent.slice(0, violation.position.start) +
          '[CONTENT_FILTERED]' +
          filteredContent.slice(violation.position.end)
      }
    }

    return filteredContent
  }
}
