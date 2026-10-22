import { RecordManager } from "@/components/record-manager";

export default function Page() {
  return (
    <RecordManager
      kind="accounts"
      title="Akun & Rekening"
      description="Kelola bank, cash, e-wallet, tabungan, investasi, dan kartu kredit."
      fields={[
        {
          key: "type",
          label: "Jenis akun",
          type: "select",
          options: [
            "Cash",
            "Bank",
            "E-wallet",
            "Tabungan",
            "Deposito",
            "Investasi",
            "Kartu kredit",
          ],
          required: true,
        },
        {
          key: "openingBalance",
          label: "Saldo awal (IDR)",
          type: "number",
          required: true,
          allowNegative: true,
        },
        {
          key: "openingBalanceDate",
          label: "Tanggal saldo awal",
          type: "date",
          required: true,
        },
        {
          key: "minimumBalance",
          label: "Batas saldo minimum (IDR)",
          type: "number",
          required: false,
        },
        {
          key: "excludeFromReports",
          label: "Pengecualian dari laporan",
          type: "checkbox",
          required: false,
        },
      ]}
      amountKey="openingBalance"
    />
  );
}
