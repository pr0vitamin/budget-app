const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface DraftAllocation {
  bucketId: string;
  amount: number | null; // null = not yet entered
}

/**
 * When exactly one bucket in the split has no amount entered, return that
 * bucket filled with the remaining amount. Otherwise return null (ambiguous
 * or already complete). Used to auto-fill the last bucket in a split.
 */
export function computeAutoRemainder(
  transactionAmount: number,
  drafts: DraftAllocation[]
): { bucketId: string; amount: number } | null {
  const unentered = drafts.filter((d) => d.amount === null);
  if (unentered.length !== 1) return null;

  const enteredTotal = drafts.reduce((s, d) => s + (d.amount ?? 0), 0);
  const remainder = round2(transactionAmount - enteredTotal);
  return { bucketId: unentered[0].bucketId, amount: remainder };
}

/**
 * Validate that a set of allocation amounts sums to the transaction amount,
 * within a one-cent tolerance for floating-point noise.
 */
export function validateSplit(
  transactionAmount: number,
  allocations: { amount: number }[]
): { valid: boolean; remaining: number } {
  const total = allocations.reduce((s, a) => s + a.amount, 0);
  const remaining = round2(transactionAmount - total);
  return { valid: Math.abs(remaining) < 0.01, remaining };
}
