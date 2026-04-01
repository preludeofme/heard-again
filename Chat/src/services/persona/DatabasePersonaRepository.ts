import { PersonaProfile, PersonaFact, Relationship } from '@/types'
import { PersonaRepository } from './PersonaRepository'

// Define the Prisma types (these would normally come from generated Prisma client)
interface PrismaPersonaProfile {
  id: string
  personId: string
  workspaceId: string
  version: number
  status: string
  writingStyle: any
  knownFacts: any
  relationships: any
  systemPrompt: string
  responseGuidelines: any
  customInstructions: any
  documentSampleCount: number
  confidenceScore: number
  lastUpdated: Date
  createdAt: Date
}

export class DatabasePersonaRepository implements PersonaRepository {
  constructor(private prisma: any) {} // PrismaClient will be injected

  async getPersonaProfile(personId: string, workspaceId: string): Promise<PersonaProfile | null> {
    const profile = await this.prisma.personaProfile.findUnique({
      where: { 
        personId,
        workspaceId // Add workspaceId to query for defense-in-depth
      }
    })

    if (!profile) return null

    return this.mapDbPersonaToPersonaProfile(profile)
  }

  async createPersonaProfile(profile: PersonaProfile): Promise<PersonaProfile> {
    const dbProfile = await this.prisma.personaProfile.create({
      data: {
        personId: profile.personId,
        workspaceId: profile.workspaceId,
        version: profile.version,
        status: this.mapPersonaStatusToDb(profile.status),
        writingStyle: profile.writingStyle,
        knownFacts: profile.knownFacts,
        relationships: profile.relationships,
        systemPrompt: profile.systemPrompt,
        responseGuidelines: profile.responseGuidelines,
        customInstructions: profile.customInstructions,
        documentSampleCount: profile.documentSampleCount,
        confidenceScore: profile.confidenceScore
      }
    })

    return this.mapDbPersonaToPersonaProfile(dbProfile)
  }

  async updatePersonaProfile(personId: string, updates: Partial<PersonaProfile>, workspaceId?: string): Promise<PersonaProfile> {
    const existing = await this.prisma.personaProfile.findUnique({
      where: { personId }
    })

    if (!existing) {
      throw new Error(`Persona profile not found for person ${personId}`)
    }

    // Defense-in-depth: ensure callers cannot mutate a profile from another workspace
    if (workspaceId && existing.workspaceId !== workspaceId) {
      throw new Error(`Persona profile not found for person ${personId}`)
    }

    const updateData: any = {
      version: existing.version + 1,
      lastUpdated: new Date()
    }

    if (updates.writingStyle) updateData.writingStyle = updates.writingStyle
    if (updates.knownFacts) updateData.knownFacts = updates.knownFacts
    if (updates.relationships) updateData.relationships = updates.relationships
    if (updates.systemPrompt) updateData.systemPrompt = updates.systemPrompt
    if (updates.responseGuidelines) updateData.responseGuidelines = updates.responseGuidelines
    if (updates.customInstructions) updateData.customInstructions = updates.customInstructions
    if (updates.status) updateData.status = this.mapPersonaStatusToDb(updates.status)
    if (updates.documentSampleCount !== undefined) updateData.documentSampleCount = updates.documentSampleCount
    if (updates.confidenceScore !== undefined) updateData.confidenceScore = updates.confidenceScore

    const updatedProfile = await this.prisma.personaProfile.update({
      where: { personId },
      data: updateData
    })

    return this.mapDbPersonaToPersonaProfile(updatedProfile)
  }

  async deletePersonaProfile(personId: string, workspaceId?: string): Promise<void> {
    const exists = await this.prisma.personaProfile.findUnique({
      where: { personId }
    })

    if (!exists) {
      throw new Error(`Persona profile not found for person ${personId}`)
    }

    // Defense-in-depth: ensure callers cannot delete a profile from another workspace
    if (workspaceId && exists.workspaceId !== workspaceId) {
      throw new Error(`Persona profile not found for person ${personId}`)
    }

    await this.prisma.personaProfile.delete({
      where: { personId }
    })
  }

  async listPersonaProfiles(workspaceId: string): Promise<PersonaProfile[]> {
    const profiles = await this.prisma.personaProfile.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' }
    })

    return profiles.map((profile: PrismaPersonaProfile) => this.mapDbPersonaToPersonaProfile(profile))
  }

  async getPersonaFacts(personId: string, workspaceId: string): Promise<PersonaFact[]> {
    const profile = await this.getPersonaProfile(personId, workspaceId)
    return profile?.knownFacts || []
  }

  async getPersonaRelationships(personId: string, workspaceId: string): Promise<Relationship[]> {
    const profile = await this.getPersonaProfile(personId, workspaceId)
    return profile?.relationships || []
  }

  private mapDbPersonaToPersonaProfile(dbProfile: PrismaPersonaProfile): PersonaProfile {
    return {
      id: dbProfile.id,
      personId: dbProfile.personId,
      workspaceId: dbProfile.workspaceId,
      version: dbProfile.version,
      status: this.mapDbPersonaStatus(dbProfile.status),
      writingStyle: dbProfile.writingStyle,
      knownFacts: dbProfile.knownFacts,
      relationships: dbProfile.relationships,
      systemPrompt: dbProfile.systemPrompt,
      responseGuidelines: dbProfile.responseGuidelines,
      customInstructions: dbProfile.customInstructions || {
        relationshipInstructions: {},
        behaviorInstructions: [],
        topicInstructions: {},
        contextInstructions: {},
        styleOverrides: {}
      },
      documentSampleCount: dbProfile.documentSampleCount,
      confidenceScore: dbProfile.confidenceScore,
      lastUpdated: dbProfile.lastUpdated,
      createdAt: dbProfile.createdAt
    }
  }

  private mapPersonaStatusToDb(status: PersonaProfile['status']): string {
    switch (status) {
      case 'draft': return 'DRAFT'
      case 'active': return 'ACTIVE'
      case 'archived': return 'ARCHIVED'
      default: return 'DRAFT'
    }
  }

  private mapDbPersonaStatus(status: string): PersonaProfile['status'] {
    switch (status) {
      case 'DRAFT': return 'draft'
      case 'ACTIVE': return 'active'
      case 'ARCHIVED': return 'archived'
      default: return 'draft'
    }
  }
}
