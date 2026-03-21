import { NextRequest, NextResponse } from 'next/server'

// Mock training queue
interface TrainingJob {
  id: string
  userId: string
  modelId: string
  priority: 'low' | 'normal' | 'high'
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  queuePosition?: number
  estimatedStartTime?: Date
  gpuAssigned?: string
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  errorMessage?: string
}

// Mock GPU pool
interface GPUResource {
  id: string
  name: string
  memory: number
  status: 'available' | 'busy' | 'maintenance'
  currentJob?: string
  performance: {
    throughput: number // models per hour
  }
}

const trainingQueue: TrainingJob[] = []
const gpuPool: GPUResource[] = [
  { id: 'gpu-1', name: 'RTX 4090', memory: 24, status: 'available', performance: { throughput: 4 } },
  { id: 'gpu-2', name: 'RTX 4090', memory: 24, status: 'available', performance: { throughput: 4 } },
  { id: 'gpu-3', name: 'A100', memory: 40, status: 'maintenance', performance: { throughput: 8 } },
]

// Queue management functions
function addToQueue(job: Omit<TrainingJob, 'queuePosition' | 'estimatedStartTime'>): void {
  const position = trainingQueue.filter(j => j.status === 'queued').length + 1
  const estimatedStartTime = new Date(Date.now() + (position - 1) * 30 * 60 * 1000) // 30 min per job
  
  trainingQueue.push({
    ...job,
    queuePosition: position,
    estimatedStartTime,
  })
  
  // Sort queue by priority and creation time
  trainingQueue.sort((a, b) => {
    const priorityOrder = { high: 3, normal: 2, low: 1 }
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    }
    return a.createdAt.getTime() - b.createdAt.getTime()
  })
  
  // Update positions
  trainingQueue.forEach((job, index) => {
    if (job.status === 'queued') {
      job.queuePosition = index + 1
      job.estimatedStartTime = new Date(Date.now() + index * 30 * 60 * 1000)
    }
  })
}

function assignGPU(): GPUResource | null {
  return gpuPool.find(gpu => gpu.status === 'available') || null
}

async function processQueue(): Promise<void> {
  // Find queued jobs
  const queuedJobs = trainingQueue.filter(job => job.status === 'queued')
  
  for (const job of queuedJobs) {
    const gpu = assignGPU()
    if (gpu) {
      // Assign GPU and start training
      gpu.status = 'busy'
      gpu.currentJob = job.id
      job.status = 'processing'
      job.startedAt = new Date()
      job.gpuAssigned = gpu.id
      
      // Simulate training
      setTimeout(() => {
        completeTraining(job.id, gpu.id)
      }, 30 * 60 * 1000) // 30 minutes
    }
  }
}

function completeTraining(jobId: string, gpuId: string): void {
  const job = trainingQueue.find(j => j.id === jobId)
  const gpu = gpuPool.find(g => g.id === gpuId)
  
  if (job) {
    job.status = 'completed'
    job.completedAt = new Date()
  }
  
  if (gpu) {
    gpu.status = 'available'
    gpu.currentJob = undefined
  }
  
  // Process next job in queue
  processQueue()
}

// API endpoints
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const status = searchParams.get('status')
  
  let jobs = trainingQueue
  
  if (userId) {
    jobs = jobs.filter(job => job.userId === userId)
  }
  
  if (status) {
    jobs = jobs.filter(job => job.status === status)
  }
  
  return NextResponse.json({
    queue: jobs,
    gpuPool: gpuPool,
    stats: {
      totalJobs: trainingQueue.length,
      queuedJobs: trainingQueue.filter(j => j.status === 'queued').length,
      processingJobs: trainingQueue.filter(j => j.status === 'processing').length,
      completedJobs: trainingQueue.filter(j => j.status === 'completed').length,
      availableGPUs: gpuPool.filter(g => g.status === 'available').length,
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const { userId, modelId, priority = 'normal' } = await request.json()
    
    if (!userId || !modelId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, modelId' },
        { status: 400 }
      )
    }
    
    const job: Omit<TrainingJob, 'queuePosition' | 'estimatedStartTime'> = {
      id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      modelId,
      priority,
      status: 'queued',
      createdAt: new Date(),
    }
    
    addToQueue(job)
    
    // Try to process queue immediately
    processQueue()
    
    return NextResponse.json({
      success: true,
      jobId: job.id,
      queuePosition: (job as any).queuePosition,
      estimatedStartTime: (job as any).estimatedStartTime,
    })
  } catch (error) {
    console.error('Queue management error:', error)
    return NextResponse.json(
      { error: 'Failed to add job to queue' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }
    
    const jobIndex = trainingQueue.findIndex(j => j.id === jobId)
    
    if (jobIndex === -1) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }
    
    const job = trainingQueue[jobIndex]
    
    if (job.status === 'processing') {
      return NextResponse.json(
        { error: 'Cannot cancel job that is currently processing' },
        { status: 400 }
      )
    }
    
    job.status = 'cancelled'
    trainingQueue.splice(jobIndex, 1)
    
    // Update queue positions
    trainingQueue.forEach((j, index) => {
      if (j.status === 'queued') {
        j.queuePosition = index + 1
        j.estimatedStartTime = new Date(Date.now() + index * 30 * 60 * 1000)
      }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Job cancelled successfully',
    })
  } catch (error) {
    console.error('Cancel job error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel job' },
      { status: 500 }
    )
  }
}
