// api/forecastWrite.js
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

function forceLoadEnvLocal() {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key) process.env[key] = value;
    }
  } catch (e) {
    console.log("env.local load failed", e);
  }
}

forceLoadEnvLocal();

function sendJson(res, code, body) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function isAuthorized(req) {
  const want = process.env.APP_KEY;
  if (!want) return true;
  return Boolean(req.headers["x-app-key"] && req.headers["x-app-key"] === want);
}

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing env GOOGLE_SERVICE_ACCOUNT_JSON");
  const creds = JSON.parse(raw);
  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
}

async function readBody(req) {
  // Vercel may or may not pre-parse the body
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  // Stream it manually
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  await new Promise((resolve, reject) => {
    req.on("end", resolve);
    req.on("error", reject);
  });
  const txt = Buffer.concat(chunks).toString("utf8") || "{}";
  return JSON.parse(txt);
}

function colToA1(col) {
  let n = col, s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") return sendJson(res, 405, { error: "method_not_allowed" });
    if (!isAuthorized(req)) return sendJson(res, 401, { error: "unauthorized" });

    const spreadsheetId = process.env.SHEET_ID;
    if (!spreadsheetId) return sendJson(res, 500, { error: "Missing env SHEET_ID" });

    const sheetName = process.env.PLAN_SHEET_NAME || "PLAN";

    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      return sendJson(res, 400, { error: "bad_json: " + String(e?.message || e) });
    }

    const updates = Array.isArray(body?.updates) ? body.updates : [];

    if (!updates.length) {
      console.log("forecastWrite: no updates in body", JSON.stringify(body));
      return sendJson(res, 400, { error: "missing_updates" });
    }

    for (const u of updates) {
      if (!u || !Number.isFinite(u.row) || !Number.isFinite(u.col)) {
        return sendJson(res, 400, { error: "bad_update_shape: " + JSON.stringify(u) });
      }
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const data = updates.map((u) => {
      const a1 = `${sheetName}!${colToA1(u.col)}${u.row}`;
      console.log("forecastWrite cell", a1, "=", u.value);
      return {
        range: a1,
        values: [[u.value == null ? "" : u.value]]
      };
    });

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data
      }
    });

    return sendJson(res, 200, { ok: true, count: data.length, cells: data.map(d => d.range) });
  } catch (err) {
    console.error("forecastWrite error", err);
    return sendJson(res, 500, { error: String((err && err.message) || err) });
  }
};