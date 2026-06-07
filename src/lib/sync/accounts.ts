import { prisma } from '@/lib/db';
import { getAccounts as getAkahuAccounts } from '@/lib/akahu';

/**
 * Pull accounts from Akahu and upsert them by STABLE identity (account number if
 * present, else Akahu id) so reconnection updates the same row instead of
 * duplicating. Also refreshes the stored balances. Used by the "Connect / sync
 * accounts" action AND by pull-to-refresh (so the bank balance stays current).
 */
export async function syncAccountsFromAkahu(userId: string) {
  const akahuAccounts = await getAkahuAccounts();
  const existing = await prisma.account.findMany({ where: { userId } });

  for (const a of akahuAccounts) {
    const accountNumber = a.formatted_account ?? null;
    const fields = {
      akahuId: a._id,
      accountNumber,
      name: a.name,
      institution: a.connection.name,
      accountType: a.type.toLowerCase(),
      balanceCurrent: a.balance?.current ?? null,
      balanceAvailable: a.balance?.available ?? null,
      currency: a.balance?.currency ?? 'NZD',
      status: a.status,
      connectionLogo: a.connection.logo ?? null,
    };

    const match = existing.find((e) =>
      accountNumber ? e.accountNumber === accountNumber : e.akahuId === a._id
    );

    if (match) {
      await prisma.account.update({ where: { id: match.id }, data: fields });
    } else {
      await prisma.account.create({ data: { userId, ...fields } });
    }
  }

  return prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
}
