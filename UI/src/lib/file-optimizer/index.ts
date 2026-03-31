import { ImageOptimizer } from './image-optimizer'
import { AudioOptimizer } from './audio-optimizer'
import { VideoOptimizer } from './video-optimizer'
import { DocumentOptimizer } from './document-optimizer'

export interface OptimizationOptions {
  quality?: number
  maxWidth?: number
  maxHeight?: number
  maxFileSize?: number // bytes
  preserveOriginal?: boolean
}

export interface OptimizationResult {
  optimizedFile: Buffer
  originalSize: number
  optimizedSize: number
  compressionRatio: number
  mimeType: string
  optimizationMethod: string
}

export class FileOptimizer {
  private imageOptimizer: ImageOptimizer
  private audioOptimizer: AudioOptimizer
  private videoOptimizer: VideoOptimizer
  private documentOptimizer: DocumentOptimizer

  constructor() {
    this.imageOptimizer = new ImageOptimizer()
    this.audioOptimizer = new AudioOptimizer()
    this.videoOptimizer = new VideoOptimizer()
    this.documentOptimizer = new DocumentOptimizer()
  }

  async optimizeFile(
    file: Buffer,
    mimeType: string,
    originalName: string,
    options: OptimizationOptions = {}
  ): Promise<OptimizationResult> {
    const originalSize = file.length

    // Skip optimization if file is already small enough
    if (options.maxFileSize && originalSize <= options.maxFileSize) {
      return {
        optimizedFile: file,
        originalSize,
        optimizedSize: originalSize,
        compressionRatio: 1,
        mimeType,
        optimizationMethod: 'none'
      }
    }

    // Route to appropriate optimizer based on MIME type
    if (mimeType.startsWith('image/')) {
      return this.imageOptimizer.optimize(file, mimeType, originalName, options)
    } else if (mimeType.startsWith('audio/')) {
      return this.audioOptimizer.optimize(file, mimeType, originalName, options)
    } else if (mimeType.startsWith('video/')) {
      return this.videoOptimizer.optimize(file, mimeType, originalName, options)
    } else if (mimeType.includes('pdf') || mimeType.includes('document')) {
      return this.documentOptimizer.optimize(file, mimeType, originalName, options)
    } else {
      // No optimization available for this file type
      return {
        optimizedFile: file,
        originalSize,
        optimizedSize: originalSize,
        compressionRatio: 1,
        mimeType,
        optimizationMethod: 'none'
      }
    }
  }

  getSupportedMimeTypes(): string[] {
    return [
      ...this.imageOptimizer.getSupportedMimeTypes(),
      ...this.audioOptimizer.getSupportedMimeTypes(),
      ...this.videoOptimizer.getSupportedMimeTypes(),
      ...this.documentOptimizer.getSupportedMimeTypes()
    ]
  }

  canOptimize(mimeType: string): boolean {
    return this.getSupportedMimeTypes().includes(mimeType)
  }
}

export * from './image-optimizer'
export * from './audio-optimizer'
export * from './video-optimizer'
export * from './document-optimizer'
