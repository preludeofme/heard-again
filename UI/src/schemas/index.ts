/**
 * Zod Validation Schemas
 * Finding 5.2: Add Zod Schema Validation
 * Replaces inline validation with type-safe schema validation
 */

import { z } from 'zod'
import {
  StoryStatus,
  StoryType,
  DatePrecision,
  PersonType,
  VoiceProfileStatus,
  GenerationJobStatus,
  AssetType,
  ProcessingStatus,
} from '@/contracts'

// ============================================
// Common Schemas
// ============================================

export const uuidSchema = z.string().uuid()

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const dateStringSchema = z.string().datetime().or(z.string().date())

// ============================================
// Story Schemas
// ============================================

export const storyStatusSchema = z.nativeEnum(StoryStatus)

export const storyTypeSchema = z.nativeEnum(StoryType)

export const datePrecisionSchema = z.enum(['EXACT', 'YEAR_MONTH', 'YEAR', 'DECADE', 'APPROXIMATE'])

export const createStorySchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1),
  storyType: storyTypeSchema.optional(),
  subjectId: uuidSchema.optional(),
  speakerId: uuidSchema.optional(),
  excerpt: z.string().max(500).optional(),
  storyDate: z.string().datetime().or(z.string().date()).optional(),
  storyDatePrecision: datePrecisionSchema.optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  status: storyStatusSchema.optional(),
})

export type CreateStoryInput = z.infer<typeof createStorySchema>

export const updateStorySchema = createStorySchema.partial().extend({
  id: uuidSchema,
})

export type UpdateStoryInput = z.infer<typeof updateStorySchema>

export const listStoriesQuerySchema = paginationSchema.extend({
  search: z.string().max(200).optional(),
  status: storyStatusSchema.optional(),
  subjectId: uuidSchema.optional(),
  speakerId: uuidSchema.optional(),
  type: storyTypeSchema.optional(),
})

export type ListStoriesQuery = z.infer<typeof listStoriesQuerySchema>

// ============================================
// Person Schemas
// ============================================

export const personTypeSchema = z.nativeEnum(PersonType)

// Base schema without refinements - used for both create and update
const basePersonSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  displayName: z.string().max(200).optional(),
  nickname: z.string().max(100).optional(),
  maidenName: z.string().max(100).optional(),
  suffix: z.string().max(20).optional(),
  middleName: z.string().max(100).optional(),
  birthDate: z.string().datetime().or(z.string().date()).optional(),
  deathDate: z.string().datetime().or(z.string().date()).optional(),
  isDeceased: z.boolean().optional(),
  bio: z.string().max(5000).optional(),
  personType: personTypeSchema.optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
})

const personRefinements = [
  (data: any) => {
    // If death date is provided, person should be marked deceased
    if (data.deathDate && !data.isDeceased) {
      return false
    }
    return true
  },
  (data: any) => {
    // Birth date should not be after death date
    if (data.birthDate && data.deathDate) {
      return new Date(data.birthDate) <= new Date(data.deathDate)
    }
    return true
  },
]

const personRefinementMessages = [
  {
    message: 'Person with death date must be marked as deceased',
    path: ['isDeceased'],
  },
  {
    message: 'Birth date cannot be after death date',
    path: ['birthDate'],
  },
]

export const createPersonSchema = basePersonSchema
  .refine(personRefinements[0], personRefinementMessages[0])
  .refine(personRefinements[1], personRefinementMessages[1])

export type CreatePersonInput = z.infer<typeof createPersonSchema>

export const updatePersonSchema = basePersonSchema
  .partial()
  .extend({
    id: uuidSchema,
  })
  .refine(personRefinements[0], personRefinementMessages[0])
  .refine(personRefinements[1], personRefinementMessages[1])

export type UpdatePersonInput = z.infer<typeof updatePersonSchema>

export const listPeopleQuerySchema = paginationSchema.extend({
  search: z.string().max(200).optional(),
  type: personTypeSchema.optional(),
})

export type ListPeopleQuery = z.infer<typeof listPeopleQuerySchema>

// ============================================
// Voice Schemas
// ============================================

export const voiceProfileStatusSchema = z.nativeEnum(VoiceProfileStatus)

export const generationJobStatusSchema = z.nativeEnum(GenerationJobStatus)

export const synthesizeVoiceSchema = z.object({
  modelId: uuidSchema,
  text: z.string().min(1).max(10000),
  language: z.string().max(10).default('en'),
})

export type SynthesizeVoiceInput = z.infer<typeof synthesizeVoiceSchema>

export const createVoiceProfileSchema = z.object({
  userId: z.string().min(1).max(100),
  samples: z.array(z.string().min(1)).min(1),
  language: z.string().max(10).default('en'),
  modelName: z.string().min(1).max(100),
  styleInstruct: z.string().max(500).optional().nullable(),
})

export type CreateVoiceProfileInput = z.infer<typeof createVoiceProfileSchema>

export const voiceDesignSchema = z.object({
  profileName: z.string().min(1).max(100),
  instruct: z.string().min(1).max(500),
  refText: z.string().min(1).max(1000),
  language: z.string().max(20).default('English'),
})

export type VoiceDesignInput = z.infer<typeof voiceDesignSchema>

// ============================================
// Asset Schemas
// ============================================

export const assetTypeSchema = z.nativeEnum(AssetType)

export const processingStatusSchema = z.nativeEnum(ProcessingStatus)

// ============================================
// Search Schemas
// ============================================

export const searchSuggestionsSchema = z.object({
  query: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(20).default(10),
})

export type SearchSuggestionsQuery = z.infer<typeof searchSuggestionsSchema>

// ============================================
// Authentication Schemas
// ============================================

export const workspaceRoleSchema = z.enum(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'])

// ============================================
// Helper Functions for API Route Validation
// ============================================

export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): { success: true; data: T } | { success: false; error: string; details: z.ZodError } {
  const result = schema.safeParse(body)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: 'Validation failed',
    details: result.error,
  }
}

export function validateQuery<T>(schema: z.ZodSchema<T>, query: unknown): { success: true; data: T } | { success: false; error: string; details: z.ZodError } {
  const result = schema.safeParse(query)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: 'Query validation failed',
    details: result.error,
  }
}

export function formatZodError(error: z.ZodError): Record<string, string> {
  const formatted: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    formatted[path || 'root'] = issue.message
  }
  return formatted
}
