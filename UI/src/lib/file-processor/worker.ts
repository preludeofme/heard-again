import { spawn } from 'child_process'
import path from 'path'
import { logger } from '@/lib/logger'

interface ProcessingJob {
  jobId: string
  inputPath: string
  outputPath: string
  operation: 'optimize-image' | 'transcode-audio' | 'process-video'
  options: Record<string, unknown>
}

interface ProcessingResult {
  success: boolean
  outputPath?: string
  error?: string
  processingTime: number
}

export async function processFileInSandbox(
  job: ProcessingJob
): Promise<ProcessingResult> {
  const startTime = Date.now()

  if (process.env.VERCEL === '1') {
    return { success: false, error: 'Sandbox processing unavailable on Vercel', processingTime: Date.now() - startTime }
  }

  return new Promise((resolve) => {
    // Use restricted child process for sandboxing
    const scriptPath = path.join(__dirname, 'sandbox-script.js')
    
    const child = spawn('node', [scriptPath, JSON.stringify(job)], {
      timeout: 30000, // 30 second timeout
      killSignal: 'SIGTERM',
      env: {
        NODE_ENV: 'production',
        // Remove sensitive env vars
        PATH: '/usr/local/bin:/usr/bin:/bin',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    
    let stdout = ''
    let stderr = ''
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString()
    })
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })
    
    child.on('close', (code) => {
      const processingTime = Date.now() - startTime
      
      if (code !== 0) {
        logger.error({
          jobId: job.jobId,
          exitCode: code,
          stderr,
        }, 'File processing failed')
        
        resolve({
          success: false,
          error: 'Processing failed',
          processingTime,
        })
        return
      }
      
      try {
        const result = JSON.parse(stdout)
        resolve({
          success: true,
          outputPath: result.outputPath,
          processingTime,
        })
      } catch {
        resolve({
          success: false,
          error: 'Invalid processing output',
          processingTime,
        })
      }
    })
    
    child.on('error', (error) => {
      logger.error({ jobId: job.jobId, error: error.message }, 'Failed to spawn worker')
      resolve({
        success: false,
        error: 'Worker error',
        processingTime: Date.now() - startTime,
      })
    })
  })
}
