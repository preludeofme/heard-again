import type { ChatMessage } from './chat'

// LLM and Ollama integration types

export interface LLMGateway {
  generateResponse(prompt: CompiledPrompt): Promise<LLMResponse>
  streamResponse(prompt: CompiledPrompt): Promise<AsyncIterable<string>>
  validateResponse(response: string, context?: { documents?: string[], knownFacts?: string[] }): Promise<ValidatedResponse>
  getModelInfo(model: string): Promise<ModelInfo>
  listModels(): Promise<ModelInfo[]>
}

export interface CompiledPrompt {
  systemPrompt: string
  context: string
  history: ChatMessage[]
  userMessage: string
  metadata: {
    model: string
    temperature: number
    maxTokens: number
    topP?: number
    topK?: number
    repeatPenalty?: number
    [key: string]: any // Allow additional properties
  }
}

export interface LLMResponse {
  content: string
  metadata: {
    model: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
    processingTime: number
    finishReason: 'stop' | 'length' | 'content_filter'
    temperature: number
  }
}

export interface ValidatedResponse {
  isValid: boolean
  content: string
  violations: ContentViolation[]
  filteredContent?: string
}

export interface ContentViolation {
  type: 'prompt_injection' | 'pii_leak' | 'inappropriate_content' | 'hallucination' | 'format_violation' | 'potential_hallucination' | 'unsupported_claim' | 'uncertainty_bypass' | 'uncertainty_style'
  severity: 'low' | 'medium' | 'high'
  description: string
  position?: {
    start: number
    end: number
  }
}

export interface ModelInfo {
  name: string
  size: number // in GB
  modifiedAt: Date
  digest: string
  details: {
    format: string
    family: string
    families: string[]
    parameterSize: string
    quantizationLevel: string
  }
  capabilities: {
    embedding: boolean
    chat: boolean
    vision: boolean
    toolUse: boolean
  }
}

export interface OllamaConfig {
  baseUrl: string
  defaultModel: string
  embeddingModel: string
  timeout: number
  maxRetries: number
  retryDelay: number
}

export interface GenerationRequest {
  model: string
  prompt: string
  options: {
    temperature?: number
    topP?: number
    topK?: number
    repeatPenalty?: number
    numPredict?: number
    stop?: string[]
    stream?: boolean
  }
  system?: string
  format?: string
  template?: string
  context?: number[]
}

export interface GenerationResponse {
  model: string
  created_at: Date
  response: string
  done: boolean
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
  context?: number[]
}

export interface EmbeddingRequest {
  model: string
  prompt: string
  options?: {
    temperature?: number
    topP?: number
    topK?: number
  }
}

export interface EmbeddingResponse {
  embedding: number[]
  model: string
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
}

export interface PromptTemplate {
  id: string
  name: string
  description: string
  template: string
  variables: TemplateVariable[]
  category: 'system' | 'context' | 'guidelines' | 'user_input'
  isActive: boolean
  version: number
  createdAt: Date
  updatedAt: Date
}

export interface TemplateVariable {
  name: string
  type: 'string' | 'number' | 'array' | 'object'
  description: string
  required: boolean
  defaultValue?: any
  validation?: {
    minLength?: number
    maxLength?: number
    pattern?: string
    enum?: any[]
  }
}
