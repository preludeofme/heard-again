/**
 * useVoiceLab Hook (Refactored)
 * Finding 5.4: Split useVoiceLabController
 * 
 * This is a composed hook that delegates to focused, single-responsibility hooks:
 * - useVoiceProfiles: fetch, cache, CRUD voice profiles
 * - useVoiceTraining: training flow state machine
 * - useDocumentUpload: file upload with progress
 * - useVoiceSynthesis: synthesis with caching
 * 
 * Each sub-hook is under 150 lines and testable independently.
 */

import { useVoiceProfiles } from './useVoiceProfiles'
import { useVoiceTraining } from './useVoiceTraining'
import { useDocumentUpload } from './useDocumentUpload'
import { useVoiceSynthesis } from './useVoiceSynthesis'

/**
 * Composed hook that combines all voice lab functionality
 * Use this for backward compatibility or when you need all features
 * For new code, prefer importing individual focused hooks directly
 */
export function useVoiceLab() {
  const profiles = useVoiceProfiles()
  const training = useVoiceTraining()
  const documents = useDocumentUpload()
  const synthesis = useVoiceSynthesis()

  return {
    // From useVoiceProfiles
    voiceModels: profiles.voiceModels,
    isLoading: profiles.isLoading,
    hasError: profiles.hasError,
    errorMessage: profiles.errorMessage,
    refreshData: profiles.refreshProfiles,
    loadVoiceModels: profiles.loadVoiceModels,
    deleteVoiceProfile: profiles.deleteVoiceProfile,

    // From useVoiceTraining
    trainingSamples: training.trainingSamples.map(s => s.file),
    isTraining: training.isTraining,
    trainingJob: training.trainingJob,
    isUploading: training.isUploading,
    preprocessingStatus: training.preprocessingStatus,
    preprocessingProgress: training.preprocessingProgress,
    asrStatus: training.asrStatus,
    queuePosition: training.queuePosition,
    estimatedStartTime: training.estimatedStartTime,
    uploadTrainingSample: training.uploadTrainingSample,
    removeTrainingSample: training.removeTrainingSample,
    startVoiceTraining: training.startVoiceTraining,
    checkTrainingStatus: training.checkTrainingStatus,
    cancelTrainingJob: training.cancelTrainingJob,
    preprocessSamples: training.preprocessSamples,
    runASR: training.runASR,
    designAndCloneVoice: training.designAndCloneVoice,

    // From useDocumentUpload
    documents: documents.documents,
    uploadDocument: documents.uploadDocument,
    shareDocument: documents.shareDocument,

    // From useVoiceSynthesis
    isSynthesizing: synthesis.isSynthesizing,
    synthesizeSpeech: synthesis.synthesizeSpeech,
    clearSynthesisCache: synthesis.clearSynthesisCache,
    getCachedAudio: synthesis.getCachedAudio,

    // Placeholder for legacy compatibility (not implemented in focused hooks)
    selectedFilter: 'All',
    setSelectedFilter: () => {},
    isPlaying: null,
    togglePlaySample: () => {},
    isRecording: false,
    startRecording: () => {},
    stopRecording: () => {},
    showRecordingModal: false,
    toggleRecordingModal: () => {},
    
    // Legacy voiceCloneStatus for compatibility
    voiceCloneStatus: {
      percentComplete: profiles.voiceModels.length > 0 ? 100 : 0,
      uploadedCount: profiles.voiceModels.length,
      remainingCount: 0,
      statusText: profiles.voiceModels.length > 0
        ? `${profiles.voiceModels.length} voice profile${profiles.voiceModels.length > 1 ? 's' : ''} ready`
        : 'No voice profiles yet',
    },
  }
}
