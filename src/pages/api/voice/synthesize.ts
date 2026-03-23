import type { NextApiRequest, NextApiResponse } from 'next'
import { ttsRequest } from '@/lib/tts-client'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithWorkspace } from '@/lib/auth-helpers'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = await getAuthUserWithWorkspace(req, res)
    const { modelId, text, language = 'en' } = req.body

    if (!modelId || !text) {
      return res.status(400).json({ success: false, error: 'modelId and text are required' })
    }

    const voiceProfile = await prisma.voiceProfile.findFirst({
      where: {
        id: modelId,
        workspaceId: user.workspaceId,
        status: 'READY',
      },
      select: {
        id: true,
        personId: true,
      },
    })

    if (!voiceProfile) {
      return res.status(404).json({
        success: false,
        error: 'Voice profile not found or not ready',
      })
    }

    if (voiceProfile.personId) {
      const activeConsent = await prisma.voiceConsent.findFirst({
        where: {
          workspaceId: user.workspaceId,
          revokedAt: null,
          allowsGeneration: true,
          OR: [
            { voiceProfileId: voiceProfile.id },
            { personId: voiceProfile.personId },
          ],
        },
        orderBy: { recordedAt: 'desc' },
      })

      if (!activeConsent) {
        return res.status(403).json({
          success: false,
          error: 'Voice generation is blocked until explicit consent is recorded',
          code: 'VOICE_CONSENT_REQUIRED',
        })
      }
    }

    // Map language codes to Qwen3-TTS language names
    const langMap: Record<string, string> = {
      en: 'English',
      zh: 'Chinese',
      ja: 'Japanese',
      ko: 'Korean',
      auto: 'Auto',
    }
    const ttsLanguage = langMap[language] || 'English'

    const data = await ttsRequest('/api/tts/synthesize', {
      method: 'POST',
      body: {
        profileId: modelId,
        text,
        language: ttsLanguage,
      },
    })

    // Return the audio URL pointing back through the Next.js proxy
    return res.status(200).json({
      success: true,
      audioUrl: `/api/voice/audio/${data.audioId}`,
      modelId,
      text,
      language,
      duration: data.duration,
      synthesisTime: data.synthesisTime,
      aiGenerated: true,
      disclosureLabel: 'AI-Generated Audio',
      watermark: {
        type: 'metadata',
        value: 'heard-again-ai-generated-v1',
      },
    })
  } catch (error: any) {
    console.error('[API] Synthesize error:', error.message)
    return res.status(503).json({
      success: false,
      error: error.message,
    })
  }
}
