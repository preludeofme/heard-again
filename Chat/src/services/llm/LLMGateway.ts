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

export class LLMGatewayImpl implements LLMGateway {
  private baseUrl: string
  private defaultModel: string

  constructor(
    baseUrl: string = process.env.OLLAMA_URL || 'http://localhost:11434',
    defaultModel: string = process.env.OLLAMA_MODEL || 'llama3.1:8b-instruct'
  ) {
    this.baseUrl = baseUrl
    this.defaultModel = defaultModel
  }

  async generateResponse(prompt: CompiledPrompt): Promise<LLMResponse> {
    const startTime = Date.now()

    try {
      const request: GenerationRequest = {
        model: prompt.metadata.model || this.defaultModel,
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

      const response = await axios.post<GenerationResponse>(
        `${this.baseUrl}/api/generate`,
        request,
        {
          timeout: 60000, // 60 second timeout
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      const processingTime = Date.now() - startTime

      const llmResponse: LLMResponse = {
        content: response.data.response ?? '',
        metadata: {
          model: prompt.metadata.model || this.defaultModel,
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
    const request: GenerationRequest = {
      model: prompt.metadata.model || this.defaultModel,
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

    const response = await axios.post(
      `${this.baseUrl}/api/generate`,
      request,
      {
        responseType: 'stream',
        timeout: 60000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )

    return this.createStreamIterator(response.data)
    }

  async validateResponse(response: string, context?: { documents?: string[], knownFacts?: string[] }): Promise<ValidatedResponse> {
    const violations: ContentViolation[] = []

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
    const speculativePatterns = [
      { pattern: /\b(I think|I believe|perhaps|maybe|probably|likely|I suppose|I guess|I imagine)\b/gi, severity: 'medium' },
      { pattern: /\b(it seems|it appears|it looks like|apparently)\b/gi, severity: 'medium' },
      { pattern: /\b(if I recall correctly|if memory serves|as far as I remember)\b/gi, severity: 'low' },
    ]

    for (const { pattern, severity } of speculativePatterns) {
      const matches = response.match(pattern)
      if (matches) {
        violations.push({
          type: 'potential_hallucination',
          severity: severity as 'low' | 'medium' | 'high',
          description: `Speculative language detected: "${matches[0]}" - may indicate uncertainty/fabulation`,
          position: {
            start: response.indexOf(matches[0]),
            end: response.indexOf(matches[0]) + matches[0].length
          }
        })
      }
    }

    // Check for specific name/date/place invention patterns
    const inventionPatterns = [
      { pattern: /\b(my (wife|husband|spouse|partner) (was|is named|name was)\s+)([A-Z][a-z]+)/gi, severity: 'high' },
      { pattern: /\b(my (son|daughter|child) (was|is named|name was)\s+)([A-Z][a-z]+)/gi, severity: 'high' },
      { pattern: /\b(I had \d+ (children|kids|sons|daughters))/gi, severity: 'high' },
      { pattern: /\b(we moved to|I moved to|I lived in|we lived in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi, severity: 'high' },
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
      const hasDocumentSupport = this.checkDocumentSupport(response, context.documents)
      if (!hasDocumentSupport.supported && hasDocumentSupport.claims.length > 0) {
        violations.push({
          type: 'unsupported_claim',
          severity: 'high',
          description: `Claims without document support: ${hasDocumentSupport.claims.slice(0, 3).join(', ')}${hasDocumentSupport.claims.length > 3 ? '...' : ''}`,
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
          description: 'Response may be bypassing required uncertainty phrase format',
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
  private checkDocumentSupport(response: string, documents: string[]): { supported: boolean; claims: string[] } {
    // Simple heuristic: check if significant phrases from response appear in documents
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 10)
    const unsupportedClaims: string[] = []
    
    const combinedDocuments = documents.join(' ').toLowerCase()
    
    for (const sentence of sentences) {
      const normalized = sentence.toLowerCase().trim()
      // Skip uncertainty phrases (these are expected and fine)
      const uncertaintyPhrases = [
        "i don't recall", "i don't remember", "i've forgotten", 
        "that doesn't ring a bell", "my memory fails me",
        "i seem to have forgotten", "i wish i could remember"
      ]
      const isUncertainty = uncertaintyPhrases.some(phrase => normalized.includes(phrase))
      if (isUncertainty) continue

      // Check for significant keywords (names, places, dates)
      const significantWords = normalized.match(/\b[A-Z][a-z]+\b/g) || []
      if (significantWords.length > 0) {
        const hasSupport = significantWords.some(word => 
          combinedDocuments.includes(word.toLowerCase())
        )
        if (!hasSupport) {
          unsupportedClaims.push(sentence.trim())
        }
      }
    }
    
    return {
      supported: unsupportedClaims.length === 0,
      claims: unsupportedClaims
    }
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
    const buffer = ''

    for await (const chunk of stream) {
      const lines = chunk.toString().split('\n')
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
