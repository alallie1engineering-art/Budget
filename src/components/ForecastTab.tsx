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

type PlanGrid = { headers: string[]; rows: any[][] };

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

function clampFinite(n: number) { return Number.isFinite(n) ? n : 0; }
function monthStart(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }

function countWeekdayInMonth(m0: Date, weekday: number) {
  const y = m0.getFullYear(), m = m0.getMonth();
  const last = new Date(y, m + 1, 0);
  let count = 0;
  for (let d = new Date(y, m, 1); d <= last; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    if (d.getDay() === weekday) count++;
  }
  return count;
}

function parseMonthCell(v: any): Date | null {
  if (!v && v !== 0) return null;
  if (typeof v === "number" && Number.isFinite(v) && v > 1000) {
    const ms = (v - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1);
  }
  if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), 1);
  const s = String(v).trim();
  if (!s) return null;
  const iso = new Date(s);
  if (!Number.isNaN(iso.getTime())) return new Date(iso.getFullYear(), iso.getMonth(), 1);
  return null;
}

function safeNum(v: any) {
  const n = Number(String(v ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { const p = JSON.parse(raw); if (p && typeof p === "object") return p as PersistedState; }
  } catch {}
  return { monthsAhead: DEFAULT_MONTHS_AHEAD, perMonth: {}, startOverflow: 0, startHys: 0, startUserOverride: false, lastAutoOverflow: 0, lastAutoHys: 0 };
}

function saveState(s: PersistedState) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} }
function labelMatch(a: string, b: string) { return a.trim().toLowerCase() === b.trim().toLowerCase(); }

function findRowIndex(grid: PlanGrid, label: string): number | null {
  const rows = Array.isArray(grid?.rows) ? grid.rows : [];
  for (let i = 0; i < rows.length; i++) {
    if (labelMatch(String(rows[i]?.[0] ?? ""), label)) return i + 2;
  }
  return null;
}

function buildSheetMap(grid: PlanGrid): SheetMap {
  const rows = Array.isArray(grid?.rows) ? grid.rows : [];
  const headers = Array.isArray(grid?.headers) ? grid.headers : [];
  let monthHeaderRow: any[] | null = null;

  // The API returns the first sheet row as `headers` and the rest as `rows`.
  // Check headers first (the "Month" label row is usually row 0 = headers).
  if (headers.length > 0 && labelMatch(String(headers[0] ?? ""), "Month")) {
    monthHeaderRow = headers;
  }
  // Fall back to searching inside rows (in case layout differs)
  if (!monthHeaderRow) {
    for (let i = 0; i < rows.length; i++) {
      if (labelMatch(String(rows[i]?.[0] ?? ""), "Month")) { monthHeaderRow = rows[i]; break; }
    }
  }
  const monthColByKey: Record<string, number> = {};
  if (monthHeaderRow) {
    for (let col = 1; col <= monthHeaderRow.length; col++) {
      const d = parseMonthCell(monthHeaderRow[col - 1]);
      if (d) monthColByKey[monthKey(d)] = col;
    }
  }
  return {
    ready: Boolean(Object.keys(monthColByKey).length),
    monthColByKey,
    incomeRow: findRowIndex(grid, "FORECAST INCOME"),
    fixedRow: findRowIndex(grid, "FORECAT FIXED") ?? findRowIndex(grid, "FORECAST FIXED"),
    discRow: findRowIndex(grid, "FORECAST DES"),
    hysRow: findRowIndex(grid, "FORECAST HYS"),
  };
}

function readForecastInputsFromGrid(grid: PlanGrid, map: SheetMap): Record<string, MonthInputs> {
  const out: Record<string, MonthInputs> = {};
  const rows = Array.isArray(grid?.rows) ? grid.rows : [];
  const byRow = (r: number | null) => { if (!r) return null; const i = r - 2; return (i >= 0 && i < rows.length) ? rows[i] : null; };
  const rI = byRow(map.incomeRow), rF = byRow(map.fixedRow), rD = byRow(map.discRow), rH = byRow(map.hysRow);
  for (const [mk, col] of Object.entries(map.monthColByKey)) {
    out[mk] = { incomeAdd: safeNum(rI?.[col-1]), addFixed: safeNum(rF?.[col-1]), addDisc: safeNum(rD?.[col-1]), hysTransfer: safeNum(rH?.[col-1]) };
  }
  return out;
}

export default function ForecastTab(props: ForecastTabProps) {
  const fallbackNow = useMemo(() => new Date(), []);
  const effectiveMonth = props.selectedMonth ?? fallbackNow;
  const baseMonth = useMemo(() => monthStart(effectiveMonth), [effectiveMonth]);

  const [grid, setGrid] = useState<PlanGrid>({ headers: [], rows: [] });
  const [sheetMap, setSheetMap] = useState<SheetMap>({ ready: false, monthColByKey: {}, incomeRow: null, fixedRow: null, discRow: null, hysRow: null });
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [sheetError, setSheetError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [state, setState] = useState<PersistedState>(() => loadState());
  const lastLoadStampRef = useRef(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  function draftKey(mKey: string, field: string) { return `${mKey}:${field}`; }
  function getDraft(mKey: string, field: keyof MonthInputs, fallback: number): string {
    const k = draftKey(mKey, field);
    return k in drafts ? drafts[k] : String(fallback);
  }
  function handleChange(mKey: string, field: keyof MonthInputs, raw: string) {
    setDrafts(d => ({ ...d, [draftKey(mKey, field)]: raw }));
    const n = parseFloat(raw);
    if (Number.isFinite(n)) setMonthField(mKey, field, n);
  }
  function handleBlur(mKey: string, field: keyof MonthInputs) {
    setDrafts(d => { const next = { ...d }; delete next[draftKey(mKey, field)]; return next; });
    saveMonthToSheet(mKey);
  }

  async function loadFromSheet() {
    const stamp = Date.now();
    lastLoadStampRef.current = stamp;
    setLoadingSheet(true); setSheetError("");
    try {
      const apiKey = (process.env.REACT_APP_API_KEY as string | undefined) || (process.env.REACT_APP_APP_KEY as string | undefined) || "";
      const res = await fetch(`/api/plan?cb=${Date.now()}`, { cache: "no-store", headers: apiKey ? { "x-app-key": apiKey } : undefined });
      if (!res.ok) throw new Error(`PLAN HTTP ${res.status}`);
      const data = await res.json();
      if (lastLoadStampRef.current !== stamp) return;
      const nextGrid: PlanGrid = { headers: Array.isArray(data?.headers) ? data.headers : [], rows: Array.isArray(data?.rows) ? data.rows : [] };
      setGrid(nextGrid);
      const nextMap = buildSheetMap(nextGrid);
      setSheetMap(nextMap);
      const sheetInputs = nextMap.ready ? readForecastInputsFromGrid(nextGrid, nextMap) : {};
      const autoOverflow = Math.round(clampFinite(props.autoStartOverflow ?? 0));
      const autoHys = Math.round(clampFinite(props.autoStartHys ?? 0));
      setState(prev => {
        const next: PersistedState = {
          ...(prev ?? loadState()),
          perMonth: { ...(prev?.perMonth ?? {}), ...sheetInputs },
          lastAutoOverflow: autoOverflow, lastAutoHys: autoHys,
          startOverflow: prev?.startUserOverride ? prev.startOverflow : autoOverflow,
          startHys: prev?.startUserOverride ? prev.startHys : autoHys,
        };
        saveState(next); return next;
      });
    } catch (e: any) {
      if (lastLoadStampRef.current !== stamp) return;
      setSheetError(e?.message || String(e));
    } finally {
      if (lastLoadStampRef.current === stamp) setLoadingSheet(false);
    }
  }

  useEffect(() => { loadFromSheet(); }, []);

  useEffect(() => {
    const autoOverflow = Math.round(clampFinite(props.autoStartOverflow ?? 0));
    const autoHys = Math.round(clampFinite(props.autoStartHys ?? 0));
    if (!autoOverflow && !autoHys) return;
    if (state.startUserOverride) return;
    const next: PersistedState = { ...state, startOverflow: autoOverflow, startHys: autoHys, lastAutoOverflow: autoOverflow, lastAutoHys: autoHys };
    setState(next); saveState(next);
  }, [props.autoStartOverflow, props.autoStartHys]);

  function setMonthsAhead(n: number) {
    const next: PersistedState = { ...state, monthsAhead: Math.max(3, Math.min(36, Math.floor(clampFinite(n) || DEFAULT_MONTHS_AHEAD))) };
    setState(next); saveState(next);
  }
  function setStartOverflow(v: number) {
    const next: PersistedState = { ...state, startOverflow: Math.round(clampFinite(v)), startUserOverride: true };
    setState(next); saveState(next);
  }
  function setStartHys(v: number) {
    const next: PersistedState = { ...state, startHys: Math.round(clampFinite(v)), startUserOverride: true };
    setState(next); saveState(next);
  }
  function setMonthField(mKey: string, field: keyof MonthInputs, value: number) {
    const cur = state.perMonth[mKey] || { incomeAdd: 0, addFixed: 0, addDisc: 0, hysTransfer: 0 };
    const next: PersistedState = { ...state, perMonth: { ...state.perMonth, [mKey]: { ...cur, [field]: value } } };
    setState(next); saveState(next);
  }

  async function saveMonthToSheet(mKey: string) {
    setSaveError("");
    if (!sheetMap.ready) { setSaveError("Sheet map not loaded yet — try Reload sheet"); return; }
    if (!sheetMap.monthColByKey[mKey]) { return; } // month not in sheet yet — skip silently
    const col = sheetMap.monthColByKey[mKey];
    const { incomeRow, fixedRow, discRow, hysRow } = sheetMap;
    if (!incomeRow || !fixedRow || !discRow || !hysRow) {
      setSaveError(`Missing forecast rows — Income:${incomeRow} Fixed:${fixedRow} Disc:${discRow} HYS:${hysRow}`);
      return;
    }
    const inp = state.perMonth[mKey] || { incomeAdd: 0, addFixed: 0, addDisc: 0, hysTransfer: 0 };
    setSaving(true);
    try {
      const apiKey = (process.env.REACT_APP_API_KEY as string | undefined) || (process.env.REACT_APP_APP_KEY as string | undefined) || "";
      const res = await fetch(`/api/forecastWrite?cb=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(apiKey ? { "x-app-key": apiKey } : {}) },
        body: JSON.stringify({ updates: [
          { row: incomeRow, col, value: clampFinite(inp.incomeAdd) },
          { row: fixedRow, col, value: clampFinite(inp.addFixed) },
          { row: discRow, col, value: clampFinite(inp.addDisc) },
          { row: hysRow, col, value: clampFinite(inp.hysTransfer) },
        ]})
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`WRITE HTTP ${res.status}: ${errText}`);
      }
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
    const austinPay = (m: Date) => countWeekdayInMonth(m, 4) * austinWeekly;
    const jennaPay = (m: Date) => Math.ceil(countWeekdayInMonth(m, 1) / 2) * jennaWeekly * 2;
    let runOverflow = clampFinite(state.startOverflow);
    let runHys = clampFinite(state.startHys);
    return Array.from({ length: monthsAhead }, (_, i) => {
      const m0 = addMonths(baseMonth, i + 1);
      const mk = monthKey(m0);
      const inp = state.perMonth[mk] || { incomeAdd: 0, addFixed: 0, addDisc: 0, hysTransfer: 0 };
      const incomeTotal = austinPay(m0) + jennaPay(m0) + (Number.isFinite(inp.incomeAdd) ? inp.incomeAdd : 0);
      const fixedTotal = clampFinite(props.baseFixed) + clampFinite(inp.addFixed);
      const discTotal = clampFinite(props.baseDiscControlled) + clampFinite(inp.addDisc);
      const hysTransfer = clampFinite(inp.hysTransfer);
      const monthOverflow = incomeTotal - fixedTotal - discTotal - hysTransfer;
      runOverflow += monthOverflow;
      runHys += hysTransfer;
      return { month: m0, mKey: mk, incomeTotal, fixedTotal, discTotal, hysTransfer, monthOverflow, endOverflow: runOverflow, endHys: runHys };
    });
  }, [baseMonth, props.austinWeekly, props.jennaWeekly, props.baseDiscControlled, props.baseFixed, state]);

  const CAP: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    opacity: 0.4,
    marginBottom: 3,
  };

  const CTRL: React.CSSProperties = {
    padding: "7px 10px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--card)",
    fontSize: 15,
    width: "100%",
    boxSizing: "border-box" as const,
  };

  return (
    <div style={{ padding: "16px 16px 100px" }}>
      <style>{`
        .fc-header { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 18px; }
        .fc-header-inputs { margin-left: auto; display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }

        /* Stats row: all cells in one flex row that wraps gracefully */
        .fc-stats {
          display: flex;
          align-items: stretch;
          flex-wrap: wrap;
        }

        /* Month label */
        .fc-month {
          flex: 0 0 130px;
          padding: 16px 14px;
          display: flex;
          align-items: center;
          border-right: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        /* Generic stat cell */
        .fc-cell {
          flex: 1 1 110px;
          min-width: 100px;
          padding: 12px 14px;
          border-right: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        /* Month overflow — wider */
        .fc-cell-overflow {
          flex: 1.6 1 140px;
          min-width: 130px;
        }

        /* Running cell — no right border, wider */
        .fc-cell-running {
          flex: 1.4 1 130px;
          min-width: 120px;
          border-right: none;
        }

        /* Adjust row */
        .fc-adjust {
          display: flex;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 10px;
          padding: 12px 14px;
          border-top: 1px solid var(--border);
        }
        .fc-adjust-lbl {
          flex: 0 0 auto;
          font-size: 11px;
          font-weight: 600;
          opacity: 0.3;
          padding-bottom: 6px;
          min-width: 44px;
          align-self: flex-end;
        }
        .fc-adjust-field {
          flex: 1 1 120px;
          min-width: 100px;
        }

        /* ── Mobile: month label full-width, cells go 2-per-row ── */
        @media (max-width: 620px) {
          .fc-month {
            flex: 0 0 100%;
            border-right: none;
          }
          .fc-cell {
            flex: 1 1 calc(50% - 1px);
            min-width: calc(50% - 1px);
          }
          .fc-cell-running {
            flex: 0 0 100%;
            min-width: 100%;
            border-right: none;
          }
        }
      `}</style>

      {/* ── Controls ── */}
      <div className="fc-header">
        <div style={{ flex: "0 0 auto" }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>Forecast</div>
          <div style={{ fontSize: 12, opacity: 0.4, marginTop: 2 }}>Auto-saves on blur · syncs to PLAN sheet</div>
        </div>
        <div className="fc-header-inputs">
          {[
            { label: "Months",         val: state.monthsAhead,   set: (v: number) => setMonthsAhead(v),    w: 72  },
            { label: "Start Overflow", val: state.startOverflow, set: (v: number) => setStartOverflow(v),  w: 130 },
            { label: "Start HYS",      val: state.startHys,      set: (v: number) => setStartHys(v),       w: 130 },
          ].map(({ label, val, set, w }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column" }}>
              <div style={CAP}>{label}</div>
              <input value={val} onChange={e => set(Number(e.target.value))} type="number"
                style={{ ...CTRL, width: w }} />
            </div>
          ))}
          <button onClick={() => loadFromSheet()} disabled={loadingSheet}
            style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", fontSize: 14, cursor: "pointer", fontWeight: 600, alignSelf: "flex-end" }}>
            {loadingSheet ? "Loading…" : "↻ Reload"}
          </button>
        </div>
      </div>

      {sheetError && <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 13 }}>{sheetError}</div>}
      {saving    && <div style={{ marginBottom: 8, fontSize: 12, opacity: 0.4 }}>Saving…</div>}
      {saveError && <div style={{ marginBottom: 8, fontSize: 12, color: "#EF4444" }}>{saveError}</div>}

      {/* ── Month cards ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map(r => {
          const isSelected = isSameMonth(r.month, effectiveMonth);
          const inp = state.perMonth[r.mKey] || { incomeAdd: 0, addFixed: 0, addDisc: 0, hysTransfer: 0 };
          const posColor = "#166534";
          const negColor = "#DC2626";
          const ovColor  = r.monthOverflow >= 0 ? posColor : negColor;
          const runColor = r.endOverflow   >= 0 ? posColor : negColor;

          return (
            <div
              key={r.mKey}
              onClick={() => props.onSelectedMonthChange?.(r.month)}
              style={{
                borderRadius: 14,
                border: `1.5px solid ${isSelected ? "rgba(99,132,199,0.6)" : "var(--border)"}`,
                background: isSelected ? "rgba(99,132,199,0.05)" : "var(--card)",
                overflow: "hidden",
                cursor: "pointer",
              }}
            >
              {/* Stats */}
              <div className="fc-stats">
                {/* Month name */}
                <div className="fc-month">
                  <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>{monthLabel(r.month)}</div>
                </div>

                {/* Income */}
                <div className="fc-cell">
                  <div style={CAP}>Income</div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{fmtMoney0(r.incomeTotal)}</div>
                </div>

                {/* Fixed */}
                <div className="fc-cell">
                  <div style={CAP}>Fixed</div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{fmtMoney0(r.fixedTotal)}</div>
                </div>

                {/* Disc */}
                <div className="fc-cell">
                  <div style={CAP}>Disc</div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{fmtMoney0(r.discTotal)}</div>
                </div>

                {/* Month overflow */}
                <div className="fc-cell fc-cell-overflow"
                  style={{ background: r.monthOverflow >= 0 ? "rgba(22,101,52,0.06)" : "rgba(220,38,38,0.06)" }}>
                  <div style={CAP}>Month Overflow</div>
                  <div style={{ fontWeight: 900, fontSize: 26, color: ovColor, lineHeight: 1 }}>{fmtMoney0(r.monthOverflow)}</div>
                </div>

                {/* Running totals */}
                <div className="fc-cell fc-cell-running">
                  <div style={{ marginBottom: 8 }}>
                    <div style={CAP}>Running Overflow</div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: runColor }}>{fmtMoney0(r.endOverflow)}</div>
                  </div>
                  <div>
                    <div style={CAP}>Running HYS</div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{fmtMoney0(r.endHys)}</div>
                  </div>
                </div>
              </div>

              {/* Adjust inputs */}
              <div className="fc-adjust" onClick={e => e.stopPropagation()}>
                <div className="fc-adjust-lbl">Adjust</div>
                {([
                  { field: "incomeAdd"   as keyof MonthInputs, label: "Income ±" },
                  { field: "addFixed"    as keyof MonthInputs, label: "Fixed +"  },
                  { field: "addDisc"     as keyof MonthInputs, label: "Disc +"   },
                  { field: "hysTransfer" as keyof MonthInputs, label: "HYS"      },
                ] as const).map(({ field, label }) => (
                  <div key={field} className="fc-adjust-field">
                    <div style={CAP}>{label}</div>
                    <input
                      value={getDraft(r.mKey, field, inp[field])}
                      onChange={e => handleChange(r.mKey, field, e.target.value)}
                      onBlur={() => handleBlur(r.mKey, field)}
                      type="number"
                      style={CTRL}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, opacity: 0.25, fontSize: 11 }}>
        Sheet rows — Income {sheetMap.incomeRow ?? "?"} · Fixed {sheetMap.fixedRow ?? "?"} · Disc {sheetMap.discRow ?? "?"} · HYS {sheetMap.hysRow ?? "?"}
      </div>
    </div>
  );
}