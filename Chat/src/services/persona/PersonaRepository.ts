import { PersonaProfile, PersonaFact, Relationship } from '@/types'

export interface PersonaRepository {
  getPersonaProfile(personId: string): Promise<PersonaProfile | null>
  createPersonaProfile(profile: PersonaProfile): Promise<PersonaProfile>
  updatePersonaProfile(personId: string, updates: Partial<PersonaProfile>): Promise<PersonaProfile>
  deletePersonaProfile(personId: string): Promise<void>
  listPersonaProfiles(workspaceId: string): Promise<PersonaProfile[]>
  getPersonaFacts(personId: string): Promise<PersonaFact[]>
  getPersonaRelationships(personId: string): Promise<Relationship[]>
}

export class PersonaRepositoryImpl implements PersonaRepository {
  // In-memory storage for development - in production this would use a database
  private profiles: Map<string, PersonaProfile> = new Map()
  private facts: Map<string, PersonaFact[]> = new Map()
  private relationships: Map<string, Relationship[]> = new Map()

  async getPersonaProfile(personId: string): Promise<PersonaProfile | null> {
    return this.profiles.get(personId) || null
  }

  async createPersonaProfile(profile: PersonaProfile): Promise<PersonaProfile> {
    // Check if profile already exists
    const existing = this.profiles.get(profile.personId)
    if (existing) {
      throw new Error(`Persona profile already exists for person ${profile.personId}`)
    }

    this.profiles.set(profile.personId, profile)
    return profile
  }

  async updatePersonaProfile(personId: string, updates: Partial<PersonaProfile>): Promise<PersonaProfile> {
    const existing = this.profiles.get(personId)
    if (!existing) {
      throw new Error(`Persona profile not found for person ${personId}`)
    }

    const updatedProfile: PersonaProfile = {
      ...existing,
      ...updates,
      personId, // Ensure personId doesn't change
      id: existing.id, // Ensure id doesn't change
      version: existing.version + 1
    }

    this.profiles.set(personId, updatedProfile)
    return updatedProfile
  }

  async deletePersonaProfile(personId: string): Promise<void> {
    const exists = this.profiles.has(personId)
    if (!exists) {
      throw new Error(`Persona profile not found for person ${personId}`)
    }

    this.profiles.delete(personId)
    this.facts.delete(personId)
    this.relationships.delete(personId)
  }

  async listPersonaProfiles(workspaceId: string): Promise<PersonaProfile[]> {
    return Array.from(this.profiles.values()).filter(profile => profile.workspaceId === workspaceId)
  }

  async getPersonaFacts(personId: string): Promise<PersonaFact[]> {
    return this.facts.get(personId) || []
  }

  async getPersonaRelationships(personId: string): Promise<Relationship[]> {
    return this.relationships.get(personId) || []
  }

  // Helper methods for testing and development
  async savePersonaFacts(personId: string, facts: PersonaFact[]): Promise<void> {
    this.facts.set(personId, facts)
  }

  async savePersonaRelationships(personId: string, relationships: Relationship[]): Promise<void> {
    this.relationships.set(personId, relationships)
  }

  // Clear all data (for testing)
  clear(): void {
    this.profiles.clear()
    this.facts.clear()
    this.relationships.clear()
  }

  // Get storage stats (for monitoring)
  getStats(): {
    profilesCount: number
    factsCount: number
    relationshipsCount: number
  } {
    let factsCount = 0
    let relationshipsCount = 0

    this.facts.forEach(facts => {
      factsCount += facts.length
    })

    this.relationships.forEach(relationships => {
      relationshipsCount += relationships.length
    })

    return {
      profilesCount: this.profiles.size,
      factsCount,
      relationshipsCount
    }
  }
}
