import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, users } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
const bodySchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(10).max(200),
});
export async function POST(req: Request) {
  try {
    if (!db)
      return NextResponse.json(
        { error: "DATABASE_URL belum dikonfigurasi" },
        { status: 503 },
      );
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Email tidak valid atau password minimal 10 karakter" },
        { status: 400 },
      );
    const email = parsed.data.email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash })
      .returning({ id: users.id, email: users.email });
    await createSession(user.id);
    return NextResponse.json({ user });
  } catch (e: unknown) {
    if (String((e as { code?: string })?.code) === "23505")
      return NextResponse.json(
        { error: "Email sudah terdaftar" },
        { status: 409 },
      );
    return NextResponse.json(
      { error: "Registrasi gagal. Pastikan database sudah dimigrasikan." },
      { status: 500 },
    );
  }
}
