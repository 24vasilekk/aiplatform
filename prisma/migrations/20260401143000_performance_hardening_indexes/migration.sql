-- Performance hardening indexes for admin pagination and analytics queries
CREATE INDEX IF NOT EXISTS "User_role_createdAt_idx" ON "User"("role", "createdAt");

CREATE INDEX IF NOT EXISTS "CourseAccess_courseId_userId_idx" ON "CourseAccess"("courseId", "userId");

CREATE INDEX IF NOT EXISTS "CustomSection_courseId_createdAt_idx" ON "CustomSection"("courseId", "createdAt");
CREATE INDEX IF NOT EXISTS "CustomLesson_sectionId_createdAt_idx" ON "CustomLesson"("sectionId", "createdAt");
CREATE INDEX IF NOT EXISTS "CustomTask_lessonId_status_createdAt_idx" ON "CustomTask"("lessonId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "CustomTask_status_createdAt_idx" ON "CustomTask"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "PaymentIntent_userId_createdAt_idx" ON "PaymentIntent"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "PaymentIntent_planId_createdAt_idx" ON "PaymentIntent"("planId", "createdAt");
CREATE INDEX IF NOT EXISTS "PaymentIntent_paidAt_idx" ON "PaymentIntent"("paidAt");

CREATE INDEX IF NOT EXISTS "WalletTransaction_userId_operationType_createdAt_idx" ON "WalletTransaction"("userId", "operationType", "createdAt");
CREATE INDEX IF NOT EXISTS "WalletTransaction_paymentIntentId_idx" ON "WalletTransaction"("paymentIntentId");

CREATE INDEX IF NOT EXISTS "AiSolutionAnalysis_userId_status_createdAt_idx" ON "AiSolutionAnalysis"("userId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_path_createdAt_idx" ON "AnalyticsEvent"("path", "createdAt");

CREATE INDEX IF NOT EXISTS "AdminAuditLog_entityType_entityId_createdAt_idx" ON "AdminAuditLog"("entityType", "entityId", "createdAt");

CREATE INDEX IF NOT EXISTS "ServiceError_requestId_idx" ON "ServiceError"("requestId");
