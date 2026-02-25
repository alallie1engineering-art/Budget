// src/hooks/usePlan.ts
import { parsePlanFromCsvText, PlanData } from "../lib/plan";
import { useEffect, useMemo, useState } from "react";

export const PLAN_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSyGwb7qnavzNq9ZqNpiN4D7dByaoPUjTnDHw2qDkdnPcUJ4ug2_aqbPTUNKQQko4Uuu-6JZOCNKCsE/pub?gid=835419007&single=true&output=csv";

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
      Other: 0,
    },
    utilitiesBudgets: {},
    utilitiesOrderFromPlan: [],
  };
}

export function usePlan() {
  const [plan, setPlan] = useState<PlanData>(() => defaultPlan());

  useEffect(() => {
    let alive = true;

    async function loadPlan() {
      try {
        const url = PLAN_CSV_URL + "&cb=" + Date.now();
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`PLAN HTTP ${res.status}`);
        const text = await res.text();
        const parsed = parsePlanFromCsvText(text);

        if (!alive) return;
        setPlan(parsed);
      } catch (e: any) {
        if (!alive) return;
        setPlan((prev) => ({
          ...(prev ?? defaultPlan()),
          loaded: true,
          error: e?.message || String(e),
        }));
      }
    }

    loadPlan();
    return () => {
      alive = false;
    };
  }, []);

  const hasPlan = useMemo(() => {
    const p = plan ?? defaultPlan();
    return !!p.loaded && !p.error;
  }, [plan]);

  return { plan: plan ?? defaultPlan(), setPlan, hasPlan };
}
