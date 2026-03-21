import { NextRequest, NextResponse } from 'next/server'
import { ApiError, logApiError, createApiResponse, handleApiRoute } from '@/lib/api-logger'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { GPTSoVITSAdapter } from '@/lib/gpt-sovits-adapter'
import { existsSync } from 'fs'
import type { UploadedFile } from '@/types/voice'

// Use global variable to share uploaded files between routes (in production, use a database)
if (!global.uploadedFiles) {
  global.uploadedFiles = new Map()
}
const uploadedFiles = global.uploadedFiles

async function uploadSampleHandler(request: NextRequest) {
  const requestId = request.headers.get('x-request-id')
  
  try {
    const formData = await request.formData()
    const file = formData.get('audio') as File
    const userId = formData.get('userId') as string
    const jobId = formData.get('jobId') as string

    // Validate input
    if (!file || !userId) {
      throw new ApiError(
        'Missing required fields: audio file, userId',
        400,
        'MISSING_FIELDS',
        { hasFile: !!file, hasUserId: !!userId }
      )
    }

    // Validate file type
    const allowedTypes = ['audio/wav', 'audio/mp3', 'audio/m4a', 'audio/x-m4a', 'audio/flac', 'audio/mpeg', 'audio/mp4']
    if (!allowedTypes.includes(file.type)) {
      throw new ApiError(
        'Invalid file type. Allowed: WAV, MP3, M4A, FLAC, MPEG, MP4',
        400,
        'INVALID_FILE_TYPE',
        { receivedType: file.type, allowedTypes }
      )
    }

    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      throw new ApiError(
        'File too large (max 100MB)',
        400,
        'FILE_TOO_LARGE',
        { fileSize: file.size, maxSize: 100 * 1024 * 1024 }
      )
    }

    // Generate unique filename
    const fileId = uuidv4()
    const extension = file.name.split('.').pop()
    const filename = `${fileId}.${extension}`

    // Create GPT-SoVITS compatible directory structure
    const baseDir = process.cwd()
    const gptRawDir = join(baseDir, 'uploads', 'raw', userId)
    const localUploadDir = join(baseDir, 'uploads', 'audio', userId)
    
    // Ensure directories exist
    try {
      await mkdir(gptRawDir, { recursive: true })
      await mkdir(localUploadDir, { recursive: true })
    } catch (error) {
      // Directory might already exist
    }

    // Save file to both locations: local uploads and GPT-SoVITS raw directory
    const localFilePath = join(localUploadDir, filename)
    const gptFilePath = join(gptRawDir, filename)
    
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    // Write to both locations
    await writeFile(localFilePath, buffer)
    await writeFile(gptFilePath, buffer)

    // Analyze audio (mock analysis)
    const analysis = {
      duration: Math.random() * 30 + 10, // 10-40 seconds
      sampleRate: 44100,
      bitRate: 320,
      channels: 1,
      quality: Math.random() > 0.3 ? 'good' : 'poor', // Mock quality check
      hasBackgroundNoise: Math.random() > 0.7,
    }

    // Log successful upload
    console.log(`[${new Date().toISOString()}] Audio upload successful:`, {
      requestId,
      userId,
      fileId,
      filename,
      size: file.size,
      type: file.type
    })

    // Upload to GPT-SoVITS — required for training pipeline
    const gptContainerPath = `/app/uploads/raw/${userId}/${filename}`
    let gptPath: string | undefined
    
    const gptAvailable = await GPTSoVITSAdapter.isAvailable()
    if (!gptAvailable) {
      throw new ApiError(
        'GPT-SoVITS service is not available. Please start the voice infrastructure with: npm run start:voice',
        503,
        'GPT_SOVITS_UNAVAILABLE'
      )
    }

    try {
      const audioFile = new File([buffer], filename, { type: file.type })
      gptPath = await GPTSoVITSAdapter.uploadAudio(audioFile)
      console.log('[UPLOAD] GPT-SoVITS upload successful:', gptPath)
    } catch (error) {
      console.error('[UPLOAD] GPT-SoVITS upload failed:', error)
      throw new ApiError(
        'Failed to upload audio to GPT-SoVITS. Please check the voice infrastructure.',
        502,
        'GPT_SOVITS_UPLOAD_FAILED'
      )
    }

    // Store file mapping with all paths
    uploadedFiles.set(fileId, {
      filePath: `/uploads/audio/${userId}/${filename}`,
      gptPath: gptPath as string,
      rawPath: `/app/uploads/raw/${userId}/${filename}`, // Absolute container path for preprocessing
    })

    return NextResponse.json(
      createApiResponse(true, {
        fileId,
        filename,
        url: `/uploads/audio/${userId}/${filename}`,
        size: file.size,
        type: file.type,
        analysis,
        uploadedAt: new Date().toISOString(),
        gptPath: gptContainerPath, // Include GPT path for training
        localPath: `/uploads/audio/${userId}/${filename}`,
        rawPath: `/uploads/raw/${userId}/${filename}`, // Raw file path for preprocessing
      })
    )
  } catch (error: any) {
    // Re-throw ApiErrors to be handled by the wrapper
    if (error instanceof ApiError) {
      throw error
    }
    
    // Log unexpected errors
    logApiError(error, {
      endpoint: 'POST /api/voice/upload-sample',
      method: 'POST',
      requestId: requestId || 'unknown',
    })
    
    throw new ApiError('Failed to upload audio file', 500, 'UPLOAD_FAILED')
  }
}

// Export with error handling wrapper
export const POST = handleApiRoute(uploadSampleHandler as any)
