-- Align FamilyParent.relationshipType with Prisma enum ParentRelationshipType
-- Fixes runtime insert failures like: type "public.ParentRelationshipType" does not exist

DO $$
BEGIN
  CREATE TYPE "ParentRelationshipType" AS ENUM (
    'BIOLOGICAL',
    'ADOPTIVE',
    'STEP',
    'FOSTER',
    'GUARDIAN',
    'PARTNER',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "FamilyParent"
  ALTER COLUMN "relationshipType" DROP DEFAULT;

ALTER TABLE "FamilyParent"
  ALTER COLUMN "relationshipType" TYPE "ParentRelationshipType"
  USING (
    CASE "relationshipType"
      WHEN 'BIOLOGICAL' THEN 'BIOLOGICAL'::"ParentRelationshipType"
      WHEN 'ADOPTIVE' THEN 'ADOPTIVE'::"ParentRelationshipType"
      WHEN 'ADOPTED' THEN 'ADOPTIVE'::"ParentRelationshipType"
      WHEN 'STEP' THEN 'STEP'::"ParentRelationshipType"
      WHEN 'FOSTER' THEN 'FOSTER'::"ParentRelationshipType"
      WHEN 'GUARDIAN' THEN 'GUARDIAN'::"ParentRelationshipType"
      WHEN 'PARTNER' THEN 'PARTNER'::"ParentRelationshipType"
      ELSE 'OTHER'::"ParentRelationshipType"
    END
  );

ALTER TABLE "FamilyParent"
  ALTER COLUMN "relationshipType" SET DEFAULT 'BIOLOGICAL';
