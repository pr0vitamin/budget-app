const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

export interface BucketBalanceInput {
  feeds: number[]; // BudgetAllocation amounts (positive)
  allocations: number[]; // Allocation amounts (signed; expenses negative, refunds positive)
}

/** Bucket balance = money fed in + signed spending allocations. */
export function calculateBucketBalance({ feeds, allocations }: BucketBalanceInput): number {
  return sum(feeds) + sum(allocations);
}

export interface AvailableInput {
  incomeTotal: number; // sum of transactions where kind = income
  feedsTotal: number; // sum of all BudgetAllocations
}

/** Available to Budget = recorded income − money already fed into buckets. */
export function calculateAvailableToBudget({ incomeTotal, feedsTotal }: AvailableInput): number {
  return incomeTotal - feedsTotal;
}
