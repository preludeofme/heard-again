-- CreateEnum
CREATE TYPE "MergeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CONFLICT', 'MERGED', 'FAILED');

-- CreateTable
CREATE TABLE "FamilyMergeProposal" (
    "id" TEXT NOT NULL,
    "targetWorkspaceId" TEXT NOT NULL,
    "sourceWorkspaceId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "status" "MergeStatus" NOT NULL DEFAULT 'PENDING',
    "overallMatchScore" DOUBLE PRECISION,
    "matchedPeopleCount" INTEGER NOT NULL DEFAULT 0,
    "totalSourcePeople" INTEGER NOT NULL DEFAULT 0,
    "conflictDetails" JSONB,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "executedAt" TIMESTAMP(3),
    "executedById" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyMergeProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMergePersonMatch" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "targetPersonId" TEXT NOT NULL,
    "sourcePersonId" TEXT NOT NULL,
    "matchScore" DOUBLE PRECISION NOT NULL,
    "matchReason" TEXT NOT NULL,
    "isIncluded" BOOLEAN NOT NULL DEFAULT true,
    "userOverride" BOOLEAN NOT NULL DEFAULT false,
    "status" "MergeStatus" NOT NULL DEFAULT 'PENDING',
    "mergedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyMergePersonMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FamilyMergeProposal_targetWorkspaceId_idx" ON "FamilyMergeProposal"("targetWorkspaceId");

-- CreateIndex
CREATE INDEX "FamilyMergeProposal_sourceWorkspaceId_idx" ON "FamilyMergeProposal"("sourceWorkspaceId");

-- CreateIndex
CREATE INDEX "FamilyMergeProposal_status_idx" ON "FamilyMergeProposal"("status");

-- CreateIndex
CREATE INDEX "FamilyMergeProposal_proposedById_idx" ON "FamilyMergeProposal"("proposedById");

-- CreateIndex
CREATE INDEX "FamilyMergePersonMatch_proposalId_idx" ON "FamilyMergePersonMatch"("proposalId");

-- CreateIndex
CREATE INDEX "FamilyMergePersonMatch_targetPersonId_idx" ON "FamilyMergePersonMatch"("targetPersonId");

-- CreateIndex
CREATE INDEX "FamilyMergePersonMatch_sourcePersonId_idx" ON "FamilyMergePersonMatch"("sourcePersonId");

-- CreateIndex
CREATE INDEX "FamilyMergePersonMatch_status_idx" ON "FamilyMergePersonMatch"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMergePersonMatch_proposalId_targetPersonId_sourcePers_key" ON "FamilyMergePersonMatch"("proposalId", "targetPersonId", "sourcePersonId");

-- AddForeignKey
ALTER TABLE "FamilyMergeProposal" ADD CONSTRAINT "FamilyMergeProposal_targetWorkspaceId_fkey" FOREIGN KEY ("targetWorkspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMergeProposal" ADD CONSTRAINT "FamilyMergeProposal_sourceWorkspaceId_fkey" FOREIGN KEY ("sourceWorkspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMergeProposal" ADD CONSTRAINT "FamilyMergeProposal_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMergePersonMatch" ADD CONSTRAINT "FamilyMergePersonMatch_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "FamilyMergeProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMergePersonMatch" ADD CONSTRAINT "FamilyMergePersonMatch_targetPersonId_fkey" FOREIGN KEY ("targetPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMergePersonMatch" ADD CONSTRAINT "FamilyMergePersonMatch_sourcePersonId_fkey" FOREIGN KEY ("sourcePersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
