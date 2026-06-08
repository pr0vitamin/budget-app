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

function normalizeDesc(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Strict description similarity: the two descriptions are identical, OR one
 * contains the other (e.g. an enriched merchant name "Countdown Ponsonby" sits
 * inside a raw pending description "POS W/D COUNTDOWN PONSONBY 1234"). We do NOT
 * match on merely sharing a word — generic banking tokens (EFTPOS, PURCHASE, POS)
 * are shared by unrelated transactions, which previously cross-wired allocations
 * when a new transaction was wrongly confirmed onto an old pending row.
 */
function descriptionsSimilar(a: string, b: string): boolean {
  const x = normalizeDesc(a);
  const y = normalizeDesc(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 5 && long.includes(short);
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
