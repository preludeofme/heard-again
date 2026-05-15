-- AlterTable
ALTER TABLE "StoryComment" ADD COLUMN "personId" TEXT;

-- AddForeignKey
ALTER TABLE "StoryComment" ADD CONSTRAINT "StoryComment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
