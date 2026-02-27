// src/hooks/usePlan.ts
import { parsePlanFromCsvText, PlanData } from "../lib/plan";
import { useEffect, useMemo, useState } from "react";

function defaultPlan(): PlanData {
  return {
    loaded: false,
    error: "",
    planMonthRaw: "",
    planMonthDate: null,
    overflowBalance: 0,
    hysBalance: 0,
    addFix: 0,
    addDesc: 0,
    incomeProjection: 0,
    incomeBudgetBase: 0,
    plannedHysTransfer: 0,
    fixedBudgets: {},
    discretionaryBudgets: {
      Food: 0,
      Gas: 0,
      "General Merchandise": 0,
      Other: 0
    },
    utilitiesBudgets: {},
    utilitiesOrderFromPlan: [],
    austinWeekly: 0,
    jennaWeekly: 0,
    addIncCount: 0,
    austinPayCount: 0,
    jennaPayCount: 0
  };
}

function csvEscape(value: any): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(headers: string[], rows: any[][]): string {
  const lines: string[] = [];
  lines.push(headers.map(csvEscape).join(","));
  for (const r of rows) {
    lines.push((r ?? []).map(csvEscape).join(","));
  }
  return lines.join("\n");
}

export function usePlan() {
  const [plan, setPlan] = useState<PlanData>(() => defaultPlan());
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let alive = true;

    async function loadPlan() {
      try {
        const apiKey =
          (process.env.REACT_APP_API_KEY as string | undefined) ||
          (process.env.REACT_APP_APP_KEY as string | undefined) ||
          "";

        const res = await fetch(`/api/plan?cb=${Date.now()}`, {
          cache: "no-store",
          headers: apiKey ? { "x-app-key": apiKey } : undefined
        });

        if (!res.ok) {
          const msg = await res.text().catch(() => "");
          throw new Error(`PLAN HTTP ${res.status}${msg ? ` ${msg}` : ""}`);
        }

        const data = await res.json();
        const headers: string[] = Array.isArray(data?.headers) ? data.headers : [];
        const rows: any[][] = Array.isArray(data?.rows) ? data.rows : [];

        const csvText = rowsToCsv(headers, rows);
        const parsed = parsePlanFromCsvText(csvText);

        if (!alive) return;
        setPlan(parsed);
      } catch (e: any) {
        if (!alive) return;
        setPlan((prev) => ({
          ...(prev ?? defaultPlan()),
          loaded: true,
          error: e?.message || String(e)
        }));
      }
    }

    loadPlan();
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const hasPlan = useMemo(() => {
    const p = plan ?? defaultPlan();
    return !!p.loaded && !p.error;
  }, [plan]);

  function refreshPlan() {
    setRefreshKey((k) => k + 1);
  }

  return { plan: plan ?? defaultPlan(), setPlan, hasPlan, refreshPlan };
}