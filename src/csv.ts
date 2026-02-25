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

export function parseDate(str: string) {
  if (!str) return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function pick(row: Record<string, any>, names: string[]) {
  for (const n of names) {
    if (row[n] !== undefined && row[n] !== "") return row[n];
  }
  return "";
}