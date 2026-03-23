// Storage configuration module supporting local and cloud storage modes
import { S3Client } from '@aws-sdk/client-s3';

export type StorageMode = 'local' | 's3' | 'r2';

export interface StorageConfig {
  mode: StorageMode;
  local: {
    uploadDir: string;
    baseUrl: string;
  };
  s3?: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string; // For S3-compatible services like R2
    publicUrlBase?: string; // For generating public URLs
  };
}

function getStorageMode(): StorageMode {
  const mode = process.env.STORAGE_MODE || 'local';
  if (mode === 's3' || mode === 'r2' || mode === 'local') {
    return mode;
  }
  return 'local';
}

export const storageConfig: StorageConfig = {
  mode: getStorageMode(),
  local: {
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    baseUrl: process.env.UPLOAD_BASE_URL || '/api/assets',
  },
  s3: process.env.S3_BUCKET ? {
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION || 'us-east-1',
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
    endpoint: process.env.S3_ENDPOINT, // For R2 or other S3-compatible services
    publicUrlBase: process.env.S3_PUBLIC_URL_BASE,
  } : undefined,
};

// Initialize S3 client for cloud storage modes
export function getS3Client(): S3Client | null {
  if (storageConfig.mode === 'local' || !storageConfig.s3) {
    return null;
  }

  const { s3 } = storageConfig;
  
  return new S3Client({
    region: s3.region,
    credentials: {
      accessKeyId: s3.accessKeyId,
      secretAccessKey: s3.secretAccessKey,
    },
    ...(s3.endpoint && {
      endpoint: s3.endpoint,
      forcePathStyle: true,
    }),
  });
}

// Get public URL for an asset
export function getAssetPublicUrl(storagePath: string): string {
  if (storageConfig.mode === 'local') {
    return `${storageConfig.local.baseUrl}/${storagePath}`;
  }

  if (storageConfig.s3?.publicUrlBase) {
    return `${storageConfig.s3.publicUrlBase}/${storagePath}`;
  }

  // Default S3 URL format
  if (storageConfig.s3) {
    return `https://${storageConfig.s3.bucket}.s3.${storageConfig.s3.region}.amazonaws.com/${storagePath}`;
  }

  return storagePath;
}

// Check if storage is configured properly
export function isStorageConfigured(): boolean {
  if (storageConfig.mode === 'local') {
    return true; // Local storage always works
  }

  if (storageConfig.mode === 's3' || storageConfig.mode === 'r2') {
    return !!(
      storageConfig.s3?.bucket &&
      storageConfig.s3?.accessKeyId &&
      storageConfig.s3?.secretAccessKey
    );
  }

  return false;
}
