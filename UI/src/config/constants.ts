/**
 * Application Constants
 * Finding 5.13: Remove Hardcoded Values and Magic Strings
 */

// ============================================
// Default Values
// ============================================

export const DEFAULTS = {
  LANGUAGE: 'en',
  VOICE_LANGUAGE: 'English',
  STORY_STATUS: 'DRAFT' as const,
  PERSON_TYPE: 'FAMILY' as const,
  STORY_TYPE: 'MEMORY' as const,
  DATE_PRECISION: 'EXACT' as const,
  PAGINATION: {
    PAGE: 1,
    LIMIT: 20,
    MAX_LIMIT: 50,
  },
} as const

// ============================================
// Supported Languages
// ============================================

export const SUPPORTED_LANGUAGES = {
  CODES: ['en', 'zh', 'ja', 'ko', 'auto'] as const,
  LABELS: {
    en: 'English',
    zh: 'Chinese',
    ja: 'Japanese',
    ko: 'Korean',
    auto: 'Auto',
  } as const,
} as const

// ============================================
// Voice Training
// ============================================

export const VOICE_TRAINING = {
  MAX_TEXT_LENGTH: 10000,
  DEFAULT_STYLE_PRESETS: [
    'Warm and gentle',
    'Energetic and enthusiastic',
    'Calm and thoughtful',
    'Storyteller style',
    'Professional tone',
  ] as const,
} as const

// ============================================
// Audio Constants
// ============================================

export const AUDIO = {
  SUPPORTED_FORMATS: ['.mp3', '.wav', '.m4a', '.ogg'] as const,
  MAX_FILE_SIZE_MB: 50,
  CACHE_TTL_MS: 60 * 60 * 1000, // 1 hour
  SYNTHESIS_TIMEOUT_MS: 120 * 1000, // 2 minutes
} as const

// ============================================
// UI Constants
// ============================================

export const UI = {
  DEBOUNCE_MS: 300,
  TOAST_DURATION_MS: 4000,
  MODAL_ANIMATION_MS: 300,
} as const

// ============================================
// Feature Flags
// ============================================

export const FEATURES = {
  ENABLE_VOICE_DESIGN: true,
  ENABLE_VOICE_BLENDING: false, // Disabled - ref_code swap doesn't work for blending
  ENABLE_PREPROCESSING: true,
  ENABLE_ASR: true,
} as const

// ============================================
// Error Messages
// ============================================

export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Not authenticated',
  FORBIDDEN: 'Not authorized',
  NOT_FOUND: 'Resource not found',
  VALIDATION_FAILED: 'Validation failed',
  UPLOAD_FAILED: 'Failed to upload file',
  SYNTHESIS_FAILED: 'Speech synthesis failed',
  TRAINING_FAILED: 'Voice training failed',
  NETWORK_ERROR: 'Network error. Please try again.',
  UNKNOWN_ERROR: 'An unexpected error occurred',
} as const
