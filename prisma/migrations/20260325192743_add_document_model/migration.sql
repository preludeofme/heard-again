-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PDF', 'LETTER', 'PHOTO', 'HANDWRITTEN', 'CERTIFICATE', 'RECORDING', 'OTHER');

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "documentType" "DocumentType" NOT NULL DEFAULT 'OTHER',
    "dateOccurred" TIMESTAMP(3),
    "dateOccurredPrecision" "DatePrecision" NOT NULL DEFAULT 'EXACT',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "aiSummary" TEXT,
    "aiSuggestedPeople" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentPerson" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" TEXT,
    "aiSuggested" BOOLEAN NOT NULL DEFAULT false,
    "aiConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentPerson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Document_assetId_key" ON "Document"("assetId");

-- CreateIndex
CREATE INDEX "Document_workspaceId_idx" ON "Document"("workspaceId");

-- CreateIndex
CREATE INDEX "Document_documentType_idx" ON "Document"("documentType");

-- CreateIndex
CREATE INDEX "Document_isDeleted_idx" ON "Document"("isDeleted");

-- CreateIndex
CREATE INDEX "Document_dateOccurred_idx" ON "Document"("dateOccurred");

-- CreateIndex
CREATE INDEX "DocumentPerson_documentId_idx" ON "DocumentPerson"("documentId");

-- CreateIndex
CREATE INDEX "DocumentPerson_personId_idx" ON "DocumentPerson"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentPerson_documentId_personId_key" ON "DocumentPerson"("documentId", "personId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPerson" ADD CONSTRAINT "DocumentPerson_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPerson" ADD CONSTRAINT "DocumentPerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
