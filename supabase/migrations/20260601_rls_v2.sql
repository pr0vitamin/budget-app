-- RLS v2 for the durable-ledger model. Run in the Supabase SQL editor.
-- Every table is scoped to the authenticated user.

-- Helper note: auth.uid() returns uuid; our ids are text, so cast.

-- USER
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_select" ON "User" FOR SELECT USING (id = auth.uid()::text);
CREATE POLICY "user_update" ON "User" FOR UPDATE USING (id = auth.uid()::text);
CREATE POLICY "user_insert" ON "User" FOR INSERT WITH CHECK (id = auth.uid()::text);

-- USER SETTINGS
ALTER TABLE "UserSettings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_all" ON "UserSettings" FOR ALL
  USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);

-- ACCOUNT
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "account_all" ON "Account" FOR ALL
  USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);

-- BUCKET GROUP
ALTER TABLE "BucketGroup" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "group_all" ON "BucketGroup" FOR ALL
  USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);

-- BUCKET (scoped via its group)
ALTER TABLE "Bucket" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bucket_all" ON "Bucket" FOR ALL
  USING (EXISTS (SELECT 1 FROM "BucketGroup" bg WHERE bg.id = "Bucket"."groupId" AND bg."userId" = auth.uid()::text))
  WITH CHECK (EXISTS (SELECT 1 FROM "BucketGroup" bg WHERE bg.id = "groupId" AND bg."userId" = auth.uid()::text));

-- TRANSACTION (direct userId — no account join needed)
ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "txn_all" ON "Transaction" FOR ALL
  USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);

-- ALLOCATION (scoped via its transaction)
ALTER TABLE "Allocation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alloc_all" ON "Allocation" FOR ALL
  USING (EXISTS (SELECT 1 FROM "Transaction" t WHERE t.id = "Allocation"."transactionId" AND t."userId" = auth.uid()::text))
  WITH CHECK (EXISTS (SELECT 1 FROM "Transaction" t WHERE t.id = "transactionId" AND t."userId" = auth.uid()::text));

-- BUDGET ALLOCATION
ALTER TABLE "BudgetAllocation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budgetalloc_all" ON "BudgetAllocation" FOR ALL
  USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);

-- CATEGORIZATION RULE
ALTER TABLE "CategorizationRule" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rule_all" ON "CategorizationRule" FOR ALL
  USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);
