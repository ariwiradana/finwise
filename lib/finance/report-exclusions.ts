import type { LocalRecord, LocalTransaction } from "@/lib/offline/database";

/**
 * A transaction stays in the ledger and continues to affect account balances.
 * This helper only determines whether it should participate in reports/budgets.
 */
export function isTransactionExcludedFromReports(
  transaction: LocalTransaction,
  accounts: LocalRecord[],
): boolean {
  if (transaction.deletedAt || transaction.excludedFromReports) return true;
  const excludedAccounts = new Set(
    accounts
      .filter(
        (account) =>
          !account.archivedAt && account.data.excludeFromReports === true,
      )
      .map((account) => account.name),
  );
  return (
    excludedAccounts.has(transaction.account) ||
    Boolean(
      transaction.destinationAccount &&
      excludedAccounts.has(transaction.destinationAccount),
    )
  );
}
