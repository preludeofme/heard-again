import { NextRequest, NextResponse } from 'next/server'
import { GPTSoVITSAdapter } from '@/lib/gpt-sovits-adapter'
import type { UploadedFile } from '@/types/voice'

// Declare global for uploaded files access
if (!global.uploadedFiles) {
  global.uploadedFiles = new Map()
}
const uploadedFiles = global.uploadedFiles as Map<string, UploadedFile>

export async function POST(request: NextRequest) {
  console.log('[SLICE API] Received audio slicing request')
  
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

    // Use the absolute container path for the uploaded file
    const containerInputPath = fileInfo.rawPath || `/app/uploads/raw/${userId}/`
    // GPT-SoVITS standard slicer output directory (inside container workspace)
    const containerOutputPath = `output/slicer_opt/${userId}`

    console.log(`[SLICE API] Processing: ${containerInputPath} -> ${containerOutputPath}`)

    // Check if GPT-SoVITS is available
    const gptAvailable = await GPTSoVITSAdapter.isAvailable()
    
    if (!gptAvailable) {
      return NextResponse.json(
        { error: 'GPT-SoVITS service is not available. Please start the voice infrastructure.' },
        { status: 503 }
      )
    }

    try {
      // Call GPT-SoVITS audio slicing function (fn_index=6)
      // 10 inputs: input, output, threshold, min_length, min_interval,
      //            hop_size, max_silence, loudness_norm, alpha_mix, cpu_threads
      const response = await fetch(`${process.env.GPT_SOVITS_URL || 'http://localhost:9874'}/run/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [
            containerInputPath,                // Audio slicer input (file or folder)
            containerOutputPath,               // Audio slicer output folder
            options?.threshold || '-34',        // Noise gate threshold
            options?.minLength || '4000',       // Minimum length (ms)
            options?.minInterval || '300',      // Minimum interval for cutting (ms)
            '10',                              // hop_size
            '500',                             // Maximum silence kept (ms)
            1,                                 // Loudness multiplier after normalized
            0.25,                              // alpha_mix
            4                                  // CPU threads
          ],
          fn_index: 6 // Start audio slicer
        })
      })

      if (!response.ok) {
        throw new Error(`GPT-SoVITS slicing failed: ${response.statusText}`)
      }

      const result = await response.json()
      
      // Parse the result to get sliced file paths
      // The response format might vary, so handle different cases
      let slicedFiles: string[] = []
      
      if (result.data && result.data[0]) {
        const data = result.data[0]
        if (Array.isArray(data)) {
          slicedFiles = data
        } else if (data.choices && Array.isArray(data.choices)) {
          // This seems to be the wrong response - might be a model selection
          console.error('[SLICE API] Unexpected response format - received model choices instead of sliced files')
          slicedFiles = []
        } else if (typeof data === 'string') {
          slicedFiles = [data]
        }
      }
      
      console.log(`[SLICE API] Slicing completed:`, { slicedFiles, usingRealGPT: true, rawResult: result })
      
      return NextResponse.json({
        success: true,
        slicedFiles,
        outputPath: containerOutputPath,
        usingRealGPT: true
      })

    } catch (error) {
      console.error('[SLICE API] GPT-SoVITS slicing error:', error)
      return NextResponse.json(
        { error: 'Audio slicing failed: ' + (error as Error).message },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('[SLICE API] Slicing error:', error)
    return NextResponse.json(
      { error: 'Audio slicing failed' },
      { status: 500 }
    )
  }
}
