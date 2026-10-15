"use client";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Download,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useLocalTransactions } from "@/components/transaction-store";
import {
  localDB,
  type LocalTransaction,
  type TxType,
} from "@/lib/offline/database";
const headers = [
  "date",
  "type",
  "amount",
  "description",
  "category",
  "account",
  "destinationAccount",
  "excludedFromReports",
  "partnerPaid",
  "reimburseStatus",
  "note",
  "tags",
  "splitLines",
  "relatedId",
  "expenseAmount",
  "incomeAmount",
  "principalPaid",
  "interestPaid",
  "feesPaid",
];
function parseDate(v: unknown): string {
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d
      ? new Date(d.y, d.m - 1, d.d, 12).toISOString()
      : new Date().toISOString();
  }
  const d = new Date(String(v ?? ""));
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
function normalizeType(v: unknown): TxType {
  const s = String(v ?? "expense").toLowerCase();
  if (["income", "pemasukan", "in"].includes(s)) return "income";
  if (["transfer", "transaksi transfer"].includes(s)) return "transfer";
  if (["refund", "pengembalian"].includes(s)) return "refund";
  if (["asset_purchase", "pembelian aset"].includes(s)) return "asset_purchase";
  if (["debt_payment", "pembayaran utang"].includes(s)) return "debt_payment";
  if (["receivable_payment", "pembayaran piutang"].includes(s))
    return "receivable_payment";
  if (["reimburse_payment", "pembayaran reimburse"].includes(s))
    return "reimburse_payment";
  if (["adjustment", "penyesuaian"].includes(s)) return "adjustment";
  return "expense";
}
export default function ImportExportPage() {
  const { transactions, refresh } = useLocalTransactions();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<LocalTransaction[]>([]);
  const [duplicates, setDuplicates] = useState<Set<number>>(new Set());
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const exportCsv = () => {
    const data = transactions.map((t) => ({
      date: t.date,
      type: t.type,
      amount: t.amount,
      description: t.description,
      category: t.category,
      account: t.account,
      destinationAccount: t.destinationAccount ?? "",
      excludedFromReports: t.excludedFromReports,
      partnerPaid: Boolean(t.partnerPaid),
      reimburseStatus: t.reimburseStatus ?? "not_applicable",
      note: t.note ?? "",
      tags: t.tags.join("|"),
      splitLines: JSON.stringify(t.splitLines ?? []),
      relatedId: t.relatedId ?? "",
      expenseAmount: t.expenseAmount ?? "",
      incomeAmount: t.incomeAmount ?? "",
      principalPaid: t.principalPaid ?? "",
      interestPaid: t.interestPaid ?? "",
      feesPaid: t.feesPaid ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data, { header: headers });
    const csv = XLSX.utils.sheet_to_csv(ws);
    download(
      csv,
      `finwise-transactions-${today()}.csv`,
      "text/csv;charset=utf-8;",
    );
    toast.success("Ekspor CSV selesai");
  };
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      transactions.map((t) => ({
        ...t,
        tags: t.tags.join("|"),
        splitLines: JSON.stringify(t.splitLines ?? []),
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(wb, `finwise-transactions-${today()}.xlsx`);
    toast.success("Ekspor Excel selesai");
  };
  const readFile = async (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    setRows([]);
    setErrors([]);
    setDuplicates(new Set());
    try {
      const bytes = await file.arrayBuffer();
      const wb = XLSX.read(bytes, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: "",
      });
      if (!raw.length) {
        toast.error("File tidak berisi baris data");
        return;
      }
      const mapped: LocalTransaction[] = [];
      const err: string[] = [];
      const dup = new Set<number>();
      const seen = new Set(
        transactions.map(
          (t) =>
            `${t.date.slice(0, 10)}|${t.amount}|${t.description.trim().toLowerCase()}|${t.account.trim().toLowerCase()}`,
        ),
      );
      raw.forEach((r, i) => {
        const lower: Record<string, unknown> = {};
        Object.entries(r).forEach(
          ([k, v]) => (lower[k.toLowerCase().replace(/[ _-]/g, "")] = v),
        );
        const get = (...keys: string[]) => {
          for (const k of keys) {
            const x = lower[k.toLowerCase().replace(/[ _-]/g, "")];
            if (x !== undefined && x !== "") return x;
          }
          return "";
        };
        const description = String(
          get("description", "deskripsi", "keterangan", "memo", "detail"),
        ).trim();
        const amountRaw = get("amount", "nominal", "jumlah", "nilai");
        const amount = Number(
          String(amountRaw)
            .replace(/[.,](?=\d{3}(\D|$))/g, "")
            .replace(",", "."),
        );
        if (!description || !Number.isSafeInteger(amount) || amount <= 0) {
          err.push(
            `Baris ${i + 2}: deskripsi kosong atau nominal bukan bilangan bulat positif.`,
          );
          return;
        }
        const date = parseDate(
          get("date", "tanggal", "transaction date", "transactionDate"),
        );
        const account = String(
          get("account", "akun", "rekening") || "Bank utama",
        );
        const type = normalizeType(get("type", "tipe", "jenis"));
        const destinationAccount =
          String(get("destinationAccount", "akun tujuan") || "") || undefined;
        if (
          type === "transfer" &&
          (!destinationAccount || destinationAccount === account)
        ) {
          err.push(
            `Baris ${i + 2}: transfer harus memiliki akun tujuan yang berbeda dari akun sumber.`,
          );
          return;
        }
        const key = `${date.slice(0, 10)}|${amount}|${description.toLowerCase()}|${account.toLowerCase()}`;
        const idx = mapped.length;
        if (seen.has(key)) dup.add(idx);
        seen.add(key);
        mapped.push({
          id: crypto.randomUUID(),
          date,
          type,
          amount,
          description,
          category: String(get("category", "kategori") || "Lainnya"),
          account,
          destinationAccount,
          partnerPaid: ["true", "1", "yes", "ya"].includes(
            String(get("partnerPaid", "dibayar partner")).toLowerCase(),
          ),
          reimburseStatus: String(
            get("reimburseStatus", "status reimburse") || "not_applicable",
          ) as LocalTransaction["reimburseStatus"],
          splitLines: (() => {
            const v = String(get("splitLines", "split"));
            if (!v) return undefined;
            try {
              return JSON.parse(v);
            } catch {
              return undefined;
            }
          })(),
          relatedId: String(get("relatedId", "id terkait") || "") || undefined,
          expenseAmount:
            get("expenseAmount", "nilai pengeluaran") === ""
              ? undefined
              : Number(get("expenseAmount", "nilai pengeluaran")),
          incomeAmount:
            get("incomeAmount", "nilai pemasukan") === ""
              ? undefined
              : Number(get("incomeAmount", "nilai pemasukan")),
          principalPaid:
            get("principalPaid", "pokok") === ""
              ? undefined
              : Number(get("principalPaid", "pokok")),
          interestPaid:
            get("interestPaid", "bunga") === ""
              ? undefined
              : Number(get("interestPaid", "bunga")),
          feesPaid:
            get("feesPaid", "biaya") === ""
              ? undefined
              : Number(get("feesPaid", "biaya")),
          excludedFromReports: ["true", "1", "yes", "ya"].includes(
            String(
              get("excludedFromReports", "excluded", "dikecualikan"),
            ).toLowerCase(),
          ),
          note: String(get("note", "catatan") || "") || undefined,
          tags: String(get("tags", "tag") || "")
            .split(/[|;]/)
            .map((x) => x.trim())
            .filter(Boolean),
          syncStatus: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });
      setRows(mapped);
      setDuplicates(dup);
      setErrors(err);
      if (mapped.length) toast.success(`${mapped.length} baris siap ditinjau`);
      else toast.error("Tidak ada baris valid untuk diimpor");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membaca file");
    }
  };
  const doImport = async () => {
    if (!localDB || !rows.length) return;
    const db = localDB;
    setBusy(true);
    try {
      const clean = rows.filter((_, i) => !duplicates.has(i));
      if (!clean.length) {
        toast.error("Tidak ada transaksi baru untuk diimpor");
        return;
      }
      await db.transaction("rw", db.transactions, db.audit, async () => {
        await db.transactions.bulkAdd(clean);
        await db.audit.bulkAdd(
          clean.map((t) => ({
            id: crypto.randomUUID(),
            entityType: "transaction",
            entityId: t.id,
            action: "import",
            after: t,
            createdAt: new Date().toISOString(),
          })),
        );
      });
      await refresh();
      toast.success(`${clean.length} transaksi berhasil diimpor`);
      setRows([]);
      setDuplicates(new Set());
      setErrors([]);
      setFileName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengimpor transaksi");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Impor & Ekspor</h1>
          <div className="muted">
            Impor CSV/Excel dengan pratinjau dan deteksi duplikat sebelum data
            ditambahkan.
          </div>
        </div>
      </div>
      <div className="section-grid">
        <section className="card">
          <div className="section-title">
            <h2>Impor CSV / Excel</h2>
            <Upload size={17} />
          </div>
          <div
            onClick={() => inputRef.current?.click()}
            style={{
              border: "1px dashed #cfd5d2",
              borderRadius: 12,
              padding: 30,
              textAlign: "center",
              cursor: "pointer",
              background: "#fafcfb",
            }}
          >
            <FileSpreadsheet
              size={28}
              color="#43825e"
              style={{ margin: "0 auto 12px" }}
            />
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              Pilih file mutasi
            </div>
            <div className="muted" style={{ marginTop: 6 }}>
              CSV, XLSX, atau XLS · sheet pertama akan dibaca
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              hidden
              onChange={(e) => void readFile(e.target.files?.[0])}
            />
            {fileName && (
              <div style={{ marginTop: 12, fontSize: 12 }}>{fileName}</div>
            )}
          </div>
          <div className="muted" style={{ marginTop: 12, lineHeight: 1.7 }}>
            Kolom yang dikenali: tanggal/date, tipe/type, nominal/amount,
            deskripsi/description, kategori/category, akun/account,
            catatan/note, tag/tags. Nominal harus bilangan bulat rupiah.
          </div>
        </section>
        <section className="card">
          <div className="section-title">
            <h2>Ekspor</h2>
            <Download size={17} />
          </div>
          <p className="muted" style={{ lineHeight: 1.7 }}>
            Unduh transaksi aktif sebagai CSV atau workbook Excel untuk arsip
            dan analisis.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="primary-btn" onClick={exportCsv}>
              <Download size={14} /> Ekspor CSV
            </button>
            <button className="secondary-btn" onClick={exportExcel}>
              <FileSpreadsheet size={14} /> Ekspor Excel
            </button>
          </div>
        </section>
      </div>
      {rows.length > 0 && (
        <section className="card" style={{ marginTop: 18 }}>
          <div className="section-title">
            <div>
              <h2>Pratinjau impor</h2>
              <div className="muted" style={{ marginTop: 4 }}>
                {rows.length} baris valid · {duplicates.size} kemungkinan
                duplikat · {errors.length} baris error
              </div>
            </div>
            <button
              className="primary-btn"
              disabled={busy || rows.every((_, i) => duplicates.has(i))}
              onClick={() => void doImport()}
            >
              {busy
                ? "Mengimpor…"
                : `Impor ${rows.length - duplicates.size} transaksi`}
            </button>
          </div>
          {duplicates.size > 0 && (
            <div
              className="muted"
              style={{
                padding: "8px 0",
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <AlertTriangle size={15} color="#b57c24" /> Baris duplikat tidak
              akan diimpor. Cek ulang sebelum melanjutkan.
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Tanggal</th>
                  <th>Deskripsi</th>
                  <th>Kategori</th>
                  <th>Akun</th>
                  <th style={{ textAlign: "right" }}>Nominal</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((r, i) => (
                  <tr key={r.id}>
                    <td>
                      {duplicates.has(i) ? (
                        <span className="badge amber">Duplikat</span>
                      ) : (
                        <span className="badge green">
                          <CheckCircle2 size={12} /> Baru
                        </span>
                      )}
                    </td>
                    <td>{new Date(r.date).toLocaleDateString("id-ID")}</td>
                    <td>{r.description}</td>
                    <td>{r.category}</td>
                    <td>{r.account}</td>
                    <td style={{ textAlign: "right" }}>
                      {r.amount.toLocaleString("id-ID")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 100 && (
            <div className="muted" style={{ marginTop: 8 }}>
              Menampilkan 100 baris pertama dari {rows.length}.
            </div>
          )}
          {errors.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary>{errors.length} baris gagal validasi</summary>
              <ul>
                {errors.slice(0, 50).map((e, i) => (
                  <li key={i} className="muted">
                    {e}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
    </>
  );
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
