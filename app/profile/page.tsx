"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import {
  UserRound,
  Camera,
  ShieldCheck,
  KeyRound,
  Mail,
  CalendarDays,
  Save,
  Eye,
  EyeOff,
  Trash2,
  LoaderCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

type ProfileResponse = {
  email: string;
  createdAt?: string | null;
  displayName?: string;
  avatar?: string;
  error?: string;
};
type LocalProfile = { displayName: string; avatar: string };
const emptyProfile: LocalProfile = { displayName: "", avatar: "" };

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "FW";
}

export default function ProfilePage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [profile, setProfile] = useState<LocalProfile>(emptyProfile);
  const [nameDraft, setNameDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/auth/profile", {
          cache: "no-store",
        });
        const data = (await response.json()) as ProfileResponse;
        if (!response.ok)
          throw new Error(data.error || "Gagal memuat profil akun");
        setEmail(data.email || "");
        setCreatedAt(data.createdAt || null);
        const next = {
          displayName: data.displayName || "",
          avatar: data.avatar || "",
        };
        setProfile(next);
        setNameDraft(next.displayName);
        window.dispatchEvent(new Event("finwise-profile-updated"));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal memuat profil akun",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const next = {
        displayName: nameDraft.trim().slice(0, 80),
        avatar: profile.avatar,
      };
      const response = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = (await response.json()) as ProfileResponse;
      if (!response.ok) throw new Error(data.error || "Profil gagal disimpan");
      const saved = {
        displayName: data.displayName || "",
        avatar: data.avatar || "",
      };
      setProfile(saved);
      setNameDraft(saved.displayName);
      window.dispatchEvent(new Event("finwise-profile-updated"));
      toast.success("Profil berhasil disimpan ke database");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Profil gagal disimpan",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Pilih file gambar seperti JPG, PNG, atau WebP.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Ukuran gambar maksimal 8 MB.");
      return;
    }
    try {
      const imageUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Gambar tidak bisa dibaca"));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = document.createElement("img");
        element.alt = "Foto profil";
        element.onload = () => resolve(element);
        element.onerror = () =>
          reject(new Error("Format gambar tidak didukung"));
        element.src = imageUrl;
      });
      const canvas = document.createElement("canvas");
      const size = 320;
      const scale = Math.min(size / image.width, size / image.height, 1);
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Tidak dapat memproses gambar");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const compressed = canvas.toDataURL("image/jpeg", 0.82);
      setProfile((previous) => ({ ...previous, avatar: compressed }));
      toast.success(
        "Foto siap disimpan ke database. Klik Simpan profil untuk menerapkan.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memproses foto",
      );
    }
  };

  const removeImage = () =>
    setProfile((previous) => ({ ...previous, avatar: "" }));

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword.length < 10) {
      toast.error("Password baru minimal 10 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password belum cocok.");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("Password baru harus berbeda dari password saat ini.");
      return;
    }
    setSavingPassword(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await response.json()) as {
        error?: string;
        message?: string;
      };
      if (!response.ok) throw new Error(data.error || "Password gagal diubah");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(data.message || "Password berhasil diubah");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Password gagal diubah",
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const joinedLabel = createdAt
    ? new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(
        new Date(createdAt),
      )
    : "Tidak tersedia";

  return (
    <div>
      <div className="page-heading">
        <div>
          <h1>Profil & Akun</h1>
          <p className="muted">
            Kelola informasi profil dan keamanan akun Finwise.
          </p>
        </div>
        <span
          className="badge green"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <ShieldCheck size={13} /> Akun aman
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.15fr) minmax(300px, .85fr)",
          gap: 18,
          alignItems: "start",
        }}
        className="profile-layout"
      >
        <section className="card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 22,
            }}
          >
            <div
              className="brand-mark"
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: "#edf5ef",
                color: "#176b43",
              }}
            >
              <UserRound size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, margin: 0 }}>Informasi profil</h2>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                Foto dan nama profil disimpan di perangkat ini.
              </p>
            </div>
          </div>

          <form onSubmit={saveProfile}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                padding: 18,
                border: "1px solid var(--line)",
                borderRadius: 14,
                background: "#fbfcfb",
                marginBottom: 22,
                flexWrap: "wrap",
              }}
            >
              <div
                className="brand-mark topbar-avatar"
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 99,
                  fontSize: 16,
                  overflow: "hidden",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#e5f1e8",
                  color: "#176b43",
                  border: "3px solid #fff",
                  boxShadow: "0 0 0 1px var(--line)",
                  flexShrink: 0,
                  position: "relative",
                }}
              >
                {profile.avatar ? (
                  <Image
                    src={profile.avatar}
                    alt="Foto profil"
                    fill
                    sizes="84px"
                    style={{ objectFit: "cover" }}
                  />
                ) : (
                  initials(nameDraft || email || "Finwise")
                )}
              </div>

              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 750, fontSize: 15 }}>
                  {nameDraft.trim() || "Pengguna Finwise"}
                </div>
                <div
                  className="muted"
                  style={{ marginTop: 5, overflowWrap: "anywhere" }}
                >
                  {email ||
                    (loading ? "Memuat email…" : "Email tidak tersedia")}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginTop: 13,
                  }}
                >
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => fileInput.current?.click()}
                  >
                    <Camera size={14} /> Ganti foto
                  </button>
                  {profile.avatar && (
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={removeImage}
                    >
                      <Trash2 size={14} /> Hapus foto
                    </button>
                  )}
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    onChange={handleImage}
                    hidden
                  />
                </div>
              </div>
            </div>
            <div className="field">
              <label htmlFor="displayName">Nama tampilan</label>
              <input
                id="displayName"
                value={nameDraft}
                maxLength={80}
                onChange={(event) => setNameDraft(event.target.value)}
                placeholder="Masukkan nama kamu"
              />
              <span className="muted" style={{ fontSize: 11 }}>
                Nama ini hanya untuk tampilan di perangkat ini, tidak mengubah
                email login.
              </span>
            </div>
            <div className="field" style={{ marginTop: 16 }}>
              <label>Email akun</label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "12px 13px",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  background: "#f8f9fa",
                  color: "#525963",
                  fontSize: 13,
                }}
              >
                <Mail size={15} color="#7b837d" />{" "}
                <span style={{ overflowWrap: "anywhere" }}>
                  {email || (loading ? "Memuat…" : "Tidak tersedia")}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#737982",
                  }}
                >
                  LOGIN
                </span>
              </div>
            </div>
            <div className="field" style={{ marginTop: 16 }}>
              <label>Tanggal akun dibuat</label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "12px 13px",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  background: "#f8f9fa",
                  color: "#525963",
                  fontSize: 13,
                }}
              >
                <CalendarDays size={15} color="#7b837d" /> {joinedLabel}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 22,
              }}
            >
              <button
                className="primary-btn"
                disabled={savingProfile}
                type="submit"
              >
                <Save size={15} />{" "}
                {savingProfile ? "Menyimpan…" : "Simpan profil"}
              </button>
            </div>
          </form>
        </section>

        <div style={{ display: "grid", gap: 18 }}>
          <section className="card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <div
                className="brand-mark"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: "#edf5ef",
                  color: "#176b43",
                }}
              >
                <KeyRound size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, margin: 0 }}>Ubah password</h2>
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  Lindungi akun cloud kamu.
                </p>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "start",
                gap: 8,
                padding: 11,
                borderRadius: 10,
                background: "#f3f8f4",
                color: "#42624d",
                fontSize: 11,
                lineHeight: 1.5,
                margin: "16px 0 20px",
              }}
            >
              <ShieldCheck size={15} style={{ flexShrink: 0, marginTop: 1 }} />{" "}
              Password baru minimal 10 karakter. Perubahan disimpan secara aman
              ke akun server kamu.
            </div>
            <form onSubmit={changePassword}>
              <div className="field">
                <label htmlFor="currentPassword">Password saat ini</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="currentPassword"
                    type={showCurrent ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    style={{ paddingRight: 42 }}
                  />
                  <button
                    type="button"
                    aria-label={
                      showCurrent
                        ? "Sembunyikan password"
                        : "Tampilkan password"
                    }
                    onClick={() => setShowCurrent(!showCurrent)}
                    style={{
                      position: "absolute",
                      right: 5,
                      top: 4,
                      border: 0,
                      background: "transparent",
                      color: "#737982",
                      padding: 8,
                    }}
                  >
                    <>
                      {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                    </>
                  </button>
                </div>
              </div>
              <div className="field" style={{ marginTop: 15 }}>
                <label htmlFor="newPassword">Password baru</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="newPassword"
                    type={showNew ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={200}
                    required
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    style={{ paddingRight: 42 }}
                  />
                  <button
                    type="button"
                    aria-label={
                      showNew ? "Sembunyikan password" : "Tampilkan password"
                    }
                    onClick={() => setShowNew(!showNew)}
                    style={{
                      position: "absolute",
                      right: 5,
                      top: 4,
                      border: 0,
                      background: "transparent",
                      color: "#737982",
                      padding: 8,
                    }}
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span className="muted" style={{ fontSize: 11 }}>
                  Minimal 10 karakter.
                </span>
              </div>
              <div className="field" style={{ marginTop: 15 }}>
                <label htmlFor="confirmPassword">
                  Konfirmasi password baru
                </label>
                <input
                  id="confirmPassword"
                  type={showNew ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={200}
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                {confirmPassword && (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      marginTop: 6,
                      fontSize: 11,
                      color:
                        confirmPassword === newPassword ? "#16794b" : "#b54c3b",
                    }}
                  >
                    {confirmPassword === newPassword ? (
                      <CheckCircle2 size={12} />
                    ) : null}
                    {confirmPassword === newPassword
                      ? "Password cocok"
                      : "Password belum cocok"}
                  </span>
                )}
              </div>
              <button
                className="primary-btn"
                type="submit"
                disabled={savingPassword}
                style={{
                  width: "100%",
                  marginTop: 20,
                  justifyContent: "center",
                }}
              >
                {savingPassword ? (
                  <LoaderCircle size={15} className="spin" />
                ) : (
                  <ShieldCheck size={15} />
                )}{" "}
                {savingPassword ? "Memperbarui…" : "Perbarui password"}
              </button>
            </form>
          </section>

          <section className="card" style={{ background: "#fbfcfb" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                marginBottom: 10,
              }}
            >
              <ShieldCheck size={17} color="#176b43" />
              <h2 style={{ fontSize: 14, margin: 0 }}>Privasi & penyimpanan</h2>
            </div>
            <p className="muted" style={{ lineHeight: 1.7, margin: 0 }}>
              Foto dan nama profil disimpan secara lokal di browser ini. Email
              dan password login dikelola oleh akun cloud Finwise. Menghapus
              data browser dapat menghapus foto serta nama lokal.
            </p>
          </section>
        </div>
      </div>
      <style jsx>{`
        @media (max-width: 900px) {
          .profile-layout {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}
