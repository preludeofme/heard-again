-- New columns on Familyspace for admin settings
ALTER TABLE "Familyspace" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Familyspace" ADD COLUMN "allowMemberStories" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Familyspace" ADD COLUMN "deletionVotes" JSONB DEFAULT '{}';
