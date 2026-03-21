import { NextRequest, NextResponse } from 'next/server'
import { GPTSoVITSAdapter } from '@/lib/gpt-sovits-adapter'
import { readFile, readdir, stat } from 'fs/promises'
import { join } from 'path'
import type { VoiceModel } from '@/types/voice'

// Get trained models from file system
async function getTrainedModelsFromFS(): Promise<Array<{ name: string; path: string; language: string; createdAt: string }>> {
  const modelsDir = join(process.cwd(), 'models', 'trained')
  const models: Array<{ name: string; path: string; language: string; createdAt: string }> = []
  
  try {
    const entries = await readdir(modelsDir, { withFileTypes: true })
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const modelPath = join(modelsDir, entry.name)
        const stats = await stat(modelPath)
        
        // Check for model files
        const modelFiles = await readdir(modelPath)
        const hasModelFiles = modelFiles.some(f => f.endsWith('.pth') || f.endsWith('.ckpt'))
        
        if (hasModelFiles) {
          models.push({
            name: entry.name,
            path: `/app/models/trained/${entry.name}`,
            language: 'en', // Default language, could be stored in metadata
            createdAt: stats.mtime.toISOString()
          })
        }
      }
    }
  } catch (error) {
    console.error('[MODELS] Failed to read models from filesystem:', error)
  }
  
  return models
}

// Import models from training route (in production, use a database)
if (!global.voiceModelsGlobal) {
  global.voiceModelsGlobal = new Map()
}
const voiceModelsGlobal = global.voiceModelsGlobal as Map<string, VoiceModel>

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const status = searchParams.get('status')

    // Get all models from our database
    let models = Array.from(voiceModelsGlobal.values())

    // Also try to get models from GPT-SoVITS
    let gptModels: any[] = []
    try {
      if (await GPTSoVITSAdapter.isAvailable()) {
        // Try to get models from GPT-SoVITS API
        gptModels = await GPTSoVITSAdapter.getModels()
        console.log(`[MODELS] Found ${gptModels.length} models in GPT-SoVITS`)
      }
    } catch (error) {
      console.error('[MODELS] Failed to get GPT-SoVITS models:', error)
    }
    
    // Also check local file system for trained models
    const localModels = await getTrainedModelsFromFS()
    console.log(`[MODELS] Found ${localModels.length} models in local storage`)

    // Filter by user if specified
    if (userId) {
      models = models.filter(model => model.userId === userId)
    }

    // Filter by status if specified
    if (status) {
      models = models.filter(model => model.status === status)
    }

    // Sort by creation date (newest first)
    models.sort((a, b) => 
      new Date(b.metadata?.createdAt || b.createdAt).getTime() - 
      new Date(a.metadata?.createdAt || a.createdAt).getTime()
    )

    // Combine our models with GPT models
    const allModels: (VoiceModel & { isLocalModel?: boolean })[] = models.map(model => ({
      id: model.id,
      userId: model.userId,
      name: model.name,
      displayName: model.name,
      gptName: model.gptName,
      status: model.status,
      language: model.metadata?.language || model.language,
      sampleCount: model.metadata?.sampleCount || model.sampleCount,
      createdAt: model.metadata?.createdAt || model.createdAt,
      modelPath: model.modelPath,
      isGPTModel: false,
    }))

    // Add GPT-only models (not in our database)
    for (const gptModel of gptModels) {
      if (!allModels.find(m => m.gptName === gptModel.name)) {
        allModels.push({
          id: `gpt_${gptModel.name}`,
          userId: 'system',
          name: gptModel.name,
          displayName: gptModel.name,
          gptName: gptModel.name,
          status: 'ready',
          language: gptModel.language,
          sampleCount: 0,
          createdAt: gptModel.createdAt || new Date().toISOString(),
          modelPath: gptModel.path,
          isGPTModel: true,
        })
      }
    }
    
    // Add locally trained models
    for (const localModel of localModels) {
      if (!allModels.find(m => m.gptName === localModel.name)) {
        allModels.push({
          id: `local_${localModel.name}`,
          userId: 'system',
          name: localModel.name,
          displayName: localModel.name,
          gptName: localModel.name,
          status: 'ready',
          language: localModel.language,
          sampleCount: 0,
          createdAt: localModel.createdAt,
          modelPath: localModel.path,
          isGPTModel: false,
          isLocalModel: true,
        })
      }
    }

    return NextResponse.json({
      success: true,
      models: allModels,
      count: allModels.length,
      gptAvailable: await GPTSoVITSAdapter.isAvailable(),
    })
  } catch (error) {
    console.error('Models list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
