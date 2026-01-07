-- Enable Row Level Security for BudgetAllocation table
-- This table stores income-to-bucket allocations (feeding buckets from the Available to Budget pool)

-- ============================================================================
-- BUDGET ALLOCATION
-- ============================================================================
ALTER TABLE "BudgetAllocation" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own budget allocations"
  ON "BudgetAllocation" FOR SELECT
  USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can insert own budget allocations"
  ON "BudgetAllocation" FOR INSERT
  WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "Users can update own budget allocations"
  ON "BudgetAllocation" FOR UPDATE
  USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can delete own budget allocations"
  ON "BudgetAllocation" FOR DELETE
  USING ("userId" = auth.uid()::text);
