/**
 * @jest-environment node
 */
import { NextApiRequest, NextApiResponse } from 'next'
import uploadHandler, { config } from '@/pages/api/assets/upload'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { scanAndQuarantineFile } from '@/lib/security/malware-scanner'
import { getStorageService } from '@/lib/storage/storage-service'
import { prisma } from '@/lib/prisma'
import { validateFileContent } from '@/lib/security/file-validator'
import { getToken } from 'next-auth/jwt'
import formidable from 'formidable'
import fs from 'fs'
import crypto from 'crypto'

// Mock dependencies
jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
}))
jest.mock('@/lib/auth-helpers')
jest.mock('@/lib/security/malware-scanner')
jest.mock('@/lib/storage/storage-service')
jest.mock('@/lib/security/file-validator', () => ({
  ...jest.requireActual('@/lib/security/file-validator'),
  validateFileContent: jest.fn(),
}))
jest.mock('formidable')
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
  },
  readFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmSync: jest.fn(),
}))

const mockGetAuth = getAuthUserWithWorkspace as jest.MockedFunction<typeof getAuthUserWithWorkspace>
const mockRequireRole = requireWorkspaceRole as jest.MockedFunction<typeof requireWorkspaceRole>
const mockScan = scanAndQuarantineFile as jest.MockedFunction<typeof scanAndQuarantineFile>
const mockGetStorage = getStorageService as jest.MockedFunction<typeof getStorageService>
const mockValidateFile = validateFileContent as jest.MockedFunction<typeof validateFileContent>
const mockGetToken = getToken as jest.MockedFunction<typeof getToken>
const mockFormidable = formidable as unknown as jest.Mock

const SESSION_ID = 'session-id'
const USER_SUB = 'user-sub'

function deriveValidToken(): string {
  const secret = process.env.NEXTAUTH_SECRET || 'test-secret'
  return crypto
    .createHmac('sha256', secret)
    .update(`${USER_SUB}:${SESSION_ID}`)
    .digest('hex')
}

describe('Upload Integration — Upload → Malware Scan → Asset', () => {
  let req: NextApiRequest
  let res: NextApiResponse & { _status: number; _json: any }

  beforeEach(() => {
    jest.clearAllMocks()
    
    const csrfToken = deriveValidToken()
    req = {
      method: 'POST',
      url: '/api/assets/upload',
      headers: {
        'x-csrf-token': csrfToken,
      },
      body: {},
    } as any

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockImplementation((val) => {
        res._json = val
        return res
      }),
      setHeader: jest.fn().mockReturnThis(),
      _status: 0,
      _json: null,
    } as any
    Object.defineProperty(res, '_status', {
      get: () => (res.status as jest.Mock).mock.calls[0]?.[0],
    })

    // Default mock implementations
    mockGetToken.mockResolvedValue({ id: SESSION_ID, sub: USER_SUB })

    mockGetAuth.mockResolvedValue({
      id: 'user-1',
      workspaceId: 'ws-1',
      email: 'test@example.com',
      displayName: 'Test User',
    } as any)

    mockScan.mockResolvedValue({
      scanResult: { isClean: true, threats: [], scanTime: 0.1, engine: 'ClamAV' },
      quarantined: false,
    })

    const mockStorageService = {
      getMode: jest.fn().mockReturnValue('local'),
      uploadFile: jest.fn().mockResolvedValue({
        filename: 'secure-file.jpg',
        storagePath: 'ws-1/secure-file.jpg',
        sizeBytes: 1024,
        publicUrl: '/assets/serve/secure-file.jpg',
        assetType: 'IMAGE',
        processingStatus: 'COMPLETED',
      }),
    }
    mockGetStorage.mockReturnValue(mockStorageService as any)

    mockValidateFile.mockResolvedValue({
      isValid: true,
      detectedType: 'image/jpeg',
    });

    (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('fake-image-content'));

    mockFormidable.mockReturnValue({
      parse: jest.fn().mockResolvedValue([
        {}, // fields
        { file: [{ filepath: '/tmp/upload-123', originalFilename: 'test.jpg', mimetype: 'image/jpeg' }] }, // files
      ]),
    })
  })

  it('should successfully upload a clean file and create database records', async () => {
    // Mock prisma
    (prisma.asset.create as jest.Mock).mockResolvedValue({ 
      id: 'asset-1', 
      filename: 'secure-file.jpg',
      originalName: 'test.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: BigInt(1024),
      assetType: 'IMAGE',
      processingStatus: 'COMPLETED',
      storageType: 'LOCAL',
      createdAt: new Date()
    });
    (prisma.document.create as jest.Mock).mockResolvedValue({ id: 'doc-1' })

    await uploadHandler(req, res)

    // Verify malware scan was called
    expect(mockScan).toHaveBeenCalledWith('/tmp/upload-123')

    // Verify storage service was called
    const storageService = mockGetStorage()
    expect(storageService.uploadFile).toHaveBeenCalled()

    // Verify database records were created
    expect(prisma.asset.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workspaceId: 'ws-1',
        filename: 'secure-file.jpg',
      })
    }))
    expect(prisma.document.create).toHaveBeenCalled()

    // Verify response
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res._json.success).toBe(true)
    expect(res._json.data.id).toBe('asset-1')
  })

  it('should reject a file if malware is detected', async () => {
    mockScan.mockResolvedValueOnce({
      scanResult: { isClean: false, threats: ['Eicar-Test-Signature'], scanTime: 0.1, engine: 'ClamAV' },
      quarantined: true,
    })

    await uploadHandler(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res._json.success).toBe(false)
    expect(res._json.error).toContain('Malware detected')
    
    // Storage should NOT be called
    const storageService = mockGetStorage()
    expect(storageService.uploadFile).not.toHaveBeenCalled()
  })

  it('should reject a file if validation fails', async () => {
    mockValidateFile.mockResolvedValueOnce({
      isValid: false,
      error: 'Magic bytes mismatch',
      securityRisk: 'high',
    })

    await uploadHandler(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res._json.error).toBe('Magic bytes mismatch')
  })
})
