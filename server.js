const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "leagues.json");
const sessions = new Map();

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ leagues: [] }, null, 2));

const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png" };
const readDb = () => JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
const writeDb = (db) => fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
const clean = (value, max = 40) => String(value || "").trim().slice(0, max);
const json = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(body)); };
const publicLeague = (league) => ({
  code: league.code, name: league.name, ownerName: league.ownerName, status: league.status,
  createdAt: league.createdAt, members: league.members.map(({ id, teamName, playerName, points }) => ({ id, teamName, playerName, points })),
});
const hashPin = (pin, salt = crypto.randomBytes(16).toString("hex")) => ({ salt, hash: crypto.scryptSync(pin, salt, 32).toString("hex") });
const validPin = (pin, record) => {
  const incoming = crypto.scryptSync(pin, record.salt, 32);
  const stored = Buffer.from(record.hash, "hex");
  return incoming.length === stored.length && crypto.timingSafeEqual(incoming, stored);
};
const makeCode = (db) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do { code = Array.from({ length: 6 }, () => chars[crypto.randomInt(chars.length)]).join(""); } while (db.leagues.some((item) => item.code === code));
  return code;
};
const body = (req) => new Promise((resolve, reject) => {
  let raw = "";
  req.on("data", (chunk) => { raw += chunk; if (raw.length > 100_000) reject(new Error("Request too large")); });
  req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error("Invalid JSON")); } });
});
const authorized = (req, code) => {
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  const session = sessions.get(token);
  return session && session.code === code && session.expires > Date.now();
};

async function handleApi(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  if (url.pathname === "/api/health") return json(res, 200, { ok: true });
  if (req.method === "POST" && url.pathname === "/api/leagues") {
    const input = await body(req); const name = clean(input.name, 32); const ownerName = clean(input.ownerName, 32); const pin = clean(input.adminPin, 8);
    if (name.length < 2 || ownerName.length < 2 || !/^\d{4,8}$/.test(pin)) return json(res, 400, { error: "Enter a league name, your name, and a 4–8 digit PIN." });
    const db = readDb(); const code = makeCode(db); const pinRecord = hashPin(pin);
    db.leagues.push({ id: crypto.randomUUID(), code, name, ownerName, status: "Preseason", createdAt: new Date().toISOString(), pin: pinRecord, members: [] });
    writeDb(db); return json(res, 201, { code, name });
  }
  if (parts[0] !== "api" || parts[1] !== "leagues" || !parts[2]) return json(res, 404, { error: "Not found" });
  const code = parts[2].toUpperCase(); const db = readDb(); const league = db.leagues.find((item) => item.code === code);
  if (!league) return json(res, 404, { error: "League not found" });
  if (req.method === "GET" && parts.length === 3) return json(res, 200, publicLeague(league));
  if (req.method === "POST" && parts[3] === "members") {
    const input = await body(req); const teamName = clean(input.teamName, 32); const playerName = clean(input.playerName, 32);
    if (teamName.length < 2 || playerName.length < 2) return json(res, 400, { error: "Enter your name and a team name." });
    if (league.members.length >= 50) return json(res, 400, { error: "This league is full." });
    const member = { id: crypto.randomUUID(), teamName, playerName, points: 0, joinedAt: new Date().toISOString() };
    league.members.push(member); writeDb(db); return json(res, 201, member);
  }
  if (req.method === "POST" && parts[3] === "admin" && parts[4] === "login") {
    const input = await body(req);
    if (!validPin(clean(input.pin, 8), league.pin)) return json(res, 401, { error: "Incorrect admin PIN." });
    const token = crypto.randomBytes(24).toString("hex"); sessions.set(token, { code, expires: Date.now() + 8 * 60 * 60 * 1000 });
    return json(res, 200, { token, expiresIn: 28800 });
  }
  if (parts[3] === "admin" && !authorized(req, code)) return json(res, 401, { error: "Admin login required." });
  if (req.method === "GET" && parts[3] === "admin") return json(res, 200, publicLeague(league));
  if (req.method === "PATCH" && parts[3] === "admin" && parts[4] === "members" && parts[5]) {
    const input = await body(req); const member = league.members.find((item) => item.id === parts[5]);
    if (!member) return json(res, 404, { error: "Member not found" });
    const delta = Number(input.delta);
    if (!Number.isInteger(delta) || Math.abs(delta) > 100) return json(res, 400, { error: "Score change must be a whole number between -100 and 100." });
    member.points += delta; writeDb(db); return json(res, 200, member);
  }
  if (req.method === "PATCH" && parts[3] === "admin" && parts[4] === "status") {
    const input = await body(req); league.status = clean(input.status, 30) || league.status; writeDb(db); return json(res, 200, publicLeague(league));
  }
  return json(res, 404, { error: "Not found" });
}

function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const file = path.normalize(path.join(ROOT, requested));
  if (!file.startsWith(ROOT) || file.includes(`${path.sep}data${path.sep}`)) return json(res, 403, { error: "Forbidden" });
  fs.readFile(file, (error, content) => {
    if (error) return json(res, error.code === "ENOENT" ? 404 : 500, { error: "File not found" });
    res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" }); res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try { if (url.pathname.startsWith("/api/")) await handleApi(req, res, url); else serveStatic(req, res, url); }
  catch (error) { console.error(error); json(res, 500, { error: "Server error" }); }
});
server.listen(PORT, () => console.log(`Rice Survivor running at http://localhost:${PORT}`));
