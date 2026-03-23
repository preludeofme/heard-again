-- AlterTable
ALTER TABLE "VoiceProfile" ADD COLUMN     "externalId" TEXT;

-- CreateIndex
CREATE INDEX "VoiceProfile_externalId_idx" ON "VoiceProfile"("externalId");
