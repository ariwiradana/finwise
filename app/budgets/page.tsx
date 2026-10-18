"use client";

import { useMemo } from "react";
import { RecordManager } from "@/components/record-manager";
import { useLocalRecords } from "@/components/local-records";

export default function BudgetPage() {
  const { records: categoryRecords, ready: categoriesReady } =
    useLocalRecords("categories");

  // Use the same locally saved categories managed by the Categories menu.
  // Budgets should only be assigned to expense categories.
  const categoryOptions = useMemo(() => {
    return Array.from(
      new Set(
        categoryRecords
          .filter((record) => {
            const type = String(record.data.type || "expense")
              .trim()
              .toLowerCase();
            return ["expense", "pengeluaran"].includes(type);
          })
          .map((record) => record.name.trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, "id"));
  }, [categoryRecords]);

  return (
    <>
      <RecordManager
        kind="budgets"
        title="Budget"
        description="Tetapkan batas bulanan dan pantau progres pemakaian."
        fields={[
          {
            key: "category",
            label: "Kategori",
            type: "select",
            options: categoryOptions,
            required: true,
            placeholder: categoriesReady
              ? "Pilih kategori pengeluaran"
              : "Memuat kategori…",
          },
          {
            key: "limit",
            label: "Limit bulanan (IDR)",
            type: "number",
            required: true,
          },
          {
            key: "month",
            label: "Bulan mulai",
            type: "date",
            required: true,
          },
          {
            key: "alerts",
            label: "Ambang notifikasi (%)",
            type: "number",
            required: true,
          },
        ]}
        amountKey="limit"
      />
    </>
  );
}
