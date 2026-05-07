// Thin re-export shim — all logic lives in StorageService.
// Use getStorageService() for all storage operations.
export type { StorageConfig, UploadResult } from './storage/storage-service'
export { getStorageService, StorageService } from './storage/storage-service'

export type StorageMode = 'local' | 'gcs' | 'gcp' | 's3' | 'r2'
