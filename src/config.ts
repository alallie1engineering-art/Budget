// src/config.ts

// Optional app key sent as x-app-key header to the API.
// Set REACT_APP_API_KEY in your .env file to match the server's APP_KEY env var.
// Leave blank for local dev (server skips auth if APP_KEY is not set).
export const API_APP_KEY = process.env.REACT_APP_API_KEY || "";

export const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSyGwb7qnavzNq9ZqNpiN4D7dByaoPUjTnDHw2qDkdnPcUJ4ug2_aqbPTUNKQQko4Uuu-6JZOCNKCsE/pub?gid=2130685871&single=true&output=csv";

export const BUCKETS = ["Food", "Gas", "General Merchandise", "Other"] as const;

export const BUDGETS: Record<(typeof BUCKETS)[number], number> = {
  Food: 1200,
  Gas: 300,
  "General Merchandise": 1700,
  Other: 0,
};

export const TOTAL_DISCRETIONARY_BUDGET =
  (BUDGETS.Food || 0) +
  (BUDGETS.Gas || 0) +
  (BUDGETS["General Merchandise"] || 0) +
  (BUDGETS.Other || 0);

export const BUCKET_UI: Record<
  (typeof BUCKETS)[number],
  { label: string; icon: string; color: string }
> = {
  Food: { label: "Food", icon: "🍽️", color: "#E11D48" },
  Gas: { label: "Gas", icon: "⛽", color: "#D97706" },
  "General Merchandise": {
    label: "General Merchandise",
    icon: "🛍️",
    color: "#7C3AED",
  },
  Other: { label: "Other", icon: "✈️", color: "#0891B2" },
};

export const DOT_COLORS: Record<string, string> = {
  Food: "#E11D48",
  Gas: "#D97706",
  "General Merchandise": "#7C3AED",
  Other: "#0891B2",
  Income: "#16A34A",
};

export const FIXED_ORDER = [
  "Mortage",
  "Additional Payment",
  "Auto",
  "Medical",
  "Car Insurance",
  "Utiities",
  "Student Loans",
  "NorthWest",
] as const;

export const FIXED_BUDGETS: Record<(typeof FIXED_ORDER)[number], number> = {
  Mortage: 2969,
  "Additional Payment": 0,
  Auto: 0,
  Medical: 232,
  "Car Insurance": 150,
  Utiities: 791.9,
  "Student Loans": 317,
  NorthWest: 925,
};

export const UTILITIES_ORDER = [
  "National Grid",
  "Spectrum",
  "Joann Phone",
  "Peacock",
  "Gym",
  "Water",
  "Netflix",
  "Apple",
  "Other",
] as const;

export const UTILITIES_BUDGETS: Record<(typeof UTILITIES_ORDER)[number], number> =
  {
    "National Grid": 450.0,
    Spectrum: 109.99,
    "Joann Phone": 85.0,
    Peacock: 10.98,
    Gym: 69.95,
    Water: 30.0,
    Netflix: 7.99,
    Apple: 0.0,
    Other: 0.0,
  };