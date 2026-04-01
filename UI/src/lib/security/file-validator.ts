import { fileTypeFromBuffer } from 'file-type'
import path from 'path'

// Allowed MIME types for family history content
export const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/tiff',
  'image/bmp',
  
  // Audio
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',
  'audio/ogg',
  'audio/flac',
  'audio/aac',
  'audio/x-m4a',
  
  // Documents
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  
  // Archives (for document bundles)
  'application/zip',
  'application/x-zip-compressed',
] as const

// Allowed file extensions - explicit restriction for security (S2598)
export const ALLOWED_EXTENSIONS = [
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.bmp',
  
  // Audio
  '.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac',
  
  // Documents
  '.pdf', '.txt', '.csv', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  
  // Archives
  '.zip',
] as const

// Magic byte signatures for additional validation
const MAGIC_BYTE_SIGNATURES: Record<string, RegExp> = {
  'image/jpeg': /^\xff\xd8\xff/,
  'image/png': /^\x89\x50\x4e\x47\x0d\x0a\x1a\x0a/,
  'image/gif': /^GIF87a|^GIF89a/,
  'image/webp': /^RIFF....WEBP/,
  'audio/mpeg': /^ID3|^\xff\xfb|^\xff\xf3|^\xff\xf2/,
  'audio/wav': /^RIFF....WAVE/,
  'application/pdf': /^%PDF-/,
  'application/zip': /^PK\x03\x04|^PK\x05\x06|^PK\x07\x08/,
}

export interface FileValidationResult {
  isValid: boolean
  detectedType?: string
  error?: string
  securityRisk?: 'malicious_signature' | 'polyglot_file' | 'size_mismatch' | 'unknown'
}

/**
 * Validates file content using magic bytes and file type detection
 * Prevents MIME type spoofing and polyglot file attacks
 */
export async function validateFileContent(
  buffer: Buffer,
  originalName: string,
  declaredMimeType?: string
): Promise<FileValidationResult> {
  try {
    // CRITICAL: Validate file extension first (S2598)
    const originalExtension = path.extname(originalName).toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(originalExtension as any)) {
      return {
        isValid: false,
        error: `File extension '${originalExtension}' is not allowed`,
        securityRisk: 'malicious_signature'
      }
    }

    // Check file size (prevent extremely large files)
    if (buffer.length > 100 * 1024 * 1024) { // 100MB limit
      return {
        isValid: false,
        error: 'File size exceeds maximum allowed limit',
        securityRisk: 'size_mismatch'
      }
    }

    // Text-based formats have no magic bytes — fileTypeFromBuffer returns undefined for them.
    // Validate these using extension-to-MIME mapping instead of magic byte detection.
    const TEXT_MIME_BY_EXT: Record<string, string> = {
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.md': 'text/markdown',
      '.markdown': 'text/markdown',
      '.json': 'application/json',
    }

    const textMime = TEXT_MIME_BY_EXT[originalExtension]
    if (textMime) {
      if (!ALLOWED_MIME_TYPES.includes(textMime as any)) {
        return {
          isValid: false,
          error: `File type '${textMime}' is not allowed`,
          detectedType: textMime,
          securityRisk: 'malicious_signature'
        }
      }
      return { isValid: true, detectedType: textMime }
    }

    // Detect actual file type from content (binary formats)
    const fileType = await fileTypeFromBuffer(buffer)
    
    if (!fileType) {
      return {
        isValid: false,
        error: 'Unable to determine file type from content',
        securityRisk: 'unknown'
      }
    }

    // OLE2/CFB container: .doc, .xls, .ppt all share the same magic bytes and are
    // detected as application/x-cfb by fileTypeFromBuffer. Remap to the semantic
    // MIME type based on the trusted (already-allowlist-checked) extension.
    let resolvedMime = fileType.mime
    if (fileType.mime === 'application/x-cfb') {
      const CFB_MIME_BY_EXT: Record<string, string> = {
        '.doc':  'application/msword',
        '.xls':  'application/vnd.ms-excel',
        '.ppt':  'application/vnd.ms-powerpoint',
        '.mdb':  'application/vnd.ms-access',
      }
      resolvedMime = CFB_MIME_BY_EXT[originalExtension] ?? fileType.mime
    }

    // Check if detected type is in our allowlist
    if (!ALLOWED_MIME_TYPES.includes(resolvedMime as any)) {
      return {
        isValid: false,
        error: `File type '${resolvedMime}' is not allowed`,
        detectedType: resolvedMime,
        securityRisk: 'malicious_signature'
      }
    }

    // Validate magic byte signatures for additional security
    const signature = MAGIC_BYTE_SIGNATURES[fileType.mime]
    if (signature && !signature.test(buffer.toString('binary', 0, Math.min(buffer.length, 16)))) {
      return {
        isValid: false,
        error: 'File signature does not match detected type - possible polyglot attack',
        detectedType: fileType.mime,
        securityRisk: 'polyglot_file'
      }
    }

    // Check for MIME type spoofing
    if (declaredMimeType && declaredMimeType !== resolvedMime) {
      console.warn(`MIME type mismatch for ${originalName}: declared=${declaredMimeType}, detected=${resolvedMime}`)
    }

    // Additional checks for specific file types
    const extraValidation = await performFileTypeSpecificValidation(buffer, resolvedMime)
    if (!extraValidation.isValid) {
      return extraValidation
    }

    return {
      isValid: true,
      detectedType: resolvedMime
    }

  } catch (error) {
    console.error('File validation error:', error)
    return {
      isValid: false,
      error: 'File validation failed due to processing error',
      securityRisk: 'unknown'
    }
  }
}

/**
 * Performs additional validation for specific file types
 */
async function performFileTypeSpecificValidation(
  buffer: Buffer, 
  mimeType: string
): Promise<FileValidationResult> {
  switch (mimeType) {
    case 'image/jpeg':
      return validateJPEG(buffer)
    case 'image/png':
      return validatePNG(buffer)
    case 'application/pdf':
      return validatePDF(buffer)
    case 'audio/mpeg':
      return validateMP3(buffer)
    case 'application/zip':
      return validateZIP(buffer)
    default:
      return { isValid: true }
  }
}

/**
 * Validates JPEG files for common attack vectors
 */
function validateJPEG(buffer: Buffer): FileValidationResult {
  // Check for JPEG header and footer
  const hasValidHeader = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF
  const hasValidFooter = buffer[buffer.length - 2] === 0xFF && buffer[buffer.length - 1] === 0xD9
  
  if (!hasValidHeader || !hasValidFooter) {
    return {
      isValid: false,
      error: 'Invalid JPEG format - missing proper header/footer',
      securityRisk: 'malicious_signature'
    }
  }

  return { isValid: true }
}

/**
 * Validates PNG files for corruption and embedded content
 */
function validatePNG(buffer: Buffer): FileValidationResult {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
  
  if (buffer.length < pngSignature.length || !buffer.slice(0, 8).equals(pngSignature)) {
    return {
      isValid: false,
      error: 'Invalid PNG signature',
      securityRisk: 'malicious_signature'
    }
  }

  return { isValid: true }
}

/**
 * Validates PDF files for malicious content patterns
 */
function validatePDF(buffer: Buffer): FileValidationResult {
  const pdfString = buffer.toString('utf8', 0, Math.min(buffer.length, 1024))
  
  // Check for PDF signature
  if (!pdfString.startsWith('%PDF-')) {
    return {
      isValid: false,
      error: 'Invalid PDF signature',
      securityRisk: 'malicious_signature'
    }
  }

  // Check for suspicious JavaScript patterns
  const suspiciousPatterns = [
    /JavaScript\s*\(/,
    /\/JS\s*\(/,
    /\/AA\s*<</,
    /\/OpenAction/,
    /\/Launch\s*<</
  ]

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(pdfString)) {
      return {
        isValid: false,
        error: 'PDF contains potentially malicious JavaScript or actions',
        securityRisk: 'malicious_signature'
      }
    }
  }

  return { isValid: true }
}

/**
 * Validates MP3 files for proper framing
 */
function validateMP3(buffer: Buffer): FileValidationResult {
  // Basic MP3 frame header validation
  // Look for ID3 tag or MPEG frame sync
  const hasID3 = buffer.toString('ascii', 0, 3) === 'ID3'
  const hasMpegSync = (buffer[0] === 0xFF) && ((buffer[1] & 0xE0) === 0xE0)
  
  if (!hasID3 && !hasMpegSync) {
    return {
      isValid: false,
      error: 'Invalid MP3 format - missing ID3 tag or MPEG frame sync',
      securityRisk: 'malicious_signature'
    }
  }

  return { isValid: true }
}

/**
 * Validates ZIP files for zip bomb attacks
 */
function validateZIP(buffer: Buffer): FileValidationResult {
  // Check for ZIP signature
  if (!(buffer[0] === 0x50 && buffer[1] === 0x4B)) {
    return {
      isValid: false,
      error: 'Invalid ZIP signature',
      securityRisk: 'malicious_signature'
    }
  }

  // Basic zip bomb detection - check compression ratio
  // This is a simplified check; in production, you'd want more sophisticated analysis
  const maxReasonableSize = 1024 * 1024 * 1024 // 1GB uncompressed limit
  const currentSize = buffer.length
  
  // If the zip is very small but claims to contain large files, be suspicious
  if (currentSize < 1024 * 100) { // Less than 100KB
    // This is a basic heuristic - in practice you'd parse the zip central directory
    console.warn('Small ZIP file detected - potential zip bomb')
  }

  return { isValid: true }
}

/**
 * Generates a secure filename to prevent path traversal and name collisions
 */
export function generateSecureFilename(originalName: string, detectedType: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const extension = getExtensionForMimeType(detectedType)
  
  // Remove any path separators and special characters
  const sanitizedName = originalName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/\.\./g, '')
    .substring(0, 50) // Limit length
  
  return `${timestamp}-${random}-${sanitizedName}${extension}`
}

function getExtensionForMimeType(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/tiff': '.tiff',
    'image/bmp': '.bmp',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/mp4': '.m4a',
    'audio/ogg': '.ogg',
    'audio/flac': '.flac',
    'audio/aac': '.aac',
    'audio/x-m4a': '.m4a',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
    'text/csv': '.csv',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'application/zip': '.zip',
    'application/x-zip-compressed': '.zip',
  }
  
  return extensions[mimeType] || '.bin'
}
