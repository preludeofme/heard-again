/*
  Warnings:

  - You are about to drop the `AiPersonaProfile` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "NarrationStatus" AS ENUM ('NONE', 'PENDING', 'READY', 'APPROVED', 'STALE', 'FAILED');

-- DropForeignKey
ALTER TABLE "AiPersonaProfile" DROP CONSTRAINT "AiPersonaProfile_personId_fkey";

-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "narratedContent" TEXT,
ADD COLUMN     "narrationApprovedAt" TIMESTAMP(3),
ADD COLUMN     "narrationApprovedById" TEXT,
ADD COLUMN     "narrationModel" TEXT,
ADD COLUMN     "narrationStatus" "NarrationStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "narrationUpdatedAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "AiPersonaProfile";

-- CreateIndex
CREATE INDEX "Story_narrationStatus_idx" ON "Story"("narrationStatus");

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_narrationApprovedById_fkey" FOREIGN KEY ("narrationApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
