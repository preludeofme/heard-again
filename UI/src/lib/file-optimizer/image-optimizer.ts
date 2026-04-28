import { logger } from '@/lib/logger'
import sharp from 'sharp'
import { OptimizationOptions, OptimizationResult } from './index'

export class ImageOptimizer {
  private supportedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/tiff',
    'image/gif'
  ]

  async optimize(
    file: Buffer,
    mimeType: string,
    originalName: string,
    options: OptimizationOptions = {}
  ): Promise<OptimizationResult> {
    const originalSize = file.length
    const quality = options.quality || 75
    const maxWidth = options.maxWidth || 2048
    const maxHeight = options.maxHeight || 2048

    try {
      let sharpInstance = sharp(file)
      
      // Get image metadata
      const metadata = await sharpInstance.metadata()
      
      // Resize if necessary
      if (metadata.width && metadata.width > maxWidth) {
        sharpInstance = sharpInstance.resize(maxWidth, null, {
          withoutEnlargement: true,
          fit: 'inside'
        })
      }
      
      if (metadata.height && metadata.height > maxHeight) {
        sharpInstance = sharpInstance.resize(null, maxHeight, {
          withoutEnlargement: true,
          fit: 'inside'
        })
      }

      // Apply format-specific optimizations
      let optimizedBuffer: Buffer
      let outputFormat = mimeType
      let optimizationMethod = 'sharp'

      switch (mimeType) {
        case 'image/jpeg':
          optimizedBuffer = await sharpInstance
            .jpeg({ 
              quality, 
              progressive: true,
              mozjpeg: true, // TinyPNG-like JPEG optimization
              trellisQuantisation: true,
              overshootDeringing: true,
              optimiseScans: true
            })
            .toBuffer()
          break

        case 'image/png':
          optimizedBuffer = await sharpInstance
            .png({ 
              progressive: true,
              compressionLevel: 9,
              palette: true, // TinyPNG-like PNG optimization (uses 8-bit palette)
              colors: 256,
              quality: quality + 5 // PNG quality is a bit different, nudge it up
            })
            .toBuffer()
          break

        case 'image/webp':
          optimizedBuffer = await sharpInstance
            .webp({ 
              quality,
              effort: 6, // Higher effort = better compression
              lossless: false,
              smartSubsample: true
            })
            .toBuffer()
          break

        case 'image/tiff':
          // Convert TIFF to JPEG for better compression
          optimizedBuffer = await sharpInstance
            .jpeg({ 
              quality, 
              progressive: true,
              mozjpeg: true
            })
            .toBuffer()
          outputFormat = 'image/jpeg'
          optimizationMethod = 'sharp-tiff-to-jpeg'
          break

        case 'image/gif':
          // For GIFs, we primarily convert static ones to WebP
          const pages = (metadata as any).pages || (metadata as any).pageCount
          if (pages && pages > 1) {
            // Animated GIF - keep original for now as sharp animation support varies
            optimizedBuffer = file
            optimizationMethod = 'none'
          } else {
            // Static GIF - convert to WebP (much smaller)
            optimizedBuffer = await sharpInstance
              .webp({ quality, effort: 6 })
              .toBuffer()
            outputFormat = 'image/webp'
            optimizationMethod = 'sharp-gif-to-webp'
          }
          break

        default:
          optimizedBuffer = file
          optimizationMethod = 'none'
      }

      const optimizedSize = optimizedBuffer.length
      const compressionRatio = originalSize > 0 ? optimizedSize / originalSize : 1

      return {
        optimizedFile: optimizedBuffer,
        originalSize,
        optimizedSize,
        compressionRatio,
        mimeType: outputFormat,
        optimizationMethod
      }

    } catch (error) {
      logger.error('Image optimization failed:', error)
      // Return original file if optimization fails
      return {
        optimizedFile: file,
        originalSize,
        optimizedSize: originalSize,
        compressionRatio: 1,
        mimeType,
        optimizationMethod: 'failed'
      }
    }
  }

  getSupportedMimeTypes(): string[] {
    return this.supportedMimeTypes
  }

  // Additional image optimization methods
  
  async createThumbnails(file: Buffer, sizes: number[] = [150, 300, 600]): Promise<{ size: number; buffer: Buffer }[]> {
    const thumbnails: { size: number; buffer: Buffer }[] = []
    
    for (const size of sizes) {
      try {
        const thumbnail = await sharp(file)
          .resize(size, size, {
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality: 80 })
          .toBuffer()
        
        thumbnails.push({ size, buffer: thumbnail })
      } catch (error) {
        logger.error(`Failed to create ${size}px thumbnail:`, error)
      }
    }
    
    return thumbnails
  }

  async extractMetadata(file: Buffer): Promise<sharp.Metadata> {
    try {
      return await sharp(file).metadata()
    } catch (error) {
      logger.error('Failed to extract image metadata:', error)
      throw error
    }
  }

  async convertFormat(file: Buffer, targetFormat: 'jpeg' | 'png' | 'webp', quality: number = 80): Promise<Buffer> {
    const sharpInstance = sharp(file)
    
    switch (targetFormat) {
      case 'jpeg':
        return sharpInstance.jpeg({ quality, progressive: true }).toBuffer()
      case 'png':
        return sharpInstance.png({ quality, compressionLevel: 9 }).toBuffer()
      case 'webp':
        return sharpInstance.webp({ quality, effort: 6 }).toBuffer()
      default:
        throw new Error(`Unsupported target format: ${targetFormat}`)
    }
  }
}
