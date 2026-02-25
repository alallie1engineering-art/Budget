// src/components/Sparkline.tsx
import React from "react";

export function Sparkline({
  values,
  color,
  width = 56,
  height = 22,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (!values.length) return null;

  const max = Math.max(...values, 1);
  const bw = Math.max(
    2,
    Math.floor((width - (values.length - 1)) / values.length)
  );

  return (
    <svg
      width={width}
      height={height}
      style={{ display: "block", overflow: "visible" }}
    >
      {values.map((v, i) => {
        const bh = Math.max(2, Math.round((v / max) * height));
        return (
          <rect
            key={i}
            x={i * (bw + 1)}
            y={height - bh}
            width={bw}
            height={bh}
            rx={1.5}
            fill={color}
            opacity={i === values.length - 1 ? 1 : 0.28}
          />
        );
      })}
    </svg>
  );
}
