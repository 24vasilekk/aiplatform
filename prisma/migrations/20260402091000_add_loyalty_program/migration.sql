DO $$ BEGIN
  CREATE TYPE "LoyaltyDirection" AS ENUM ('CREDIT', 'DEBIT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LoyaltyReason" AS ENUM (
    'COURSE_COMPLETION',
    'DISCOUNT_REDEEM',
    'DISCOUNT_ROLLBACK',
    'EXPIRATION',
    'MANUAL_ADJUSTMENT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "LoyaltyAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "pointsBalance" INTEGER NOT NULL DEFAULT 0,
  "lifetimeEarnedPoints" INTEGER NOT NULL DEFAULT 0,
  "lifetimeRedeemedPoints" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoyaltyAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyAccount_userId_key"
  ON "LoyaltyAccount"("userId");

DO $$ BEGIN
  ALTER TABLE "LoyaltyAccount"
    ADD CONSTRAINT "LoyaltyAccount_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "LoyaltyTransaction" (
  "id" TEXT NOT NULL,
  "loyaltyAccountId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "direction" "LoyaltyDirection" NOT NULL,
  "reason" "LoyaltyReason" NOT NULL,
  "points" INTEGER NOT NULL,
  "balanceBefore" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "courseId" TEXT,
  "paymentIntentId" TEXT,
  "idempotencyKey" TEXT,
  "metadata" JSONB,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyTransaction_userId_idempotencyKey_key"
  ON "LoyaltyTransaction"("userId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "LoyaltyTransaction_userId_createdAt_idx"
  ON "LoyaltyTransaction"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "LoyaltyTransaction_userId_reason_createdAt_idx"
  ON "LoyaltyTransaction"("userId", "reason", "createdAt");
CREATE INDEX IF NOT EXISTS "LoyaltyTransaction_loyaltyAccountId_createdAt_idx"
  ON "LoyaltyTransaction"("loyaltyAccountId", "createdAt");
CREATE INDEX IF NOT EXISTS "LoyaltyTransaction_courseId_idx"
  ON "LoyaltyTransaction"("courseId");
CREATE INDEX IF NOT EXISTS "LoyaltyTransaction_paymentIntentId_idx"
  ON "LoyaltyTransaction"("paymentIntentId");

DO $$ BEGIN
  ALTER TABLE "LoyaltyTransaction"
    ADD CONSTRAINT "LoyaltyTransaction_loyaltyAccountId_fkey"
    FOREIGN KEY ("loyaltyAccountId") REFERENCES "LoyaltyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LoyaltyTransaction"
    ADD CONSTRAINT "LoyaltyTransaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "LoyaltyPointBucket" (
  "id" TEXT NOT NULL,
  "loyaltyAccountId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sourceTransactionId" TEXT,
  "totalPoints" INTEGER NOT NULL,
  "remainingPoints" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoyaltyPointBucket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LoyaltyPointBucket_userId_expiresAt_idx"
  ON "LoyaltyPointBucket"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "LoyaltyPointBucket_loyaltyAccountId_expiresAt_idx"
  ON "LoyaltyPointBucket"("loyaltyAccountId", "expiresAt");
CREATE INDEX IF NOT EXISTS "LoyaltyPointBucket_sourceTransactionId_idx"
  ON "LoyaltyPointBucket"("sourceTransactionId");

DO $$ BEGIN
  ALTER TABLE "LoyaltyPointBucket"
    ADD CONSTRAINT "LoyaltyPointBucket_loyaltyAccountId_fkey"
    FOREIGN KEY ("loyaltyAccountId") REFERENCES "LoyaltyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LoyaltyPointBucket"
    ADD CONSTRAINT "LoyaltyPointBucket_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LoyaltyPointBucket"
    ADD CONSTRAINT "LoyaltyPointBucket_sourceTransactionId_fkey"
    FOREIGN KEY ("sourceTransactionId") REFERENCES "LoyaltyTransaction"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
