import {
  LegacySubject,
  AudioSample,
  VoiceCloneStatus,
  DocumentArtifact,
  StoryContribution,
  ConversationMessage,
  MemoryWallItem,
} from '@/types'

export const mockLegacySubject: LegacySubject = {
  id: 'legacy-1',
  fullName: 'Evelyn Harper',
  lifespanText: '1942 — Present',
  bio: 'A beloved grandmother, retired schoolteacher, and storyteller whose warmth and wisdom have touched generations.',
  avatarUrl: '/avatars/evelyn.jpg',
  accentIcon: 'heart',
}

export const mockAudioSamples: AudioSample[] = [
  {
    id: 'sample-1',
    title: 'Morning Greeting',
    recordedAt: new Date('2024-12-15T09:00:00'),
    durationSeconds: 45,
    status: 'ready',
  },
  {
    id: 'sample-2',
    title: 'Childhood Story',
    recordedAt: new Date('2024-12-14T14:30:00'),
    durationSeconds: 120,
    status: 'ready',
  },
  {
    id: 'sample-3',
    title: 'Holiday Memory',
    recordedAt: new Date('2024-12-13T11:00:00'),
    durationSeconds: 90,
    status: 'processing',
  },
]

export const mockVoiceCloneStatus: VoiceCloneStatus = {
  percentComplete: 65,
  uploadedCount: 13,
  remainingCount: 7,
  statusText: 'Calibration in progress',
}

export const mockDocuments: DocumentArtifact[] = [
  {
    id: 'doc-1',
    title: 'Wedding Letter 1965',
    type: 'Letter',
    uploadedAt: new Date('2024-12-10'),
    shareAction: 'Share',
  },
  {
    id: 'doc-2',
    title: 'Family Cookbook',
    type: 'PDF',
    uploadedAt: new Date('2024-12-08'),
    shareAction: 'Share',
  },
  {
    id: 'doc-3',
    title: 'Garden Photo 1978',
    type: 'Photo',
    uploadedAt: new Date('2024-12-05'),
    shareAction: 'Share',
  },
  {
    id: 'doc-4',
    title: 'Handwritten Recipe',
    type: 'Handwritten',
    uploadedAt: new Date('2024-12-01'),
    shareAction: 'Share',
  },
]

export const mockStories: StoryContribution[] = [
  {
    id: 'story-1',
    authorName: 'James Harper',
    authorRole: 'Nephew',
    authorAvatarUrl: '/avatars/james.jpg',
    content: 'Aunt Evelyn always made the best apple pie at Thanksgiving. She would start baking at 5am and the whole house would smell like cinnamon and butter.',
    createdAt: new Date('2024-12-12'),
    type: 'text',
    category: 'Traditions',
  },
  {
    id: 'story-2',
    authorName: 'Margaret Chen',
    authorRole: 'Friend',
    authorAvatarUrl: '/avatars/margaret.jpg',
    content: 'We met in 1968 at the local library. Evelyn was always reading — she could finish a novel in a single afternoon.',
    createdAt: new Date('2024-12-10'),
    type: 'text',
    category: 'Friendships',
  },
  {
    id: 'story-3',
    authorName: 'Robert Harper',
    authorRole: 'Family',
    authorAvatarUrl: '/avatars/robert.jpg',
    content: '',
    createdAt: new Date('2024-12-09'),
    type: 'audio',
    audioDurationSeconds: 180,
    category: 'Family Life',
  },
]

export const mockMessages: ConversationMessage[] = [
  {
    id: 'msg-1',
    sender: 'LegacySubject',
    timestamp: new Date(Date.now() - 3600000),
    content: 'Hello, dear. It\'s so wonderful to talk with you. What would you like to know about?',
    state: 'sent',
  },
  {
    id: 'msg-2',
    sender: 'User',
    timestamp: new Date(Date.now() - 3500000),
    content: 'Hi Grandma! I wanted to hear about your childhood. What was your favorite thing to do as a kid?',
    state: 'sent',
  },
  {
    id: 'msg-3',
    sender: 'LegacySubject',
    timestamp: new Date(Date.now() - 3400000),
    content: 'Oh, I loved playing in the creek behind our farmhouse. My sister and I would spend whole summer days catching tadpoles and building little dams out of rocks. Those were such simple, happy times.',
    state: 'sent',
  },
]

export const mockMemoryWall: MemoryWallItem[] = [
  {
    id: 'wall-1',
    type: 'quote',
    content: 'The best things in life aren\'t things at all — they\'re the people you share your days with.',
    author: 'Evelyn Harper',
    authorRole: 'Grandmother',
    category: 'Wisdom',
    timeAgo: '2 days ago',
  },
  {
    id: 'wall-2',
    type: 'audio-memory',
    title: 'Summer at the Lake House',
    description: 'Evelyn recalls summers spent at the family lake house in the 1950s.',
    audioDuration: '3:45',
    author: 'Evelyn Harper',
    category: 'Childhood',
    timeAgo: '5 days ago',
  },
  {
    id: 'wall-3',
    type: 'short-quote',
    content: 'She taught me that kindness is a choice you make every single day.',
    author: 'James Harper',
    authorRole: 'Nephew',
    timeAgo: '1 week ago',
  },
  {
    id: 'wall-4',
    type: 'memories-stats',
    title: 'The Living Story',
    description: 'A growing collection of memories, stories, and artifacts.',
    stats: {
      stories: 24,
      documents: 18,
      recordings: 13,
      additional: 7,
    },
  },
]
