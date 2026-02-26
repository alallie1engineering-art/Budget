// src/components/ForecastTab.tsx
import React, { useEffect, useMemo, useState } from "react";
import { fmtMoney0 } from "../lib/format";
import { isSameMonth, monthKey, monthLabel } from "../lib/dates";

type MonthInputs = {
  addFixed: number;
  addDisc: number;
  otherSpend: number;
  hysTransfer: number;
};

type Props = {
  selectedMonth: Date | null;
  onSelectMonth?: (m: Date) => void;

  baseFixed: number;
  baseDiscControlled: number;

  austinWeekly: number;
  jennaWeekly: number;

    autoStartOverflow?: number | null;
  autoStartHys?: number | null;
};

const STORAGE_KEY = "forecast_inputs_v2";

const JENNA_ANCHOR_PAY_DATE = new Date(2026, 1, 25); // Wed 2/25/2026

function clampFinite(n: number) {
  return Number.isFinite(n) ? n : 0;
}

function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function addMonths(d: Date, months: number) {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

function endOfMonthExclusive(m0: Date) {
  return new Date(m0.getFullYear(), m0.getMonth() + 1, 1);
}

function parseMoneyInput(v: string) {
  const s = String(v || "").trim();
  if (!s) return 0;
  const neg = s.includes("(") || s.includes("-");
  const num = Number(s.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(num)) return 0;
  return neg ? -num : num;
}

function safeLoadState(): {
  perMonth: Record<string, MonthInputs>;
  startOverflow: number;
  startHys: number;
  monthsAhead: number;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { perMonth: {}, startOverflow: 0, startHys: 0, monthsAhead: 12 };
    }
    const parsed = JSON.parse(raw);
    const perMonth = (parsed?.perMonth || {}) as Record<string, MonthInputs>;
    const startOverflow = clampFinite(Number(parsed?.startOverflow ?? 0));
    const startHys = clampFinite(Number(parsed?.startHys ?? 0));
    const monthsAhead = clampFinite(Number(parsed?.monthsAhead ?? 12)) || 12;

    return {
      perMonth,
      startOverflow,
      startHys,
      monthsAhead: Math.max(3, Math.min(36, Math.floor(monthsAhead))),
    };
  } catch {
    return { perMonth: {}, startOverflow: 0, startHys: 0, monthsAhead: 12 };
  }
}

function saveState(next: {
  perMonth: Record<string, MonthInputs>;
  startOverflow: number;
  startHys: number;
  monthsAhead: number;
}) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function countWeekdayInMonth(m0: Date, weekday: number) {
  const end = endOfMonthExclusive(m0);
  let c = 0;
  for (let d = new Date(m0); d.getTime() < end.getTime(); d = addDays(d, 1)) {
    if (d.getDay() === weekday) c += 1;
  }
  return c;
}

function countJennaPaychecksInMonth(m0: Date) {
  const start = m0;
  const end = endOfMonthExclusive(m0);

  let d = new Date(JENNA_ANCHOR_PAY_DATE);

  while (d.getTime() >= end.getTime()) d = addDays(d, -14);
  while (d.getTime() < start.getTime()) d = addDays(d, 14);

  let c = 0;
  while (d.getTime() >= start.getTime() && d.getTime() < end.getTime()) {
    c += 1;
    d = addDays(d, 14);
  }
  return c;
}

export default function ForecastTab(props: Props) {
  const [state, setState] = useState(() => safeLoadState());

  const baseMonth = useMemo(() => {
    const d = props.selectedMonth
      ? monthStart(props.selectedMonth)
      : monthStart(new Date());
    return d;
  }, [props.selectedMonth]);
  const baseIsCurrentMonth = useMemo(() => {
    return isSameMonth(baseMonth, new Date());
  }, [baseMonth]);

  const autoStart = useMemo(() => {
    const o = props.autoStartOverflow;
    const h = props.autoStartHys;

    const has = Number.isFinite(o as number) && Number.isFinite(h as number);

    return {
      has,
      overflow: clampFinite(Number(o ?? 0)),
      hys: clampFinite(Number(h ?? 0)),
    };
  }, [props.autoStartOverflow, props.autoStartHys]);

  useEffect(() => {
    if (!baseIsCurrentMonth) return;
    if (!autoStart.has) return;

    if (state.startOverflow !== 0 || state.startHys !== 0) return;

    const next = {
      ...state,
      startOverflow: autoStart.overflow,
      startHys: autoStart.hys,
    };

    setState(next);
    saveState(next);
  }, [
    baseIsCurrentMonth,
    autoStart.has,
    autoStart.overflow,
    autoStart.hys,
    state.startOverflow,
    state.startHys,
  ]);

  function applyAutoStart() {
    if (!autoStart.has) return;

    const next = {
      ...state,
      startOverflow: autoStart.overflow,
      startHys: autoStart.hys,
    };

    setState(next);
    saveState(next);
  }
  function setMonthsAhead(n: number) {
    const next = { ...state, monthsAhead: n };
    setState(next);
    saveState(next);
  }

function setStartOverflow(v: number) {
  const next = { ...state, startOverflow: Math.round(clampFinite(v)) };
  setState(next);
  saveState(next);
}

function setStartHys(v: number) {
  const next = { ...state, startHys: Math.round(clampFinite(v)) };
  setState(next);
  saveState(next);

  }

  function setMonthField(
    mKey: string,
    field: keyof MonthInputs,
    value: number
  ) {
    const cur = state.perMonth[mKey] || {
      addFixed: 0,
      addDisc: 0,
      otherSpend: 0,
      hysTransfer: 0,
    };
    const perMonth = { ...state.perMonth, [mKey]: { ...cur, [field]: value } };
    const next = { ...state, perMonth };
    setState(next);
    saveState(next);
  }

  const rows = useMemo(() => {
    const monthsAhead = state.monthsAhead || 12;

    const austinWeekly = clampFinite(props.austinWeekly);
    const jennaWeekly = clampFinite(props.jennaWeekly);

    const austinPayPerMonth = (m0: Date) => {
      const thursdays = countWeekdayInMonth(m0, 4);
      return thursdays * austinWeekly;
    };

    const jennaPayPerMonth = (m0: Date) => {
      const paychecks = countJennaPaychecksInMonth(m0);
      const perPaycheck = jennaWeekly * 2;
      return paychecks * perPaycheck;
    };

    let runningOverflow = clampFinite(state.startOverflow);
    let runningHys = clampFinite(state.startHys);

    const out: Array<{
      month: Date;
      mKey: string;

      incomeAustin: number;
      incomeJenna: number;
      incomeTotal: number;

      fixedBase: number;
      fixedAdd: number;
      fixedTotal: number;

      discBase: number;
      discAdd: number;
      discTotal: number;

      otherSpend: number;
      hysTransfer: number;

      monthOverflow: number;
      endOverflow: number;
      endHys: number;
    }> = [];

    for (let i = 0; i < monthsAhead; i++) {
      const m0 = addMonths(baseMonth, i);
      const mk = monthKey(m0);

      const inputs = state.perMonth[mk] || {
        addFixed: 0,
        addDisc: 0,
        otherSpend: 0,
        hysTransfer: 0,
      };

      const incomeAustin = austinPayPerMonth(m0);
      const incomeJenna = jennaPayPerMonth(m0);
      const incomeTotal = incomeAustin + incomeJenna;

      const fixedBase = clampFinite(props.baseFixed);
      const fixedAdd = clampFinite(inputs.addFixed);
      const fixedTotal = fixedBase + fixedAdd;

      const discBase = clampFinite(props.baseDiscControlled);
      const discAdd = clampFinite(inputs.addDisc);
      const discTotal = discBase + discAdd;

      const otherSpend = clampFinite(inputs.otherSpend);
      const hysTransfer = clampFinite(inputs.hysTransfer);

      const monthOverflow =
        incomeTotal - fixedTotal - discTotal - otherSpend - hysTransfer;

      runningOverflow += monthOverflow;
      runningHys += hysTransfer;

      out.push({
        month: m0,
        mKey: mk,
        incomeAustin,
        incomeJenna,
        incomeTotal,
        fixedBase,
        fixedAdd,
        fixedTotal,
        discBase,
        discAdd,
        discTotal,
        otherSpend,
        hysTransfer,
        monthOverflow,
        endOverflow: runningOverflow,
        endHys: runningHys,
      });
    }

    return out;
  }, [
    baseMonth,
    props.austinWeekly,
    props.baseDiscControlled,
    props.baseFixed,
    props.jennaWeekly,
    state.monthsAhead,
    state.perMonth,
    state.startHys,
    state.startOverflow,
  ]);

  return (
    <main>
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "stretch",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            flex: "2 1 360px",
            background: "white",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              fontFamily: "DM Serif Display, serif",
              fontSize: 22,
              marginBottom: 6,
            }}
          >
            Forecast
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--warm-gray)",
              lineHeight: 1.35,
            }}
          >
            Austin income counts Thursdays in the month. Jenna income counts
            biweekly paychecks anchored to 2/25/2026.
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 12,
            }}
          >
            <div style={{ flex: "1 1 160px" }}>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--warm-gray)",
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                }}
              >
                Start overflow balance
              </div>
              <input
                value={fmtMoney0(state.startOverflow)}
                onChange={(e) =>
                  setStartOverflow(parseMoneyInput(e.target.value))
                }
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: "10px 10px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--cream)",
                  fontSize: 13,
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div style={{ flex: "1 1 160px" }}>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--warm-gray)",
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                }}
              >
                Start HYS balance
              </div>
              <input
                value={fmtMoney0(state.startHys)}
                onChange={(e) => setStartHys(parseMoneyInput(e.target.value))}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: "10px 10px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--cream)",
                  fontSize: 13,
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div style={{ flex: "1 1 140px" }}>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--warm-gray)",
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                }}
              >
                Months
              </div>
              <select
                value={state.monthsAhead}
                onChange={(e) => setMonthsAhead(Number(e.target.value))}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: "10px 10px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--cream)",
                  fontSize: 13,
                  fontFamily: "inherit",
                }}
              >
                {[6, 9, 12, 18, 24, 36].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div
          style={{
            flex: "1 1 240px",
            background: "white",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--warm-gray)",
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            Base budgets
          </div>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 12, color: "var(--warm-gray)" }}>
                Fixed
              </div>
              <div style={{ fontSize: 14, fontWeight: 900 }}>
                {fmtMoney0(props.baseFixed)}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 12, color: "var(--warm-gray)" }}>
                Controlled discretionary
              </div>
              <div style={{ fontSize: 14, fontWeight: 900 }}>
                {fmtMoney0(props.baseDiscControlled)}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 12, color: "var(--warm-gray)" }}>
                Austin weekly
              </div>
              <div style={{ fontSize: 14, fontWeight: 900 }}>
                {fmtMoney0(props.austinWeekly || 0)}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 12, color: "var(--warm-gray)" }}>
                Jenna weekly
              </div>
              <div style={{ fontSize: 14, fontWeight: 900 }}>
                {fmtMoney0(props.jennaWeekly || 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="transactions-wrap" style={{ overflow: "hidden" }}>
        <div className="transactions-header">
          <div className="transactions-title">Monthly projection</div>
        </div>

        <div style={{ padding: 14 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 12,
              background: "var(--cream)",
              border: "1px solid var(--border)",
              fontSize: 11,
              color: "var(--warm-gray)",
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            <div style={{ flex: "0 0 150px" }}>Month</div>
            <div style={{ flex: "1 1 120px" }}>Income</div>
            <div style={{ flex: "1 1 120px" }}>Fixed</div>
            <div style={{ flex: "1 1 140px" }}>Controlled disc</div>
            <div style={{ flex: "1 1 120px" }}>Other</div>
            <div style={{ flex: "1 1 120px" }}>HYS</div>
            <div style={{ flex: "1 1 140px" }}>Overflow</div>
            <div style={{ flex: "1 1 160px" }}>End overflow</div>
            <div style={{ flex: "1 1 160px" }}>End HYS</div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 10,
            }}
          >
            {rows.map((r) => {
              const isSelected = props.selectedMonth
                ? isSameMonth(r.month, props.selectedMonth)
                : false;

              const overflowColor =
                r.monthOverflow >= 0 ? "#166534" : "#991B1B";
              const endOverflowColor =
                r.endOverflow >= 0 ? "#166534" : "#991B1B";

              return (
                <div
                  key={r.mKey}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    overflow: "hidden",
                    background: "white",
                    outline: isSelected
                      ? "2px solid rgba(99,102,241,0.35)"
                      : "none",
                    outlineOffset: 0,
                  }}
                >
                  <div
                    style={{
                      padding: "12px 12px",
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => props.onSelectMonth?.(r.month)}
                      title="Set selected month"
                      style={{
                        flex: "0 0 150px",
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: props.onSelectMonth ? "pointer" : "default",
                        fontFamily: "DM Serif Display, serif",
                        fontSize: 16,
                        color: "var(--ink)",
                      }}
                    >
                      {monthLabel(r.month)}
                    </button>

                    <div
                      style={{
                        flex: "1 1 120px",
                        fontWeight: 900,
                        color: "#166534",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {fmtMoney0(r.incomeTotal)}
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--warm-gray)",
                          fontWeight: 600,
                          marginTop: 2,
                        }}
                      >
                        Austin {fmtMoney0(r.incomeAustin)} · Jenna{" "}
                        {fmtMoney0(r.incomeJenna)}
                      </div>
                    </div>

                    <div
                      style={{
                        flex: "1 1 120px",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <div style={{ fontWeight: 900 }}>
                        {fmtMoney0(r.fixedTotal)}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          marginTop: 6,
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--warm-gray)",
                            fontWeight: 700,
                          }}
                        >
                          Add
                        </span>
                        <input
                          value={String(state.perMonth[r.mKey]?.addFixed ?? 0)}
                          onChange={(e) =>
                            setMonthField(
                              r.mKey,
                              "addFixed",
                              parseMoneyInput(e.target.value)
                            )
                          }
                          style={{
                            width: 90,
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid var(--border)",
                            background: "var(--cream)",
                            fontSize: 12,
                            fontFamily: "inherit",
                          }}
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        flex: "1 1 140px",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <div style={{ fontWeight: 900 }}>
                        {fmtMoney0(r.discTotal)}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          marginTop: 6,
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--warm-gray)",
                            fontWeight: 700,
                          }}
                        >
                          Add
                        </span>
                        <input
                          value={String(state.perMonth[r.mKey]?.addDisc ?? 0)}
                          onChange={(e) =>
                            setMonthField(
                              r.mKey,
                              "addDisc",
                              parseMoneyInput(e.target.value)
                            )
                          }
                          style={{
                            width: 90,
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid var(--border)",
                            background: "var(--cream)",
                            fontSize: 12,
                            fontFamily: "inherit",
                          }}
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        flex: "1 1 120px",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <div style={{ fontWeight: 900 }}>
                        {fmtMoney0(r.otherSpend)}
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <input
                          value={String(
                            state.perMonth[r.mKey]?.otherSpend ?? 0
                          )}
                          onChange={(e) =>
                            setMonthField(
                              r.mKey,
                              "otherSpend",
                              parseMoneyInput(e.target.value)
                            )
                          }
                          style={{
                            width: 110,
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid var(--border)",
                            background: "var(--cream)",
                            fontSize: 12,
                            fontFamily: "inherit",
                          }}
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        flex: "1 1 120px",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <div style={{ fontWeight: 900 }}>
                        {fmtMoney0(r.hysTransfer)}
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <input
                          value={String(
                            state.perMonth[r.mKey]?.hysTransfer ?? 0
                          )}
                          onChange={(e) =>
                            setMonthField(
                              r.mKey,
                              "hysTransfer",
                              parseMoneyInput(e.target.value)
                            )
                          }
                          style={{
                            width: 110,
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid var(--border)",
                            background: "var(--cream)",
                            fontSize: 12,
                            fontFamily: "inherit",
                          }}
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        flex: "1 1 140px",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "DM Serif Display, serif",
                          fontSize: 20,
                          color: overflowColor,
                        }}
                      >
                        {r.monthOverflow >= 0 ? "+" : ""}
                        {fmtMoney0(r.monthOverflow)}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--warm-gray)",
                          fontWeight: 600,
                          marginTop: 2,
                        }}
                      >
                        This month
                      </div>
                    </div>

                    <div
                      style={{
                        flex: "1 1 160px",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <div style={{ fontWeight: 900, color: endOverflowColor }}>
                        {fmtMoney0(r.endOverflow)}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--warm-gray)",
                          fontWeight: 600,
                          marginTop: 2,
                        }}
                      >
                        Ending overflow
                      </div>
                    </div>

                    <div
                      style={{
                        flex: "1 1 160px",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <div style={{ fontWeight: 900, color: "#166534" }}>
                        {fmtMoney0(r.endHys)}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--warm-gray)",
                          fontWeight: 600,
                          marginTop: 2,
                        }}
                      >
                        Ending HYS
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      borderTop: "1px solid var(--border)",
                      background: "rgba(0,0,0,0.018)",
                      padding: "10px 12px",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 14,
                      alignItems: "center",
                      color: "var(--warm-gray)",
                      fontSize: 11,
                    }}
                  >
                    <span>
                      Fixed base {fmtMoney0(r.fixedBase)} · Disc base{" "}
                      {fmtMoney0(r.discBase)}
                    </span>
                    <span>Inputs saved automatically</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
