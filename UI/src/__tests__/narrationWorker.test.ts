import { Job } from 'bullmq'
import { prisma } from '@/lib/prisma'
import { storageService } from '@/services/StorageService'
import { __narrationWorkerInternals } from '@/workers/narrationWorker'
import { TextEncoder, TextDecoder } from 'util'

// Polyfill globals for test environment
global.TextEncoder = TextEncoder as any
global.TextDecoder = TextDecoder as any

const { handleNarrationRender, pruneSiblingAssetsForPair, deleteAssetById } = __narrationWorkerInternals

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    voiceProfile: {
      findFirst: jest.fn(),
    },
    story: {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    voiceConsent: {
      findFirst: jest.fn(),
    },
    voiceGenerationJob: {
      update: jest.fn().mockResolvedValue({}),
    },
    asset: {
      create: jest.fn().mockResolvedValue({ id: 'new-asset-id' }),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn((promises) => Promise.all(promises)),
  },
}))

jest.mock('@/services/StorageService', () => ({
  storageService: {
    saveAudio: jest.fn(),
    deleteFile: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

// We'll need to mock fetch globally for the TTS service calls
global.fetch = jest.fn()

describe('Narration Worker', () => {
  const mockJob = {
    id: 'job-1',
    data: {
      storyId: 'story-1',
      workspaceId: 'ws-1',
      voiceProfileId: 'voice-1',
      userId: 'user-1',
      voiceGenerationJobId: 'vjob-1',
    },
    updateProgress: jest.fn().mockResolvedValue(undefined),
  } as unknown as Job

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('deleteAssetById', () => {
    it('should delete asset and file', async () => {
      ;(prisma.asset.findUnique as jest.Mock).mockResolvedValue({
        id: 'asset-1',
        storagePath: 'path/to/audio.mp3',
        assetType: 'GENERATED_AUDIO',
      })

      await deleteAssetById('asset-1')

      expect(prisma.asset.delete).toHaveBeenCalledWith({ where: { id: 'asset-1' } })
      expect(storageService.deleteFile).toHaveBeenCalledWith('path/to/audio.mp3')
    })

    it('should skip if asset is not GENERATED_AUDIO', async () => {
      ;(prisma.asset.findUnique as jest.Mock).mockResolvedValue({
        id: 'asset-1',
        assetType: 'IMAGE',
      })

      await deleteAssetById('asset-1')

      expect(prisma.asset.delete).not.toHaveBeenCalled()
      expect(storageService.deleteFile).not.toHaveBeenCalled()
    })
  })

  describe('pruneSiblingAssetsForPair', () => {
    it('should find and delete sibling assets', async () => {
      ;(prisma.asset.findMany as jest.Mock).mockResolvedValue([
        { id: 'old-asset-1' },
        { id: 'old-asset-2' },
      ])
      // Mock findUnique for the subsequent deleteAssetById calls
      ;(prisma.asset.findUnique as jest.Mock).mockResolvedValue({
        id: 'some-id',
        storagePath: 'path',
        assetType: 'GENERATED_AUDIO',
      })

      const count = await pruneSiblingAssetsForPair({
        workspaceId: 'ws-1',
        storyId: 'story-1',
        voiceProfileId: 'voice-1',
        keepAssetId: 'new-asset-id',
      })

      expect(count).toBe(2)
      expect(prisma.asset.delete).toHaveBeenCalledTimes(2)
    })
  })

  describe('handleNarrationRender', () => {
    it('should process a successful render', async () => {
      // Mock Story and Profile
      ;(prisma.story.findFirst as jest.Mock).mockResolvedValue({
        id: 'story-1',
        content: 'Hello world.',
        narrationStatus: 'PENDING',
      })
      ;(prisma.voiceProfile.findFirst as jest.Mock).mockResolvedValue({
        id: 'voice-1',
        name: 'Grandpa',
        personId: 'person-1',
      })
      ;(prisma.voiceConsent.findFirst as jest.Mock).mockResolvedValue({
        id: 'consent-1',
      })

      // Mock TTS synth stream
      const mockStream = {
        getReader: () => {
          let readCount = 0
          return {
            read: async () => {
              if (readCount === 0) {
                readCount++
                return {
                  value: new global.TextEncoder().encode(
                    JSON.stringify({ type: 'progress', sentencesDone: 1, sentencesTotal: 1 }) + '\n' +
                    JSON.stringify({
                      type: 'complete',
                      audioId: 'tts-audio-1',
                      duration: 10,
                      sampleRate: 24000,
                      synthesisTime: 5,
                      sentenceCount: 1,
                      mimeType: 'audio/mpeg'
                    }) + '\n'
                  ),
                  done: false
                }
              }
              return { value: undefined, done: true }
            }
          }
        }
      }
      
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          body: mockStream
        }) // synth-batch
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(100)
        }) // download-audio

      // Mock storage and asset creation
      ;(storageService.saveAudio as jest.Mock).mockResolvedValue({ path: 'saved/path.mp3' })
      ;(prisma.asset.findMany as jest.Mock).mockResolvedValue([]) // pruning

      const result = await handleNarrationRender(mockJob)

      expect(result).toEqual({ assetId: 'new-asset-id', audioId: 'tts-audio-1' })
      expect(prisma.voiceGenerationJob.update).toHaveBeenCalledWith({
        where: { id: 'vjob-1' },
        data: expect.objectContaining({ status: 'PROCESSING' })
      })
      expect(prisma.story.update).toHaveBeenCalled()
      expect(mockJob.updateProgress).toHaveBeenCalled()
    })

    it('should throw if consent is missing', async () => {
       ;(prisma.story.findFirst as jest.Mock).mockResolvedValue({
        id: 'story-1',
        content: 'Hello world.',
      })
      ;(prisma.voiceProfile.findFirst as jest.Mock).mockResolvedValue({
        id: 'voice-1',
        name: 'Grandpa',
        personId: 'person-1',
      })
      ;(prisma.voiceConsent.findFirst as jest.Mock).mockResolvedValue(null)

      await expect(handleNarrationRender(mockJob)).rejects.toThrow('VOICE_CONSENT_REQUIRED')
    })
  })
})
