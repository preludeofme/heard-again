import {
  PromptBuilder,
  CompiledPrompt,
  PromptTemplate,
  TemplateVariable,
  PersonaProfile,
  RetrievedDocument,
  ChatMessage
} from '@/types'

export class PromptBuilderImpl implements PromptBuilder {
  
  async buildPrompt(
    personaProfile: PersonaProfile,
    retrievedDocuments: RetrievedDocument[],
    userMessage: string,
    chatHistory: ChatMessage[],
    options?: {
      maxContextLength?: number
      includeMetadata?: boolean
      customSystemPrompt?: string
    }
  ): Promise<CompiledPrompt> {
    const maxContextLength = options?.maxContextLength || 8000
    const includeMetadata = options?.includeMetadata || false

    // Build system prompt
    const systemPrompt = options?.customSystemPrompt || 
      this.buildSystemPrompt(personaProfile, retrievedDocuments)

    // Format context from retrieved documents
    const context = this.formatContext(retrievedDocuments, {
      maxTokens: maxContextLength,
      includeMetadata
    })

    // Filter and format conversation history
    const history = this.formatConversationHistory(chatHistory, {
      maxTokens: Math.max(1000, maxContextLength - context.length - 500),
      includeSystem: false
    })

    return {
      systemPrompt,
      context,
      history,
      userMessage: userMessage,
      metadata: {
        model: process.env.OLLAMA_MODEL || 'llama3.1:8b-instruct',
        temperature: 0.7,
        maxTokens: 2048,
        topP: 0.9,
        topK: 40,
        retrievedDocumentCount: retrievedDocuments.length,
        contextLength: context.length,
        historyLength: history.length
      }
    }
  }

  async buildPersonaPrompt(
    persona: PersonaProfile,
    query: string,
    context?: string
  ): Promise<CompiledPrompt> {
    const systemPrompt = this.buildSystemPrompt(persona, [])

    return {
      systemPrompt,
      context: context || '',
      history: [],
      userMessage: query,
      metadata: {
        model: process.env.OLLAMA_MODEL || 'llama3.1:8b-instruct',
        temperature: 0.7,
        maxTokens: 2048,
        topP: 0.9,
        topK: 40,
        retrievedDocumentCount: 0,
        contextLength: context?.length || 0,
        historyLength: 0
      }
    }
  }

  async buildStyleAnalysisPrompt(
    text: string,
    analysisType: 'tone' | 'vocabulary' | 'patterns' | 'comprehensive'
  ): Promise<CompiledPrompt> {
    const prompts = {
      tone: `Analyze the tone of this text and provide a detailed assessment including:
- Warmth level (0-1)
- Formality level (0-1) 
- Emotional intensity (0-1)
- Optimism level (0-1)
- Humor level (0-1)
- Storytelling tendency (0-1)

Text to analyze: {text}

Respond with a JSON object containing these metrics and brief explanations.`,
      
      vocabulary: `Analyze the vocabulary in this text and identify:
- Common words and phrases
- Unique or characteristic terms
- Sentence patterns
- Average sentence length
- Any distinctive linguistic features

Text to analyze: {text}

Provide a structured analysis with examples.`,
      
      patterns: `Identify writing patterns in this text including:
- Sentence structure preferences
- Paragraph organization
- Use of questions vs statements
- Tendency toward storytelling vs direct communication
- Any recurring rhetorical devices

Text to analyze: {text}

Describe the patterns with specific examples.`,
      
      comprehensive: `Provide a comprehensive writing style analysis of this text covering:
1. Tone and emotional characteristics
2. Vocabulary and word choice patterns
3. Sentence structure and organization
4. Communication style and tendencies
5. Any unique or distinctive features

Text to analyze: {text}

Format your response as a detailed analysis with specific examples and insights.`
    }

    return {
      systemPrompt: 'You are an expert in linguistic analysis and writing style assessment. Provide detailed, accurate analyses based on the given text.',
      context: '',
      history: [],
      userMessage: prompts[analysisType].replace('{text}', text),
      metadata: {
        model: process.env.OLLAMA_MODEL || 'llama3.1:8b-instruct',
        temperature: 0.3, // Lower temperature for analysis
        maxTokens: 1500,
        topP: 0.8,
        topK: 40,
        analysisType,
        textLength: text.length
      }
    }
  }

  private buildSystemPrompt(
    persona: PersonaProfile,
    retrievedDocuments: RetrievedDocument[]
  ): string {
    let prompt = persona.systemPrompt

    // Add context about available information
    if (retrievedDocuments.length > 0) {
      prompt += `\n\nI have access to ${retrievedDocuments.length} relevant documents about my life and experiences. I should reference specific details from these documents when they're relevant to the conversation.`
    }

    // Add response guidelines
    if (persona.responseGuidelines && persona.responseGuidelines.length > 0) {
      prompt += `\n\nResponse Guidelines:\n${persona.responseGuidelines.map(guideline => `- ${guideline}`).join('\n')}`
    }

    return prompt
  }

  private formatContext(
    documents: RetrievedDocument[],
    options: {
      maxTokens: number
      includeMetadata: boolean
    }
  ): string {
    if (documents.length === 0) {
      return 'No relevant documents found.'
    }

    let context = 'Relevant documents and memories:\n\n'
    let currentTokens = 0
    const maxTokens = options.maxTokens

    for (let i = 0; i < documents.length && currentTokens < maxTokens; i++) {
      const doc = documents[i]
      const docText = this.formatDocument(doc, options.includeMetadata)
      const docTokens = this.estimateTokens(docText)

      if (currentTokens + docTokens > maxTokens) {
        // Truncate the document if needed
        const remainingTokens = maxTokens - currentTokens - 50 // Leave room for truncation notice
        const truncatedContent = this.truncateToTokens(doc.content, remainingTokens)
        context += `[Document ${i + 1}]: ${doc.metadata.title}\n${truncatedContent}...\n[Content truncated due to length limits]\n\n`
      } else {
        context += docText + '\n\n'
      }

      currentTokens += docTokens
    }

    return context.trim()
  }

  private formatDocument(document: RetrievedDocument, includeMetadata: boolean): string {
    let formatted = `[Document]: ${document.metadata.title}`

    if (includeMetadata && document.metadata.source) {
      formatted += ` (Source: ${document.metadata.source})`
    }

    if (document.metadata.pageNumber) {
      formatted += ` - Page ${document.metadata.pageNumber}`
    }

    formatted += `\n${document.content}`

    return formatted
  }

  private formatConversationHistory(
    messages: ChatMessage[],
    options: {
      maxTokens: number
      includeSystem: boolean
    }
  ): ChatMessage[] {
    if (messages.length === 0) {
      return []
    }

    let filteredMessages = messages
    if (!options.includeSystem) {
      filteredMessages = messages.filter(msg => msg.role !== 'system')
    }

    // Take recent messages within token limit
    let currentTokens = 0
    const result: ChatMessage[] = []

    for (let i = filteredMessages.length - 1; i >= 0 && currentTokens < options.maxTokens; i--) {
      const msg = filteredMessages[i]
      const msgTokens = this.estimateTokens(msg.content)

      if (currentTokens + msgTokens > options.maxTokens) {
        break
      }

      result.unshift(msg)
      currentTokens += msgTokens
    }

    return result
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4)
  }

  private truncateToTokens(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 4
    if (text.length <= maxChars) {
      return text
    }

    // Try to truncate at word boundary
    const truncated = text.substring(0, maxChars)
    const lastSpace = truncated.lastIndexOf(' ')
    
    if (lastSpace > maxChars * 0.8) {
      return truncated.substring(0, lastSpace)
    }

    return truncated
  }

  // Template-based prompt building
  async buildFromTemplate(
    template: PromptTemplate,
    variables: Record<string, string>
  ): Promise<string> {
    let prompt = template.template

    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`
      prompt = prompt.replace(new RegExp(placeholder, 'g'), value)
    }

    // Handle conditional blocks
    prompt = this.processConditionalBlocks(prompt, variables)

    // Handle loops
    prompt = this.processLoops(prompt, variables)

    return prompt
  }

  private processConditionalBlocks(
    template: string,
    variables: Record<string, string>
  ): string {
    // Process {{#if variable}}...{{/if}} blocks
    const ifRegex = /\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/gs
    
    return template.replace(ifRegex, (match, variable, content) => {
      const value = variables[variable]
      return value && value.trim() !== '' ? content : ''
    })
  }

  private processLoops(
    template: string,
    variables: Record<string, string>
  ): string {
    // Process {{#each array}}...{{/each}} blocks
    const eachRegex = /\{\{#each\s+(\w+)\}\}(.*?)\{\{\/each\}\}/gs
    
    return template.replace(eachRegex, (match, variable, content) => {
      const value = variables[variable]
      
      if (!value) {
        return ''
      }

      // Try to parse as JSON array
      try {
        const array = JSON.parse(value)
        if (Array.isArray(array)) {
          return array.map((item, index) => {
            let itemContent = content
            itemContent = itemContent.replace(/\{\{this\}\}/g, String(item))
            itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index))
            return itemContent
          }).join('')
        }
      } catch {
        // If not JSON, treat as comma-separated values
        const items = value.split(',').map(v => v.trim())
        return items.map((item, index) => {
          let itemContent = content
          itemContent = itemContent.replace(/\{\{this\}\}/g, item)
          itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index))
          return itemContent
        }).join('')
      }

      return content
    })
  }

  // Prompt optimization
  async optimizePrompt(prompt: CompiledPrompt): Promise<CompiledPrompt> {
    // Remove redundant whitespace
    let optimizedSystemPrompt = prompt.systemPrompt.replace(/\s+/g, ' ').trim()
    let optimizedContext = prompt.context.replace(/\s+/g, ' ').trim()
    
    // Ensure context isn't too long
    const maxContextTokens = 6000
    if (this.estimateTokens(optimizedContext) > maxContextTokens) {
      optimizedContext = this.truncateToTokens(optimizedContext, maxContextTokens)
    }

    return {
      ...prompt,
      systemPrompt: optimizedSystemPrompt,
      context: optimizedContext,
      metadata: {
        ...prompt.metadata,
        optimized: true,
        originalContextLength: prompt.context.length,
        optimizedContextLength: optimizedContext.length
      }
    }
  }
}
