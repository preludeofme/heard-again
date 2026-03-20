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
  type: 'PDF' | 'Letter' | 'Photo' | 'Handwritten'
  uploadedAt: Date
  thumbnailUrl?: string
  shareAction?: string
}

export interface StoryContribution {
  id: string
  authorName: string
  authorRole: 'Friend' | 'Nephew' | 'Colleague' | 'Family' | string
  authorAvatarUrl: string
  content: string
  createdAt: Date
  type: 'text' | 'audio'
  audioDurationSeconds?: number
  category?: string
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
  type: 'quote' | 'audio-memory' | 'short-quote' | 'archive-stats'
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
