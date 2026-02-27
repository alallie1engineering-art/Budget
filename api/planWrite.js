

const { google } = require("googleapis")

function sendJson(res, code, body) {
  res.statusCode = code
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Cache-Control", "no-store")
  res.end(JSON.stringify(body))
}

function isAuthorized(req) {
  const want = process.env.APP_KEY
  if (!want) return true
  const got = req.headers["x-app-key"]
  return Boolean(got && got === want)
}

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error("Missing env GOOGLE_SERVICE_ACCOUNT_JSON")
  const creds = JSON.parse(raw)

  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  })
}

async function readBody(req) {
  const chunks = []
  req.on("data", (c) => chunks.push(c))
  await new Promise((resolve) => req.on("end", resolve))
  const txt = Buffer.concat(chunks).toString("utf8") || "{}"
  return JSON.parse(txt)
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") return sendJson(res, 405, { error: "method not allowed" })
    if (!isAuthorized(req)) return sendJson(res, 401, { error: "unauthorized" })

    const spreadsheetId = process.env.SHEET_ID
    if (!spreadsheetId) return sendJson(res, 500, { error: "Missing env SHEET_ID" })

    const sheetName = process.env.PLAN_SHEET_NAME || "PLAN"

    const body = await readBody(req)

    const addInc = body.addInc ?? ""
    const addFix = body.addFix ?? ""
    const austinPay = body.austinPay ?? ""
    const jennaPay = body.jennaPay ?? ""
    const descrAdd = body.descrAdd ?? ""

    const auth = getAuth()
    const sheets = google.sheets({ version: "v4", auth })

console.log("planWrite spreadsheetId", spreadsheetId, "sheetName", sheetName)

try {
  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  console.log("planWrite meta ok", meta?.data?.spreadsheetId, meta?.data?.properties?.title)
} catch (e) {
  console.log("planWrite meta fail", e?.message || e)
}

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!H2:H6`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[addInc], [addFix], [austinPay], [jennaPay], [descrAdd]]
      }
    })

    return sendJson(res, 200, { ok: true })
  } catch (err) {
    return sendJson(res, 500, { error: String(err && err.message ? err.message : err) })
  }
}