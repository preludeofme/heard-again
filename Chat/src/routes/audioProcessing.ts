import type { FastifyInstance } from 'fastify'
import { audioProcessingService } from '@/services/voice/AudioProcessingService'
import { AudioProcessingResult, RegisterAudioUploadRequest } from '@/types/audioProcessing'

export function registerAudioProcessingRoutes(app: FastifyInstance): void {
  app.post('/api/audio/uploads', async (req, reply) => {
    const body = req.body as Partial<RegisterAudioUploadRequest>

    if (!body.familyspaceId || !body.userId || !body.fileName || !body.mimeType) {
      return reply.code(400).send({
        error: 'Missing required fields: familyspaceId, userId, fileName, mimeType',
      })
    }

    const created = await audioProcessingService.registerUpload({
      familyspaceId: body.familyspaceId,
      userId: body.userId,
      personId: body.personId,
      fileName: body.fileName,
      mimeType: body.mimeType,
      processingPreference: body.processingPreference,
    })

    return reply.code(201).send({ success: true, data: created })
  })

  app.put('/api/audio/uploads/:uploadId/result', async (req, reply) => {
    const params = req.params as { uploadId: string }
    const body = req.body as Partial<AudioProcessingResult>

    if (!params.uploadId) {
      return reply.code(400).send({ error: 'Missing uploadId' })
    }

    if (!body.originalFileUrl || !body.normalizedFileUrl || !body.qualityTier || !body.processingMode) {
      return reply.code(400).send({
        error: 'Missing required result fields: originalFileUrl, normalizedFileUrl, qualityTier, processingMode',
      })
    }

    const persisted = audioProcessingService.upsertProcessingResult({
      uploadId: params.uploadId,
      familyspaceId: body.familyspaceId ?? 'unknown-familyspace',
      personId: body.personId,
      originalFileUrl: body.originalFileUrl,
      normalizedFileUrl: body.normalizedFileUrl,
      denoisedFileUrl: body.denoisedFileUrl,
      enhancedFileUrl: body.enhancedFileUrl,
      cloneReadyFileUrl: body.cloneReadyFileUrl,
      enhancedListeningFileUrl: body.enhancedListeningFileUrl,
      detectedSpeakers: body.detectedSpeakers ?? 1,
      selectedSpeakerId: body.selectedSpeakerId,
      speakerCountConfidence: body.speakerCountConfidence,
      speechDurationSeconds: body.speechDurationSeconds ?? 0,
      totalDurationSeconds: body.totalDurationSeconds ?? 0,
      signalToNoiseEstimate: body.signalToNoiseEstimate,
      clippingDetected: body.clippingDetected ?? false,
      musicDetected: body.musicDetected ?? false,
      processingMode: body.processingMode,
      qualityTier: body.qualityTier,
      qualityScore: body.qualityScore,
      warnings: body.warnings ?? [],
      stageDurationsMs: body.stageDurationsMs,
      pipelineVersion: body.pipelineVersion ?? 'upload-v1',
      createdAt: body.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    return reply.send({ success: true, data: persisted })
  })

  app.get('/api/audio/uploads/:uploadId/result', async (req, reply) => {
    const params = req.params as { uploadId: string }

    const result = audioProcessingService.getProcessingResult(params.uploadId)
    if (!result) {
      return reply.code(404).send({ error: 'Audio upload not found' })
    }

    return reply.send({ success: true, data: result })
  })
}
