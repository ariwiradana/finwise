import {
  pgTable, pgEnum, uuid, varchar, text, bigint, integer, boolean, timestamp,
  date, jsonb, index, uniqueIndex, numeric,
} from 'drizzle-orm/pg-core';

export const accountTypeEnum = pgEnum('account_type', ['bank', 'cash', 'ewallet', 'savings', 'deposit', 'investment', 'credit_card', 'liability']);
export const transactionTypeEnum = pgEnum('transaction_type', ['income', 'expense', 'transfer', 'refund', 'asset_purchase', 'debt_payment', 'receivable_payment', 'reimburse_payment', 'adjustment']);
export const transactionStatusEnum = pgEnum('transaction_status', ['draft', 'posted', 'scheduled', 'cancelled']);
export const categoryTypeEnum = pgEnum('category_type', ['income', 'expense', 'transfer', 'allocation', 'asset', 'liability']);
export const liabilityTypeEnum = pgEnum('liability_type', ['credit_card', 'loan', 'installment', 'personal_debt', 'receivable', 'other']);
export const goalStatusEnum = pgEnum('goal_status', ['active', 'paused', 'completed', 'archived']);
export const recurringFrequencyEnum = pgEnum('recurring_frequency', ['daily', 'weekly', 'monthly', 'yearly']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: varchar('display_name', { length: 80 }),
  avatarData: text('avatar_data'),
  pinHash: text('pin_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  type: accountTypeEnum('type').notNull(),
  currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
  openingBalance: bigint('opening_balance', { mode: 'number' }).default(0).notNull(),
  openingBalanceDate: date('opening_balance_date').notNull(),
  minimumBalance: bigint('minimum_balance', { mode: 'number' }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('accounts_user_idx').on(t.userId)]);

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id'),
  name: varchar('name', { length: 100 }).notNull(),
  type: categoryTypeEnum('type').notNull(),
  color: varchar('color', { length: 20 }),
  icon: varchar('icon', { length: 50 }),
  isSystem: boolean('is_system').default(false).notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('categories_user_idx').on(t.userId), index('categories_parent_idx').on(t.parentId)]);

export const transactions = pgTable('transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: transactionTypeEnum('type').notNull(),
  status: transactionStatusEnum('status').default('posted').notNull(),
  transactionDate: timestamp('transaction_date', { withTimezone: true }).notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
  description: varchar('description', { length: 240 }).notNull(),
  merchant: varchar('merchant', { length: 160 }),
  paymentMethod: varchar('payment_method', { length: 60 }),
  accountId: uuid('account_id').references(() => accounts.id),
  destinationAccountId: uuid('destination_account_id').references(() => accounts.id),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  excludedFromReports: boolean('excluded_from_reports').default(false).notNull(),
  isRecurringInstance: boolean('is_recurring_instance').default(false).notNull(),
  recurringRuleId: uuid('recurring_rule_id'),
  relatedTransactionId: uuid('related_transaction_id'),
  assetId: uuid('asset_id'),
  liabilityId: uuid('liability_id'),
  note: text('note'),
  tags: jsonb('tags').$type<string[]>().default([]).notNull(),
  attachmentKeys: jsonb('attachment_keys').$type<string[]>().default([]).notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 160 }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('transactions_user_date_idx').on(t.userId, t.transactionDate),
  index('transactions_user_type_idx').on(t.userId, t.type),
  index('transactions_account_idx').on(t.accountId),
  index('transactions_category_idx').on(t.categoryId),
  uniqueIndex('transactions_idempotency_unique').on(t.userId, t.idempotencyKey),
]);

export const transactionSplits = pgTable('transaction_splits', {
  id: uuid('id').defaultRandom().primaryKey(),
  transactionId: uuid('transaction_id').notNull().references(() => transactions.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  note: varchar('note', { length: 240 }),
  tags: jsonb('tags').$type<string[]>().default([]).notNull(),
}, (t) => [index('transaction_splits_transaction_idx').on(t.transactionId)]);

export const ledgerEntries = pgTable('ledger_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  transactionId: uuid('transaction_id').notNull().references(() => transactions.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  entryDate: timestamp('entry_date', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('ledger_user_account_date_idx').on(t.userId, t.accountId, t.entryDate), index('ledger_transaction_idx').on(t.transactionId)]);

export const assets = pgTable('assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 140 }).notNull(),
  type: varchar('type', { length: 60 }).notNull(),
  acquiredAt: date('acquired_at'),
  acquisitionValue: bigint('acquisition_value', { mode: 'number' }).default(0).notNull(),
  currentValue: bigint('current_value', { mode: 'number' }).default(0).notNull(),
  linkedAccountId: uuid('linked_account_id').references(() => accounts.id),
  note: text('note'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('assets_user_idx').on(t.userId)]);

export const assetValuations = pgTable('asset_valuations', {
  id: uuid('id').defaultRandom().primaryKey(),
  assetId: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  valuationDate: date('valuation_date').notNull(),
  value: bigint('value', { mode: 'number' }).notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('asset_valuations_asset_date_idx').on(t.assetId, t.valuationDate)]);

export const liabilities = pgTable('liabilities', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 140 }).notNull(),
  type: liabilityTypeEnum('type').notNull(),
  principalAmount: bigint('principal_amount', { mode: 'number' }).notNull(),
  outstandingPrincipal: bigint('outstanding_principal', { mode: 'number' }).notNull(),
  annualInterestRate: numeric('annual_interest_rate', { precision: 7, scale: 4 }).default('0').notNull(),
  monthlyPayment: bigint('monthly_payment', { mode: 'number' }),
  dueDate: date('due_date'),
  remainingMonths: integer('remaining_months'),
  linkedAccountId: uuid('linked_account_id').references(() => accounts.id),
  note: text('note'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('liabilities_user_idx').on(t.userId)]);

export const debtPayments = pgTable('debt_payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  liabilityId: uuid('liability_id').notNull().references(() => liabilities.id, { onDelete: 'cascade' }),
  transactionId: uuid('transaction_id').references(() => transactions.id),
  paymentDate: date('payment_date').notNull(),
  principalPaid: bigint('principal_paid', { mode: 'number' }).default(0).notNull(),
  interestPaid: bigint('interest_paid', { mode: 'number' }).default(0).notNull(),
  feesPaid: bigint('fees_paid', { mode: 'number' }).default(0).notNull(),
  note: text('note'),
}, (t) => [index('debt_payments_liability_date_idx').on(t.liabilityId, t.paymentDate)]);

export const budgets = pgTable('budgets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  monthlyLimit: bigint('monthly_limit', { mode: 'number' }).notNull(),
  alertThresholds: jsonb('alert_thresholds').$type<number[]>().default([75, 90, 100]).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('budgets_user_idx').on(t.userId)]);

export const goals = pgTable('goals', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 140 }).notNull(),
  targetAmount: bigint('target_amount', { mode: 'number' }).notNull(),
  allocatedAmount: bigint('allocated_amount', { mode: 'number' }).default(0).notNull(),
  deadline: date('deadline'),
  priority: integer('priority').default(3).notNull(),
  status: goalStatusEnum('status').default('active').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('goals_user_status_idx').on(t.userId, t.status)]);

export const goalAllocations = pgTable('goal_allocations', {
  id: uuid('id').defaultRandom().primaryKey(),
  goalId: uuid('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').references(() => accounts.id),
  transactionId: uuid('transaction_id').references(() => transactions.id),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  allocationDate: date('allocation_date').notNull(),
  note: text('note'),
}, (t) => [index('goal_allocations_goal_date_idx').on(t.goalId, t.allocationDate)]);

export const recurringRules = pgTable('recurring_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 140 }).notNull(),
  type: transactionTypeEnum('type').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  description: varchar('description', { length: 240 }).notNull(),
  frequency: recurringFrequencyEnum('frequency').notNull(),
  interval: integer('interval').default(1).notNull(),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }),
  accountId: uuid('account_id').references(() => accounts.id),
  categoryId: uuid('category_id').references(() => categories.id),
  excludedFromReports: boolean('excluded_from_reports').default(false).notNull(),
  reminderDaysBefore: integer('reminder_days_before').default(3).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('recurring_rules_user_next_idx').on(t.userId, t.nextRunAt)]);

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entityType: varchar('entity_type', { length: 60 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  action: varchar('action', { length: 40 }).notNull(),
  before: jsonb('before'),
  after: jsonb('after'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('audit_logs_user_created_idx').on(t.userId, t.createdAt), index('audit_logs_entity_idx').on(t.entityType, t.entityId)]);

export const importJobs = pgTable('import_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  status: varchar('status', { length: 40 }).default('preview').notNull(),
  totalRows: integer('total_rows').default(0).notNull(),
  importedRows: integer('imported_rows').default(0).notNull(),
  skippedRows: integer('skipped_rows').default(0).notNull(),
  errors: jsonb('errors').$type<{ row: number; message: string }[]>().default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('import_jobs_user_idx').on(t.userId)]);

export const syncOperations = pgTable('sync_operations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  operationId: varchar('operation_id', { length: 160 }).notNull(),
  entityType: varchar('entity_type', { length: 60 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  payload: jsonb('payload').notNull(),
  baseVersion: integer('base_version').default(0).notNull(),
  status: varchar('status', { length: 30 }).default('pending').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex('sync_operations_user_operation_unique').on(t.userId, t.operationId), index('sync_operations_user_status_idx').on(t.userId, t.status)]);

// Versioned local-first snapshots support conflict-aware multi-device sync.
export const userSnapshots = pgTable('user_snapshots', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  version: integer('version').default(1).notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
