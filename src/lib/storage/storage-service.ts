import { StorageProvider } from './providers'
import { LocalStorageProvider } from './providers/local-provider'
import { GCPStorageProvider } from './providers/gcp-provider'
import { S3StorageProvider } from './providers/s3-provider'

export interface StorageConfig {
  mode: 'local' | 'gcp' | 's3' | 'r2'
  local?: {
    uploadDir: string
    baseUrl: string
  }
  gcp?: {
    bucketName: string
    keyFilename?: string
    projectId?: string
  }
  s3?: {
    bucket: string
    region: string
    accessKey: string
    secretKey: string
    endpoint?: string
    publicUrlBase?: string
  }
}

export interface UploadResult {
  id: string
  filename: string
  originalName: string
  mimeType: string
  sizeBytes: number
  assetType: string
  storagePath: string
  publicUrl: string
  processingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
}

export class StorageService {
  private provider: StorageProvider
  private config: StorageConfig

  constructor(config: StorageConfig) {
    this.config = config
    this.provider = this.createProvider(config)
  }

  private createProvider(config: StorageConfig): StorageProvider {
    switch (config.mode) {
      case 'local':
        if (!config.local) {
          throw new Error('Local storage configuration is required')
        }
        return new LocalStorageProvider(config.local)
      
      case 'gcp':
        if (!config.gcp) {
          throw new Error('GCP storage configuration is required')
        }
        return new GCPStorageProvider(config.gcp)
      
      case 's3':
      case 'r2':
        if (!config.s3) {
          throw new Error('S3/R2 storage configuration is required')
        }
        return new S3StorageProvider(config.s3)
      
      default:
        throw new Error(`Unsupported storage mode: ${config.mode}`)
    }
  }

  async uploadFile(
    file: Buffer | File,
    originalName: string,
    mimeType: string,
    options?: {
      folder?: string
      metadata?: Record<string, string>
    }
  ): Promise<UploadResult> {
    const filename = this.generateFilename(originalName, options?.folder)
    const assetType = this.resolveAssetType(mimeType)
    
    const result = await this.provider.uploadFile(file, filename, mimeType, options)
    
    return {
      ...result,
      originalName,
      mimeType,
      assetType,
      processingStatus: 'PENDING',
    }
  }

  async deleteFile(storagePath: string): Promise<void> {
    await this.provider.deleteFile(storagePath)
  }

  async getPublicUrl(storagePath: string): Promise<string> {
    return this.provider.getPublicUrl(storagePath)
  }

  async getFile(storagePath: string): Promise<Buffer> {
    return this.provider.getFile(storagePath)
  }

  private generateFilename(originalName: string, folder?: string): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const extension = originalName.split('.').pop() || ''
    const baseName = originalName.split('.').slice(0, -1).join('.')
    
    const filename = `${baseName}-${timestamp}-${random}.${extension}`
    return folder ? `${folder}/${filename}` : filename
  }

  private resolveAssetType(mimeType: string): string {
    if (mimeType.startsWith('audio/')) return 'AUDIO'
    if (mimeType.startsWith('image/')) return 'IMAGE'
    if (mimeType.startsWith('video/')) return 'VIDEO'
    if (mimeType.includes('pdf')) return 'DOCUMENT'
    return 'DOCUMENT'
  }

  getMode(): string {
    return this.config.mode
  }

  getProvider(): StorageProvider {
    return this.provider
  }
}

// Singleton instance for the application
let storageServiceInstance: StorageService | null = null

export function getStorageService(): StorageService {
  if (!storageServiceInstance) {
    const config: StorageConfig = {
      mode: (process.env.STORAGE_MODE as any) || 'local',
      local: {
        uploadDir: process.env.UPLOAD_DIR || './uploads',
        baseUrl: process.env.UPLOAD_BASE_URL || '/api/assets',
      },
      gcp: process.env.GCP_BUCKET_NAME ? {
        bucketName: process.env.GCP_BUCKET_NAME,
        keyFilename: process.env.GCP_KEY_FILENAME,
        projectId: process.env.GCP_PROJECT_ID,
      } : undefined,
      s3: process.env.S3_BUCKET ? {
        bucket: process.env.S3_BUCKET,
        region: process.env.S3_REGION || 'us-east-1',
        accessKey: process.env.S3_ACCESS_KEY || '',
        secretKey: process.env.S3_SECRET_KEY || '',
        endpoint: process.env.S3_ENDPOINT,
        publicUrlBase: process.env.S3_PUBLIC_URL_BASE,
      } : undefined,
    }

    storageServiceInstance = new StorageService(config)
  }

  return storageServiceInstance
}
