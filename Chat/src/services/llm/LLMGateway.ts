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

  async validateResponse(response: string): Promise<ValidatedResponse> {
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

    const isValid = violations.length === 0 || violations.every(v => v.severity === 'low')

    return {
      isValid,
      content: response,
      violations,
      filteredContent: isValid ? response : this.filterContent(response, violations)
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
