import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { GPTSoVITSAdapter } from '@/lib/gpt-sovits-adapter'
import type { UploadedFile, VoiceModel, TrainingJob } from '@/types/voice'

// Import uploaded files from upload route (in production, use a database)
// This is a workaround for demo purposes
declare global {
  var uploadedFiles: Map<string, UploadedFile> | undefined
  var voiceModelsGlobal: Map<string, VoiceModel> | undefined
  var trainingJobsGlobal: Map<string, TrainingJob> | undefined
}

if (!global.uploadedFiles) {
  global.uploadedFiles = new Map()
}
if (!global.voiceModelsGlobal) {
  global.voiceModelsGlobal = new Map()
}
if (!global.trainingJobsGlobal) {
  global.trainingJobsGlobal = new Map()
}
const uploadedFiles = global.uploadedFiles as Map<string, UploadedFile>
const voiceModels = global.voiceModelsGlobal as Map<string, VoiceModel>
const trainingJobs = global.trainingJobsGlobal as Map<string, TrainingJob>

const GPT_SOVITS_URL = process.env.GPT_SOVITS_URL || 'http://localhost:9874'
const NEXT_URL = process.env.NEXTAUTH_URL || 'http://localhost:3002'

// Pretrained model paths (inside GPT-SoVITS container at /workspace/)
const PRETRAINED = {
  BERT: 'GPT_SoVITS/pretrained_models/chinese-roberta-wwm-ext-large',
  SSL: 'GPT_SoVITS/pretrained_models/chinese-hubert-base',
  SOVITS_G: 'GPT_SoVITS/pretrained_models/s2G488k.pth',
  SOVITS_D: 'GPT_SoVITS/pretrained_models/s2D488k.pth',
  GPT: 'GPT_SoVITS/pretrained_models/s1bert25hz-2kh-longer-epoch=68e-step=50232.ckpt',
}

// Helper: call GPT-SoVITS Gradio predict endpoint
async function gptPredict(fnIndex: number, data: any[], timeoutMs = 300000) {
  const response = await fetch(`${GPT_SOVITS_URL}/run/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, fn_index: fnIndex }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`GPT-SoVITS fn_index=${fnIndex} failed: ${response.statusText} - ${errorText}`)
  }
  return response.json()
}

// Update job status helper
function updateJobStatus(jobId: string, status: string, progress: number, stage: string, error?: string) {
  const job = trainingJobs.get(jobId)
  if (job) {
    job.status = status
    job.progress = progress
    job.currentStage = stage
    if (error) job.error = error
  }
}

// Run the full preprocessing + training pipeline
async function runTrainingPipeline(
  jobId: string,
  modelId: string,
  userId: string,
  samples: string[],
  experimentName: string,
  language: string
) {
  try {
    // ── Step 1: Audio Slicing (fn=6) ──────────────────────────────
    updateJobStatus(jobId, 'processing', 5, 'slicing')
    console.log(`[TRAIN] Step 1: Audio slicing`)

    for (const sampleId of samples) {
      const sliceResponse = await fetch(`${NEXT_URL}/api/voice/preprocess/slice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sampleId }),
      })
      if (!sliceResponse.ok) {
        const err = await sliceResponse.json().catch(() => ({ error: 'Slice request failed' }))
        throw new Error(`Slicing failed: ${err.error}`)
      }
      const sliceResult = await sliceResponse.json()
      if (!sliceResult.success) {
        throw new Error(`Slicing failed: ${sliceResult.error || 'Unknown error'}`)
      }
    }

    // The slicer writes output to output/slicer_opt/{userId}/ inside the container
    const slicedFolder = `output/slicer_opt/${userId}`
    console.log(`[TRAIN] Slicing complete → ${slicedFolder}`)

    // ── Step 2: Denoise (fn=8, optional) ──────────────────────────
    updateJobStatus(jobId, 'processing', 15, 'denoising')
    console.log(`[TRAIN] Step 2: Denoise (optional — skipping for now)`)

    // ── Step 3: Batch ASR (fn=4) ─────────────────────────────────
    updateJobStatus(jobId, 'processing', 20, 'asr_transcription')
    console.log(`[TRAIN] Step 3: Batch ASR`)

    const asrResponse = await fetch(`${NEXT_URL}/api/voice/asr/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        inputFolder: slicedFolder,
        language,
      }),
    })
    if (!asrResponse.ok) {
      const err = await asrResponse.json().catch(() => ({ error: 'ASR request failed' }))
      throw new Error(`ASR failed: ${err.error}`)
    }
    const asrResult = await asrResponse.json()
    if (!asrResult.success) {
      throw new Error(`ASR failed: ${asrResult.error || 'Unknown error'}`)
    }

    // ASR writes a .list file to output/asr_opt/ inside the container
    // The .list file is typically named after the input folder
    const listFilePath = `${asrResult.outputPath}/${userId}.list`
    console.log(`[TRAIN] ASR complete → list file: ${listFilePath}`)

    // ── Step 4: One-click Formatting (fn=16) ──────────────────────
    // This runs: speech-to-text (BERT) + SSL extraction + semantic token extraction
    updateJobStatus(jobId, 'processing', 35, 'formatting')
    console.log(`[TRAIN] Step 4: One-click formatting`)

    const formatResult = await gptPredict(16, [
      listFilePath,          // *Text labelling file (.list)
      slicedFolder,          // *Audio dataset folder
      experimentName,        // *Experiment/model name
      '0',                   // GPU number for BERT
      '0',                   // GPU number for SSL
      '0',                   // GPU number for semantics
      PRETRAINED.BERT,       // Pretrained BERT model path
      PRETRAINED.SSL,        // Pretrained SSL model path
      PRETRAINED.SOVITS_G,   // Pretrained SoVITS-G model path
    ], 600000) // 10 min timeout for formatting

    console.log(`[TRAIN] Formatting complete:`, formatResult.data?.[0])

    // ── Step 5: SoVITS Training (fn=18) ───────────────────────────
    updateJobStatus(jobId, 'processing', 55, 'sovits_training')
    console.log(`[TRAIN] Step 5: SoVITS training`)

    const sovitsResult = await gptPredict(18, [
      4,                     // Batch size per GPU
      8,                     // Total epochs
      experimentName,        // *Experiment/model name
      1,                     // Text model learning rate weighting
      true,                  // Save only latest .ckpt
      true,                  // Save small final model to weights folder
      4,                     // Save frequency (save_every_epoch)
      '0',                   // GPU number
      PRETRAINED.SOVITS_G,   // Pretrained SoVITS-G model path
      PRETRAINED.SOVITS_D,   // Pretrained SoVITS-D model path
    ], 1800000) // 30 min timeout for SoVITS training

    console.log(`[TRAIN] SoVITS training complete:`, sovitsResult.data?.[0])

    // ── Step 6: GPT Training (fn=20) ──────────────────────────────
    updateJobStatus(jobId, 'processing', 80, 'gpt_training')
    console.log(`[TRAIN] Step 6: GPT training`)

    const gptResult = await gptPredict(20, [
      4,                     // Batch size per GPU
      15,                    // Total training epochs
      experimentName,        // *Experiment/model name
      false,                 // Enable DPO training
      true,                  // Save only latest .ckpt
      true,                  // Save small final model to weights folder
      5,                     // Save frequency (save_every_epoch)
      '0',                   // GPU number
      PRETRAINED.GPT,        // Pretrained GPT model path
    ], 1800000) // 30 min timeout for GPT training

    console.log(`[TRAIN] GPT training complete:`, gptResult.data?.[0])

    // ── Done ──────────────────────────────────────────────────────
    updateJobStatus(jobId, 'completed', 100, 'completed')
    const job = trainingJobs.get(jobId)
    if (job) {
      job.completedAt = new Date().toISOString()
      job.usingRealGPT = true
    }

    // Update model to ready
    const model = voiceModels.get(modelId)
    if (model) {
      model.status = 'ready'
      model.modelPath = `SoVITS_weights/${experimentName}`
      model.isGPTModel = true
    }

    console.log(`[TRAIN] Pipeline complete for job ${jobId}, model ${modelId}`)
  } catch (error) {
    console.error(`[TRAIN] Pipeline failed for job ${jobId}:`, error)
    updateJobStatus(jobId, 'failed', 0, 'failed', (error as Error).message)

    const model = voiceModels.get(modelId)
    if (model) {
      model.status = 'failed'
    }
  }
}

export async function POST(request: NextRequest) {
  console.log('[TRAIN API] Received training request')
  
  try {
    const { userId, samples, language, modelName } = await request.json()
    
    console.log('[TRAIN API] Request data:', { userId, sampleCount: samples?.length, language, modelName })

    // Validate input
    if (!userId || !samples || samples.length === 0 || !modelName) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, samples, modelName' },
        { status: 400 }
      )
    }

    // Check if GPT-SoVITS is available before creating any records
    const gptAvailable = await GPTSoVITSAdapter.isAvailable()
    if (!gptAvailable) {
      return NextResponse.json(
        { error: 'GPT-SoVITS service is not available. Please start the voice infrastructure with: npm run start:voice' },
        { status: 503 }
      )
    }

    // Create training job
    const jobId = uuidv4()
    const modelId = uuidv4()
    
    // Generate GPT-SoVITS compatible experiment name
    const gptModelName = modelName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
    const experimentName = `${gptModelName}_${modelId.slice(0, 8)}`

    const job: TrainingJob = {
      id: jobId,
      userId,
      modelId,
      status: 'queued',
      progress: 0,
      currentStage: 'queued',
      samples,
      language: language || 'en',
      modelName: experimentName,
      originalName: modelName,
      createdAt: new Date().toISOString(),
      error: null,
    }

    trainingJobs.set(jobId, job)

    // Create model record
    const model: VoiceModel = {
      id: modelId,
      userId,
      name: modelName,
      gptName: experimentName,
      displayName: modelName,
      status: 'training',
      modelPath: null,
      language: language || 'en',
      sampleCount: samples.length,
      createdAt: new Date().toISOString(),
      isGPTModel: false,
      metadata: {
        language: language || 'en',
        sampleCount: samples.length,
        createdAt: new Date().toISOString(),
      },
    }

    voiceModels.set(modelId, model)

    // Kick off the full pipeline in the background (non-blocking)
    // The UI polls /api/voice/train/[jobId]/status for progress
    runTrainingPipeline(jobId, modelId, userId, samples, experimentName, language || 'en')

    console.log(`[TRAIN API] Training job created:`, { jobId, modelId, experimentName })
    
    return NextResponse.json({
      success: true,
      jobId,
      modelId,
      modelName: experimentName,
      displayName: modelName,
      status: 'queued',
    })
  } catch (error) {
    console.error('[TRAIN API] Training start error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get all jobs (for debugging)
export async function GET() {
  return NextResponse.json({
    jobs: Array.from(trainingJobs.values()),
    models: Array.from(voiceModels.values()),
  })
}
