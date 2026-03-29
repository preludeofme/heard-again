import { PersonaProfile, InstructionContext } from '@/types'

export interface InstructionProcessor {
  processInstructions(
    persona: PersonaProfile,
    context?: InstructionContext
  ): ProcessedInstructions
  getRelevantInstructions(
    persona: PersonaProfile,
    context?: InstructionContext
  ): string[]
}

export interface ProcessedInstructions {
  relationshipInstructions: string[]
  behaviorInstructions: string[]
  topicInstructions: string[]
  contextInstructions: string[]
  styleOverrides: PersonaProfile['customInstructions']['styleOverrides']
  allInstructions: string[]
}

export class InstructionProcessorImpl implements InstructionProcessor {
  processInstructions(
    persona: PersonaProfile,
    context?: InstructionContext
  ): ProcessedInstructions {
    const customInstructions = persona.customInstructions

    // Get relationship-specific instructions
    const relationshipInstructions = this.getRelationshipInstructions(
      customInstructions.relationshipInstructions,
      context?.currentUserId,
      context?.relationshipToUser
    )

    // Get behavior instructions (always included)
    const behaviorInstructions = [...customInstructions.behaviorInstructions]

    // Get topic-specific instructions
    const topicInstructions = this.getTopicInstructions(
      customInstructions.topicInstructions,
      context?.conversationTopic
    )

    // Get context-specific instructions
    const contextInstructions = this.getContextInstructions(
      customInstructions.contextInstructions,
      context?.userMood,
      context?.recentMessages
    )

    // Get style overrides
    const styleOverrides = customInstructions.styleOverrides

    // Combine all instructions
    const allInstructions = [
      ...relationshipInstructions,
      ...behaviorInstructions,
      ...topicInstructions,
      ...contextInstructions
    ]

    return {
      relationshipInstructions,
      behaviorInstructions,
      topicInstructions,
      contextInstructions,
      styleOverrides,
      allInstructions
    }
  }

  getRelevantInstructions(
    persona: PersonaProfile,
    context?: InstructionContext
  ): string[] {
    const processed = this.processInstructions(persona, context)
    return processed.allInstructions
  }

  private getRelationshipInstructions(
    instructions: { [key: string]: string },
    currentUserId?: string,
    relationshipToUser?: string
  ): string[] {
    const relevantInstructions: string[] = []

    // Add instructions for specific user ID
    if (currentUserId && instructions[currentUserId]) {
      relevantInstructions.push(instructions[currentUserId])
    }

    // Add instructions for relationship type
    if (relationshipToUser && instructions[relationshipToUser]) {
      relevantInstructions.push(instructions[relationshipToUser])
    }

    // Add general relationship instructions (wildcards)
    Object.entries(instructions).forEach(([key, instruction]) => {
      if (key.startsWith('*') || key.startsWith('any')) {
        relevantInstructions.push(instruction)
      }
    })

    return relevantInstructions
  }

  private getTopicInstructions(
    instructions: { [key: string]: string },
    topic?: string
  ): string[] {
    if (!topic) return []

    const relevantInstructions: string[] = []

    // Direct topic match
    if (instructions[topic]) {
      relevantInstructions.push(instructions[topic])
    }

    // Partial topic matches (e.g., "family" matches "family_history")
    Object.entries(instructions).forEach(([key, instruction]) => {
      if (topic.includes(key) || key.includes(topic)) {
        if (key !== topic) { // Avoid duplicates
          relevantInstructions.push(instruction)
        }
      }
    })

    return relevantInstructions
  }

  private getContextInstructions(
    instructions: { [key: string]: string },
    userMood?: string,
    recentMessages?: string[]
  ): string[] {
    const relevantInstructions: string[] = []

    // Mood-based instructions
    if (userMood && instructions[userMood]) {
      relevantInstructions.push(instructions[userMood])
    }

    // Analyze recent messages for context
    if (recentMessages && recentMessages.length > 0) {
      const detectedContexts = this.analyzeMessageContext(recentMessages)
      
      detectedContexts.forEach(context => {
        if (instructions[context]) {
          relevantInstructions.push(instructions[context])
        }
      })
    }

    return relevantInstructions
  }

  private analyzeMessageContext(messages: string[]): string[] {
    const contexts: string[] = []
    const recentText = messages.join(' ').toLowerCase()

    // Detect emotional contexts
    if (recentText.includes('sad') || recentText.includes('cry') || recentText.includes('upset')) {
      contexts.push('sad_user')
    }

    if (recentText.includes('happy') || recentText.includes('celebrate') || recentText.includes('excited')) {
      contexts.push('celebration')
    }

    if (recentText.includes('argue') || recentText.includes('fight') || recentText.includes('disagree')) {
      contexts.push('conflict')
    }

    if (recentText.includes('help') || recentText.includes('advice') || recentText.includes('what should')) {
      contexts.push('seeking_advice')
    }

    if (recentText.includes('remember') || recentText.includes('tell me about') || recentText.includes('story')) {
      contexts.push('storytelling')
    }

    return contexts
  }

  // Helper method to apply style overrides to writing style
  applyStyleOverrides(
    baseStyle: PersonaProfile['writingStyle'],
    overrides: PersonaProfile['customInstructions']['styleOverrides']
  ): PersonaProfile['writingStyle'] {
    const updatedStyle = { ...baseStyle }

    if (overrides.formality !== undefined) {
      updatedStyle.formality = overrides.formality
    }

    if (overrides.warmth !== undefined) {
      updatedStyle.tone.warmth = overrides.warmth
    }

    if (overrides.humor !== undefined) {
      updatedStyle.tone.humor = overrides.humor
    }

    if (overrides.storytelling !== undefined) {
      updatedStyle.tone.storytelling = overrides.storytelling
    }

    return updatedStyle
  }

  // Helper method to generate contextual system prompt
  generateContextualPrompt(
    persona: PersonaProfile,
    context?: InstructionContext
  ): string {
    const processed = this.processInstructions(persona, context)
    
    let prompt = persona.systemPrompt

    // Add contextual instructions at the end for immediate effect
    if (processed.allInstructions.length > 0) {
      prompt += '\n\nAdditional instructions for this conversation:'
      processed.allInstructions.forEach(instruction => {
        prompt += `\n- ${instruction}`
      })
    }

    return prompt
  }

  // Helper method to validate instruction format
  validateInstruction(
    category: 'relationship' | 'behavior' | 'topic' | 'context',
    instruction: string,
    key?: string
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check instruction length
    if (instruction.length < 5) {
      errors.push('Instruction must be at least 5 characters long')
    }

    if (instruction.length > 500) {
      errors.push('Instruction must be less than 500 characters long')
    }

    // Check for required key in certain categories
    if ((category === 'relationship' || category === 'topic' || category === 'context') && !key) {
      errors.push(`Key is required for ${category} instructions`)
    }

    // Check for prohibited patterns
    const prohibitedPatterns = [
      /ignore.*previous/gi,
      /disregard.*instructions/gi,
      /system.*prompt/gi,
      /act.*different/gi
    ]

    prohibitedPatterns.forEach(pattern => {
      if (pattern.test(instruction)) {
        errors.push('Instruction contains prohibited content')
      }
    })

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}
