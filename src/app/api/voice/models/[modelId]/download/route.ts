import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ modelId: string }> }
) {
  try {
    const { modelId } = await params
    
    // For now, serve a placeholder file
    // In production, this would serve the actual model files
    const modelsDir = join(process.cwd(), 'models', 'trained')
    const modelPath = join(modelsDir, modelId)
    
    // Check if model exists
    if (!existsSync(modelPath)) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      )
    }
    
    // Create a zip file with all model files
    // For now, return metadata about the model
    const modelInfo = {
      id: modelId,
      downloadUrl: `/api/voice/models/${modelId}/archive`,
      files: [
        `${modelId}.pth`,
        `${modelId}.json`,
        'config.json'
      ],
      size: '125MB', // Mock size
      createdAt: new Date().toISOString()
    }
    
    return NextResponse.json({
      success: true,
      model: modelInfo
    })
    
  } catch (error) {
    console.error('[MODEL DOWNLOAD] Error:', error)
    return NextResponse.json(
      { error: 'Failed to prepare model download' },
      { status: 500 }
    )
  }
}

// Create archive endpoint for actual model download
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ modelId: string }> }
) {
  try {
    const { modelId } = await params
    
    // In production, this would create a zip file of the model
    // For now, return a mock download URL
    return NextResponse.json({
      success: true,
      downloadUrl: `https://storage.example.com/models/${modelId}.zip`,
      expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour
    })
    
  } catch (error) {
    console.error('[MODEL ARCHIVE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create model archive' },
      { status: 500 }
    )
  }
}
