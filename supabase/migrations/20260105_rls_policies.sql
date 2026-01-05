-- Enable Row Level Security on all tables
-- These policies ensure users can only access their own data

-- ============================================================================
-- PRISMA MIGRATIONS (admin-only, block all user access)
-- ============================================================================
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
-- No policies = no access for authenticated users (only service role can access)
-- ============================================================================
-- USER
-- ============================================================================
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON "User" FOR SELECT
  USING (id = auth.uid()::text);

CREATE POLICY "Users can update own profile"
  ON "User" FOR UPDATE
  USING (id = auth.uid()::text);

-- ============================================================================
-- USER SETTINGS
-- ============================================================================
ALTER TABLE "UserSettings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON "UserSettings" FOR SELECT
  USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can insert own settings"
  ON "UserSettings" FOR INSERT
  WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "Users can update own settings"
  ON "UserSettings" FOR UPDATE
  USING ("userId" = auth.uid()::text);

-- ============================================================================
-- ACCOUNT
-- ============================================================================
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounts"
  ON "Account" FOR SELECT
  USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can insert own accounts"
  ON "Account" FOR INSERT
  WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "Users can update own accounts"
  ON "Account" FOR UPDATE
  USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can delete own accounts"
  ON "Account" FOR DELETE
  USING ("userId" = auth.uid()::text);

-- ============================================================================
-- BUCKET GROUP
-- ============================================================================
ALTER TABLE "BucketGroup" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bucket groups"
  ON "BucketGroup" FOR SELECT
  USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can insert own bucket groups"
  ON "BucketGroup" FOR INSERT
  WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "Users can update own bucket groups"
  ON "BucketGroup" FOR UPDATE
  USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can delete own bucket groups"
  ON "BucketGroup" FOR DELETE
  USING ("userId" = auth.uid()::text);

-- ============================================================================
-- BUCKET
-- ============================================================================
ALTER TABLE "Bucket" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own buckets"
  ON "Bucket" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "BucketGroup" bg
      WHERE bg.id = "Bucket"."groupId"
      AND bg."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert own buckets"
  ON "Bucket" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "BucketGroup" bg
      WHERE bg.id = "groupId"
      AND bg."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Users can update own buckets"
  ON "Bucket" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "BucketGroup" bg
      WHERE bg.id = "Bucket"."groupId"
      AND bg."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Users can delete own buckets"
  ON "Bucket" FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "BucketGroup" bg
      WHERE bg.id = "Bucket"."groupId"
      AND bg."userId" = auth.uid()::text
    )
  );

-- ============================================================================
-- TRANSACTION
-- ============================================================================
ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON "Transaction" FOR SELECT
  USING (
    "accountId" IS NULL 
    OR EXISTS (
      SELECT 1 FROM "Account" a
      WHERE a.id = "Transaction"."accountId"
      AND a."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert own transactions"
  ON "Transaction" FOR INSERT
  WITH CHECK (
    "accountId" IS NULL
    OR EXISTS (
      SELECT 1 FROM "Account" a
      WHERE a.id = "accountId"
      AND a."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Users can update own transactions"
  ON "Transaction" FOR UPDATE
  USING (
    "accountId" IS NULL
    OR EXISTS (
      SELECT 1 FROM "Account" a
      WHERE a.id = "Transaction"."accountId"
      AND a."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Users can delete own transactions"
  ON "Transaction" FOR DELETE
  USING (
    "accountId" IS NULL
    OR EXISTS (
      SELECT 1 FROM "Account" a
      WHERE a.id = "Transaction"."accountId"
      AND a."userId" = auth.uid()::text
    )
  );

-- ============================================================================
-- ALLOCATION
-- ============================================================================
ALTER TABLE "Allocation" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own allocations"
  ON "Allocation" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Transaction" t
      JOIN "Account" a ON a.id = t."accountId"
      WHERE t.id = "Allocation"."transactionId"
      AND a."userId" = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM "Transaction" t
      WHERE t.id = "Allocation"."transactionId"
      AND t."accountId" IS NULL
      AND t."isManual" = true
    )
  );

CREATE POLICY "Users can insert own allocations"
  ON "Allocation" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Transaction" t
      JOIN "Account" a ON a.id = t."accountId"
      WHERE t.id = "transactionId"
      AND a."userId" = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM "Transaction" t
      WHERE t.id = "transactionId"
      AND t."accountId" IS NULL
    )
  );

CREATE POLICY "Users can update own allocations"
  ON "Allocation" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "Transaction" t
      JOIN "Account" a ON a.id = t."accountId"
      WHERE t.id = "Allocation"."transactionId"
      AND a."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Users can delete own allocations"
  ON "Allocation" FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "Transaction" t
      JOIN "Account" a ON a.id = t."accountId"
      WHERE t.id = "Allocation"."transactionId"
      AND a."userId" = auth.uid()::text
    )
  );

-- ============================================================================
-- SCHEDULED TRANSACTION
-- ============================================================================
ALTER TABLE "ScheduledTransaction" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scheduled transactions"
  ON "ScheduledTransaction" FOR SELECT
  USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can insert own scheduled transactions"
  ON "ScheduledTransaction" FOR INSERT
  WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "Users can update own scheduled transactions"
  ON "ScheduledTransaction" FOR UPDATE
  USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can delete own scheduled transactions"
  ON "ScheduledTransaction" FOR DELETE
  USING ("userId" = auth.uid()::text);

-- ============================================================================
-- CATEGORIZATION RULE
-- ============================================================================
ALTER TABLE "CategorizationRule" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rules"
  ON "CategorizationRule" FOR SELECT
  USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can insert own rules"
  ON "CategorizationRule" FOR INSERT
  WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "Users can delete own rules"
  ON "CategorizationRule" FOR DELETE
  USING ("userId" = auth.uid()::text);
