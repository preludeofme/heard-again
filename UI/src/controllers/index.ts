// Legacy controllers (to be refactored)
export { useDashboardController } from './useDashboardController'
export { useStoriesController } from './useStoriesController'
export { useVoiceLabController } from './useVoiceLabController'
export { useDocumentsController } from './useDocumentsController'
export { useTalkController } from './useTalkController'
export { useFamilyspaceController } from './useFamilyspaceController'
export { useMembershipController } from './useMembershipController'

// Refactored focused hooks (Finding 5.4: Split useVoiceLabController)
export { useVoiceProfiles } from './useVoiceProfiles'
export { useVoiceTraining } from './useVoiceTraining'
export { useVoiceSynthesis } from './useVoiceSynthesis'
export { useConversation } from './useConversation'
export { useVoicePlayback } from './useVoicePlayback'
export { useVoiceComparison } from './useVoiceComparison'
export { useTalkSynthesis } from './useTalkSynthesis'
export { useTalkVoiceModels } from './useTalkVoiceModels'

// Composed hook for backward compatibility
export { useVoiceLab } from './useVoiceLab'
