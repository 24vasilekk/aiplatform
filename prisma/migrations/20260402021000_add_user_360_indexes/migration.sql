CREATE INDEX IF NOT EXISTS "CourseAccess_userId_createdAt_idx"
ON "CourseAccess"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "CourseAccess_userId_expiresAt_idx"
ON "CourseAccess"("userId", "expiresAt");

CREATE INDEX IF NOT EXISTS "PaymentIntent_userId_paidAt_idx"
ON "PaymentIntent"("userId", "paidAt");

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_userId_eventName_createdAt_idx"
ON "AnalyticsEvent"("userId", "eventName", "createdAt");
