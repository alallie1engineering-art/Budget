// src/lib/format.ts
export function fmtMoney0(n: number) {
  const sign = n < 0 ? "-" : "";
  return sign + "$" + Math.round(Math.abs(n)).toLocaleString("en-US");
}

export function clamp0(n: number) {
  return Math.max(0, n);
}

export function sumAbsSpendFromNet(net: number) {
  return Math.max(0, -net);
}

export function statClassForRemaining(r: number) {
  if (r >= 0 && r > 500) return "good";
  if (r >= 0) return "warn";
  return "bad";
}

export function statClassForBudget(spent: number, budget: number) {
  if (!budget || budget <= 0) return "warn";
  if (spent > budget) return "bad";
  if (spent > budget * 0.83) return "warn";
  return "good";
}
