import { NextRequest, NextResponse } from 'next/server'
import { GPTSoVITSAdapter } from '@/lib/gpt-sovits-adapter'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import type { UploadedFile } from '@/types/voice'

// Declare global for uploaded files access
if (!global.uploadedFiles) {
  global.uploadedFiles = new Map()
}
const uploadedFiles = global.uploadedFiles as Map<string, UploadedFile>

export async function POST(request: NextRequest) {
  console.log('[ENHANCE API] Received voice enhancement request')
  
  try {
    const { userId, sampleId, options } = await request.json()
    
    // Validate input
    if (!userId || !sampleId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, sampleId' },
        { status: 400 }
      )
    }

    // Get file info
    const fileInfo = uploadedFiles.get(sampleId)
    if (!fileInfo) {
      return NextResponse.json(
        { error: 'Sample not found' },
        { status: 404 }
      )
    }

    // Create output directory
    const baseDir = process.cwd()
    const outputDir = join(baseDir, 'outputs', userId, 'enhanced')
    await mkdir(outputDir, { recursive: true })

    // Prepare paths for GPT-SoVITS
    const inputPath = fileInfo.rawPath || fileInfo.gptPath
    const containerInputPath = `/app${inputPath}`
    const containerOutputPath = `/app/outputs/${userId}/enhanced`

    console.log(`[ENHANCE API] Processing: ${containerInputPath} -> ${containerOutputPath}`)

    // Check if GPT-SoVITS is available
    const gptAvailable = await GPTSoVITSAdapter.isAvailable()
    
    if (!gptAvailable) {
      return NextResponse.json(
        { error: 'GPT-SoVITS service is not available. Please start the voice infrastructure.' },
        { status: 503 }
      )
    }

    try {
      // Call GPT-SoVITS voice enhancement function
      const response = await fetch(`${process.env.GPT_SOVITS_URL || 'http://localhost:9874'}/run/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [
            fileInfo.gptPath, // Input path
            containerOutputPath, // Output path
          ],
          fn_index: 31 // Voice denoise function index
        })
      })

      if (!response.ok) {
        throw new Error(`GPT-SoVITS enhancement failed: ${response.statusText}`)
      }

      const result = await response.json()
      
      // Get the enhanced file path from result
      const enhancedFile = result.data?.[0] || `${containerOutputPath}/enhanced_${sampleId}.wav`
      
      console.log(`[ENHANCE API] Enhancement completed:`, { enhancedFile, usingRealGPT: true })
      
      return NextResponse.json({
        success: true,
        enhancedFile,
        outputPath: containerOutputPath,
        usingRealGPT: true
      })

    } catch (error) {
      console.error('[ENHANCE API] GPT-SoVITS enhancement error:', error)
      return NextResponse.json(
        { error: 'Voice enhancement failed: ' + (error as Error).message },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[ENHANCE API] Enhancement error:', error)
    return NextResponse.json(
      { error: 'Voice enhancement failed' },
      { status: 500 }
    )
  }
}
