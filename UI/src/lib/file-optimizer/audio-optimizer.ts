import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { logger } from '@/lib/logger'
import { OptimizationOptions, OptimizationResult } from './index'

const execFileAsync = promisify(execFile)

// Inputs that should be transcoded to MP3 (fixes duration metadata + reduces size)
const TRANSCODE_TO_MP3 = new Set([
  'audio/webm',
  'video/webm', // MediaRecorder produces webm that gets detected as video/webm
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
])

export class AudioOptimizer {
  private supportedMimeTypes = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/flac',
    'audio/x-flac',
    'audio/m4a',
    'audio/mp4',
    'audio/ogg',
    'audio/webm',
    'video/webm', // MediaRecorder recordings often detected as video/webm
  ]

  async optimize(
    file: Buffer,
    mimeType: string,
    originalName: string,
    options: OptimizationOptions = {}
  ): Promise<OptimizationResult> {
    const originalSize = file.length
    const quality = options.quality || 80

    try {
      let optimizedBuffer: Buffer
      let outputMimeType = mimeType
      let optimizationMethod = 'none'

      if (process.env.VERCEL === '1') {
        return { optimizedFile: file, originalSize, optimizedSize: originalSize, compressionRatio: 1, mimeType, optimizationMethod: 'skipped' }
      }

      if (TRANSCODE_TO_MP3.has(mimeType)) {
        optimizedBuffer = await this.convertToMp3(file, quality)
        outputMimeType = 'audio/mpeg'
        optimizationMethod = `${mimeType.split('/')[1]}-to-mp3`
      } else if ((mimeType === 'audio/mpeg' || mimeType === 'audio/mp3') && originalSize > 10 * 1024 * 1024) {
        optimizedBuffer = await this.reEncodeMp3(file, quality)
        optimizationMethod = 'mp3-reencode'
      } else {
        optimizedBuffer = file
      }

      const optimizedSize = optimizedBuffer.length

      return {
        optimizedFile: optimizedBuffer,
        originalSize,
        optimizedSize,
        compressionRatio: originalSize > 0 ? optimizedSize / originalSize : 1,
        mimeType: outputMimeType,
        optimizationMethod,
      }
    } catch (error) {
      logger.error('Audio optimization failed:', error)
      return {
        optimizedFile: file,
        originalSize,
        optimizedSize: originalSize,
        compressionRatio: 1,
        mimeType,
        optimizationMethod: 'failed',
      }
    }
  }

  getSupportedMimeTypes(): string[] {
    return this.supportedMimeTypes
  }

  private async convertToMp3(file: Buffer, quality: number): Promise<Buffer> {
    // Bitrate tiers: voice recordings don't need more than 64kbps mono
    const bitrate = quality >= 90 ? '128k' : quality >= 70 ? '96k' : '64k'

    const tmpIn = path.join(os.tmpdir(), `ha-audio-in-${Date.now()}-${process.pid}.webm`)
    const tmpOut = path.join(os.tmpdir(), `ha-audio-out-${Date.now()}-${process.pid}.mp3`)

    try {
      fs.writeFileSync(tmpIn, file)

      await execFileAsync('ffmpeg', [
        '-i', tmpIn,
        '-vn',                  // strip any video stream
        '-acodec', 'libmp3lame',
        '-ab', bitrate,
        '-ac', '1',             // mono — sufficient for voice
        '-ar', '22050',         // 22kHz — sufficient for voice, halves file size vs 44kHz
        '-y',
        tmpOut,
      ])

      return fs.readFileSync(tmpOut)
    } finally {
      try { fs.unlinkSync(tmpIn) } catch {}
      try { fs.unlinkSync(tmpOut) } catch {}
    }
  }

  private async reEncodeMp3(file: Buffer, quality: number): Promise<Buffer> {
    const bitrate = quality >= 90 ? '128k' : '64k'
    const tmpIn = path.join(os.tmpdir(), `ha-mp3-in-${Date.now()}-${process.pid}.mp3`)
    const tmpOut = path.join(os.tmpdir(), `ha-mp3-out-${Date.now()}-${process.pid}.mp3`)

    try {
      fs.writeFileSync(tmpIn, file)
      await execFileAsync('ffmpeg', ['-i', tmpIn, '-acodec', 'libmp3lame', '-ab', bitrate, '-y', tmpOut])
      return fs.readFileSync(tmpOut)
    } finally {
      try { fs.unlinkSync(tmpIn) } catch {}
      try { fs.unlinkSync(tmpOut) } catch {}
    }
  }

  async extractDuration(file: Buffer, mimeType: string): Promise<number | null> {
    const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp3') || mimeType.includes('mpeg') ? 'mp3' : 'audio'
    const tmpIn = path.join(os.tmpdir(), `ha-probe-${Date.now()}-${process.pid}.${ext}`)

    try {
      fs.writeFileSync(tmpIn, file)
      const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        tmpIn,
      ])
      const info = JSON.parse(stdout)
      const duration = parseFloat(info?.format?.duration)
      return isFinite(duration) ? duration : null
    } catch {
      return null
    } finally {
      try { fs.unlinkSync(tmpIn) } catch {}
    }
  }
}
