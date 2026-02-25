// src/lib/plan.ts
import { parseAmount, parseDate } from "../csv";
import { safeLower, safeTrim } from "./text";

export type Bucket = "Food" | "Gas" | "General Merchandise" | "Other";

export type PlanData = {
  loaded: boolean;
  error: string;

  planMonthRaw: string;
  planMonthDate: Date | null;

  overflowBalance: number;
  hysBalance: number;

  addFix: number;
  addDesc: number;

  incomeProjection: number;
  incomeBudgetBase: number;

  plannedHysTransfer: number;

  fixedBudgets: Record<string, number>;
  discretionaryBudgets: Record<Bucket, number>;

  utilitiesBudgets: Record<string, number>;
  utilitiesOrderFromPlan: string[];

  // Weekly net income values derived from the Income section in the Plan CSV
  austinWeekly: number;
  jennaWeekly: number;
};

function asNum(v: any) {
  return parseAmount(String(v ?? ""));
}

function parsePlanMonthValue(v: any): Date | null {
  const s = safeTrim(v);
  if (!s) return null;

  const d = parseDate(s);
  if (d) return new Date(d.getFullYear(), d.getMonth(), 1);

  const g = new Date(s);
  if (!Number.isNaN(g.getTime()))
    return new Date(g.getFullYear(), g.getMonth(), 1);

  return null;
}

function parseCsvToGrid(csvText: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];

    if (inQ) {
      if (ch === '"') {
        if (csvText[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQ = true;
      continue;
    }

    if (ch === ",") {
      row.push(cur);
      cur = "";
      continue;
    }

    if (ch === "\n") {
      row.push(cur);
      cur = "";
      out.push(row);
      row = [];
      continue;
    }

    if (ch === "\r") continue;
    cur += ch;
  }

  row.push(cur);
  out.push(row);

  const maxCols = out.reduce((m, r) => Math.max(m, r.length), 0);
  for (const r of out) while (r.length < maxCols) r.push("");

  return out;
}

function findLabelNext(grid: string[][], label: string) {
  const target = safeLower(label);
  let found = "";
  for (const row of grid) {
    for (let c = 0; c < row.length - 1; c++) {
      if (safeLower(row[c]) === target) {
        const next = safeTrim(row[c + 1]);
        if (next !== "") found = next;
      }
    }
  }
  return found;
}

/*
  Your Income section now uses labels:
  "Austin Income" and "Jenna Income"

  The cell to the right of the label is the monthly average:
  monthly = weekly * 52 / 12
  weekly = monthly * 12 / 52

  We read that monthly cell and convert back to weekly.
*/
function findWeeklyFromMonthlyLabel(grid: string[][], label: string): number {
  const target = safeLower(label);

  for (const row of grid) {
    for (let c = 0; c < row.length - 1; c++) {
      if (safeLower(row[c]) === target) {
        const monthly = asNum(row[c + 1]);
        if (!Number.isFinite(monthly) || monthly <= 0) return 0;
        return (monthly * 12) / 52;
      }
    }
  }

  return 0;
}

export function emptyPlan(): PlanData {
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
    austinWeekly: 0,
    jennaWeekly: 0,
  };
}

export function parsePlanFromCsvText(csvText: string): PlanData {
  const grid = parseCsvToGrid(csvText);
  const out = emptyPlan();
  out.loaded = true;

  out.planMonthRaw = safeTrim(findLabelNext(grid, "MONTH"));
  out.planMonthDate = parsePlanMonthValue(out.planMonthRaw);

  out.overflowBalance = asNum(findLabelNext(grid, "Overflow Amount"));
  out.hysBalance = asNum(findLabelNext(grid, "HYS Amount"));

  out.addFix = asNum(findLabelNext(grid, "Add. Fix"));
  out.addDesc = asNum(findLabelNext(grid, "Descr Add"));

  out.incomeProjection = asNum(findLabelNext(grid, "Income"));

  // Column C row 6 for past months baseline income budget
  out.incomeBudgetBase = asNum(grid[5]?.[2] ?? "");

  out.plannedHysTransfer = asNum(findLabelNext(grid, "HYS"));

  // Weekly net incomes derived from your monthly average cells
  out.austinWeekly = findWeeklyFromMonthlyLabel(grid, "Austin Income");
  out.jennaWeekly = findWeeklyFromMonthlyLabel(grid, "Jenna Income");

  // Main budget labels in column B and values in column C
  for (const row of grid) {
    const label = safeTrim(row[1]);
    const val = row[2];

    if (
      [
        "Mortage",
        "Additional Payment",
        "Auto",
        "Medical",
        "Car Insurance",
        "Utiities",
        "Student Loans",
        "NorthWest",
      ].includes(label)
    ) {
      out.fixedBudgets[label] = asNum(val);
    }

    if (label === "Food") out.discretionaryBudgets.Food = asNum(val);
    if (label === "Gas Fuel") out.discretionaryBudgets.Gas = asNum(val);
    if (label === "Shopping")
      out.discretionaryBudgets["General Merchandise"] = asNum(val);
  }

  // Full Utilities is in columns L and M (0 based 11 and 12)
  const NAME_COL = 11;
  const AMT_COL = 12;

  let utilStart = -1;
  for (let r = 0; r < grid.length; r++) {
    if (safeLower(grid[r][NAME_COL]) === "full utilities") utilStart = r + 1;
  }

  if (utilStart >= 0) {
    const seen = new Set<string>();
    for (let r = utilStart; r < grid.length; r++) {
      const name = safeTrim(grid[r][NAME_COL]);
      if (!name) break;
      const amt = asNum(grid[r][AMT_COL]);
      out.utilitiesBudgets[name] = amt;

      if (!seen.has(name)) {
        out.utilitiesOrderFromPlan.push(name);
        seen.add(name);
      }
    }
  }

  const ft = Object.values(out.fixedBudgets).reduce(
    (a, v) => a + (Number.isFinite(v) ? v : 0),
    0
  );
  const dt = Object.values(out.discretionaryBudgets).reduce(
    (a, v) => a + (Number.isFinite(v) ? v : 0),
    0
  );

  if (ft <= 0 || dt <= 0)
    out.error = "Plan parsed but budgets came out 0. Check Plan CSV layout.";
  if (ft > 20000 || dt > 20000)
    out.error = "Plan parse mismatch. Budgets look too large.";

  return out;
}
