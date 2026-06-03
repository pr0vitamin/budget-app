import { transactionsMatch } from './dedup';

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
