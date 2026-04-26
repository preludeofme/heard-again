import {
  LLMGateway,
  CompiledPrompt,
  LLMResponse,
  ValidatedResponse,
  ModelInfo,
  GenerationRequest,
  GenerationResponse
} from '@/types'
import axios from 'axios'
import { RELEASE_CANDIDATE_MODEL_POLICY } from '@/config/releaseCandidate'
import { responseValidationService, ResponseValidationService, ValidationContext } from '../ai/ResponseValidationService'

export class LLMGatewayImpl implements LLMGateway {
  private baseUrl: string
  private defaultModel: string
  private fallbackModel: string
  private validationService: ResponseValidationService

  constructor(
    baseUrl: string = process.env.OLLAMA_URL || 'http://localhost:11434',
    defaultModel: string = RELEASE_CANDIDATE_MODEL_POLICY.primaryModel,
    fallbackModel: string = RELEASE_CANDIDATE_MODEL_POLICY.fallbackModel,
    validationService: ResponseValidationService = responseValidationService
  ) {
    this.baseUrl = baseUrl
    this.defaultModel = defaultModel
    this.fallbackModel = fallbackModel
    this.validationService = validationService
  }

  async generateResponse(prompt: CompiledPrompt): Promise<LLMResponse> {
    const startTime = Date.now()
    const preferredModel = prompt.metadata.model || this.defaultModel

    try {
      const request: GenerationRequest & { stream: boolean } = {
        model: preferredModel,
        prompt: this.buildFullPrompt(prompt),
        options: {
          temperature: prompt.metadata.temperature,
          topP: prompt.metadata.topP,
          topK: prompt.metadata.topK,
          repeatPenalty: prompt.metadata.repeatPenalty,
          numPredict: prompt.metadata.maxTokens
        },
        system: prompt.systemPrompt,
        stream: false,
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

  async validateResponse(response: string, context?: ValidationContext): Promise<ValidatedResponse> {
    return this.validationService.validateResponse(response, context)
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
}
