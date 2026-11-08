"use client";

import { useMemo } from "react";
import { Wallet, TrendingUp, PieChart } from "lucide-react";
import { RecordManager } from "@/components/record-manager";
import { useLocalRecords } from "@/components/local-records";
import { formatIDR } from "@/lib/finance/money";
import { useLocalTransactions } from "@/components/transaction-store";
import { isTransactionExcludedFromReports } from "@/lib/finance/report-exclusions";
import { transactionReportableExpenseAmount } from "@/lib/finance/local-summary";

export default function BudgetPage() {
  const { records: categoryRecords, ready: categoriesReady } =
    useLocalRecords("categories");
  const { records: budgets, ready: budgetsReady } = useLocalRecords("budgets");
  const { transactions, ready: transactionsReady } = useLocalTransactions();
  const { records: accounts } = useLocalRecords("accounts");

  // Use the same locally saved categories managed by the Categories menu.
  // Budgets should only be assigned to expense categories.
  const categoryOptions = useMemo(() => {
    return Array.from(
      new Set(
        categoryRecords
          .filter((record) => {
            const type = String(record.data.type || "expense")
              .trim()
              .toLowerCase();
            return ["expense", "pengeluaran"].includes(type);
          })
          .map((record) => record.name.trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, "id"));
  }, [categoryRecords]);

  const budgetSummary = useMemo(() => {
    const totalBudget = budgets.reduce(
      (total, budget) => total + Math.max(0, Number(budget.data.limit) || 0),
      0,
    );
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const included = transactions.filter((transaction) => {
      if (isTransactionExcludedFromReports(transaction, accounts)) return false;
      const date = new Date(transaction.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return key === currentMonth;
    });
    const usedByCategory = new Map<string, number>();
    included
      .filter((transaction) => ["expense", "asset_purchase", "debt_payment"].includes(transaction.type))
      .forEach((transaction) => {
        if (transaction.splitLines?.length) {
          transaction.splitLines
            .filter((line) => line.excludedFromReports !== true)
            .forEach((line) => {
              usedByCategory.set(
                line.category,
                (usedByCategory.get(line.category) ?? 0) + Math.max(0, Number(line.amount) || 0),
              );
            });
        } else {
          const amount = transactionReportableExpenseAmount(transaction);
          if (amount > 0) {
            usedByCategory.set(
              transaction.category,
              (usedByCategory.get(transaction.category) ?? 0) + amount,
            );
          }
        }
      });
    included
      .filter((transaction) => transaction.type === "refund")
      .forEach((transaction) => {
        const refund = Math.max(0, Number(transaction.amount) || 0);
        usedByCategory.set(
          transaction.category,
          Math.max(0, (usedByCategory.get(transaction.category) ?? 0) - refund),
        );
      });
    const categories = budgets.map((budget) => {
      const limit = Math.max(0, Number(budget.data.limit) || 0);
      const categoryName = String(budget.data.category ?? budget.name ?? "");
      const used = usedByCategory.get(categoryName) ?? 0;
      return {
        id: budget.id,
        name: categoryName,
        limit,
        used,
        remaining: Math.max(0, limit - used),
        percent: limit > 0 ? (used / limit) * 100 : 0,
      };
    });
    return {
      totalBudget,
      totalUsed: categories.reduce((sum, category) => sum + category.used, 0),
      categories: categories.sort((a, b) => b.used - a.used),
    };
  }, [budgets, transactions, accounts]);
  const totalRemaining = Math.max(0, budgetSummary.totalBudget - budgetSummary.totalUsed);
  const usagePercent = budgetSummary.totalBudget > 0
    ? (budgetSummary.totalUsed / budgetSummary.totalBudget) * 100
    : 0;

  return (
    <>
      <div className="budget-summary-grid" style={{ marginBottom: 18 }}>
        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div className="metric-label">Total Budget Bulanan</div>
            <Wallet size={19} color="#187443" />
          </div>
          <div className="metric-value" style={{ marginTop: 6 }}>
            {budgetsReady ? formatIDR(budgetSummary.totalBudget) : "Memuat…"}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 5 }}>
            Total limit dari seluruh kategori budget yang tersimpan.
          </div>
        </section>
        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div className="metric-label">Budget Terpakai · Bulan Ini</div>
            <TrendingUp size={19} color="#B7791F" />
          </div>
          <div className="metric-value" style={{ marginTop: 6 }}>
            {budgetsReady && transactionsReady ? formatIDR(budgetSummary.totalUsed) : "Memuat…"}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 5 }}>
            {usagePercent.toFixed(1)}% dari total budget
          </div>
          <div className="progress" style={{ marginTop: 10 }}>
            <span style={{ width: `${Math.min(100, Math.max(0, usagePercent))}%`, background: usagePercent > 100 ? "#B42318" : undefined }} />
          </div>
        </section>
        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div className="metric-label">Sisa Budget</div>
            <Wallet size={19} color="#187443" />
          </div>
          <div className="metric-value" style={{ marginTop: 6 }}>
            {budgetsReady && transactionsReady ? formatIDR(totalRemaining) : "Memuat…"}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 5 }}>
            Total limit dikurangi pemakaian bulan ini.
          </div>
        </section>
      </div>
      <section className="card" style={{ marginBottom: 18 }}>
        <div className="section-title">
          <h2>Distribusi Pemakaian Budget</h2>
          <PieChart size={18} />
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: -4, marginBottom: 14 }}>
          Pemakaian bulan ini berdasarkan kategori pengeluaran.
        </p>
        {!budgetsReady || !transactionsReady ? (
          <div className="empty">Memuat distribusi…</div>
        ) : budgetSummary.categories.length === 0 ? (
          <div className="empty">Belum ada kategori budget.</div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {budgetSummary.categories.map((category) => (
              <div key={category.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", marginBottom: 7, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 13 }}>{category.name}</strong>
                  <span style={{ fontSize: 12, textAlign: "right" }}>
                    <strong>{formatIDR(category.used)}</strong>
                    <span className="muted"> / {formatIDR(category.limit)}</span>
                  </span>
                </div>
                <div className="progress">
                  <span style={{
                    width: `${Math.min(100, Math.max(0, category.percent))}%`,
                    background: category.percent > 100 ? "#B42318" : undefined,
                  }} />
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 5 }}>
                  {category.percent.toFixed(1)}% terpakai · Sisa {formatIDR(category.remaining)}
                  {category.percent > 100 ? ` · Melebihi ${formatIDR(category.used - category.limit)}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <RecordManager
        kind="budgets"
        title="Budget"
        description="Tetapkan batas bulanan dan pantau progres pemakaian."
        fields={[
          {
            key: "category",
            label: "Kategori",
            type: "select",
            options: categoryOptions,
            required: true,
            placeholder: categoriesReady
              ? "Pilih kategori pengeluaran"
              : "Memuat kategori…",
          },
          {
            key: "limit",
            label: "Limit bulanan (IDR)",
            type: "number",
            required: true,
          },
          {
            key: "month",
            label: "Bulan mulai",
            type: "date",
            required: true,
          },
          {
            key: "alerts",
            label: "Ambang notifikasi (%)",
            type: "number",
            required: true,
          },
        ]}
        amountKey="limit"
      />
    </>
  );
}
