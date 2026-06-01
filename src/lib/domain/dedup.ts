const isoDate = (d: Date): string => d.toISOString().split('T')[0];

/** Stable identity for a bank account: account number if known, else Akahu id. */
export function accountIdentityKey(account: { akahuId: string; accountNumber?: string | null }): string {
  return account.accountNumber ? `num:${account.accountNumber}` : `akahu:${account.akahuId}`;
}

/** Last-resort dedup key when neither externalId nor Akahu hash is available. */
export function fallbackDedupKey(tx: {
  accountId: string;
  date: Date;
  amount: number;
  description: string | null;
}): string {
  return `${tx.accountId}:${isoDate(tx.date)}:${tx.amount.toFixed(2)}:${(tx.description ?? '')
    .trim()
    .toLowerCase()}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function descriptionsSimilar(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x.includes(y) || y.includes(x)) return true;
  const words = (s: string) => new Set(s.split(/\s+/).filter((w) => w.length >= 3));
  const wa = words(x);
  for (const w of words(y)) if (wa.has(w)) return true;
  return false;
}

export interface MatchCandidate {
  date: Date;
  amount: number;
  description: string | null;
}

/**
 * Decide whether two transactions are the same real-world transaction.
 * Used to reconcile pending → confirmed and to absorb Akahu-reissued ids:
 * within 5 days, amount within 30% (handles pre-auth settling), similar description.
 */
export function transactionsMatch(a: MatchCandidate, b: MatchCandidate): boolean {
  const daysApart = Math.abs(a.date.getTime() - b.date.getTime()) / DAY_MS;
  if (daysApart > 5) return false;

  const tolerance = Math.max(Math.abs(a.amount) * 0.3, 0.05);
  if (Math.abs(a.amount - b.amount) > tolerance) return false;

  return descriptionsSimilar(a.description ?? '', b.description ?? '');
}
