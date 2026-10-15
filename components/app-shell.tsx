"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeftRight,
  Bell,
  CalendarClock,
  ChartNoAxesCombined,
  CircleHelp,
  FileUp,
  Gauge,
  Goal,
  LayoutDashboard,
  Landmark,
  ListChecks,
  Menu,
  PiggyBank,
  Settings2,
  Wallet,
  X,
  LogOut,
  LockKeyhole,
} from "lucide-react";
import { useEffect, useState } from "react";
import { localDB } from "@/lib/offline/database";

const groups = [
  {
    label: "OVERVIEW",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "MONEY MANAGEMENT",
    items: [
      { href: "/transactions", label: "Transaksi", icon: ArrowLeftRight },
      { href: "/accounts", label: "Akun & Rekening", icon: Wallet },
      { href: "/categories", label: "Kategori & Tag", icon: ListChecks },
      { href: "/budgets", label: "Budget", icon: Gauge },
      { href: "/assets", label: "Aset & Investasi", icon: PiggyBank },
      { href: "/debts", label: "Utang & Piutang", icon: Landmark },
      { href: "/goals", label: "Target Keuangan", icon: Goal },
      { href: "/schedules", label: "Tagihan & Jadwal", icon: CalendarClock },
    ],
  },
  {
    label: "INSIGHTS",
    items: [
      {
        href: "/reports",
        label: "Laporan & Analitik",
        icon: ChartNoAxesCombined,
      },
      { href: "/import-export", label: "Impor & Ekspor", icon: FileUp },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { href: "/settings", label: "Pengaturan & Audit", icon: Settings2 },
      // { href: "/login", label: "Login / Cloud", icon: LockKeyhole },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pinReady, setPinReady] = useState(false);
  const [pinRequired, setPinRequired] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  useEffect(() => {
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    void (async () => {
      const pin = await localDB?.settings.get("pinHash");
      setPinRequired(
        Boolean(
          pin?.value &&
          sessionStorage.getItem("finwise_pin_verified") !== "yes",
        ),
      );
      setPinReady(true);
    })();
  }, []);
  useEffect(() => {
    const labelTables = () =>
      document
        .querySelectorAll<HTMLTableElement>(".table-wrap table")
        .forEach((table) => {
          const labels = Array.from(table.querySelectorAll("thead th")).map(
            (th) => th.textContent?.trim() || "Data",
          );
          table.querySelectorAll("tbody tr").forEach((row) =>
            row.querySelectorAll("td").forEach((cell, index) => {
              if (!cell.dataset.label)
                cell.dataset.label = labels[index] || "Data";
            }),
          );
        });
    labelTables();
    const observer = new MutationObserver(labelTables);
    observer.observe(document.querySelector(".content") || document.body, {
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [pathname]);
  const verifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const saved = await localDB?.settings.get("pinHash");
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(pinInput),
    );
    const hash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (saved?.value === hash) {
      sessionStorage.setItem("finwise_pin_verified", "yes");
      setPinRequired(false);
      setPinError("");
      setPinInput("");
    } else setPinError("PIN salah. Coba lagi.");
  };
  if (pathname === "/login") return <>{children}</>;
  if (!pinReady)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          color: "#7b837d",
        }}
      >
        Memuat Finwise…
      </div>
    );
  if (pinRequired)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 20,
          background: "#f6f8f6",
        }}
      >
        <form
          className="card"
          onSubmit={verifyPin}
          style={{ width: "min(380px,100%)", textAlign: "center" }}
        >
          <div
            className="brand-mark"
            style={{ margin: "0 auto 16px", width: 46, height: 46 }}
          >
            <LockKeyhole size={20} />
          </div>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Masukkan PIN</h1>
          <p className="muted" style={{ marginBottom: 18 }}>
            PIN perangkat diperlukan untuk membuka Finwise.
          </p>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pinInput}
            onChange={(e) =>
              setPinInput(e.target.value.replace(/\D/g, "").slice(0, 8))
            }
            style={{
              width: "100%",
              padding: 13,
              border: "1px solid #dfe4e0",
              borderRadius: 10,
              textAlign: "center",
              fontSize: 20,
              letterSpacing: 6,
            }}
          />
          <div
            style={{
              color: "#b54c3b",
              fontSize: 12,
              marginTop: 8,
              minHeight: 18,
            }}
          >
            {pinError}
          </div>
          <button
            className="primary-btn"
            style={{ width: "100%", marginTop: 8 }}
          >
            Buka aplikasi
          </button>
        </form>
      </div>
    );
  const nav = (
    <>
      <div className="brand">
        <div className="brand-mark">F</div>
        <div>
          finwise<span style={{ color: "#9aa19d", fontWeight: 500 }}>.</span>
        </div>
      </div>
      {groups.map((group) => (
        <div className="nav-group" key={group.label}>
          <div className="nav-label">{group.label}</div>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                onClick={() => setMobileOpen(false)}
                key={item.href}
                href={item.href}
                className={`nav-item${active ? " active" : ""}`}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
      <div
        style={{
          marginTop: "auto",
          background: "#f5f7f5",
          borderRadius: 12,
          padding: 13,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 11,
            fontWeight: 700,
            marginBottom: 7,
          }}
        >
          <Activity size={14} color="#24784b" /> Offline ready
        </div>
        <div style={{ color: "#858b8a", fontSize: 10, lineHeight: 1.5 }}>
          Data tersimpan di perangkat; sinkronisasi cloud dapat dijalankan
          manual.
        </div>
      </div>
    </>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">{nav}</aside>
      {mobileOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 20,
            background: "#0005",
          }}
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="sidebar"
            style={{
              display: "flex",
              position: "absolute",
              inset: "0 auto 0 0",
              width: 270,
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {nav}
            <button
              className="secondary-btn"
              onClick={() => setMobileOpen(false)}
            >
              <X size={15} /> Tutup menu
            </button>
          </aside>
        </div>
      )}
      <main className="main">
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="secondary-btn mobile-menu"
              onClick={() => setMobileOpen(true)}
              aria-label="Buka menu"
            >
              <Menu size={16} />
            </button>
            <div className="topbar-page-title">
              <span className="topbar-workspace">
                Personal workspace <span style={{ margin: "0 7px" }}>/</span>
              </span>
              <strong>
                {groups
                  .flatMap((g) => g.items)
                  .find(
                    (i) =>
                      i.href === pathname ||
                      (i.href !== "/" && pathname.startsWith(i.href)),
                  )?.label ?? "Dashboard"}
              </strong>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="badge green topbar-currency">IDR · Rupiah</span>
            <button
              className="secondary-btn topbar-notifications"
              aria-label="Notifikasi"
              onClick={() => {
                if ("Notification" in window)
                  void Notification.requestPermission();
              }}
            >
              <Bell size={15} />
            </button>
            <button
              className="secondary-btn topbar-logout"
              aria-label="Keluar"
              title="Keluar dari akun cloud"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              }}
            >
              <LogOut size={14} />
            </button>
            <div
              className="brand-mark topbar-avatar"
              style={{ width: 30, height: 30, borderRadius: 99, fontSize: 11 }}
            >
              ME
            </div>
          </div>
        </header>
        <div className="content">
          {children}
          <footer
            style={{
              color: "#9aa0a7",
              fontSize: 10,
              marginTop: 30,
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <span>Finwise · Personal Finance Management</span>
            <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <CircleHelp size={12} /> Draft build · Data tersimpan lokal saat
              offline
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
