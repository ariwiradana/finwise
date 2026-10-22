import type { LocalRecord, LocalTransaction, LocalLedgerEntry } from '@/lib/offline/database';

export function accountBalances(
  accounts: LocalRecord[],
  transactions: LocalTransaction[],
  ledgerEntries?: LocalLedgerEntry[],
) {
  return accounts
    .filter((account) => !account.archivedAt)
    .map((account) => ({
      id: account.id,
      name: account.name,
      type: String(account.data.type || 'Bank'),
      openingBalance: Number(account.data.openingBalance || 0),
      balance:
        Number(account.data.openingBalance || 0) +
        (ledgerEntries
          ? ledgerEntries
              .filter((entry) => entry.account === account.name)
              .reduce((sum, entry) => sum + entry.amount, 0)
          : transactions
              .filter((transaction) => !transaction.deletedAt && !transaction.partnerPaid)
              .reduce((sum, transaction) => {
                if (transaction.type === 'transfer') {
                  return (
                    sum +
                    (transaction.account === account.name ? -transaction.amount : 0) +
                    (transaction.destinationAccount === account.name ? transaction.amount : 0)
                  );
                }
                if (transaction.account !== account.name) return sum;
                if (['income', 'receivable_payment'].includes(transaction.type)) return sum + transaction.amount;
                if (['expense', 'asset_purchase', 'debt_payment', 'reimburse_payment'].includes(transaction.type)) return sum - transaction.amount;
                if (transaction.type === 'refund') return sum + transaction.amount;
                return sum;
              }, 0)),
    }));
}

export function localNetWorth(
  accounts: LocalRecord[],
  assets: LocalRecord[],
  debts: LocalRecord[],
  transactions: LocalTransaction[],
  ledgerEntries?: LocalLedgerEntry[],
) {
  // Excluded wallets remain available for recording transactions and viewing balances,
  // but their balances must not contribute to personal net worth.
  const reportableAccounts = accounts.filter(
    (account) => !account.archivedAt && account.data.excludeFromReports !== true,
  );
  const liquid = accountBalances(reportableAccounts, transactions, ledgerEntries).reduce(
    (sum, account) => sum + account.balance,
    0,
  );
  const assetValue = assets
    .filter((asset) => !asset.archivedAt)
    .reduce((sum, asset) => sum + Number(asset.data.currentValue || 0), 0);
  const debtValue = debts
    .filter((debt) => !debt.archivedAt)
    .reduce(
      (sum, debt) =>
        sum +
        (String(debt.data.type || '').toLowerCase() === 'piutang'
          ? -Number(debt.data.outstanding || 0)
          : Number(debt.data.outstanding || 0)),
      0,
    );
  return liquid + assetValue - debtValue;
}

export function transactionCategoryAmount(transaction: LocalTransaction, category: string) {
  if (transaction.type === 'debt_payment' && transaction.expenseAmount !== undefined && transaction.expenseAmount === 0) return 0;
  if (transaction.type === 'debt_payment' && transaction.expenseAmount !== undefined && !transaction.splitLines?.length) {
    return transaction.category === category ? transaction.expenseAmount : 0;
  }
  if (transaction.splitLines?.length) {
    return transaction.splitLines
      .filter((split) => split.category === category)
      .reduce((sum, split) => sum + split.amount, 0);
  }
  return transaction.category === category ? transaction.amount : 0;
}
