import React, { useState } from "react";
import { fmtMoney0 } from "../lib/format";
import { monthLabel, shortMonth } from "../lib/dates";

export function OverflowBarChart({
  data,
  onSelect,
}: {
  data: Array<{ month: Date; overflow: number }>;
  onSelect: (m: Date) => void;
}) {
  const [hover, setHover] = useState<{
    month: Date;
    overflow: number;
  } | null>(null);

  if (!data.length) return null;

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.overflow)), 1);
  const CHART_H = 80;
  const ZERO_Y = CHART_H / 2;

  return (
    <div
      style={{
        position: "relative",
        background: "white",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "20px 20px 12px",
        marginBottom: 14,
        boxSizing: "border-box",
        width: "100%",
      }}
      onMouseLeave={() => setHover(null)}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 14,
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
          Monthly Overflow · hover to see value · click a bar to open that month
        </div>

        {hover ? (
          <div
            style={{
              background: "rgba(15,23,42,0.92)",
              color: "white",
              padding: "8px 10px",
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 700,
              lineHeight: 1.2,
              boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            <div style={{ opacity: 0.85, fontWeight: 600, fontSize: 10 }}>
              {monthLabel(hover.month)}
            </div>
            <div>{fmtMoney0(hover.overflow)}</div>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "var(--warm-gray)" }}>&nbsp;</div>
        )}
      </div>

      <div style={{ width: "100%" }}>
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 4,
            width: "100%",
          }}
        >
          {data.map((d, i) => {
            const absVal = Math.abs(d.overflow);
            const isPos = d.overflow >= 0;
            const barH = Math.max(4, Math.round((absVal / maxAbs) * ZERO_Y));
            const isHovered = hover?.month.getTime() === d.month.getTime();

            return (
              <div
                key={i}
                onClick={() => onSelect(d.month)}
                onMouseEnter={() =>
                  setHover({ month: d.month, overflow: d.overflow })
                }
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  cursor: "pointer",
                  flex: "1 1 0",
                  minWidth: 0,
                  gap: 0,
                  opacity: hover && !isHovered ? 0.55 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                {/* Positive half */}
                <div
                  style={{
                    height: ZERO_Y,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    width: "100%",
                  }}
                >
                  {isPos ? (
                    <div
                      style={{
                        height: barH,
                        background: isHovered
                          ? "rgba(34,197,94,0.95)"
                          : "rgba(34,197,94,0.75)",
                        borderRadius: "3px 3px 0 0",
                        transition: "height 0.3s ease, background 0.15s",
                        width: "100%",
                      }}
                    />
                  ) : (
                    <div />
                  )}
                </div>

                {/* Zero line */}
                <div
                  style={{
                    height: 1,
                    width: "100%",
                    background: "var(--border)",
                    flexShrink: 0,
                  }}
                />

                {/* Negative half */}
                <div
                  style={{
                    height: ZERO_Y,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    width: "100%",
                  }}
                >
                  {!isPos ? (
                    <div
                      style={{
                        height: barH,
                        background: isHovered
                          ? "rgba(239,68,68,0.95)"
                          : "rgba(239,68,68,0.7)",
                        borderRadius: "0 0 3px 3px",
                        transition: "height 0.3s ease, background 0.15s",
                        width: "100%",
                      }}
                    />
                  ) : (
                    <div />
                  )}
                </div>

                <div
                  style={{
                    fontSize: 9,
                    color: isHovered ? "var(--ink)" : "var(--warm-gray)",
                    marginTop: 4,
                    textAlign: "center",
                    fontWeight: isHovered ? 800 : 600,
                    letterSpacing: 0.3,
                    transition: "color 0.15s",
                    width: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {shortMonth(d.month)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 10,
          fontSize: 11,
          color: "var(--warm-gray)",
        }}
      >
        <span>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: 2,
              background: "rgba(34,197,94,0.75)",
              marginRight: 5,
            }}
          />
          Positive overflow
        </span>
        <span>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: 2,
              background: "rgba(239,68,68,0.7)",
              marginRight: 5,
            }}
          />
          Deficit
        </span>
      </div>
    </div>
  );
}
