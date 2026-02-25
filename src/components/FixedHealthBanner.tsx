// src/components/FixedHealthBanner.tsx
import React from "react";

export function FixedHealthBanner({
  linesOnTrack,
  total,
}: {
  linesOnTrack: number;
  total: number;
}) {
  const allGood = linesOnTrack === total;
  const mostly = total > 0 && linesOnTrack >= total * 0.75;

  if (allGood) {
    return (
      <div
        style={{
          background: "linear-gradient(135deg, #DCFCE7, #BBF7D0)",
          border: "1px solid #86EFAC",
          borderRadius: 14,
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 99,
            background: "#16A34A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          ✓
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: "#14532D" }}>
            All fixed costs on budget this month
          </div>
          <div style={{ fontSize: 12, color: "#166534", marginTop: 2 }}>
            {linesOnTrack} of {total} lines are on track or under budget
          </div>
        </div>
      </div>
    );
  }

  const bg = mostly ? "#FEF3C7" : "#FEE2E2";
  const border = mostly ? "#FCD34D" : "#FCA5A5";
  const color = mostly ? "#92400E" : "#991B1B";
  const darkColor = mostly ? "#78350F" : "#7F1D1D";

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 14,
        padding: "12px 18px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 16,
      }}
    >
      <span style={{ fontSize: 18 }}>{mostly ? "⚠️" : "🔴"}</span>
      <div>
        <div style={{ fontWeight: 800, fontSize: 13, color: darkColor }}>
          {total - linesOnTrack} line{total - linesOnTrack !== 1 ? "s" : ""}{" "}
          over budget
        </div>
        <div style={{ fontSize: 11, color, marginTop: 1 }}>
          {linesOnTrack} of {total} lines on track
        </div>
      </div>
    </div>
  );
}
