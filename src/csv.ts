// src/csv.ts
function parseCsvLine(line: string) {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out;
}

export function parseCsv(text: string) {
  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  if (rawLines.length < 2) return { headers: [] as string[], rows: [] as any[] };

  let headerIdx = 0;
  for (let i = 0; i < Math.min(10, rawLines.length); i++) {
    const l = rawLines[i].toLowerCase();
    if (l.includes("column 1") && l.includes("column 2") && l.includes("column 6")) {
      headerIdx = i;
      break;
    }
  }

  const headers = parseCsvLine(rawLines[headerIdx]).map((h) =>
    String(h || "").trim()
  );
  const rows: any[] = [];

  for (let i = headerIdx + 1; i < rawLines.length; i++) {
    const vals = parseCsvLine(rawLines[i]);
    if (vals.length === 0) continue;

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = String(vals[j] ?? "").trim();
    }
    rows.push(row);
  }

  return { headers, rows };
}

export function parseAmount(str: string) {
  if (!str) return 0;
  const s = String(str).trim();
  const isNeg = s.includes("(") || s.includes("-");

  const num = Number(s.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(num)) return 0;

  return isNeg ? -num : num;
}

// src/csv.ts
export function parseDate(str: string) {
  if (!str) return null;

  const s = String(str).trim();

  // Google Sheets serial like 45360
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n) && n > 20000) {
      const ms = Math.round(n * 86400000);
      const baseUtc = Date.UTC(1899, 11, 30);
      const utc = new Date(baseUtc + ms);

      // Convert UTC day to a local date only object
      const d = new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }

  // ISO date only string, treat as local date, not UTC
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    const out = new Date(y, m - 1, d);
    return Number.isNaN(out.getTime()) ? null : out;
  }

  // Common US formatted date from Sheets like 12/1/2025
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const m = Number(us[1]);
    const d = Number(us[2]);
    const y = Number(us[3]);
    const out = new Date(y, m - 1, d);
    return Number.isNaN(out.getTime()) ? null : out;
  }

  // Fallback
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function pick(row: Record<string, any>, names: string[]) {
  for (const n of names) {
    if (row[n] !== undefined && row[n] !== "") return row[n];
  }
  return "";
}