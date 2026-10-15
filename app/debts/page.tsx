"use client";
import { useState } from "react";
import { ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { RecordManager } from "@/components/record-manager";
import { useLocalRecords } from "@/components/local-records";
import { useLocalTransactions } from "@/components/transaction-store";
import { formatIDR } from "@/lib/finance/money";
const fields = [
  {
    key: "type",
    label: "Jenis",
    type: "select" as const,
    options: [
      "Utang pribadi",
      "Pinjaman",
      "Kartu kredit",
      "Cicilan",
      "Piutang",
      "Lainnya",
    ],
    required: true,
  },
  {
    key: "principal",
    label: "Nilai awal (IDR)",
    type: "number" as const,
    required: true,
  },
  {
    key: "outstanding",
    label: "Sisa pokok / piutang (IDR)",
    type: "number" as const,
    required: true,
  },
  { key: "interestRate", label: "Bunga tahunan (%)", type: "number" as const },
  {
    key: "monthlyPayment",
    label: "Pembayaran bulanan (IDR)",
    type: "number" as const,
  },
  { key: "dueDate", label: "Jatuh tempo berikutnya", type: "date" as const },
  { key: "note", label: "Catatan", type: "textarea" as const },
];
function PaymentForm() {
  const { records, save } = useLocalRecords("debts");
  const { add } = useLocalTransactions();
  const [id, setId] = useState("");
  const [principal, setPrincipal] = useState("");
  const [interest, setInterest] = useState("0");
  const [fees, setFees] = useState("0");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const chosen = records.find((r) => r.id === id);
  const isReceivable =
    String(chosen?.data.type || "").toLowerCase() === "piutang";
  const total =
    Number(principal || 0) + Number(interest || 0) + Number(fees || 0);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chosen) return;
    const p = Number(principal),
      i = Number(interest),
      f = Number(fees);
    if (
      [p, i, f].some((x) => !Number.isSafeInteger(x) || x < 0) ||
      p + i + f <= 0
    ) {
      toast.error("Nominal harus berupa bilangan bulat rupiah yang valid");
      return;
    }
    if (!isReceivable && p > Number(chosen.data.outstanding || 0)) {
      toast.error("Pembayaran pokok melebihi sisa utang");
      return;
    }
    setBusy(true);
    try {
      const nextOutstanding = Math.max(
        0,
        Number(chosen.data.outstanding || 0) - p,
      );
      await save(
        chosen.name,
        { ...chosen.data, outstanding: nextOutstanding },
        chosen.id,
      );
      const txType = isReceivable ? "receivable_payment" : "debt_payment";
      const expenseAmount = isReceivable ? 0 : i + f;
      await add({
        type: txType,
        date: new Date(`${date}T12:00:00`).toISOString(),
        amount: total,
        description: `${isReceivable ? "Penerimaan piutang" : "Pembayaran utang"}: ${chosen.name}`,
        category: isReceivable ? "Penerimaan piutang" : "Bunga & Biaya Utang",
        account: "Bank utama",
        excludedFromReports: false,
        note: `Pokok ${formatIDR(p)} · bunga ${formatIDR(i)} · biaya ${formatIDR(f)}`,
        tags: ["utang-piutang"],
        principalPaid: p,
        interestPaid: i,
        feesPaid: f,
        expenseAmount,
        incomeAmount: isReceivable ? i + f : undefined,
        splitLines: isReceivable
          ? undefined
          : i + f > 0
            ? [{ category: "Bunga & Biaya Utang", amount: i + f }]
            : [],
      });
      toast.success("Pembayaran dicatat dan sisa pokok diperbarui");
      setPrincipal("");
      setInterest("0");
      setFees("0");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mencatat pembayaran");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <div className="section-title">
        <div>
          <h2>
            <ReceiptText
              size={16}
              style={{ verticalAlign: "middle", marginRight: 7 }}
            />
            Catat pembayaran
          </h2>
          <div className="muted" style={{ marginTop: 4 }}>
            Pokok mengurangi saldo kewajiban; bunga dan biaya masuk laporan
            pengeluaran.
          </div>
        </div>
      </div>
      <form onSubmit={submit} className="form-grid">
        <div className="field">
          <label>Utang / piutang</label>
          <select required value={id} onChange={(e) => setId(e.target.value)}>
            <option value="">Pilih data…</option>
            {records.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · sisa {formatIDR(Number(r.data.outstanding || 0))}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Tanggal pembayaran</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label>
            {isReceivable ? "Pokok diterima (IDR)" : "Pokok dibayar (IDR)"}
          </label>
          <input
            type="number"
            min="0"
            step="1"
            required
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
          />
        </div>
        <div className="field">
          <label>
            {isReceivable ? "Bunga diterima (IDR)" : "Bunga dibayar (IDR)"}
          </label>
          <input
            type="number"
            min="0"
            step="1"
            required
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Biaya (IDR)</label>
          <input
            type="number"
            min="0"
            step="1"
            required
            value={fees}
            onChange={(e) => setFees(e.target.value)}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "end",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div className="muted">Total mutasi rekening</div>
            <strong>{formatIDR(total)}</strong>
          </div>
          <button className="primary-btn" disabled={!chosen || busy}>
            {busy ? "Menyimpan…" : "Catat pembayaran"}
          </button>
        </div>
      </form>
    </section>
  );
}
export default function DebtsPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Utang & Piutang</h1>
          <div className="muted">
            Kelola sisa pokok, bunga, biaya, dan jadwal pembayaran.
          </div>
        </div>
      </div>
      <PaymentForm />
      <RecordManager
        kind="debts"
        title="Daftar utang & piutang"
        description="Saldo kewajiban dan piutang disimpan secara lokal."
        fields={fields}
        amountKey="outstanding"
        emptyText="Belum ada utang atau piutang."
      />
    </>
  );
}
