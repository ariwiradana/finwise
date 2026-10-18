"use client";
import Dexie, { type EntityTable } from "dexie";
export type TxType =
  | "income"
  | "expense"
  | "transfer"
  | "refund"
  | "asset_purchase"
  | "debt_payment"
  | "receivable_payment"
  | "reimburse_payment"
  | "adjustment";
export type LocalTransaction = {
  id: string;
  type: TxType;
  date: string;
  amount: number;
  description: string;
  category: string;
  account: string;
  destinationAccount?: string;
  excludedFromReports: boolean;
  note?: string;
  tags: string[];
  syncStatus: "pending" | "synced" | "conflict";
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  splitLines?: { category: string; amount: number; note?: string }[];
  relatedId?: string;
  partnerPaid?: boolean;
  expenseAmount?: number;
  incomeAmount?: number;
  principalPaid?: number;
  interestPaid?: number;
  feesPaid?: number;
  reimburseStatus?: "pending" | "reimbursed" | "not_applicable";
};
export type LocalAccount = {
  id: string;
  name: string;
  type: string;
  openingBalance: number;
  currency: "IDR";
  archivedAt?: string;
  minimumBalance?: number;
};
export type LocalLedgerEntry = {
  id: string;
  transactionId: string;
  account: string;
  amount: number;
  entryDate: string;
  createdAt: string;
};
export type LocalRecord = {
  id: string;
  kind: string;
  name: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};
export type AuditRecord = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
};
export type AppSetting = { key: string; value: unknown };
class FinanceLocalDB extends Dexie {
  transactions!: EntityTable<LocalTransaction, "id">;
  accounts!: EntityTable<LocalAccount, "id">;
  ledgerEntries!: EntityTable<LocalLedgerEntry, "id">;
  records!: EntityTable<LocalRecord, "id">;
  audit!: EntityTable<AuditRecord, "id">;
  settings!: EntityTable<AppSetting, "key">;
  constructor() {
    super("finwise-local");
    this.version(1).stores({
      transactions:
        "id,date,type,category,account,excludedFromReports,syncStatus,deletedAt,updatedAt",
      accounts: "id,name,type",
    });
    this.version(2).stores({
      transactions:
        "id,date,type,category,account,excludedFromReports,syncStatus,deletedAt,updatedAt,relatedId,reimburseStatus",
      accounts: "id,name,type,archivedAt",
      records: "id,kind,name,archivedAt,updatedAt,[kind+name]",
      audit: "id,entityType,entityId,action,createdAt",
      settings: "key",
    });
    this.version(3).stores({
      transactions:
        "id,date,type,category,account,excludedFromReports,syncStatus,deletedAt,updatedAt,relatedId,reimburseStatus",
      accounts: "id,name,type,archivedAt",
      ledgerEntries:
        "id,transactionId,account,entryDate,[transactionId+account]",
      records: "id,kind,name,archivedAt,updatedAt,[kind+name]",
      audit: "id,entityType,entityId,action,createdAt",
      settings: "key",
    });
  }
}
export const localDB =
  typeof window !== "undefined" ? new FinanceLocalDB() : null;
export const DEFAULT_CATEGORIES = [
  { name: "Gaji", type: "income" },
  { name: "Freelance", type: "income" },
  { name: "Bonus", type: "income" },
  { name: "Reimburse", type: "income" },
  { name: "Investasi masuk", type: "income" },
  { name: "Makan & Minum", type: "expense" },
  { name: "Transportasi", type: "expense" },
  { name: "Belanja", type: "expense" },
  { name: "Tagihan", type: "expense" },
  { name: "Keluarga", type: "expense" },
  { name: "Pekerjaan", type: "expense" },
  { name: "Kesehatan", type: "expense" },
  { name: "Hiburan", type: "expense" },
  { name: "Pajak", type: "expense" },
  { name: "Biaya Bank", type: "expense" },
  { name: "Bunga & Biaya Utang", type: "expense" },
  { name: "Lainnya", type: "expense" },
  { name: "Transfer", type: "transfer" },
  { name: "Alokasi tabungan", type: "allocation" },
  { name: "Reimburse partner", type: "allocation" },
  { name: "Pembelian aset", type: "asset" },
  { name: "Pembayaran utang", type: "liability" },
];
export const DEFAULT_ACCOUNTS = [
  {
    id: "cash",
    name: "Cash",
    type: "cash",
    openingBalance: 0,
    currency: "IDR" as const,
  },
  {
    id: "bank",
    name: "Bank utama",
    type: "bank",
    openingBalance: 0,
    currency: "IDR" as const,
  },
];
