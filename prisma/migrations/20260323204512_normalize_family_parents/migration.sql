-- Normalize FamilyUnit parents: replace husbandId/wifeId with FamilyParent table
-- This enables flexible parent relationships (same-sex couples, poly families, etc.)

-- Create the FamilyParent table
CREATE TABLE "FamilyParent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL DEFAULT 'BIOLOGICAL',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyParent_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "FamilyUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FamilyParent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create unique constraint and indexes
CREATE UNIQUE INDEX "FamilyParent_familyId_parentId_key" ON "FamilyParent"("familyId", "parentId");
CREATE INDEX "FamilyParent_parentId_idx" ON "FamilyParent"("parentId");

-- Migrate existing data: husbandId -> FamilyParent with BIOLOGICAL type
INSERT INTO "FamilyParent" ("id", "familyId", "parentId", "relationshipType", "sortOrder", "createdAt")
SELECT 
    gen_random_uuid(),
    "id",
    "husbandId",
    'BIOLOGICAL',
    0,
    CURRENT_TIMESTAMP
FROM "FamilyUnit"
WHERE "husbandId" IS NOT NULL;

-- Migrate existing data: wifeId -> FamilyParent with BIOLOGICAL type
INSERT INTO "FamilyParent" ("id", "familyId", "parentId", "relationshipType", "sortOrder", "createdAt")
SELECT 
    gen_random_uuid(),
    "id",
    "wifeId",
    'BIOLOGICAL',
    1,
    CURRENT_TIMESTAMP
FROM "FamilyUnit"
WHERE "wifeId" IS NOT NULL;

-- Remove old husband/wife columns and indexes from FamilyUnit
DROP INDEX IF EXISTS "FamilyUnit_husbandId_idx";
DROP INDEX IF EXISTS "FamilyUnit_wifeId_idx";
ALTER TABLE "FamilyUnit" DROP COLUMN IF EXISTS "husbandId";
ALTER TABLE "FamilyUnit" DROP COLUMN IF EXISTS "wifeId";
