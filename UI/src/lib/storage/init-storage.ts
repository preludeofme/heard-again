/**
 * Call this at app startup to ensure the local dev GCS bucket exists.
 * No-op when STORAGE_EMULATOR_HOST is not set (i.e. in production).
 */
export async function initStorage(): Promise<void> {
  if (!process.env.STORAGE_EMULATOR_HOST) return

  const { getStorageService } = await import('./storage-service')
  const service = getStorageService()
  const provider = service.getProvider()

  if ('ensureBucketExists' in provider) {
    await (provider as { ensureBucketExists(): Promise<void> }).ensureBucketExists()
  }
}
