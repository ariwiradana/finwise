"use client";
import { useCallback, useEffect, useState } from "react";
import {
  localDB,
  type LocalRecord,
  DEFAULT_CATEGORIES,
} from "@/lib/offline/database";
export function useLocalRecords(kind: string) {
  const [records, setRecords] = useState<LocalRecord[]>([]);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    if (!localDB) return;
    let rows = await localDB.records.where("kind").equals(kind).toArray();
    if (rows.length === 0 && kind === "accounts") {
      const now = new Date().toISOString();
      const seed = [
        {
          name: "Bank utama",
          data: { type: "Bank", openingBalance: 0, minimumBalance: 0 },
        },
        {
          name: "Cash",
          data: { type: "Cash", openingBalance: 0, minimumBalance: 0 },
        },
      ].map((x) => ({
        id: crypto.randomUUID(),
        kind,
        name: x.name,
        data: x.data,
        createdAt: now,
        updatedAt: now,
      }));
      await localDB.records.bulkAdd(seed);
      rows = seed;
    }
    if (rows.length === 0 && kind === "categories") {
      const now = new Date().toISOString();
      const seed = DEFAULT_CATEGORIES.map((x) => ({
        id: crypto.randomUUID(),
        kind,
        name: x.name,
        data: { type: x.type, parent: "", color: "" },
        createdAt: now,
        updatedAt: now,
      }));
      await localDB.records.bulkAdd(seed);
      rows = seed;
    }
    setRecords(
      rows
        .filter((x) => !x.archivedAt)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    );
    setReady(true);
  }, [kind]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const save = useCallback(
    async (name: string, data: Record<string, unknown>, id?: string) => {
      if (!localDB) throw new Error("Database lokal tidak tersedia");
      const now = new Date().toISOString();
      if (id) {
        const old = await localDB.records.get(id);
        await localDB.records.update(id, { name, data, updatedAt: now });
        await localDB.audit.add({
          id: crypto.randomUUID(),
          entityType: kind,
          entityId: id,
          action: "update",
          before: old,
          after: { name, data },
          createdAt: now,
        });
      } else {
        const row: LocalRecord = {
          id: crypto.randomUUID(),
          kind,
          name,
          data,
          createdAt: now,
          updatedAt: now,
        };
        await localDB.records.add(row);
        await localDB.audit.add({
          id: crypto.randomUUID(),
          entityType: kind,
          entityId: row.id,
          action: "create",
          after: row,
          createdAt: now,
        });
      }
      if (kind === "valuations" && data.asset) {
        const linked = await localDB.records
          .where("kind")
          .equals("assets")
          .toArray();
        const asset = linked.find((x) => x.name === String(data.asset));
        if (asset) {
          const before = asset;
          const nextData = {
            ...asset.data,
            currentValue: Number(data.value || 0),
            valuationDate: String(data.date || ""),
          };
          await localDB.records.update(asset.id, {
            data: nextData,
            updatedAt: now,
          });
          await localDB.audit.add({
            id: crypto.randomUUID(),
            entityType: "assets",
            entityId: asset.id,
            action: "valuation_update",
            before,
            after: { ...asset, data: nextData },
            createdAt: now,
          });
        }
      }
      await refresh();
    },
    [kind, refresh],
  );
  const archive = useCallback(
    async (id: string) => {
      if (!localDB) return;
      const old = await localDB.records.get(id);
      const now = new Date().toISOString();
      await localDB.records.update(id, { archivedAt: now, updatedAt: now });
      await localDB.audit.add({
        id: crypto.randomUUID(),
        entityType: kind,
        entityId: id,
        action: "archive",
        before: old,
        createdAt: now,
      });
      await refresh();
    },
    [kind, refresh],
  );
  return { records, ready, refresh, save, archive };
}
