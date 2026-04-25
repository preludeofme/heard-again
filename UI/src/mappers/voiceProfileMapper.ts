/**
 * Voice Profile Mapper
 * Finding 5.6: Create Data Mappers - Eliminates duplicated mapping logic
 */

import type { VoiceModel } from '@/types'
import type { VoiceProfileListItem } from '@/contracts'

export interface VoiceProfileResponse {
  id: string
  name: string
  displayName?: string | null
  status?: string
  language?: string
  sampleCount?: number
  createdAt: string | Date
  modelPath?: string | null
  hasConsent?: boolean
  person?: {
    id: string
    firstName: string
    lastName?: string | null
  } | null
}

/**
 * Map API voice profile response to component VoiceModel format
 */
export function toVoiceModel(profile: VoiceProfileResponse): VoiceModel {
  return {
    id: profile.id,
    userId: '', // Not provided in response, to be filled by caller if needed
    name: profile.name,
    displayName: profile.displayName ?? profile.name,
    status: (profile.status ?? 'READY').toLowerCase() === 'ready' ? 'ready' : 'training',
    language: profile.language ?? 'en',
    sampleCount: profile.sampleCount ?? 0,
    createdAt: typeof profile.createdAt === 'string' ? profile.createdAt : profile.createdAt.toISOString(),
    modelPath: profile.modelPath ?? undefined,
    hasConsent: profile.hasConsent,
    person: profile.person ? {
      id: profile.person.id,
      firstName: profile.person.firstName,
      lastName: profile.person.lastName ?? undefined,
    } : undefined,
  }
}

/**
 * Map array of API responses to VoiceModel array
 */
export function toVoiceModelArray(profiles: VoiceProfileResponse[]): VoiceModel[] {
  return profiles.map(toVoiceModel)
}

/**
 * Map API voice profile to list item format
 */
export function toVoiceProfileListItem(profile: VoiceProfileListItem): VoiceModel {
  return {
    id: profile.id,
    userId: '',
    name: profile.name,
    displayName: profile.displayName ?? profile.name,
    status: profile.status.toLowerCase() === 'ready' ? 'ready' : 'training',
    language: profile.language,
    sampleCount: profile.sampleCount,
    createdAt: typeof profile.createdAt === 'string' ? profile.createdAt : profile.createdAt.toISOString(),
    modelPath: profile.modelPath ?? undefined,
  }
}
