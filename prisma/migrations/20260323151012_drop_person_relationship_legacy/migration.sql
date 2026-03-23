/*
  Warnings:

  - You are about to drop the `PersonRelationship` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PersonRelationship" DROP CONSTRAINT "PersonRelationship_sourcePersonId_fkey";

-- DropForeignKey
ALTER TABLE "PersonRelationship" DROP CONSTRAINT "PersonRelationship_targetPersonId_fkey";

-- DropTable
DROP TABLE "PersonRelationship";

-- DropEnum
DROP TYPE "RelationshipType";
