CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyTransaction_userId_reason_courseId_key"
  ON "LoyaltyTransaction"("userId", "reason", "courseId");
