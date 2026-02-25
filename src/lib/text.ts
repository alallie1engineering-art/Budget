// src/lib/text.ts
export function tl(v: string) {
  return String(v || "")
    .trim()
    .toLowerCase();
}
export function safeTrim(v: any) {
  return String(v ?? "").trim();
}
export function safeLower(v: any) {
  return safeTrim(v).toLowerCase();
}
export function isTruthy(v: string) {
  const s = String(v || "")
    .trim()
    .toLowerCase();
  return s === "true" || s === "yes" || s === "y" || s === "1" || s === "x";
}
