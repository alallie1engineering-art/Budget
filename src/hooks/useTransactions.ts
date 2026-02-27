// src/hooks/useTransactions.ts
import { useEffect, useMemo, useState } from "react";
import { parseCsv, parseAmount, parseDate, pick } from "../csv";
import { API_APP_KEY } from "../config";
import { TxRow } from "../types";
import { dayKey, monthKey } from "../lib/dates";
import { isTruthy, safeLower, safeTrim } from "../lib/text";
import { categoryToBucket, isTransferType } from "../lib/categorize";

const TABLE_START = new Date(2023, 11, 1);

export function useTransactions() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [tx, setTx] = useState<TxRow[]>([]);
  const [months, setMonths] = useState<Date[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErr("");

      try {
const res = await fetch("/api/transactions", {
  cache: "no-store",
  headers: API_APP_KEY ? { "x-app-key": API_APP_KEY } : undefined,
});

if (!res.ok) throw new Error(`HTTP ${res.status}`);

const json = await res.json();
if (json?.error) throw new Error(json.error);

const headers: string[] = json.headers || [];
const rawRows: any[] = json.rows || [];

const rows = rawRows.map((r: any[]) => {
  const obj: any = {};
  for (let i = 0; i < headers.length; i += 1) obj[headers[i]] = r[i];
  return obj;
});
console.log("TX headers", headers);
console.log("TX first row", rawRows?.[0]);
        const mapped = rows
          .map((r: any) => {
            const date = parseDate(pick(r, ["Date"]));
            if (!date) return null;

            const desc = safeTrim(pick(r, ["Transaction"]));
            const category = safeTrim(pick(r, ["Category"]));
            const type = safeTrim(pick(r, ["Type"]));
            const amt = parseAmount(pick(r, ["Amount"]));
            const ignore = isTruthy(pick(r, ["Ignore"]));
            const bucket = categoryToBucket(category);

            return { date, desc, category, type, amt, ignore, bucket };
          })
          .filter(Boolean) as any[];

        const cleaned: TxRow[] = mapped
          .filter(
            (t: any) =>
              t.desc &&
              !t.ignore &&
              !isTransferType(t.type) &&
              t.bucket !== "IGNORE"
          )
          .map((t: any) => ({
            date: t.date,
            desc: t.desc,
            category: t.category,
            type: t.type,
            amt: t.amt,
            bucket: t.bucket,
          }));

        const seen = new Set<string>();
        const deduped: TxRow[] = [];
        for (const t of cleaned) {
          const k = dayKey(t.date) + "|" + safeLower(t.desc) + "|" + t.amt;
          if (seen.has(k)) continue;
          seen.add(k);
          deduped.push(t);
        }
        deduped.sort((a, b) => b.date.getTime() - a.date.getTime());

        const monthMap = new Map<string, Date>();
        for (const t of deduped) {
          monthMap.set(
            monthKey(t.date),
            new Date(t.date.getFullYear(), t.date.getMonth(), 1)
          );
        }

        const monthList = Array.from(monthMap.values())
          .filter((m) => m >= TABLE_START)
          .sort((a, b) => a.getTime() - b.getTime());

        const def = monthList.length
          ? monthList[monthList.length - 1]
          : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

        if (!alive) return;
        setTx(deduped);
        setMonths(monthList);
        setSelectedMonth(def);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || String(e));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const txByMonth = useMemo(() => {
    const map = new Map<string, TxRow[]>();
    for (const t of tx) {
      const k = monthKey(t.date);
      const list = map.get(k);
      if (list) list.push(t);
      else map.set(k, [t]);
    }
    return map;
  }, [tx]);

  const monthTx = useMemo(() => {
    if (!selectedMonth) return [];
    return txByMonth.get(monthKey(selectedMonth)) || [];
  }, [txByMonth, selectedMonth]);

  return {
    loading,
    err,
    tx,
    months,
    selectedMonth,
    setSelectedMonth,
    txByMonth,
    monthTx,
  };
}
