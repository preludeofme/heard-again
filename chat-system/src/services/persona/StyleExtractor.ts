import {
  StyleExtractor,
  StyleProfile,
  ToneAnalysis,
  FormalityLevel,
  EmotionIndicator,
  PersonaProfile
} from '@/types'
import type { LLMGateway } from '@/types/llm'
import type { Document } from '@/types'

export class StyleExtractorImpl implements StyleExtractor {
  constructor(private llmGateway: LLMGateway) {}

  // Original interface methods
  async analyzeWritingStyle(text: string): Promise<StyleProfile> {
    const [vocabularyWords, sentencePatterns, tone, commonPhrases, emotionIndicators] = await Promise.all([
      this.extractVocabulary(text),
      this.analyzeSentencePatterns(text),
      this.analyzeTone(text),
      this.extractCommonPhrases(text),
      this.analyzeEmotionIndicators(text)
    ])

    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const averageSentenceLength = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length

    return {
      vocabulary: {
        complexity: this.calculateVocabularyComplexity(vocabularyWords),
        diversity: this.calculateVocabularyDiversity(vocabularyWords, text),
        domainSpecific: vocabularyWords.slice(0, 20) // Top 20 as domain-specific
      },
      syntax: {
        averageSentenceLength,
        sentenceComplexity: this.calculateSentenceComplexity(text),
        clauseStructure: sentencePatterns.slice(0, 5),
        punctuationPatterns: this.extractPunctuationPatterns(text)
      },
      discourse: {
        coherence: this.calculateCoherence(text),
        narrativeStyle: this.determineNarrativeStyle(text),
        topicTransitions: this.extractTopicTransitions(text)
      },
      emotional: {
        overallTone: tone,
        emotionRange: this.extractEmotionRange(emotionIndicators),
        expressiveness: this.calculateExpressiveness(emotionIndicators)
      }
    }
  }

  // Additional methods expected by PersonaService
  async extractWritingStyle(documents: Document[]): Promise<PersonaProfile['writingStyle']> {
    // Combine all document content for analysis
    const combinedText = documents.map(doc => doc.content).join('\n\n')
    const styleProfile = await this.analyzeWritingStyle(combinedText)

    // Convert StyleProfile to PersonaProfile['writingStyle'] format
    return {
      vocabulary: styleProfile.vocabulary.domainSpecific,
      sentencePatterns: styleProfile.syntax.clauseStructure,
      tone: styleProfile.emotional.overallTone,
      formality: this.calculateFormalityLevel(combinedText),
      averageSentenceLength: styleProfile.syntax.averageSentenceLength,
      commonPhrases: await this.extractCommonPhrases(combinedText),
      emotionIndicators: await this.analyzeEmotionIndicators(combinedText)
    }
  }

  async extractStyleProfile(documents: Document[]): Promise<StyleProfile> {
    // Combine all document content for analysis
    const combinedText = documents.map(doc => doc.content).join('\n\n')
    return await this.analyzeWritingStyle(combinedText)
  }

  async extractVocabulary(text: string): Promise<string[]> {
    // Use LLM to extract characteristic vocabulary
    const prompt = this.buildVocabularyPrompt(text)
    const response = await this.llmGateway.generateResponse({
      systemPrompt: 'You are an expert in linguistic analysis. Extract the most characteristic and unique words from the given text.',
      context: '',
      history: [],
      userMessage: prompt,
      metadata: {
        model: process.env.OLLAMA_MODEL || 'llama3.1:8b-instruct',
        temperature: 0.3,
        maxTokens: 500,
        topP: 0.8,
        topK: 40
      }
    })

    // Parse the response to extract vocabulary list
    const words = this.parseVocabularyResponse(response.content)
    return words.slice(0, 50) // Limit to top 50 words
  }

  async analyzeSentencePatterns(text: string): Promise<string[]> {
    const prompt = this.buildSentencePatternPrompt(text)
    const response = await this.llmGateway.generateResponse({
      systemPrompt: 'You are an expert in linguistic analysis. Identify the characteristic sentence patterns in the given text.',
      context: '',
      history: [],
      userMessage: prompt,
      metadata: {
        model: process.env.OLLAMA_MODEL || 'llama3.1:8b-instruct',
        temperature: 0.3,
        maxTokens: 500,
        topP: 0.8,
        topK: 40
      }
    })

    return this.parseSentencePatterns(response.content)
  }

  async analyzeTone(text: string): Promise<ToneAnalysis> {
    const prompt = this.buildTonePrompt(text)
    const response = await this.llmGateway.generateResponse({
      systemPrompt: 'You are an expert in emotional and tonal analysis. Analyze the emotional tone of the given text and provide specific metrics.',
      context: '',
      history: [],
      userMessage: prompt,
      metadata: {
        model: process.env.OLLAMA_MODEL || 'llama3.1:8b-instruct',
        temperature: 0.3,
        maxTokens: 300,
        topP: 0.8,
        topK: 40
      }
    })

    return this.parseToneResponse(response.content)
  }

  async extractCommonPhrases(text: string): Promise<string[]> {
    // First, extract phrases using basic NLP techniques
    const basicPhrases = this.extractBasicPhrases(text)
    
    // Then use LLM to identify more nuanced phrases
    const prompt = this.buildCommonPhrasesPrompt(text, basicPhrases)
    const response = await this.llmGateway.generateResponse({
      systemPrompt: 'You are an expert in linguistic analysis. Identify common phrases and expressions that characterize the author\'s communication style.',
      context: '',
      history: [],
      userMessage: prompt,
      metadata: {
        model: process.env.OLLAMA_MODEL || 'llama3.1:8b-instruct',
        temperature: 0.3,
        maxTokens: 400,
        topP: 0.8,
        topK: 40
      }
    })

    return this.parseCommonPhrases(response.content)
  }

  async analyzeEmotionIndicators(text: string): Promise<EmotionIndicator[]> {
    const prompt = this.buildEmotionPrompt(text)
    const response = await this.llmGateway.generateResponse({
      systemPrompt: 'You are an expert in emotional analysis. Identify emotional indicators in the text, including emotions expressed and the language used to express them.',
      context: '',
      history: [],
      userMessage: prompt,
      metadata: {
        model: process.env.OLLAMA_MODEL || 'llama3.1:8b-instruct',
        temperature: 0.3,
        maxTokens: 500,
        topP: 0.8,
        topK: 40
      }
    })

    return this.parseEmotionIndicators(response.content)
  }

  private buildVocabularyPrompt(text: string): string {
    return `Analyze this text and extract the most characteristic and unique words that reflect the author's vocabulary:

Text: "${text.substring(0, 1000)}${text.length > 1000 ? '...' : ''}"

Please provide:
1. Words that are unique or distinctive to this author
2. Terms they use frequently that might be characteristic
3. Any specialized vocabulary or jargon
4. Words that reveal their background or interests

Format as a JSON array of strings: ["word1", "word2", "word3"]`
  }

  private buildSentencePatternPrompt(text: string): string {
    return `Analyze the sentence patterns in this text:

Text: "${text.substring(0, 1000)}${text.length > 1000 ? '...' : ''}"

Identify characteristic patterns such as:
1. Preferred sentence structures
2. Common sentence beginnings
3. Use of questions vs statements
4. Tendency toward complex vs simple sentences
5. Any recurring rhetorical devices

Format as a JSON array of descriptive strings: ["pattern1", "pattern2", "pattern3"]`
  }

  private buildTonePrompt(text: string): string {
    return `Analyze the emotional tone of this text on a scale of 0-1:

Text: "${text.substring(0, 800)}${text.length > 800 ? '...' : ''}"

Provide scores for:
- warmth (0-1)
- formality (0-1) 
- emotional intensity (0-1)
- optimism (0-1)
- humor (0-1)
- storytelling tendency (0-1)

Format as JSON: {"warmth": 0.7, "formality": 0.3, "emotionalIntensity": 0.6, "optimism": 0.8, "humor": 0.2, "storytelling": 0.9}`
  }

  private buildCommonPhrasesPrompt(text: string, basicPhrases: string[]): string {
    return `Identify common phrases and expressions in this text:

Text: "${text.substring(0, 1000)}${text.length > 1000 ? '...' : ''}"

Already identified basic phrases: ${basicPhrases.slice(0, 10).join(', ')}

Find additional:
1. Characteristic sayings or expressions
2. Recurring phrases that reveal personality
3. Ways they commonly express certain ideas
4. Regional or familial expressions

Format as a JSON array: ["phrase1", "phrase2", "phrase3"]`
  }

  private buildEmotionPrompt(text: string): string {
    return `Analyze emotional indicators in this text:

Text: "${text.substring(0, 1000)}${text.length > 1000 ? '...' : ''}"

Identify:
1. Primary emotions expressed
2. Language used to express emotions
3. Emotional intensity indicators
4. Context for emotional expressions

Format as JSON array: [{"emotion": "joy", "indicators": ["word1", "word2"], "intensity": 0.8}]`
  }

  private parseVocabularyResponse(content: string): string[] {
    try {
      const match = content.match(/\[.*?\]/s)
      if (match) {
        return JSON.parse(match[0])
      }
    } catch {
      // Fallback to basic extraction
      return this.extractBasicVocabulary(content)
    }
    return this.extractBasicVocabulary(content)
  }

  private parseSentencePatterns(content: string): string[] {
    try {
      const match = content.match(/\[.*?\]/s)
      if (match) {
        return JSON.parse(match[0])
      }
    } catch {
      // Fallback
      return content.split('\n').filter(line => line.trim().length > 0).slice(0, 10)
    }
    return content.split('\n').filter(line => line.trim().length > 0).slice(0, 10)
  }

  private parseToneResponse(content: string): ToneAnalysis {
    try {
      const match = content.match(/\{.*?\}/s)
      if (match) {
        const data = JSON.parse(match[0])
        return {
          warmth: data.warmth || 0.5,
          formality: data.formality || 0.5,
          emotionalIntensity: data.emotionalIntensity || 0.5,
          optimism: data.optimism || 0.5,
          humor: data.humor || 0.5,
          storytelling: data.storytelling || 0.5
        }
      }
    } catch {
      // Default values
    }
    return {
      warmth: 0.5,
      formality: 0.5,
      emotionalIntensity: 0.5,
      optimism: 0.5,
      humor: 0.5,
      storytelling: 0.5
    }
  }

  private parseCommonPhrases(content: string): string[] {
    try {
      const match = content.match(/\[.*?\]/s)
      if (match) {
        return JSON.parse(match[0])
      }
    } catch {
      // Fallback
      return content.split('\n').filter(line => line.trim().length > 0).slice(0, 10)
    }
    return content.split('\n').filter(line => line.trim().length > 0).slice(0, 10)
  }

  private parseEmotionIndicators(content: string): EmotionIndicator[] {
    try {
      const match = content.match(/\[.*?\]/s)
      if (match) {
        return JSON.parse(match[0])
      }
    } catch {
      // Fallback
    }
    return []
  }

  private extractBasicVocabulary(text: string): string[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 4)
      .filter(word => !this.isCommonWord(word))
    
    const frequency: Record<string, number> = {}
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1
    })

    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([word]) => word)
  }

  private extractBasicPhrases(text: string): string[] {
    const sentences = text.split(/[.!?]+/)
    const phrases: string[] = []
    
    sentences.forEach(sentence => {
      const words = sentence.trim().split(/\s+/)
      for (let i = 0; i < words.length - 2; i++) {
        const phrase = words.slice(i, i + 3).join(' ')
        if (phrase.length > 10) {
          phrases.push(phrase)
        }
      }
    })

    const frequency: Record<string, number> = {}
    phrases.forEach(phrase => {
      frequency[phrase] = (frequency[phrase] || 0) + 1
    })

    return Object.entries(frequency)
      .filter(([, count]) => count > 1)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([phrase]) => phrase)
  }

  private isCommonWord(word: string): boolean {
    const commonWords = new Set([
      'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have',
      'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you',
      'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they',
      'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my',
      'one', 'all', 'would', 'there', 'their', 'what', 'so',
      'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go',
      'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just',
      'him', 'know', 'take', 'people', 'into', 'year', 'your',
      'good', 'some', 'could', 'them', 'see', 'other', 'than',
      'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think',
      'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work',
      'first', 'well', 'way', 'even', 'new', 'want', 'because',
      'any', 'these', 'give', 'day', 'most', 'us', 'is', 'was',
      'are', 'been', 'has', 'had', 'were', 'said', 'did', 'getting',
      'made', 'find', 'where', 'much', 'too', 'very', 'still',
      'being', 'going', 'why', 'before', 'never', 'here', 'more'
    ])
    return commonWords.has(word.toLowerCase())
  }

  private calculateFormalityLevel(text: string): FormalityLevel {
    const informalIndicators = /\b(you're|can't|won't|don't|gonna|wanna|yeah|nah|hey|hi|bye|thanks|cool|awesome|stuff|thing|things)\b/gi
    const formalIndicators = /\b(furthermore|therefore|consequently|nevertheless|moreover|however|thus|hence|whereby|whom|whomever|one's|shall|must|ought)\b/gi
    
    const informalCount = (text.match(informalIndicators) || []).length
    const formalCount = (text.match(formalIndicators) || []).length
    const totalWords = text.split(/\s+/).length
    
    const informalRatio = informalCount / totalWords
    const formalRatio = formalCount / totalWords
    
    if (formalRatio > informalRatio * 1.5) return FormalityLevel.FORMAL
    if (informalRatio > formalRatio * 1.5) return FormalityLevel.INFORMAL
    return FormalityLevel.NEUTRAL
  }

  private calculateConfidence(textLength: number): number {
    // Confidence increases with sample size
    if (textLength < 500) return 0.3
    if (textLength < 1000) return 0.5
    if (textLength < 2000) return 0.7
    if (textLength < 5000) return 0.85
    return 0.95
  }

  // Helper methods for StyleProfile structure
  private calculateVocabularyComplexity(vocabulary: string[]): number {
    // Calculate based on word length, rarity, and syllable count
    const avgWordLength = vocabulary.reduce((sum, word) => sum + word.length, 0) / vocabulary.length
    const longWords = vocabulary.filter(word => word.length > 8).length
    const complexity = (avgWordLength / 10) * 0.5 + (longWords / vocabulary.length) * 0.5
    return Math.min(complexity, 1)
  }

  private calculateVocabularyDiversity(vocabulary: string[], text: string): number {
    const totalWords = text.split(/\s+/).length
    const uniqueWords = new Set(vocabulary.map(w => w.toLowerCase())).size
    return Math.min(uniqueWords / totalWords, 1)
  }

  private calculateSentenceComplexity(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const avgLength = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length
    const complexSentences = sentences.filter(s => {
      const clauses = s.split(/[,;]/).length
      return clauses > 2
    }).length
    
    return Math.min((avgLength / 20) * 0.6 + (complexSentences / sentences.length) * 0.4, 1)
  }

  private extractPunctuationPatterns(text: string): string[] {
    const patterns: string[] = []
    if (text.includes('...')) patterns.push('ellipsis')
    if (text.includes('--')) patterns.push('em_dash')
    if (text.match(/\([^)]+\)/)) patterns.push('parentheses')
    if (text.match(/"[^"]+"/)) patterns.push('quotation_marks')
    if (text.includes(';')) patterns.push('semicolon')
    if (text.includes(':')) patterns.push('colon')
    return patterns
  }

  private calculateCoherence(text: string): number {
    // Simple coherence calculation based on transition words and logical flow
    const transitionWords = ['however', 'therefore', 'moreover', 'furthermore', 'consequently', 'nevertheless']
    const transitions = transitionWords.filter(word => text.toLowerCase().includes(word)).length
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    return Math.min(transitions / sentences.length * 2, 1)
  }

  private determineNarrativeStyle(text: string): 'linear' | 'nonlinear' | 'descriptive' | 'analytical' {
    const descriptive = text.match(/\b(beautiful|ugly|magnificent|horrible|wonderful|terrible|amazing)\b/gi)?.length || 0
    const analytical = text.match(/\b(because|therefore|however|analysis|examine|consider)\b/gi)?.length || 0
    const temporal = text.match(/\b(before|after|during|then|next|first|finally)\b/gi)?.length || 0
    
    if (descriptive > analytical && descriptive > temporal) return 'descriptive'
    if (analytical > descriptive && analytical > temporal) return 'analytical'
    if (temporal > 0) return 'linear'
    return 'nonlinear'
  }

  private extractTopicTransitions(text: string): string[] {
    const transitions: string[] = []
    const sentences = text.split(/[.!?]+/)
    
    for (let i = 1; i < sentences.length; i++) {
      const prevSentence = sentences[i - 1].toLowerCase()
      const currSentence = sentences[i].toLowerCase()
      
      if (currSentence.includes('however') || currSentence.includes('but')) {
        transitions.push('contrast')
      } else if (currSentence.includes('also') || currSentence.includes('additionally')) {
        transitions.push('addition')
      } else if (currSentence.includes('therefore') || currSentence.includes('thus')) {
        transitions.push('consequence')
      }
    }
    
    return [...new Set(transitions)]
  }

  private extractEmotionRange(emotionIndicators: EmotionIndicator[]): string[] {
    return emotionIndicators.map(indicator => indicator.emotion)
  }

  private calculateExpressiveness(emotionIndicators: EmotionIndicator[]): number {
    if (emotionIndicators.length === 0) return 0
    const avgFrequency = emotionIndicators.reduce((sum, ind) => sum + ind.frequency, 0) / emotionIndicators.length
    return Math.min(avgFrequency, 1)
  }
}
