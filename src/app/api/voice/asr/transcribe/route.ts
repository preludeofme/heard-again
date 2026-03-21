import { NextRequest, NextResponse } from 'next/server'
import { GPTSoVITSAdapter } from '@/lib/gpt-sovits-adapter'

export async function POST(request: NextRequest) {
  console.log('[ASR API] Received transcription request')
  
  try {
    const {
      userId,
      inputFolder,
      language = 'en',
      model = 'Faster Whisper (多语种)',
      modelSize = 'large',
    } = await request.json()
    
    // Validate input
    if (!userId || !inputFolder) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, inputFolder' },
        { status: 400 }
      )
    }

    // GPT-SoVITS standard ASR output directory (inside container workspace)
    const containerOutputPath = `output/asr_opt`

    console.log(`[ASR API] Processing from ${inputFolder} to ${containerOutputPath}`)

    // Check if GPT-SoVITS is available
    const gptAvailable = await GPTSoVITSAdapter.isAvailable()
    
    if (!gptAvailable) {
      return NextResponse.json(
        { error: 'GPT-SoVITS service is not available. Please start the voice infrastructure.' },
        { status: 503 }
      )
    }

    try {
      // Call GPT-SoVITS batch ASR function (fn_index=4)
      // 5 inputs: input_folder, output_folder, asr_model, model_size, language
      const response = await fetch(`${process.env.GPT_SOVITS_URL || 'http://localhost:9874'}/run/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [
            inputFolder,                         // Input folder (sliced audio)
            containerOutputPath,                  // Output folder
            model,                               // ASR model
            modelSize,                           // Model size
            language                             // Language
          ],
          fn_index: 4 // Start batch ASR
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`GPT-SoVITS ASR failed: ${response.statusText} - ${errorText}`)
      }

      const result = await response.json()
      
      // The ASR output is typically a status/info string
      // The actual .list file is written to the output folder by GPT-SoVITS
      const asrOutput = result.data?.[0] || ''
      
      console.log(`[ASR API] Transcription completed:`, { 
        asrOutput,
        outputPath: containerOutputPath,
      })
      
      return NextResponse.json({
        success: true,
        asrOutput,
        outputPath: containerOutputPath,
      })

    } catch (error) {
      console.error('[ASR API] GPT-SoVITS ASR error:', error)
      return NextResponse.json(
        { error: 'ASR transcription failed: ' + (error as Error).message },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('[ASR API] Transcription error:', error)
    return NextResponse.json(
      { error: 'ASR transcription failed' },
      { status: 500 }
    )
  }
}
