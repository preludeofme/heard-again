import { PersonaProfile } from '@/types'

export interface VoiceIntegrationService {
  synthesizeChatResponse(
    response: string,
    personaProfile: PersonaProfile,
    options?: VoiceSynthesisOptions
  ): Promise<VoiceSynthesisResult>
  selectVoiceProfile(personaProfile: PersonaProfile): Promise<VoiceProfile | null>
  streamSynthesis(
    response: string,
    voiceProfile: VoiceProfile,
    options?: VoiceSynthesisOptions
  ): Promise<AsyncIterable<VoiceChunk>>
}

export interface VoiceSynthesisOptions {
  style?: 'warm' | 'gentle' | 'excited' | 'nostalgic' | 'formal' | 'casual'
  speed?: number // 0.5 to 2.0
  emotion?: string
  streaming?: boolean
  priority?: 'low' | 'normal' | 'high'
}

export interface VoiceProfile {
  id: string
  name: string
  personaId?: string
  description?: string
  style: VoiceStyle
  createdAt: Date
  lastUsed?: Date
  isActive: boolean
}

export interface VoiceStyle {
  warmth: number // 0-1
  formality: number // 0-1
  emotionalIntensity: number // 0-1
  storytelling: number // 0-1
  humor: number // 0-1
  pace: number // 0.5-2.0
  pitch: number // 0.5-1.5
}

export interface VoiceSynthesisResult {
  audioUrl: string
  duration: number
  voiceProfile: VoiceProfile
  metadata: {
    synthesisTime: number
    tokens: number
    model: string
    quality: 'low' | 'medium' | 'high'
  }
}

export interface VoiceChunk {
  audio: ArrayBuffer
  isFinal: boolean
  timestamp: number
  sequence: number
}

export class VoiceIntegrationServiceImpl implements VoiceIntegrationService {
  private ttsBaseUrl: string
  private voiceProfiles: Map<string, VoiceProfile> = new Map()

  constructor() {
    this.ttsBaseUrl = process.env.TTS_SERVICE_URL || 'http://localhost:4779'
    this.initializeDefaultProfiles()
  }

  async synthesizeChatResponse(
    response: string,
    personaProfile: PersonaProfile,
    options: VoiceSynthesisOptions = {}
  ): Promise<VoiceSynthesisResult> {
    // Select appropriate voice profile
    const voiceProfile = await this.selectVoiceProfile(personaProfile)
    if (!voiceProfile) {
      throw new Error(`No voice profile found for persona ${personaProfile.personId}`)
    }

    // Determine synthesis style from persona and options
    const synthesisStyle = this.determineSynthesisStyle(personaProfile, options)
    
    // Prepare synthesis request
    const synthesisRequest = {
      text: response,
      voiceProfileId: voiceProfile.id,
      style: synthesisStyle,
      options: {
        speed: options.speed || 1.0,
        emotion: options.emotion || this.extractEmotionFromPersona(personaProfile),
        streaming: false,
        priority: options.priority || 'normal'
      }
    }

    // Call TTS service
    const startTime = Date.now()
    const httpResponse = await fetch(`${this.ttsBaseUrl}/api/tts/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(synthesisRequest)
    })

    if (!httpResponse.ok) {
      throw new Error(`TTS synthesis failed: ${httpResponse.statusText}`)
    }

    const result = await httpResponse.json()
    const synthesisTime = Date.now() - startTime

    // Update last used timestamp
    voiceProfile.lastUsed = new Date()
    this.voiceProfiles.set(voiceProfile.id, voiceProfile)

    return {
      audioUrl: result.audioUrl,
      duration: result.duration,
      voiceProfile,
      metadata: {
        synthesisTime,
        tokens: this.estimateTokens(response),
        model: result.model || 'qwen3-tts',
        quality: this.determineQuality(result)
      }
    }
  }

  async selectVoiceProfile(personaProfile: PersonaProfile): Promise<VoiceProfile | null> {
    // First try to find a profile directly linked to this persona
    const linkedProfile = Array.from(this.voiceProfiles.values())
      .find(profile => profile.personaId === personaProfile.personId && profile.isActive)

    if (linkedProfile) {
      return linkedProfile
    }

    // Try to match by style characteristics
    const bestMatch = this.findBestStyleMatch(personaProfile)
    return bestMatch
  }

  async streamSynthesis(
    response: string,
    voiceProfile: VoiceProfile,
    options: VoiceSynthesisOptions = {}
  ): Promise<AsyncIterable<VoiceChunk>> {
    const synthesisRequest = {
      text: response,
      voiceProfileId: voiceProfile.id,
      style: options.style || 'warm',
      options: {
        speed: options.speed || 1.0,
        emotion: options.emotion,
        streaming: true,
        priority: options.priority || 'normal'
      }
    }

    const httpResponse = await fetch(`${this.ttsBaseUrl}/api/tts/synthesize/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(synthesisRequest)
    })

    if (!httpResponse.ok) {
      throw new Error(`TTS streaming failed: ${httpResponse.statusText}`)
    }

    return this.createStreamIterator(httpResponse.body!)
  }

  private determineSynthesisStyle(
    personaProfile: PersonaProfile,
    options: VoiceSynthesisOptions
  ): string {
    if (options.style) {
      return options.style
    }

    // Determine style from persona characteristics
    const tone = personaProfile.writingStyle.tone
    const formality = personaProfile.writingStyle.formality

    if (tone.warmth > 0.7 && tone.storytelling > 0.6) {
      return 'warm'
    } else if (formality === 'very_formal') {
      return 'formal'
    } else if (tone.humor > 0.6) {
      return 'excited'
    } else if (tone.emotionalIntensity > 0.7) {
      return 'nostalgic'
    } else {
      return 'casual'
    }
  }

  private extractEmotionFromPersona(personaProfile: PersonaProfile): string {
    const tone = personaProfile.writingStyle.tone
    
    if (tone.warmth > 0.7) return 'warm'
    if (tone.optimism > 0.6) return 'optimistic'
    if (tone.emotionalIntensity > 0.7) return 'emotional'
    if (tone.humor > 0.6) return 'playful'
    if (tone.storytelling > 0.6) return 'narrative'
    
    return 'neutral'
  }

  private findBestStyleMatch(personaProfile: PersonaProfile): VoiceProfile | null {
    const profiles = Array.from(this.voiceProfiles.values()).filter(p => p.isActive)
    
    if (profiles.length === 0) return null

    // Calculate style similarity scores
    const scores = profiles.map(profile => ({
      profile,
      score: this.calculateStyleSimilarity(personaProfile.writingStyle.tone, profile.style)
    }))

    // Return the profile with the highest similarity score
    const bestMatch = scores.reduce((best, current) => 
      current.score > best.score ? current : best
    )

    return bestMatch.score > 0.3 ? bestMatch.profile : null
  }

  private calculateStyleSimilarity(personaTone: any, voiceStyle: VoiceStyle): number {
    // Simple similarity calculation based on key characteristics
    let similarity = 0

    // Warmth matching
    similarity += (1 - Math.abs(personaTone.warmth - voiceStyle.warmth)) * 0.3

    // Formality matching
    const personaFormality = personaTone.formality || 0.5
    similarity += (1 - Math.abs(personaFormality - voiceStyle.formality)) * 0.2

    // Emotional intensity matching
    similarity += (1 - Math.abs(personaTone.emotionalIntensity - voiceStyle.emotionalIntensity)) * 0.2

    // Storytelling matching
    similarity += (1 - Math.abs(personaTone.storytelling - voiceStyle.storytelling)) * 0.2

    // Humor matching
    similarity += (1 - Math.abs(personaTone.humor - voiceStyle.humor)) * 0.1

    return similarity
  }

  private async createStreamIterator(stream: ReadableStream): AsyncIterable<VoiceChunk> {
    const reader = stream.getReader()
    const decoder = new TextDecoder()

    return {
      async *[Symbol.asyncIterator]() {
        let sequence = 0
        const timestamp = Date.now()

        try {
          while (true) {
            const { done, value } = await reader.read()
            
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                
                if (data === '[DONE]') {
                  yield {
                    audio: new ArrayBuffer(0),
                    isFinal: true,
                    timestamp,
                    sequence: sequence++
                  }
                  return
                }

                try {
                  const parsed = JSON.parse(data)
                  if (parsed.audio) {
                    const audioBuffer = this.base64ToArrayBuffer(parsed.audio)
                    yield {
                      audio: audioBuffer,
                      isFinal: false,
                      timestamp,
                      sequence: sequence++
                    }
                  }
                } catch (e) {
                  // Skip invalid JSON
                  continue
                }
              }
            }
          }
        } finally {
          reader.releaseLock()
        }
      }
    }
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    
    return bytes.buffer
  }

  private estimateTokens(text: string): number {
    // Rough token estimation (approximately 4 characters per token)
    return Math.ceil(text.length / 4)
  }

  private determineQuality(result: any): 'low' | 'medium' | 'high' {
    // Determine quality based on synthesis parameters and result metadata
    if (result.quality) return result.quality
    
    // Default to medium for now
    return 'medium'
  }

  private initializeDefaultProfiles(): void {
    // Create some default voice profiles for testing
    const defaultProfiles: VoiceProfile[] = [
      {
        id: 'default_warm',
        name: 'Warm Grandparent',
        description: 'A warm, gentle voice perfect for storytelling',
        style: {
          warmth: 0.8,
          formality: 0.4,
          emotionalIntensity: 0.6,
          storytelling: 0.7,
          humor: 0.5,
          pace: 0.9,
          pitch: 1.0
        },
        createdAt: new Date(),
        isActive: true
      },
      {
        id: 'default_formal',
        name: 'Formal Elder',
        description: 'A more formal, dignified voice',
        style: {
          warmth: 0.5,
          formality: 0.8,
          emotionalIntensity: 0.4,
          storytelling: 0.5,
          humor: 0.2,
          pace: 1.0,
          pitch: 1.1
        },
        createdAt: new Date(),
        isActive: true
      },
      {
        id: 'default_casual',
        name: 'Casual Family Member',
        description: 'A relaxed, casual voice for everyday conversations',
        style: {
          warmth: 0.6,
          formality: 0.3,
          emotionalIntensity: 0.5,
          storytelling: 0.4,
          humor: 0.6,
          pace: 1.1,
          pitch: 0.9
        },
        createdAt: new Date(),
        isActive: true
      }
    ]

    defaultProfiles.forEach(profile => {
      this.voiceProfiles.set(profile.id, profile)
    })
  }

  // Public methods for voice profile management
  async createVoiceProfile(profile: Omit<VoiceProfile, 'id' | 'createdAt'>): Promise<VoiceProfile> {
    const newProfile: VoiceProfile = {
      ...profile,
      id: `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date()
    }

    this.voiceProfiles.set(newProfile.id, newProfile)
    return newProfile
  }

  async listVoiceProfiles(): Promise<VoiceProfile[]> {
    return Array.from(this.voiceProfiles.values()).filter(profile => profile.isActive)
  }

  async updateVoiceProfile(id: string, updates: Partial<VoiceProfile>): Promise<VoiceProfile> {
    const existing = this.voiceProfiles.get(id)
    if (!existing) {
      throw new Error(`Voice profile ${id} not found`)
    }

    const updated: VoiceProfile = {
      ...existing,
      ...updates,
      id // Ensure ID doesn't change
    }

    this.voiceProfiles.set(id, updated)
    return updated
  }

  async deleteVoiceProfile(id: string): Promise<void> {
    const exists = this.voiceProfiles.has(id)
    if (!exists) {
      throw new Error(`Voice profile ${id} not found`)
    }

    this.voiceProfiles.delete(id)
  }
}
