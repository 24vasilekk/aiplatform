ALTER TABLE "CustomCourse"
ADD COLUMN IF NOT EXISTS "ownerId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CustomCourse_ownerId_fkey'
  ) THEN
    ALTER TABLE "CustomCourse"
    ADD CONSTRAINT "CustomCourse_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CustomCourse_ownerId_idx"
ON "CustomCourse"("ownerId");

CREATE INDEX IF NOT EXISTS "CustomCourse_ownerId_createdAt_idx"
ON "CustomCourse"("ownerId", "createdAt");
