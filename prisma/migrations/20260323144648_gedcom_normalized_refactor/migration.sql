/*
  Warnings:

  - A unique constraint covering the columns `[workspaceId,gedcomXref]` on the table `Person` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PersonNameType" AS ENUM ('BIRTH', 'MARRIED', 'AKA', 'RELIGIOUS', 'OTHER');

-- CreateEnum
CREATE TYPE "PersonEventType" AS ENUM ('BIRTH', 'BAPTISM', 'DEATH', 'BURIAL', 'CREMATION', 'MARRIAGE', 'DIVORCE', 'RESIDENCE', 'OCCUPATION', 'EDUCATION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ChildRelationshipType" AS ENUM ('BIOLOGICAL', 'ADOPTED', 'STEP', 'FOSTER', 'GUARDIAN');

-- CreateEnum
CREATE TYPE "ExternalRefSystem" AS ENUM ('GEDCOM', 'GRAMPS', 'ROOTSMAGIC', 'FAMILYSEARCH', 'ANCESTRY', 'MYHERITAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "GedcomSex" AS ENUM ('M', 'F', 'U', 'X');

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "gedcomXref" TEXT,
ADD COLUMN     "sex" "GedcomSex";

-- CreateTable
CREATE TABLE "PersonName" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "nameType" "PersonNameType" NOT NULL DEFAULT 'BIRTH',
    "givenName" TEXT NOT NULL,
    "surname" TEXT,
    "prefix" TEXT,
    "suffix" TEXT,
    "nickname" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "gedcomXref" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonName_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonEvent" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "eventType" "PersonEventType" NOT NULL,
    "eventDate" TIMESTAMP(3),
    "place" TEXT,
    "description" TEXT,
    "sourceCitation" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "gedcomXref" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyUnit" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "gedcomXref" TEXT,
    "husbandId" TEXT,
    "wifeId" TEXT,
    "marriageDate" TIMESTAMP(3),
    "marriagePlace" TEXT,
    "divorceDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyChild" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "relationshipType" "ChildRelationshipType" NOT NULL DEFAULT 'BIOLOGICAL',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyChild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonExternalRef" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "system" "ExternalRefSystem" NOT NULL,
    "externalId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonExternalRef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonName_personId_isPrimary_idx" ON "PersonName"("personId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "PersonName_personId_gedcomXref_key" ON "PersonName"("personId", "gedcomXref");

-- CreateIndex
CREATE INDEX "PersonEvent_personId_eventType_eventDate_idx" ON "PersonEvent"("personId", "eventType", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "PersonEvent_personId_gedcomXref_key" ON "PersonEvent"("personId", "gedcomXref");

-- CreateIndex
CREATE INDEX "FamilyUnit_workspaceId_idx" ON "FamilyUnit"("workspaceId");

-- CreateIndex
CREATE INDEX "FamilyUnit_husbandId_idx" ON "FamilyUnit"("husbandId");

-- CreateIndex
CREATE INDEX "FamilyUnit_wifeId_idx" ON "FamilyUnit"("wifeId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyUnit_workspaceId_gedcomXref_key" ON "FamilyUnit"("workspaceId", "gedcomXref");

-- CreateIndex
CREATE INDEX "FamilyChild_childId_idx" ON "FamilyChild"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyChild_familyId_childId_key" ON "FamilyChild"("familyId", "childId");

-- CreateIndex
CREATE INDEX "PersonExternalRef_personId_idx" ON "PersonExternalRef"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonExternalRef_personId_system_externalId_key" ON "PersonExternalRef"("personId", "system", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Person_workspaceId_gedcomXref_key" ON "Person"("workspaceId", "gedcomXref");

-- AddForeignKey
ALTER TABLE "PersonName" ADD CONSTRAINT "PersonName_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonEvent" ADD CONSTRAINT "PersonEvent_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyUnit" ADD CONSTRAINT "FamilyUnit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyUnit" ADD CONSTRAINT "FamilyUnit_husbandId_fkey" FOREIGN KEY ("husbandId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyUnit" ADD CONSTRAINT "FamilyUnit_wifeId_fkey" FOREIGN KEY ("wifeId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyChild" ADD CONSTRAINT "FamilyChild_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "FamilyUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyChild" ADD CONSTRAINT "FamilyChild_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonExternalRef" ADD CONSTRAINT "PersonExternalRef_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
