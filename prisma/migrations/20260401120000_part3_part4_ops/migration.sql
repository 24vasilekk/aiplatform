CREATE TABLE IF NOT EXISTS "DailyMetricAggregate" (
  "id" TEXT NOT NULL,
  "day" TIMESTAMP(3) NOT NULL,
  "dau" INTEGER NOT NULL DEFAULT 0,
  "wau" INTEGER NOT NULL DEFAULT 0,
  "registrations" INTEGER NOT NULL DEFAULT 0,
  "paidUsers" INTEGER NOT NULL DEFAULT 0,
  "paymentConversion" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "retainedD1" INTEGER NOT NULL DEFAULT 0,
  "retainedD7" INTEGER NOT NULL DEFAULT 0,
  "aiChatMessages" INTEGER NOT NULL DEFAULT 0,
  "revenueCents" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyMetricAggregate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyMetricAggregate_day_key" ON "DailyMetricAggregate"("day");
CREATE INDEX IF NOT EXISTS "DailyMetricAggregate_day_idx" ON "DailyMetricAggregate"("day");

CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
  "id" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminAuditLog_adminUserId_createdAt_idx" ON "AdminAuditLog"("adminUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_entityType_createdAt_idx" ON "AdminAuditLog"("entityType", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt");

DO $$ BEGIN
  ALTER TABLE "AdminAuditLog"
    ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey"
    FOREIGN KEY ("adminUserId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ServiceError" (
  "id" TEXT NOT NULL,
  "requestId" TEXT,
  "route" TEXT,
  "level" TEXT NOT NULL DEFAULT 'ERROR',
  "message" TEXT NOT NULL,
  "details" JSONB,
  "stack" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT,
  CONSTRAINT "ServiceError_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ServiceError_occurredAt_idx" ON "ServiceError"("occurredAt");
CREATE INDEX IF NOT EXISTS "ServiceError_level_occurredAt_idx" ON "ServiceError"("level", "occurredAt");
CREATE INDEX IF NOT EXISTS "ServiceError_route_occurredAt_idx" ON "ServiceError"("route", "occurredAt");

DO $$ BEGIN
  ALTER TABLE "ServiceError"
    ADD CONSTRAINT "ServiceError_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "JobQueue" (
  "id" TEXT NOT NULL,
  "jobType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "lastError" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "JobQueue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "JobQueue_jobType_idempotencyKey_key" ON "JobQueue"("jobType", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "JobQueue_status_runAt_idx" ON "JobQueue"("status", "runAt");
CREATE INDEX IF NOT EXISTS "JobQueue_jobType_createdAt_idx" ON "JobQueue"("jobType", "createdAt");

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_eventName_userId_createdAt_idx"
  ON "AnalyticsEvent"("eventName", "userId", "createdAt");
