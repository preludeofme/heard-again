/**
 * API Contracts - Shared request/response types for type safety across frontend/backend
 * Finding 5.3: Define API Contracts
 */

// ============================================
// Pagination Contracts
// ============================================

export interface PaginationParams {
  page?: number
  limit?: number
}

export interface PaginationResponse {
  page: number
  limit: number
  total: number
  totalPages: number
}

// ============================================
// Story API Contracts
// ============================================

export const StoryStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const

export const StoryType = {
  MEMORY: 'MEMORY',
  INTERVIEW: 'INTERVIEW',
  LETTER: 'LETTER',
  DOCUMENT: 'DOCUMENT',
  TRIBUTE: 'TRIBUTE',
  PODCAST: 'PODCAST',
} as const

export const DatePrecision = {
  EXACT: 'EXACT',
  YEAR_MONTH: 'YEAR_MONTH',
  YEAR: 'YEAR',
  DECADE: 'DECADE',
  APPROXIMATE: 'APPROXIMATE',
} as const

export type StoryStatus = typeof StoryStatus[keyof typeof StoryStatus]
export type StoryType = typeof StoryType[keyof typeof StoryType]
export type DatePrecision = typeof DatePrecision[keyof typeof DatePrecision]

export interface StoryCounts {
  comments: number
  assets: number
  favorites: number
}

export interface StorySubject {
  id: string
  firstName: string
  lastName: string | null
}

export interface StorySpeaker {
  id: string
  firstName: string
  lastName: string | null
}

export interface StoryCreator {
  id: string
  displayName: string | null
  email: string
}

export interface StoryListItem {
  id: string
  title: string
  excerpt: string
  storyType: StoryType
  status: StoryStatus
  isPinned: boolean
  storyDate: Date | null
  storyDatePrecision: DatePrecision
  tags: string[]
  subject: StorySubject | null
  speaker: StorySpeaker | null
  createdBy: StoryCreator
  hasAudio: boolean
  counts: StoryCounts
  createdAt: Date
  updatedAt: Date
}

export interface CreateStoryRequest {
  title: string
  content: string
  storyType?: StoryType
  subjectId?: string
  speakerId?: string
  excerpt?: string
  storyDate?: string
  storyDatePrecision?: DatePrecision
  tags?: string[]
  status?: StoryStatus
}

export interface CreateStoryResponse {
  id: string
  title: string
  status: StoryStatus
  createdAt: Date
}

export interface ListStoriesRequest extends PaginationParams {
  search?: string
  status?: StoryStatus
  subjectId?: string
  speakerId?: string
  type?: StoryType
}

export interface ListStoriesResponse {
  stories: StoryListItem[]
  pagination: PaginationResponse
}

// ============================================
// Person API Contracts
// ============================================

export const PersonType = {
  FAMILY: 'FAMILY',
  FRIEND: 'FRIEND',
  MENTOR: 'MENTOR',
  COLLEAGUE: 'COLLEAGUE',
  OTHER: 'OTHER',
} as const

export type PersonType = typeof PersonType[keyof typeof PersonType]

export interface PersonCounts {
  stories: number
  voiceProfiles: number
  relationships: number
}

export interface PersonListItem {
  id: string
  firstName: string
  lastName: string | null
  displayName: string
  nickname: string | null
  personType: PersonType
  birthDate: Date | null
  deathDate: Date | null
  isDeceased: boolean
  bio: string | null
  avatarUrl: string | null
  tags: string[]
  counts: PersonCounts
  createdAt: Date
}

export interface CreatePersonRequest {
  firstName: string
  lastName?: string
  displayName?: string
  nickname?: string
  maidenName?: string
  suffix?: string
  middleName?: string
  birthDate?: string
  deathDate?: string
  isDeceased?: boolean
  bio?: string
  personType?: PersonType
  tags?: string[]
}

export interface CreatePersonResponse {
  id: string
  firstName: string
  lastName: string | null
  displayName: string
  personType: PersonType
  createdAt: Date
}

export interface ListPeopleRequest extends PaginationParams {
  search?: string
  type?: PersonType
}

// ============================================
// Voice API Contracts
// ============================================

export const VoiceProfileStatus = {
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  FAILED: 'FAILED',
} as const

export type VoiceProfileStatus = typeof VoiceProfileStatus[keyof typeof VoiceProfileStatus]

export const GenerationJobStatus = {
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const

export type GenerationJobStatus = typeof GenerationJobStatus[keyof typeof GenerationJobStatus]

export interface VoiceProfileListItem {
  id: string
  name: string
  displayName: string | null
  status: VoiceProfileStatus
  language: string
  sampleCount: number
  createdAt: Date
  modelPath: string | null
  personId: string | null
}

export interface VoiceSynthesizeRequest {
  modelId: string
  text: string
  language?: string
}

export interface VoiceSynthesizeResponse {
  success: true
  jobId: string
  audioUrl: string
  outputAssetId: string
  outputAssetDownloadUrl: string
  modelId: string
  voiceProfileId: string
  personId: string | null
  text: string
  language: string
  duration: number
  synthesisTime: number
  aiGenerated: true
  disclosureLabel: string
  watermark: {
    type: string
    value: string
  }
}

export interface CreateVoiceProfileRequest {
  userId: string
  samples: string[]
  language: string
  modelName: string
  styleInstruct?: string | null
}

export interface CreateVoiceProfileResponse {
  success: boolean
  jobId: string
  modelId: string
  dbProfileId: string
  message: string
}

// ============================================
// Asset API Contracts
// ============================================

export const AssetType = {
  UPLOADED_AUDIO: 'UPLOADED_AUDIO',
  UPLOADED_IMAGE: 'UPLOADED_IMAGE',
  UPLOADED_DOCUMENT: 'UPLOADED_DOCUMENT',
  GENERATED_AUDIO: 'GENERATED_AUDIO',
  GENERATED_IMAGE: 'GENERATED_IMAGE',
  IMPORTED: 'IMPORTED',
} as const

export type AssetType = typeof AssetType[keyof typeof AssetType]

export const ProcessingStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const

export type ProcessingStatus = typeof ProcessingStatus[keyof typeof ProcessingStatus]

export interface AssetListItem {
  id: string
  filename: string
  originalName: string
  mimeType: string
  sizeBytes: bigint
  assetType: AssetType
  processingStatus: ProcessingStatus
  storagePath: string | null
  durationSeconds: number | null
  metadata: Record<string, unknown> | null
  createdAt: Date
}

export interface UploadAssetResponse {
  id: string
  filename: string
  originalName: string
  mimeType: string
  sizeBytes: bigint
  assetType: AssetType
  processingStatus: ProcessingStatus
  storagePath: string | null
  createdAt: Date
}

// ============================================
// Error Contracts
// ============================================

export const ErrorCode = {
  // 400 Bad Request
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  
  // 401 Unauthorized
  UNAUTHORIZED: 'UNAUTHORIZED',
  
  // 403 Forbidden
  FORBIDDEN: 'FORBIDDEN',
  VOICE_CONSENT_REQUIRED: 'VOICE_CONSENT_REQUIRED',
  
  // 404 Not Found
  NOT_FOUND: 'NOT_FOUND',
  
  // 409 Conflict
  CONFLICT: 'CONFLICT',
  UNIQUE_VIOLATION: 'UNIQUE_VIOLATION',
  
  // 405 Method Not Allowed
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  
  // 500 Internal Error
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  
  // 503 Service Unavailable
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode]

export interface ApiErrorResponse {
  success: false
  error: string
  code: ErrorCode
  details?: Record<string, unknown>
}

// ============================================
// API Response Wrapper Types
// ============================================

export interface ApiSuccessResponse<T> {
  success: true
  data: T
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse
