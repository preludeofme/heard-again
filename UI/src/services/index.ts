/**
 * Services Index - Centralized export for all domain services
 * Finding 5.1: Create Service Layer
 */

import { prisma } from '@/lib/prisma'
import { personRepository } from '@/server/repositories/PersonRepository'
import { storyRepository } from '@/server/repositories/StoryRepository'
import { voiceProfileRepository } from '@/server/repositories/VoiceProfileRepository'
import { voiceConsentRepository } from '@/server/repositories/VoiceConsentRepository'
import { assetRepository } from '@/server/repositories/AssetRepository'
import { StoryService } from './StoryService'
import { PersonService } from './PersonService'
import { StorageService } from './StorageService'
import { RelationshipService } from './RelationshipService'
import { SearchService } from './SearchService'
import { VoiceService } from './VoiceService'
import { ImageProcessingService } from './ImageProcessingService'

// Singleton instances for server-side usage
export const storyService = new StoryService(storyRepository)
export const personService = new PersonService(personRepository)
export const voiceService = new VoiceService(voiceProfileRepository, voiceConsentRepository, assetRepository)
export const searchService = new SearchService(prisma)
export const relationshipService = new RelationshipService(prisma)
export const storageService = new StorageService({
  type: 'LOCAL',
  basePath: process.cwd(),
  publicUrlPrefix: undefined,
})

// Re-export classes for custom instantiation (testing, etc.)
export { StoryService } from './StoryService'
export { PersonService } from './PersonService'
export { StorageService } from './StorageService'
export { RelationshipService } from './RelationshipService'
export { SearchService } from './SearchService'
export { VoiceService } from './VoiceService'
export { ImageProcessingService } from './ImageProcessingService'

// Factory for creating fresh instances with custom dependencies
export function createServices(client = prisma) {
  return {
    story: new StoryService(storyRepository),
    person: new PersonService(personRepository),
    voice: new VoiceService(voiceProfileRepository, voiceConsentRepository, assetRepository),
    search: new SearchService(client),
    relationship: new RelationshipService(client),
    storage: storageService,
  }
}

// Chat Service Factory for chat-system integration
export class ServiceFactory {
  // Basic chat service implementation for the main project
  // This delegates to the chat-system services when needed
  static getChatService() {
    // For now, return a basic implementation
    // In a full implementation, this would integrate with the chat-system
    return {
      createSession: async (request: any) => {
        // Basic implementation
        throw new Error('Chat service not fully implemented in main project')
      },
      sendMessage: async (request: any) => {
        // Basic implementation  
        throw new Error('Chat service not fully implemented in main project')
      },
      getHistory: async (sessionId: string, limit?: number, offset?: number) => {
        // Basic implementation
        throw new Error('Chat service not fully implemented in main project')
      },
      getSession: async (sessionId: string) => {
        // Basic implementation
        throw new Error('Chat service not fully implemented in main project')
      },
      updateSession: async (sessionId: string, updates: any) => {
        // Basic implementation
        throw new Error('Chat service not fully implemented in main project')
      },
      deleteSession: async (sessionId: string) => {
        // Basic implementation
        throw new Error('Chat service not fully implemented in main project')
      },
      listSessions: async (workspaceId: string, userId: string) => {
        // Basic implementation
        throw new Error('Chat service not fully implemented in main project')
      },
      storeUserMessage: async (sessionId: string, message: string) => {
        // Basic implementation
        throw new Error('Chat service not fully implemented in main project')
      },
      updateAssistantMessage: async (messageId: string, content: string, metadata?: any) => {
        // Basic implementation
        throw new Error('Chat service not fully implemented in main project')
      },
      streamResponse: async (request: any) => {
        // Basic implementation
        throw new Error('Chat service not fully implemented in main project')
      }
    }
  }
}
