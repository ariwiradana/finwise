import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getSessionUserId } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"]);
function getR2() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { bucket, client: new S3Client({ region: "auto", endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } }) };
}
export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Silakan login kembali." }, { status: 401 });
  const r2 = getR2();
  if (!r2) return NextResponse.json({ error: "Cloudflare R2 belum dikonfigurasi. Isi R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, dan R2_BUCKET_NAME." }, { status: 503 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "File lampiran tidak ditemukan." }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Format yang didukung: JPG, PNG, WEBP, HEIC, atau PDF." }, { status: 400 });
    if (file.size < 1 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Ukuran lampiran maksimal 5 MB." }, { status: 400 });
    const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/heic" ? "heic" : "jpg";
    const key = `${userId}/transactions/${Date.now()}-${randomUUID()}.${ext}`;
    await r2.client.send(new PutObjectCommand({ Bucket: r2.bucket, Key: key, Body: Buffer.from(await file.arrayBuffer()), ContentType: file.type, Metadata: { owner: userId } }));
    return NextResponse.json({ key });
  } catch (error) {
    console.error("Transaction attachment upload failed:", error);
    return NextResponse.json({ error: "Gagal mengunggah lampiran ke Cloudflare R2." }, { status: 502 });
  }
}
export async function GET(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Silakan login kembali." }, { status: 401 });
  const r2 = getR2();
  if (!r2) return NextResponse.json({ error: "Cloudflare R2 belum dikonfigurasi." }, { status: 503 });
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!key || !key.startsWith(`${userId}/transactions/`) || key.includes("..")) return NextResponse.json({ error: "Lampiran tidak ditemukan." }, { status: 404 });
  try {
    const url = await getSignedUrl(r2.client, new GetObjectCommand({ Bucket: r2.bucket, Key: key }), { expiresIn: 300 });
    return NextResponse.json({ url, expiresIn: 300 });
  } catch (error) {
    console.error("Transaction attachment URL failed:", error);
    return NextResponse.json({ error: "Tidak dapat membuka lampiran." }, { status: 502 });
  }
}
