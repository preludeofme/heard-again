-- DropIndex
DROP INDEX IF EXISTS "Asset_metadata_gin";

-- AlterTable
ALTER TABLE "ImportJob" ADD COLUMN IF NOT EXISTS "triggerRunId" TEXT;

-- AlterTable
ALTER TABLE "VoiceProfile" ADD COLUMN IF NOT EXISTS "sampleAudioUrl" TEXT;
