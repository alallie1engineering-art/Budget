import fs from "fs";
import path from "path";

function forceLoadEnvLocal() {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (!fs.existsSync(envPath)) return;

    const raw = fs.readFileSync(envPath, "utf8");
    const lines = raw.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("#")) continue;

      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;

      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (key) process.env[key] = value;
    }
  } catch (e) {
    console.log("env.local load failed", e);
  }
}

forceLoadEnvLocal();

import { google } from "googleapis";

function isAuthorized(req) {
  const want = process.env.APP_KEY;
  if (!want) return true;
  const got = req.headers["x-app-key"];
  return Boolean(got && got === want);
}

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing env GOOGLE_SERVICE_ACCOUNT_JSON");

  const creds = JSON.parse(raw);

  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });
}

function sendJson(res, code, body) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function getDebugFlag(req) {
  try {
    const u = new URL(req.url || "", "http://localhost");
    return u.searchParams.get("debug") === "1";
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  try {
    const debug = getDebugFlag(req);

    if (debug) {
      return sendJson(res, 200, {
        sheetId: process.env.SHEET_ID || null,
        tab: process.env.DATA_TRANSACTIONS_SHEET_NAME || "DATA_TRANSACTIONS",
        hasServiceJson: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
        appKeySet: Boolean(process.env.APP_KEY)
      });
    }

    if (!isAuthorized(req)) return sendJson(res, 401, { error: "unauthorized" });

    const spreadsheetId = process.env.SHEET_ID;
    if (!spreadsheetId) return sendJson(res, 500, { error: "Missing env SHEET_ID" });

    const sheetName = process.env.DATA_TRANSACTIONS_SHEET_NAME || "DATA_TRANSACTIONS";

    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const range = `${sheetName}!A:Z`;
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const values = resp.data.values || [];

    if (values.length < 2) return sendJson(res, 200, { headers: [], rows: [] });

    const headers = values[0].map((h) => String(h || "").trim());
    const rows = values.slice(1);

    return sendJson(res, 200, { headers, rows });
  } catch (err) {
    return sendJson(res, 500, { error: String(err?.message || err) });
  }
}