-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mfaBackupCodes" TEXT,
ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaSecret" TEXT;
