import { LegacySubject, AudioSample, VoiceCloneStatus, DocumentArtifact, StoryContribution, ConversationMessage, MemoryWallItem } from '@/types'

export const mockLegacySubject: LegacySubject = {
  id: '1',
  fullName: 'Arthur Reed',
  lifespanText: '1942 — Present',
  bio: 'Father, grandfather, and storyteller. A life dedicated to family, art, and preserving the memories that connect us all.',
  avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCE6G2ba8wPd1OUCIlR2SNCWMhXSpZqRXMGA-auLhpR7gdEzS8PmWdIhULhGftOvD6SNbz7D796CNvDySAbq32Db_HzZEk1OlUDYb1QCsjF7h53Z3mCcuEU1hdwLOhAZWeK8JEC_eJHW2To1WqsI0XSwxyF_USNIljlTT-kRjjEsQF6XPqnMdE52F_tMU4HqEk6NlfAuy9df8rUQt5p4d_t0jESsosqGtCeDDbv6cnkwVrTo_KE6mf-5pTdF497qGFsmopSDSWGHPQ',
  accentIcon: 'heart',
}

export const mockVoiceCloneStatus: VoiceCloneStatus = {
  percentComplete: 75,
  uploadedCount: 15,
  remainingCount: 5,
  statusText: 'Calibration in progress',
}

export const mockAudioSamples: AudioSample[] = [
  {
    id: '1',
    title: 'Summer Memories',
    recordedAt: new Date('2024-01-15'),
    durationSeconds: 165,
    status: 'ready',
  },
  {
    id: '2',
    title: 'Childhood Stories',
    recordedAt: new Date('2024-01-14'),
    durationSeconds: 210,
    status: 'processing',
  },
  {
    id: '3',
    title: 'Family Recipes',
    recordedAt: new Date('2024-01-13'),
    durationSeconds: 180,
    status: 'ready',
  },
]

export const mockDocuments: DocumentArtifact[] = [
  {
    id: '1',
    title: 'Love Letters to John',
    type: 'Letter',
    uploadedAt: new Date('2024-01-10'),
    thumbnailUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuApBA6CQwBszCDI9Few5zIFxxYXkoQ_Lh9ysP1UZIMgoRGuZmBXqzpVUzpzZH9mo8skF7O6MSxfHn6SnB7dKDrV7EmRmGx4AV8GbqiWlgvr_KH4Lvt22_xqJwj_75i-44a4-MwUTTlZs-4gVVtH-WhpsiHDFVkLm9ymQKi-0py340e7lt7Gm1mJmR-msNW01Km6M5Ub-h7Lw3ct8PAbiA9lq_mJFAAcXPuznr_v3gXhtdlaSW3S8SNDZ1nsarda28MHlYjlQoDLP64',
    shareAction: 'Share',
  },
  {
    id: '2',
    title: 'Family Photo Album',
    type: 'Photo',
    uploadedAt: new Date('2024-01-09'),
    thumbnailUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBUVAz5N9koH7sUTKPxSarCJoVo-HbgtyLJ1Lf9NSfWPSAtn0dlBn7cxagFbn7_UnoPKAKp4nOezXlv9RZTHWAlEEq5qP8lfp_5Lt6UInd34i5XONMx6ewl7xKMEHRxNSy_5Cd1HyrCIgmNdKr4aMQn7G224cZQ6fR18QTpSwkWsH8aikdcRMq8DmpJHWd0ltbwRRCnB3P3ciT7fyXMlP18AIC4JnXOLSjcENPiyz4pT5Inc8Jh7iU5o-Y0IeKq_EOSGPLvwyeFOzk',
    shareAction: 'Share',
  },
  {
    id: '3',
    title: 'Recipe Collection',
    type: 'Handwritten',
    uploadedAt: new Date('2024-01-08'),
    thumbnailUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCE6G2ba8wPd1OUCIlR2SNCWMhXSpZqRXMGA-auLhpR7gdEzS8PmWdIhULhGftOvD6SNbz7D796CNvDySAbq32Db_HzZEk1OlUDYb1QCsjF7h53Z3mCcuEU1hdwLOhAZWeK8JEC_eJHW2To1WqsI0XSwxyF_USNIljlTT-kRjjEsQF6XPqnMdE52F_tMU4HqEk6NlfAuy9df8rUQt5p4d_t0jESsosqGtCeDDbv6cnkwVrTo_KE6mf-5pTdF497qGFsmopSDSWGHPQ',
    shareAction: 'Share',
  },
  {
    id: '4',
    title: 'Birth Certificate',
    type: 'PDF',
    uploadedAt: new Date('2024-01-07'),
    thumbnailUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBhknZlhrRmHvK39zVfri1_Bsn8sJ2PJe59izl2r9aMcSwDDFwIDDQ1SY6mOnEnBjCBh3zmi3pDJkVEIYGtaOW2oBSlBsDZt2Co2h7ZffsQnlkbXI_vCO0599-G8ScdQoiunIJVrYe26Emwk4bmlxkv7VzxHcShF2UXPK594_e_ESZ9dUQ5OM9s6KrYT38nbper1DXZYuKb0fpBV3AlQKAEtEFh5Zw7DRzfnhPA31-8FSBWAOCV3LZQKAi0cRCRwih2dV3hyE_Wcwg',
    shareAction: 'Share',
  },
]

export const mockStories: StoryContribution[] = [
  {
    id: '1',
    authorName: 'James Wilson',
    authorRole: 'Nephew',
    authorAvatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBN6Iiai-cy1Rh1ap26UOXjYCa1nZwKe66085qg6ilVAjmbi9Vr8Tz0hlRXKQMJCdOmqWUn1kN-ugyGJJpjv7MKqjVapFkuO4mLZYsEpmpXNP0stVeXuYCXHoWYphM2sdRV43wkEgljOJGFo9US4BUo3XQCjzyspHSToKGpIyoS569951REKDwl3v_KDJEsMAl4DRjoqSD5BEWVNnD4uuUtXhGGW35VBQ8aOSEFNgwAb72BQSPZhX-CQdfG2Ugimz0MyuESccJS__o',
    content: "I'll never forget the summer Arthur taught me how to fix that old radio. He had so much patience, even when I dropped the same screw three times. He said music sounds better when you've worked for it.",
    createdAt: new Date('2024-01-13T10:00:00'),
    type: 'text',
  },
  {
    id: '2',
    authorName: 'Eleanor Vance',
    authorRole: 'Colleague',
    authorAvatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD_g0f24m79MjOWPgBSpPYPMy02Oby08JMOs1cEoIkxOgI3hLcCChV2m678D9ALDdaIs4RWtrZhgK3q-WPb5a0G6cjI_VDaWq1nevzX5CNv6yKX4LJ-E_7Y9CeVQaRIybxahb1b-TAoN4x1ypPa-Gfh7fQ7cfmUMwG5evnhcdcmAqeYQ7_gSTEtEV7g3PR09hde-FcvulEyV9w_gcx0DxoHuBxy88EO0XCiY9JLh9IKsJU1hR7YRtxq0Da9i4rOfao0XW8BqoWCidQ',
    content: "His laugh was the heartbeat of the entire office. I had to record this story of our trip to Paris...",
    createdAt: new Date('2024-01-12T14:30:00'),
    type: 'audio',
  },
  {
    id: '3',
    authorName: 'Dr. Marcus Reed',
    authorRole: 'Friend',
    authorAvatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCGc58kyrnCCdsPn6bKbauJjpv4TRBgQut1BcUpUQWGO8ZiU2rxB9W5Ai2TZ4PwTEbulw3uyP2xIkCFunWFNq5BnY7xXEcjmzdqIi7WvKxZ4d0Q57qagNaemGElrHoc20bfMZ4nN7yF4CVhcfCdppJlK5vwZSJCtUBBGhjp5pfcugPS8Qy5j2o6Pec7dOEAqI3SFLesN1u0fv3t_uLmwBwR-mfqPb7npG8wWNm0oLC-V3O_xaftpjLumPHKAyZeJREIblzUU5-o0kU',
    content: "Arthur's collection of rare bird calls was more than a hobby; it was his way of connecting with nature's hidden music. We spent many mornings in the silence of the woods.",
    createdAt: new Date('2024-01-11T09:15:00'),
    type: 'text',
  },
]

export const mockMessages: ConversationMessage[] = [
  {
    id: '1',
    sender: 'LegacySubject',
    timestamp: new Date('2024-01-15T10:00:00'),
    content: 'Hello dear. It\'s so wonderful to talk with you today. What\'s on your mind?',
    state: 'sent',
  },
  {
    id: '2',
    sender: 'User',
    timestamp: new Date('2024-01-15T10:01:00'),
    content: 'Hi Grandpa! I was thinking about your trip to Italy. Can you tell me about Venice again?',
    state: 'sent',
  },
  {
    id: '3',
    sender: 'LegacySubject',
    timestamp: new Date('2024-01-15T10:01:30'),
    content: 'Ah, Venice... The city of canals and dreams. I remember the gondola rides at sunset...',
    state: 'typing',
  },
]

export const mockMemoryWall: MemoryWallItem[] = [
  {
    id: '1',
    type: 'quote',
    content: 'The best way to remember is to share.',
    author: 'Arthur Reed',
    authorRole: 'Legacy Subject',
    authorAvatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCE6G2ba8wPd1OUCIlR2SNCWMhXSpZqRXMGA-auLhpR7gdEzS8PmWdIhULhGftOvD6SNbz7D796CNvDySAbq32Db_HzZEk1OlUDYb1QCsjF7h53Z3mCcuEU1hdwLOhAZWeK8JEC_eJHW2To1WqsI0XSwxyF_USNIljlTT-kRjjEsQF6XPqnMdE52F_tMU4HqEk6NlfAuy9df8rUQt5p4d_t0jESsosqGtCeDDbv6cnkwVrTo_KE6mf-5pTdF497qGFsmopSDSWGHPQ',
    category: 'Philosophy',
  },
  {
    id: '2',
    type: 'audio-memory',
    title: 'Summer of 1962',
    description: 'Evelyn recalls her first concert and the song that changed her life',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBUVAz5N9koH7sUTKPxSarCJoVo-HbgtyLJ1Lf9NSfWPSAtn0dlBn7cxagFbn7_UnoPKAKp4nOezXlv9RZTHWAlEEq5qP8lfp_5Lt6UInd34i5XONMx6ewl7xKMEHRxNSy_5Cd1HyrCIgmNdKr4aMQn7G224cZQ6fR18QTpSwkWsH8aikdcRMq8DmpJHWd0ltbwRRCnB3P3ciT7fyXMlP18AIC4JnXOLSjcENPiyz4pT5Inc8Jh7iU5o-Y0IeKq_EOSGPLvwyeFOzk',
    audioDuration: '3:45',
  },
  {
    id: '3',
    type: 'short-quote',
    content: 'Every recipe tells a story of love',
    author: 'Family Gathering',
    timeAgo: '2 DAYS AGO',
  },
  {
    id: '4',
    type: 'archive-stats',
    stats: {
      stories: 47,
      documents: 23,
      recordings: 15,
      additional: 31,
    },
  },
]
