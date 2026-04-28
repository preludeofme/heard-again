import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import fs from 'fs'
import path from 'path'

/**
 * GET /api/voice/training-data
 * 
 * List all prepared training data for the familyspace,
 * or get details for a specific training profile.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'VIEWER')

    const { profileName } = req.query
    const baseDir = process.env.VOICE_TRAINING_DATA_DIR || './tts-service/training_data'

    // If profileName specified, return details for that training data
    if (profileName && typeof profileName === 'string') {
      const trainingDir = path.join(baseDir, profileName)
      const listPath = path.join(trainingDir, 'train.list')
      const metadataPath = path.join(trainingDir, 'metadata.json')

      if (!fs.existsSync(listPath)) {
        return res.status(404).json({
          success: false,
          error: 'Training data not found',
        })
      }

      const listContent = fs.readFileSync(listPath, 'utf-8')
      const entries = listContent.split('\n').filter((line) => line.trim().length > 0)

      let metadata: any = null
      if (fs.existsSync(metadataPath)) {
        metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
      }

      return res.status(200).json({
        success: true,
        trainingData: {
          profileName,
          directory: trainingDir,
          listFile: listPath,
          entryCount: entries.length,
          entries: entries.slice(0, 10), // First 10 entries only
          metadata,
        },
      })
    }

    // List all training data directories
    if (!fs.existsSync(baseDir)) {
      return res.status(200).json({
        success: true,
        trainingDataSets: [],
      })
    }

    const entries = fs.readdirSync(baseDir, { withFileTypes: true })
    const trainingSets: Array<{
      profileName: string
      directory: string
      sampleCount: number
      totalDuration: number
      createdAt: string
    }> = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const metadataPath = path.join(baseDir, entry.name, 'metadata.json')
      const listPath = path.join(baseDir, entry.name, 'train.list')

      if (!fs.existsSync(listPath)) continue

      let info: any = {
        sampleCount: 0,
        totalDurationSeconds: 0,
        createdAt: null,
      }

      if (fs.existsSync(metadataPath)) {
        try {
          info = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
        } catch {
          // Ignore parse errors
        }
      }

      // Count entries in list file as fallback
      if (info.sampleCount === 0) {
        try {
          const listContent = fs.readFileSync(listPath, 'utf-8')
          info.sampleCount = listContent.split('\n').filter((l) => l.trim()).length
        } catch {
          // Ignore
        }
      }

      trainingSets.push({
        profileName: entry.name,
        directory: path.join(baseDir, entry.name),
        sampleCount: info.sampleCount || 0,
        totalDuration: info.totalDurationSeconds || 0,
        createdAt: info.createdAt || null,
      })
    }

    return res.status(200).json({
      success: true,
      trainingDataSets: trainingSets.sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      ),
    })
  } catch (error: any) {
    logger.error('[API] List training data error:', error.message)
    return res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}
