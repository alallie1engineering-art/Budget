import React from "react";
import { fmtMoney0 } from "../lib/format";

export function VarianceBarLive({
  budget,
  variance,
}: {
  budget: number;
  variance: number;
}) {
  const v = Number.isFinite(variance) ? variance : 0;

  // variance = budget - actual
  // + under budget -> green LEFT
  // - over budget  -> red RIGHT
  const scale = Math.max(250, Math.abs(budget || 0), 1);
  const pct = Math.min(1, Math.abs(v) / scale);
  const widthPct = pct * 50;

  const isUnder = v > 0;
  const isOver = v < 0;

  const fill = isOver ? "#F87171" : "#4ADE80";
  const labelColor =
    v === 0 ? "var(--warm-gray)" : isOver ? "#991B1B" : "#166534";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          position: "relative",
          flex: 1,
          height: 8,
          background: "var(--border)",
          borderRadius: 99,
          overflow: "hidden",
          minWidth: 140,
        }}
        title={fmtMoney0(v)}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            bottom: 0,
            width: 2,
            background: "rgba(0,0,0,0.18)",
            transform: "translateX(-1px)",
          }}
        />

        {v !== 0 ? (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              bottom: 0,
              width: `${widthPct}%`,
              background: fill,
              borderRadius: 99,
              transform: isUnder ? "translateX(-100%)" : "translateX(0)",
              transition: "width 0.25s ease, transform 0.25s ease",
            }}
          />
        ) : null}
      </div>

      <span
        style={{
          fontWeight: 900,
          color: labelColor,
          whiteSpace: "nowrap",
          fontSize: 12,
          minWidth: 70,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {v > 0 ? "+" : ""}
        {fmtMoney0(v)}
      </span>
    </div>
  );
}
