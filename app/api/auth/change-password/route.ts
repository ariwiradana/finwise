import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, users } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth/session";

const schema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(10).max(200),
});

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Sesi login berakhir. Silakan login kembali." },
      { status: 401 },
    );
  }
  if (!db) {
    return NextResponse.json(
      { error: "Database akun tidak tersedia." },
      { status: 503 },
    );
  }
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Password baru minimal 10 karakter." },
        { status: 400 },
      );
    }
    if (parsed.data.currentPassword === parsed.data.newPassword) {
      return NextResponse.json(
        { error: "Password baru harus berbeda dari password saat ini." },
        { status: 400 },
      );
    }
    const [user] = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user)
      return NextResponse.json(
        { error: "Akun tidak ditemukan." },
        { status: 404 },
      );
    const matches = await bcrypt.compare(
      parsed.data.currentPassword,
      user.passwordHash,
    );
    if (!matches) {
      return NextResponse.json(
        { error: "Password saat ini tidak benar." },
        { status: 400 },
      );
    }
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
    return NextResponse.json({
      ok: true,
      message: "Password berhasil diperbarui.",
    });
  } catch {
    return NextResponse.json(
      { error: "Gagal mengubah password. Coba lagi." },
      { status: 500 },
    );
  }
}
