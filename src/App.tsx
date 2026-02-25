// src/App.tsx
import React, { useMemo, useState } from "react";
import {
  BUDGETS,
  BUCKETS,
  BUCKET_UI,
  DOT_COLORS,
  FIXED_BUDGETS,
  FIXED_ORDER,
  TOTAL_DISCRETIONARY_BUDGET,
  UTILITIES_BUDGETS,
  UTILITIES_ORDER,
} from "./config";
import { Bucket, Tab, HistoryRow } from "./types";
import { useTransactions } from "./hooks/useTransactions";
import { usePlan } from "./hooks/usePlan";
import { monthKey, monthLabel, isSameMonth } from "./lib/dates";
import {
  CONTROLLED_BUCKETS,
  isDiscretionaryType,
  isFixedType,
  isIncomeType,
  normalizeFixedBucket,
  shouldForceToDiscretionary,
  utilityLine,
} from "./lib/categorize";
import {
  clamp0,
  fmtMoney0,
  statClassForBudget,
  statClassForRemaining,
  sumAbsSpendFromNet,
} from "./lib/format";

import ForecastTab from "./components/ForecastTab";
import { Sparkline } from "./components/Sparkline";
import { OverflowBarChart } from "./components/Overflowbarchart";
import { DonutRing } from "./components/DonutRing";
import { VarianceBarLive } from "./components/VarianceBarLive";
import { FixedHealthBanner } from "./components/FixedHealthBanner";
import { SavingsBarChart } from "./components/Savingsbarchart";

const DASHBOARD_PASSWORD = "skeetsie";

const BUCKET_PILL: Record<string, { bg: string; color: string }> = {
  Food: { bg: "#FEF3C7", color: "#92400E" },
  Gas: { bg: "#DBEAFE", color: "#1E40AF" },
  "General Merchandise": { bg: "#F3E8FF", color: "#6B21A8" },
  Other: { bg: "#F1F5F9", color: "#475569" },
};

const BUCKET_LIST = BUCKETS as readonly Bucket[];

const SUM_ROW: React.CSSProperties = { background: "rgba(0,0,0,0.035)" };
const SUM_CELL: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: 13,
  fontWeight: 900,
};
const TD: React.CSSProperties = { padding: "11px 14px", fontSize: 13 };

function HeroBreakdownBar({
  income,
  fixedSpend,
  discSpend,
  savingsTransfer,
  overflowHistory,
}: {
  income: number;
  fixedSpend: number;
  discSpend: number;
  savingsTransfer: number;
  overflowHistory: number[];
}) {
  const total = Math.max(1, income);
  const wFixed = Math.min(100, (fixedSpend / total) * 100);
  const wDisc = Math.min(100, (discSpend / total) * 100);
  const wSave = Math.min(100, (savingsTransfer / total) * 100);
  const wLeft = Math.max(0, 100 - wFixed - wDisc - wSave);
  const overflow = income - fixedSpend - discSpend - savingsTransfer;

  const segments = [
    {
      label: "Fixed",
      pct: wFixed,
      value: fixedSpend,
      color: "rgba(239,68,68,0.75)",
      textColor: "#991B1B",
    },
    {
      label: "Discretionary",
      pct: wDisc,
      value: discSpend,
      color: "rgba(245,158,11,0.75)",
      textColor: "#92400E",
    },
    {
      label: "Savings",
      pct: wSave,
      value: savingsTransfer,
      color: "rgba(34,197,94,0.75)",
      textColor: "#166534",
    },
    {
      label: "Overflow",
      pct: wLeft,
      value: Math.max(0, overflow),
      color: "rgba(99,102,241,0.55)",
      textColor: "#3730a3",
    },
  ];

  const trendUp =
    overflowHistory.length >= 2
      ? overflowHistory[overflowHistory.length - 1] >
        overflowHistory[overflowHistory.length - 2]
      : null;

  return (
    <div
      style={{
        background: "white",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "24px 28px",
        marginBottom: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 18,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: "var(--warm-gray)",
              fontWeight: 700,
            }}
          >
            Monthly Income
          </div>
          <div
            style={{
              fontFamily: "DM Serif Display, serif",
              fontSize: 38,
              lineHeight: 1,
              marginTop: 4,
              color: "#166534",
            }}
          >
            {fmtMoney0(income)}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 18,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          {segments.map((s) => (
            <div key={s.label} style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--warm-gray)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: s.textColor,
                  marginTop: 2,
                }}
              >
                {fmtMoney0(s.value)}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--warm-gray)",
                  marginTop: 1,
                }}
              >
                {Math.round(s.pct)}%
              </div>
            </div>
          ))}

          {overflowHistory.length > 1 ? (
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--warm-gray)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  marginBottom: 5,
                }}
              >
                Trend {trendUp === true ? "↑" : trendUp === false ? "↓" : ""}
              </div>
              <Sparkline
                values={overflowHistory.map((v) => Math.max(0, v))}
                color={trendUp ? "#4ADE80" : "#F87171"}
                width={64}
                height={26}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          height: 22,
          borderRadius: 999,
          overflow: "hidden",
          display: "flex",
          border: "1px solid var(--border)",
        }}
      >
        {segments.map((s) =>
          s.pct > 0 ? (
            <div
              key={s.label}
              style={{
                width: `${s.pct}%`,
                background: s.color,
                transition: "width 0.6s ease",
              }}
              title={`${s.label}: ${fmtMoney0(s.value)}`}
            />
          ) : null
        )}
      </div>

      <div style={{ position: "relative", height: 18, marginTop: 6 }}>
        {segments.map((s, i) => {
          const offset = segments.slice(0, i).reduce((a, b) => a + b.pct, 0);
          return s.pct > 5 ? (
            <div
              key={s.label}
              style={{
                position: "absolute",
                left: `${offset + s.pct / 2}%`,
                transform: "translateX(-50%)",
                fontSize: 10,
                color: "var(--warm-gray)",
                whiteSpace: "nowrap",
                fontWeight: 500,
              }}
            >
              {s.label}
            </div>
          ) : null;
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [pw, setPw] = useState("");
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem("budget_unlocked") === "1";
    } catch {
      return false;
    }
  });
  const [pwError, setPwError] = useState("");
  const [tab, setTab] = useState<Tab>("budget_overview");

  const {
    loading,
    err,
    months,
    selectedMonth,
    setSelectedMonth,
    txByMonth,
    monthTx,
  } = useTransactions();

  const { plan, hasPlan } = usePlan();

  const [filter, setFilter] = useState<string>("all");
  const [showCount, setShowCount] = useState<number>(20);
  const [selectedFixedLine, setSelectedFixedLine] = useState<string>("");
  const [selectedUtilityLine, setSelectedUtilityLine] = useState<string>("");

  function tryUnlock() {
    if (pw.trim().toLowerCase() === DASHBOARD_PASSWORD) {
      try {
        localStorage.setItem("budget_unlocked", "1");
      } catch {}
      setUnlocked(true);
      setPw("");
      setPwError("");
      return;
    }
    setPwError("Wrong password");
  }

  function lock() {
    try {
      localStorage.removeItem("budget_unlocked");
    } catch {}
    setUnlocked(false);
    setPw("");
    setPwError("");
  }

  const utilitiesLines = useMemo(() => {
    if (hasPlan && plan.utilitiesOrderFromPlan.length)
      return plan.utilitiesOrderFromPlan;
    if (hasPlan) {
      const keys = Object.keys(plan.utilitiesBudgets || {});
      if (keys.length) return keys;
    }
    return [...UTILITIES_ORDER];
  }, [hasPlan, plan.utilitiesBudgets, plan.utilitiesOrderFromPlan]);

  const todayMonth = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }, []);

  const isCurrentMonth = useMemo(() => {
    return selectedMonth ? isSameMonth(selectedMonth, todayMonth) : false;
  }, [selectedMonth, todayMonth]);

  const monthIndex = useMemo(() => {
    if (!selectedMonth) return -1;
    return months.findIndex((m) => m.getTime() === selectedMonth.getTime());
  }, [months, selectedMonth]);

  const discretionaryTx = useMemo(() => {
    return monthTx.filter((t) => isDiscretionaryType(t.type));
  }, [monthTx]);

  const effectiveDiscBudgets = useMemo(() => {
    if (!hasPlan) return BUDGETS as any;
    return {
      Food: plan.discretionaryBudgets.Food || (BUDGETS as any).Food || 0,
      Gas: plan.discretionaryBudgets.Gas || (BUDGETS as any).Gas || 0,
      "General Merchandise":
        plan.discretionaryBudgets["General Merchandise"] ||
        (BUDGETS as any)["General Merchandise"] ||
        0,
      Other: plan.discretionaryBudgets.Other || (BUDGETS as any).Other || 0,
    };
  }, [hasPlan, plan.discretionaryBudgets]);

  const effectiveFixedBudgets = useMemo(() => {
    if (!hasPlan) return FIXED_BUDGETS as any;
    const out: any = {};
    for (const k of FIXED_ORDER) {
      out[k] = plan.fixedBudgets[k] ?? (FIXED_BUDGETS as any)[k] ?? 0;
    }
    return out;
  }, [hasPlan, plan.fixedBudgets]);

  const effectiveUtilsBudgets = useMemo(() => {
    if (!hasPlan) return UTILITIES_BUDGETS as any;
    const out: any = {};
    for (const u of utilitiesLines) {
      out[u] = plan.utilitiesBudgets[u] ?? (UTILITIES_BUDGETS as any)[u] ?? 0;
    }
    return out;
  }, [hasPlan, plan.utilitiesBudgets, utilitiesLines]);

  const totalDiscBudget = useMemo(() => {
    const b = effectiveDiscBudgets as any;
    const t =
      (b.Food || 0) +
      (b.Gas || 0) +
      (b["General Merchandise"] || 0) +
      (b.Other || 0);
    return Number.isFinite(t) && t > 0 ? t : TOTAL_DISCRETIONARY_BUDGET;
  }, [effectiveDiscBudgets]);

  const spentByBucket = useMemo(() => {
    const out: Record<Bucket, number> = {
      Food: 0,
      Gas: 0,
      "General Merchandise": 0,
      Other: 0,
    };

    for (const t of discretionaryTx) {
      if (t.amt < 0) out[t.bucket] += Math.abs(t.amt);
      if (t.amt > 0) out[t.bucket] -= Math.abs(t.amt);
    }

    for (const b of BUCKET_LIST) out[b] = clamp0(out[b]);
    return out;
  }, [discretionaryTx]);

  const totalSpent = useMemo(() => {
    return (Object.values(spentByBucket) as number[]).reduce((a, b) => a + b, 0);
  }, [spentByBucket]);

  const controlledBudget = useMemo(() => {
    const b = effectiveDiscBudgets as any;
    return (b.Food || 0) + (b.Gas || 0) + (b["General Merchandise"] || 0);
  }, [effectiveDiscBudgets]);

  const controlledSpent = useMemo(() => {
    return CONTROLLED_BUCKETS.reduce((sum, k) => sum + (spentByBucket[k] || 0), 0);
  }, [spentByBucket]);

  const remaining = useMemo(() => {
    return controlledBudget - controlledSpent;
  }, [controlledBudget, controlledSpent]);

  const sparklineData = useMemo(() => {
    const out: Record<Bucket, number[]> = {
      Food: [],
      Gas: [],
      "General Merchandise": [],
      Other: [],
    };

    const last = months.slice(-6);

    for (const m of last) {
      const mTx = txByMonth.get(monthKey(m)) || [];
      const disc = mTx.filter((t) => isDiscretionaryType(t.type));

      const bt: Record<Bucket, number> = {
        Food: 0,
        Gas: 0,
        "General Merchandise": 0,
        Other: 0,
      };

      for (const t of disc) {
        if (t.amt < 0) bt[t.bucket] += Math.abs(t.amt);
        if (t.amt > 0) bt[t.bucket] -= Math.abs(t.amt);
      }

      for (const b of BUCKET_LIST) out[b].push(clamp0(bt[b]));
    }

    return out;
  }, [months, txByMonth]);

  const threeMonthAvg = useMemo(() => {
    const out: Record<Bucket, number> = {
      Food: 0,
      Gas: 0,
      "General Merchandise": 0,
      Other: 0,
    };
    if (!selectedMonth) return out;

    const idx = months.findIndex((m) => m.getTime() === selectedMonth.getTime());
    if (idx < 0) return out;

    const win = months.slice(Math.max(0, idx - 2), idx + 1);
    const sums: Record<Bucket, number> = {
      Food: 0,
      Gas: 0,
      "General Merchandise": 0,
      Other: 0,
    };

    for (const m of win) {
      const mTx = txByMonth.get(monthKey(m)) || [];
      const disc = mTx.filter((t) => isDiscretionaryType(t.type));
      for (const t of disc) {
        if (t.amt < 0) sums[t.bucket] += Math.abs(t.amt);
        if (t.amt > 0) sums[t.bucket] -= Math.abs(t.amt);
      }
    }

    for (const b of BUCKET_LIST) {
      out[b] = win.length ? clamp0(sums[b]) / win.length : 0;
    }

    return out;
  }, [months, selectedMonth, txByMonth]);

  const overviewMonth = useMemo(() => {
    let income = 0;
    let fixedNet = 0;
    let savingsNet = 0;
    let discNet = 0;

    for (const t of monthTx) {
      if (isIncomeType(t.type)) income += t.amt;

      const forceDisc = shouldForceToDiscretionary(t.category);
      if (isDiscretionaryType(t.type) || forceDisc) discNet += t.amt;

      if (isFixedType(t.type) && !forceDisc) {
        const fb = normalizeFixedBucket(t.category);
        if (fb === "Ignore") continue;
        if (fb === "Savings") savingsNet += t.amt;
        else fixedNet += t.amt;
      }
    }

    const fixedSpend = sumAbsSpendFromNet(fixedNet);
    const discSpend = sumAbsSpendFromNet(discNet);
    const savingsTransfer = sumAbsSpendFromNet(savingsNet);

    return {
      income,
      fixedSpend,
      discSpend,
      savingsTransfer,
      overflow: income - fixedSpend - discSpend - savingsTransfer,
    };
  }, [monthTx]);

  const overviewByMonthRaw = useMemo(() => {
    const sorted = months.slice().sort((a, b) => b.getTime() - a.getTime());
    return sorted.map((m) => {
      const mTx = txByMonth.get(monthKey(m)) || [];

      let income = 0;
      let fixedNet = 0;
      let savingsNet = 0;
      let discNet = 0;

      for (const t of mTx) {
        if (isIncomeType(t.type)) income += t.amt;

        const forceDisc = shouldForceToDiscretionary(t.category);
        if (isDiscretionaryType(t.type) || forceDisc) discNet += t.amt;

        if (isFixedType(t.type) && !forceDisc) {
          const fb = normalizeFixedBucket(t.category);
          if (fb === "Ignore") continue;
          if (fb === "Savings") savingsNet += t.amt;
          else fixedNet += t.amt;
        }
      }

      const fixedSpend = sumAbsSpendFromNet(fixedNet);
      const discSpend = sumAbsSpendFromNet(discNet);
      const savingsTransfer = sumAbsSpendFromNet(savingsNet);
      const overflow = income - fixedSpend - discSpend - savingsTransfer;

      return {
        month: m,
        income,
        fixedSpend,
        discSpend,
        savingsTransfer,
        overflow,
      };
    });
  }, [months, txByMonth]);

  const overflowHistory = useMemo(() => {
    return overviewByMonthRaw
      .slice(0, 6)
      .reverse()
      .map((r) => r.overflow);
  }, [overviewByMonthRaw]);

  const historyRows = useMemo((): HistoryRow[] => {
    const rows: HistoryRow[] = [];
    const prior = overviewByMonthRaw.filter((r) => !isSameMonth(r.month, todayMonth));

    const byYear: Record<number, any> = {};
    for (const r of prior) {
      const y = r.month.getFullYear();
      if (!byYear[y]) {
        byYear[y] = {
          income: 0,
          fixedSpend: 0,
          discSpend: 0,
          savingsTransfer: 0,
          overflow: 0,
        };
      }
      byYear[y].income += r.income;
      byYear[y].fixedSpend += r.fixedSpend;
      byYear[y].discSpend += r.discSpend;
      byYear[y].savingsTransfer += r.savingsTransfer;
      byYear[y].overflow += r.overflow;
    }

    const years = Array.from(new Set(prior.map((r) => r.month.getFullYear()))).sort(
      (a, b) => b - a
    );

    for (let i = 0; i < years.length; i++) {
      const year = years[i];
      if (i !== 0) rows.push({ kind: "spacer", id: `spacer-${year}` });
      rows.push({ kind: "year", year, ...byYear[year] });
      for (const r of prior.filter((x) => x.month.getFullYear() === year)) {
        rows.push({ kind: "month", ...r });
      }
    }

    return rows;
  }, [overviewByMonthRaw, todayMonth]);

  const historyChartData = useMemo(() => {
    return overviewByMonthRaw
      .filter((r) => !isSameMonth(r.month, todayMonth))
      .slice(0, 24)
      .reverse();
  }, [overviewByMonthRaw, todayMonth]);

  const savingsChartData = useMemo(() => {
    return overviewByMonthRaw
      .filter((r) => !isSameMonth(r.month, todayMonth))
      .slice(0, 24)
      .reverse()
      .map((r) => ({
        month: r.month,
        savingsTransfer: r.savingsTransfer,
      }));
  }, [overviewByMonthRaw, todayMonth]);

  const savingsTransferActual = useMemo(() => {
    let net = 0;
    for (const t of monthTx) {
      if (!isFixedType(t.type) || shouldForceToDiscretionary(t.category)) continue;
      if (normalizeFixedBucket(t.category) !== "Savings") continue;
      net += t.amt;
    }
    return sumAbsSpendFromNet(net);
  }, [monthTx]);

  function calcFixedForMonth(m: Date): Record<string, number> {
    const mTx = txByMonth.get(monthKey(m)) || [];
    const out: Record<string, number> = {};
    for (const n of FIXED_ORDER) out[n] = 0;

    for (const t of mTx) {
      if (!isFixedType(t.type) || shouldForceToDiscretionary(t.category)) continue;
      const fb = normalizeFixedBucket(t.category);
      if (fb === "Ignore" || fb === "Savings") continue;
      if (!out[fb]) out[fb] = 0;

      if (t.amt < 0) out[fb] += Math.abs(t.amt);
      if (t.amt > 0) out[fb] -= Math.abs(t.amt);
    }

    for (const k of Object.keys(out)) out[k] = clamp0(out[k]);
    return out;
  }

  function calcUtilsForMonth(m: Date, lines: string[]): Record<string, number> {
    const mTx = txByMonth.get(monthKey(m)) || [];
    const out: Record<string, number> = {};
    for (const n of lines) out[n] = 0;

    for (const t of mTx) {
      if (!isFixedType(t.type) || shouldForceToDiscretionary(t.category)) continue;
      if (normalizeFixedBucket(t.category) !== "Utiities") continue;

      const line = utilityLine(t.desc);
      if (!out[line]) out[line] = 0;

      if (t.amt < 0) out[line] += Math.abs(t.amt);
      if (t.amt > 0) out[line] -= Math.abs(t.amt);
    }

    for (const k of Object.keys(out)) out[k] = clamp0(out[k]);
    return out;
  }

  const fixedSpendByLine = useMemo(() => {
    return selectedMonth ? calcFixedForMonth(selectedMonth) : ({} as Record<string, number>);
  }, [selectedMonth, txByMonth]);

  const utilitiesActualByLine = useMemo(() => {
    return selectedMonth
      ? calcUtilsForMonth(selectedMonth, utilitiesLines)
      : ({} as Record<string, number>);
  }, [selectedMonth, txByMonth, utilitiesLines]);

  const fixedThreeMonthAvg = useMemo(() => {
    const avg: Record<string, number> = {};
    for (const n of FIXED_ORDER) avg[n] = 0;
    if (!selectedMonth) return avg;

    const idx = months.findIndex((m) => m.getTime() === selectedMonth.getTime());
    if (idx < 0) return avg;

    const win = months.slice(Math.max(0, idx - 2), idx + 1);
    const sums: Record<string, number> = {};
    for (const n of FIXED_ORDER) sums[n] = 0;

    for (const m of win) {
      const mf = calcFixedForMonth(m);
      for (const n of FIXED_ORDER) sums[n] += mf[n] || 0;
    }

    for (const n of FIXED_ORDER) avg[n] = sums[n] / win.length;
    return avg;
  }, [months, selectedMonth, txByMonth]);

  const utilitiesThreeMonthAvg = useMemo(() => {
    const avg: Record<string, number> = {};
    for (const n of utilitiesLines) avg[n] = 0;
    if (!selectedMonth) return avg;

    const idx = months.findIndex((m) => m.getTime() === selectedMonth.getTime());
    if (idx < 0) return avg;

    const win = months.slice(Math.max(0, idx - 2), idx + 1);
    const sums: Record<string, number> = {};
    for (const n of utilitiesLines) sums[n] = 0;

    for (const m of win) {
      const mu = calcUtilsForMonth(m, utilitiesLines);
      for (const n of utilitiesLines) sums[n] += mu[n] || 0;
    }

    for (const n of utilitiesLines) avg[n] = sums[n] / win.length;
    return avg;
  }, [months, selectedMonth, txByMonth, utilitiesLines]);

  const fixedTotals = useMemo(() => {
    const totalBudget = FIXED_ORDER.reduce((a, n) => a + ((effectiveFixedBudgets as any)[n] || 0), 0);
    const totalActual = FIXED_ORDER.reduce((a, n) => a + (fixedSpendByLine[n] || 0), 0);
    const totalAvg3 = FIXED_ORDER.reduce((a, n) => a + (fixedThreeMonthAvg[n] || 0), 0);
    return {
      totalBudget,
      totalActual,
      totalVariance: totalBudget - totalActual,
      totalAvg3,
    };
  }, [effectiveFixedBudgets, fixedSpendByLine, fixedThreeMonthAvg]);

  const utilitiesTotals = useMemo(() => {
    const totalBudget = utilitiesLines.reduce((a, n) => a + ((effectiveUtilsBudgets as any)[n] || 0), 0);
    const totalActual = utilitiesLines.reduce((a, n) => a + (utilitiesActualByLine[n] || 0), 0);
    const totalAvg3 = utilitiesLines.reduce((a, n) => a + (utilitiesThreeMonthAvg[n] || 0), 0);
    return {
      totalBudget,
      totalActual,
      totalVariance: totalBudget - totalActual,
      totalAvg3,
    };
  }, [effectiveUtilsBudgets, utilitiesActualByLine, utilitiesThreeMonthAvg, utilitiesLines]);

  const fixedHealthScore = useMemo(() => {
    const withBudget = FIXED_ORDER.filter((n) => ((effectiveFixedBudgets as any)[n] || 0) > 0);
    const onTrack = withBudget.filter(
      (n) => (fixedSpendByLine[n] || 0) <= ((effectiveFixedBudgets as any)[n] || 0)
    );
    return { linesOnTrack: onTrack.length, total: withBudget.length };
  }, [effectiveFixedBudgets, fixedSpendByLine]);

  const filteredAllTx = useMemo(() => {
    return filter === "all" ? discretionaryTx : discretionaryTx.filter((t) => t.bucket === (filter as Bucket));
  }, [discretionaryTx, filter]);

  const filterRunningTotal = useMemo(() => {
    return filteredAllTx.reduce(
      (acc, t) =>
        t.amt < 0 ? acc + Math.abs(t.amt) : t.amt > 0 ? acc - Math.abs(t.amt) : acc,
      0
    );
  }, [filteredAllTx]);

  const filteredTx = useMemo(() => filteredAllTx.slice(0, showCount), [filteredAllTx, showCount]);

  const actualFixedTotal = useMemo(() => FIXED_ORDER.reduce((a, n) => a + (fixedSpendByLine[n] || 0), 0), [fixedSpendByLine]);

  const actualDiscTotal = totalSpent;
  const actualIncome = overviewMonth.income;
  const actualSavings = savingsTransferActual;

  const budgetIncome = isCurrentMonth ? plan.incomeProjection || 0 : plan.incomeBudgetBase || 0;

  const budgetFixed = useMemo(() => {
    return FIXED_ORDER.reduce((a, n) => a + ((effectiveFixedBudgets as any)[n] || 0), 0);
  }, [effectiveFixedBudgets]);

  const budgetDisc = totalDiscBudget;
  const budgetSavings = plan.plannedHysTransfer || 0;

  const projectedIncome = isCurrentMonth ? budgetIncome : actualIncome;

  const projectedFixed = isCurrentMonth
    ? Math.max(actualFixedTotal, budgetFixed) + (plan.addFix || 0)
    : actualFixedTotal;

  const otherSpent = spentByBucket.Other || 0;

  const projectedDisc = isCurrentMonth
    ? Math.max(controlledSpent, controlledBudget) + otherSpent + (plan.addDesc || 0)
    : actualDiscTotal;

  const projectedSavings = isCurrentMonth ? (actualSavings > 0 ? actualSavings : budgetSavings) : actualSavings;

  const projectedOverflow = projectedIncome - projectedFixed - projectedDisc - projectedSavings;

  const projectedEndOverflowBalance = useMemo(() => {
    if (!isCurrentMonth) return null;
    return (plan.overflowBalance || 0) + (projectedOverflow || 0);
  }, [isCurrentMonth, plan.overflowBalance, projectedOverflow]);

  const projectedEndHysBalance = useMemo(() => {
    if (!isCurrentMonth) return null;
    return (plan.hysBalance || 0) + (projectedSavings || 0);
  }, [isCurrentMonth, plan.hysBalance, projectedSavings]);

  const planMismatch =
    plan.planMonthDate && selectedMonth ? !isSameMonth(plan.planMonthDate, selectedMonth) : false;

  function setActiveFilter(next: string) {
    setFilter(next);
    setShowCount(20);
  }

  function canPrev() {
    return monthIndex > 0;
  }
  function canNext() {
    return monthIndex >= 0 && monthIndex < months.length - 1;
  }

  function goPrev() {
    if (!canPrev()) return;
    setActiveFilter("all");
    setSelectedFixedLine("");
    setSelectedUtilityLine("");
    setSelectedMonth(months[monthIndex - 1]);
  }

  function goNext() {
    if (!canNext()) return;
    setActiveFilter("all");
    setSelectedFixedLine("");
    setSelectedUtilityLine("");
    setSelectedMonth(months[monthIndex + 1]);
  }

  function jumpToMonth(m: Date) {
    setSelectedMonth(m);
    setSelectedFixedLine("");
    setSelectedUtilityLine("");
    setActiveFilter("all");
    setTab("budget_overview");
  }

  if (!unlocked) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--cream)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div
            style={{
              fontFamily: "DM Serif Display, serif",
              fontSize: 38,
              marginBottom: 4,
              color: "var(--ink)",
            }}
          >
            Family Budget
          </div>
          <div style={{ color: "var(--warm-gray)", marginBottom: 28, fontSize: 14 }}>
            Enter your password to continue
          </div>
          <div
            style={{
              background: "white",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: "24px 20px",
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: 11,
                color: "var(--warm-gray)",
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") tryUnlock();
              }}
              style={{
                width: "100%",
                padding: "13px 14px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                outline: "none",
                fontSize: 15,
                background: "var(--cream)",
                boxSizing: "border-box",
              }}
            />
            {pwError ? (
              <div style={{ marginTop: 10, color: "#991B1B", fontSize: 13, fontWeight: 600 }}>
                {pwError}
              </div>
            ) : null}
            <button
              onClick={tryUnlock}
              style={{
                marginTop: 16,
                width: "100%",
                padding: "14px",
                borderRadius: 12,
                border: "none",
                background: "var(--ink)",
                color: "var(--cream)",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                letterSpacing: 0.5,
              }}
            >
              Unlock Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const projectionRows = [
    {
      label: "Income",
      icon: "💵",
      budget: budgetIncome,
      actual: actualIncome,
      projected: projectedIncome,
      delta: projectedIncome - budgetIncome,
      deltaGoodIfPos: true,
    },
    {
      label: "Fixed",
      icon: "🏠",
      budget: budgetFixed,
      actual: actualFixedTotal,
      projected: projectedFixed,
      delta: budgetFixed - projectedFixed,
      deltaGoodIfPos: true,
    },
    {
      label: "Discretionary",
      icon: "🛒",
      budget: budgetDisc,
      actual: actualDiscTotal,
      projected: projectedDisc,
      delta: budgetDisc - projectedDisc,
      deltaGoodIfPos: true,
    },
    {
      label: "Savings transfer",
      icon: "🏦",
      budget: budgetSavings,
      actual: actualSavings,
      projected: projectedSavings,
      delta: budgetSavings - projectedSavings,
      deltaGoodIfPos: false,
    },
    {
      label: "Overflow",
      icon: "✨",
      budget: 0,
      actual: actualIncome - actualFixedTotal - actualDiscTotal - actualSavings,
      projected: projectedOverflow,
      delta: 0,
      deltaGoodIfPos: true,
      isOverflow: true,
    },
  ] as const;

  return (
    <div style={{ paddingBottom: 72 }}>
      <header>
        <div className="header-top">
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="header-title">Family Budget</div>

              {plan.loaded ? (
                <div
                  title={
                    plan.error
                      ? plan.error
                      : planMismatch
                      ? `Plan is for ${plan.planMonthRaw}, not selected month`
                      : `Plan: ${plan.planMonthRaw}`
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "3px 8px",
                    borderRadius: 99,
                    background: plan.error ? "#FEE2E2" : planMismatch ? "#FEF3C7" : "#DCFCE7",
                    border: `1px solid ${
                      plan.error ? "#FCA5A5" : planMismatch ? "#FCD34D" : "#86EFAC"
                    }`,
                    fontSize: 10,
                    fontWeight: 700,
                    color: plan.error ? "#991B1B" : planMismatch ? "#92400E" : "#166534",
                    cursor: "default",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 99,
                      background: plan.error ? "#EF4444" : planMismatch ? "#F59E0B" : "#22C55E",
                      display: "inline-block",
                    }}
                  />
                  {plan.error ? "Plan error" : `Plan: ${plan.planMonthRaw || "…"}`}
                  {planMismatch ? " ⚠" : ""}
                </div>
              ) : null}
            </div>

            <div
              style={{
                fontSize: 11,
                opacity: 0.4,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              {tab === "budget_overview"
                ? "Budget Overview"
                : tab === "history"
                ? "History"
                : tab === "budget"
                ? "Discretionary"
                : tab === "fixed"
                ? "Fixed Spending"
                : "Forecast"}
            </div>
          </div>

          <div>
            <div className="month-nav">
              <button className="month-arrow" onClick={goPrev} disabled={!canPrev()}>
                ←
              </button>
              <div className="month-badge">{selectedMonth ? monthLabel(selectedMonth) : "Loading…"}</div>
              <button
                className="month-arrow"
                onClick={goNext}
                disabled={!canNext()}
                style={{ opacity: canNext() ? 1 : 0.25 }}
              >
                →
              </button>
              <button className="month-arrow" onClick={lock} title="Lock" style={{ fontSize: 12 }}>
                🔒
              </button>
            </div>

            <div style={{ textAlign: "right", fontSize: 10, opacity: 0.35, marginTop: 4 }}>
              {loading
                ? ""
                : "Updated " +
                  new Date().toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
            </div>
          </div>
        </div>
      </header>

      {plan.error ? (
        <div className="error-banner">
          Plan warning
          <br />
          <small style={{ opacity: 0.75, display: "block", marginTop: 6 }}>{plan.error}</small>
        </div>
      ) : null}

      {err ? (
        <div className="error-banner">
          Could not load transactions
          <br />
          <small style={{ opacity: 0.75, display: "block", marginTop: 6 }}>{err}</small>
        </div>
      ) : null}

      {tab === "forecast" ? (
        <ForecastTab
          selectedMonth={selectedMonth}
          baseFixed={budgetFixed}
          baseDiscControlled={controlledBudget}
          austinWeekly={plan.austinWeekly || 0}
          jennaWeekly={plan.jennaWeekly || 0}
        />
      ) : null}

      {tab === "budget_overview" ? (
        <main>
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner" />
              <div>Loading…</div>
            </div>
          ) : (
            <>
              <div style={{ padding: "20px 20px 0" }}>
                <HeroBreakdownBar
                  income={isCurrentMonth ? projectedIncome : actualIncome}
                  fixedSpend={isCurrentMonth ? projectedFixed : actualFixedTotal}
                  discSpend={isCurrentMonth ? projectedDisc : actualDiscTotal}
                  savingsTransfer={isCurrentMonth ? projectedSavings : actualSavings}
                  overflowHistory={overflowHistory}
                />
              </div>

              <div className="section-title">Budgets, actuals & projections</div>

              <div className="transactions-wrap" style={{ marginBottom: 20 }}>
                <div className="transactions-header">
                  <div className="transactions-title">
                    {isCurrentMonth ? "Current month uses projection rules" : "Past month shows actuals vs plan budgets"}
                  </div>
                </div>

                <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
                  {projectionRows.map((r) => {
                    const isOverflow = (r as any).isOverflow;
                    const deltaGoodIfPos = (r as any).deltaGoodIfPos as boolean;

                    const deltaColor = deltaGoodIfPos
                      ? r.delta >= 0
                        ? "#166534"
                        : "#991B1B"
                      : r.delta >= 0
                      ? "#991B1B"
                      : "#166534";

                    const deltaBg = deltaGoodIfPos
                      ? r.delta >= 0
                        ? "#DCFCE7"
                        : "#FEE2E2"
                      : r.delta >= 0
                      ? "#FEE2E2"
                      : "#DCFCE7";

                    const projColor = isOverflow
                      ? r.projected >= 0
                        ? "#166534"
                        : "#991B1B"
                      : "var(--ink)";

                    if (isOverflow) {
                      return (
                        <div
                          key={r.label}
                          style={{
                            marginTop: 8,
                            background:
                              r.projected >= 0
                                ? "linear-gradient(135deg, #DCFCE7, #F0FDF4)"
                                : "linear-gradient(135deg, #FEE2E2, #FFF5F5)",
                            border: `1px solid ${r.projected >= 0 ? "#86EFAC" : "#FCA5A5"}`,
                            borderRadius: 14,
                            padding: "16px 18px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: 12,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ fontSize: 22 }}>{r.icon}</span>
                            <div>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  letterSpacing: 0.8,
                                  color: "var(--warm-gray)",
                                }}
                              >
                                Overflow
                              </div>
                              <div
                                style={{
                                  fontFamily: "DM Serif Display, serif",
                                  fontSize: 32,
                                  lineHeight: 1,
                                  color: projColor,
                                  marginTop: 2,
                                }}
                              >
                                {fmtMoney0(r.projected)}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                            <div style={{ textAlign: "right" }}>
                              <div
                                style={{
                                  fontSize: 10,
                                  color: "var(--warm-gray)",
                                  fontWeight: 600,
                                  textTransform: "uppercase",
                                  letterSpacing: 0.6,
                                }}
                              >
                                Actual
                              </div>
                              <div
                                style={{
                                  fontSize: 16,
                                  fontWeight: 700,
                                  color: r.actual >= 0 ? "#166534" : "#991B1B",
                                  marginTop: 2,
                                }}
                              >
                                {fmtMoney0(r.actual)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={r.label}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "2fr 1fr 1fr 1fr",
                          alignItems: "center",
                          gap: 8,
                          padding: "12px 14px",
                          borderRadius: 12,
                          background: "white",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 16 }}>{r.icon}</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>{r.label}</div>

                            {r.budget > 0 ? (
                              <div
                                style={{
                                  marginTop: 4,
                                  height: 4,
                                  borderRadius: 99,
                                  background: "var(--border)",
                                  overflow: "hidden",
                                  width: 80,
                                }}
                              >
                                <div
                                  style={{
                                    height: "100%",
                                    borderRadius: 99,
                                    width: `${r.budget > 0 ? Math.min((r.actual / r.budget) * 100, 100) : 0}%`,
                                    background:
                                      r.actual > r.budget
                                        ? "#F87171"
                                        : r.actual > r.budget * 0.83
                                        ? "#F59E0B"
                                        : "#4ADE80",
                                    transition: "width 0.4s",
                                  }}
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div
                            style={{
                              fontSize: 9,
                              color: "var(--warm-gray)",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: 0.7,
                            }}
                          >
                            Budget
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: "var(--warm-gray)",
                              marginTop: 2,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {r.budget ? fmtMoney0(r.budget) : "—"}
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div
                            style={{
                              fontSize: 9,
                              color: "var(--warm-gray)",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: 0.7,
                            }}
                          >
                            Actual
                          </div>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: "var(--ink)",
                              marginTop: 2,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {fmtMoney0(r.actual)}
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div
                            style={{
                              fontSize: 9,
                              color: "var(--warm-gray)",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: 0.7,
                            }}
                          >
                            Projected
                          </div>
                          <div
                            style={{
                              fontSize: 16,
                              fontWeight: 900,
                              color: projColor,
                              marginTop: 2,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {fmtMoney0(r.projected)}
                          </div>

                          {r.budget > 0 ? (
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                marginTop: 4,
                                padding: "2px 7px",
                                borderRadius: 99,
                                background: deltaBg,
                                fontSize: 10,
                                fontWeight: 800,
                                color: deltaColor,
                              }}
                            >
                              {r.delta >= 0 ? "+" : ""}
                              {fmtMoney0(r.delta)}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ padding: "10px 14px", fontSize: 11, color: "var(--warm-gray)", borderTop: "1px solid var(--border)" }}>
                  Current month uses projection rules. Savings transfer uses plan HYS value if no actual transfer found.
                </div>
              </div>
            </>
          )}
        </main>
      ) : null}

      {tab === "history" ? (
        <main>
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner" />
              <div>Loading…</div>
            </div>
          ) : (
            <>
              <div className="section-title">History</div>

              {savingsChartData.length > 1 ? (
                <SavingsBarChart data={savingsChartData} onSelect={jumpToMonth} />
              ) : null}

              {historyChartData.length > 1 ? (
                <OverflowBarChart data={historyChartData} onSelect={jumpToMonth} />
              ) : null}

              <div className="transactions-wrap">
                <div className="transactions-header">
                  <div className="transactions-title">Prior months click a row to open Budget Overview</div>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left", opacity: 0.65 }}>
                        {["Period", "Income", "Fixed", "Discretionary", "Savings", "Overflow"].map((h) => (
                          <th key={h} style={{ padding: "10px 14px", fontWeight: 800, fontSize: 12 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {historyRows.map((r) => {
                        if (r.kind === "spacer") {
                          return (
                            <tr key={r.id}>
                              <td colSpan={6} style={{ padding: 10 }} />
                            </tr>
                          );
                        }

                        if (r.kind === "year") {
                          return (
                            <tr
                              key={`yr-${r.year}`}
                              style={{
                                borderTop: "2px solid var(--border)",
                                ...SUM_ROW,
                              }}
                            >
                              <td style={SUM_CELL}>{r.year} total</td>
                              <td style={{ ...SUM_CELL, color: "#166534" }}>{fmtMoney0(r.income)}</td>
                              <td style={{ ...SUM_CELL, color: "#991B1B" }}>{fmtMoney0(r.fixedSpend)}</td>
                              <td style={{ ...SUM_CELL, color: "#991B1B" }}>{fmtMoney0(r.discSpend)}</td>
                              <td style={{ ...SUM_CELL, color: "#166534" }}>{fmtMoney0(r.savingsTransfer)}</td>
                              <td style={{ ...SUM_CELL, color: r.overflow >= 0 ? "#166534" : "#991B1B" }}>
                                {fmtMoney0(r.overflow)}
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr
                            key={r.month.getTime()}
                            style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }}
                            onClick={() => jumpToMonth(r.month)}
                            title="Open Budget Overview"
                          >
                            <td style={{ ...TD, fontWeight: 800 }}>{monthLabel(r.month)}</td>
                            <td style={{ ...TD, color: "#166534", fontVariantNumeric: "tabular-nums" }}>
                              {fmtMoney0(r.income)}
                            </td>
                            <td style={{ ...TD, color: "#991B1B", fontVariantNumeric: "tabular-nums" }}>
                              {fmtMoney0(r.fixedSpend)}
                            </td>
                            <td style={{ ...TD, color: "#991B1B", fontVariantNumeric: "tabular-nums" }}>
                              {fmtMoney0(r.discSpend)}
                            </td>
                            <td style={{ ...TD, color: "#166534", fontVariantNumeric: "tabular-nums" }}>
                              {fmtMoney0(r.savingsTransfer)}
                            </td>
                            <td
                              style={{
                                ...TD,
                                fontWeight: 900,
                                fontVariantNumeric: "tabular-nums",
                                color: r.overflow >= 0 ? "#166534" : "#991B1B",
                              }}
                            >
                              {fmtMoney0(r.overflow)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>
      ) : null}

      {tab === "budget" ? (
        <>
          <div className="big-bar">
            <div className="big-stat" style={{ flex: "2 1 200px" }}>
              <div className="big-stat-label">Remaining This Month</div>
              <div className={"big-stat-value " + statClassForRemaining(remaining)} style={{ fontSize: "clamp(32px,6vw,52px)" }}>
                {loading ? "—" : fmtMoney0(remaining)}
              </div>
              <div className="big-stat-sub">
                {loading ? "" : `${fmtMoney0(controlledSpent)} of ${fmtMoney0(controlledBudget)}`}
              </div>
            </div>

            {(["Food", "General Merchandise", "Gas"] as Bucket[]).map((b) => {
              const label = b === "General Merchandise" ? "General Merch" : b;
              const spent = spentByBucket[b] || 0;
              const budget = (effectiveDiscBudgets as any)[b] || 0;
              const cls = statClassForBudget(spent, budget);
              const isOver = cls === "bad";
              const isWarn = cls === "warn";

              return (
                <div
                  key={b}
                  className="big-stat"
                  style={{
                    background: isOver ? "rgba(239,68,68,0.08)" : isWarn ? "rgba(245,158,11,0.07)" : undefined,
                    borderRadius: 10,
                    position: "relative",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 99,
                        flexShrink: 0,
                        background: isOver ? "#EF4444" : isWarn ? "#F59E0B" : "#22C55E",
                        boxShadow: isOver
                          ? "0 0 0 2px rgba(239,68,68,0.25)"
                          : isWarn
                          ? "0 0 0 2px rgba(245,158,11,0.25)"
                          : "none",
                      }}
                    />
                    <div className="big-stat-label">{label}</div>
                  </div>
                  <div className={"big-stat-value " + cls}>{loading ? "—" : fmtMoney0(spent)}</div>
                  <div className="big-stat-sub">of {fmtMoney0(budget)}</div>
                </div>
              );
            })}
          </div>

          <main>
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner" />
                <div>Loading transactions…</div>
              </div>
            ) : (
              <>
                <div className="section-title">This Month</div>

                <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap" }}>
                  <div
                    style={{
                      background: "white",
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      padding: "20px 22px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 16,
                      minWidth: 190,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 1.2,
                        textTransform: "uppercase",
                        color: "var(--warm-gray)",
                      }}
                    >
                      Breakdown
                    </div>

                    <DonutRing
                      segments={BUCKET_LIST.map((b) => ({
                        label: b,
                        value: spentByBucket[b] || 0,
                        color: (BUCKET_UI as any)[b]?.color || "#999",
                      }))}
                      total={totalSpent}
                      budget={totalDiscBudget}
                      activeSegment={filter !== "all" ? filter : undefined}
                    />

                    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                      {BUCKET_LIST.map((b) => {
                        const cfg = (BUCKET_UI as any)[b];
                        const v = spentByBucket[b] || 0;
                        const bgt = (effectiveDiscBudgets as any)[b] || 0;
                        const pct = totalSpent > 0 ? Math.round((v / totalSpent) * 100) : 0;
                        const barPct = bgt > 0 ? Math.min((v / bgt) * 100, 100) : 0;
                        const barColor =
                          v > bgt && bgt > 0 ? "#F87171" : barPct > 80 && bgt > 0 ? "#F59E0B" : cfg.color;
                        const isActive = filter === b;

                        return (
                          <div
                            key={b}
                            onClick={() => setActiveFilter(isActive ? "all" : b)}
                            style={{
                              cursor: "pointer",
                              borderRadius: 8,
                              padding: "4px 6px",
                              background: isActive ? "rgba(0,0,0,0.04)" : undefined,
                              transition: "background 0.15s",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: 3,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ width: 7, height: 7, borderRadius: 99, background: cfg.color, flexShrink: 0 }} />
                                <span style={{ fontSize: 11, color: "var(--warm-gray)", fontWeight: isActive ? 700 : 400 }}>
                                  {cfg.label}
                                </span>
                              </div>
                              <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                                <span style={{ fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                                  {fmtMoney0(v)}
                                </span>
                                <span style={{ fontSize: 9, color: "var(--warm-gray)" }}>{pct}%</span>
                              </div>
                            </div>

                            {bgt > 0 ? (
                              <div style={{ height: 3, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                                <div
                                  style={{
                                    height: "100%",
                                    width: `${barPct}%`,
                                    background: barColor,
                                    borderRadius: 99,
                                    transition: "width 0.4s",
                                  }}
                                />
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="budget-grid" style={{ flex: 1, margin: 0 }}>
                    {BUCKET_LIST.map((bucket) => {
                      const cfg = (BUCKET_UI as any)[bucket];
                      const budget = ((effectiveDiscBudgets as any)[bucket] ?? 0) as number;
                      const spent = (spentByBucket[bucket] ?? 0) as number;
                      const avg3 = threeMonthAvg[bucket] ?? 0;
                      const spark = sparklineData[bucket] ?? [];

                      const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
                      const rem = budget - spent;
                      const over = budget > 0 && spent > budget;
                      const warn = budget > 0 && !over && pct > 75;

                      const pillClass = over ? "bad-pill" : warn ? "warn-pill" : "good-pill";
                      const barColor = over ? "#F87171" : warn ? "#F59E0B" : cfg.color;
                      const isActive = filter === bucket;

                      return (
                        <div
                          className="budget-card"
                          key={bucket}
                          onClick={() => setActiveFilter(isActive ? "all" : bucket)}
                          style={{
                            cursor: "pointer",
                            outline: isActive ? `2px solid ${cfg.color}` : "none",
                            outlineOffset: -1,
                          }}
                        >
                          <div className="budget-card-header">
                            <div>
                              <div className="budget-card-name">{cfg.label}</div>
                              {avg3 > 0 ? (
                                <div style={{ fontSize: 10, color: "var(--warm-gray)", marginTop: 2 }}>
                                  3 mo avg: {fmtMoney0(avg3)}
                                </div>
                              ) : null}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                              <div className="budget-card-icon">{cfg.icon}</div>
                              {spark.length > 1 ? <Sparkline values={spark} color={barColor} /> : null}
                            </div>
                          </div>

                          <div className="budget-amounts">
                            <div className="spent-amount" style={{ color: barColor }}>
                              {fmtMoney0(spent)}
                            </div>
                            <div className="budget-of">{budget > 0 ? "of " + fmtMoney0(budget) : "no limit"}</div>
                          </div>

                          {budget > 0 ? (
                            <>
                              <div className="progress-track">
                                <div className="progress-fill" style={{ width: `${pct}%`, background: barColor }} />
                              </div>
                              <div className="budget-footer">
                                <span className={"remaining-pill " + pillClass}>
                                  {over ? `${fmtMoney0(Math.abs(rem))} over` : `${fmtMoney0(rem)} left`}
                                </span>
                                <span>{Math.round(pct)}%</span>
                              </div>
                            </>
                          ) : (
                            <div style={{ fontSize: 12, color: "var(--warm-gray)", marginTop: 8 }}>Tracked but unbudgeted</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="section-title">Transactions</div>
                <div className="transactions-wrap">
                  <div className="transactions-header">
                    <div className="transactions-title">
                      <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                        {fmtMoney0(filterRunningTotal)}
                      </span>
                      <span style={{ fontWeight: 400, fontSize: 11, color: "var(--warm-gray)", marginLeft: 6 }}>
                        · {filteredAllTx.length} tx{filter !== "all" ? ` in ${filter}` : ""}
                      </span>
                    </div>
                    <div className="filter-row">
                      {["all", "Food", "Gas", "General Merchandise", "Other"].map((f) => (
                        <button
                          key={f}
                          className={"filter-btn " + (filter === f ? "active" : "")}
                          onClick={() => setActiveFilter(f)}
                        >
                          {f === "all" ? "All" : f === "General Merchandise" ? "General" : f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    {filteredTx.length === 0 ? (
                      <div style={{ padding: 28, textAlign: "center", color: "var(--warm-gray)", fontSize: 13 }}>
                        No transactions found
                      </div>
                    ) : (
                      filteredTx.map((t, idx) => {
                        const dot = (DOT_COLORS as any)[t.bucket] || "#999";
                        const isPos = t.amt > 0;
                        const pill = BUCKET_PILL[t.bucket] || BUCKET_PILL.Other;

                        return (
                          <div className="transaction-row" key={idx} style={{ alignItems: "center" }}>
                            <div className="tx-dot" style={{ background: dot }} />
                            <div className="tx-desc" style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {t.desc}
                                </span>
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "1px 7px",
                                    borderRadius: 99,
                                    fontSize: 9,
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.6,
                                    background: pill.bg,
                                    color: pill.color,
                                    flexShrink: 0,
                                  }}
                                >
                                  {t.bucket === "General Merchandise" ? "General" : t.bucket}
                                </span>
                              </div>
                              <div className="tx-cat">{t.category}</div>
                            </div>
                            <div className="tx-date" style={{ flexShrink: 0 }}>
                              {t.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </div>
                            <div
                              style={{
                                flexShrink: 0,
                                minWidth: 80,
                                textAlign: "right",
                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                fontSize: 13,
                                fontWeight: 800,
                                color: isPos ? "#166534" : "#991B1B",
                              }}
                            >
                              {isPos ? "+" : "-"}
                              {fmtMoney0(Math.abs(t.amt))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {filteredAllTx.length > showCount ? (
                    <button
                      onClick={() => setShowCount((c) => c + 20)}
                      style={{
                        width: "100%",
                        background: "none",
                        border: "none",
                        borderTop: "1px solid var(--border)",
                        padding: 14,
                        fontFamily: "inherit",
                        fontSize: 12,
                        color: "var(--warm-gray)",
                        cursor: "pointer",
                      }}
                    >
                      Show more ({filteredAllTx.length - showCount} remaining)
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </main>
        </>
      ) : null}

      {tab === "fixed" ? (
        <main>
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner" />
              <div>Loading transactions…</div>
            </div>
          ) : (
            <>
              <FixedHealthBanner linesOnTrack={fixedHealthScore.linesOnTrack} total={fixedHealthScore.total} />

              <div
                style={{
                  background: "white",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: "14px 16px",
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--warm-gray)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>
                      Total budget
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900 }}>{fmtMoney0(fixedTotals.totalBudget)}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: "var(--warm-gray)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>
                      Total actual
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: "#991B1B" }}>{fmtMoney0(fixedTotals.totalActual)}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: "var(--warm-gray)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>
                      Total variance
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: fixedTotals.totalVariance >= 0 ? "#166534" : "#991B1B" }}>
                      {fixedTotals.totalVariance >= 0 ? "+" : ""}
                      {fmtMoney0(fixedTotals.totalVariance)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="transactions-wrap">
                <div className="transactions-header">
                  <div className="transactions-title">
                    Budget vs actual · {selectedMonth ? monthLabel(selectedMonth) : ""}
                  </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left", opacity: 0.65 }}>
                        {["Line", "Budget", "Actual", "3 mo avg", "Variance"].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "10px 14px",
                              fontWeight: 800,
                              fontSize: 12,
                              ...(h === "Variance" ? { minWidth: 160 } : {}),
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {FIXED_ORDER.map((line) => {
                        const budget = (effectiveFixedBudgets as any)[line] || 0;
                        const actual = fixedSpendByLine[line] || 0;
                        const avg3 = fixedThreeMonthAvg[line] || 0;
                        const variance = budget - actual;

                        const isSelected = selectedFixedLine === line;
                        const isUtils = line === "Utiities";

                        const setLine = () => {
                          const next = isSelected ? "" : line;
                          setSelectedFixedLine(next);
                          if (next !== "Utiities") setSelectedUtilityLine("");
                        };

                        const lineTx = (() => {
                          if (!isSelected) return [];
                          const list: Array<{
                            date: Date;
                            desc: string;
                            category: string;
                            amt: number;
                            utilLine?: string;
                          }> = [];

                          for (const t of monthTx) {
                            if (!isFixedType(t.type) || shouldForceToDiscretionary(t.category)) continue;
                            const b = normalizeFixedBucket(t.category);
                            if (b !== line) continue;

                            if (b === "Utiities") {
                              const ul = utilityLine(t.desc);
                              if (selectedUtilityLine && selectedUtilityLine !== ul) continue;
                              list.push({ date: t.date, desc: t.desc, category: t.category, amt: t.amt, utilLine: ul });
                            } else {
                              list.push({ date: t.date, desc: t.desc, category: t.category, amt: t.amt });
                            }
                          }

                          list.sort((a, b) => b.date.getTime() - a.date.getTime());
                          return list;
                        })();

                        return (
                          <React.Fragment key={line}>
                            <tr
                              style={{
                                borderTop: "1px solid var(--border)",
                                background: isSelected ? "rgba(0,0,0,0.025)" : undefined,
                                cursor: "pointer",
                              }}
                              onClick={setLine}
                              title={isUtils ? "Click to expand utilities" : "Click to view transactions"}
                            >
                              <td style={{ ...TD, fontWeight: 900 }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                                  {isUtils ? (
                                    <span
                                      style={{
                                        fontSize: 10,
                                        color: "var(--warm-gray)",
                                        display: "inline-block",
                                        transition: "transform 0.2s",
                                        transform: isSelected ? "rotate(90deg)" : "rotate(0deg)",
                                      }}
                                    >
                                      ▶
                                    </span>
                                  ) : null}
                                  {line}
                                </span>
                              </td>
                              <td style={{ ...TD, fontVariantNumeric: "tabular-nums" }}>{fmtMoney0(budget)}</td>
                              <td style={{ ...TD, color: "#991B1B", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                                {fmtMoney0(actual)}
                              </td>
                              <td style={{ ...TD, color: "var(--warm-gray)", fontVariantNumeric: "tabular-nums" }}>
                                {fmtMoney0(avg3)}
                              </td>
                              <td style={{ ...TD }}>
                                <VarianceBarLive budget={budget} variance={variance} />
                              </td>
                            </tr>

                            {isUtils && isSelected ? (
                              <>
                                {utilitiesLines.map((u) => {
                                  const uBudget = (effectiveUtilsBudgets as any)[u] || 0;
                                  const uActual = utilitiesActualByLine[u] || 0;
                                  const uAvg3 = utilitiesThreeMonthAvg[u] || 0;
                                  const uSelected = selectedUtilityLine === u;

                                  return (
                                    <tr
                                      key={`util-${u}`}
                                      style={{
                                        borderTop: "1px solid var(--border)",
                                        background: uSelected ? "rgba(99,102,241,0.10)" : "rgba(99,102,241,0.035)",
                                        cursor: "pointer",
                                      }}
                                      onClick={() => setSelectedUtilityLine(uSelected ? "" : u)}
                                      title="Click to filter transactions"
                                    >
                                      <td style={{ ...TD, paddingLeft: 30, fontSize: 12, color: "var(--warm-gray)", fontWeight: 700 }}>
                                        ↳ {u}
                                      </td>
                                      <td style={{ ...TD, fontSize: 12, color: "var(--warm-gray)", fontVariantNumeric: "tabular-nums" }}>
                                        {uBudget > 0 ? fmtMoney0(uBudget) : "—"}
                                      </td>
                                      <td style={{ ...TD, fontSize: 12, color: "#991B1B", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                                        {fmtMoney0(uActual)}
                                      </td>
                                      <td style={{ ...TD, fontSize: 12, color: "var(--warm-gray)", fontVariantNumeric: "tabular-nums" }}>
                                        {fmtMoney0(uAvg3)}
                                      </td>
                                      <td style={{ ...TD, fontSize: 12 }}>
                                        {uBudget > 0 ? (
                                          <VarianceBarLive budget={uBudget} variance={uBudget - uActual} />
                                        ) : (
                                          <span style={{ color: "var(--warm-gray)" }}>—</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}

                                <tr style={{ borderTop: "2px solid var(--border)", ...SUM_ROW }}>
                                  <td style={{ ...SUM_CELL, paddingLeft: 30, fontSize: 12 }}>Utilities Total</td>
                                  <td style={{ ...SUM_CELL, fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                                    {fmtMoney0(utilitiesTotals.totalBudget)}
                                  </td>
                                  <td style={{ ...SUM_CELL, fontSize: 12, color: "#991B1B", fontVariantNumeric: "tabular-nums" }}>
                                    {fmtMoney0(utilitiesTotals.totalActual)}
                                  </td>
                                  <td style={{ ...SUM_CELL, fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                                    {fmtMoney0(utilitiesTotals.totalAvg3)}
                                  </td>
                                  <td style={{ ...SUM_CELL, fontSize: 12 }}>
                                    <VarianceBarLive budget={utilitiesTotals.totalBudget} variance={utilitiesTotals.totalVariance} />
                                  </td>
                                </tr>
                              </>
                            ) : null}

                            {isSelected ? (
                              <tr>
                                <td colSpan={5} style={{ padding: 0 }}>
                                  <div
                                    style={{
                                      background: isUtils ? "rgba(99,102,241,0.025)" : "rgba(0,0,0,0.018)",
                                      borderTop: "1px solid var(--border)",
                                    }}
                                  >
                                    {lineTx.length === 0 ? (
                                      <div style={{ padding: "14px 30px", fontSize: 12, color: "var(--warm-gray)" }}>
                                        No transactions found{selectedUtilityLine ? ` for ${selectedUtilityLine}` : ""}
                                      </div>
                                    ) : (
                                      lineTx.map((t, idx) => {
                                        const isPos = t.amt > 0;
                                        return (
                                          <div className="transaction-row" key={idx} style={{ paddingLeft: 30, alignItems: "center" }}>
                                            <div
                                              className="tx-dot"
                                              style={{
                                                background: isUtils ? "rgba(99,102,241,0.5)" : "rgba(0,0,0,0.2)",
                                              }}
                                            />
                                            <div className="tx-desc" style={{ flex: 1, minWidth: 0 }}>
                                              <div className="tx-name">
                                                {t.desc}
                                                {isUtils && t.utilLine ? (
                                                  <span
                                                    style={{
                                                      marginLeft: 6,
                                                      padding: "1px 6px",
                                                      borderRadius: 99,
                                                      fontSize: 9,
                                                      fontWeight: 700,
                                                      textTransform: "uppercase",
                                                      letterSpacing: 0.5,
                                                      background: "rgba(99,102,241,0.12)",
                                                      color: "#4338CA",
                                                    }}
                                                  >
                                                    {t.utilLine}
                                                  </span>
                                                ) : null}
                                              </div>
                                              <div className="tx-cat">{t.category}</div>
                                            </div>
                                            <div className="tx-date">
                                              {t.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                            </div>
                                            <div
                                              style={{
                                                flexShrink: 0,
                                                minWidth: 80,
                                                textAlign: "right",
                                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                                fontSize: 13,
                                                fontWeight: 800,
                                                color: isPos ? "#166534" : "#991B1B",
                                              }}
                                            >
                                              {isPos ? "+" : "-"}
                                              {fmtMoney0(Math.abs(t.amt))}
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </React.Fragment>
                        );
                      })}
                    </tbody>

                    <tfoot>
                      <tr style={{ borderTop: "2px solid var(--ink)", ...SUM_ROW }}>
                        <td style={SUM_CELL}>Total Fixed</td>
                        <td style={{ ...SUM_CELL, fontVariantNumeric: "tabular-nums" }}>{fmtMoney0(fixedTotals.totalBudget)}</td>
                        <td style={{ ...SUM_CELL, color: "#991B1B", fontVariantNumeric: "tabular-nums" }}>{fmtMoney0(fixedTotals.totalActual)}</td>
                        <td style={{ ...SUM_CELL, fontVariantNumeric: "tabular-nums" }}>{fmtMoney0(fixedTotals.totalAvg3)}</td>
                        <td style={SUM_CELL}>
                          <VarianceBarLive budget={fixedTotals.totalBudget} variance={fixedTotals.totalVariance} />
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div style={{ padding: "10px 14px", fontSize: 11, color: "var(--warm-gray)" }}>
                  Click a row to view transactions. Click Utilities to expand. Click a utility line to filter. 3 mo avg uses selected month + 2 prior.
                </div>
              </div>
            </>
          )}
        </main>
      ) : null}

      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "var(--ink)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          zIndex: 100,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {(
          [
            { id: "forecast" as Tab, label: "Forecast", icon: "🔮" },
            { id: "budget_overview" as Tab, label: "Overview", icon: "💰" },
            { id: "history" as Tab, label: "History", icon: "🗓️" },
            { id: "budget" as Tab, label: "Budget", icon: "📊" },
            { id: "fixed" as Tab, label: "Fixed", icon: "🏠" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              padding: "12px 8px 10px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              color: tab === t.id ? "var(--cream)" : "rgba(250,247,242,0.32)",
              transition: "color 0.15s",
              fontFamily: "inherit",
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{t.icon}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: tab === t.id ? 700 : 400,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                borderBottom: tab === t.id ? "2px solid var(--cream)" : "2px solid transparent",
                paddingBottom: 1,
              }}
            >
              {t.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}