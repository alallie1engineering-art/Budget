// src/components/DonutRing.tsx
import React from "react";
import { fmtMoney0 } from "../lib/format";

export function DonutRing({
  segments,
  total,
  budget,
  size = 150,
  activeSegment,
}: {
  segments: { label: string; value: number; color: string }[];
  total: number;
  budget: number;
  size?: number;
  activeSegment?: string;
}) {
  const r = size / 2 - 14;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;

  const nonZero = segments.filter((s) => s.value > 0);
  const sum = nonZero.reduce((a, b) => a + b.value, 0) || 1;

  let offset = 0;
  const arcs = nonZero.map((s) => {
    const pct = s.value / sum;
    const dash = pct * circ;
    const arc = { ...s, dash, gap: circ - dash, offset };
    offset += dash;
    return arc;
  });

  const pctUsed = budget > 0 ? Math.min(total / budget, 1) : 0;
  const centerColor =
    pctUsed > 1 ? "#991B1B" : pctUsed > 0.83 ? "#92400E" : "#166534";

  return (
    <div
      style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={12}
        />
        {arcs.map((a) => (
          <circle
            key={a.label}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth={activeSegment && activeSegment !== a.label ? 8 : 12}
            opacity={activeSegment && activeSegment !== a.label ? 0.3 : 1}
            strokeDasharray={`${a.dash} ${a.gap}`}
            strokeDashoffset={-a.offset}
            strokeLinecap="butt"
            style={{ transition: "all 0.25s ease" }}
          />
        ))}
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontFamily: "DM Serif Display, serif",
            fontSize: 19,
            lineHeight: 1,
            color: centerColor,
          }}
        >
          {fmtMoney0(total)}
        </div>
        <div
          style={{
            fontSize: 9,
            color: "var(--warm-gray)",
            marginTop: 3,
            textTransform: "uppercase",
            letterSpacing: 0.6,
          }}
        >
          spent
        </div>
      </div>
    </div>
  );
}
