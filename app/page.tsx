"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Activity,
  AlertTriangle,
  Archive,
  Banknote,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CirclePlus,
  Cloud,
  CloudOff,
  Database,
  Download,
  ExternalLink,
  Gauge,
  Goal,
  History,
  Landmark,
  PiggyBank,
  RefreshCw,
  ShieldAlert,
  Target,
  TrendingDown,
  Wallet,
  Zap,
} from "lucide-react";
import { formatIDR } from "@/lib/finance/money";
import { useLocalTransactions } from "@/components/transaction-store";
import { useLocalRecords } from "@/components/local-records";
import { localDB } from "@/lib/offline/database";
import {
  accountBalances,
  localNetWorth,
  transactionCategoryAmount,
} from "@/lib/finance/local-summary";

type PanelProps = {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

function Panel({
  id,
  title,
  subtitle,
  icon,
  count,
  defaultOpen = true,
  children,
}: PanelProps) {
  return (
    <details className="card finwise-panel" id={id} open={defaultOpen}>
      <summary className="finwise-panel-summary">
        <span className="finwise-panel-heading">
          {icon ? <span className="finwise-panel-icon">{icon}</span> : null}
          <span className="finwise-panel-title-wrap">
            <strong>{title}</strong>
            {subtitle ? <small>{subtitle}</small> : null}
          </span>
          {typeof count === "number" ? (
            <span className="badge">{count}</span>
          ) : null}
        </span>
        <ChevronDown className="finwise-chevron" size={17} />
      </summary>
      <div className="finwise-panel-content">{children}</div>
    </details>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="finwise-empty">{children}</div>;
}

function ProgressBar({
  value,
  color = "#287b50",
}: {
  value: number;
  color?: string;
}) {
  return (
    <div
      className="progress"
      aria-label={`Progres ${Math.round(value)} persen`}
    >
      <span
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          background: color,
        }}
      />
    </div>
  );
}

function Metric({
  title,
  value,
  foot,
  icon,
  tone = "neutral",
}: {
  title: string;
  value: string;
  foot: string;
  icon: React.ReactNode;
  tone?: "green" | "red" | "neutral" | "amber";
}) {
  const color =
    tone === "green"
      ? "#187343"
      : tone === "red"
        ? "#b54c3b"
        : tone === "amber"
          ? "#986300"
          : "#454b53";
  const background =
    tone === "green"
      ? "#e7f5ec"
      : tone === "red"
        ? "#fff0ed"
        : tone === "amber"
          ? "#fff4dd"
          : "#f0f2f4";
  return (
    <div className="card finwise-metric">
      <div className="finwise-metric-top">
        <span className="metric-label">{title}</span>
        <span className="finwise-metric-icon" style={{ color, background }}>
          {icon}
        </span>
      </div>
      <div className="metric-value" style={{ color }}>
        {value}
      </div>
      <div className="metric-foot">{foot}</div>
    </div>
  );
}

function formatDate(
  value: string | undefined,
  options?: Intl.DateTimeFormatOptions,
) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(
    "id-ID",
    options ?? { day: "2-digit", month: "short", year: "numeric" },
  );
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
}

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    income: "Pemasukan",
    expense: "Pengeluaran",
    transfer: "Transfer",
    refund: "Refund",
    asset_purchase: "Pembelian aset",
    debt_payment: "Pembayaran utang",
    receivable_payment: "Pembayaran piutang",
    reimburse_payment: "Pembayaran reimburse",
    adjustment: "Penyesuaian",
  };
  return labels[type] ?? type;
}

export default function DashboardPage() {
  const {
    transactions,
    ledgerEntries,
    ready,
    refresh: refreshTransactions,
  } = useLocalTransactions();
  const { records: accounts, ready: accountsReady } =
    useLocalRecords("accounts");
  const { records: budgets } = useLocalRecords("budgets");
  const { records: assets } = useLocalRecords("assets");
  const { records: debts } = useLocalRecords("debts");
  const { records: goals } = useLocalRecords("goals");
  const { records: schedules } = useLocalRecords("schedules");
  const { records: valuations } = useLocalRecords("valuations");
  const [privacy, setPrivacy] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const [cloudVersion, setCloudVersion] = useState<number | null>(null);
  const [syncConflict, setSyncConflict] = useState(false);
  const [backupTimestamp, setBackupTimestamp] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let mounted = true;
    const readSettings = async () => {
      if (!localDB) {
        if (mounted) setSettingsReady(true);
        return;
      }
      try {
        const [privacySetting, versionSetting, conflictSetting, backupSetting] =
          await Promise.all([
            localDB.settings.get("privacy"),
            localDB.settings.get("cloudVersion"),
            localDB.settings.get("syncConflict"),
            localDB.settings.get("lastBackupAt"),
          ]);
        if (!mounted) return;
        setPrivacy(Boolean(privacySetting?.value));
        setCloudVersion(versionSetting ? Number(versionSetting.value) : null);
        setSyncConflict(Boolean(conflictSetting?.value));
        setBackupTimestamp(
          typeof backupSetting?.value === "string" ? backupSetting.value : null,
        );
      } finally {
        if (mounted) setSettingsReady(true);
      }
    };
    void readSettings();
    const updateOnline = () =>
      setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      mounted = false;
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  const now = new Date();
  const currentMonth = monthKey(now);
  const monthLabel = now.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
  const money = (value: number) =>
    privacy ? "••••••" : formatIDR(Number.isFinite(value) ? value : 0);
  const allTransactions = useMemo(
    () => transactions.filter((t) => !t.deletedAt),
    [transactions],
  );
  const reportTransactions = useMemo(
    () => allTransactions.filter((t) => !t.excludedFromReports),
    [allTransactions],
  );

  const monthlyTrend = useMemo(() => {
    return Array.from({ length: 6 }, (_, index) => {
      const date = addMonths(
        new Date(`${currentMonth}-01T12:00:00`),
        index - 5,
      );
      const key = monthKey(date);
      const month = reportTransactions.filter(
        (t) => t.date.slice(0, 7) === key,
      );
      const income = month
        .filter((t) => ["income", "receivable_payment"].includes(t.type))
        .reduce(
          (sum, t) =>
            sum +
            (t.type === "receivable_payment"
              ? (t.incomeAmount ?? t.amount)
              : t.amount),
          0,
        );
      const grossExpenses = month
        .filter((t) =>
          ["expense", "asset_purchase", "debt_payment"].includes(t.type),
        )
        .reduce(
          (sum, t) =>
            sum +
            (t.type === "debt_payment"
              ? (t.expenseAmount ?? t.amount)
              : t.amount),
          0,
        );
      const refunds = month
        .filter((t) => t.type === "refund")
        .reduce((sum, t) => sum + t.amount, 0);
      const expenses = Math.max(0, grossExpenses - refunds);
      const cashOut = month
        .filter(
          (t) =>
            [
              "expense",
              "asset_purchase",
              "debt_payment",
              "reimburse_payment",
            ].includes(t.type) && !t.partnerPaid,
        )
        .reduce((sum, t) => sum + t.amount, 0);
      const cashIn = month
        .filter((t) =>
          ["income", "receivable_payment", "refund"].includes(t.type),
        )
        .reduce((sum, t) => sum + t.amount, 0);
      return {
        key,
        label: date.toLocaleDateString("id-ID", { month: "short" }),
        income,
        expenses,
        cashFlow: cashIn - cashOut,
        count: month.length,
      };
    });
  }, [reportTransactions, currentMonth]); // currentMonth intentionally refreshes month boundaries

  const currentStats = useMemo(() => {
    const month = reportTransactions.filter(
      (t) => t.date.slice(0, 7) === currentMonth,
    );
    const income = month
      .filter((t) => ["income", "receivable_payment"].includes(t.type))
      .reduce(
        (sum, t) =>
          sum +
          (t.type === "receivable_payment"
            ? (t.incomeAmount ?? t.amount)
            : t.amount),
        0,
      );
    const gross = month
      .filter((t) =>
        ["expense", "asset_purchase", "debt_payment"].includes(t.type),
      )
      .reduce(
        (sum, t) =>
          sum +
          (t.type === "debt_payment"
            ? (t.expenseAmount ?? t.amount)
            : t.amount),
        0,
      );
    const refunds = month
      .filter((t) => t.type === "refund")
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = Math.max(0, gross - refunds);
    const cashIn = month
      .filter((t) =>
        ["income", "receivable_payment", "refund"].includes(t.type),
      )
      .reduce((sum, t) => sum + t.amount, 0);
    const cashOut = month
      .filter(
        (t) =>
          [
            "expense",
            "asset_purchase",
            "debt_payment",
            "reimburse_payment",
          ].includes(t.type) && !t.partnerPaid,
      )
      .reduce((sum, t) => sum + t.amount, 0);
    const savingsRate =
      income > 0 ? ((income - expenses) / income) * 100 : null;
    return {
      month,
      income,
      expenses,
      cashFlow: cashIn - cashOut,
      savingsRate,
      refunds,
    };
  }, [reportTransactions, currentMonth]);

  const balances = useMemo(
    () => accountBalances(accounts, allTransactions as any, ledgerEntries),
    [accounts, allTransactions, ledgerEntries],
  );
  const liquidBalance = balances.reduce(
    (sum, account) => sum + account.balance,
    0,
  );
  const assetsTotal = assets.reduce(
    (sum, asset) => sum + Number(asset.data.currentValue || 0),
    0,
  );
  const debtTotal = debts.reduce(
    (sum, debt) => sum + Number(debt.data.outstanding || 0),
    0,
  );
  const receivableTotal = debts
    .filter((debt) => String(debt.data.type || "").toLowerCase() === "piutang")
    .reduce((sum, debt) => sum + Number(debt.data.outstanding || 0), 0);
  const payableTotal = debtTotal - receivableTotal;
  const netWorth = localNetWorth(
    accounts,
    assets,
    debts,
    allTransactions as any,
    ledgerEntries,
  );
  const goalsSummary = goals.reduce(
    (sum, goal) => {
      const target = Math.max(0, Number(goal.data.target || 0));
      const allocated = Math.max(0, Number(goal.data.allocated || 0));
      return {
        target: sum.target + target,
        allocated: sum.allocated + allocated,
        remaining: sum.remaining + Math.max(0, target - allocated),
      };
    },
    { target: 0, allocated: 0, remaining: 0 },
  );

  const budgetInfo = useMemo(
    () =>
      budgets.map((budget) => {
        const category = String(budget.data.category || budget.name);
        const matched = reportTransactions.filter(
          (t) => t.date.slice(0, 7) === currentMonth,
        );
        const spent =
          matched
            .filter((t) =>
              ["expense", "asset_purchase", "debt_payment"].includes(t.type),
            )
            .reduce(
              (sum, t) => sum + transactionCategoryAmount(t, category),
              0,
            ) -
          matched
            .filter((t) => t.type === "refund")
            .reduce(
              (sum, t) => sum + transactionCategoryAmount(t, category),
              0,
            );
        const limit = Math.max(0, Number(budget.data.limit || 0));
        const used = Math.max(0, spent);
        return {
          ...budget,
          category,
          spent: used,
          limit,
          remaining: limit - used,
          percent: limit > 0 ? (used / limit) * 100 : 0,
        };
      }),
    [budgets, reportTransactions, currentMonth],
  );

  const categoryBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    for (const transaction of currentStats.month) {
      if (
        !["expense", "asset_purchase", "debt_payment"].includes(
          transaction.type,
        )
      )
        continue;
      const lines = transaction.splitLines?.length
        ? transaction.splitLines
        : [
            {
              category: transaction.category,
              amount:
                transaction.type === "debt_payment" &&
                transaction.expenseAmount !== undefined
                  ? transaction.expenseAmount
                  : transaction.amount,
            },
          ];
      for (const line of lines)
        totals.set(
          line.category || "Tanpa kategori",
          (totals.get(line.category || "Tanpa kategori") ?? 0) +
            Number(line.amount || 0),
        );
    }
    for (const transaction of currentStats.month.filter(
      (t) => t.type === "refund",
    )) {
      const key = transaction.category || "Tanpa kategori";
      totals.set(key, Math.max(0, (totals.get(key) ?? 0) - transaction.amount));
    }
    return [...totals.entries()]
      .map(([category, amount]) => ({ category, amount: Math.max(0, amount) }))
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [currentStats.month]);

  const scheduleInfo = useMemo(() => {
    const today = new Date();
    const startToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      12,
    );
    return schedules
      .filter(
        (record) =>
          !record.archivedAt &&
          String(record.data.active || "Aktif") !== "Jeda" &&
          Boolean(record.data.nextDate),
      )
      .map((record) => {
        const dueDate = new Date(
          `${String(record.data.nextDate).slice(0, 10)}T12:00:00`,
        );
        const days = Math.ceil(
          (dueDate.getTime() - startToday.getTime()) / 86400000,
        );
        return {
          ...record,
          dueDate,
          days,
          amount: Math.max(0, Number(record.data.amount || 0)),
        };
      })
      .filter((record) => record.days >= 0 && record.days <= 30)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [schedules]);

  const recurring = useMemo(
    () =>
      schedules
        .filter(
          (record) =>
            !record.archivedAt &&
            String(record.data.active || "Aktif") !== "Jeda",
        )
        .sort((a, b) =>
          String(a.data.nextDate || "").localeCompare(
            String(b.data.nextDate || ""),
          ),
        )
        .slice(0, 6),
    [schedules],
  );

  const reviewItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      detail: string;
      amount?: number;
      tone: "red" | "amber" | "neutral";
    }> = [];
    for (const t of reportTransactions) {
      if (t.amount >= 1_000_000)
        items.push({
          id: `large-${t.id}`,
          title: t.description || "Transaksi nominal besar",
          detail: `Nominal tinggi · ${formatDate(t.date)}`,
          amount: t.amount,
          tone: "amber",
        });
      if (t.reimburseStatus === "pending")
        items.push({
          id: `reimburse-${t.id}`,
          title: t.description || "Reimburse",
          detail: "Menunggu reimburse",
          amount: t.amount,
          tone: "amber",
        });
      if (
        !String(t.category || "").trim() ||
        /^(lainnya|uncategorized|tanpa kategori)$/i.test(t.category)
      )
        items.push({
          id: `category-${t.id}`,
          title: t.description || "Transaksi",
          detail: "Kategori perlu diperiksa",
          amount: t.amount,
          tone: "neutral",
        });
      if (t.syncStatus === "conflict")
        items.push({
          id: `conflict-${t.id}`,
          title: t.description || "Transaksi",
          detail: "Konflik sinkronisasi",
          amount: t.amount,
          tone: "red",
        });
    }
    const seen = new Set<string>();
    return items
      .filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)))
      .slice(0, 8);
  }, [reportTransactions]);

  const recentTransactions = useMemo(
    () =>
      [...allTransactions]
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            b.createdAt.localeCompare(a.createdAt),
        )
        .slice(0, 6),
    [allTransactions],
  );

  const pendingSync = allTransactions.filter(
    (t) => t.syncStatus === "pending",
  ).length;
  const conflictCount = allTransactions.filter(
    (t) => t.syncStatus === "conflict",
  ).length;
  const topMonthlyValue = Math.max(
    1,
    ...monthlyTrend.flatMap((month) => [month.income, month.expenses]),
  );
  const maxCategory = Math.max(
    1,
    ...categoryBreakdown.map((item) => item.amount),
  );
  const upcomingTotal = scheduleInfo.reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  const topBudgetItems = [...budgetInfo]
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 6);
  const savingsPositive =
    currentStats.income > 0 && currentStats.income - currentStats.expenses >= 0;
  const valuationHistory = [...valuations]
    .filter(
      (v) =>
        !v.archivedAt && v.data.date && Number.isFinite(Number(v.data.value)),
    )
    .sort((a, b) => String(a.data.date).localeCompare(String(b.data.date)))
    .slice(-6);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshTransactions();
      if (localDB) {
        const [versionSetting, conflictSetting, backupSetting] =
          await Promise.all([
            localDB.settings.get("cloudVersion"),
            localDB.settings.get("syncConflict"),
            localDB.settings.get("lastBackupAt"),
          ]);
        setCloudVersion(versionSetting ? Number(versionSetting.value) : null);
        setSyncConflict(Boolean(conflictSetting?.value));
        setBackupTimestamp(
          typeof backupSetting?.value === "string" ? backupSetting.value : null,
        );
      }
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="finwise-dashboard">
      <style jsx global>{`
        .finwise-dashboard {
          min-width: 0;
          color: #252a2e;
        }
        .finwise-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
        }
        .finwise-heading h1 {
          margin: 0 0 7px;
          font-size: clamp(23px, 2.2vw, 30px);
          letter-spacing: -0.8px;
          line-height: 1.15;
        }
        .finwise-eyebrow {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #7d858d;
          font-size: 11px;
          margin-bottom: 9px;
        }
        .finwise-heading-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .finwise-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 12px;
        }
        .finwise-metrics-compact .finwise-metric {
          padding: 13px 14px;
        }
        .finwise-metrics-compact .finwise-metric-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
        }
        .finwise-metrics-compact .metric-value {
          font-size: clamp(17px, 1.6vw, 22px);
          margin-top: 9px;
        }
        .finwise-metrics-compact .metric-foot {
          margin-top: 4px;
        }
        .finwise-more {
          margin-top: 14px;
          padding: 0;
          overflow: hidden;
        }
        .finwise-more > summary {
          list-style: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 15px 17px;
          cursor: pointer;
        }
        .finwise-more > summary::-webkit-details-marker {
          display: none;
        }
        .finwise-more-content {
          padding: 0 14px 14px;
        }
        .finwise-more-content > .finwise-two-col:first-child {
          margin-top: 0;
        }
        .finwise-metric {
          padding: 16px;
          min-width: 0;
        }
        .finwise-metric-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }
        .finwise-metric-icon {
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          flex: 0 0 auto;
        }
        .finwise-panel {
          padding: 0;
          overflow: hidden;
        }
        .finwise-panel-summary {
          list-style: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 17px 18px;
          cursor: pointer;
          user-select: none;
        }
        .finwise-panel-summary::-webkit-details-marker {
          display: none;
        }
        .finwise-panel-heading {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .finwise-panel-icon {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: #f1f4f2;
          color: #326548;
          flex: 0 0 auto;
        }
        .finwise-panel-title-wrap {
          display: grid;
          gap: 3px;
          min-width: 0;
        }
        .finwise-panel-title-wrap strong {
          font-size: 14px;
        }
        .finwise-panel-title-wrap small {
          color: #777f87;
          font-size: 11px;
          line-height: 1.4;
        }
        .finwise-panel-content {
          padding: 0 18px 18px;
          min-width: 0;
        }
        .finwise-chevron {
          color: #7d858d;
          transition: transform 0.18s ease;
          flex: 0 0 auto;
        }
        details[open] > .finwise-panel-summary .finwise-chevron {
          transform: rotate(180deg);
        }
        .finwise-two-col {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
          gap: 12px;
          margin-top: 12px;
        }
        .finwise-three-col {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-top: 14px;
        }
        .finwise-inner-card {
          border: 1px solid #edf0ed;
          border-radius: 12px;
          padding: 13px;
          min-width: 0;
        }
        .finwise-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          min-width: 0;
        }
        .finwise-list {
          display: grid;
          gap: 12px;
        }
        .finwise-list-row {
          display: grid;
          gap: 7px;
        }
        .finwise-muted {
          color: #7a828a;
          font-size: 11px;
          line-height: 1.5;
        }
        .finwise-strong {
          font-size: 13px;
          font-weight: 750;
          overflow-wrap: anywhere;
        }
        .finwise-small {
          font-size: 11px;
        }
        .finwise-empty {
          padding: 22px 12px;
          border: 1px dashed #e2e7e3;
          border-radius: 11px;
          color: #7a828a;
          text-align: center;
          font-size: 12px;
          line-height: 1.6;
        }
        .finwise-bars {
          display: grid;
          gap: 12px;
        }
        .finwise-month-chart {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          align-items: end;
          gap: 8px;
          min-height: 145px;
          padding-top: 5px;
        }
        .finwise-month-column {
          display: grid;
          grid-template-rows: 100px auto;
          gap: 7px;
          min-width: 0;
          text-align: center;
        }
        .finwise-bar-pair {
          display: flex;
          align-items: end;
          justify-content: center;
          gap: 4px;
          height: 100px;
          border-bottom: 1px solid #e8ece8;
          padding: 0 3px;
        }
        .finwise-bar {
          display: block;
          width: min(15px, 35%);
          min-height: 2px;
          border-radius: 4px 4px 0 0;
        }
        .finwise-month-label {
          color: #777f87;
          font-size: 10px;
          text-transform: capitalize;
        }
        .finwise-legend {
          display: flex;
          gap: 13px;
          flex-wrap: wrap;
          margin-bottom: 10px;
          color: #737982;
          font-size: 11px;
        }
        .finwise-legend span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .finwise-dot {
          width: 8px;
          height: 8px;
          border-radius: 3px;
          display: inline-block;
        }
        .finwise-account-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 11px 0;
          border-bottom: 1px solid #eff1ef;
        }
        .finwise-account-row:last-child {
          border-bottom: 0;
        }
        .finwise-account-name {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
        }
        .finwise-account-symbol {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          background: #f2f4f3;
          color: #58645d;
          border-radius: 10px;
          flex: 0 0 auto;
        }
        .finwise-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .finwise-table th {
          text-align: left;
          color: #858b94;
          font-size: 10px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          padding: 10px 8px;
          border-bottom: 1px solid #eff0f2;
        }
        .finwise-table td {
          padding: 12px 8px;
          border-bottom: 1px solid #eff0f2;
          vertical-align: top;
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .finwise-table tr:last-child td {
          border-bottom: 0;
        }
        .finwise-pill {
          display: inline-flex;
          padding: 4px 7px;
          border-radius: 99px;
          background: #f1f3f2;
          color: #5e6660;
          font-size: 10px;
          font-weight: 700;
        }
        .finwise-pill.green {
          background: #e7f5ec;
          color: #187343;
        }
        .finwise-pill.amber {
          background: #fff4dd;
          color: #986300;
        }
        .finwise-pill.red {
          background: #fff0ed;
          color: #b54c3b;
        }
        .finwise-action-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 9px;
        }
        .finwise-action {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
          padding: 12px;
          border: 1px solid #e7e9ed;
          border-radius: 11px;
          color: #343a36;
          background: #fff;
          text-decoration: none;
          font-size: 11px;
          font-weight: 700;
        }
        .finwise-action:hover {
          background: #f7faf8;
          border-color: #d2dfd6;
        }
        .finwise-action-icon {
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          border-radius: 9px;
          background: #edf5ef;
          color: #176b43;
          flex: 0 0 auto;
        }
        .finwise-status-card {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px;
          border-radius: 11px;
          border: 1px solid #e9ece9;
          min-width: 0;
        }
        .finwise-status-card p {
          margin: 4px 0 0;
          font-size: 11px;
          color: #777f87;
          line-height: 1.5;
        }
        @media (max-width: 1100px) {
          .finwise-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .finwise-two-col {
            grid-template-columns: 1fr;
          }
          .finwise-three-col {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .finwise-action-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 760px) {
          .finwise-heading {
            flex-direction: column;
          }
          .finwise-heading-actions {
            width: 100%;
          }
          .finwise-heading-actions a,
          .finwise-heading-actions button {
            flex: 1;
          }
          .finwise-metrics {
            gap: 8px;
          }
          .finwise-metrics-compact .finwise-metric {
            padding: 10px;
          }
          .finwise-metrics-compact .metric-value {
            font-size: clamp(14px, 4vw, 18px);
          }
          .finwise-more > summary {
            padding: 13px 12px;
          }
          .finwise-more-content {
            padding: 0 10px 10px;
          }
          .finwise-metric {
            padding: 12px;
          }
          .finwise-metric .metric-value {
            font-size: clamp(15px, 4.4vw, 20px);
            letter-spacing: -0.5px;
            overflow-wrap: anywhere;
          }
          .finwise-metric .metric-label {
            font-size: 10px;
          }
          .finwise-metric .metric-foot {
            font-size: 10px;
            line-height: 1.4;
          }
          .finwise-panel-summary {
            padding: 14px 12px;
          }
          .finwise-panel-content {
            padding: 0 12px 13px;
          }
          .finwise-panel-title-wrap small {
            font-size: 10px;
          }
          .finwise-three-col {
            grid-template-columns: 1fr;
          }
          .finwise-month-chart {
            gap: 4px;
          }
          .finwise-bar-pair {
            gap: 2px;
            padding: 0 1px;
          }
          .finwise-bar {
            width: 35%;
          }
          .finwise-table,
          .finwise-table tbody {
            display: block;
            width: 100%;
          }
          .finwise-table thead {
            display: none;
          }
          .finwise-table tbody {
            display: grid;
            gap: 9px;
          }
          .finwise-table tr {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            gap: 0 10px;
            border: 1px solid #edf0ed;
            border-radius: 10px;
            padding: 7px 10px;
          }
          .finwise-table td {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 7px;
            padding: 8px 0;
            font-size: 11px;
          }
          .finwise-table td::before {
            content: attr(data-label);
            color: #7a828a;
            font-size: 10px;
            font-weight: 700;
            flex: 0 0 auto;
            max-width: 45%;
          }
          .finwise-table td:first-child {
            grid-column: 1/-1;
          }
          .finwise-action-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .finwise-action {
            padding: 10px 8px;
            font-size: 10px;
          }
          .finwise-action-icon {
            width: 27px;
            height: 27px;
          }
        }
      `}</style>

      <div className="finwise-heading">
        <div>
          <div className="finwise-eyebrow">
            <CalendarDays size={13} />
            {monthLabel}
            <span className="finwise-pill">Offline-first</span>
          </div>
          <h1>Ringkasan keuangan</h1>
          <div className="muted">
            Gambaran singkat kondisi keuangan bulan ini.
          </div>
        </div>
        <div className="finwise-heading-actions">
          <button
            className="secondary-btn"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
          >
            <RefreshCw size={14} className={refreshing ? "finwise-spin" : ""} />
            {refreshing ? "Memuat…" : "Refresh data"}
          </button>
          <Link className="primary-btn" href="/transactions">
            <CirclePlus size={15} /> Tambah transaksi
          </Link>
        </div>
      </div>

      <div className="finwise-metrics finwise-metrics-compact">
        <Metric
          title="Pemasukan"
          value={money(currentStats.income)}
          icon={<ArrowDownLeft size={16} />}
          foot="Bulan ini"
          tone="green"
        />
        <Metric
          title="Pengeluaran"
          value={money(currentStats.expenses)}
          icon={<ArrowUpRight size={16} />}
          foot="Setelah refund"
          tone="red"
        />
        <Metric
          title="Net cashflow"
          value={money(currentStats.cashFlow)}
          icon={<Activity size={16} />}
          foot="Bulan ini"
          tone={currentStats.cashFlow >= 0 ? "green" : "red"}
        />
        <Metric
          title="Saldo likuid"
          value={money(liquidBalance)}
          icon={<Wallet size={16} />}
          foot={`${balances.length} akun aktif`}
          tone={liquidBalance >= 0 ? "green" : "red"}
        />
      </div>

      <Panel
        id="quick-actions"
        title="Akses cepat"
        subtitle="Transaksi, rekening, budget, dan pengaturan"
        icon={<Zap size={16} />}
        defaultOpen={false}
      >
        <div className="finwise-action-grid">
          <Link className="finwise-action" href="/transactions">
            <span className="finwise-action-icon">
              <CirclePlus size={15} />
            </span>
            Tambah transaksi
          </Link>
          <Link className="finwise-action" href="/accounts">
            <span className="finwise-action-icon">
              <Landmark size={15} />
            </span>
            Kelola rekening
          </Link>
          <Link className="finwise-action" href="/budgets">
            <span className="finwise-action-icon">
              <Target size={15} />
            </span>
            Kelola budget
          </Link>
          <Link className="finwise-action" href="/goals">
            <span className="finwise-action-icon">
              <Goal size={15} />
            </span>
            Target tabungan
          </Link>
          <Link className="finwise-action" href="/schedules">
            <span className="finwise-action-icon">
              <CalendarClock size={15} />
            </span>
            Jadwal tagihan
          </Link>
          <Link className="finwise-action" href="/reports">
            <span className="finwise-action-icon">
              <Activity size={15} />
            </span>
            Laporan & analitik
          </Link>
          <Link className="finwise-action" href="/import-export">
            <span className="finwise-action-icon">
              <Archive size={15} />
            </span>
            Impor / ekspor
          </Link>
          <Link className="finwise-action" href="/settings">
            <span className="finwise-action-icon">
              <Database size={15} />
            </span>
            Backup & pengaturan
          </Link>
        </div>
      </Panel>

      <div className="finwise-two-col">
        <Panel
          id="cashflow-trend"
          title="Tren keuangan 6 bulan"
          subtitle="Pemasukan dibanding pengeluaran per bulan"
          icon={<Activity size={17} />}
          defaultOpen
        >
          <div className="finwise-legend">
            <span>
              <i className="finwise-dot" style={{ background: "#278253" }} />{" "}
              Pemasukan
            </span>
            <span>
              <i className="finwise-dot" style={{ background: "#d17b68" }} />{" "}
              Pengeluaran bersih
            </span>
          </div>
          {monthlyTrend.every(
            (month) => month.income === 0 && month.expenses === 0,
          ) ? (
            <EmptyState>
              Belum ada data transaksi untuk menampilkan tren.
            </EmptyState>
          ) : (
            <div className="finwise-month-chart">
              {monthlyTrend.map((month) => (
                <div
                  className="finwise-month-column"
                  key={month.key}
                  title={`${month.label}: pemasukan ${money(month.income)}, pengeluaran ${money(month.expenses)}`}
                >
                  <div className="finwise-bar-pair">
                    <span
                      className="finwise-bar"
                      style={{
                        height: `${Math.max(month.income > 0 ? 3 : 0, (month.income / topMonthlyValue) * 100)}%`,
                        background: "#278253",
                      }}
                    />
                    <span
                      className="finwise-bar"
                      style={{
                        height: `${Math.max(month.expenses > 0 ? 3 : 0, (month.expenses / topMonthlyValue) * 100)}%`,
                        background: "#d17b68",
                      }}
                    />
                  </div>
                  <div>
                    <div className="finwise-month-label">{month.label}</div>
                    <div className="finwise-muted">{money(month.cashFlow)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="finwise-muted" style={{ marginTop: 10 }}>
            Angka di bawah grafik adalah net cashflow tiap bulan. Transfer
            antar-rekening tidak dihitung sebagai pemasukan atau pengeluaran.
          </div>
        </Panel>

        <Panel
          id="spending-breakdown"
          title="Pengeluaran berdasarkan kategori"
          subtitle={`Bulan ${monthLabel}`}
          icon={<TrendingDown size={17} />}
          count={categoryBreakdown.length}
          defaultOpen
        >
          {categoryBreakdown.length === 0 ? (
            <EmptyState>
              Belum ada pengeluaran berkategori pada bulan ini.
            </EmptyState>
          ) : (
            <div className="finwise-bars">
              {categoryBreakdown.map((item) => (
                <div className="finwise-list-row" key={item.category}>
                  <div className="finwise-row">
                    <span className="finwise-small" style={{ fontWeight: 650 }}>
                      {item.category}
                    </span>
                    <strong className="finwise-small">
                      {money(item.amount)}
                    </strong>
                  </div>
                  <ProgressBar
                    value={(item.amount / maxCategory) * 100}
                    color="#55846a"
                  />
                  <div className="finwise-muted">
                    {currentStats.expenses > 0
                      ? `${((item.amount / currentStats.expenses) * 100).toFixed(1)}% dari pengeluaran bersih`
                      : "—"}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link
            href="/reports"
            className="secondary-btn"
            style={{ marginTop: 15 }}
          >
            Lihat analitik <ChevronRight size={14} />
          </Link>
        </Panel>
      </div>

      <details className="card finwise-more" id="more-financial-details">
        <summary>
          <span className="finwise-panel-heading">
            <span className="finwise-panel-icon">
              <ChevronDown size={16} />
            </span>
            <span className="finwise-panel-title-wrap">
              <strong>Detail keuangan lainnya</strong>
              <small>
                Saldo rekening, budget, tagihan, target, transaksi, dan status
                data
              </small>
            </span>
          </span>
          <ChevronDown className="finwise-chevron" size={17} />
        </summary>
        <div className="finwise-more-content">
          <div className="finwise-two-col">
            <Panel
              id="cash-position"
              title="Saldo rekening & cash position"
              subtitle="Saldo dihitung dari saldo awal dan ledger transaksi"
              icon={<Wallet size={17} />}
              count={balances.length}
              defaultOpen
            >
              {!accountsReady || !ready ? (
                <EmptyState>Memuat saldo rekening…</EmptyState>
              ) : balances.length === 0 ? (
                <EmptyState>
                  Belum ada rekening.{" "}
                  <Link href="/accounts">Tambah rekening</Link>
                </EmptyState>
              ) : (
                <>
                  <div
                    className="finwise-inner-card"
                    style={{ marginBottom: 10 }}
                  >
                    <div className="finwise-muted">Total saldo likuid</div>
                    <div
                      style={{
                        fontSize: 23,
                        fontWeight: 800,
                        letterSpacing: "-.6px",
                        marginTop: 5,
                      }}
                    >
                      {money(liquidBalance)}
                    </div>
                    <div className="finwise-muted" style={{ marginTop: 5 }}>
                      Saldo awal akun ditambah mutasi ledger yang tercatat.
                    </div>
                  </div>
                  {balances.map((account) => (
                    <div className="finwise-account-row" key={account.id}>
                      <div className="finwise-account-name">
                        <span className="finwise-account-symbol">
                          {/cash|tunai/i.test(account.type) ? (
                            <Banknote size={16} />
                          ) : (
                            <Landmark size={16} />
                          )}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div className="finwise-strong">{account.name}</div>
                          <div className="finwise-muted">
                            {account.type} · saldo awal{" "}
                            {money(account.openingBalance)}
                          </div>
                        </div>
                      </div>
                      <strong
                        style={{
                          color: account.balance < 0 ? "#b54c3b" : "#30343a",
                          fontSize: 12,
                          textAlign: "right",
                        }}
                      >
                        {money(account.balance)}
                      </strong>
                    </div>
                  ))}
                  <Link
                    href="/accounts"
                    className="secondary-btn"
                    style={{ marginTop: 13 }}
                  >
                    Kelola rekening <ChevronRight size={14} />
                  </Link>
                </>
              )}
            </Panel>

            <Panel
              id="budget-control"
              title="Budget control center"
              subtitle="Pemakaian anggaran bulan ini"
              icon={<Gauge size={17} />}
              count={budgetInfo.length}
              defaultOpen
            >
              {budgetInfo.length === 0 ? (
                <EmptyState>
                  Belum ada budget yang dibuat. <br />
                  <Link href="/budgets">Buat budget pertama</Link>
                </EmptyState>
              ) : (
                <div className="finwise-list">
                  {topBudgetItems.map((budget) => {
                    const tone =
                      budget.percent >= 100
                        ? "red"
                        : budget.percent >= 90
                          ? "amber"
                          : "green";
                    const color =
                      tone === "red"
                        ? "#b54c3b"
                        : tone === "amber"
                          ? "#b57c24"
                          : "#287b50";
                    return (
                      <div className="finwise-list-row" key={budget.id}>
                        <div className="finwise-row">
                          <div style={{ minWidth: 0 }}>
                            <div className="finwise-strong">
                              {budget.category}
                            </div>
                            <div className="finwise-muted">
                              {money(budget.spent)} dari {money(budget.limit)}
                            </div>
                          </div>
                          <span className={`finwise-pill ${tone}`}>
                            {Math.round(budget.percent)}%
                          </span>
                        </div>
                        <ProgressBar value={budget.percent} color={color} />
                        <div className="finwise-row">
                          <span className="finwise-muted">
                            {budget.remaining >= 0
                              ? "Sisa budget"
                              : "Melebihi budget"}
                          </span>
                          <strong
                            className="finwise-small"
                            style={{
                              color:
                                budget.remaining < 0 ? "#b54c3b" : "#454b53",
                            }}
                          >
                            {money(Math.abs(budget.remaining))}
                          </strong>
                        </div>
                      </div>
                    );
                  })}
                  <Link
                    href="/budgets"
                    className="secondary-btn"
                    style={{ marginTop: 2 }}
                  >
                    Lihat semua budget <ChevronRight size={14} />
                  </Link>
                </div>
              )}
            </Panel>
          </div>

          <div className="finwise-two-col">
            <Panel
              id="upcoming-payments"
              title="Tagihan mendatang"
              subtitle="Jadwal aktif dalam 30 hari ke depan"
              icon={<CalendarClock size={17} />}
              count={scheduleInfo.length}
              defaultOpen
            >
              {scheduleInfo.length === 0 ? (
                <EmptyState>
                  Tidak ada jadwal aktif yang jatuh tempo dalam 30 hari ke
                  depan. <br />
                  <Link href="/schedules">Kelola jadwal</Link>
                </EmptyState>
              ) : (
                <>
                  <div
                    className="finwise-inner-card"
                    style={{ marginBottom: 10 }}
                  >
                    <div className="finwise-muted">
                      Total nominal jadwal dalam 30 hari
                    </div>
                    <div
                      style={{ fontSize: 21, fontWeight: 800, marginTop: 5 }}
                    >
                      {money(upcomingTotal)}
                    </div>
                  </div>
                  <div className="finwise-list">
                    {scheduleInfo.slice(0, 6).map((item) => (
                      <div className="finwise-account-row" key={item.id}>
                        <div style={{ minWidth: 0 }}>
                          <div className="finwise-strong">{item.name}</div>
                          <div className="finwise-muted">
                            {String(
                              item.data.type || item.data.category || "Jadwal",
                            )}{" "}
                            · {formatDate(String(item.data.nextDate || ""))}
                          </div>
                          <div className="finwise-muted">
                            {item.days === 0
                              ? "Jatuh tempo hari ini"
                              : `${item.days} hari lagi`}
                          </div>
                        </div>
                        <strong className="finwise-small">
                          {money(item.amount)}
                        </strong>
                      </div>
                    ))}
                  </div>
                  <Link
                    href="/schedules"
                    className="secondary-btn"
                    style={{ marginTop: 13 }}
                  >
                    Buka semua jadwal <ChevronRight size={14} />
                  </Link>
                </>
              )}
            </Panel>

            <Panel
              id="goals"
              title="Target tabungan"
              subtitle="Alokasi dibanding target yang ditentukan"
              icon={<Goal size={17} />}
              count={goals.length}
              defaultOpen
            >
              {goals.length === 0 ? (
                <EmptyState>
                  Belum ada target tabungan. <br />
                  <Link href="/goals">Buat target</Link>
                </EmptyState>
              ) : (
                <>
                  <div
                    className="finwise-inner-card"
                    style={{ marginBottom: 12 }}
                  >
                    <div className="finwise-muted">Total alokasi target</div>
                    <div
                      style={{ fontSize: 21, fontWeight: 800, marginTop: 5 }}
                    >
                      {money(goalsSummary.allocated)}{" "}
                      <span className="finwise-muted">
                        / {money(goalsSummary.target)}
                      </span>
                    </div>
                    <ProgressBar
                      value={
                        goalsSummary.target > 0
                          ? (goalsSummary.allocated / goalsSummary.target) * 100
                          : 0
                      }
                      color="#55846a"
                    />
                    <div className="finwise-muted" style={{ marginTop: 7 }}>
                      Sisa target {money(goalsSummary.remaining)}
                    </div>
                  </div>
                  <div className="finwise-list">
                    {goals.slice(0, 6).map((goal) => {
                      const target = Math.max(0, Number(goal.data.target || 0));
                      const allocated = Math.max(
                        0,
                        Number(goal.data.allocated || 0),
                      );
                      const percent =
                        target > 0 ? (allocated / target) * 100 : 0;
                      return (
                        <div className="finwise-list-row" key={goal.id}>
                          <div className="finwise-row">
                            <span className="finwise-strong">{goal.name}</span>
                            <span className="finwise-small">
                              {Math.round(percent)}%
                            </span>
                          </div>
                          <ProgressBar value={percent} color="#55846a" />
                          <div className="finwise-muted">
                            {money(allocated)} terkumpul · sisa{" "}
                            {money(Math.max(0, target - allocated))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Link
                    href="/goals"
                    className="secondary-btn"
                    style={{ marginTop: 13 }}
                  >
                    Kelola target <ChevronRight size={14} />
                  </Link>
                </>
              )}
            </Panel>
          </div>

          <div className="finwise-two-col">
            <Panel
              id="net-worth"
              title="Net worth & aset"
              subtitle="Snapshot berdasarkan nilai aset dan kewajiban yang tersimpan"
              icon={<PiggyBank size={17} />}
              defaultOpen
            >
              <div className="finwise-inner-card" style={{ marginBottom: 12 }}>
                <div className="finwise-muted">Kekayaan bersih saat ini</div>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 850,
                    letterSpacing: "-.8px",
                    marginTop: 5,
                    color: netWorth >= 0 ? "#187343" : "#b54c3b",
                  }}
                >
                  {money(netWorth)}
                </div>
              </div>
              <div className="finwise-three-col" style={{ marginTop: 0 }}>
                <div className="finwise-inner-card">
                  <div className="finwise-muted">Uang likuid</div>
                  <div className="finwise-strong" style={{ marginTop: 6 }}>
                    {money(liquidBalance)}
                  </div>
                </div>
                <div className="finwise-inner-card">
                  <div className="finwise-muted">Aset tercatat</div>
                  <div className="finwise-strong" style={{ marginTop: 6 }}>
                    {money(assetsTotal)}
                  </div>
                </div>
                <div className="finwise-inner-card">
                  <div className="finwise-muted">Utang bersih</div>
                  <div className="finwise-strong" style={{ marginTop: 6 }}>
                    {money(payableTotal - receivableTotal)}
                  </div>
                </div>
              </div>
              {valuationHistory.length > 0 ? (
                <div style={{ marginTop: 14 }}>
                  <div className="finwise-strong" style={{ marginBottom: 8 }}>
                    Penilaian aset terbaru
                  </div>
                  {valuationHistory
                    .slice(-4)
                    .reverse()
                    .map((valuation) => (
                      <div className="finwise-account-row" key={valuation.id}>
                        <div>
                          <div className="finwise-strong">
                            {String(valuation.data.asset || valuation.name)}
                          </div>
                          <div className="finwise-muted">
                            {formatDate(String(valuation.data.date || ""))}
                          </div>
                        </div>
                        <strong className="finwise-small">
                          {money(Number(valuation.data.value || 0))}
                        </strong>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="finwise-muted" style={{ marginTop: 12 }}>
                  Riwayat nilai net worth belum tersedia. Angka ini adalah
                  snapshot nilai saat ini, bukan grafik historis.
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginTop: 13,
                }}
              >
                <Link href="/assets" className="secondary-btn">
                  Kelola aset <ChevronRight size={14} />
                </Link>
                <Link href="/debts" className="secondary-btn">
                  Kelola utang/piutang <ChevronRight size={14} />
                </Link>
              </div>
            </Panel>

            <Panel
              id="recurring"
              title="Recurring & subscription"
              subtitle="Jadwal rutin yang masih aktif"
              icon={<RefreshCw size={17} />}
              count={recurring.length}
              defaultOpen={false}
            >
              {recurring.length === 0 ? (
                <EmptyState>
                  Belum ada jadwal rutin yang tercatat. <br />
                  <Link href="/schedules">Tambah jadwal</Link>
                </EmptyState>
              ) : (
                <>
                  <div className="finwise-muted" style={{ marginBottom: 10 }}>
                    Data ini diambil dari modul Jadwal. Finwise belum
                    mengasumsikan langganan otomatis jika tidak ada jadwal yang
                    dicatat.
                  </div>
                  {recurring.map((item) => (
                    <div className="finwise-account-row" key={item.id}>
                      <div style={{ minWidth: 0 }}>
                        <div className="finwise-strong">{item.name}</div>
                        <div className="finwise-muted">
                          {String(
                            item.data.frequency || "Frekuensi belum diisi",
                          )}{" "}
                          · berikutnya{" "}
                          {formatDate(String(item.data.nextDate || ""))}
                        </div>
                        <div className="finwise-muted">
                          {String(
                            item.data.type || item.data.category || "Jadwal",
                          )}{" "}
                          · {String(item.data.active || "Aktif")}
                        </div>
                      </div>
                      <strong className="finwise-small">
                        {money(Number(item.data.amount || 0))}
                      </strong>
                    </div>
                  ))}
                  <Link
                    href="/schedules"
                    className="secondary-btn"
                    style={{ marginTop: 13 }}
                  >
                    Kelola jadwal rutin <ChevronRight size={14} />
                  </Link>
                </>
              )}
            </Panel>
          </div>

          <div className="finwise-two-col">
            <Panel
              id="recent-transactions"
              title="Transaksi terbaru"
              subtitle="Enam transaksi terakhir yang tercatat"
              icon={<History size={17} />}
              count={recentTransactions.length}
              defaultOpen
            >
              {!ready ? (
                <EmptyState>Memuat transaksi…</EmptyState>
              ) : recentTransactions.length === 0 ? (
                <EmptyState>
                  Belum ada transaksi. <br />
                  <Link href="/transactions">Catat transaksi pertama</Link>
                </EmptyState>
              ) : (
                <div style={{ overflowX: "auto", maxWidth: "100%" }}>
                  <table className="finwise-table">
                    <thead>
                      <tr>
                        <th>Transaksi</th>
                        <th>Tipe</th>
                        <th>Tanggal</th>
                        <th style={{ textAlign: "right" }}>Nominal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTransactions.map((transaction) => (
                        <tr key={transaction.id}>
                          <td data-label="Transaksi">
                            <div>
                              <div className="finwise-strong">
                                {transaction.description || "Transaksi"}
                              </div>
                              <div className="finwise-muted">
                                {transaction.category || "Tanpa kategori"} ·{" "}
                                {transaction.account || "Tanpa akun"}
                              </div>
                            </div>
                          </td>
                          <td data-label="Tipe">
                            <span
                              className={`finwise-pill ${["income", "refund", "receivable_payment"].includes(transaction.type) ? "green" : transaction.type === "transfer" ? "" : "red"}`}
                            >
                              {typeLabel(transaction.type)}
                            </span>
                          </td>
                          <td data-label="Tanggal">
                            {formatDate(transaction.date)}
                          </td>
                          <td
                            data-label="Nominal"
                            style={{
                              textAlign: "right",
                              fontWeight: 750,
                              color: [
                                "income",
                                "refund",
                                "receivable_payment",
                              ].includes(transaction.type)
                                ? "#187343"
                                : "#30343a",
                            }}
                          >
                            {money(transaction.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Link
                href="/transactions"
                className="secondary-btn"
                style={{ marginTop: 13 }}
              >
                Lihat semua transaksi <ChevronRight size={14} />
              </Link>
            </Panel>

            <Panel
              id="review-items"
              title="Transaksi yang perlu ditinjau"
              subtitle="Nominal tinggi, kategori, reimburse, dan sinkronisasi"
              icon={<ShieldAlert size={17} />}
              count={reviewItems.length}
              defaultOpen
            >
              {reviewItems.length === 0 ? (
                <EmptyState>
                  <CheckCircle2
                    size={20}
                    style={{ verticalAlign: "middle", marginRight: 6 }}
                  />
                  Tidak ada item yang perlu ditinjau berdasarkan aturan saat
                  ini.
                </EmptyState>
              ) : (
                <div className="finwise-list">
                  {reviewItems.map((item) => (
                    <div
                      className="finwise-row"
                      key={item.id}
                      style={{
                        alignItems: "flex-start",
                        padding: "10px 0",
                        borderBottom: "1px solid #eff1ef",
                      }}
                    >
                      <div style={{ display: "flex", gap: 9, minWidth: 0 }}>
                        <span
                          style={{
                            color:
                              item.tone === "red"
                                ? "#b54c3b"
                                : item.tone === "amber"
                                  ? "#b57c24"
                                  : "#68736c",
                            marginTop: 2,
                          }}
                        >
                          <AlertTriangle size={16} />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div className="finwise-strong">{item.title}</div>
                          <div className="finwise-muted">{item.detail}</div>
                        </div>
                      </div>
                      {typeof item.amount === "number" ? (
                        <strong
                          className="finwise-small"
                          style={{ flex: "0 0 auto" }}
                        >
                          {money(item.amount)}
                        </strong>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              <Link
                href="/reports"
                className="secondary-btn"
                style={{ marginTop: 13 }}
              >
                Buka laporan <ChevronRight size={14} />
              </Link>
            </Panel>
          </div>

          <Panel
            id="sync-backup"
            title="Status sinkronisasi & backup"
            subtitle="Kondisi data lokal dan status cloud yang diketahui aplikasi"
            icon={<Cloud size={17} />}
            defaultOpen={false}
          >
            <div className="finwise-three-col">
              <div className="finwise-status-card">
                <span style={{ color: online ? "#187343" : "#b57c24" }}>
                  {online ? <Cloud size={18} /> : <CloudOff size={18} />}
                </span>
                <div>
                  <div className="finwise-strong">
                    {online ? "Perangkat online" : "Mode offline"}
                  </div>
                  <p>
                    {online
                      ? "Internet terdeteksi. Data lokal tetap bisa digunakan."
                      : "Perubahan disimpan lokal dan menunggu koneksi jika perlu sinkronisasi."}
                  </p>
                </div>
              </div>
              <div className="finwise-status-card">
                <span
                  style={{
                    color:
                      syncConflict || conflictCount
                        ? "#b54c3b"
                        : pendingSync
                          ? "#b57c24"
                          : "#187343",
                  }}
                >
                  {syncConflict || conflictCount ? (
                    <AlertTriangle size={18} />
                  ) : pendingSync ? (
                    <RefreshCw size={18} />
                  ) : (
                    <CheckCircle2 size={18} />
                  )}
                </span>
                <div>
                  <div className="finwise-strong">
                    {syncConflict || conflictCount
                      ? "Perlu tinjau konflik"
                      : pendingSync
                        ? `${pendingSync} transaksi menunggu sync`
                        : "Tidak ada transaksi pending"}
                  </div>
                  <p>
                    {cloudVersion === null
                      ? "Versi cloud belum tercatat pada perangkat ini."
                      : `Versi cloud terakhir tercatat: ${cloudVersion}.`}
                  </p>
                </div>
              </div>
              <div className="finwise-status-card">
                <span
                  style={{ color: backupTimestamp ? "#187343" : "#7a828a" }}
                >
                  {backupTimestamp ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <Archive size={18} />
                  )}
                </span>
                <div>
                  <div className="finwise-strong">
                    {backupTimestamp ? "Backup tercatat" : "Backup manual"}
                  </div>
                  <p>
                    {backupTimestamp
                      ? `Terakhir: ${new Date(backupTimestamp).toLocaleString("id-ID")}`
                      : "Waktu backup belum tersedia di metadata lokal. Buka pengaturan untuk mengunduh backup."}
                  </p>
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 13,
              }}
            >
              <Link href="/settings" className="secondary-btn">
                <Database size={14} /> Backup & pengaturan{" "}
                <ChevronRight size={14} />
              </Link>
              <Link href="/import-export" className="secondary-btn">
                <Download size={14} /> Impor / ekspor <ChevronRight size={14} />
              </Link>
              <Link href="/login" className="secondary-btn">
                <ExternalLink size={14} /> Login / cloud sync{" "}
                <ChevronRight size={14} />
              </Link>
            </div>
          </Panel>
        </div>
      </details>

      <div
        className="finwise-muted"
        style={{ textAlign: "center", margin: "14px 0 4px" }}
      >
        Data berasal dari ledger dan catatan lokal Finwise.{" "}
        {settingsReady
          ? "Status perangkat telah diperiksa."
          : "Memeriksa status perangkat…"}{" "}
        Tidak ada analisis AI yang dijalankan pada dashboard.
      </div>
    </div>
  );
}
