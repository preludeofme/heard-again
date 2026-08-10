-- CreateEnum
CREATE TYPE "LegacySuccessorStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "LegacyClaimStatus" AS ENUM ('COOLING_OFF', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'DECEASED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "legacySuccessorId" TEXT,
ADD COLUMN     "legacySuccessorStatus" "LegacySuccessorStatus";

-- CreateTable
CREATE TABLE "LegacyClaim" (
    "id" TEXT NOT NULL,
    "deceasedUserId" TEXT NOT NULL,
    "claimantId" TEXT NOT NULL,
    "status" "LegacyClaimStatus" NOT NULL DEFAULT 'COOLING_OFF',
    "proofType" TEXT NOT NULL,
    "proofData" TEXT NOT NULL,
    "notes" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,

    CONSTRAINT "LegacyClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegacyClaim_deceasedUserId_idx" ON "LegacyClaim"("deceasedUserId");

-- CreateIndex
CREATE INDEX "LegacyClaim_claimantId_idx" ON "LegacyClaim"("claimantId");

-- CreateIndex
CREATE INDEX "LegacyClaim_status_idx" ON "LegacyClaim"("status");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_legacySuccessorId_fkey" FOREIGN KEY ("legacySuccessorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegacyClaim" ADD CONSTRAINT "LegacyClaim_deceasedUserId_fkey" FOREIGN KEY ("deceasedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegacyClaim" ADD CONSTRAINT "LegacyClaim_claimantId_fkey" FOREIGN KEY ("claimantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
