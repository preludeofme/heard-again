export interface StorageProvider {
  uploadFile(
    file: Buffer | File,
    filename: string,
    mimeType: string,
    options?: {
      folder?: string
      metadata?: Record<string, string>
    }
  ): Promise<{
    id: string
    filename: string
    storagePath: string
    publicUrl: string
    sizeBytes: number
  }>

  deleteFile(storagePath: string): Promise<void>
  
  getPublicUrl(storagePath: string): Promise<string>
  
  getSignedUrl?(storagePath: string, expiresIn?: number): Promise<string>
  
  getFile(storagePath: string): Promise<Buffer>
}

export * from './local-provider'
export * from './gcp-provider'
export * from './s3-provider'
