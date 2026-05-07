/**
 * @jest-environment node
 */

// ---------------------------------------------------------------------------
// @google-cloud/storage mock
//
// jest.mock() factory is hoisted before variable declarations, so all mock
// state lives on the module object rather than outer variables.
// ---------------------------------------------------------------------------

jest.mock('@google-cloud/storage', () => {
  const mockSave = jest.fn()
  const mockDeleteFn = jest.fn()
  const mockDownload = jest.fn()
  const mockGetSignedUrl = jest.fn()
  const mockBucketExists = jest.fn()
  const mockBucketCreate = jest.fn()
  const mockSetCorsConfiguration = jest.fn()

  function makeFileMock() {
    return {
      save: mockSave,
      delete: mockDeleteFn,
      download: mockDownload,
      getSignedUrl: mockGetSignedUrl,
    }
  }

  function makeBucketMock(name: string) {
    return {
      name,
      exists: mockBucketExists,
      create: mockBucketCreate,
      setCorsConfiguration: mockSetCorsConfiguration,
      file: jest.fn(() => makeFileMock()),
    }
  }

  const storageInstance = {
    bucket: jest.fn((name: string) => makeBucketMock(name)),
  }

  const MockStorage = jest.fn(() => storageInstance)

  // Expose all stubs so tests can retrieve them via jest.requireMock()
  ;(MockStorage as unknown as Record<string, unknown>).__stubs = {
    storageInstance,
    mockSave,
    mockDeleteFn,
    mockDownload,
    mockGetSignedUrl,
    mockBucketExists,
    mockBucketCreate,
    mockSetCorsConfiguration,
  }

  return { Storage: MockStorage }
})

// ---------------------------------------------------------------------------
// Imports — after jest.mock() registration
// ---------------------------------------------------------------------------

import { GCSStorageProvider } from '@/lib/storage/providers/gcp-provider'
import { StorageService } from '@/lib/storage/storage-service'
import { LocalStorageProvider } from '@/lib/storage/providers/local-provider'

// ---------------------------------------------------------------------------
// Stubs accessor
// ---------------------------------------------------------------------------

interface GcsMockStubs {
  storageInstance: { bucket: jest.Mock }
  mockSave: jest.Mock
  mockDeleteFn: jest.Mock
  mockDownload: jest.Mock
  mockGetSignedUrl: jest.Mock
  mockBucketExists: jest.Mock
  mockBucketCreate: jest.Mock
  mockSetCorsConfiguration: jest.Mock
}

function getStubs(): GcsMockStubs {
  const { Storage } = jest.requireMock('@google-cloud/storage') as {
    Storage: jest.Mock & { __stubs: GcsMockStubs }
  }
  return Storage.__stubs
}

function resetGcsMocks(): void {
  const { Storage } = jest.requireMock('@google-cloud/storage') as {
    Storage: jest.Mock & { __stubs: GcsMockStubs }
  }
  Storage.mockClear()
  const s = Storage.__stubs
  s.storageInstance.bucket.mockClear()
  s.mockSave.mockReset()
  s.mockDeleteFn.mockReset()
  s.mockDownload.mockReset()
  s.mockGetSignedUrl.mockReset()
  s.mockBucketExists.mockReset()
  s.mockBucketCreate.mockReset()
  s.mockSetCorsConfiguration.mockReset()
}

const BASE_CONFIG = { bucketName: 'test-bucket' }

// ---------------------------------------------------------------------------
// Suite 1 — GCS Provider: Emulator Mode
// ---------------------------------------------------------------------------

describe('GCSStorageProvider — Emulator Mode', () => {
  const EMULATOR_HOST = 'http://localhost:4443'

  beforeEach(() => {
    resetGcsMocks()
    process.env.STORAGE_EMULATOR_HOST = EMULATOR_HOST
  })

  afterEach(() => {
    delete process.env.STORAGE_EMULATOR_HOST
  })

  it('should pass apiEndpoint to Storage constructor when STORAGE_EMULATOR_HOST is set', () => {
    const { Storage } = jest.requireMock('@google-cloud/storage') as { Storage: jest.Mock }

    new GCSStorageProvider(BASE_CONFIG)

    expect(Storage).toHaveBeenCalledWith(
      expect.objectContaining({ apiEndpoint: EMULATOR_HOST })
    )
  })

  it('should prepend http:// to apiEndpoint when STORAGE_EMULATOR_HOST has no scheme', () => {
    process.env.STORAGE_EMULATOR_HOST = 'localhost:4443'
    const { Storage } = jest.requireMock('@google-cloud/storage') as { Storage: jest.Mock }

    new GCSStorageProvider(BASE_CONFIG)

    expect(Storage).toHaveBeenCalledWith(
      expect.objectContaining({ apiEndpoint: 'http://localhost:4443' })
    )
  })

  it('should create bucket when ensureBucketExists() is called and bucket does not exist', async () => {
    const { mockBucketExists, mockBucketCreate } = getStubs()
    mockBucketExists.mockResolvedValue([false])
    mockBucketCreate.mockResolvedValue(undefined)

    const provider = new GCSStorageProvider(BASE_CONFIG)
    await provider.ensureBucketExists()

    expect(mockBucketExists).toHaveBeenCalledTimes(1)
    expect(mockBucketCreate).toHaveBeenCalledTimes(1)
  })

  it('should not call bucket.create() when ensureBucketExists() is called and bucket already exists', async () => {
    const { mockBucketExists, mockBucketCreate } = getStubs()
    mockBucketExists.mockResolvedValue([true])

    const provider = new GCSStorageProvider(BASE_CONFIG)
    await provider.ensureBucketExists()

    expect(mockBucketExists).toHaveBeenCalledTimes(1)
    expect(mockBucketCreate).not.toHaveBeenCalled()
  })

  it('should upload a Buffer and return a result with storagePath and empty publicUrl', async () => {
    const { mockSave } = getStubs()
    mockSave.mockResolvedValue(undefined)
    const content = Buffer.from('hello gcs')

    const provider = new GCSStorageProvider(BASE_CONFIG)
    const result = await provider.uploadFile(content, 'audio.mp3', 'audio/mpeg', { folder: 'voices' })

    expect(mockSave).toHaveBeenCalledTimes(1)
    expect(result.storagePath).toBe('voices/audio.mp3')
    expect(result.filename).toBe('audio.mp3')
    expect(result.sizeBytes).toBe(content.length)
    // GCS provider always returns empty publicUrl — signed URLs are used instead
    expect(result.publicUrl).toBe('')
    expect(typeof result.id).toBe('string')
  })

  it('should download a file and return its Buffer', async () => {
    const { mockDownload } = getStubs()
    const expected = Buffer.from('downloaded bytes')
    mockDownload.mockResolvedValue([expected])

    const provider = new GCSStorageProvider(BASE_CONFIG)
    const result = await provider.getFile('voices/audio.mp3')

    expect(mockDownload).toHaveBeenCalledTimes(1)
    expect(result).toEqual(expected)
  })

  it('should delete a file without throwing', async () => {
    const { mockDeleteFn } = getStubs()
    mockDeleteFn.mockResolvedValue(undefined)

    const provider = new GCSStorageProvider(BASE_CONFIG)
    await expect(provider.deleteFile('voices/audio.mp3')).resolves.toBeUndefined()
    expect(mockDeleteFn).toHaveBeenCalledTimes(1)
  })

  it('should return a direct emulator URL from getSignedUrl() without calling the GCS SDK', async () => {
    const { mockGetSignedUrl } = getStubs()

    const provider = new GCSStorageProvider(BASE_CONFIG)
    const url = await provider.getSignedUrl('voices/audio.mp3')

    // SDK signing must NOT be called — emulator returns a plain URL
    expect(mockGetSignedUrl).not.toHaveBeenCalled()
    expect(url).toBe(`${EMULATOR_HOST}/test-bucket/voices/audio.mp3`)
  })

  it('should propagate errors thrown by bucket.delete()', async () => {
    const { mockDeleteFn } = getStubs()
    mockDeleteFn.mockRejectedValue(new Error('GCS delete failure'))

    const provider = new GCSStorageProvider(BASE_CONFIG)
    await expect(provider.deleteFile('voices/audio.mp3')).rejects.toThrow('GCS delete failure')
  })
})

// ---------------------------------------------------------------------------
// Suite 2 — GCS Provider: Production Mode (no emulator)
// ---------------------------------------------------------------------------

describe('GCSStorageProvider — Production Mode', () => {
  beforeEach(() => {
    resetGcsMocks()
    delete process.env.STORAGE_EMULATOR_HOST
  })

  it('should NOT pass apiEndpoint to Storage constructor when STORAGE_EMULATOR_HOST is unset', () => {
    const { Storage } = jest.requireMock('@google-cloud/storage') as { Storage: jest.Mock }

    new GCSStorageProvider(BASE_CONFIG)

    const callArgs = Storage.mock.calls[0][0] as Record<string, unknown>
    expect(callArgs).not.toHaveProperty('apiEndpoint')
  })

  it('should be a no-op when ensureBucketExists() is called in production', async () => {
    const { mockBucketExists, mockBucketCreate } = getStubs()

    const provider = new GCSStorageProvider(BASE_CONFIG)
    await provider.ensureBucketExists()

    expect(mockBucketExists).not.toHaveBeenCalled()
    expect(mockBucketCreate).not.toHaveBeenCalled()
  })

  it('should call GCS SDK getSignedUrl() when STORAGE_EMULATOR_HOST is NOT set', async () => {
    const { mockGetSignedUrl } = getStubs()
    const fakeSignedUrl = 'https://storage.googleapis.com/test-bucket/file?X-Goog-Signature=abc'
    mockGetSignedUrl.mockResolvedValue([fakeSignedUrl])

    const provider = new GCSStorageProvider(BASE_CONFIG)
    const result = await provider.getSignedUrl('voices/audio.mp3', 900)

    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({ version: 'v4', action: 'read' })
    )
    expect(result).toBe(fakeSignedUrl)
  })

  it('should pass optional keyFilename and projectId to Storage constructor when provided', () => {
    const { Storage } = jest.requireMock('@google-cloud/storage') as { Storage: jest.Mock }

    new GCSStorageProvider({
      bucketName: 'my-bucket',
      keyFilename: '/path/to/key.json',
      projectId: 'my-project',
    })

    expect(Storage).toHaveBeenCalledWith(
      expect.objectContaining({
        keyFilename: '/path/to/key.json',
        projectId: 'my-project',
      })
    )
  })

  it('should throw when getPublicUrl() is called (public URLs are not supported)', async () => {
    const provider = new GCSStorageProvider(BASE_CONFIG)
    await expect(provider.getPublicUrl('any/path')).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Suite 3 — StorageService: Provider Selection
// ---------------------------------------------------------------------------

describe('StorageService — provider selection', () => {
  beforeEach(() => {
    resetGcsMocks()
  })

  it('should return a GCSStorageProvider when mode is "gcs"', () => {
    const service = new StorageService({
      mode: 'gcs',
      gcs: { bucketName: 'my-bucket' },
    })

    expect(service.getProvider()).toBeInstanceOf(GCSStorageProvider)
  })

  it('should return a GCSStorageProvider when mode is "gcp" (backward-compat alias)', () => {
    const service = new StorageService({
      mode: 'gcp',
      gcp: { bucketName: 'my-bucket' },
    })

    expect(service.getProvider()).toBeInstanceOf(GCSStorageProvider)
  })

  it('should return a LocalStorageProvider when mode is "local"', () => {
    const service = new StorageService({
      mode: 'local',
      local: { uploadDir: '/tmp/uploads', baseUrl: '/api/assets' },
    })

    expect(service.getProvider()).toBeInstanceOf(LocalStorageProvider)
  })

  it('should throw when mode is "gcs" but gcs config is missing', () => {
    expect(() => new StorageService({ mode: 'gcs' })).toThrow(
      'GCS storage configuration is required'
    )
  })

  it('should throw when mode is "local" but local config is missing', () => {
    expect(() => new StorageService({ mode: 'local' })).toThrow(
      'Local storage configuration is required'
    )
  })
})

// ---------------------------------------------------------------------------
// Suite 4 — initStorage()
// ---------------------------------------------------------------------------

describe('initStorage()', () => {
  afterEach(() => {
    delete process.env.STORAGE_EMULATOR_HOST
    delete process.env.STORAGE_MODE
    delete process.env.GCS_BUCKET_NAME
    jest.resetModules()
  })

  it('should call ensureBucketExists() when STORAGE_EMULATOR_HOST is set', async () => {
    process.env.STORAGE_EMULATOR_HOST = 'http://localhost:4443'
    process.env.STORAGE_MODE = 'gcs'
    process.env.GCS_BUCKET_NAME = 'test-bucket'

    // Reset module registry so getStorageService() singleton is re-created
    jest.resetModules()

    // Re-mock after resetModules so the fresh registry still has the mock
    jest.mock('@google-cloud/storage', () => {
      const mockExists = jest.fn().mockResolvedValue([true])
      const mockCreate = jest.fn()
      const makeBucket = (name: string) => ({
        name,
        exists: mockExists,
        create: mockCreate,
        file: jest.fn(),
        setCorsConfiguration: jest.fn(),
      })
      const inst = { bucket: jest.fn((n: string) => makeBucket(n)) }
      const Ctor = jest.fn(() => inst)
      ;(Ctor as unknown as Record<string, unknown>).__inst = inst
      return { Storage: Ctor }
    })

    const { initStorage: freshInit } = await import('@/lib/storage/init-storage')
    await freshInit()

    const { Storage } = jest.requireMock('@google-cloud/storage') as {
      Storage: jest.Mock & { __inst: { bucket: jest.Mock } }
    }
    // bucket() must have been called — confirming ensureBucketExists() ran
    expect(Storage.__inst.bucket).toHaveBeenCalled()
  })

  it('should do nothing when STORAGE_EMULATOR_HOST is NOT set', async () => {
    delete process.env.STORAGE_EMULATOR_HOST

    jest.resetModules()

    // Re-provide the mock for the fresh registry
    jest.mock('@google-cloud/storage', () => {
      const mockExists = jest.fn()
      const mockCreate = jest.fn()
      const makeBucket = (name: string) => ({
        name,
        exists: mockExists,
        create: mockCreate,
        file: jest.fn(),
        setCorsConfiguration: jest.fn(),
      })
      const inst = { bucket: jest.fn((n: string) => makeBucket(n)) }
      const Ctor = jest.fn(() => inst)
      ;(Ctor as unknown as Record<string, unknown>).__inst = inst
      return { Storage: Ctor }
    })

    const { initStorage: freshInit } = await import('@/lib/storage/init-storage')

    // Should resolve without error and without calling any GCS methods
    await expect(freshInit()).resolves.toBeUndefined()

    // Confirm the Storage constructor was never called (no GCS activity)
    const { Storage } = jest.requireMock('@google-cloud/storage') as {
      Storage: jest.Mock & { __inst: { bucket: jest.Mock } }
    }
    expect(Storage).not.toHaveBeenCalled()
  })
})
