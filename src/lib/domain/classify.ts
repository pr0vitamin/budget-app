export type TransactionKind = 'income' | 'expense' | 'transfer';

export interface ClassifyInput {
  type?: string | null;
  amount: number;
}

const TRANSFER_TYPES = new Set(['TRANSFER', 'STANDING ORDER']);

/**
 * Auto-classify a transaction's kind from its Akahu type and signed amount.
 * Transfers are detected by type; everything else falls back to sign.
 * The user can override this in the inbox (see Transaction.isReclassified).
 */
export function classifyKind({ type, amount }: ClassifyInput): TransactionKind {
  if (type && TRANSFER_TYPES.has(type.toUpperCase())) {
    return 'transfer';
  }
  return amount > 0 ? 'income' : 'expense';
}
