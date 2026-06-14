import { prisma } from '@/lib/db';
import { getTransactions, getPendingTransactions, type AkahuTransaction } from '@/lib/akahu';
import { decideSyncAction, decideDisappearedPending, confirmedFieldsDiffer, firstConnectCutoff, matchPendingRow, reconcileAllocations, type ExistingTxn } from '@/lib/domain/reconcile';
import { classifyKind } from '@/lib/domain/classify';
import { findMatchingRule, type Rule } from '@/lib/domain/rules';

export interface SyncResult { created: number; updated: number; confirmed: number; flaggedReview: number; }

function merchantOf(t: { merchant?: { name: string }; description: string }): string {
  return t.merchant?.name ?? t.description.replace(/\s+/g, ' ').trim().slice(0, 100);
}

// Apply categorization rules to a freshly-ingested EXPENSE that has no allocation.
async function autoCategorize(txnId: string, merchant: string, amount: number, rules: Rule[]): Promise<void> {
  if (amount >= 0) return; // only expenses
  const rule = findMatchingRule(merchant, rules);
  if (!rule) return;
  await prisma.allocation.create({ data: { transactionId: txnId, bucketId: rule.bucketId, amount } });
}

export async function syncUser(userId: string): Promise<SyncResult> {
  const accounts = await prisma.account.findMany({ where: { userId } });
  if (accounts.length === 0) return { created: 0, updated: 0, confirmed: 0, flaggedReview: 0 };
  const akahuToLocal = new Map(accounts.map((a) => [a.akahuId, a.id]));

  // The user's first-connect window is a PERMANENT FLOOR: never import any
  // transaction older than (account.createdAt − initialSyncDays). On an account's
  // first sync we fetch that full window; routine syncs stay within ~30 days but
  // are floored at the cutoff so they can never reach past it.
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const cutoffDays = settings?.initialSyncDays ?? 30;
  const routineSince = new Date();
  routineSince.setDate(routineSince.getDate() - 30);
  const cutoffOf = (createdAt: Date): Date => firstConnectCutoff(createdAt, cutoffDays);
  const sinceOf = (a: { createdAt: Date; lastSyncAt: Date | null }): Date => {
    const cutoff = cutoffOf(a.createdAt);
    if (!a.lastSyncAt) return cutoff; // first sync: fetch the full initial window
    return cutoff > routineSince ? cutoff : routineSince; // routine: floored at cutoff
  };
  const oldestSince = accounts.reduce<Date>(
    (min, a) => (sinceOf(a) < min ? sinceOf(a) : min),
    new Date()
  );

  const rules = (await prisma.categorizationRule.findMany({ where: { userId } })).map((r) => ({
    id: r.id, merchantPattern: r.merchantPattern, bucketId: r.bucketId,
  }));

  // First pass: fetch each account's Akahu transactions up front. We need the
  // incoming externalIds/hashes BEFORE building the candidate set so we can
  // include any existing row that shares one. externalId/hash are globally-unique
  // identities and must be matched even when the local row's date sits outside
  // the recent-date window — otherwise an edited/corrupted date hides the row and
  // we try to re-insert its externalId, a duplicate-key error that aborts the
  // entire sync.
  const fetched: { account: (typeof accounts)[number]; cutoff: Date; txns: AkahuTransaction[] }[] = [];
  const incomingIds: string[] = [];
  const incomingHashes: string[] = [];
  for (const account of accounts) {
    const since = sinceOf(account);
    const cutoff = cutoffOf(account.createdAt);
    try {
      const txns = await getTransactions(account.akahuId, since.toISOString().split('T')[0]);
      fetched.push({ account, cutoff, txns });
      for (const at of txns) {
        incomingIds.push(at._id);
        if (at.hash) incomingHashes.push(at.hash);
      }
    } catch (e) {
      console.error(`Sync failed for account ${account.id}:`, e);
      // graceful: keep other accounts working
    }
  }

  // Candidate existing rows for matching: this user's pending rows, recent rows,
  // and any row sharing an incoming externalId/hash (identity match, any date).
  const existingRows = await prisma.transaction.findMany({
    where: {
      userId,
      OR: [
        { status: 'pending' },
        { date: { gte: oldestSince } },
        { externalId: { in: incomingIds } },
        { hash: { in: incomingHashes } },
      ],
    },
    include: { allocations: { select: { amount: true } } },
  });
  const existing: (ExistingTxn & { accountId: string | null })[] = existingRows.map((t) => ({
    id: t.id,
    externalId: t.externalId,
    hash: t.hash,
    status: t.status as 'pending' | 'confirmed',
    date: t.date,
    amount: Number(t.amount),
    description: t.description,
    allocationCount: t.allocations.length,
    accountId: t.accountId,
  }));

  const result: SyncResult = { created: 0, updated: 0, confirmed: 0, flaggedReview: 0 };

  for (const { account, cutoff, txns } of fetched) {
    for (const at of txns) {
      const incoming = {
        externalId: at._id,
        hash: at.hash ?? null,
        date: new Date(at.date),
        amount: at.amount,
        description: at.description,
      };
      // Hard floor: never import anything older than the first-connect cutoff.
      if (incoming.date < cutoff) continue;
      const action = decideSyncAction(incoming, existing);
      const kind = classifyKind({ type: at.type, amount: at.amount });
      const merchant = merchantOf(at);

      if (action.type === 'create') {
        const created = await prisma.transaction.create({
          data: {
            userId, accountId: account.id, source: 'akahu', externalId: at._id, hash: at.hash ?? null,
            kind, amount: at.amount, merchant, description: at.description,
            date: incoming.date, category: at.category?.name ?? null,
            balanceAfter: at.balance ?? null, status: 'confirmed',
          },
        });
        await autoCategorize(created.id, merchant, at.amount, rules);
        existing.push({ id: created.id, externalId: at._id, hash: at.hash ?? null, status: 'confirmed', date: incoming.date, amount: at.amount, description: at.description, allocationCount: 0, accountId: account.id });
        result.created++;
      } else {
        // update or confirm — reconcile allocations against the new amount
        const target = existingRows.find((e) => e.id === action.id)!;
        const allocSum = target.allocations.reduce((s, a) => s + Number(a.amount), 0);
        const recon = reconcileAllocations({ allocationCount: target.allocations.length, allocationSum: allocSum, newAmount: at.amount });
        const isConfirm = action.type === 'confirm';

        // A confirm always changes status. An update (already-confirmed row,
        // re-seen) only matters if the Akahu fields actually changed or an
        // allocation needs touching — otherwise re-syncing the same transaction
        // would rewrite it and count it as an "update" on every sync.
        const fieldsDiffer = confirmedFieldsDiffer(
          {
            externalId: target.externalId, hash: target.hash, amount: Number(target.amount),
            merchant: target.merchant, description: target.description, category: target.category,
            balanceAfter: target.balanceAfter === null ? null : Number(target.balanceAfter),
          },
          {
            externalId: at._id, hash: at.hash ?? null, amount: at.amount, merchant,
            description: at.description, category: at.category?.name ?? null, balanceAfter: at.balance ?? null,
          }
        );
        const mustWrite = isConfirm || fieldsDiffer || recon.type !== 'none';

        if (recon.type === 'updateSingle') {
          await prisma.allocation.updateMany({ where: { transactionId: target.id }, data: { amount: recon.amount } });
        }
        if (mustWrite) {
          await prisma.transaction.update({
            where: { id: target.id },
            data: {
              externalId: at._id, hash: at.hash ?? null, amount: at.amount, merchant,
              description: at.description, category: at.category?.name ?? null,
              balanceAfter: at.balance ?? null, status: 'confirmed',
              needsReview: recon.type === 'flagReview' ? true : undefined,
              // keep user's kind override
              kind: undefined,
            },
          });
        }
        // newly-confirmed expense with no allocation → try rules
        if (target.allocations.length === 0) await autoCategorize(target.id, merchant, at.amount, rules);
        if (recon.type === 'flagReview') result.flaggedReview++;
        if (isConfirm) result.confirmed++;
        else if (mustWrite) result.updated++;

        // Consume the matched candidate so no later incoming transaction in this
        // sync can be matched onto the same row (prevents data being funnelled
        // into one row when several incoming look similar).
        const consumeIdx = existing.findIndex((e) => e.id === action.id);
        if (consumeIdx >= 0) existing.splice(consumeIdx, 1);
      }
    }
  }

  // Pending transactions: upsert in place; drop disappeared ones only if no allocations.
  await syncPending(userId, akahuToLocal, rules, result);
  return result;
}

async function syncPending(
  userId: string,
  akahuToLocal: Map<string, string>,
  rules: Rule[],
  result: SyncResult
): Promise<void> {
  let pending: Awaited<ReturnType<typeof getPendingTransactions>> = [];
  try {
    pending = await getPendingTransactions();
  } catch {
    return; // pending is best-effort
  }
  const mine = pending.filter((p) => akahuToLocal.has(p._account));

  const localPending = await prisma.transaction.findMany({
    where: { userId, status: 'pending' },
    include: { allocations: { select: { id: true } } },
  });

  const seen = new Set<string>();
  const candidates = localPending.map((lp) => ({
    id: lp.id,
    accountId: lp.accountId,
    date: new Date(lp.date),
    amount: Number(lp.amount),
    description: lp.description,
  }));
  for (const p of mine) {
    const accountId = akahuToLocal.get(p._account)!;
    const incoming = { accountId, date: new Date(p.date), amount: p.amount, description: p.description };
    const merchant = p.description.replace(/\s+/g, ' ').trim().slice(0, 100);
    // Match an existing local pending row to update IN PLACE (never delete+recreate).
    // Requires same account, an exact amount (a still-pending txn hasn't settled,
    // so its amount is stable) and a similar description — a loose 30% amount-only
    // match previously merged unrelated transactions onto the wrong row.
    const matchId = matchPendingRow(incoming, candidates, seen);
    if (matchId) {
      seen.add(matchId);
      await prisma.transaction.update({
        where: { id: matchId },
        data: { amount: p.amount, merchant, description: p.description, date: incoming.date },
      });
    } else {
      const kind = classifyKind({ type: p.type, amount: p.amount });
      const created = await prisma.transaction.create({
        data: { userId, accountId, source: 'akahu', kind, amount: p.amount, merchant, description: p.description, date: incoming.date, status: 'pending' },
      });
      await autoCategorizePending(created.id, merchant, p.amount, rules);
      result.created++;
    }
  }

  // Disappeared pending (no longer reported, not matched): drop, leave, or
  // promote-and-flag depending on allocations and how long it's been pending.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  for (const lp of localPending) {
    if (seen.has(lp.id)) continue;
    const ageDays = (now - new Date(lp.date).getTime()) / DAY_MS;
    const action = decideDisappearedPending({ hasAllocations: lp.allocations.length > 0, ageDays });
    if (action === 'delete') {
      await prisma.transaction.delete({ where: { id: lp.id } });
    } else if (action === 'promote') {
      // Settled-or-reversed with no confirmed record: confirm it (so it leaves
      // the pending set and stops being re-flagged) and flag once to verify.
      await prisma.transaction.update({
        where: { id: lp.id },
        data: { status: 'confirmed', needsReview: true },
      });
      result.flaggedReview++;
    }
    // action === 'keep' → recently gone, likely transient: leave it untouched.
  }
}

async function autoCategorizePending(txnId: string, merchant: string, amount: number, rules: Rule[]): Promise<void> {
  if (amount >= 0) return;
  const rule = findMatchingRule(merchant, rules);
  if (rule) await prisma.allocation.create({ data: { transactionId: txnId, bucketId: rule.bucketId, amount } });
}
