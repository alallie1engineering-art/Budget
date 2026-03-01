// src/types.ts
import { BUCKETS } from "./config";

export type Bucket = (typeof BUCKETS)[number];
export type Tab =
  | "budget_overview"
  | "history"
  | "budget"
  | "fixed"
  | "forecast";

export type TxRow = {
  date: Date;
  desc: string;
  category: string;
  type: string;
  amt: number;
  bucket: Bucket;
};

export type HistoryRow =
  | {
      kind: "month";
      month: Date;
      income: number;
      fixedSpend: number;
      discSpend: number;
      savingsTransfer: number;
      overflow: number;
      actualOverflow?: number | null;
    }
  | {
      kind: "year";
      year: number;
      income: number;
      fixedSpend: number;
      discSpend: number;
      savingsTransfer: number;
      overflow: number;
      actualOverflow?: number | null;
    }
  | { kind: "spacer"; id: string };