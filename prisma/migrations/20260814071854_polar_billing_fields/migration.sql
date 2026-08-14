-- Add Polar customer state to users.
ALTER TABLE "users" ADD COLUMN "polarCustomerId" TEXT;

-- Add Polar subscription state to app subscriptions.
ALTER TABLE "subscriptions" ADD COLUMN "polarCustomerId" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "polarSubscriptionId" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "polarProductId" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "interval" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

-- Indexes used by webhook processing and app lookups.
CREATE UNIQUE INDEX "users_polarCustomerId_key" ON "users"("polarCustomerId");
CREATE UNIQUE INDEX "subscriptions_polarSubscriptionId_key" ON "subscriptions"("polarSubscriptionId");
CREATE INDEX "subscriptions_polarCustomerId_idx" ON "subscriptions"("polarCustomerId");
CREATE INDEX "subscriptions_polarProductId_idx" ON "subscriptions"("polarProductId");
