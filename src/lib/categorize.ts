// src/lib/categorize.ts
import { Bucket } from "../types";
import { tl } from "./text";

export const CONTROLLED_BUCKETS: Bucket[] = [
  "Food",
  "Gas",
  "General Merchandise",
];

export function isTransferType(t: string) {
  return tl(t) === "transfer";
}
export function isIncomeType(t: string) {
  return tl(t) === "income";
}
export function isFixedType(t: string) {
  return tl(t) === "fixed";
}
export function isDiscretionaryType(t: string) {
  return tl(t) === "discretionary";
}

export function categoryToBucket(catRaw: string): Bucket | "IGNORE" {
  const cat = String(catRaw || "").trim();

  if (cat === "Transfers") return "IGNORE";
  if (cat === "Restaurants/Dining") return "Food";
  if (cat === "Other Discretionary") return "Gas";

  if (
    ["Travel", "Gifts", "Home Improvement", "Automotive Expenses"].includes(cat)
  )
    return "Other";

  if (
    [
      "General Merchandise",
      "Clothing/Shoes",
      "Entertainment",
      "Repairs & Maintenance",
      "Uncategorized",
    ].includes(cat)
  ) {
    return "General Merchandise";
  }

  return "General Merchandise";
}

export function normalizeFixedBucket(rawCat: string): string {
  const low = String(rawCat || "")
    .trim()
    .toLowerCase();

  if (low === "interest") return "Ignore";
  if (low === "education") return "Student Loans";
  if (["healthcare/medical", "chiropractors"].includes(low)) return "Medical";
  if (low.includes("doctors and physicians")) return "Medical";
  if (low === "retirement contributions") return "NorthWest";
  if (low === "mortgages") return "Mortage";
  if (low === "savings") return "Savings";

  const utilCats = [
    "utilities",
    "dues and subscriptions",
    "telephone services",
    "cable/satellite services",
    "taxes",
    "insurance",
    "other fixed",
    "child/dependent expenses",
    "pets/pet care",
    "services",
  ];
  if (utilCats.includes(low)) return "Utiities";
  if (low.includes("bridge and road fees")) return "Utiities";
  if (low.includes("membership clubs")) return "Utiities";

  return "Utiities";
}

export function shouldForceToDiscretionary(catRaw: string): boolean {
  const cat = String(catRaw || "")
    .trim()
    .toLowerCase();
  return ["restaurants/dining", "gifts", "home improvement", "rent"].includes(
    cat
  );
}

export function utilityLine(descRaw: string): string {
  const d = String(descRaw || "")
    .trim()
    .toLowerCase();
  if (d.includes("national grid")) return "National Grid";
  if (d.includes("spectrum")) return "Spectrum";
  if (d.includes("venmo inc") || d.includes("transfer to venmo"))
    return "Joann Phone";
  if (d.includes("netflix")) return "Netflix";
  if (d.includes("peacock") || d.includes("hulu")) return "Peacock";
  if (d.includes("liverpoolclub") || d.includes("elevate fitn")) return "Gym";
  if (d.includes("onondaga county water") || d.includes("water authority"))
    return "Water";
  if (d === "apple" || d.includes("apple.com")) return "Apple";
  return "Other";
}
