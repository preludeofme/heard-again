-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mfaMethod" TEXT,
ADD COLUMN     "mfaEmailCode" TEXT,
ADD COLUMN     "mfaEmailCodeExpires" TIMESTAMP(3);
