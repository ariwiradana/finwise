"use client";
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  CirclePlus,
  Clock3,
  PiggyBank,
  ShieldAlert,
  Wallet,
  TrendingUp,
} from "lucide-react";
import { formatIDR } from "@/lib/finance/money";
import { useLocalTransactions } from "@/components/transaction-store";
import { useLocalRecords } from "@/components/local-records";
import { localDB } from "@/lib/offline/database";
import {
  localNetWorth,
  transactionCategoryAmount,
} from "@/lib/finance/local-summary";
import { isTransactionExcludedFromReports } from "@/lib/finance/report-exclusions";
export default function DashboardPage() {
  const { transactions, ledgerEntries, ready } = useLocalTransactions();
  const { records: accounts } = useLocalRecords("accounts");
  const { records: budgets } = useLocalRecords("budgets");
  const { records: assets } = useLocalRecords("assets");
  const { records: debts } = useLocalRecords("debts");
  const { records: goals } = useLocalRecords("goals");
  const [privacy, setPrivacy] = useState(false);
  useEffect(() => {
    void localDB?.settings
      .get("privacy")
      .then((x) => setPrivacy(Boolean(x?.value)));
  }, []);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const stats = useMemo(() => {
    const all = transactions.filter((t) => !t.deletedAt);
    const month = all.filter(
      (t) =>
        t.date.slice(0, 7) === currentMonth &&
        !isTransactionExcludedFromReports(t, accounts),
    );
    const income = month
      .filter((t) => ["income", "receivable_payment"].includes(t.type))
      .reduce(
        (s, t) =>
          s +
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
        (s, t) =>
          s +
          (t.type === "debt_payment"
            ? (t.expenseAmount ?? t.amount)
            : t.amount),
        0,
      );
    const refunds = month
      .filter((t) => t.type === "refund")
      .reduce((s, t) => s + t.amount, 0);
    const expenses = Math.max(0, gross - refunds);
    const cash = all.reduce(
      (s, t) =>
        s +
        (t.partnerPaid
          ? 0
          : ["income", "receivable_payment"].includes(t.type)
            ? t.amount
            : [
                  "expense",
                  "asset_purchase",
                  "debt_payment",
                  "reimburse_payment",
                ].includes(t.type)
              ? -t.amount
              : t.type === "refund"
                ? t.amount
                : 0),
      0,
    );
    const cashIn = month
      .filter((t) =>
        ["income", "receivable_payment", "refund"].includes(t.type),
      )
      .reduce((s, t) => s + (t.type === "refund" ? t.amount : t.amount), 0);
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
      .reduce((s, t) => s + t.amount, 0);
    const anomalies = all
      .filter((t) => t.amount >= 1_000_000 && !isTransactionExcludedFromReports(t, accounts))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    return {
      income,
      expenses,
      cashFlow: cashIn - cashOut,
      cash,
      anomalies,
      month,
      refunds,
    };
  }, [transactions, currentMonth, accounts]);
  const budgetInfo = budgets.map((b) => {
    const spent =
      transactions
        .filter(
          (t) =>
            !t.deletedAt &&
            !isTransactionExcludedFromReports(t, accounts) &&
            t.date.slice(0, 7) === currentMonth &&
            ["expense", "asset_purchase", "debt_payment"].includes(t.type),
        )
        .reduce(
          (s, t) => s + transactionCategoryAmount(t, String(b.data.category)),
          0,
        ) -
      transactions
        .filter(
          (t) =>
            !t.deletedAt &&
            !isTransactionExcludedFromReports(t, accounts) &&
            t.date.slice(0, 7) === currentMonth &&
            t.type === "refund",
        )
        .reduce(
          (s, t) => s + transactionCategoryAmount(t, String(b.data.category)),
          0,
        );
    const limit = Number(b.data.limit || 0);
    return {
      ...b,
      spent: Math.max(0, spent),
      limit,
      percent: limit ? Math.max(0, (spent / limit) * 100) : 0,
    };
  });
  useEffect(() => {
    void (async () => {
      if (
        !localDB ||
        typeof Notification === "undefined" ||
        Notification.permission !== "granted"
      )
        return;
      for (const b of budgetInfo) {
        for (const threshold of [75, 90, 100]) {
          const key = `budget-alert-${currentMonth}-${b.id}-${threshold}`;
          const already = await localDB.settings.get(key);
          if (b.percent >= threshold && !already) {
            new Notification(
              `Budget ${threshold}%: ${String(b.data.category || b.name)}`,
              {
                body: `Terpakai ${formatIDR(b.spent)} dari ${formatIDR(b.limit)}.`,
              },
            );
            await localDB.settings.put({ key, value: true });
          }
        }
      }
      const schedules = await localDB.records
        .where("kind")
        .equals("schedules")
        .toArray();
      const today = new Date();
      for (const r of schedules) {
        if (
          r.archivedAt ||
          String(r.data.active) === "Jeda" ||
          !r.data.nextDate
        )
          continue;
        const due = new Date(`${r.data.nextDate}T12:00:00`);
        const days = Math.ceil(
          (due.getTime() -
            new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate(),
              12,
            ).getTime()) /
            86400000,
        );
        const before = Math.max(0, Number(r.data.reminderDays || 0));
        const key = `schedule-alert-${r.id}-${r.data.nextDate}`;
        const already = await localDB.settings.get(key);
        if (days >= 0 && days <= before && !already) {
          new Notification(`Pengingat tagihan: ${r.name}`, {
            body: `Jatuh tempo ${due.toLocaleDateString("id-ID")} · ${formatIDR(Number(r.data.amount || 0))}`,
          });
          await localDB.settings.put({ key, value: true });
        }
      }
    })();
  }, [budgetInfo, currentMonth]);
  const assetsTotal = assets.reduce(
    (s, a) => s + Number(a.data.currentValue || 0),
    0,
  );
  const debtsTotal = debts.reduce(
    (s, d) => s + Number(d.data.outstanding || 0),
    0,
  );
  const goalTotal = goals.reduce(
    (s, g) =>
      s +
      Math.max(0, Number(g.data.target || 0) - Number(g.data.allocated || 0)),
    0,
  );
  const netWorth = localNetWorth(
    accounts,
    assets,
    debts,
    transactions,
    ledgerEntries,
  );
  const money = (v: number) => (privacy ? "••••••" : formatIDR(v));
  const max = Math.max(stats.income, stats.expenses, 1);
  return (
    <>
      <div className="page-heading">
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              color: "#7d858d",
              fontSize: 11,
              marginBottom: 9,
            }}
          >
            <CalendarDays size={13} />
            {new Date().toLocaleDateString("id-ID", {
              month: "long",
              year: "numeric",
            })}
          </div>
          <h1>Financial overview</h1>
          <div className="muted">
            Ringkasan kondisi keuangan dari data lokal perangkat ini.
          </div>
        </div>
        <Link className="primary-btn" href="/transactions">
          <CirclePlus size={15} /> Tambah transaksi
        </Link>
      </div>
      <div className="metric-grid">
        <Metric
          title="Pemasukan bulan ini"
          value={money(stats.income)}
          icon={<ArrowDownLeft size={17} />}
          foot="Tidak termasuk transfer"
          tone="green"
        />
        <Metric
          title="Pengeluaran bersih"
          value={money(stats.expenses)}
          icon={<ArrowUpRight size={17} />}
          foot="Setelah refund dan reimburse"
          tone="red"
        />
        <Metric
          title="Net cash flow"
          value={money(stats.cashFlow)}
          icon={<Wallet size={17} />}
          foot="Pemasukan + refund − pengeluaran"
          tone={stats.cashFlow >= 0 ? "green" : "red"}
        />
        <Metric
          title="Mutasi bersih terhitung"
          value={money(stats.cash)}
          icon={<PiggyBank size={17} />}
          foot="Belum termasuk saldo awal akun"
          tone="neutral"
        />
      </div>
      <div className="section-grid">
        <section className="card">
          <div className="section-title">
            <div>
              <h2>Arus kas bulan ini</h2>
              <div className="muted" style={{ marginTop: 5 }}>
                Pemasukan vs pengeluaran
              </div>
            </div>
            <span className="badge">IDR</span>
          </div>
          <div style={{ display: "grid", gap: 20, padding: "8px 0 10px" }}>
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 9,
                  fontSize: 12,
                }}
              >
                <span className="muted">Pemasukan</span>
                <strong>{money(stats.income)}</strong>
              </div>
              <div className="progress">
                <span
                  style={{
                    width: `${(stats.income / max) * 100}%`,
                    background: "#258252",
                  }}
                />
              </div>
            </div>
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 9,
                  fontSize: 12,
                }}
              >
                <span className="muted">Pengeluaran bersih</span>
                <strong>{money(stats.expenses)}</strong>
              </div>
              <div className="progress">
                <span
                  style={{
                    width: `${(stats.expenses / max) * 100}%`,
                    background: "#d17b68",
                  }}
                />
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: "1px solid #eff0f2",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div className="muted">Transaksi bulan ini</div>
              <div style={{ fontSize: 20, fontWeight: 750, marginTop: 5 }}>
                {stats.month.length}
              </div>
            </div>
            <Link href="/reports" className="secondary-btn">
              Lihat laporan <ChevronRight size={14} />
            </Link>
          </div>
        </section>
        <section className="card">
          <div className="section-title">
            <h2>Budget bulan ini</h2>
            <Link href="/budgets" className="muted">
              Kelola
            </Link>
          </div>
          {budgetInfo.length === 0 ? (
            <div className="empty">
              Belum ada budget.
              <div style={{ marginTop: 8 }}>
                <Link href="/budgets" className="secondary-btn">
                  Buat budget
                </Link>
              </div>
            </div>
          ) : (
            budgetInfo.map((b) => (
              <div key={b.id} style={{ marginBottom: 17 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    fontSize: 12,
                    marginBottom: 7,
                  }}
                >
                  <strong>{String(b.data.category || b.name)}</strong>
                  <span>
                    {money(b.spent)} / {money(b.limit)}
                  </span>
                </div>
                <div className="progress">
                  <span
                    style={{
                      width: `${Math.min(100, b.percent)}%`,
                      background:
                        b.percent >= 100
                          ? "#b54c3b"
                          : b.percent >= 90
                            ? "#b57c24"
                            : "#287b50",
                    }}
                  />
                </div>
                {b.percent >= 75 && (
                  <p
                    className="muted"
                    style={{
                      marginTop: 5,
                      fontSize: 12,
                      color: b.percent >= 100 ? "#b54c3b" : "#986300",
                    }}
                  >
                    Budget terpakai {Math.round(b.percent)}%
                  </p>
                )}
              </div>
            ))
          )}
        </section>
      </div>
      <div className="metric-grid" style={{ marginTop: 18 }}>
        <Metric
          title="Aset tercatat"
          value={money(assetsTotal)}
          icon={<Wallet size={17} />}
          foot="Nilai manual saat ini"
          tone="neutral"
        />
        <Metric
          title="Sisa utang"
          value={money(debtsTotal)}
          icon={<TrendingUp size={17} />}
          foot="Dari modul utang/piutang"
          tone="red"
        />
        <Metric
          title="Net worth"
          value={money(netWorth)}
          icon={<PiggyBank size={17} />}
          foot="Saldo akun + aset − kewajiban"
          tone={netWorth >= 0 ? "green" : "red"}
        />
        <Metric
          title="Kebutuhan target"
          value={money(goalTotal)}
          icon={<Clock3 size={17} />}
          foot="Sisa target yang belum dialokasikan"
          tone="neutral"
        />
      </div>
      <div className="section-grid">
        <section className="card">
          <div className="section-title">
            <h2>Transaksi terbaru</h2>
            <Link href="/transactions" className="muted">
              <div className="flex items-center">
                Lihat semua{" "}
                <ChevronRight size={16} style={{ verticalAlign: "middle" }} />
              </div>
            </Link>
          </div>
          {!ready ? (
            <div className="empty">Memuat transaksi…</div>
          ) : !transactions.length ? (
            <div className="empty">
              <Wallet
                size={26}
                style={{ margin: "0 auto 10px", opacity: 0.45 }}
              />
              <div>Belum ada transaksi</div>
              <Link
                href="/transactions"
                className="primary-btn"
                style={{ marginTop: 15 }}
              >
                Catat transaksi pertama
              </Link>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Transaksi</th>
                    <th>Kategori</th>
                    <th>Tanggal</th>
                    <th style={{ textAlign: "right" }}>Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 6).map((t) => (
                    <tr key={t.id}>
                      <td>
                        <strong>{t.description}</strong>
                        {t.reimburseStatus === "pending" && (
                          <div style={{ marginTop: 4 }}>
                            <span className="badge amber">
                              Menunggu reimburse
                            </span>
                          </div>
                        )}
                      </td>
                      <td>{t.category}</td>
                      <td>{new Date(t.date).toLocaleDateString("id-ID")}</td>
                      <td
                        style={{
                          textAlign: "right",
                          fontWeight: 700,
                          color: t.type === "income" ? "#187343" : "#30343a",
                        }}
                      >
                        {money(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="card">
          <div className="section-title">
            <h2>Perlu ditinjau</h2>
            <ShieldAlert size={16} color="#b57c24" />
          </div>
          {stats.anomalies.length === 0 ? (
            <div className="empty">Belum ada nominal besar untuk ditinjau.</div>
          ) : (
            stats.anomalies.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "11px 0",
                  borderBottom: "1px solid #eff0f2",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>
                    {t.description}
                  </div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    Nominal tinggi · periksa manual
                  </div>
                </div>
                <strong style={{ fontSize: 12 }}>{money(t.amount)}</strong>
              </div>
            ))
          )}
          <Link
            href="/reports"
            className="secondary-btn"
            style={{ marginTop: 14, width: "100%" }}
          >
            Buka analitik <ChevronRight size={13} />
          </Link>
        </section>
      </div>
    </>
  );
}
function Metric({
  title,
  value,
  icon,
  foot,
  tone,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  foot: string;
  tone: "green" | "red" | "neutral";
}) {
  const color =
    tone === "green" ? "#187343" : tone === "red" ? "#b54c3b" : "#454b53";
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
            display: "grid",
            placeItems: "center",
            background:
              tone === "green"
                ? "#e7f5ec"
                : tone === "red"
                  ? "#fff0ed"
                  : "#f0f2f4",
            color,
          }}
        >
          {icon}
        </div>
      </div>
      <div className="metric-value" style={{ color }}>
        {value}
      </div>
      <div className="metric-foot">{foot}</div>
    </div>
  );
}
