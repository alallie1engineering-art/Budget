// src/components/ForecastTab.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { fmtMoney0 } from "../lib/format";
import { isSameMonth, monthKey, monthLabel } from "../lib/dates";

type MonthInputs = {
  incomeAdd: number;
  addFixed: number;
  addDisc: number;
  hysTransfer: number;
};

type PersistedState = {
  monthsAhead: number;
  perMonth: Record<string, MonthInputs>;
  startOverflow: number;
  startHys: number;
  startUserOverride: boolean;
  lastAutoOverflow: number;
  lastAutoHys: number;
};

type PlanGrid = {
  headers: string[];
  rows: any[][];
};

type SheetMap = {
  ready: boolean;
  monthColByKey: Record<string, number>;
  incomeRow: number | null;
  fixedRow: number | null;
  discRow: number | null;
  hysRow: number | null;
};

export type ForecastTabProps = {
  selectedMonth: Date | null;
  onSelectedMonthChange?: (m: Date) => void;

  baseFixed: number;
  baseDiscControlled: number;

  austinWeekly: number;
  jennaWeekly: number;

  autoStartOverflow?: number | null;
  autoStartHys?: number | null;
};

const STORAGE_KEY = "forecast_inputs_sheet_v1";
const DEFAULT_MONTHS_AHEAD = 12;

function clampFinite(n: number) {
  return Number.isFinite(n) ? n : 0;
}

function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, months: number) {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

function countWeekdayInMonth(m0: Date, weekday: number) {
  const y = m0.getFullYear();
  const m = m0.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  let count = 0;

  for (let d = new Date(first); d <= last; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    if (d.getDay() === weekday) count += 1;
  }

  return count;
}

function parseMonthCell(v: any): Date | null {
  if (!v) return null;

  if (v instanceof Date) {
    return new Date(v.getFullYear(), v.getMonth(), 1);
  }

  const s = String(v).trim();
  if (!s) return null;

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  return null;
}

function safeNum(v: any) {
  const n = Number(String(v ?? "").toString().replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed as PersistedState;
    }
  } catch {}

  return {
    monthsAhead: DEFAULT_MONTHS_AHEAD,
    perMonth: {},
    startOverflow: 0,
    startHys: 0,
    startUserOverride: false,
    lastAutoOverflow: 0,
    lastAutoHys: 0
  };
}

function saveState(next: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

function labelMatch(label: string, want: string) {
  return label.trim().toLowerCase() === want.trim().toLowerCase();
}

function findRowIndex(grid: PlanGrid, wantLabel: string): number | null {
  const rows = Array.isArray(grid?.rows) ? grid.rows : [];
  for (let i = 0; i < rows.length; i += 1) {
    const label = String(rows[i]?.[0] ?? "");
    if (labelMatch(label, wantLabel)) return i + 2;
  }
  return null;
}

function buildSheetMap(grid: PlanGrid): SheetMap {
  const rows = Array.isArray(grid?.rows) ? grid.rows : [];

  let monthHeaderRowIndex: number | null = null;
  let monthHeaderRow: any[] | null = null;

  for (let i = 0; i < rows.length; i += 1) {
    const label = String(rows[i]?.[0] ?? "");
    if (labelMatch(label, "Month")) {
      monthHeaderRowIndex = i + 2;
      monthHeaderRow = rows[i] ?? null;
      break;
    }
  }

  const monthColByKey: Record<string, number> = {};

  if (monthHeaderRowIndex && monthHeaderRow) {
    for (let col = 2; col <= monthHeaderRow.length; col += 1) {
      const cell = monthHeaderRow[col - 1];
      const d = parseMonthCell(cell);
      if (!d) continue;
      monthColByKey[monthKey(d)] = col;
    }
  }

  const incomeRow = findRowIndex(grid, "FORECAST INCOME");
  const fixedRow = findRowIndex(grid, "FORECAT FIXED") ?? findRowIndex(grid, "FORECAST FIXED");
  const discRow = findRowIndex(grid, "FORECAST DES");
  const hysRow = findRowIndex(grid, "FORECAST HYS");

  return {
    ready: Boolean(Object.keys(monthColByKey).length),
    monthColByKey,
    incomeRow,
    fixedRow,
    discRow,
    hysRow
  };
}

function readForecastInputsFromGrid(grid: PlanGrid, map: SheetMap): Record<string, MonthInputs> {
  const out: Record<string, MonthInputs> = {};
  const rows = Array.isArray(grid?.rows) ? grid.rows : [];

  const byRow = (sheetRow: number | null) => {
    if (!sheetRow) return null;
    const idx = sheetRow - 2;
    if (idx < 0 || idx >= rows.length) return null;
    return rows[idx] ?? null;
  };

  const rIncome = byRow(map.incomeRow);
  const rFixed = byRow(map.fixedRow);
  const rDisc = byRow(map.discRow);
  const rHys = byRow(map.hysRow);

  for (const [mk, col] of Object.entries(map.monthColByKey)) {
    const incomeAdd = safeNum(rIncome?.[col - 1]);
    const addFixed = safeNum(rFixed?.[col - 1]);
    const addDisc = safeNum(rDisc?.[col - 1]);
    const hysTransfer = safeNum(rHys?.[col - 1]);

    out[mk] = { incomeAdd, addFixed, addDisc, hysTransfer };
  }

  return out;
}

export default function ForecastTab(props: ForecastTabProps) {
  const fallbackNow = useMemo(() => new Date(), []);
  const effectiveMonth = props.selectedMonth ?? fallbackNow;
  const baseMonth = useMemo(() => monthStart(effectiveMonth), [effectiveMonth]);

  const [grid, setGrid] = useState<PlanGrid>({ headers: [], rows: [] });
  const [sheetMap, setSheetMap] = useState<SheetMap>({
    ready: false,
    monthColByKey: {},
    incomeRow: null,
    fixedRow: null,
    discRow: null,
    hysRow: null
  });

  const [loadingSheet, setLoadingSheet] = useState(false);
  const [sheetError, setSheetError] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveOkTick, setSaveOkTick] = useState(0);

  const [state, setState] = useState<PersistedState>(() => loadState());

  const lastLoadStampRef = useRef(0);

  async function loadFromSheet() {
    const stamp = Date.now();
    lastLoadStampRef.current = stamp;

    setLoadingSheet(true);
    setSheetError("");

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

      if (lastLoadStampRef.current !== stamp) return;

      const nextGrid: PlanGrid = { headers, rows };
      setGrid(nextGrid);

      const nextMap = buildSheetMap(nextGrid);
      setSheetMap(nextMap);

      const sheetInputs = nextMap.ready ? readForecastInputsFromGrid(nextGrid, nextMap) : {};

      const autoStart = {
        overflow: Math.round(clampFinite(props.autoStartOverflow ?? 0)),
        hys: Math.round(clampFinite(props.autoStartHys ?? 0))
      };

      setState((prev) => {
        const mergedPerMonth = { ...(prev?.perMonth ?? {}), ...sheetInputs };

        const next: PersistedState = {
          ...(prev ?? loadState()),
          perMonth: mergedPerMonth,
          lastAutoOverflow: autoStart.overflow,
          lastAutoHys: autoStart.hys,
          startOverflow: prev?.startUserOverride ? prev.startOverflow : autoStart.overflow,
          startHys: prev?.startUserOverride ? prev.startHys : autoStart.hys
        };

        saveState(next);
        return next;
      });
    } catch (e: any) {
      if (lastLoadStampRef.current !== stamp) return;
      setSheetError(e?.message || String(e));
    } finally {
      if (lastLoadStampRef.current === stamp) setLoadingSheet(false);
    }
  }

  useEffect(() => {
    loadFromSheet();
  }, []);

  useEffect(() => {
    const autoStart = {
      overflow: Math.round(clampFinite(props.autoStartOverflow ?? 0)),
      hys: Math.round(clampFinite(props.autoStartHys ?? 0))
    };

    if (!autoStart.overflow && !autoStart.hys) return;

    if (state.startUserOverride) return;

    const next: PersistedState = {
      ...state,
      startOverflow: autoStart.overflow,
      startHys: autoStart.hys,
      lastAutoOverflow: autoStart.overflow,
      lastAutoHys: autoStart.hys
    };

    setState(next);
    saveState(next);
  }, [props.autoStartOverflow, props.autoStartHys]);

  function setMonthsAhead(n: number) {
    const next: PersistedState = {
      ...state,
      monthsAhead: Math.max(3, Math.min(36, Math.floor(clampFinite(n) || DEFAULT_MONTHS_AHEAD)))
    };
    setState(next);
    saveState(next);
  }

  function setStartOverflow(v: number) {
    const next: PersistedState = {
      ...state,
      startOverflow: Math.round(clampFinite(v)),
      startUserOverride: true
    };
    setState(next);
    saveState(next);
  }

  function setStartHys(v: number) {
    const next: PersistedState = {
      ...state,
      startHys: Math.round(clampFinite(v)),
      startUserOverride: true
    };
    setState(next);
    saveState(next);
  }

  function setMonthField(mKey: string, field: keyof MonthInputs, value: number) {
    const cur: MonthInputs = state.perMonth[mKey] || {
      incomeAdd: 0,
      addFixed: 0,
      addDisc: 0,
      hysTransfer: 0
    };

    const perMonth = { ...state.perMonth, [mKey]: { ...cur, [field]: value } };
    const next: PersistedState = { ...state, perMonth };

    setState(next);
    saveState(next);
  }

  async function saveMonthToSheet(mKey: string) {
    setSaveError("");

    if (!sheetMap.ready) {
      setSaveError("Sheet map not ready yet");
      return;
    }

    const col = sheetMap.monthColByKey[mKey];
    if (!col) {
      setSaveError("Could not find month column in PLAN");
      return;
    }

    const rowIncome = sheetMap.incomeRow;
    const rowFixed = sheetMap.fixedRow;
    const rowDisc = sheetMap.discRow;
    const rowHys = sheetMap.hysRow;

    if (!rowIncome || !rowFixed || !rowDisc || !rowHys) {
      setSaveError("Could not find forecast rows in PLAN");
      return;
    }

    const inputs: MonthInputs = state.perMonth[mKey] || {
      incomeAdd: 0,
      addFixed: 0,
      addDisc: 0,
      hysTransfer: 0
    };

    const updates = [
      { row: rowIncome, col, value: clampFinite(inputs.incomeAdd) },
      { row: rowFixed, col, value: clampFinite(inputs.addFixed) },
      { row: rowDisc, col, value: clampFinite(inputs.addDisc) },
      { row: rowHys, col, value: clampFinite(inputs.hysTransfer) }
    ];

    setSaving(true);

    try {
      const apiKey =
        (process.env.REACT_APP_API_KEY as string | undefined) ||
        (process.env.REACT_APP_APP_KEY as string | undefined) ||
        "";

      const res = await fetch(`/api/forecastWrite?cb=${Date.now()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "x-app-key": apiKey } : {})
        },
        body: JSON.stringify({ updates })
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(`WRITE HTTP ${res.status}${msg ? ` ${msg}` : ""}`);
      }

      setSaveOkTick(Date.now());
      await loadFromSheet();
    } catch (e: any) {
      setSaveError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  const rows = useMemo(() => {
    const monthsAhead = state.monthsAhead || DEFAULT_MONTHS_AHEAD;

    const austinWeekly = clampFinite(props.austinWeekly);
    const jennaWeekly = clampFinite(props.jennaWeekly);

    const austinPayPerMonth = (m0: Date) => {
      const thursdays = countWeekdayInMonth(m0, 4);
      return thursdays * austinWeekly;
    };

    const jennaPayPerMonth = (m0: Date) => {
      const mondays = countWeekdayInMonth(m0, 1);
      const paychecks = Math.ceil(mondays / 2);
      return paychecks * jennaWeekly;
    };

    let runningOverflow = clampFinite(state.startOverflow);
    let runningHys = clampFinite(state.startHys);

    const out: Array<{
      month: Date;
      mKey: string;

      incomeBase: number;
      incomeAdd: number;
      incomeTotal: number;

      fixedBase: number;
      fixedAdd: number;
      fixedTotal: number;

      discBase: number;
      discAdd: number;
      discTotal: number;

      hysTransfer: number;

      monthOverflow: number;
      endOverflow: number;
      endHys: number;
    }> = [];

    for (let i = 0; i < monthsAhead; i += 1) {
      const m0 = addMonths(baseMonth, i + 1);
      const mk = monthKey(m0);

      const inputs = state.perMonth[mk] || {
        incomeAdd: 0,
        addFixed: 0,
        addDisc: 0,
        hysTransfer: 0
      };

      const incomeBase = austinPayPerMonth(m0) + jennaPayPerMonth(m0);
      const incomeAdd = clampFinite(inputs.incomeAdd);
      const incomeTotal = incomeBase + incomeAdd;

      const fixedBase = clampFinite(props.baseFixed);
      const fixedAdd = clampFinite(inputs.addFixed);
      const fixedTotal = fixedBase + fixedAdd;

      const discBase = clampFinite(props.baseDiscControlled);
      const discAdd = clampFinite(inputs.addDisc);
      const discTotal = discBase + discAdd;

      const hysTransfer = clampFinite(inputs.hysTransfer);

      const monthOverflow = incomeTotal - fixedTotal - discTotal - hysTransfer;

      runningOverflow += monthOverflow;
      runningHys += hysTransfer;

      out.push({
        month: m0,
        mKey: mk,
        incomeBase,
        incomeAdd,
        incomeTotal,
        fixedBase,
        fixedAdd,
        fixedTotal,
        discBase,
        discAdd,
        discTotal,
        hysTransfer,
        monthOverflow,
        endOverflow: runningOverflow,
        endHys: runningHys
      });
    }

    return out;
  }, [
    baseMonth,
    props.austinWeekly,
    props.jennaWeekly,
    props.baseDiscControlled,
    props.baseFixed,
    state.monthsAhead,
    state.perMonth,
    state.startOverflow,
    state.startHys
  ]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Forecast</div>
          <div style={{ opacity: 0.75, marginTop: 4 }}>
            Inputs are stored in your PLAN tab rows for Income, Fixed, Des, and HYS.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => loadFromSheet()}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--card)",
              cursor: "pointer"
            }}
            disabled={loadingSheet || saving}
          >
            {loadingSheet ? "Loading" : "Reload from sheet"}
          </button>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Months ahead</div>
            <input
              value={state.monthsAhead}
              onChange={(e) => setMonthsAhead(Number(e.target.value))}
              type="number"
              style={{ width: 110, padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border)" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Start overflow</div>
            <input
              value={state.startOverflow}
              onChange={(e) => setStartOverflow(Number(e.target.value))}
              type="number"
              style={{ width: 140, padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border)" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Start HYS</div>
            <input
              value={state.startHys}
              onChange={(e) => setStartHys(Number(e.target.value))}
              type="number"
              style={{ width: 140, padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border)" }}
            />
          </div>
        </div>
      </div>

      {sheetError ? (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 12, border: "1px solid var(--border)", background: "rgba(255,0,0,0.06)" }}>
          Could not load PLAN
          <br />
          <small style={{ opacity: 0.8 }}>{sheetError}</small>
        </div>
      ) : null}

      {!sheetMap.ready ? (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 12, border: "1px solid var(--border)", background: "rgba(0,0,0,0.03)" }}>
          Sheet mapping not ready yet. Make sure your PLAN tab includes the Month row and the forecast rows.
        </div>
      ) : null}

      <div style={{ marginTop: 14, borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: "10px 12px",
            background: "rgba(0,0,0,0.03)",
            fontWeight: 700,
            fontSize: 13
          }}
        >
          <div style={{ width: 110 }}>Month</div>
          <div style={{ flex: "1 1 120px" }}>Income base</div>
          <div style={{ flex: "1 1 120px" }}>Income add</div>
          <div style={{ flex: "1 1 120px" }}>Fixed add</div>
          <div style={{ flex: "1 1 140px" }}>Controlled disc add</div>
          <div style={{ flex: "1 1 120px" }}>HYS</div>
          <div style={{ flex: "1 1 140px" }}>Overflow</div>
          <div style={{ flex: "1 1 160px" }}>End overflow</div>
          <div style={{ width: 110 }}>Save</div>
        </div>

        {rows.map((r) => {
          const isSelected = isSameMonth(r.month, effectiveMonth);
          const input = state.perMonth[r.mKey] || { incomeAdd: 0, addFixed: 0, addDisc: 0, hysTransfer: 0 };

          return (
            <div
              key={r.mKey}
              style={{
                display: "flex",
                gap: 10,
                padding: "10px 12px",
                borderTop: "1px solid var(--border)",
                background: isSelected ? "rgba(139,173,205,0.12)" : "transparent",
                alignItems: "center"
              }}
              onClick={() => props.onSelectedMonthChange && props.onSelectedMonthChange(r.month)}
            >
              <div style={{ width: 110, fontWeight: 700 }}>{monthLabel(r.month)}</div>

              <div style={{ flex: "1 1 120px" }}>{fmtMoney0(r.incomeBase)}</div>

              <div style={{ flex: "1 1 120px" }}>
                <input
                  value={input.incomeAdd}
                  onChange={(e) => setMonthField(r.mKey, "incomeAdd", Number(e.target.value))}
                  onBlur={() => saveMonthToSheet(r.mKey)}
                  type="number"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border)" }}
                />
              </div>

              <div style={{ flex: "1 1 120px" }}>
                <input
                  value={input.addFixed}
                  onChange={(e) => setMonthField(r.mKey, "addFixed", Number(e.target.value))}
                  onBlur={() => saveMonthToSheet(r.mKey)}
                  type="number"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border)" }}
                />
              </div>

              <div style={{ flex: "1 1 140px" }}>
                <input
                  value={input.addDisc}
                  onChange={(e) => setMonthField(r.mKey, "addDisc", Number(e.target.value))}
                  onBlur={() => saveMonthToSheet(r.mKey)}
                  type="number"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border)" }}
                />
              </div>

              <div style={{ flex: "1 1 120px" }}>
                <input
                  value={input.hysTransfer}
                  onChange={(e) => setMonthField(r.mKey, "hysTransfer", Number(e.target.value))}
                  onBlur={() => saveMonthToSheet(r.mKey)}
                  type="number"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border)" }}
                />
              </div>

              <div style={{ flex: "1 1 140px", fontWeight: 700 }}>{fmtMoney0(r.monthOverflow)}</div>
              <div style={{ flex: "1 1 160px", fontWeight: 700 }}>{fmtMoney0(r.endOverflow)}</div>

              <div style={{ width: 110 }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    saveMonthToSheet(r.mKey);
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    cursor: "pointer"
                  }}
                  disabled={saving || loadingSheet}
                >
                  Save
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {saveError ? (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 12, border: "1px solid var(--border)", background: "rgba(255,0,0,0.06)" }}>
          Could not save
          <br />
          <small style={{ opacity: 0.8 }}>{saveError}</small>
        </div>
      ) : null}

      {saving ? (
        <div style={{ marginTop: 10, opacity: 0.75 }}>Saving to Google Sheet</div>
      ) : saveOkTick ? (
        <div style={{ marginTop: 10, opacity: 0.75 }}>Saved and reloaded</div>
      ) : null}

      <div style={{ marginTop: 18, opacity: 0.75, fontSize: 12 }}>
        Sheet mapping
        <br />
        Income row {sheetMap.incomeRow ?? "missing"} Fixed row {sheetMap.fixedRow ?? "missing"} Des row {sheetMap.discRow ?? "missing"} HYS row {sheetMap.hysRow ?? "missing"}
      </div>
    </div>
  );
}
