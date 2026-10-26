"use client";
import { FormEvent, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Check,
  CirclePlus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Wallet,
  CreditCard,
  HandCoins,
  Clock3,
  FileMinus,
  ReceiptText,
  Camera,
  LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "@/lib/finance/money";
import { DEFAULT_CATEGORIES } from "@/lib/offline/database";
import { useLocalTransactions } from "@/components/transaction-store";
import { useLocalRecords } from "@/components/local-records";

const MAX_RECEIPT_UPLOAD_BYTES = 3 * 1024 * 1024;

/** Shrink camera photos before Base64 encoding to avoid oversized serverless requests. */
async function prepareReceiptFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const maxDimension = 1800;
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    // Some browsers cannot decode HEIC/HEIF; preserve the original for fallback handling.
    return file;
  }
}

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
    const categoryType = ["income", "receivable_payment"].includes(txType)
      ? "income"
      : txType === "transfer"
        ? "transfer"
        : txType === "reimburse_payment"
          ? "allocation"
          : "expense";

    const defaults = DEFAULT_CATEGORIES.filter(
      (c) => c.type === categoryType,
    ).map((c) => c.name);

    const saved = categoriesFor(txType).map((c) => c.name);

    const options = Array.from(new Set([...defaults, ...saved]));

    if (txType === "income" && !options.includes("Reimburse")) {
      options.push("Reimburse");
    }

    return options;
  };

  const [showForm, setShowForm] = useState(false);
  const [receiptProcessing, setReceiptProcessing] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<TxType>("expense");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Makan & Minum");
  const [account, setAccount] = useState("");
  const [excluded, setExcluded] = useState(false);
  const [note, setNote] = useState("");
  const [selectedNote, setSelectedNote] = useState<{
    title: string;
    content: string;
  } | null>(null);
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
        const q = query.trim().toLocaleLowerCase("id-ID");
        const txType = String(t.type).trim().toLowerCase();

        const matchesQuery = [
          t.description,
          t.category,
          t.account,
          t.note ?? "",
          ...t.tags,
        ].some((value) => String(value).toLocaleLowerCase("id-ID").includes(q));

        let matchesFilter = true;

        switch (filter) {
          case "all":
            matchesFilter = true;
            break;
          case "excluded":
            matchesFilter = Boolean(t.excludedFromReports);
            break;
          case "included":
            matchesFilter = !t.excludedFromReports;
            break;
          case "reimburse":
            matchesFilter = t.reimburseStatus === "pending";
            break;
          case "income":
            matchesFilter = ["income", "pemasukan"].includes(txType);
            break;
          case "expense":
            matchesFilter = [
              "expense",
              "pengeluaran",
              "asset_purchase",
              "debt_payment",
            ].includes(txType);
            break;
          case "transfer":
            matchesFilter = txType === "transfer";
            break;
          default:
            matchesFilter = txType === filter;
            break;
        }

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
    setAccount("");
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

  const handleReceiptUpload = async (file?: File) => {
    if (!file) return;

    setShowForm(true);

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    const isImage = file.type.startsWith("image/");
    if (!isPdf && !isImage) {
      toast.error("Format file harus berupa foto atau PDF.");
      return;
    }

    setReceiptProcessing(true);

    const applyReceiptData = (result: {
      merchant?: unknown;
      date?: unknown;
      totalAmount?: unknown;
      extractedText?: unknown;
      confidence?: unknown;
      accountSuggestion?: unknown;
      categorySuggestion?: unknown;
      transactionTypeSuggestion?: unknown;
      tags?: unknown;
    }) => {
      const merchant =
        typeof result.merchant === "string" ? result.merchant.trim() : "";
      const amountValue = Number(result.totalAmount);
      const detectedAmount =
        Number.isSafeInteger(amountValue) && amountValue > 0 ? amountValue : 0;
      const dateValue =
        typeof result.date === "string" ? result.date.trim() : "";
      const detectedDate =
        /^\d{4}-\d{2}-\d{2}$/.test(dateValue) &&
        !Number.isNaN(new Date(`${dateValue}T12:00:00`).getTime()) &&
        new Date(`${dateValue}T12:00:00`).toISOString().slice(0, 10) ===
          dateValue
          ? dateValue
          : "";
      const extractedText =
        typeof result.extractedText === "string"
          ? result.extractedText.trim()
          : "";

      const supportedTypes: TxType[] = [
        "income",
        "expense",
        "transfer",
        "refund",
        "asset_purchase",
        "debt_payment",
        "receivable_payment",
        "reimburse_payment",
        "adjustment",
      ];
      const suggestedType =
        typeof result.transactionTypeSuggestion === "string" &&
        supportedTypes.includes(result.transactionTypeSuggestion as TxType)
          ? (result.transactionTypeSuggestion as TxType)
          : "expense";
      setType(suggestedType);
      if (detectedAmount) setAmount(String(detectedAmount));
      if (detectedDate) setDate(detectedDate);
      if (merchant) {
        const descriptionPrefix =
          suggestedType === "income" || suggestedType === "receivable_payment"
            ? "Penerimaan - "
            : suggestedType === "transfer"
              ? "Transfer - "
              : suggestedType === "refund"
                ? "Refund - "
                : suggestedType === "asset_purchase"
                  ? "Pembelian aset - "
                  : "Pembelian - ";
        setDescription(`${descriptionPrefix}${merchant}`.slice(0, 240));
      }
      const suggestedCategories = categoryOptions(suggestedType);
      const aiCategory =
        typeof result.categorySuggestion === "string" &&
        suggestedCategories.includes(result.categorySuggestion)
          ? result.categorySuggestion
          : "";
      const expenseCategories = categoryOptions("expense");
      const categoryEvidence = `${merchant} ${extractedText}`.toLocaleLowerCase(
        "id-ID",
      );
      const categoryRules: [RegExp, string[]][] = [
        [
          /cuci motor|cuci mobil|car wash|motor wash|salon motor|bengkel|service motor|servis motor|ganti oli|spare ?part|tambal ban|ban motor|parkir|bensin|bbm|pertamina|shell|spbu|tol\b|grab|gojek|taksi|taxi|ojek|bus|kereta|transport/i,
          ["Transportasi"],
        ],
        [
          /restoran|restaurant|rumah makan|warung|cafe|café|coffee|kopi|bakery|roti|boba|minuman|makan|food|dining|pizza|burger|sushi|ayam geprek|warteg/i,
          ["Makan & Minum"],
        ],
        [
          /indomaret|alfamart|supermarket|superindo|hypermart|minimarket|grocery|sembako|sayur|buah|pasar/i,
          ["Belanja", "Belanja Harian"],
        ],
        [
          /apotek|pharmacy|klinik|clinic|hospital|rumah sakit|dokter|obat|lab kesehatan/i,
          ["Kesehatan"],
        ],
        [
          /pln|listrik|token listrik|pdam|air\s?\b|internet|wifi|wi-fi|telkom|indihome|pulsa|paket data|tagihan/i,
          ["Tagihan"],
        ],
        [
          /bioskop|cinema|netflix|spotify|game|steam|karaoke|konser|hiburan/i,
          ["Hiburan"],
        ],
        [
          /laundry|binatu|dry clean|dryclean/i,
          ["Rumah Tangga", "Belanja", "Lainnya"],
        ],
        [
          /sekolah|kursus|training|buku|alat tulis/i,
          ["Pendidikan", "Pekerjaan", "Lainnya"],
        ],
      ];
      const matchedCategoryNames =
        categoryRules.find(([pattern]) =>
          pattern.test(categoryEvidence),
        )?.[1] ?? [];
      const inferredExpenseCategory = matchedCategoryNames.find((name) =>
        expenseCategories.includes(name),
      );
      const historyMerchant = merchant.toLocaleLowerCase("id-ID");
      const historyCategory = historyMerchant
        ? transactions.find((tx) => {
            const oldDescription = tx.description
              .toLocaleLowerCase("id-ID")
              .replace(
                /^(pembelian|pembelian aset|penerimaan|transfer|refund)\s*-\s*/i,
                "",
              );
            return (
              oldDescription.includes(historyMerchant) ||
              historyMerchant.includes(oldDescription)
            );
          })?.category
        : undefined;
      const validHistoryCategory =
        historyCategory && suggestedCategories.includes(historyCategory)
          ? historyCategory
          : "";
      const defaultCategory = suggestedCategories.includes("Lainnya")
        ? "Lainnya"
        : (suggestedCategories[0] ?? "Lainnya");
      const inferredCategory =
        suggestedType === "expense" || suggestedType === "asset_purchase"
          ? inferredExpenseCategory
          : "";
      setCategory(
        aiCategory ||
          inferredCategory ||
          validHistoryCategory ||
          defaultCategory,
      );

      // Account cannot be read from the receipt itself. Prefer a valid AI suggestion,
      // then reuse the account used for a previous transaction at the same merchant,
      // and finally preselect the first available account for user review.
      const availableAccounts = accountOptions.length
        ? accountOptions
        : ["Bank utama", "Cash"];
      const suggestedAccount =
        typeof result.accountSuggestion === "string" &&
        availableAccounts.includes(result.accountSuggestion)
          ? result.accountSuggestion
          : "";
      const merchantKey = merchant.toLocaleLowerCase("id-ID");
      const previousMerchantTransaction = merchantKey
        ? transactions.find(
            (tx) =>
              tx.description.toLocaleLowerCase("id-ID").includes(merchantKey) ||
              merchantKey.includes(
                tx.description
                  .replace(/^pembelian\s*-\s*/i, "")
                  .toLocaleLowerCase("id-ID"),
              ),
          )
        : undefined;
      const historyAccount =
        previousMerchantTransaction &&
        availableAccounts.includes(previousMerchantTransaction.account)
          ? previousMerchantTransaction.account
          : "";
      const selectedAccount =
        suggestedAccount || historyAccount || availableAccounts[0] || "";
      setAccount(selectedAccount);
      if (suggestedType === "transfer") {
        const suggestedDestination = availableAccounts.find(
          (name) => name !== selectedAccount,
        );
        if (suggestedDestination) setDestinationAccount(suggestedDestination);
      }

      const suggestedTags = Array.isArray(result.tags)
        ? Array.from(
            new Set(
              result.tags
                .filter((tag): tag is string => typeof tag === "string")
                .map((tag) =>
                  tag.trim().toLocaleLowerCase("id-ID").replace(/^#/, ""),
                )
                .filter((tag) => tag.length > 0 && tag.length <= 32),
            ),
          ).slice(0, 5)
        : [];
      const receiptText = `${merchant} ${extractedText}`.toLocaleLowerCase(
        "id-ID",
      );
      const inferredTags = suggestedTags.length
        ? suggestedTags
        : (() => {
            const tags: string[] = [];
            if (
              /kopi|coffee|cafe|café|resto|restaurant|makan|food|warung|bakery|boba|minuman/.test(
                receiptText,
              )
            )
              tags.push("makan-minum");
            if (
              /bensin|pertamina|shell|spbu|parkir|grab|gojek|transport|toll|tol/.test(
                receiptText,
              )
            )
              tags.push("transportasi");
            if (
              /indomaret|alfamart|supermarket|grocery|superindo|hypermart|sayur|sembako/.test(
                receiptText,
              )
            )
              tags.push("belanja-harian");
            if (
              /apotek|pharmacy|klinik|hospital|rumah sakit|obat/.test(
                receiptText,
              )
            )
              tags.push("kesehatan");
            if (!tags.length && merchant)
              tags.push(
                merchant
                  .toLocaleLowerCase("id-ID")
                  .replace(/[^\p{L}\p{N}]+/gu, "-")
                  .replace(/^-|-$/g, "")
                  .slice(0, 32),
              );
            return tags.filter(Boolean).slice(0, 5);
          })();
      if (inferredTags.length) setTagText(inferredTags.join(", "));

      if (extractedText) {
        setNote((current) =>
          current.trim()
            ? `${current}\n\nTeks hasil ekstraksi nota:\n${extractedText.slice(0, 2500)}`
            : `Teks hasil ekstraksi nota:\n${extractedText.slice(0, 2500)}`,
        );
      } else {
        setNote((current) =>
          current.trim()
            ? `${current}\n\nNota diproses dengan AI. Periksa kembali hasil ekstraksi sebelum menyimpan.`
            : "Nota diproses dengan AI. Periksa kembali hasil ekstraksi sebelum menyimpan.",
        );
      }

      return {
        detectedAmount,
        detectedDate,
        merchant,
      };
    };

    const parseAmount = (value: string) => {
      const cleaned = value.replace(/[^\d.,]/g, "");
      if (!cleaned) return 0;
      const digits = cleaned
        .replace(/[.,](?=\d{3}(?:\D|$))/g, "")
        .replace(/[.,]/g, "");
      const number = Number(digits);
      return Number.isSafeInteger(number) ? number : 0;
    };

    const parseLocalOcrText = (text: string) => {
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean);

      const totalKeywords =
        /(?:grand\s*total|total\s*bayar|total\s*belanja|jumlah\s*bayar|total\s*tagihan|amount\s*due|amount\s*paid|total|jumlah)/i;
      let detectedAmount = 0;

      for (let i = lines.length - 1; i >= 0 && !detectedAmount; i -= 1) {
        if (!totalKeywords.test(lines[i])) continue;
        const candidates = lines[i].match(/(?:Rp\.?\s*)?[\d][\d.,]*/gi) ?? [];
        detectedAmount =
          candidates
            .map(parseAmount)
            .filter((n) => n > 0)
            .at(-1) ?? 0;

        if (!detectedAmount && lines[i + 1]) {
          const nextCandidates =
            lines[i + 1].match(/(?:Rp\.?\s*)?[\d][\d.,]*/gi) ?? [];
          detectedAmount =
            nextCandidates
              .map(parseAmount)
              .filter((n) => n > 0)
              .at(-1) ?? 0;
        }
      }

      if (!detectedAmount) {
        const allAmounts = lines
          .flatMap((line) => line.match(/(?:Rp\.?\s*)?[\d][\d.,]*/gi) ?? [])
          .map(parseAmount)
          .filter((n) => n > 0);
        detectedAmount = allAmounts.sort((a, b) => b - a)[0] ?? 0;
      }

      let detectedDate = "";
      const dateMatch =
        text.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/) ??
        text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);

      if (dateMatch) {
        if (dateMatch[1].length === 4) {
          detectedDate = `${dateMatch[1]}-${String(dateMatch[2]).padStart(2, "0")}-${String(dateMatch[3]).padStart(2, "0")}`;
        } else {
          const year =
            dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
          detectedDate = `${year}-${String(dateMatch[2]).padStart(2, "0")}-${String(dateMatch[1]).padStart(2, "0")}`;
        }
        const parsedDate = new Date(`${detectedDate}T12:00:00`);
        if (
          Number.isNaN(parsedDate.getTime()) ||
          parsedDate.toISOString().slice(0, 10) !== detectedDate
        ) {
          detectedDate = "";
        }
      }

      const ignoredLine =
        /^(?:nota|receipt|invoice|struk|tanggal|date|cashier|kasir|telp|phone|www\.|https?:|npwp|thank you|terima kasih)\b/i;
      const merchantLine = lines.find(
        (line) =>
          line.length >= 3 &&
          line.length <= 70 &&
          !ignoredLine.test(line) &&
          !totalKeywords.test(line) &&
          !/\d{4,}/.test(line),
      );

      return {
        merchant: merchantLine ?? "",
        date: detectedDate,
        totalAmount: detectedAmount,
        extractedText: text,
        transactionTypeSuggestion: "expense",
      };
    };

    try {
      // Primary: Gemini API (server-side, API key is never sent to the browser).
      try {
        const preparedFile = await prepareReceiptFile(file);
        if (preparedFile.size > MAX_RECEIPT_UPLOAD_BYTES) {
          throw new Error(
            "Ukuran file masih terlalu besar setelah kompresi. Untuk PDF, coba ekspor ulang dengan ukuran lebih kecil atau gunakan foto nota.",
          );
        }
        const bytes = new Uint8Array(await preparedFile.arrayBuffer());
        let binary = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        const base64 = btoa(binary);

        const response = await fetch("/api/receipt-extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mimeType: isPdf ? "application/pdf" : preparedFile.type,
            data: base64,
            availableAccounts: accountOptions.length
              ? accountOptions
              : ["Bank utama", "Cash"],
            // Minimal history helps suggest an account/tag for repeat merchants.
            recentTransactions: transactions.slice(0, 30).map((tx) => ({
              description: tx.description,
              account: tx.account,
              category: tx.category,
              tags: tx.tags.slice(0, 5),
            })),
            existingTags: Array.from(
              new Set(transactions.flatMap((tx) => tx.tags)),
            ).slice(0, 40),
            availableCategories: categoryOptions("expense"),
            availableCategoriesByType: {
              income: categoryOptions("income"),
              expense: categoryOptions("expense"),
              transfer: categoryOptions("transfer"),
              refund: categoryOptions("refund"),
              asset_purchase: categoryOptions("asset_purchase"),
              debt_payment: categoryOptions("debt_payment"),
              receivable_payment: categoryOptions("receivable_payment"),
              reimburse_payment: categoryOptions("reimburse_payment"),
              adjustment: categoryOptions("adjustment"),
            },
          }),
        });

        const payload = (await response.json()) as {
          error?: string;
          merchant?: unknown;
          date?: unknown;
          totalAmount?: unknown;
          extractedText?: unknown;
          confidence?: unknown;
          accountSuggestion?: unknown;
          tags?: unknown;
          categorySuggestion?: unknown;
          transactionTypeSuggestion?: unknown;
        };

        if (!response.ok) {
          throw new Error(payload.error || "Gemini API tidak tersedia.");
        }

        const hasUsefulData =
          (Number.isSafeInteger(Number(payload.totalAmount)) &&
            Number(payload.totalAmount) > 0) ||
          (typeof payload.date === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(payload.date)) ||
          (typeof payload.merchant === "string" &&
            payload.merchant.trim().length > 0);

        if (!hasUsefulData) {
          throw new Error("Gemini belum menemukan data yang cukup.");
        }

        applyReceiptData(payload);
        if (payload.confidence === "low") {
          toast.warning(
            "Nota dibaca oleh Gemini, tetapi tingkat keyakinannya rendah. Periksa jenis transaksi, nominal, tanggal, akun, kategori, dan tag.",
          );
        } else {
          toast.success(
            "Nota dibaca dengan Gemini AI. Periksa jenis transaksi, nominal, tanggal, akun, kategori, dan tag sebelum menyimpan.",
          );
        }
        return;
      } catch (geminiError) {
        console.warn(
          "Gemini receipt extraction failed; falling back to local OCR:",
          geminiError,
        );
        const geminiErrorMessage =
          geminiError instanceof Error && geminiError.message.trim()
            ? geminiError.message.trim()
            : "Gemini mengembalikan error yang tidak diketahui.";
        // Show the actual message returned by /api/receipt-extract instead of
        // replacing every Gemini failure with a generic frontend toast.
        toast.warning(`${geminiErrorMessage} Mencoba OCR lokal…`, {
          duration: 8000,
        });
      }

      // Fallback: local Tesseract OCR. Works without an API key/internet,
      // but its amount/date detection is less reliable than Gemini.
      const { default: Tesseract } = await import("tesseract.js");
      let text = "";

      if (isImage) {
        const result = await Tesseract.recognize(file, "ind+eng");
        text = result.data.text;
      } else {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const pdf = await pdfjs.getDocument({
          data: await file.arrayBuffer(),
        }).promise;
        const pageTexts: string[] = [];

        for (
          let pageNumber = 1;
          pageNumber <= Math.min(pdf.numPages, 5);
          pageNumber += 1
        ) {
          const page = await pdf.getPage(pageNumber);
          const content = await page.getTextContent();
          const extractedText = content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ")
            .trim();

          if (extractedText.length > 20) {
            pageTexts.push(extractedText);
          } else {
            const viewport = page.getViewport({ scale: 1.8 });
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            if (!context) continue;
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            await page.render({ canvas, canvasContext: context, viewport })
              .promise;
            const result = await Tesseract.recognize(canvas, "ind+eng");
            pageTexts.push(result.data.text);
          }
        }
        text = pageTexts.join("\n");
      }

      const localResult = parseLocalOcrText(text);
      const applied = applyReceiptData(localResult);
      if (applied.detectedAmount || applied.detectedDate || applied.merchant) {
        toast.success(
          "Nota dibaca dengan OCR lokal. Periksa kembali hasil ekstraksi sebelum menyimpan.",
        );
      } else {
        toast.error(
          "OCR lokal belum berhasil mengenali nominal/tanggal/deskripsi. Isi manual atau coba foto yang lebih jelas.",
        );
      }
    } catch (error) {
      console.error("Receipt extraction failed:", error);
      toast.error(
        error instanceof Error
          ? `Gagal membaca nota: ${error.message}`
          : "Gagal membaca nota. Coba file lain atau isi manual.",
      );
    } finally {
      setReceiptProcessing(false);
      if (receiptInputRef.current) receiptInputRef.current.value = "";
    }
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
      <input
        ref={receiptInputRef}
        type="file"
        accept="image/*,application/pdf,.pdf"
        hidden
        onChange={(e) => void handleReceiptUpload(e.target.files?.[0])}
      />
      <div className="page-heading">
        <div>
          <h1>Transaksi</h1>
          <div className="muted">
            Catat dan kelola seluruh pergerakan uangmu.
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
              <option value="included">Masuk laporan</option>
              <option value="excluded">Dikecualikan dari laporan</option>
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
                  <th>Jenis</th>
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
                            <div style={{ marginTop: 4, maxWidth: 360 }}>
                              <div
                                className="muted"
                                style={{
                                  fontSize: 12,
                                  lineHeight: 1.45,
                                  overflowWrap: "anywhere",
                                  display: "-webkit-box",
                                  WebkitBoxOrient: "vertical",
                                  WebkitLineClamp: 2,
                                  overflow: "hidden",
                                  color: "#737b86",
                                }}
                              >
                                {t.note}
                              </div>
                              {t.note.length > 90 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedNote({
                                      title:
                                        t.description || "Catatan transaksi",
                                      content: t.note || "",
                                    })
                                  }
                                  style={{
                                    marginTop: 4,
                                    padding: 0,
                                    border: 0,
                                    background: "transparent",
                                    color: "#187443",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  Lihat catatan
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{t.category}</td>
                    <td>{t.account}</td>
                    <td>{new Date(t.date).toLocaleDateString("id-ID")}</td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 5,
                          alignItems: "center",
                        }}
                      >
                        {(() => {
                          const typeBadge: Record<
                            string,
                            {
                              label: string;
                              color: string;
                              background: string;
                              icon: React.ReactNode;
                            }
                          > = {
                            income: {
                              label: "Pemasukan",
                              color: "#187443",
                              background: "#E5F5EB",
                              icon: <TrendingUp size={12} />,
                            },
                            expense: {
                              label: "Pengeluaran",
                              color: "#B42318",
                              background: "#FDEAEA",
                              icon: <TrendingDown size={12} />,
                            },
                            transfer: {
                              label: "Transfer",
                              color: "#2458A6",
                              background: "#E8F0FE",
                              icon: <ArrowLeftRight size={12} />,
                            },
                            refund: {
                              label: "Refund",
                              color: "#087E70",
                              background: "#E0F7F3",
                              icon: <RotateCcw size={12} />,
                            },
                            asset_purchase: {
                              label: "Pembelian aset",
                              color: "#6941C6",
                              background: "#F0EAFE",
                              icon: <Wallet size={12} />,
                            },
                            debt_payment: {
                              label: "Pembayaran utang",
                              color: "#9A5B00",
                              background: "#FFF0D6",
                              icon: <CreditCard size={12} />,
                            },
                            receivable_payment: {
                              label: "Penerimaan piutang",
                              color: "#087E70",
                              background: "#E0F7F3",
                              icon: <HandCoins size={12} />,
                            },
                            reimburse_payment: {
                              label: "Pembayaran reimburse",
                              color: "#2458A6",
                              background: "#E8F0FE",
                              icon: <Wallet size={12} />,
                            },
                            adjustment: {
                              label: "Penyesuaian",
                              color: "#596579",
                              background: "#EEF1F5",
                              icon: <SlidersHorizontal size={12} />,
                            },
                          };

                          const badge = typeBadge[t.type] ?? {
                            label: t.type,
                            color: "#596579",
                            background: "#EEF1F5",
                            icon: <ArrowLeftRight size={12} />,
                          };

                          return (
                            <span
                              className="badge"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                color: badge.color,
                                background: badge.background,
                                border: "1px solid transparent",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {badge.icon}
                              {badge.label}
                            </span>
                          );
                        })()}

                        {t.reimburseStatus === "pending" && (
                          <span
                            className="badge"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              color: "#9A5B00",
                              background: "#FFF0D6",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <Clock3 size={12} />
                            Menunggu reimburse
                          </span>
                        )}

                        {t.excludedFromReports && (
                          <span
                            className="badge"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              color: "#9A5B00",
                              background: "#FFF0D6",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <FileMinus size={12} />
                            Dikecualikan dari laporan
                          </span>
                        )}
                      </div>
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
            overflowX: "hidden",
            boxSizing: "border-box",
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
              width: "min(720px, calc(100vw - 32px))",
              maxWidth: "100%",
              minWidth: 0,
              boxSizing: "border-box",
              maxHeight: "90vh",
              overflowY: "auto",
              overflowX: "hidden",
              overscrollBehaviorX: "none",
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
            <form
              onSubmit={submit}
              style={{
                display: "grid",
                gap: 17,
                minWidth: 0,
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 10,
                  padding: 13,
                  border: "1px dashed #b9c5bb",
                  borderRadius: 10,
                  background: "#f8fbf8",
                }}
              >
                <ReceiptText size={20} color="#34734a" />
                <div style={{ flex: "1 1 180px" }}>
                  <strong style={{ display: "block", fontSize: 13 }}>
                    Ekstrak dari nota
                  </strong>
                  <span
                    className="muted"
                    style={{ display: "block", marginTop: 3 }}
                  >
                    Foto nota atau upload PDF. Hasilnya akan mengisi form dan
                    tetap perlu diperiksa.
                  </span>
                </div>
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={receiptProcessing}
                  onClick={() => receiptInputRef.current?.click()}
                >
                  {receiptProcessing ? (
                    <>
                      <LoaderCircle size={14} className="animate-spin" />{" "}
                      Membaca nota…
                    </>
                  ) : (
                    <>
                      <Camera size={14} /> Foto / Upload
                    </>
                  )}
                </button>
              </div>
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
                    type="text"
                    value={
                      amount === ""
                        ? ""
                        : Number(amount).toLocaleString("id-ID")
                    }
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      setAmount(value);
                    }}
                    placeholder="Contoh: 2.000.000"
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
                    required
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                  >
                    <option value="" disabled>
                      Pilih akun
                    </option>
                    {accountOptions.length
                      ? accountOptions.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))
                      : ["Bank utama", "Cash"].map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
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
                    padding: 14,
                    display: "grid",
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        Rincian transaksi
                      </div>
                      <div
                        className="muted"
                        style={{ fontSize: 12, marginTop: 4 }}
                      >
                        Bagi nominal ke beberapa kategori.
                      </div>
                    </div>

                    <button
                      type="button"
                      className="secondary-btn"
                      style={{ whiteSpace: "nowrap" }}
                      onClick={() =>
                        setSplitRows((a) => [
                          ...a,
                          { category: "Lainnya", amount: "", note: "" },
                        ])
                      }
                    >
                      <CirclePlus size={14} />
                      Tambah
                    </button>
                  </div>

                  {splitRows.length === 0 && (
                    <div
                      className="empty"
                      style={{
                        border: "1px dashed #d5dbe0",
                        borderRadius: 9,
                        padding: 18,
                        fontSize: 12,
                      }}
                    >
                      Belum ada rincian transaksi.
                      <div style={{ marginTop: 4 }}>
                        Tekan Tambah untuk menambahkan kategori.
                      </div>
                    </div>
                  )}

                  {splitRows.map((row, i) => (
                    <div
                      key={i}
                      style={{
                        border: "1px solid #e4e7ea",
                        borderRadius: 9,
                        padding: 12,
                        display: "grid",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          className="muted"
                          style={{ fontSize: 12, fontWeight: 600 }}
                        >
                          Rincian {i + 1}
                        </span>

                        <button
                          type="button"
                          className="secondary-btn"
                          aria-label={`Hapus rincian ${i + 1}`}
                          style={{ padding: "5px 8px" }}
                          onClick={() =>
                            setSplitRows((a) => a.filter((_, j) => j !== i))
                          }
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div className="field">
                        <label>Kategori</label>
                        <select
                          value={row.category}
                          onChange={(e) =>
                            setSplitRows((a) =>
                              a.map((x, j) =>
                                j === i
                                  ? { ...x, category: e.target.value }
                                  : x,
                              ),
                            )
                          }
                        >
                          {categoryOptions("expense").map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-grid">
                        <div className="field">
                          <label>Nominal (Rp)</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Contoh: 500.000"
                            value={
                              row.amount === ""
                                ? ""
                                : Number(row.amount).toLocaleString("id-ID")
                            }
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, "");
                              setSplitRows((a) =>
                                a.map((x, j) =>
                                  j === i ? { ...x, amount: value } : x,
                                ),
                              );
                            }}
                          />
                        </div>

                        <div className="field">
                          <label>Catatan (opsional)</label>
                          <input
                            type="text"
                            placeholder="Contoh: Makan siang"
                            value={row.note}
                            onChange={(e) =>
                              setSplitRows((a) =>
                                a.map((x, j) =>
                                  j === i ? { ...x, note: e.target.value } : x,
                                ),
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div
                    style={{
                      borderTop: "1px solid #e4e7ea",
                      paddingTop: 12,
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <span className="muted" style={{ fontSize: 12 }}>
                        Total split
                      </span>
                      <strong style={{ fontSize: 14 }}>
                        {formatIDR(
                          splitRows.reduce(
                            (sum, row) => sum + Number(row.amount || 0),
                            0,
                          ),
                        )}
                      </strong>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <span className="muted" style={{ fontSize: 12 }}>
                        Total transaksi
                      </span>
                      <strong style={{ fontSize: 14 }}>
                        {formatIDR(Number(amount || 0))}
                      </strong>
                    </div>

                    {splitRows.reduce(
                      (sum, row) => sum + Number(row.amount || 0),
                      0,
                    ) !== Number(amount || 0) && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#b54708",
                          background: "#fffaeb",
                          borderRadius: 8,
                          padding: 10,
                          lineHeight: 1.5,
                        }}
                      >
                        Total split belum sama dengan nominal transaksi.
                      </div>
                    )}
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
      {selectedNote && (
        <div
          role="presentation"
          onClick={() => setSelectedNote(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15, 23, 42, 0.48)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-note-title"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 480,
              maxHeight: "min(80vh, 640px)",
              overflowY: "auto",
              background: "var(--panel, #fff)",
              color: "var(--text, #20252b)",
              border: "1px solid var(--line, #e4e7ea)",
              borderRadius: 18,
              padding: 20,
              boxShadow: "0 24px 70px rgba(0,0,0,.22)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div
                  className="muted"
                  style={{ fontSize: 12, marginBottom: 5 }}
                >
                  Catatan transaksi
                </div>
                <h2
                  id="transaction-note-title"
                  style={{
                    margin: 0,
                    fontSize: 18,
                    lineHeight: 1.4,
                    overflowWrap: "anywhere",
                  }}
                >
                  {selectedNote.title}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Tutup catatan"
                onClick={() => setSelectedNote(null)}
                style={{
                  border: "1px solid var(--line, #e4e7ea)",
                  borderRadius: 10,
                  width: 36,
                  height: 36,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <X size={17} />
              </button>
            </div>
            <div
              style={{
                marginTop: 16,
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                fontSize: 14,
                lineHeight: 1.7,
                color: "var(--muted, #737b86)",
              }}
            >
              {selectedNote.content}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 20,
              }}
            >
              <button
                type="button"
                className="primary-btn"
                onClick={() => setSelectedNote(null)}
              >
                Tutup
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
