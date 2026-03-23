/**
 * Services Index - Centralized export for all domain services
 * Finding 5.1: Create Service Layer
 */

import { prisma } from '@/lib/prisma'
import { StoryService } from './StoryService'
import { PersonService } from './PersonService'
import { StorageService } from './StorageService'

// Singleton instances for server-side usage
export const storyService = new StoryService(prisma)
export const personService = new PersonService(prisma)
export const storageService = new StorageService({
  type: 'LOCAL',
  basePath: process.cwd(),
  publicUrlPrefix: undefined,
})

// Re-export classes for custom instantiation (testing, etc.)
export { StoryService } from './StoryService'
export { PersonService } from './PersonService'
export { StorageService } from './StorageService'

// Factory for creating fresh instances with custom dependencies
export function createServices(client = prisma) {
  return {
    story: new StoryService(client),
    person: new PersonService(client),
    storage: storageService,
  }
}
