/**
 * Mappers Index - Centralized export for all data mappers
 * Finding 5.6: Create Data Mappers
 */

export {
  toVoiceModel,
  toVoiceModelArray,
  toVoiceProfileListItem,
  type VoiceProfileResponse,
} from './voiceProfileMapper'

export {
  toDocumentArtifact,
  toDocumentArtifactArray,
  toAssetListItem,
  getDocumentTypeFromMimeType,
  type AssetResponse,
} from './documentMapper'
