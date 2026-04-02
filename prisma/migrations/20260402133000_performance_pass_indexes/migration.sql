-- Performance pass: indexes for User 360 sorting/filtering patterns.
CREATE INDEX IF NOT EXISTS "CourseAccess_userId_expiresAt_createdAt_idx"
  ON "CourseAccess"("userId", "expiresAt", "createdAt");

CREATE INDEX IF NOT EXISTS "PaymentIntent_userId_paidAt_createdAt_idx"
  ON "PaymentIntent"("userId", "paidAt", "createdAt");

CREATE INDEX IF NOT EXISTS "PaymentIntent_userId_status_paidAt_idx"
  ON "PaymentIntent"("userId", "status", "paidAt");

CREATE INDEX IF NOT EXISTS "AiSolutionAnalysis_userId_latencyMs_createdAt_idx"
  ON "AiSolutionAnalysis"("userId", "latencyMs", "createdAt");
