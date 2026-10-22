"use client";
import { useMemo, useState, useEffect } from "react";
import { BarChart3, TrendingUp, Wallet, Download } from "lucide-react";
import { formatIDR } from "@/lib/finance/money";
import { useLocalTransactions } from "@/components/transaction-store";
import { useLocalRecords } from "@/components/local-records";
import { localDB } from "@/lib/offline/database";
import {
  localNetWorth,
  transactionCategoryAmount,
} from "@/lib/finance/local-summary";
import { isTransactionExcludedFromReports } from "@/lib/finance/report-exclusions";
export default function ReportsPage() {
  const { transactions, ledgerEntries, ready } = useLocalTransactions();
  const { records: accounts } = useLocalRecords("accounts");
  const { records: assets } = useLocalRecords("assets");
  const { records: debts } = useLocalRecords("debts");
  const [period, setPeriod] = useState("all");
  const [privacy, setPrivacy] = useState(false);
  useEffect(() => {
    void localDB?.settings
      .get("privacy")
      .then((x) => setPrivacy(Boolean(x?.value)));
  }, []);
  const money = (n: number) => (privacy ? "••••••" : formatIDR(n));
  const report = useMemo(() => {
    const today = new Date();
    const included = transactions.filter(
      (t) => !isTransactionExcludedFromReports(t, accounts),
    );
    const filtered = included.filter((t) => {
      if (period === "all") return true;
      const d = new Date(t.date);
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth()
      );
    });
    const income = filtered
      .filter((t) => t.type === "income" || t.type === "receivable_payment")
      .reduce(
        (s, t) =>
          s +
          (t.type === "receivable_payment"
            ? (t.incomeAmount ?? t.amount)
            : t.amount),
        0,
      );
    const gross = filtered
      .filter((t) =>
        ["expense", "asset_purchase", "debt_payment"].includes(t.type),
      )
      .reduce(
        (s, t) =>
          s +
          (t.type === "debt_payment"
            ? (t.expenseAmount ?? t.amount)
            : t.amount),
        0,
      );
    const refunds = filtered
      .filter((t) => t.type === "refund")
      .reduce((s, t) => s + t.amount, 0);
    const expense = Math.max(0, gross - refunds);
    const cashIn = filtered
      .filter((t) =>
        ["income", "receivable_payment", "refund"].includes(t.type),
      )
      .reduce((s, t) => s + t.amount, 0);
    const cashOut = filtered
      .filter(
        (t) =>
          [
            "expense",
            "asset_purchase",
            "debt_payment",
            "reimburse_payment",
          ].includes(t.type) && !t.partnerPaid,
      )
      .reduce((s, t) => s + t.amount, 0);
    const byCategory = new Map<string, number>();
    filtered
      .filter((t) =>
        ["expense", "asset_purchase", "debt_payment"].includes(t.type),
      )
      .forEach((t) => {
        if (
          t.type === "debt_payment" &&
          t.expenseAmount !== undefined &&
          !t.splitLines?.length
        ) {
          if (t.expenseAmount > 0)
            byCategory.set(
              t.category,
              (byCategory.get(t.category) ?? 0) + t.expenseAmount,
            );
          return;
        }
        if (t.splitLines?.length) {
          t.splitLines.forEach((line) =>
            byCategory.set(
              line.category,
              (byCategory.get(line.category) ?? 0) + line.amount,
            ),
          );
        } else
          byCategory.set(
            t.category,
            (byCategory.get(t.category) ?? 0) + t.amount,
          );
      });
    filtered
      .filter((t) => t.type === "refund")
      .forEach((t) =>
        byCategory.set(
          t.category,
          Math.max(
            0,
            (byCategory.get(t.category) ?? 0) -
              transactionCategoryAmount(t, t.category),
          ),
        ),
      );
    // const months = Array.from({ length: 6 }, (_, i) => {
    //   const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    //   const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    //   const month = included.filter((t) => t.date.slice(0, 7) === key);
    //   return {
    //     label: d.toLocaleDateString("id-ID", {
    //       month: "short",
    //       year: "2-digit",
    //     }),
    //     income: month
    //       .filter((t) => ["income", "receivable_payment"].includes(t.type))
    //       .reduce((s, t) => s + t.amount, 0),
    //     expense:
    //       month
    //         .filter((t) =>
    //           ["expense", "asset_purchase", "debt_payment"].includes(t.type),
    //         )
    //         .reduce((s, t) => s + t.amount, 0) -
    //       month
    //         .filter((t) => t.type === "refund")
    //         .reduce((s, t) => s + t.amount, 0),
    //   };
    // });
    const hist = included.filter((t) => {
      const d = new Date(t.date);
      const start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      return (
        d >= start && d < new Date(today.getFullYear(), today.getMonth() + 1, 1)
      );
    });
    const avgIncome =
      hist
        .filter((t) => ["income", "receivable_payment"].includes(t.type))
        .reduce((s, t) => s + t.amount, 0) / 3;
    const avgExpense =
      (hist
        .filter((t) =>
          ["expense", "asset_purchase", "debt_payment"].includes(t.type),
        )
        .reduce((s, t) => s + t.amount, 0) -
        hist
          .filter((t) => t.type === "refund")
          .reduce((s, t) => s + t.amount, 0)) /
      3;
    const forecast = Array.from({ length: 6 }, (_, i) => ({
      month: new Date(
        today.getFullYear(),
        today.getMonth() + i + 1,
        1,
      ).toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
      income: Math.round(avgIncome),
      expense: Math.max(0, Math.round(avgExpense)),
      net: Math.round(avgIncome - avgExpense),
    }));
    const anomalies = included
      .filter((t) => t.amount >= Math.max(1_000_000, avgExpense * 0.35))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
    return {
      income,
      expense,
      net: cashIn - cashOut,
      categories: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
      forecast,
      anomalies,
      refunds,
    };
  }, [transactions, period, accounts]);
  const netWorth = localNetWorth(
    accounts,
    assets,
    debts,
    transactions,
    ledgerEntries,
  );
  const exportReport = () => {
    const csv = [
      "Kategori,Nominal",
      ...report.categories.map(([n, a]) => `"${n.replaceAll('"', '""')}",${a}`),
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "finwise-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Laporan & Analitik</h1>
          <div className="muted">
            Laporan berdasarkan transaksi lokal yang tidak dikecualikan.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{
              border: "1px solid #dfe4e0",
              borderRadius: 9,
              padding: "9px 12px",
            }}
          >
            <option value="all">Semua periode</option>
            <option value="month">Bulan ini</option>
          </select>
          <button className="secondary-btn" onClick={exportReport}>
            <Download size={14} /> CSV
          </button>
        </div>
      </div>
      <div className="metric-grid">
        <Metric
          title="Pemasukan"
          value={money(report.income)}
          icon={<TrendingUp size={17} />}
        />
        <Metric
          title="Pengeluaran bersih"
          value={money(report.expense)}
          icon={<BarChart3 size={17} />}
        />
        <Metric
          title="Net cash flow"
          value={money(report.net)}
          icon={<Wallet size={17} />}
        />
        <Metric
          title="Net worth aset tercatat"
          value={money(netWorth)}
          icon={<Wallet size={17} />}
        />
      </div>
      <div className="section-grid">
        <section className="card">
          <div className="section-title">
            <h2>Pengeluaran per kategori</h2>
          </div>
          {!ready ? (
            <div className="empty">Memuat…</div>
          ) : !report.categories.length ? (
            <div className="empty">
              Belum ada transaksi pengeluaran yang masuk laporan.
            </div>
          ) : (
            report.categories.map(([name, amount]) => (
              <div key={name} style={{ marginBottom: 17 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    fontSize: 12,
                    marginBottom: 8,
                  }}
                >
                  <span>{name}</span>
                  <strong>{money(amount)}</strong>
                </div>
                <div className="progress">
                  <span
                    style={{
                      width: `${report.expense ? Math.max(0, (amount / report.expense) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </section>
        <section className="card">
          <div className="section-title">
            <h2>Proyeksi 6 bulan</h2>
            <span className="badge amber">Estimasi</span>
          </div>
          <p className="muted" style={{ lineHeight: 1.6 }}>
            Proyeksi memakai rata-rata pemasukan dan pengeluaran 3 bulan
            terakhir. Belum memasukkan seluruh jadwal berulang atau perubahan
            aset.
          </p>
          {report.forecast.map((f) => (
            <div
              key={f.month}
              style={{ padding: "10px 0", borderBottom: "1px solid #eff0f2" }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                {f.month}
              </div>
              <div className="muted">
                Masuk {money(f.income)} · Keluar {money(f.expense)}
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 750,
                  color: f.net >= 0 ? "#187343" : "#b54c3b",
                  marginTop: 4,
                }}
              >
                Net {money(f.net)}
              </div>
            </div>
          ))}
        </section>
      </div>
      <section className="card" style={{ marginTop: 18 }}>
        <div className="section-title">
          <h2>Transaksi untuk ditinjau</h2>
          <span className="badge amber">Heuristik nominal</span>
        </div>
        {report.anomalies.length === 0 ? (
          <div className="empty">
            Belum ada transaksi yang memenuhi ambang nominal.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Transaksi</th>
                  <th>Kategori</th>
                  <th>Alasan</th>
                  <th style={{ textAlign: "right" }}>Nominal</th>
                </tr>
              </thead>
              <tbody>
                {report.anomalies.map((t) => (
                  <tr key={t.id}>
                    <td>{new Date(t.date).toLocaleDateString("id-ID")}</td>
                    <td>{t.description}</td>
                    <td>{t.category}</td>
                    <td>Nominal tinggi — periksa manual</td>
                    <td style={{ textAlign: "right" }}>{money(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
function Metric({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div className="metric-label">{title}</div>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: "#f0f2f4",
            display: "grid",
            placeItems: "center",
          }}
        >
          {icon}
        </div>
      </div>
      <div className="metric-value">{value}</div>
    </div>
  );
}
