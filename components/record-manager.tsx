"use client";
import { useMemo, useState } from "react";
import { Archive, Plus, Search, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "@/lib/finance/money";
import { useLocalRecords } from "@/components/local-records";
import { useLocalTransactions } from "@/components/transaction-store";
export type Field = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "select" | "textarea" | "checkbox";
  required?: boolean;
  options?: string[];
  placeholder?: string;
  allowNegative?: boolean;
};
export function RecordManager({
  kind,
  title,
  description,
  fields,
  amountKey,
  emptyText = "Belum ada data.",
}: {
  kind: string;
  title: string;
  description: string;
  fields: Field[];
  amountKey?: string;
  emptyText?: string;
}) {
  const { records, ready, save, archive } = useLocalRecords(kind);
  const { ledgerEntries } = useLocalTransactions();
  const [editing, setEditing] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const blank = () =>
    Object.fromEntries(
      fields.map((f) => [f.key, f.type === "number" ? "0" : f.type === "checkbox" ? false : ""]),
    );
  const [form, setForm] = useState<Record<string, unknown>>(blank());
  const filtered = useMemo(
    () =>
      records.filter((r) =>
        (r.name + " " + JSON.stringify(r.data))
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [records, query],
  );
  const start = (r?: (typeof records)[number]) => {
    setEditing(r?.id);
    setForm(r ? { ...blank(), ...r.data, _name: r.name } : blank());
    setOpen(true);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const f of fields) {
      if (f.required && String(form[f.key] ?? "").trim() === "") {
        toast.error(`${f.label} wajib diisi`);
        return;
      }
    }
    const name = String(
      form._name ??
        form[fields.find((f) => f.type === "text")?.key ?? fields[0]?.key] ??
        title,
    ).trim();
    const data = { ...form };
    delete data._name;
    for (const f of fields)
      if (f.type === "number") data[f.key] = Number(data[f.key] || 0);
    try {
      await save(name || title, data, editing);
      toast.success(editing ? "Data diperbarui" : "Data ditambahkan");
      setOpen(false);
      setEditing(undefined);
      setForm(blank());
    } catch {
      toast.error("Gagal menyimpan data");
    }
  };

  const getInputValue = (value: unknown): string | number => {
    if (typeof value === "string" || typeof value === "number") {
      return value;
    }

    return "";
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{title}</h1>
          <div className="muted">{description}</div>
        </div>
        <button className="primary-btn" onClick={() => start()}>
          <Plus size={15} /> Tambah data
        </button>
      </div>
      <section className="card">
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "space-between",
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <div className="muted">
            {records.length} data aktif · tersimpan di perangkat ini
          </div>
          <div style={{ position: "relative", width: "min(100%,320px)" }}>
            <Search
              size={15}
              style={{ position: "absolute", left: 10, top: 11, color: "#888" }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari data…"
              style={{
                width: "100%",
                padding: "9px 10px 9px 32px",
                border: "1px solid #e1e4e8",
                borderRadius: 9,
              }}
            />
          </div>
        </div>
        {!ready ? (
          <div className="empty">Memuat data…</div>
        ) : !filtered.length ? (
          <div className="empty">{emptyText}</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  {fields.map((f) => (
                    <th key={f.key}>{f.label}</th>
                  ))}
                  {kind === "accounts" && <th>Saldo berjalan*</th>}
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.name}</strong>
                    </td>
                    {fields.map((f) => (
                      <td key={f.key}>
                        {f.type === "checkbox"
                          ? (r.data[f.key] === true ? "Aktif" : "Tidak")
                          : amountKey === f.key
                            ? formatIDR(Number(r.data[f.key] || 0))
                            : f.type === "number" &&
                                /amount|value|balance|limit|target|payment|principal|allocated/i.test(
                                  f.key,
                                )
                              ? formatIDR(Number(r.data[f.key] || 0))
                              : String(r.data[f.key] ?? "—") || "—"}
                      </td>
                    ))}
                    {kind === "accounts" && (
                      <td style={{ fontWeight: 750 }}>
                        {formatIDR(
                          Number(r.data.openingBalance || 0) +
                            ledgerEntries
                              .filter((e) => e.account === r.name)
                              .reduce((sum, e) => sum + e.amount, 0),
                        )}
                      </td>
                    )}
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="secondary-btn"
                          onClick={() => start(r)}
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          className="secondary-btn"
                          onClick={async () => {
                            if (confirm(`Arsipkan ${r.name}?`)) {
                              await archive(r.id);
                              toast.success("Data diarsipkan");
                            }
                          }}
                        >
                          <Archive size={13} />
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
      {kind === "accounts" && (
        <div className="muted" style={{ marginTop: 8 }}>
          *Saldo berjalan dihitung dari saldo awal + mutasi lokal. Kartu kredit,
          cicilan, dan rekonsiliasi perlu ditinjau sebelum dipakai sebagai saldo
          final.
        </div>
      )}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
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
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <form
            className="card"
            onSubmit={submit}
            style={{
              width: "min(650px,100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 90px #0002",
            }}
          >
            <div className="section-title">
              <div>
                <h2>
                  {editing ? "Edit" : "Tambah"} {title.toLowerCase()}
                </h2>
                <div className="muted" style={{ marginTop: 4 }}>
                  Data tersimpan offline di browser ini.
                </div>
              </div>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setOpen(false)}
              >
                <X size={14} />
              </button>
            </div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 700,
                margin: "16px 0 6px",
              }}
            >
              Nama / judul
            </label>
            <input
              value={typeof form._name === "string" ? form._name : ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, _name: e.target.value }))
              }
              placeholder="Nama data"
              required
              style={inputStyle}
            />
            <div className="form-grid" style={{ marginTop: 12 }}>
              {fields.map((f) => (
                f.type === "checkbox" ? (
                  <label
                    key={f.key}
                    style={{
                      gridColumn: "1 / -1",
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
                      checked={form[f.key] === true}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, [f.key]: e.target.checked }))
                      }
                      style={{ marginTop: 3 }}
                    />
                    <span>
                      <strong style={{ display: "block", fontSize: 12 }}>
                        {f.label}
                      </strong>
                      <span
                        className="muted"
                        style={{ display: "block", marginTop: 4, lineHeight: 1.5 }}
                      >
                        {f.key === "excludeFromReports"
                          ? "Transaksi dari dompet ini tetap tercatat dan saldo tetap berubah, tetapi tidak dihitung dalam laporan dan budget."
                          : "Aktifkan opsi ini jika data tidak ingin dihitung dalam laporan."}
                      </span>
                    </span>
                  </label>
                ) : (
                <label
                  key={f.key}
                  style={{
                    display: "grid",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 650,
                  }}
                >
                  {f.label}
                  {f.type === "select" ? (
                    <select
                      required={f.required}
                      value={getInputValue(form[f.key])}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, [f.key]: e.target.value }))
                      }
                      style={inputStyle}
                    >
                      <option value="">Pilih</option>
                      {f.options?.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea
                      value={getInputValue(form[f.key])}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, [f.key]: e.target.value }))
                      }
                      style={{ ...inputStyle, minHeight: 80 }}
                    />
                  ) : (
                    <input
                      required={f.required}
                      type={f.type ?? "text"}
                      min={
                        f.type === "number" && !f.allowNegative ? 0 : undefined
                      }
                      step={f.type === "number" ? 1 : undefined}
                      value={getInputValue(form[f.key])}
                      placeholder={f.placeholder}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, [f.key]: e.target.value }))
                      }
                      style={inputStyle}
                    />
                  )}
                </label>
                )
              ))}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 20,
              }}
            >
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setOpen(false)}
              >
                Batal
              </button>
              <button className="primary-btn" type="submit">
                <Save size={14} /> Simpan
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #dfe4e0",
  borderRadius: 9,
  padding: "10px 11px",
  fontSize: 13,
  background: "#fff",
  color: "#252b28",
};
