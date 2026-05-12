/*
  Warnings:

  - A unique constraint covering the columns `[shareToken]` on the table `Story` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[linkedPersonId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[familyspaceId,personId,voiceProfileId,consentType]` on the table `VoiceConsent` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `familyspaceId` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `familyspaceId` to the `StoryComment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PersonNoteType" AS ENUM ('GENERAL', 'RESEARCH', 'OBITUARY', 'SOURCE', 'OTHER');

-- CreateEnum
CREATE TYPE "TranscriptionStatus" AS ENUM ('NONE', 'PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ChatSessionStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "IngestionJobType" AS ENUM ('DOCUMENT_PROCESSING', 'TEXT_EXTRACTION', 'CHUNKING', 'EMBEDDING_GENERATION', 'INDEXING');

-- CreateEnum
CREATE TYPE "IngestionJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'RETRYING');

-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "EmbeddingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'AUDIO';
ALTER TYPE "DocumentType" ADD VALUE 'VIDEO';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PersonEventType" ADD VALUE 'MILITARY_SERVICE';
ALTER TYPE "PersonEventType" ADD VALUE 'NATURALIZATION';
ALTER TYPE "PersonEventType" ADD VALUE 'IMMIGRATION';
ALTER TYPE "PersonEventType" ADD VALUE 'EMIGRATION';
ALTER TYPE "PersonEventType" ADD VALUE 'CENSUS';
ALTER TYPE "PersonEventType" ADD VALUE 'RETIREMENT';
ALTER TYPE "PersonEventType" ADD VALUE 'WILL';
ALTER TYPE "PersonEventType" ADD VALUE 'TITLE';
ALTER TYPE "PersonEventType" ADD VALUE 'PHYSICAL_DESCRIPTION';
ALTER TYPE "PersonEventType" ADD VALUE 'MEDICAL';
ALTER TYPE "PersonEventType" ADD VALUE 'ADOPTION';

-- AlterEnum
ALTER TYPE "StoryType" ADD VALUE 'RECORDING';

-- DropForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "Story" DROP CONSTRAINT "Story_createdById_fkey";

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "isAISynthesized" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "uploadedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "content" TEXT,
ADD COLUMN     "embeddingStatus" "EmbeddingStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "source" TEXT DEFAULT 'upload';

-- AlterTable
ALTER TABLE "Familyspace" ADD COLUMN     "avatarAssetId" TEXT,
ADD COLUMN     "bio" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "familyspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "causeOfDeath" TEXT;

-- AlterTable
ALTER TABLE "PersonEvent" ADD COLUMN     "customType" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "rawDate" TEXT;

-- AlterTable
ALTER TABLE "PersonaProfile" ADD COLUMN     "customInstructions" JSONB,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "writingStyle" JSONB;

-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "authorRelationship" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shareToken" TEXT,
ADD COLUMN     "transcript" TEXT,
ADD COLUMN     "transcriptionStatus" "TranscriptionStatus" NOT NULL DEFAULT 'NONE',
ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "StoryComment" ADD COLUMN     "familyspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "linkedPersonId" TEXT;

-- AlterTable
ALTER TABLE "VoiceConsent" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "VoiceProfile" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PersonNote" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "noteType" "PersonNoteType" NOT NULL DEFAULT 'GENERAL',
    "content" TEXT NOT NULL,
    "gedcomXref" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonSourceCitation" (
    "id" TEXT NOT NULL,
    "personId" TEXT,
    "eventId" TEXT,
    "gedcomSRef" TEXT,
    "page" TEXT,
    "text" TEXT,
    "sourceTitle" TEXT,
    "sourceAuthor" TEXT,
    "sourceDate" TEXT,
    "gedcomXref" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonSourceCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "familyspaceId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "status" "ChatSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "embedding" DOUBLE PRECISION[],
    "embeddingModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionJob" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "familyspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "IngestionJobType" NOT NULL,
    "status" "IngestionJobStatus" NOT NULL DEFAULT 'QUEUED',
    "priority" "JobPriority" NOT NULL DEFAULT 'NORMAL',
    "progress" JSONB NOT NULL DEFAULT '{}',
    "config" JSONB NOT NULL DEFAULT '{}',
    "error" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonNote_personId_idx" ON "PersonNote"("personId");

-- CreateIndex
CREATE INDEX "PersonNote_noteType_idx" ON "PersonNote"("noteType");

-- CreateIndex
CREATE UNIQUE INDEX "PersonNote_personId_gedcomXref_key" ON "PersonNote"("personId", "gedcomXref");

-- CreateIndex
CREATE INDEX "PersonSourceCitation_personId_idx" ON "PersonSourceCitation"("personId");

-- CreateIndex
CREATE INDEX "PersonSourceCitation_eventId_idx" ON "PersonSourceCitation"("eventId");

-- CreateIndex
CREATE INDEX "PersonSourceCitation_gedcomSRef_idx" ON "PersonSourceCitation"("gedcomSRef");

-- CreateIndex
CREATE INDEX "ChatSession_familyspaceId_idx" ON "ChatSession"("familyspaceId");

-- CreateIndex
CREATE INDEX "ChatSession_personId_idx" ON "ChatSession"("personId");

-- CreateIndex
CREATE INDEX "ChatSession_userId_idx" ON "ChatSession"("userId");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentChunk_documentId_chunkIndex_key" ON "DocumentChunk"("documentId", "chunkIndex");

-- CreateIndex
CREATE INDEX "IngestionJob_familyspaceId_idx" ON "IngestionJob"("familyspaceId");

-- CreateIndex
CREATE INDEX "IngestionJob_documentId_idx" ON "IngestionJob"("documentId");

-- CreateIndex
CREATE INDEX "Notification_familyspaceId_idx" ON "Notification"("familyspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Story_shareToken_key" ON "Story"("shareToken");

-- CreateIndex
CREATE INDEX "StoryComment_familyspaceId_idx" ON "StoryComment"("familyspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "User_linkedPersonId_key" ON "User"("linkedPersonId");

-- CreateIndex
CREATE INDEX "User_linkedPersonId_idx" ON "User"("linkedPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceConsent_familyspaceId_personId_voiceProfileId_consentT_key" ON "VoiceConsent"("familyspaceId", "personId", "voiceProfileId", "consentType");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_linkedPersonId_fkey" FOREIGN KEY ("linkedPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Familyspace" ADD CONSTRAINT "Familyspace_avatarAssetId_fkey" FOREIGN KEY ("avatarAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonNote" ADD CONSTRAINT "PersonNote_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonSourceCitation" ADD CONSTRAINT "PersonSourceCitation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonSourceCitation" ADD CONSTRAINT "PersonSourceCitation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PersonEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryComment" ADD CONSTRAINT "StoryComment_familyspaceId_fkey" FOREIGN KEY ("familyspaceId") REFERENCES "Familyspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_familyspaceId_fkey" FOREIGN KEY ("familyspaceId") REFERENCES "Familyspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_familyspaceId_fkey" FOREIGN KEY ("familyspaceId") REFERENCES "Familyspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
