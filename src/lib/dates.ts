// src/lib/dates.ts
export function monthKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export function monthLabel(d: Date) {
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function shortMonth(d: Date) {
  return d.toLocaleString("en-US", { month: "short" });
}

export function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}
