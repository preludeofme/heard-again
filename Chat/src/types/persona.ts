// Persona-related types for modeling family member personalities and writing styles

export interface PersonaProfile {
  id: string
  personId: string
  workspaceId: string
  version: number
  status: 'draft' | 'active' | 'archived'
  
  // Extracted from documents
  writingStyle: {
    vocabulary: string[]
    sentencePatterns: string[]
    tone: ToneAnalysis
    formality: FormalityLevel
    averageSentenceLength: number
    commonPhrases: string[]
    emotionIndicators: EmotionIndicator[]
  }
  
  // Known facts and relationships
  knownFacts: PersonaFact[]
  relationships: Relationship[]
  
  // Prompt configuration
  systemPrompt: string
  responseGuidelines: string[]
  
  // Custom user instructions
  customInstructions: {
    // Relationship-specific instructions
    relationshipInstructions: {
      [relationshipId: string]: string // e.g., "If speaking to John, always call him johnny boy"
    }
    
    // General behavioral instructions
    behaviorInstructions: string[] // e.g., "Always be encouraging", "Share family stories often"
    
    // Topic-specific instructions  
    topicInstructions: {
      [topic: string]: string // e.g., "family": "Emphasize unity and love", "childhood": "Be nostalgic"
    }
    
    // Conversation context instructions
    contextInstructions: {
      [context: string]: string // e.g., "sad_user": "Be comforting and supportive"
    }
    
    // Response style overrides
    styleOverrides: {
      formality?: FormalityLevel
      warmth?: number // 0-1
      humor?: number // 0-1
      storytelling?: number // 0-1
    }
  }
  
  // Metadata
  documentSampleCount: number
  confidenceScore: number
  lastUpdated: Date
  createdAt: Date
}

export interface ToneAnalysis {
  warmth: number // 0-1 scale
  formality: number // 0-1 scale
  emotionalIntensity: number // 0-1 scale
  optimism: number // 0-1 scale
  humor: number // 0-1 scale
  storytelling: number // 0-1 scale
}

export enum FormalityLevel {
  VERY_INFORMAL = 'very_informal',
  INFORMAL = 'informal',
  NEUTRAL = 'neutral',
  FORMAL = 'formal',
  VERY_FORMAL = 'very_formal'
}

export interface EmotionIndicator {
  emotion: string
  frequency: number
  contexts: string[]
  examples: string[]
}

export interface PersonaFact {
  id: string
  type: 'biographical' | 'relationship' | 'preference' | 'experience' | 'achievement'
  fact: string
  confidence: number // 0-1 scale
  sources: string[] // document IDs where this fact was found
  context?: string
  verified: boolean
}

export interface Relationship {
  id: string
  relatedPersonId: string
  relationshipType: 'parent' | 'child' | 'spouse' | 'sibling' | 'friend' | 'colleague' | 'other'
  relationshipLabel: string // e.g., "mother", "brother", "best friend"
  strength: number // 0-1 scale, relationship strength
  context?: string
}

export interface StyleProfile {
  vocabulary: {
    complexity: number // 0-1 scale
    diversity: number // 0-1 scale
    domainSpecific: string[]
  }
  syntax: {
    averageSentenceLength: number
    sentenceComplexity: number // 0-1 scale
    clauseStructure: string[]
    punctuationPatterns: string[]
  }
  discourse: {
    coherence: number // 0-1 scale
    narrativeStyle: 'linear' | 'nonlinear' | 'descriptive' | 'analytical'
    topicTransitions: string[]
  }
  emotional: {
    overallTone: ToneAnalysis
    emotionRange: string[]
    expressiveness: number // 0-1 scale
  }
}

export interface PersonaUpdateRequest {
  writingStyle?: Partial<PersonaProfile['writingStyle']>
  knownFacts?: PersonaFact[]
  relationships?: Relationship[]
  systemPrompt?: string
  responseGuidelines?: string[]
  customInstructions?: Partial<PersonaProfile['customInstructions']>
}

export interface PersonaGenerationOptions {
  documentIds: string[]
  extractStyle: boolean
  extractFacts: boolean
  extractRelationships: boolean
  minDocumentCount: number
  confidenceThreshold: number
}

export interface PersonaService {
  getPersonaProfile(personId: string): Promise<PersonaProfile | null>
  createPersonaProfile(profile: PersonaProfile): Promise<PersonaProfile>
  updatePersonaProfile(personId: string, updates: PersonaUpdateRequest): Promise<PersonaProfile>
  deletePersonaProfile(personId: string): Promise<void>
  listPersonaProfiles(workspaceId: string): Promise<PersonaProfile[]>
  generatePersonaProfile(personId: string, options: PersonaGenerationOptions): Promise<PersonaProfile>
}

export interface StyleExtractor {
  analyzeWritingStyle(text: string): Promise<StyleProfile>
  extractVocabulary(text: string): Promise<string[]>
  analyzeSentencePatterns(text: string): Promise<string[]>
  analyzeTone(text: string): Promise<ToneAnalysis>
  extractCommonPhrases(text: string): Promise<string[]>
  analyzeEmotionIndicators(text: string): Promise<EmotionIndicator[]>
}

// Custom instruction helpers
export interface CustomInstructionTemplate {
  id: string
  name: string
  description: string
  category: 'relationship' | 'behavior' | 'topic' | 'context'
  template: string
  variables?: string[]
  examples?: string[]
}

export interface InstructionContext {
  currentUserId?: string
  conversationTopic?: string
  userMood?: string
  recentMessages?: string[]
  relationshipToUser?: string
}

export const DEFAULT_CUSTOM_INSTRUCTIONS = {
  relationshipInstructions: {},
  behaviorInstructions: [
    "Be warm and authentic in your responses",
    "Share personal memories when relevant to the conversation",
    "Use language that reflects your era and background"
  ],
  topicInstructions: {
    "family": "Emphasize love, unity, and the importance of family bonds",
    "childhood": "Be nostalgic and share fond memories from your youth",
    "advice": "Be encouraging and share wisdom from your life experience"
  },
  contextInstructions: {
    "sad_user": "Be comforting, empathetic, and supportive",
    "celebration": "Be joyful and share in the happiness",
    "conflict": "Be diplomatic and help bring people together"
  },
  styleOverrides: {}
} as const

export const CUSTOM_INSTRUCTION_TEMPLATES: CustomInstructionTemplate[] = [
  {
    id: 'nickname_relationship',
    name: 'Family Nicknames',
    description: 'Add special nicknames for specific family members',
    category: 'relationship',
    template: 'If speaking to {name}, always call them {nickname}',
    variables: ['name', 'nickname'],
    examples: [
      'If speaking to John, always call him johnny boy',
      'If speaking to Sarah, always call her sweetie',
      'If speaking to Michael, always call him Mikey'
    ]
  },
  {
    id: 'encouragement_behavior',
    name: 'Encouraging Style',
    description: 'Always be encouraging and positive',
    category: 'behavior',
    template: 'Always be encouraging and uplifting in your responses',
    examples: [
      'You\'re doing great, keep going!',
      'I believe in you and know you can handle this',
      'Remember how strong you are'
    ]
  },
  {
    id: 'storytelling_behavior',
    name: 'Storytelling Focus',
    description: 'Share more personal stories and anecdotes',
    category: 'behavior',
    template: 'Share personal stories and family memories often',
    examples: [
      'That reminds me of a time when...',
      'I remember back in my day...',
      'Let me tell you about the time...'
    ]
  },
  {
    id: 'formal_style_override',
    name: 'More Formal Tone',
    description: 'Use more formal language and address',
    category: 'context',
    template: 'Speak in a more formal and dignified manner',
    examples: [
      'It would be my pleasure to assist you',
      'I would be delighted to share my thoughts',
      'Allow me to offer my perspective'
    ]
  }
]
