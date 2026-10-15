export const formatIDR = (amount: number) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(amount);

export function assertValidAmount(amount: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('Nominal harus berupa bilangan bulat rupiah lebih besar dari nol.');
  }
}

export function assertSplitTotal(transactionAmount: number, splits: { amount: number }[]) {
  const splitTotal = splits.reduce((total, split) => total + split.amount, 0);
  if (splitTotal !== transactionAmount) {
    throw new Error(`Total split (${splitTotal}) harus sama dengan nominal transaksi (${transactionAmount}).`);
  }
}

export function calculateAccountBalance(openingBalance: number, signedLedgerAmounts: number[]) {
  return signedLedgerAmounts.reduce((balance, amount) => balance + amount, openingBalance);
}

export function calculateNetWorth(assetValues: number[], liabilityValues: number[]) {
  return assetValues.reduce((a, b) => a + b, 0) - liabilityValues.reduce((a, b) => a + b, 0);
}

export function isExcludedFromReports(transaction: { excludedFromReports?: boolean }) {
  return transaction.excludedFromReports === true;
}
