-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "slug" TEXT,
ADD COLUMN     "stripePriceIdMonthly" TEXT,
ADD COLUMN     "stripePriceIdYearly" TEXT,
ADD COLUMN     "stripeProductId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeLatestPaymentIntentId" TEXT,
ALTER COLUMN "generationMinutesUsed" SET DEFAULT 0,
ALTER COLUMN "generationMinutesUsed" SET DATA TYPE DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "familyspaceId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "reason" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "stripeRefundId" TEXT,
    "stripePaymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Refund_stripeRefundId_key" ON "Refund"("stripeRefundId");

-- CreateIndex
CREATE INDEX "Refund_subscriptionId_idx" ON "Refund"("subscriptionId");

-- CreateIndex
CREATE INDEX "Refund_familyspaceId_idx" ON "Refund"("familyspaceId");

-- CreateIndex
CREATE INDEX "Refund_stripeRefundId_idx" ON "Refund"("stripeRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_slug_key" ON "Plan"("slug");

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

