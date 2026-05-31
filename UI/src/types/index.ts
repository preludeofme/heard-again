export interface LegacySubject {
  id: string
  fullName: string
  lifespanText: string // e.g. "1942 — Present"
  bio: string
  avatarUrl: string
  accentIcon: string // e.g., "heart"
}

export interface AudioSample {
  id: string
  title: string
  recordedAt: Date
  durationSeconds: number
  status: 'uploaded' | 'processing' | 'ready'
}

export interface VoiceCloneStatus {
  percentComplete: number
  uploadedCount: number
  remainingCount: number
  statusText: string
}

export interface DocumentArtifact {
  id: string
  title: string
  type: 'PDF' | 'Letter' | 'Photo' | 'Handwritten' | 'Audio' | 'Video'
  mimeType?: string
  uploadedAt: Date
  thumbnailUrl?: string
  shareAction?: string
  linkedToPerson?: boolean
}

export interface StoryContribution {
  id: string
  authorName: string
  authorRole: 'Friend' | 'Nephew' | 'Colleague' | 'Family' | string
  authorAvatarUrl: string
  content: string
  createdAt: Date
  type: 'text' | 'audio'
  audioUrl?: string
  audioDurationSeconds?: number
  category?: string
  authorRelationship?: string | null
  isPublic?: boolean
  hasNarration?: boolean
}

export interface ConversationMessage {
  id: string
  sender: 'LegacySubject' | 'User' | 'System'
  timestamp: Date
  content: string
  state: 'sent' | 'typing' | 'listening'
}

export interface MemoryWallItem {
  id: string
  type: 'quote' | 'audio-memory' | 'short-quote' | 'memories-stats'
  storyId?: string
  content?: string
  author?: string
  authorRole?: string
  authorAvatarUrl?: string
  category?: string
  timeAgo?: string
  audioDuration?: string
  title?: string
  description?: string
  imageUrl?: string
  stats?: {
    stories: number
    documents: number
    recordings: number
    additional: number
  }
}

export interface VoiceModel {
  id: string
  userId: string
  name: string
  displayName?: string
  status: 'training' | 'ready' | 'failed'
  language: string
  sampleCount: number
  createdAt: Date | string
  modelPath?: string
  similarityScore?: number
  hasConsent?: boolean
  sampleAudioUrl?: string | null
  person?: {
    id: string
    firstName: string
    lastName?: string
  }
  metadata?: {
    trainingTime?: number
    lastUsed?: Date
    version?: string
  }
}

export interface AudioCache {
  [key: string]: {
    audioUrl: string
    modelId: string
    text: string
    createdAt: Date
    duration: number
  }
}

export interface VoiceSynthesisRequest {
  modelId: string
  text: string
  language?: string
  speed?: number
  pitch?: number
  emotion?: string
  style?: string
}

export interface VoiceSynthesisResponse {
  success: boolean
  audioUrl: string
  modelId: string
  text: string
  language: string
  duration: number
  synthesisTime: number
  cached?: boolean
}
