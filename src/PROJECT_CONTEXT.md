Project is a CodeSandbox React TypeScript budget dashboard.
Main entry is src/App.tsx.
Data sources are Google Sheets CSV URLs in src/config.
Transactions load and normalize in src/hooks/useTransactions.ts.
Plan loads from a separate CSV in src/hooks/usePlan.ts and parses in src/lib/plan.ts.
Category mapping and fixed bucket logic live in src/lib/categorize.ts.
Money formatting and helper math live in src/lib/format.ts.
Date helpers live in src/lib/dates.ts.
UI components are in src/components including Sparkline, DonutRing, OverflowBarChart, VarianceBar, FixedHealthBanner.
Key rule: Remaining budget is based only on Food, Gas, General Merchandise. Other does not reduce remaining.    