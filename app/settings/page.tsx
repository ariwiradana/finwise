"use client";
import { useEffect, useState } from "react";
import { localDB, DEFAULT_CATEGORIES } from "@/lib/offline/database";
import { toast } from "sonner";
import {
  Download,
  Upload,
  Bell,
  Eye,
  ShieldCheck,
  History,
  RefreshCw,
} from "lucide-react";
export default function SettingsPage() {
  type AuditItem = {
    id: string;
    createdAt: string;
    entityType: string;
    action: string;
    entityId: string;
  };

  type SyncConflict = {
    remotePayload: unknown;
    remoteVersion: number;
    remoteUpdatedAt?: string | null;
  };

  const [privacy, setPrivacy] = useState(false);
  const [pin, setPin] = useState("");
  const [hasPin, setHasPin] = useState(false);
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [syncState, setSyncState] = useState("Belum disinkronkan");
  const [conflict, setConflict] = useState<SyncConflict | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  useEffect(() => {
    void (async () => {
      if (!localDB) return;
      const s = await localDB.settings.get("privacy");
      setPrivacy(Boolean(s?.value));
      setHasPin(Boolean(await localDB.settings.get("pinHash")));
      setAudit(
        await localDB.audit.orderBy("createdAt").reverse().limit(20).toArray(),
      );
      const c = await localDB.settings.get("syncConflict");
      if (c?.value) setConflict(c.value as SyncConflict);
      const v = await localDB.settings.get("cloudVersion");
      if (v?.value) setSyncState(`Versi lokal terakhir ${v.value}`);
    })();
  }, []);
  const backup = async () => {
    if (!localDB) return;
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      transactions: await localDB.transactions.toArray(),
      accounts: await localDB.accounts.toArray(),
      ledgerEntries: await localDB.ledgerEntries.toArray(),
      records: await localDB.records.toArray(),
      audit: await localDB.audit.toArray(),
      settings: await localDB.settings
        .toArray()
        .then((a) =>
          a.filter(
            (x) => !["pinHash", "cloudVersion", "syncConflict"].includes(x.key),
          ),
        ),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `finwise-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup lokal berhasil dibuat");
  };
  const restore = async (file?: File) => {
    if (!file || !localDB) return;
    const db = localDB;
    try {
      const d = JSON.parse(await file.text());
      if (
        d.version !== 1 ||
        !Array.isArray(d.transactions) ||
        !Array.isArray(d.records)
      )
        throw new Error("Format backup tidak dikenal");
      if (!confirm("Restore akan mengganti data lokal saat ini. Lanjutkan?"))
        return;

      await db.transaction(
        "rw",
        [
          db.transactions,
          db.accounts,
          db.ledgerEntries,
          db.records,
          db.audit,
          db.settings,
        ],
        async () => {
          await db.transactions.clear();
          await db.accounts.clear();
          await db.ledgerEntries.clear();
          await db.records.clear();
          await db.audit.clear();
          await db.settings.clear();

          await db.transactions.bulkPut(d.transactions);
          await db.accounts.bulkPut(d.accounts ?? []);
          await db.ledgerEntries.bulkPut(d.ledgerEntries ?? []);
          await db.records.bulkPut(d.records);
          await db.audit.bulkPut(d.audit ?? []);
          await db.settings.bulkPut(d.settings ?? []);
        },
      );
      toast.success("Backup berhasil dipulihkan");
      location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backup tidak valid");
    }
  };
  const collectSnapshot = async () => {
    if (!localDB) throw new Error("Database lokal tidak tersedia");
    return {
      schemaVersion: 1,
      transactions: await localDB.transactions.toArray(),
      accounts: await localDB.accounts.toArray(),
      ledgerEntries: await localDB.ledgerEntries.toArray(),
      records: await localDB.records.toArray(),
      audit: await localDB.audit.toArray(),
      settings: await localDB.settings
        .toArray()
        .then((a) =>
          a.filter(
            (x) => !["pinHash", "cloudVersion", "syncConflict"].includes(x.key),
          ),
        ),
    };
  };
  const syncNow = async () => {
    if (!localDB) return;
    setSyncBusy(true);
    try {
      const remoteRes = await fetch("/api/sync", { cache: "no-store" });
      if (remoteRes.status === 401)
        throw new Error(
          "Login dulu melalui menu /login untuk mengaktifkan cloud sync",
        );
      const remote = await remoteRes.json();
      if (!remoteRes.ok) throw new Error(remote.error || "Gagal membaca cloud");
      const versionSetting = await localDB.settings.get("cloudVersion");
      const base = Number(versionSetting?.value ?? 0);
      const local = await collectSnapshot();
      const localCount =
        local.transactions.length +
        local.records.filter(
          (r: { kind: string }) => !["accounts", "categories"].includes(r.kind),
        ).length +
        local.records.filter(
          (r: { kind: string; name: string }) =>
            r.kind === "accounts" && !["Bank utama", "Cash"].includes(r.name),
        ).length +
        local.records.filter(
          (r: { kind: string; name: string }) =>
            r.kind === "categories" &&
            !DEFAULT_CATEGORIES.some((c) => c.name === r.name),
        ).length +
        local.accounts.length;
      if (
        remote.version > 0 &&
        remote.version !== base &&
        (localCount > 0 || base > 0)
      ) {
        const c = {
          remoteVersion: remote.version,
          remotePayload: remote.payload,
          localPayload: local,
          remoteUpdatedAt: remote.updatedAt,
        };
        await localDB.settings.put({ key: "syncConflict", value: c });
        setConflict(c);
        setSyncState("Konflik perlu ditinjau");
        toast.warning(
          "Data cloud berbeda dari versi lokal. Pilih tindakan setelah meninjau.",
        );
        return;
      }
      if (remote.version > 0 && localCount === 0) {
        await applySnapshot(remote.payload);
        await localDB.settings.put({
          key: "cloudVersion",
          value: remote.version,
        });
        setSyncState(`Pulih dari cloud · versi ${remote.version}`);
        toast.success("Data cloud dipulihkan ke perangkat ini");
        return;
      }
      const res = await fetch("/api/sync", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseVersion: remote.version, payload: local }),
      });
      const result = await res.json();
      if (res.status === 409) {
        const c = {
          remoteVersion: result.version,
          remotePayload: result.payload,
          localPayload: local,
          remoteUpdatedAt: result.updatedAt,
        };
        await localDB.settings.put({ key: "syncConflict", value: c });
        setConflict(c);
        setSyncState("Konflik perlu ditinjau");
        return;
      }
      if (!res.ok) throw new Error(result.error || "Sinkronisasi gagal");
      await localDB.settings.put({
        key: "cloudVersion",
        value: result.version,
      });
      setSyncState(`Tersinkron · versi ${result.version}`);
      toast.success("Sinkronisasi cloud berhasil");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sinkronisasi gagal");
    } finally {
      setSyncBusy(false);
    }
  };

  const applySnapshot = async (payload: unknown) => {
    if (!localDB || !payload) {
      throw new Error("Snapshot cloud kosong");
    }

    const db = localDB;
    const localPin = await db.settings.get("pinHash");

    await db.transaction(
      "rw",
      [
        db.transactions,
        db.accounts,
        db.ledgerEntries,
        db.records,
        db.audit,
        db.settings,
      ],
      async () => {
        await db.transactions.clear();
        await db.accounts.clear();
        await db.ledgerEntries.clear();
        await db.records.clear();
        await db.audit.clear();
        await db.settings.clear();

        await db.transactions.bulkPut(
          (
            payload as {
              transactions: typeof db.transactions extends never
                ? never[]
                : Parameters<typeof db.transactions.bulkPut>[0];
            }
          ).transactions ?? [],
        );
        await db.accounts.bulkPut(
          (
            payload as {
              accounts: typeof db.accounts extends never
                ? never[]
                : Parameters<typeof db.accounts.bulkPut>[0];
            }
          ).accounts ?? [],
        );
        await db.ledgerEntries.bulkPut(
          (
            payload as {
              ledgerEntries: typeof db.ledgerEntries extends never
                ? never[]
                : Parameters<typeof db.ledgerEntries.bulkPut>[0];
            }
          ).ledgerEntries ?? [],
        );
        await db.records.bulkPut(
          (
            payload as {
              records: typeof db.records extends never
                ? never[]
                : Parameters<typeof db.records.bulkPut>[0];
            }
          ).records ?? [],
        );
        await db.audit.bulkPut(
          (
            payload as {
              audit: typeof db.audit extends never
                ? never[]
                : Parameters<typeof db.audit.bulkPut>[0];
            }
          ).audit ?? [],
        );

        const snapshot = payload as Record<string, unknown>;

        const settings: { key: string; value: unknown }[] = Array.isArray(
          snapshot.settings,
        )
          ? snapshot.settings.filter(
              (x: unknown): x is { key: string; value: unknown } =>
                typeof x === "object" &&
                x !== null &&
                "key" in x &&
                typeof x.key === "string" &&
                !["pinHash", "cloudVersion", "syncConflict"].includes(x.key),
            )
          : [];

        await db.settings.bulkPut(settings);

        if (localPin) {
          await db.settings.put(localPin);
        }
      },
    );
  };
  const chooseConflict = async (choice: "local" | "remote") => {
    if (!localDB || !conflict) return;
    if (
      !confirm(
        choice === "local"
          ? "Gunakan data lokal untuk menimpa snapshot cloud saat ini? Pastikan kamu sudah memeriksa perbedaannya."
          : "Pulihkan snapshot cloud dan ganti data lokal di browser ini? Unduh backup lokal terlebih dahulu jika perlu.",
      )
    )
      return;
    setSyncBusy(true);
    try {
      if (choice === "remote") {
        await applySnapshot(conflict.remotePayload);
        await localDB.settings.put({
          key: "cloudVersion",
          value: conflict.remoteVersion,
        });
        setSyncState(`Pulih dari cloud · versi ${conflict.remoteVersion}`);
      } else {
        const res = await fetch("/api/sync", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseVersion: conflict.remoteVersion,
            payload: await collectSnapshot(),
          }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Gagal menulis ke cloud");
        await localDB.settings.put({ key: "cloudVersion", value: d.version });
        setSyncState(`Tersinkron · versi ${d.version}`);
      }
      await localDB.settings.delete("syncConflict");
      setConflict(null);
      toast.success("Pilihan sinkronisasi selesai");
      location.reload();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Gagal menyelesaikan konflik",
      );
    } finally {
      setSyncBusy(false);
    }
  };
  const enableNotifications = async () => {
    if (!("Notification" in window)) {
      toast.error("Browser tidak mendukung notifikasi");
      return;
    }
    const p = await Notification.requestPermission();
    if (p === "granted") {
      new Notification("Finwise", {
        body: "Notifikasi berhasil diaktifkan pada browser ini.",
      });
      toast.success("Izin notifikasi aktif");
    } else toast.error("Izin notifikasi tidak diberikan");
  };
  const savePin = async () => {
    if (!localDB) return;
    if (!/^\d{4,8}$/.test(pin)) {
      toast.error("PIN harus 4–8 digit");
      return;
    }
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(pin),
    );
    const hash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    await localDB.settings.put({ key: "pinHash", value: hash });
    sessionStorage.setItem("finwise_pin_verified", "yes");
    setHasPin(true);
    setPin("");
    toast.success(
      "PIN lokal tersimpan. Ini bukan pengganti autentikasi server.",
    );
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Pengaturan & Audit</h1>
          <div className="muted">
            Privasi, notifikasi, backup lokal, dan histori perubahan.
          </div>
        </div>
      </div>
      <div className="section-grid">
        <section className="card">
          <div className="section-title">
            <h2>
              <Eye
                size={16}
                style={{ verticalAlign: "middle", marginRight: 7 }}
              />
              Privasi
            </h2>
          </div>
          <label
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              fontSize: 13,
            }}
          >
            <input
              type="checkbox"
              checked={privacy}
              onChange={async (e) => {
                setPrivacy(e.target.checked);
                await localDB?.settings.put({
                  key: "privacy",
                  value: e.target.checked,
                });
              }}
            />{" "}
            Samarkan nominal pada dashboard dan laporan
          </label>
          <div
            style={{
              borderTop: "1px solid #eee",
              marginTop: 18,
              paddingTop: 16,
            }}
          >
            <h3 style={{ fontSize: 13 }}>PIN perangkat (opsional)</h3>
            <p className="muted">
              PIN disimpan sebagai hash di browser ini dan diminta saat membuka
              sesi aplikasi; tidak mengunci otomatis saat idle dan bukan
              pengganti login server.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 8))
                }
                type="password"
                inputMode="numeric"
                placeholder={hasPin ? "PIN sudah disetel" : "PIN 4–8 digit"}
                style={inp}
              />
              <button className="primary-btn" onClick={() => void savePin()}>
                Simpan PIN
              </button>
            </div>
          </div>
        </section>
        <section className="card">
          <div className="section-title">
            <h2>
              <Bell
                size={16}
                style={{ verticalAlign: "middle", marginRight: 7 }}
              />
              Notifikasi browser
            </h2>
          </div>
          <p className="muted" style={{ lineHeight: 1.7 }}>
            Aktifkan izin notifikasi. Pengingat otomatis terjadwal masih
            bergantung pada aplikasi yang sedang dibuka; browser tidak selalu
            menjalankan tugas saat aplikasi ditutup.
          </p>
          <button
            className="secondary-btn"
            onClick={() => void enableNotifications()}
          >
            Aktifkan & tes notifikasi
          </button>
        </section>
        <section className="card">
          <div className="section-title">
            <h2>
              <ShieldCheck
                size={16}
                style={{ verticalAlign: "middle", marginRight: 7 }}
              />
              Backup & restore
            </h2>
          </div>
          <p className="muted" style={{ lineHeight: 1.7 }}>
            Backup mencakup transaksi, akun, data modul, audit, dan pengaturan
            yang tidak sensitif. Simpan file backup di lokasi aman.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="primary-btn" onClick={() => void backup()}>
              <Download size={14} /> Unduh backup
            </button>
            <label className="secondary-btn" style={{ cursor: "pointer" }}>
              <Upload size={14} /> Restore backup
              <input
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => void restore(e.target.files?.[0])}
              />
            </label>
          </div>
        </section>
        <section className="card">
          <div className="section-title">
            <h2>
              <RefreshCw
                size={16}
                style={{ verticalAlign: "middle", marginRight: 7 }}
              />
              Sinkronisasi cloud
            </h2>
            <span className="badge">{syncState}</span>
          </div>
          <p className="muted" style={{ lineHeight: 1.7 }}>
            Snapshot cloud tersimpan per pengguna dan memakai version check.
            Jika versi cloud berbeda, aplikasi tidak menimpa otomatis; konflik
            harus dipilih secara manual.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {/* <a href="/login" className="secondary-btn">
              Login / daftar
            </a> */}
            <button
              className="primary-btn"
              disabled={syncBusy}
              onClick={() => void syncNow()}
            >
              <RefreshCw size={14} />
              {syncBusy ? "Memproses…" : "Sinkronkan sekarang"}
            </button>
          </div>
          {conflict && (
            <div
              style={{
                border: "1px solid #ead7a9",
                background: "#fff9e9",
                borderRadius: 12,
                padding: 14,
                marginTop: 16,
              }}
            >
              <div style={{ fontWeight: 750, marginBottom: 6 }}>
                Konflik sinkronisasi — perlu keputusan
              </div>
              <div
                className="muted"
                style={{ lineHeight: 1.6, marginBottom: 12 }}
              >
                Versi cloud: {conflict.remoteVersion} · diperbarui{" "}
                {conflict.remoteUpdatedAt
                  ? new Date(conflict.remoteUpdatedAt).toLocaleString("id-ID")
                  : "—"}
                . Data lokal tidak ditimpa otomatis.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  className="secondary-btn"
                  disabled={syncBusy}
                  onClick={() => void chooseConflict("remote")}
                >
                  Gunakan snapshot cloud
                </button>
                <button
                  className="primary-btn"
                  disabled={syncBusy}
                  onClick={() => void chooseConflict("local")}
                >
                  Timpa cloud dengan lokal
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
      <section className="card" style={{ marginTop: 18 }}>
        <div className="section-title">
          <h2>
            <History
              size={16}
              style={{ verticalAlign: "middle", marginRight: 7 }}
            />
            Audit log terbaru
          </h2>
          <span className="badge">{audit.length} aktivitas</span>
        </div>
        {audit.length === 0 ? (
          <div className="empty">Belum ada aktivitas tercatat.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Modul</th>
                  <th>Aksi</th>
                  <th>ID data</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td>{new Date(a.createdAt).toLocaleString("id-ID")}</td>
                    <td>{a.entityType}</td>
                    <td>{a.action}</td>
                    <td style={{ fontSize: 11 }}>{a.entityId}</td>
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
const inp: React.CSSProperties = {
  flex: 1,
  minWidth: 120,
  border: "1px solid #dfe4e0",
  borderRadius: 9,
  padding: "10px 11px",
  fontSize: 13,
};
