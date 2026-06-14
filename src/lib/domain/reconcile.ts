import { transactionsMatch } from './dedup';

/**
 * The first-connect floor: the oldest moment we ever import for an account.
 * `cutoffDays` whole days before the connect date, floored to the START of that
 * day in UTC. Flooring to 00:00 matters: `createdAt − cutoffDays` keeps the
 * connect time-of-day, which would drop any transaction from the morning of the
 * boundary day (e.g. connect 06-08 11:45 → cutoff 06-06 11:45 silently excluded
 * a real 06-06 01:35 transaction, leaving its pending row stuck forever). The
 * window is whole calendar days, so the boundary day must be included entirely.
 */
export function firstConnectCutoff(createdAt: Date, cutoffDays: number): Date {
  const c = new Date(createdAt);
  c.setUTCDate(c.getUTCDate() - cutoffDays);
  c.setUTCHours(0, 0, 0, 0);
  return c;
}

export interface ExistingTxn {
  id: string;
  externalId: string | null;
  hash: string | null;
  status: 'pending' | 'confirmed';
  date: Date;
  amount: number;
  description: string | null;
  allocationCount: number;
}

export interface IncomingTxn {
  externalId: string | null;
  hash: string | null;
  date: Date;
  amount: number;
  description: string | null;
}

export type SyncAction =
  | { type: 'create' }
  | { type: 'update'; id: string } // same already-confirmed txn → refresh fields
  | { type: 'confirm'; id: string }; // a pending row becomes confirmed in place

/**
 * Decide how an incoming Akahu transaction maps to existing local rows.
 * Priority: exact externalId, then stable Akahu hash (absorbs reissued ids),
 * then a fuzzy match against a pending row. Never returns "delete".
 */
export function decideSyncAction(incoming: IncomingTxn, existing: ExistingTxn[]): SyncAction {
  const matchById = incoming.externalId
    ? existing.find((e) => e.externalId && e.externalId === incoming.externalId)
    : undefined;
  if (matchById) return matchById.status === 'pending' ? { type: 'confirm', id: matchById.id } : { type: 'update', id: matchById.id };

  const matchByHash = incoming.hash ? existing.find((e) => e.hash && e.hash === incoming.hash) : undefined;
  if (matchByHash) return matchByHash.status === 'pending' ? { type: 'confirm', id: matchByHash.id } : { type: 'update', id: matchByHash.id };

  const pending = existing.find((e) => e.status === 'pending' && transactionsMatch(incoming, e));
  if (pending) return { type: 'confirm', id: pending.id };

  return { type: 'create' };
}

export interface PendingCandidate {
  id: string;
  accountId: string | null;
  date: Date;
  amount: number;
  description: string | null;
}

/**
 * Match an incoming Akahu pending transaction to one of our local pending rows
 * so we can update it IN PLACE across syncs (Akahu pendings have no stable id).
 *
 * `transactionsMatch` requires the same amount and a similar description; here
 * we add the same-account and consume-once guards (each local row may be
 * claimed by only one incoming pending per sync). Without these a new
 * transaction whose amount merely fell near an old pending row (e.g. $16.99 vs
 * $12 under the old 30% band) was merged onto it, stealing name and allocation.
 */
export function matchPendingRow(
  incoming: { accountId: string; date: Date; amount: number; description: string | null },
  candidates: PendingCandidate[],
  consumed: Set<string>
): string | null {
  const match = candidates.find(
    (c) => !consumed.has(c.id) && c.accountId === incoming.accountId && transactionsMatch(incoming, c)
  );
  return match ? match.id : null;
}

/** A pending row this many days old is treated as settled-or-reversed, not transient. */
export const STALE_PENDING_DAYS = 5;

export type DisappearedPendingAction = 'delete' | 'keep' | 'promote';

/**
 * Decide what to do with a local pending row that Akahu's pending feed no longer
 * reports AND that did not match an incoming pending this sync. The main sync
 * loop already confirms any pending that has a settled counterpart in the
 * transaction feed, so a row reaching here has no confirmed record at all.
 *
 * - delete:  no allocations — nothing of the user's to preserve, drop it.
 * - keep:    allocated but only recently gone — likely a transient one-sync feed
 *            gap; leave it pending and untouched (do NOT re-flag every sync).
 * - promote: allocated and gone past the stale threshold — it has almost
 *            certainly settled with no confirmed record (or been reversed).
 *            Move it to confirmed so it leaves the pending set and the flag loop,
 *            and flag it once for the user to verify it really happened.
 */
export function decideDisappearedPending(input: {
  hasAllocations: boolean;
  ageDays: number;
  stalePendingDays?: number;
}): DisappearedPendingAction {
  if (!input.hasAllocations) return 'delete';
  const threshold = input.stalePendingDays ?? STALE_PENDING_DAYS;
  return input.ageDays >= threshold ? 'promote' : 'keep';
}

export type AllocationReconcile =
  | { type: 'none' }
  | { type: 'updateSingle'; amount: number }
  | { type: 'flagReview' };

/**
 * When a transaction's amount changes (pending→confirmed or amended), decide
 * what to do with existing allocations WITHOUT ever deleting them:
 * - none: no allocations, or they still balance
 * - updateSingle: a single allocation → rescale it to the new amount
 * - flagReview: a split that no longer balances → keep it, set needsReview
 */
export function reconcileAllocations(input: {
  allocationCount: number;
  allocationSum: number;
  newAmount: number;
}): AllocationReconcile {
  const { allocationCount, allocationSum, newAmount } = input;
  if (allocationCount === 0) return { type: 'none' };
  if (Math.abs(allocationSum - newAmount) < 0.01) return { type: 'none' };
  if (allocationCount === 1) return { type: 'updateSingle', amount: newAmount };
  return { type: 'flagReview' };
}
