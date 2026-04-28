# File Upload System Setup

This document explains how to configure and use the file upload system that supports both local development and cloud storage (GCP, S3, R2).

## Overview

The file upload system uses a provider pattern that allows you to switch between different storage backends based on your environment:

- **Local Storage**: For development and testing
- **Google Cloud Storage**: For production GCP deployments
- **S3/R2**: For AWS S3 or Cloudflare R2 deployments

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Storage Configuration
STORAGE_MODE="local"  # Options: local, gcp, s3, r2
UPLOAD_DIR="./uploads"
UPLOAD_BASE_URL="/api/assets"
```

### Local Development Setup

For local development, the system uses the filesystem:

```bash
# .env
STORAGE_MODE="local"
UPLOAD_DIR="./uploads"
UPLOAD_BASE_URL="/api/assets"
```

**No additional setup required** - files are stored locally in the `uploads` directory.

### Google Cloud Storage Setup

1. **Create a GCS Bucket**:
   ```bash
   gsutil mb gs://your-bucket-name
   ```

2. **Set up Service Account**:
   ```bash
   # Create service account
   gcloud iam service-accounts create file-upload-service
   
   # Grant storage admin role
   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member="serviceAccount:file-upload-service@PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/storage.admin"
   
   # Create and download key
   gcloud iam service-accounts keys create ~/gcp-key.json \
     --iam-account=file-upload-service@PROJECT_ID.iam.gserviceaccount.com
   ```

3. **Configure Environment**:
   ```bash
   # .env
   STORAGE_MODE="gcp"
   GCP_BUCKET_NAME="your-bucket-name"
   GCP_PROJECT_ID="your-project-id"
   GCP_KEY_FILENAME="./gcp-key.json"  # Optional in production
   ```

4. **Install Dependencies**:
   ```bash
   npm install @google-cloud/storage
   ```

### S3/R2 Setup

1. **Configure Environment**:
   ```bash
   # .env (for AWS S3)
   STORAGE_MODE="s3"
   S3_BUCKET="your-bucket-name"
   S3_REGION="us-east-1"
   S3_ACCESS_KEY="your-access-key"
   S3_SECRET_KEY="your-secret-key"
   
   # .env (for Cloudflare R2)
   STORAGE_MODE="r2"
   S3_BUCKET="your-r2-bucket"
   S3_REGION="auto"
   S3_ACCESS_KEY="your-r2-access-key"
   S3_SECRET_KEY="your-r2-secret-key"
   S3_ENDPOINT="https://your-account-id.r2.cloudflarestorage.com"
   S3_PUBLIC_URL_BASE="https://your-custom-domain.com"
   ```

2. **Install Dependencies**:
   ```bash
   npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
   ```

## Usage

### Uploading Files

The upload API accepts files via multipart form data:

```javascript
const formData = new FormData()
formData.append('file', file)

const response = await fetch('/api/assets/upload', {
  method: 'POST',
  body: formData,
  headers: {
    'Authorization': `Bearer ${token}`
  }
})

const result = await response.json()
console.log(result.publicUrl) // URL to access the uploaded file
```

### Storage Service API

You can also use the storage service directly:

```typescript
import { getStorageService } from '@/lib/storage/storage-service'

const storageService = getStorageService()

// Upload file
const result = await storageService.uploadFile(
  fileBuffer,
  'original-filename.jpg',
  'image/jpeg',
  {
    folder: 'user-uploads',
    metadata: { userId: '123' }
  }
)

// Get public URL
const publicUrl = await storageService.getPublicUrl(result.storagePath)

// Delete file
await storageService.deleteFile(result.storagePath)
```

## File Organization

Files are organized by familyspace:

```
uploads/
├── familyspace-123/
│   ├── image-1234567890-abc123.jpg
│   ├── document-1234567891-def456.pdf
│   └── audio-1234567892-ghi789.mp3
└── familyspace-456/
    └── video-1234567893-jkl012.mp4
```

## Supported File Types

- **Images**: jpg, jpeg, png, gif, webp, svg
- **Documents**: pdf, doc, docx, txt, rtf
- **Audio**: mp3, wav, m4a, ogg, flac
- **Video**: mp4, avi, mov, wmv, webm

## Security Considerations

1. **File Size Limits**: Default 100MB per file
2. **File Type Validation**: Server-side MIME type checking
3. **Access Control**: Familyspace-based permissions
4. **Private Storage**: Configure bucket permissions appropriately

## Production Deployment

### GCP Production Setup

1. **Use Application Default Credentials**:
   ```bash
   # In production, don't use key files
   unset GCP_KEY_FILENAME
   
   # Ensure the service account has the right permissions
   gcloud auth activate-service-account --key-file=key.json
   ```

2. **Configure CORS**:
   ```bash
   gsutil cors set cors.json gs://your-bucket-name
   ```

3. **Set up CDN** (optional):
   ```bash
   # Use Cloud CDN for better performance
   gcloud compute backend-buckets create my-bucket \
     --gcs-bucket-name=your-bucket-name \
     --enable-cdn
   ```

### S3/R2 Production Setup

1. **Configure Bucket Policy**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::your-bucket/*"
       }
     ]
   }
   ```

2. **Set up CloudFront** (for S3):
   ```bash
   # Create CloudFront distribution for better performance
   aws cloudfront create-distribution --distribution-config file://config.json
   ```

## Troubleshooting

### Common Issues

1. **Permission Denied**:
   - Check service account permissions
   - Verify bucket CORS configuration

2. **File Not Found**:
   - Ensure file was uploaded successfully
   - Check storage path and URL construction

3. **Large File Uploads**:
   - Increase `maxFileSize` in formidable config
   - Check provider limits (GCP: 5GB, S3: 5GB)

4. **Environment Variables**:
   - Verify all required variables are set
   - Check for typos in variable names

### Debug Mode

Enable debug logging:

```bash
DEBUG=storage:* npm run dev
```

## Migration Between Providers

To switch storage providers:

1. **Update Environment Variables**
2. **Install Required Dependencies**
3. **Migrate Existing Files** (if needed)
4. **Test Upload/Download Functionality**

The storage service abstracts provider differences, so your application code remains the same.
