import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BASE64_LENGTH = 4_000_000; // keep JSON requests comfortably below common serverless body limits
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY belum diatur. Tambahkan API key di .env.local lalu restart server.",
      },
      { status: 503 },
    );
  }

  let body: {
    mimeType?: unknown;
    data?: unknown;
    availableAccounts?: unknown;
    recentTransactions?: unknown;
    existingTags?: unknown;
    availableCategories?: unknown;
    availableCategoriesByType?: unknown;
  };
  try {
    body = (await request.json()) as {
      mimeType?: unknown;
      data?: unknown;
      availableAccounts?: unknown;
      recentTransactions?: unknown;
      existingTags?: unknown;
      availableCategories?: unknown;
      availableCategoriesByType?: unknown;
    };
  } catch {
    return NextResponse.json(
      { error: "Request tidak valid." },
      { status: 400 },
    );
  }

  const mimeType =
    typeof body.mimeType === "string" ? body.mimeType.toLowerCase() : "";
  const data = typeof body.data === "string" ? body.data : "";

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json(
      {
        error:
          "Format file belum didukung. Gunakan JPG, PNG, WEBP, HEIC, atau PDF.",
      },
      { status: 400 },
    );
  }

  if (
    !data ||
    data.length > MAX_BASE64_LENGTH ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(data)
  ) {
    return NextResponse.json(
      {
        error:
          "File kosong atau terlalu besar untuk diproses. Maksimal ukuran unggahan sekitar 3 MB; kompres gambar atau gunakan foto nota yang lebih kecil.",
      },
      { status: 400 },
    );
  }

  const availableAccounts = Array.isArray(body.availableAccounts)
    ? body.availableAccounts
        .filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        )
        .slice(0, 30)
    : [];
  const recentTransactions = Array.isArray(body.recentTransactions)
    ? body.recentTransactions
        .slice(0, 30)
        .filter(
          (
            item,
          ): item is {
            description?: string;
            account?: string;
            category?: string;
            tags?: string[];
          } => Boolean(item) && typeof item === "object",
        )
        .map((item) => ({
          description:
            typeof item.description === "string"
              ? item.description.slice(0, 100)
              : "",
          account:
            typeof item.account === "string" ? item.account.slice(0, 60) : "",
          category:
            typeof item.category === "string" ? item.category.slice(0, 60) : "",
          tags: Array.isArray(item.tags)
            ? item.tags
                .filter((tag): tag is string => typeof tag === "string")
                .slice(0, 5)
            : [],
        }))
    : [];
  const existingTags = Array.isArray(body.existingTags)
    ? body.existingTags
        .filter((item): item is string => typeof item === "string")
        .slice(0, 40)
    : [];
  const availableCategories = Array.isArray(body.availableCategories)
    ? body.availableCategories
        .filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        )
        .slice(0, 60)
    : [
        "Makan & Minum",
        "Transportasi",
        "Belanja",
        "Tagihan",
        "Keluarga",
        "Pekerjaan",
        "Kesehatan",
        "Hiburan",
        "Pajak",
        "Biaya Bank",
        "Bunga & Biaya Utang",
        "Lainnya",
      ];
  const rawCategoriesByType =
    body.availableCategoriesByType &&
    typeof body.availableCategoriesByType === "object"
      ? (body.availableCategoriesByType as Record<string, unknown>)
      : {};
  const supportedTransactionTypes = [
    "income",
    "expense",
    "transfer",
    "refund",
    "asset_purchase",
    "debt_payment",
    "receivable_payment",
    "reimburse_payment",
    "adjustment",
  ] as const;
  const availableCategoriesByType: Record<string, string[]> = {};
  for (const transactionType of supportedTransactionTypes) {
    const values = rawCategoriesByType[transactionType];
    availableCategoriesByType[transactionType] = Array.isArray(values)
      ? values
          .filter(
            (item): item is string =>
              typeof item === "string" && item.trim().length > 0,
          )
          .slice(0, 60)
      : transactionType === "income" || transactionType === "receivable_payment"
        ? ["Gaji", "Pemasukan lain", "Reimburse"]
        : transactionType === "transfer"
          ? ["Transfer antar akun"]
          : availableCategories;
  }

  try {
    const prompt = `
Baca nota/struk transaksi ini dengan teliti. Ini untuk aplikasi pencatatan keuangan Indonesia.
Kembalikan hanya data yang benar-benar terlihat pada nota; jangan menebak nilai yang tidak terbaca.

Aturan:
- merchant: nama toko/usaha, tanpa alamat panjang jika tidak perlu. Jika tidak terbaca, string kosong.
- date: tanggal transaksi dalam format YYYY-MM-DD. Perhatikan bahwa nota Indonesia sering memakai DD/MM/YYYY atau DD-MM-YYYY. Jika tanggal tidak jelas/tidak ada, string kosong.
- totalAmount: nominal utama yang sesuai dengan transactionTypeSuggestion, sebagai bilangan bulat rupiah tanpa pemisah. Untuk expense/asset_purchase/debt_payment gunakan total akhir yang dibayar; untuk income/receivable_payment gunakan jumlah uang diterima; untuk transfer gunakan jumlah transfer; untuk refund gunakan jumlah yang dikembalikan. Untuk struk belanja, utamakan "TOTAL BAYAR", "GRAND TOTAL", "TOTAL", "AMOUNT PAID" atau jumlah akhir setelah diskon. Jangan gunakan subtotal, total item, pajak, uang diterima, atau kembalian jika itu bukan nominal transaksi. Jika tidak yakin atau nominal tidak jelas, isi 0.
- currency: biasanya IDR untuk struk Indonesia.
- transactionTypeSuggestion: pilih tepat satu dari enum: "expense", "income", "transfer", "refund", "asset_purchase", "debt_payment", "receivable_payment", "reimburse_payment", "adjustment". Gunakan bukti yang terlihat dan konteks transaksi. Default untuk struk belanja, restoran, jasa, tagihan, bensin, cuci motor, dan pembayaran ke merchant adalah "expense". Gunakan "refund" hanya jika dokumen jelas menunjukkan pengembalian dana kepada pembeli. Gunakan "income" hanya jika bukti jelas menunjukkan uang diterima oleh pengguna, bukan bukti pengguna membayar. Gunakan "transfer" hanya jika bukti jelas menunjukkan transfer antar akun milik pengguna sendiri; transfer ke merchant/orang lain bukan otomatis transfer antar akun. Gunakan "asset_purchase" hanya untuk barang tahan lama bernilai aset yang jelas (misalnya kamera, laptop, motor), bukan barang konsumsi biasa. Gunakan jenis lain hanya jika bukti eksplisit mendukungnya; jika ragu pilih "expense". Jangan menganggap jenis transaksi pasti hanya dari nama merchant.
- confidence: "high", "medium", atau "low" berdasarkan kejelasan bukti.
- extractedText: salin ringkasan teks yang relevan dari nota, terutama baris merchant, tanggal, subtotal/diskon bila ada, dan baris total. Jangan menambahkan informasi yang tidak ada di nota. Maksimal 1200 karakter.
- Periksa kembali angka dengan cermat; titik/koma dapat menjadi pemisah ribuan.
- accountSuggestion: pilih SATU nama akun persis dari daftar akun yang tersedia di bawah. Nota biasanya tidak menyebut sumber pembayaran, jadi gunakan riwayat transaksi merchant yang mirip untuk menyarankan akun. Jika tidak ada pola yang jelas, pilih akun pertama dari daftar sebagai saran default. Jangan membuat nama akun baru.
- categorySuggestion: pilih SATU kategori yang cocok untuk transactionTypeSuggestion dari daftar kategori bertipe di bawah. Untuk expense/asset_purchase/debt_payment/refund gunakan kategori pengeluaran; untuk income/receivable_payment gunakan kategori pemasukan; untuk transfer gunakan kategori transfer; untuk reimburse_payment gunakan kategori alokasi. Contoh pengeluaran: restoran, warung, kopi, bakery, makanan/minuman -> "Makan & Minum"; cuci motor, cuci mobil, bengkel, ganti oli, bensin, parkir, tol, transportasi -> "Transportasi"; supermarket/minimarket -> kategori belanja yang tersedia; PLN, internet, pulsa, air -> "Tagihan"; klinik/apotek/obat -> "Kesehatan". Gunakan hanya nama kategori persis dari daftar untuk jenis yang dipilih. Jika ragu pilih "Lainnya" jika tersedia, selain itu kategori pertama dari jenis tersebut. Jangan membuat kategori baru.
- tags: 1 sampai 4 tag singkat dalam bahasa Indonesia, huruf kecil, tanpa tanda #. Utamakan tag yang sudah digunakan bila cocok; jika tidak, buat tag sederhana berdasarkan merchant/jenis belanja. Jangan memasukkan nomor struk atau data pribadi sebagai tag.

Akun tersedia: ${JSON.stringify(availableAccounts)}
Kategori pengeluaran yang tersedia: ${JSON.stringify(availableCategories)}
Kategori yang tersedia menurut jenis transaksi: ${JSON.stringify(availableCategoriesByType)}
Tag yang pernah digunakan: ${JSON.stringify(existingTags)}
Riwayat merchant/akun/kategori/tag (gunakan hanya untuk membantu saran, jangan salin detail transaksi ke hasil): ${JSON.stringify(recentTransactions)}
`;

    const googleResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 900,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                merchant: { type: "STRING" },
                date: { type: "STRING" },
                totalAmount: { type: "INTEGER" },
                currency: { type: "STRING" },
                confidence: {
                  type: "STRING",
                  enum: ["high", "medium", "low"],
                },
                extractedText: { type: "STRING" },
                accountSuggestion: { type: "STRING" },
                transactionTypeSuggestion: {
                  type: "STRING",
                  enum: [
                    "income",
                    "expense",
                    "transfer",
                    "refund",
                    "asset_purchase",
                    "debt_payment",
                    "receivable_payment",
                    "reimburse_payment",
                    "adjustment",
                  ],
                },
                categorySuggestion: { type: "STRING" },
                tags: { type: "ARRAY", items: { type: "STRING" } },
              },
              required: [
                "merchant",
                "date",
                "totalAmount",
                "currency",
                "confidence",
                "extractedText",
                "accountSuggestion",
                "transactionTypeSuggestion",
                "categorySuggestion",
                "tags",
              ],
            },
          },
        }),
      },
    );

    const googlePayload = (await googleResponse.json()) as {
      error?: { message?: string };
      candidates?: {
        finishReason?: string;
        content?: { parts?: { text?: string }[] };
      }[];
      promptFeedback?: { blockReason?: string };
    };

    if (!googleResponse.ok) {
      console.error(
        "Gemini API error:",
        googleResponse.status,
        googlePayload.error?.message ?? "Unknown Gemini API error",
      );
      const apiMessage = googlePayload.error?.message ?? "";
      const message =
        googleResponse.status === 429
          ? "Kuota Gemini sedang habis atau terkena batas permintaan. Coba lagi nanti."
          : googleResponse.status === 400
            ? /model|not found|unsupported/i.test(apiMessage)
              ? "Model Gemini tidak tersedia untuk konfigurasi API ini. Periksa nama model dan akses API."
              : "Gemini menolak file atau parameter permintaan. Coba foto JPG/PNG yang lebih kecil dan jelas."
            : googleResponse.status === 401 || googleResponse.status === 403
              ? "Akses Gemini ditolak. Periksa GEMINI_API_KEY dan izin API."
              : googleResponse.status >= 500
                ? "Layanan Gemini sedang bermasalah. Coba lagi sebentar."
                : "Gemini API tidak dapat memproses permintaan ini.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const outputText =
      googlePayload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim() ?? "";

    if (!outputText) {
      return NextResponse.json(
        { error: "Gemini tidak mengembalikan hasil ekstraksi." },
        { status: 502 },
      );
    }

    type ReceiptResult = {
      merchant?: unknown;
      date?: unknown;
      totalAmount?: unknown;
      currency?: unknown;
      confidence?: unknown;
      extractedText?: unknown;
      accountSuggestion?: unknown;
      transactionTypeSuggestion?: unknown;
      categorySuggestion?: unknown;
      tags?: unknown;
    };

    // Some model responses can include Markdown fences, a short preamble,
    // or a JSON object encoded as a JSON string. Normalize those before failing.
    const parseReceiptJson = (raw: string): ReceiptResult | null => {
      const trimmed = raw
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
      const candidates = [trimmed];
      const firstBrace = trimmed.indexOf("{");
      const lastBrace = trimmed.lastIndexOf("}");
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
      }

      for (const candidate of candidates) {
        try {
          let value: unknown = JSON.parse(candidate);
          if (typeof value === "string") value = JSON.parse(value);
          if (value && typeof value === "object" && !Array.isArray(value)) {
            return value as ReceiptResult;
          }
        } catch {
          // Try the next normalized candidate.
        }
      }
      return null;
    };

    const parsed = parseReceiptJson(outputText);
    if (!parsed) {
      const finishReason =
        googlePayload.candidates?.[0]?.finishReason ?? "unknown";
      // Log only model output text for debugging; never log the uploaded receipt or API key.
      console.error("Gemini returned unparseable receipt JSON", {
        finishReason,
        outputPreview: outputText.slice(0, 300),
      });
      return NextResponse.json(
        {
          error:
            finishReason === "MAX_TOKENS"
              ? "Hasil Gemini terpotong. Coba foto yang lebih jelas atau lebih kecil."
              : "Gemini mengirim format yang tidak bisa dibaca. Silakan coba lagi; aplikasi akan mencoba OCR lokal.",
        },
        { status: 502 },
      );
    }

    const amount = Number(parsed.totalAmount);
    const transactionTypeSuggestion = supportedTransactionTypes.includes(
      parsed.transactionTypeSuggestion as (typeof supportedTransactionTypes)[number],
    )
      ? (parsed.transactionTypeSuggestion as (typeof supportedTransactionTypes)[number])
      : "expense";
    const categoriesForSuggestedType =
      availableCategoriesByType[transactionTypeSuggestion] ??
      availableCategories;
    return NextResponse.json({
      merchant:
        typeof parsed.merchant === "string"
          ? parsed.merchant.slice(0, 120)
          : "",
      date: typeof parsed.date === "string" ? parsed.date : "",
      totalAmount: Number.isSafeInteger(amount) && amount > 0 ? amount : 0,
      currency: typeof parsed.currency === "string" ? parsed.currency : "IDR",
      confidence:
        parsed.confidence === "high" ||
        parsed.confidence === "medium" ||
        parsed.confidence === "low"
          ? parsed.confidence
          : "low",
      extractedText:
        typeof parsed.extractedText === "string"
          ? parsed.extractedText.slice(0, 1200)
          : "",
      accountSuggestion:
        typeof parsed.accountSuggestion === "string" &&
        availableAccounts.includes(parsed.accountSuggestion)
          ? parsed.accountSuggestion
          : (availableAccounts[0] ?? ""),
      transactionTypeSuggestion,
      categorySuggestion:
        typeof parsed.categorySuggestion === "string" &&
        categoriesForSuggestedType.includes(parsed.categorySuggestion)
          ? parsed.categorySuggestion
          : categoriesForSuggestedType.includes("Lainnya")
            ? "Lainnya"
            : (categoriesForSuggestedType[0] ?? ""),
      tags: Array.isArray(parsed.tags)
        ? Array.from(
            new Set(
              parsed.tags
                .filter((tag): tag is string => typeof tag === "string")
                .map((tag) =>
                  tag.trim().toLocaleLowerCase("id-ID").replace(/^#/, ""),
                )
                .filter((tag) => tag.length > 0 && tag.length <= 32),
            ),
          ).slice(0, 5)
        : [],
    });
  } catch (error) {
    console.error("Receipt extraction route failed:", error);
    return NextResponse.json(
      {
        error:
          "Tidak dapat menghubungi Gemini. Coba lagi atau gunakan OCR lokal.",
      },
      { status: 502 },
    );
  }
}
