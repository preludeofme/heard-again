/**
 * Services Index - Centralized export for all domain services
 * Finding 5.1: Create Service Layer
 */

import { prisma } from '@/lib/prisma'
import { StoryService } from './StoryService'
import { PersonService } from './PersonService'
import { StorageService } from './StorageService'
import { RelationshipService } from './RelationshipService'
import { SearchService } from './SearchService'
import { VoiceService } from './VoiceService'

// Singleton instances for server-side usage
export const storyService = new StoryService(prisma)
export const personService = new PersonService(prisma)
export const voiceService = new VoiceService(prisma)
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

// Factory for creating fresh instances with custom dependencies
export function createServices(client = prisma) {
  return {
    story: new StoryService(client),
    person: new PersonService(client),
    voice: new VoiceService(client),
    search: new SearchService(client),
    relationship: new RelationshipService(client),
    storage: storageService,
  }
}
