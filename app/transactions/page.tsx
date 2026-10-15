"use client";
import { FormEvent, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Check,
  CirclePlus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "@/lib/finance/money";
import { DEFAULT_CATEGORIES } from "@/lib/offline/database";
import { useLocalTransactions } from "@/components/transaction-store";
import { useLocalRecords } from "@/components/local-records";

type TxType =
  | "income"
  | "expense"
  | "transfer"
  | "refund"
  | "asset_purchase"
  | "debt_payment"
  | "receivable_payment"
  | "reimburse_payment"
  | "adjustment";
export default function TransactionsPage() {
  const { transactions, ready, add, update, softDelete } =
    useLocalTransactions();
  const { records: categoryRecords } = useLocalRecords("categories");
  const { records: accountRecords } = useLocalRecords("accounts");
  const accountOptions = accountRecords.map((a) => a.name);
  const categoriesFor = (txType: TxType) =>
    categoryRecords.filter((c) => {
      const v = String(c.data.type || "expense").toLowerCase();
      return ["income", "receivable_payment"].includes(txType)
        ? ["income", "pemasukan"].includes(v)
        : txType === "transfer"
          ? v === "transfer"
          : txType === "reimburse_payment"
            ? ["allocation", "alokasi"].includes(v)
            : ["expense", "pengeluaran"].includes(v);
    });
  const categoryOptions = (txType: TxType) => {
    const found = categoriesFor(txType).map((c) => c.name);
    return found.length
      ? found
      : DEFAULT_CATEGORIES.filter(
          (c) =>
            c.type ===
            (["income", "receivable_payment"].includes(txType)
              ? "income"
              : txType === "transfer"
                ? "transfer"
                : txType === "reimburse_payment"
                  ? "allocation"
                  : "expense"),
        ).map((c) => c.name);
  };
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<TxType>("expense");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Makan & Minum");
  const [account, setAccount] = useState("Bank utama");
  const [excluded, setExcluded] = useState(false);
  const [note, setNote] = useState("");
  const [tagText, setTagText] = useState("");
  const [destinationAccount, setDestinationAccount] = useState("Cash");
  const [partnerPaid, setPartnerPaid] = useState(false);
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitRows, setSplitRows] = useState<
    { category: string; amount: string; note: string }[]
  >([
    { category: "Makan & Minum", amount: "", note: "" },
    { category: "Transportasi", amount: "", note: "" },
  ]);
  const visible = useMemo(
    () =>
      transactions.filter((t) => {
        const q = query.toLowerCase();
        const matchesQuery = [
          t.description,
          t.category,
          t.account,
          t.note ?? "",
          ...t.tags,
        ].some((v) => v.toLowerCase().includes(q));
        const matchesFilter =
          filter === "all" ||
          (filter === "excluded"
            ? t.excludedFromReports
            : filter === "reimburse"
              ? t.reimburseStatus === "pending"
              : filter === "income"
                ? t.type === "income"
                : filter === "expense"
                  ? ["expense", "asset_purchase", "debt_payment"].includes(
                      t.type,
                    )
                  : t.type === filter);
        return matchesQuery && matchesFilter;
      }),
    [transactions, query, filter],
  );
  const reset = () => {
    setType("expense");
    setDate(new Date().toISOString().slice(0, 10));
    setAmount("");
    setDescription("");
    setCategory("Makan & Minum");
    setAccount("Bank utama");
    setExcluded(false);
    setNote("");
    setTagText("");
    setDestinationAccount("Cash");
    setPartnerPaid(false);
    setSplitEnabled(false);
    setSplitRows([
      { category: "Makan & Minum", amount: "", note: "" },
      { category: "Transportasi", amount: "", note: "" },
    ]);
    setEditingId(null);
  };
  const startEdit = (t: (typeof transactions)[number]) => {
    setEditingId(t.id);
    setType(t.type);
    setDate(t.date.slice(0, 10));
    setAmount(String(t.amount));
    setDescription(t.description);
    setCategory(t.category);
    setAccount(t.account);
    setExcluded(t.excludedFromReports);
    setNote(t.note ?? "");
    setTagText(t.tags.join(", "));
    setDestinationAccount(t.destinationAccount ?? "Cash");
    setPartnerPaid(Boolean(t.partnerPaid));
    setSplitEnabled(Boolean(t.splitLines?.length));
    setSplitRows(
      t.splitLines?.map((x) => ({
        category: x.category,
        amount: String(x.amount),
        note: x.note ?? "",
      })) ?? [
        { category: "Makan & Minum", amount: "", note: "" },
        { category: "Transportasi", amount: "", note: "" },
      ],
    );
    setShowForm(true);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!Number.isSafeInteger(numericAmount) || numericAmount <= 0) {
      toast.error("Nominal harus berupa bilangan bulat rupiah lebih dari nol.");
      return;
    }
    if (!description.trim()) {
      toast.error("Deskripsi transaksi wajib diisi.");
      return;
    }
    if (type === "transfer" && account === destinationAccount) {
      toast.error("Akun sumber dan tujuan transfer harus berbeda.");
      return;
    }
    const splitLines = splitEnabled
      ? splitRows.map((x) => ({
          category: x.category,
          amount: Number(x.amount),
          note: x.note.trim() || undefined,
        }))
      : undefined;
    if (
      splitEnabled &&
      (splitLines!.length < 2 ||
        splitLines!.some(
          (x) => !Number.isSafeInteger(x.amount) || x.amount <= 0,
        ) ||
        splitLines!.reduce((s, x) => s + x.amount, 0) !== numericAmount)
    ) {
      toast.error(
        "Total split harus sama persis dengan nominal transaksi, dan setiap baris harus lebih dari nol.",
      );
      return;
    }
    const data = {
      type,
      date: new Date(`${date}T12:00:00`).toISOString(),
      amount: numericAmount,
      description: description.trim(),
      category,
      account,
      destinationAccount: type === "transfer" ? destinationAccount : undefined,
      partnerPaid: type === "expense" ? partnerPaid : false,
      reimburseStatus:
        type === "expense" && partnerPaid
          ? ("pending" as const)
          : ("not_applicable" as const),
      splitLines,
      excludedFromReports: excluded,
      note: note.trim() || undefined,
      tags: tagText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      if (editingId) {
        await update(editingId, data);
        toast.success("Transaksi diperbarui di penyimpanan lokal.");
      } else {
        await add(data);
        toast.success(
          "Transaksi disimpan secara lokal. Sinkronisasi cloud belum dikonfigurasi.",
        );
      }
      setShowForm(false);
      reset();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menyimpan transaksi.",
      );
    }
  };
  const remove = async (id: string) => {
    if (!confirm("Arsipkan transaksi ini? Data tidak akan dihapus permanen."))
      return;
    await softDelete(id);
    toast.success("Transaksi diarsipkan.");
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Transaksi</h1>
          <div className="muted">
            Catat dan kelola seluruh pergerakan uangmu.
          </div>
        </div>
        <button
          className="primary-btn"
          onClick={() => {
            reset();
            setShowForm(true);
          }}
        >
          <CirclePlus size={15} /> Tambah transaksi
        </button>
      </div>
      <div className="metric-grid" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="metric-label">Total tercatat</div>
          <div className="metric-value">{transactions.length}</div>
          <div className="metric-foot">Transaksi aktif di perangkat ini</div>
        </div>
        <div className="card">
          <div className="metric-label">Menunggu sinkronisasi</div>
          <div className="metric-value">
            {transactions.filter((t) => t.syncStatus === "pending").length}
          </div>
          <div className="metric-foot">
            Tersimpan lokal · cloud belum terhubung
          </div>
        </div>
        <div className="card">
          <div className="metric-label">Dikecualikan</div>
          <div className="metric-value">
            {transactions.filter((t) => t.excludedFromReports).length}
          </div>
          <div className="metric-foot">Tetap ada dalam histori</div>
        </div>
        <div className="card">
          <div className="metric-label">Arsip</div>
          <div className="metric-value">—</div>
          <div className="metric-foot">Soft delete</div>
        </div>
      </div>
      <section className="card">
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <div
            style={{ position: "relative", flex: "1 1 240px", maxWidth: 420 }}
          >
            <Search
              size={15}
              style={{
                position: "absolute",
                left: 12,
                top: 12,
                color: "#90969d",
              }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari deskripsi, kategori, akun, tag…"
              style={{
                width: "100%",
                padding: "10px 12px 10px 36px",
                border: "1px solid #e1e4e8",
                borderRadius: 9,
                fontSize: 12,
              }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SlidersHorizontal size={15} color="#8a9098" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                border: "1px solid #e1e4e8",
                borderRadius: 9,
                padding: "10px 12px",
                fontSize: 12,
                background: "#fff",
              }}
            >
              <option value="all">Semua transaksi</option>
              <option value="income">Pemasukan</option>
              <option value="expense">Pengeluaran</option>
              <option value="transfer">Transfer</option>
              <option value="excluded">Dikecualikan</option>
              <option value="reimburse">Menunggu reimburse</option>
            </select>
          </div>
        </div>
        {!ready ? (
          <div className="empty">Memuat transaksi…</div>
        ) : visible.length === 0 ? (
          <div className="empty">
            <ArrowLeftRight
              size={26}
              style={{ margin: "0 auto 10px", opacity: 0.4 }}
            />
            <div>Belum ada transaksi yang cocok.</div>
            <div style={{ marginTop: 5 }}>
              Tambahkan transaksi atau ubah filter pencarian.
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Transaksi</th>
                  <th>Kategori</th>
                  <th>Akun</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Nominal</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 9,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700 }}>{t.description}</div>
                          {t.note && (
                            <div className="muted" style={{ marginTop: 3 }}>
                              {t.note}
                            </div>
                          )}
                          {t.reimburseStatus === "pending" && (
                            <div style={{ marginTop: 4 }}>
                              <span className="badge amber">
                                Menunggu reimburse
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{t.category}</td>
                    <td>{t.account}</td>
                    <td>{new Date(t.date).toLocaleDateString("id-ID")}</td>
                    <td>
                      {t.excludedFromReports ? (
                        <span className="badge amber">Dikecualikan</span>
                      ) : (
                        <span className="badge green">Masuk laporan</span>
                      )}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 700,
                        color: t.type === "income" ? "#187343" : "#343940",
                      }}
                    >
                      {["income", "refund", "receivable_payment"].includes(
                        t.type,
                      )
                        ? "+"
                        : [
                              "expense",
                              "asset_purchase",
                              "debt_payment",
                              "reimburse_payment",
                            ].includes(t.type)
                          ? "−"
                          : ""}
                      {formatIDR(t.amount)}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 5 }}>
                        {t.reimburseStatus === "pending" && (
                          <button
                            className="secondary-btn"
                            style={{ padding: "6px 8px" }}
                            onClick={async () => {
                              if (
                                !confirm(
                                  "Catat pembayaran kembali kepada partner? Ini mengurangi saldo akun tetapi tidak menghitung pengeluaran kedua kali.",
                                )
                              )
                                return;
                              await add({
                                type: "reimburse_payment",
                                date: new Date().toISOString(),
                                amount: t.amount,
                                description: `Reimburse partner: ${t.description}`,
                                category: "Reimburse partner",
                                account: "Bank utama",
                                excludedFromReports: false,
                                note: `Pembayaran reimburse untuk transaksi ${t.id}; tidak dihitung sebagai pengeluaran kedua kali.`,
                                tags: [...t.tags, "reimburse"],
                                relatedId: t.id,
                                reimburseStatus: "not_applicable",
                              });
                              await update(t.id, {
                                reimburseStatus: "reimbursed",
                              });
                              toast.success(
                                "Pembayaran reimburse partner dicatat",
                              );
                            }}
                          >
                            Reimburse dibayar
                          </button>
                        )}
                        <button
                          className="secondary-btn"
                          style={{ padding: "6px 8px" }}
                          onClick={() => startEdit(t)}
                        >
                          Edit
                        </button>
                        <button
                          className="secondary-btn"
                          style={{ padding: "6px 8px" }}
                          onClick={() => void remove(t.id)}
                          aria-label="Arsipkan"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {showForm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Form transaksi"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "#10181266",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowForm(false);
              reset();
            }
          }}
        >
          <div
            className="card"
            style={{
              width: "min(720px,100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 90px #0002",
            }}
          >
            <div className="section-title">
              <div>
                <h2>{editingId ? "Edit transaksi" : "Tambah transaksi"}</h2>
                <div className="muted" style={{ marginTop: 5 }}>
                  Data disimpan di perangkat untuk penggunaan offline.
                </div>
              </div>
              <button
                className="secondary-btn"
                onClick={() => {
                  setShowForm(false);
                  reset();
                }}
                aria-label="Tutup"
              >
                <X size={15} />
              </button>
            </div>
            <form onSubmit={submit} style={{ display: "grid", gap: 17 }}>
              <div className="field">
                <label>Jenis transaksi</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {(
                    [
                      { v: "expense", label: "Pengeluaran" },
                      { v: "income", label: "Pemasukan" },
                      { v: "transfer", label: "Transfer" },
                      { v: "refund", label: "Refund" },
                      { v: "asset_purchase", label: "Pembelian aset" },
                      { v: "debt_payment", label: "Pembayaran utang" },
                      { v: "receivable_payment", label: "Penerimaan piutang" },
                      { v: "reimburse_payment", label: "Pembayaran reimburse" },
                    ] as { v: TxType; label: string }[]
                  ).map((item) => (
                    <button
                      type="button"
                      key={item.v}
                      onClick={() => {
                        setType(item.v);
                        setCategory(categoryOptions(item.v)[0] ?? "Lainnya");
                      }}
                      className={
                        type === item.v ? "primary-btn" : "secondary-btn"
                      }
                      style={{ padding: "9px 11px" }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>Nominal (Rp)</label>
                  <input
                    required
                    inputMode="numeric"
                    type="number"
                    min="1"
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Contoh: 2000000"
                  />
                </div>
                <div className="field">
                  <label>Tanggal</label>
                  <input
                    className="w-full"
                    required
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Deskripsi</label>
                  <input
                    required
                    maxLength={240}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Contoh: Reimburse biaya kerja"
                  />
                </div>
                <div className="field">
                  <label>Kategori</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {categoryOptions(type).map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Akun</label>
                  <select
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                  >
                    {accountOptions.length
                      ? accountOptions.map((a) => <option key={a}>{a}</option>)
                      : ["Bank utama", "Cash"].map((a) => (
                          <option key={a}>{a}</option>
                        ))}
                  </select>
                </div>
                {type === "transfer" && (
                  <div className="field">
                    <label>Akun tujuan</label>
                    <select
                      value={destinationAccount}
                      onChange={(e) => setDestinationAccount(e.target.value)}
                    >
                      {accountOptions.length
                        ? accountOptions.map((a) => (
                            <option key={a}>{a}</option>
                          ))
                        : ["Cash", "Bank utama"].map((a) => (
                            <option key={a}>{a}</option>
                          ))}
                    </select>
                  </div>
                )}
                <div className="field">
                  <label>Tag (pisahkan dengan koma)</label>
                  <input
                    value={tagText}
                    onChange={(e) => setTagText(e.target.value)}
                    placeholder="kerja, gear, urgent"
                  />
                </div>
              </div>
              {type === "expense" && (
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: 13,
                    border: "1px solid #e4e7ea",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={partnerPaid}
                    onChange={(e) => setPartnerPaid(e.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    <strong style={{ display: "block", fontSize: 12 }}>
                      Dibayar oleh partner
                    </strong>
                    <span
                      className="muted"
                      style={{ display: "block", marginTop: 4 }}
                    >
                      Buat item reimburse otomatis. Tidak mengurangi saldo akun
                      sampai kamu membayar sendiri.
                    </span>
                  </span>
                </label>
              )}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <input
                  type="checkbox"
                  checked={splitEnabled}
                  onChange={(e) => setSplitEnabled(e.target.checked)}
                />{" "}
                Bagi transaksi ke beberapa kategori
              </label>
              {splitEnabled && (
                <div
                  style={{
                    border: "1px solid #e4e7ea",
                    borderRadius: 10,
                    padding: 12,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  {splitRows.map((row, i) => (
                    <div
                      key={i}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.2fr .8fr 1fr auto",
                        gap: 7,
                        alignItems: "center",
                      }}
                    >
                      <select
                        value={row.category}
                        onChange={(e) =>
                          setSplitRows((a) =>
                            a.map((x, j) =>
                              j === i ? { ...x, category: e.target.value } : x,
                            ),
                          )
                        }
                      >
                        {categoryOptions("expense").map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="Nominal"
                        value={row.amount}
                        onChange={(e) =>
                          setSplitRows((a) =>
                            a.map((x, j) =>
                              j === i ? { ...x, amount: e.target.value } : x,
                            ),
                          )
                        }
                      />
                      <input
                        placeholder="Catatan (opsional)"
                        value={row.note}
                        onChange={(e) =>
                          setSplitRows((a) =>
                            a.map((x, j) =>
                              j === i ? { ...x, note: e.target.value } : x,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() =>
                          setSplitRows((a) => a.filter((_, j) => j !== i))
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() =>
                      setSplitRows((a) => [
                        ...a,
                        { category: "Lainnya", amount: "", note: "" },
                      ])
                    }
                  >
                    Tambah baris split
                  </button>
                  <div className="muted">
                    Total split:{" "}
                    {formatIDR(
                      splitRows.reduce((s, x) => s + Number(x.amount || 0), 0),
                    )}{" "}
                    / {formatIDR(Number(amount || 0))}
                  </div>
                </div>
              )}
              <div className="field">
                <label>Catatan</label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Catatan tambahan…"
                />
              </div>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: 13,
                  border: "1px solid #e4e7ea",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={excluded}
                  onChange={(e) => setExcluded(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <strong style={{ display: "block", fontSize: 12 }}>
                    Kecualikan dari laporan
                  </strong>
                  <span
                    className="muted"
                    style={{ display: "block", marginTop: 4, lineHeight: 1.5 }}
                  >
                    Transaksi tidak masuk laporan dan budget, tetapi tetap
                    tercatat di histori.
                  </span>
                </span>
              </label>
              <div
                style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
              >
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setShowForm(false);
                    reset();
                  }}
                >
                  Batal
                </button>
                <button type="submit" className="primary-btn">
                  <Check size={14} />
                  {editingId ? "Simpan perubahan" : "Simpan transaksi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
