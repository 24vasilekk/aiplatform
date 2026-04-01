ALTER TABLE "User"
  ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE TABLE "AuthAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuthAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthAccount_provider_providerAccountId_key"
  ON "AuthAccount"("provider", "providerAccountId");

CREATE UNIQUE INDEX "AuthAccount_userId_provider_key"
  ON "AuthAccount"("userId", "provider");

CREATE INDEX "AuthAccount_userId_idx"
  ON "AuthAccount"("userId");

ALTER TABLE "AuthAccount"
  ADD CONSTRAINT "AuthAccount_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
