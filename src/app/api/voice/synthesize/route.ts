import { NextRequest, NextResponse } from 'next/server'
import { GPTSoVITSAdapter } from '@/lib/gpt-sovits-adapter'
import type { VoiceModel } from '@/types/voice'

// Import models from training route (in production, use a database)
declare global {
  var voiceModelsGlobal: Map<string, VoiceModel> | undefined
}

if (!global.voiceModelsGlobal) {
  global.voiceModelsGlobal = new Map()
}
const voiceModels = global.voiceModelsGlobal

export async function POST(request: NextRequest) {
  console.log('[SYNTHESIS API] Received synthesis request')
  
  try {
    const { modelId, text, language = 'en', speed = 1.0, pitch = 1.0 } = await request.json()

    // Validate input
    if (!modelId || !text) {
      return NextResponse.json(
        { error: 'Missing required fields: modelId, text' },
        { status: 400 }
      )
    }

    // Validate text length
    if (text.length > 1000) {
      return NextResponse.json(
        { error: 'Text too long (max 1000 characters)' },
        { status: 400 }
      )
    }

    // Get model info
    const model = voiceModels.get(modelId)
    if (!model) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      )
    }

    // Check if GPT-SoVITS is available
    const gptAvailable = await GPTSoVITSAdapter.isAvailable()
    
    if (!gptAvailable) {
      return NextResponse.json(
        { error: 'GPT-SoVITS service is not available. Please start the voice infrastructure with: npm run start:voice' },
        { status: 503 }
      )
    }

    if (!model.gptName) {
      return NextResponse.json(
        { error: 'Model does not have a valid GPT-SoVITS reference name' },
        { status: 400 }
      )
    }

    console.log(`[SYNTHESIS API] Using GPT-SoVITS for model ${model.gptName}`)
    
    const result = await GPTSoVITSAdapter.synthesize({
      text,
      modelRef: model.gptName,
      language,
      speed,
      pitch,
    })
    
    console.log(`[SYNTHESIS API] Synthesis successful`)
    
    return NextResponse.json({
      success: true,
      audioUrl: result.audioUrl,
      modelId,
      text,
      language,
      duration: result.duration || Math.round(text.length * 0.06 * speed),
      synthesisTime: Date.now(),
    })
  } catch (error) {
    console.error('Voice synthesis error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

