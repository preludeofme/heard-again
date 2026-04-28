-- CreateTable
CREATE TABLE "PersonaProfile" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "familyspaceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "vocabulary" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sentencePatterns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tone" JSONB,
    "formality" TEXT NOT NULL DEFAULT 'neutral',
    "averageSentenceLength" DOUBLE PRECISION NOT NULL DEFAULT 15.0,
    "commonPhrases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emotionIndicators" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "knownFacts" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "relationships" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "responseGuidelines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relationshipInstructions" JSONB NOT NULL DEFAULT '{}',
    "behaviorInstructions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topicInstructions" JSONB NOT NULL DEFAULT '{}',
    "contextInstructions" JSONB NOT NULL DEFAULT '{}',
    "styleOverrides" JSONB NOT NULL DEFAULT '{}',
    "documentSampleCount" INTEGER NOT NULL DEFAULT 0,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonaProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonaProfile_personId_idx" ON "PersonaProfile"("personId");

-- CreateIndex
CREATE INDEX "PersonaProfile_familyspaceId_idx" ON "PersonaProfile"("familyspaceId");

-- CreateIndex
CREATE INDEX "PersonaProfile_status_idx" ON "PersonaProfile"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PersonaProfile_personId_familyspaceId_version_key" ON "PersonaProfile"("personId", "familyspaceId", "version");

-- AddForeignKey
ALTER TABLE "PersonaProfile" ADD CONSTRAINT "PersonaProfile_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonaProfile" ADD CONSTRAINT "PersonaProfile_familyspaceId_fkey" FOREIGN KEY ("familyspaceId") REFERENCES "Familyspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
