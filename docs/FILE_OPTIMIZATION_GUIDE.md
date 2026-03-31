# File Optimization System Guide

This guide explains how to set up and use the automatic file optimization system that reduces file sizes without significant quality loss.

## Overview

The file optimization system automatically compresses and optimizes uploaded files to save storage space and improve upload/download speeds while maintaining acceptable quality.

## Supported File Types

### Images
- **JPEG**: Progressive compression, quality adjustment
- **PNG**: Compression level optimization, palette reduction
- **WebP**: Modern format with excellent compression
- **TIFF**: Convert to JPEG for better compression
- **GIF**: Static to WebP conversion, animated preservation

### Audio
- **WAV**: Convert to MP3 (massive size reduction)
- **FLAC**: Convert to MP3 (lossy compression)
- **M4A**: Bitrate optimization
- **MP3**: Re-encoding at optimal bitrate
- **OGG/WebM**: Already optimized, preserved as-is

### Video
- **AVI/MOV/WMV**: Convert to MP4
- **MP4**: Compression optimization
- **WebM**: Already optimized, preserved as-is
- **MKV**: Convert to MP4

### Documents
- **PDF**: Metadata removal, image compression
- **DOC/DOCX**: Format conversion and optimization
- **XLS/XLSX**: Format conversion and optimization
- **PPT/PPTX**: Format conversion and optimization
- **TXT**: Gzip compression
- **RTF**: Convert to plain text

## Open Source Libraries Used

### Image Optimization
- **Sharp**: High-performance image processing
  - JPEG: Progressive encoding, mozjpeg optimization
  - PNG: Compression levels, palette optimization
  - WebP: Modern format support
  - Automatic resizing and format conversion

### Audio/Video Processing
- **Fluent-FFmpeg**: Audio/video conversion and optimization
  - Format conversion (WAV→MP3, AVI→MP4, etc.)
  - Bitrate adjustment
  - Codec optimization

### Document Processing
- **PDF-lib**: PDF manipulation and optimization
- **Music-Metadata**: Audio file analysis
- **Zlib**: Text compression

## Configuration Options

### Default Optimization Settings
```typescript
{
  quality: 85,           // 85% quality (good balance)
  maxWidth: 2048,        // Max image width
  maxHeight: 2048,       // Max image height
  maxFileSize: 50MB      // Target file size
}
```

### Environment Variables
```bash
# Enable/disable optimization
FILE_OPTIMIZATION_ENABLED=true

# Default quality settings
DEFAULT_IMAGE_QUALITY=85
DEFAULT_AUDIO_BITRATE=128
DEFAULT_VIDEO_BITRATE=1000

# Size limits
MAX_IMAGE_WIDTH=2048
MAX_IMAGE_HEIGHT=2048
MAX_FILE_SIZE_TARGET=52428800  # 50MB
```

## Installation

### Install Dependencies
```bash
npm install sharp fluent-ffmpeg music-metadata pdf-lib
```

### System Requirements
- **Node.js**: v16 or higher
- **FFmpeg**: Required for audio/video processing
- **Sharp**: Automatically installs native dependencies

### FFmpeg Installation

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install ffmpeg
```

#### macOS
```bash
brew install ffmpeg
```

#### Windows
```bash
# Using Chocolatey
choco install ffmpeg

# Or download from https://ffmpeg.org/download.html
```

## Usage Examples

### Basic File Upload with Optimization
```javascript
const formData = new FormData()
formData.append('file', file)

const response = await fetch('/api/assets/upload', {
  method: 'POST',
  body: formData
})

const result = await response.json()
console.log(result.optimization)
// Output:
// {
//   originalSize: 5242880,
//   optimizedSize: 1048576,
//   compressionRatio: 0.2,
//   method: 'sharp-jpeg-optimization',
//   sizeSaved: 4194304,
//   sizeSavedPercentage: '80.0%'
// }
```

### Custom Optimization Options
```typescript
import { FileOptimizer } from '@/lib/file-optimizer'

const optimizer = new FileOptimizer()

const result = await optimizer.optimizeFile(fileBuffer, 'image/jpeg', 'photo.jpg', {
  quality: 90,           // Higher quality
  maxWidth: 1920,        // Smaller dimensions
  maxHeight: 1080,
  maxFileSize: 2 * 1024 * 1024  // 2MB target
})
```

## Performance Considerations

### Optimization Speed
- **Images**: Fast (milliseconds to seconds)
- **Audio**: Medium (seconds)
- **Video**: Slow (minutes for large files)
- **Documents**: Fast to Medium

### CPU Usage
- **Sharp**: Very efficient, uses multiple cores
- **FFmpeg**: CPU intensive for audio/video
- **Document processing**: Light CPU usage

### Memory Usage
- **Images**: Proportional to image size
- **Audio/Video**: Requires loading entire file into memory
- **Documents**: Minimal memory usage

## Quality vs Size Trade-offs

### Recommended Settings by Use Case

#### **Web Display** (Best balance)
```typescript
{
  quality: 85,
  maxWidth: 2048,
  maxHeight: 2048
}
```

#### **Archival** (High quality)
```typescript
{
  quality: 95,
  maxWidth: 4096,
  maxHeight: 4096
}
```

#### **Mobile** (Small size)
```typescript
{
  quality: 75,
  maxWidth: 1080,
  maxHeight: 1080
}
```

#### **Thumbnail** (Very small)
```typescript
{
  quality: 70,
  maxWidth: 300,
  maxHeight: 300
}
```

## Expected Compression Results

### Images
- **JPEG**: 60-80% size reduction at 85% quality
- **PNG**: 30-70% size reduction
- **WebP**: 25-50% smaller than JPEG
- **TIFF→JPEG**: 90-95% size reduction

### Audio
- **WAV→MP3**: 90-95% size reduction
- **FLAC→MP3**: 80-90% size reduction
- **MP3 re-encoding**: 20-40% size reduction

### Video
- **AVI→MP4**: 50-80% size reduction
- **MP4 optimization**: 20-50% size reduction

### Documents
- **PDF**: 10-50% size reduction
- **DOC→DOCX**: 20-40% size reduction
- **Text compression**: 60-80% size reduction

## Troubleshooting

### Common Issues

#### Sharp Installation Problems
```bash
# Clear npm cache
npm cache clean --force

# Rebuild sharp
npm rebuild sharp

# Or use pre-built binaries
npm install sharp --platform=linux --arch=x64
```

#### FFmpeg Not Found
```bash
# Check if FFmpeg is installed
ffmpeg -version

# Add to PATH if needed
export PATH="/usr/local/bin:$PATH"
```

#### Memory Issues with Large Files
```typescript
// Process in chunks for very large files
const chunkSize = 10 * 1024 * 1024 // 10MB chunks
// Implementation would go here
```

#### Quality Too Low
```typescript
// Increase quality settings
{
  quality: 95,  // Higher quality
  maxWidth: 4096,  // Larger dimensions
  maxHeight: 4096
}
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=file-optimizer:* npm run dev
```

## Advanced Features

### Thumbnail Generation
```typescript
import { ImageOptimizer } from '@/lib/file-optimizer'

const imageOptimizer = new ImageOptimizer()
const thumbnails = await imageOptimizer.createThumbnails(fileBuffer, [150, 300, 600])
```

### Metadata Extraction
```typescript
// Image metadata
const imageMetadata = await imageOptimizer.extractMetadata(fileBuffer)

// Audio metadata
const audioMetadata = await audioOptimizer.extractAudioMetadata(fileBuffer)

// Video metadata
const videoMetadata = await videoOptimizer.extractVideoMetadata(fileBuffer)
```

### Format Conversion
```typescript
// Convert image to WebP
const webpBuffer = await imageOptimizer.convertFormat(fileBuffer, 'webp', 85)

// Convert document to PDF
const pdfBuffer = await documentOptimizer.convertToPdf(fileBuffer, mimeType)
```

## Production Considerations

### Scaling
- Use worker threads for CPU-intensive operations
- Implement queue system for large files
- Consider CDN for optimized file delivery

### Monitoring
- Track optimization success rates
- Monitor compression ratios
- Log performance metrics

### Cost Optimization
- Reduced storage costs (50-90% savings)
- Lower bandwidth usage
- Faster upload/download speeds

## Best Practices

1. **Test with representative files** before deploying
2. **Monitor compression ratios** to ensure quality is maintained
3. **Set appropriate quality levels** for your use case
4. **Handle optimization failures gracefully**
5. **Log optimization results** for monitoring
6. **Consider user experience** - don't over-optimize

## Future Enhancements

- **AI-powered optimization** using machine learning
- **Adaptive quality** based on content analysis
- **Progressive loading** for images
- **Advanced video compression** (H.265/AV1)
- **Batch processing** for multiple files
- **Cloud-based optimization** for heavy processing
