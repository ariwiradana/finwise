export type LedgerMovement = { accountId: string; amount: number };
export type TransactionType = 'income' | 'expense' | 'transfer' | 'refund' | 'asset_purchase' | 'debt_payment' | 'receivable_payment' | 'reimburse_payment' | 'adjustment';

/** Signed movements: positive increases an account balance, negative decreases it. */
export function movementsForTransaction(input: {
  type: TransactionType;
  amount: number;
  accountId: string;
  destinationAccountId?: string | null;
  accountKind?: 'asset' | 'liability';
}): LedgerMovement[] {
  const { type, amount, accountId, destinationAccountId, accountKind = 'asset' } = input;
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Amount must be a positive integer in IDR.');
  if (type === 'transfer') {
    if (!destinationAccountId || destinationAccountId === accountId) throw new Error('Transfer requires two different accounts.');
    return [{ accountId, amount: -amount }, { accountId: destinationAccountId, amount }];
  }
  if (type === 'income' || type === 'refund' || type === 'receivable_payment') {
    return [{ accountId, amount: accountKind === 'liability' ? -amount : amount }];
  }
  return [{ accountId, amount: accountKind === 'liability' ? amount : -amount }];
}

export function assertBalancedTransfer(movements: LedgerMovement[]) {
  if (movements.reduce((sum, movement) => sum + movement.amount, 0) !== 0) {
    throw new Error('Transfer must balance to zero across accounts.');
  }
}
