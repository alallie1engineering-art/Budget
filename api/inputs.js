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
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

function sendJson(res, code, body) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  try {
    if (!isAuthorized(req)) return sendJson(res, 401, { error: "unauthorized" });

    const spreadsheetId = process.env.SHEET_ID;
    if (!spreadsheetId) return sendJson(res, 500, { error: "Missing env SHEET_ID" });

    const sheetName = process.env.BUS_INPUTS_SHEET_NAME || "BUS_INPUTS";

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