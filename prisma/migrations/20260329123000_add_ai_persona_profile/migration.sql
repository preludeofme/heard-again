-- Create AiPersonaProfile table
CREATE TABLE "AiPersonaProfile" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "systemPrompt" TEXT,
    "responseGuidelines" TEXT[],
    "writingStyle" JSONB,
    "knownFacts" JSONB,
    "relationships" JSONB,
    "customInstructions" JSONB,
    "temperature" DOUBLE PRECISION DEFAULT 0.7,
    "topP" DOUBLE PRECISION DEFAULT 0.9,
    "maxTokens" INTEGER DEFAULT 500,
    "documentSampleCount" INTEGER NOT NULL DEFAULT 0,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "preferredModel" TEXT,
    "lastTrainedAt" TIMESTAMP(3),
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiPersonaProfile_pkey" PRIMARY KEY ("id")
);

-- Create unique index on personId
CREATE UNIQUE INDEX "AiPersonaProfile_personId_key" ON "AiPersonaProfile"("personId");

-- Create indexes
CREATE INDEX "AiPersonaProfile_personId_idx" ON "AiPersonaProfile"("personId");
CREATE INDEX "AiPersonaProfile_workspaceId_idx" ON "AiPersonaProfile"("workspaceId");
CREATE INDEX "AiPersonaProfile_status_idx" ON "AiPersonaProfile"("status");

-- Add foreign key constraint
ALTER TABLE "AiPersonaProfile" ADD CONSTRAINT "AiPersonaProfile_personId_fkey" 
    FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
