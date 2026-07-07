// Legacy controllers (to be refactored)
export { useDashboardController } from './useDashboardController'
export { useStoriesController } from './useStoriesController'
export { useVoiceLabController } from './useVoiceLabController'
export { useDocumentsController } from './useDocumentsController'
export { useFamilyspaceController } from './useFamilyspaceController'
export { useMembershipController } from './useMembershipController'

// Refactored focused hooks (Finding 5.4: Split useVoiceLabController)
export { useVoiceProfiles } from './useVoiceProfiles'
export { useVoiceTraining } from './useVoiceTraining'
export { useVoiceSynthesis } from './useVoiceSynthesis'

// Composed hook for backward compatibility
export { useVoiceLab } from './useVoiceLab'
