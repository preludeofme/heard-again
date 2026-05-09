/**
 * Document/Asset Mapper
 * Finding 5.6: Create Data Mappers - Eliminates duplicated mapping logic
 */

import type { DocumentArtifact } from '@/types'
import type { AssetListItem } from '@/contracts'

export interface AssetResponse {
  id: string
  filename: string
  originalName?: string
  mimeType?: string
  documentType?: string
  createdAt: string | Date
}

/**
 * Determine document type from MIME type
 */
export function getDocumentTypeFromMimeType(mimeType: string): DocumentArtifact['type'] {
  if (mimeType.includes('pdf')) return 'PDF'
  if (mimeType.includes('image')) return 'Photo'
  if (mimeType.includes('audio')) return 'Audio'
  if (mimeType.includes('video')) return 'Video'
  return 'Letter'
}

/**
 * Map API asset response to component DocumentArtifact format
 */
export function toDocumentArtifact(asset: AssetResponse): DocumentArtifact {
  const mimeType = asset.mimeType || 'application/octet-stream'
  
  // Map internal enum names to UI labels
  const typeMap: Record<string, DocumentArtifact['type']> = {
    'PHOTO': 'Photo',
    'LETTER': 'Letter',
    'HANDWRITTEN': 'Handwritten',
    'PDF': 'PDF',
    'AUDIO': 'Audio',
    'VIDEO': 'Video',
    'RECORDING': 'Audio'
  }

  const type = asset.documentType ? (typeMap[asset.documentType] || 'Letter') : getDocumentTypeFromMimeType(mimeType)

  return {
    id: asset.id,
    title: asset.originalName || asset.filename,
    type,
    mimeType,
    uploadedAt: typeof asset.createdAt === 'string' ? new Date(asset.createdAt) : asset.createdAt,
    shareAction: 'Share',
  }
}

/**
 * Map array of API asset responses to DocumentArtifact array
 */
export function toDocumentArtifactArray(assets: AssetResponse[]): DocumentArtifact[] {
  return assets.map(toDocumentArtifact)
}

/**
 * Map Prisma Asset to list item format
 */
export function toAssetListItem(asset: {
  id: string
  filename: string
  originalName: string
  mimeType: string
  sizeBytes: bigint
  assetType: string
  processingStatus: string
  storagePath: string | null
  durationSeconds: number | null
  metadata: Record<string, unknown> | null
  createdAt: Date
}): AssetListItem {
  return {
    id: asset.id,
    filename: asset.filename,
    originalName: asset.originalName,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    assetType: asset.assetType as AssetListItem['assetType'],
    processingStatus: asset.processingStatus as AssetListItem['processingStatus'],
    storagePath: asset.storagePath,
    durationSeconds: asset.durationSeconds,
    metadata: asset.metadata,
    createdAt: asset.createdAt,
  }
}
