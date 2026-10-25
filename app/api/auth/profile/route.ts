import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_AVATAR_DATA_LENGTH = 300_000;

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json(
      { error: "Silakan login kembali." },
      { status: 401 },
    );
  if (!db)
    return NextResponse.json(
      { error: "Database akun tidak tersedia." },
      { status: 503 },
    );
  try {
    const [user] = await db
      .select({
        email: users.email,
        createdAt: users.createdAt,
        displayName: users.displayName,
        avatar: users.avatarData,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user)
      return NextResponse.json(
        { error: "Akun tidak ditemukan." },
        { status: 404 },
      );
    return NextResponse.json({
      email: user.email,
      createdAt: user.createdAt,
      displayName: user.displayName ?? "",
      avatar: user.avatar ?? "",
    });
  } catch (error) {
    console.error("Profile fetch failed:", error);
    return NextResponse.json(
      {
        error:
          "Gagal memuat profil akun. Pastikan migrasi database sudah dijalankan.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json(
      { error: "Silakan login kembali." },
      { status: 401 },
    );
  if (!db)
    return NextResponse.json(
      { error: "Database akun tidak tersedia." },
      { status: 503 },
    );
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request tidak valid." },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object")
    return NextResponse.json(
      { error: "Data profil tidak valid." },
      { status: 400 },
    );
  const data = body as { displayName?: unknown; avatar?: unknown };
  const displayName =
    typeof data.displayName === "string" ? data.displayName.trim() : "";
  const avatar = typeof data.avatar === "string" ? data.avatar : "";
  if (displayName.length > 80)
    return NextResponse.json(
      { error: "Nama tampilan maksimal 80 karakter." },
      { status: 400 },
    );
  if (
    avatar &&
    (!avatar.startsWith("data:image/jpeg;base64,") ||
      avatar.length > MAX_AVATAR_DATA_LENGTH)
  )
    return NextResponse.json(
      {
        error:
          "Foto tidak valid atau terlalu besar. Pilih foto lain yang lebih kecil.",
      },
      { status: 400 },
    );
  try {
    const [user] = await db
      .update(users)
      .set({
        displayName: displayName || null,
        avatarData: avatar || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        email: users.email,
        createdAt: users.createdAt,
        displayName: users.displayName,
        avatar: users.avatarData,
      });
    if (!user)
      return NextResponse.json(
        { error: "Akun tidak ditemukan." },
        { status: 404 },
      );
    return NextResponse.json({
      ok: true,
      email: user.email,
      createdAt: user.createdAt,
      displayName: user.displayName ?? "",
      avatar: user.avatar ?? "",
    });
  } catch (error) {
    console.error("Profile save failed:", error);
    return NextResponse.json(
      {
        error:
          "Gagal menyimpan profil ke database. Pastikan migrasi database sudah dijalankan.",
      },
      { status: 500 },
    );
  }
}
