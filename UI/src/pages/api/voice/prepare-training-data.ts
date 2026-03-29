import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import fs from 'fs'
import path from 'path'

/**
 * POST /api/voice/prepare-training-data
 * 
 * Prepare training data for voice cloning by:
 * 1. Collecting all audio assets for a person
 * 2. Generating a .list file with audio paths and transcripts
 * 3. Setting up proper training data folder structure
 * 
 * The .list file format is compatible with Qwen3-TTS training:
 *   /path/to/audio.wav|transcript text here
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const { personId, voiceProfileId, sampleAssetIds } = req.body

    if (!personId && !voiceProfileId && (!sampleAssetIds || !Array.isArray(sampleAssetIds))) {
      return res.status(400).json({
        success: false,
        error: 'Provide personId, voiceProfileId, or sampleAssetIds',
      })
    }

    // Build query for audio assets
    let assets: any[] = []

    if (sampleAssetIds && sampleAssetIds.length > 0) {
      // Use specific assets
      assets = await prisma.asset.findMany({
        where: {
          id: { in: sampleAssetIds },
          workspaceId: user.workspaceId,
          assetType: 'AUDIO',
        },
        orderBy: { createdAt: 'asc' },
      })
    } else if (voiceProfileId) {
      // Get assets linked to a voice profile
      const profile = await prisma.voiceProfile.findFirst({
        where: {
          id: voiceProfileId,
          workspaceId: user.workspaceId,
        },
        include: {
          sourceAsset: true,
        },
      })
      if (profile?.sourceAsset) {
        assets = [profile.sourceAsset]
      }
    } else if (personId) {
      // Get all audio assets for a person
      // Look for assets that might be voice samples for this person
      assets = await prisma.asset.findMany({
        where: {
          workspaceId: user.workspaceId,
          assetType: 'AUDIO',
          transcript: { not: null }, // Must have transcript
        },
        orderBy: { createdAt: 'asc' },
        take: 50, // Limit to prevent huge training sets
      })
    }

    if (assets.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No audio samples with transcripts found',
      })
    }

    // Filter to only assets that exist on disk and have transcripts
    const validAssets = assets.filter((asset) => {
      const fileExists = fs.existsSync(asset.storagePath)
      const hasTranscript = asset.transcript && asset.transcript.trim().length > 0
      return fileExists && hasTranscript
    })

    if (validAssets.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No valid audio files with transcripts found on disk',
      })
    }

    // Create training data directory structure
    const baseDir = process.env.VOICE_TRAINING_DATA_DIR || './tts-service/training_data'
    const profileName = voiceProfileId || personId || `training_${Date.now()}`
    const trainingDir = path.join(baseDir, profileName)
    const wavDir = path.join(trainingDir, 'wavs')

    // Create directories
    fs.mkdirSync(wavDir, { recursive: true })

    // Copy/link audio files to wavs directory and build .list content
    const listEntries: string[] = []
    const processedAssets: Array<{
      assetId: string
      originalPath: string
      trainingPath: string
      transcript: string
      duration: number
    }> = []

    for (let i = 0; i < validAssets.length; i++) {
      const asset = validAssets[i]
      const wavFilename = `sample_${String(i + 1).padStart(4, '0')}.wav`
      const trainingPath = path.join(wavDir, wavFilename)

      // Copy file to training directory (or create symlink)
      try {
        fs.copyFileSync(asset.storagePath, trainingPath)
      } catch (err) {
        console.warn(`Failed to copy ${asset.storagePath} to ${trainingPath}`)
        continue
      }

      // Build list entry: path|transcript
      // Use relative path from training directory
      const relativeWavPath = path.join('wavs', wavFilename)
      const transcript = asset.transcript!.trim()
      listEntries.push(`${relativeWavPath}|${transcript}`)

      processedAssets.push({
        assetId: asset.id,
        originalPath: asset.storagePath,
        trainingPath,
        transcript,
        duration: asset.durationSeconds || 0,
      })
    }

    // Write the .list file
    const listContent = listEntries.join('\n')
    const listPath = path.join(trainingDir, 'train.list')
    fs.writeFileSync(listPath, listContent, 'utf-8')

    // Also write a metadata JSON file with additional info
    const metadata = {
      profileName,
      workspaceId: user.workspaceId,
      personId: personId || null,
      voiceProfileId: voiceProfileId || null,
      createdAt: new Date().toISOString(),
      sampleCount: processedAssets.length,
      totalDurationSeconds: processedAssets.reduce((sum, a) => sum + a.duration, 0),
      samples: processedAssets.map((a) => ({
        assetId: a.assetId,
        filename: path.basename(a.trainingPath),
        transcript: a.transcript,
        duration: a.duration,
      })),
    }
    const metadataPath = path.join(trainingDir, 'metadata.json')
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8')

    return res.status(200).json({
      success: true,
      trainingData: {
        profileName,
        directory: trainingDir,
        listFile: listPath,
        sampleCount: processedAssets.length,
        totalDurationSeconds: metadata.totalDurationSeconds,
      },
      pipeline: {
        assetsFound: assets.length,
        assetsValid: validAssets.length,
        assetsProcessed: processedAssets.length,
        listFileGenerated: true,
        folderStructureCreated: true,
      },
    })
  } catch (error: any) {
    console.error('[API] Prepare training data error:', error.message)
    return res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}
