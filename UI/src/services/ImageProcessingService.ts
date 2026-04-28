/**
 * ImageProcessingService - Image optimization and transformation
 * Handles resizing, format conversion, and quality optimization
 */

import { storageService, StorageService } from './StorageService'

export interface ImageOptimizationOptions {
  width?: number
  height?: number
  quality?: number  // 1-100
  format?: 'jpeg' | 'png' | 'webp' | 'avif' | 'original'
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
}

export interface ProcessedImage {
  path: string
  url: string
  width: number
  height: number
  format: string
  sizeBytes: number
  originalSizeBytes: number
  savingsPercent: number
}

export interface ImageMetadata {
  width: number
  height: number
  format: string
  sizeBytes: number
  hasAlpha?: boolean
  exif?: string
}

export class ImageProcessingService {
  private storage: StorageService

  constructor(storage: StorageService = storageService) {
    this.storage = storage
  }

  /**
   * Extract metadata from image buffer
   * Note: Requires sharp library to be installed
   */
  async extractMetadata(buffer: Buffer): Promise<ImageMetadata> {
    try {
      // Dynamic import to avoid requiring sharp at build time
      const sharp = await import('sharp')
      const metadata = await sharp.default(buffer).metadata()
      
      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'unknown',
        sizeBytes: buffer.byteLength,
        hasAlpha: metadata.hasAlpha,
        exif: metadata.exif ? String(metadata.exif) : undefined,
      }
    } catch {
      // If sharp is not available, return basic info
      // In production, sharp should be installed
      return {
        width: 0,
        height: 0,
        format: 'unknown',
        sizeBytes: buffer.byteLength,
      }
    }
  }

  /**
   * Optimize image with resizing and format conversion
   * Note: Requires sharp library to be installed
   */
  async optimizeImage(
    buffer: Buffer,
    options: ImageOptimizationOptions = {}
  ): Promise<Buffer> {
    try {
      const sharp = await import('sharp')
      let pipeline = sharp.default(buffer)

      // Resize if dimensions specified
      if (options.width || options.height) {
        pipeline = pipeline.resize({
          width: options.width,
          height: options.height,
          fit: options.fit || 'inside',
          withoutEnlargement: true,
        })
      }

      // Convert format if specified
      const format = options.format || 'original'
      if (format !== 'original') {
        switch (format) {
          case 'jpeg':
            pipeline = pipeline.jpeg({ quality: options.quality || 80, progressive: true })
            break
          case 'png':
            pipeline = pipeline.png({ quality: options.quality || 80 })
            break
          case 'webp':
            pipeline = pipeline.webp({ quality: options.quality || 80 })
            break
          case 'avif':
            pipeline = pipeline.avif({ quality: options.quality || 70 })
            break
        }
      }

      return await pipeline.toBuffer()
    } catch {
      // If sharp is not available, return original buffer
      // In production, sharp should be installed
      return buffer
    }
  }

  /**
   * Process and store an uploaded image
   * Creates optimized versions for different use cases
   */
  async processImageUpload(
    familyspaceId: string,
    fileId: string,
    originalBuffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<{
    original: ProcessedImage
    thumbnail?: ProcessedImage
    preview?: ProcessedImage
  }> {
    const results: {
      original: ProcessedImage
      thumbnail?: ProcessedImage
      preview?: ProcessedImage
    } = { original: { path: '', url: '', width: 0, height: 0, format: '', sizeBytes: 0, originalSizeBytes: 0, savingsPercent: 0 } }

    // Store original
    const originalStored = await this.storage.saveFile(familyspaceId, fileId, originalBuffer, {
      mimeType,
      filename,
      assetType: 'IMAGE',
    })

    const metadata = await this.extractMetadata(originalBuffer)

    results.original = {
      path: originalStored.path,
      url: originalStored.url,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      sizeBytes: originalStored.sizeBytes,
      originalSizeBytes: originalStored.sizeBytes,
      savingsPercent: 0,
    }

    // Create thumbnail (200x200)
    try {
      const thumbnailBuffer = await this.optimizeImage(originalBuffer, {
        width: 200,
        height: 200,
        fit: 'cover',
        format: 'webp',
        quality: 80,
      })
      
      const thumbnailStored = await this.storage.saveFile(
        familyspaceId,
        `${fileId}_thumb`,
        thumbnailBuffer,
        { mimeType: 'image/webp', filename: `thumb_${filename}.webp`, assetType: 'IMAGE' }
      )

      results.thumbnail = {
        path: thumbnailStored.path,
        url: thumbnailStored.url,
        width: 200,
        height: 200,
        format: 'webp',
        sizeBytes: thumbnailStored.sizeBytes,
        originalSizeBytes: originalStored.sizeBytes,
        savingsPercent: Math.round(
          ((originalStored.sizeBytes - thumbnailStored.sizeBytes) / originalStored.sizeBytes) * 100
        ),
      }
    } catch {
      // Thumbnail creation is optional
    }

    // Create preview (800px width)
    try {
      const previewBuffer = await this.optimizeImage(originalBuffer, {
        width: 800,
        format: 'webp',
        quality: 85,
      })
      
      const previewStored = await this.storage.saveFile(
        familyspaceId,
        `${fileId}_preview`,
        previewBuffer,
        { mimeType: 'image/webp', filename: `preview_${filename}.webp`, assetType: 'IMAGE' }
      )

      results.preview = {
        path: previewStored.path,
        url: previewStored.url,
        width: 800,
        height: Math.round(metadata.height * (800 / metadata.width)),
        format: 'webp',
        sizeBytes: previewStored.sizeBytes,
        originalSizeBytes: originalStored.sizeBytes,
        savingsPercent: Math.round(
          ((originalStored.sizeBytes - previewStored.sizeBytes) / originalStored.sizeBytes) * 100
        ),
      }
    } catch {
      // Preview creation is optional
    }

    return results
  }

  /**
   * Generate responsive image variants for different screen sizes
   */
  async generateResponsiveVariants(
    buffer: Buffer,
    widths: number[] = [320, 640, 960, 1280, 1920]
  ): Promise<Array<{ width: number; buffer: Buffer }>> {
    const variants: Array<{ width: number; buffer: Buffer }> = []
    
    const metadata = await this.extractMetadata(buffer)
    
    for (const width of widths) {
      // Skip if requested width is larger than original
      if (width >= metadata.width) continue
      
      try {
        const optimized = await this.optimizeImage(buffer, {
          width,
          format: 'webp',
          quality: 85,
        })
        variants.push({ width, buffer: optimized })
      } catch {
        // Skip variants that fail
      }
    }
    
    return variants
  }
}

// Default instance
export const imageProcessingService = new ImageProcessingService()

// Factory for creating instances with custom storage
export function createImageProcessingService(storage: StorageService): ImageProcessingService {
  return new ImageProcessingService(storage)
}
