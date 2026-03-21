import { NextRequest, NextResponse } from 'next/server'
import type { TrainingJob } from '@/types/voice'

// Access global training jobs map
if (!global.trainingJobsGlobal) {
  global.trainingJobsGlobal = new Map()
}
const trainingJobs = global.trainingJobsGlobal as Map<string, TrainingJob>

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    const job = trainingJobs.get(jobId)

    if (!job) {
      return NextResponse.json(
        { error: 'Training job not found' },
        { status: 404 }
      )
    }

    // The background pipeline (runTrainingPipeline) updates job status
    // directly in memory — just return the current state
    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      currentStage: job.currentStage,
      error: job.error,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      modelId: job.modelId,
      modelPath: job.modelPath,
    })
  } catch (error) {
    console.error('Training status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
