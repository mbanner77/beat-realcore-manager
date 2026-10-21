// Beat RealCore – Legacy League · Server: statische Dateien, Bestenliste (SQLite), KI-Texte, Admin
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC = path.join(__dirname, 'public');
const TEAM_CODE = (process.env.TEAM_CODE || '').trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const AI_PROVIDER_RAW = (process.env.AI_PROVIDER || (process.env.ANTHROPIC_API_KEY ? 'anthropic' : process.env.OPENAI_API_KEY ? 'openai' : process.env.AZURE_OPENAI_API_KEY ? 'azure' : 'none')).toLowerCase();
const AI_KEYS = { anthropic: process.env.ANTHROPIC_API_KEY, openai: process.env.OPENAI_API_KEY, azure: process.env.AZURE_OPENAI_API_KEY };
const AI_PROVIDER = AI_KEYS[AI_PROVIDER_RAW] ? AI_PROVIDER_RAW : 'none';
const AI_MODEL = process.env.AI_MODEL || (AI_PROVIDER === 'openai' ? 'gpt-4o-mini' : 'claude-haiku-5-5');
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'legacy-league.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, created INTEGER, mission TEXT, difficulty TEXT, used INTEGER DEFAULT 0, ai_calls INTEGER DEFAULT 0, last_ai INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT, created INTEGER, day TEXT, game_id TEXT, name TEXT, company TEXT,
    email TEXT, consent INTEGER DEFAULT 0, team INTEGER DEFAULT 0, mission TEXT, difficulty TEXT,
    score INTEGER, won INTEGER, duration INTEGER, stats TEXT, edit_token TEXT, voucher INTEGER DEFAULT 0, note TEXT, hidden INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_scores_rank ON scores (mission, difficulty, score DESC);
  CREATE INDEX IF NOT EXISTS idx_scores_day ON scores (day);
`);
// Spalten für Tages-Challenge nachrüsten (bestehende Datenbanken)
for (const [t, c] of [['games', 'daily TEXT'], ['scores', 'daily TEXT']]) { try { db.exec(`ALTER TABLE ${t} ADD COLUMN ${c}`); } catch { /* existiert schon */ } }
db.exec('CREATE INDEX IF NOT EXISTS idx_scores_daily ON scores (daily, score DESC)');

const MISSIONS = ['league'];
const DIFFS = ['messe', 'profi', 'gf'];
const EVENTS = ['release_freeze', 'change_requests', 'budget_cut', 'shadow_it', 'koloss', 'wave_now'];
const MISSION_NAMES = { league: 'Legacy League' };
// Saisons im SAP-Release-Rhythmus (ein Quartal)
function seasonOf(day) { const [y, m] = day.split('-').map(Number), q = Math.floor((m - 1) / 3); const start = `${y}-${String(q * 3 + 1).padStart(2, '0')}-01`; const endM = q * 3 + 4; const end = endM > 12 ? `${y + 1}-01-01` : `${y}-${String(endM).padStart(2, '0')}-01`; return { key: `${y}-Q${q + 1}`, name: `${['Winter', 'Frühjahrs', 'Sommer', 'Herbst'][q]}-Release ${y}`, start, end }; }
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

// ---------------- KI ----------------
async function llm(system, user, maxTokens = 500) {
  if (AI_PROVIDER === 'none') return null;
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 12000);
  try {
    let text = '';
    if (AI_PROVIDER === 'anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: AI_MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
      });
      const j = await r.json();
      if (!r.ok) { console.warn('KI-Fehler', r.status, JSON.stringify(j).slice(0, 300)); return null; }
      text = (j.content || []).map(c => c.text || '').join('');
    } else {
      const azure = AI_PROVIDER === 'azure';
      const url = azure
        ? `${process.env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, '')}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${process.env.AZURE_OPENAI_API_VERSION || '2024-06-01'}`
        : 'https://api.openai.com/v1/chat/completions';
      const headers = { 'content-type': 'application/json', ...(azure ? { 'api-key': process.env.AZURE_OPENAI_API_KEY } : { authorization: `Bearer ${process.env.OPENAI_API_KEY}` }) };
      const r = await fetch(url, { method: 'POST', signal: ctl.signal, headers, body: JSON.stringify({ ...(azure ? {} : { model: AI_MODEL }), max_tokens: maxTokens, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) });
      const j = await r.json();
      if (!r.ok) { console.warn('KI-Fehler', r.status, JSON.stringify(j).slice(0, 300)); return null; }
      text = j.choices?.[0]?.message?.content || '';
    }
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch (e) { console.warn('KI nicht erreichbar:', e.message); return null; } finally { clearTimeout(tm); }
}

const PERSONA = `Du bist die „Legacy-KI“ – Trainer des Legacy-Monolith FC und Gegenspieler im Fußballmanager „Beat RealCore – Legacy League“ der RealCore Group (SAP-Beratung, BTP, KI, Retail).
Die Liga besteht aus Clubs der Legacy-IT: FC Datensilo, Spaghetti Interface SV, Excel-Makro Kickers, Z-Report Zombies 1998, SV Ticketflut, Fax-Werk Süd, Legacy-Monolith FC. Der Spieler managt TechHub United (RealCore).
Ton: frech, selbstironisch, SAP-Insider-Humor und Fußball-Floskeln, nie beleidigend, nie anzüglich, keine Politik, keine echten Firmen schlecht machen. Deutsch, Du/Ihr-Form.
Antworte AUSSCHLIESSLICH mit einem JSON-Objekt, ohne Erklärtext.`;

const EN_NOTE = '\nWICHTIG: Schreibe alle Texte (text, taunt, headline, message usw.) ausschließlich auf Englisch. JSON-Schlüssel und IDs bleiben unverändert.';
async function aiBriefing(b) {
  const user = `Erzeuge den Text einer Pressekonferenz zum Saisonstart (Sprecher: neutrale Sportschau-Stimme) und eine Spitze der Legacy-KI.
Manager: ${clean(b.name, 32) || 'unbekannt'}; Unternehmen: ${clean(b.company, 48) || 'nicht angegeben'}; Schwierigkeit: ${b.difficulty}.
JSON-Felder:
- "text": Pressekonferenz, 2–3 Sätze, max. 330 Zeichen, nennt Manager und ggf. Unternehmen, Saisonziel: Meister der Legacy League, Finale gegen den Legacy-Monolith FC
- "taunt": spöttische Spitze der Legacy-KI, max. 150 Zeichen`;
  const r = await llm(PERSONA + (b.lang === 'en' ? EN_NOTE : ''), user, 400);
  if (!r) return null;
  return { text: clean(r.text, 420), taunt: clean(r.taunt, 180) };
}

async function aiDirector(s) {
  const user = `Du wählst die Störung der Legacy-KI für die kommende Trainingswoche. Saisonstand (JSON): ${JSON.stringify(s).slice(0, 1200)}
Erlaubte Störungen:
- release_freeze: ein Leistungsträger des Spielers ist für das nächste Spiel gesperrt
- change_requests: ein Spieler verletzt sich im Training
- budget_cut: Controlling kürzt das Transferbudget (nur sinnvoll, wenn budget hoch)
- shadow_it: der Gegner stellt heimlich einen Starspieler auf
- koloss: der Mainframe-Koloss stürmt beim Gegner (nicht wiederholen, wenn lastEvent = koloss)
- wave_now: der Gegner presst das ganze Spiel
Regeln: Reagiere auf die Lage (viel Budget → budget_cut, Siegesserie → koloss/shadow_it, viele Verletzte → eher wave_now). Wiederhole nicht lastEvent. Fair bleiben: nach zwei Niederlagen in Folge eher harmlose Störung.
JSON-Felder: "event" (eine der erlaubten), "message" (deine freche Nachricht an den Manager, max. 140 Zeichen, nimmt Bezug auf seine Saison).`;
  const r = await llm(PERSONA + (s.lang === 'en' ? EN_NOTE : ''), user, 250);
  if (!r || !EVENTS.includes(r.event)) return null;
  return { event: r.event, message: clean(r.message, 160) };
}

async function aiDebrief(b) {
  const user = `Erstelle eine kurze Nachbesprechung NACH der Saison. Diesmal sprichst du NICHT als Legacy-KI, sondern als freundliche:r RealCore-Berater:in, sachlich und sympathisch.
Ergebnis: ${b.won ? 'Meister' : 'Platz ' + (Number(b.duration) || '?')}; Punkte: ${Number(b.score) || 0}; Unternehmen: ${clean(b.company, 48) || 'nicht angegeben'}.
Saisonstatistik: ${JSON.stringify(b.stats || {}).slice(0, 400)}
Ziel: Brücke vom Spiel in die Realität schlagen („Im Spiel gelöst – wie sieht das bei euch aus?“): Kader = IT-Landschaft, Training = Enablement, Transfers = Modernisierung, Gegner = Altsysteme. Keine Versprechen zu Preisen, keine erfundenen Kundennamen oder Zahlen.
JSON-Felder: "headline" (max. 70 Zeichen), "text" (2–3 Sätze, max. 380 Zeichen), "questions" (genau 3 kurze Gesprächsfragen an den Kunden, je max. 90 Zeichen).`;
  const r = await llm(PERSONA + (b.lang === 'en' ? EN_NOTE : ''), user, 450);
  if (!r) return null;
  return { headline: clean(r.headline, 90), text: clean(r.text, 460), questions: Array.isArray(r.questions) ? r.questions.slice(0, 3).map(q => clean(q, 110)) : [] };
}

// ---------------- Bestenliste ----------------
function leaderboard({ mission = 'all', difficulty = 'all', period = 'all', limit = 20 }) {
  const where = ['hidden = 0']; const args = [];
  if (MISSIONS.includes(mission)) { where.push('mission = ?'); args.push(mission); }
  if (DIFFS.includes(difficulty)) { where.push('difficulty = ?'); args.push(difficulty); }
  if (period === 'today') { where.push('day = ?'); args.push(today()); }
  if (period === 'season') { const se = seasonOf(today()); where.push('day >= ? AND day < ?'); args.push(se.start, se.end); }
  const w = where.join(' AND ');
  const rows = db.prepare(`SELECT id, name, company, team, mission, difficulty, score, won, duration, created FROM scores WHERE ${w} ORDER BY score DESC, duration ASC LIMIT ?`).all(...args, Math.min(100, Number(limit) || 20));
  const benchmarkTop = db.prepare(`SELECT name, score, mission, difficulty FROM scores WHERE ${w} AND team = 1 ORDER BY score DESC LIMIT 1`).get(...args) || null;
  for (const r of rows) r.beat = !r.team && benchFor(r.mission, r.difficulty) !== null && r.score > benchFor(r.mission, r.difficulty).score;
  return { rows, benchmarkTop, season: seasonOf(today()) };
}
function benchFor(mission, difficulty) {
  return db.prepare('SELECT name, score FROM scores WHERE team = 1 AND hidden = 0 AND mission = ? AND difficulty = ? ORDER BY score DESC LIMIT 1').get(mission, difficulty) || null;
}

// Plausibilitätsprüfung des Punktestands
function maxScore(difficulty) {
  const mult = { messe: 0.8, profi: 1, gf: 1.5 }[difficulty] || 1;
  // Siege, Tore, Zu-null, Platz, Wochenziele (max. 400 je Spieltag), Restbudget (15 % von realistisch max. 6.000 T€)
  return Math.round((7 * 1000 + 45 * 120 + 7 * 300 + 3000 + 7 * 400 + 2500) * mult); // Wirtschaft: Budget, Vermögen, Fans (auf 7 Spieltage normiert)
}

// ---------------- HTTP ----------------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const rate = new Map();
function limited(ip, key, max, windowMs) {
  const k = ip + key, now = Date.now(); const arr = (rate.get(k) || []).filter(t => now - t < windowMs);
  if (arr.length >= max) return true; arr.push(now); rate.set(k, arr); return false;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of rate) if (!v.some(t => now - t < 3600000)) rate.delete(k); }, 600000).unref();

function send(res, code, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(code, { 'content-type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(isObj ? JSON.stringify(body) : body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 64 * 1024) { reject(new Error('zu groß')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}); } catch { reject(new Error('ungültiges JSON')); } });
    req.on('error', reject);
  });
}
function adminOk(req) {
  if (!ADMIN_PASSWORD) return false;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const [, pw] = Buffer.from(h.slice(6), 'base64').toString().split(':');
  const a = Buffer.from(pw || ''), b = Buffer.from(ADMIN_PASSWORD);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const SEC_HEADERS = {
  'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'x-frame-options': 'SAMEORIGIN',
  'content-security-policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; worker-src 'self'",
};

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/' || p === '/index.html') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) return send(res, 403, 'verboten');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      if (!path.extname(p)) return serveFile(res, path.join(PUBLIC, 'index.html'));
      return send(res, 404, 'nicht gefunden');
    }
    serveFile(res, file, false, req);
  });
}
function serveFile(res, file, admin = false, req = null) {
  const ext = path.extname(file);
  const sec = admin ? { ...SEC_HEADERS, 'content-security-policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:" } : SEC_HEADERS;
  const vendor = file.includes(`${path.sep}vendor${path.sep}`);
  // Seite, Skripte, Stile und Manifeste immer neu prüfen (ETag → 304), damit nach einem Update nie alte und neue Dateien gemischt werden.
  // Gebündelte Bibliothek und Sprachaufnahmen (Dateiname = Inhalt-Hash) dürfen dauerhaft im Cache bleiben.
  const hashed = vendor || (ext === '.mp3' && file.includes(`${path.sep}audio${path.sep}voice${path.sep}`));
  const cc = hashed ? 'public, max-age=31536000, immutable' : ['.html', '.js', '.css', '.json', '.webmanifest'].includes(ext) ? 'no-cache' : 'public, max-age=3600';
  let etag = null; try { const st = fs.statSync(file); etag = `W/"${st.size.toString(36)}-${Math.round(st.mtimeMs).toString(36)}"`; } catch { /* ignore */ }
  const headers = { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': cc, ...(etag ? { etag } : {}), ...sec };
  if (req && etag && req.headers['if-none-match'] === etag) { res.writeHead(304, { 'cache-control': cc, etag, vary: 'accept-encoding' }); res.end(); return; }
  // vorkomprimierte Variante (datei.gz) ausliefern, wenn der Browser gzip annimmt
  const gz = file + '.gz';
  if (req && /\bgzip\b/.test(req.headers['accept-encoding'] || '') && fs.existsSync(gz)) { res.writeHead(200, { ...headers, 'content-encoding': 'gzip', vary: 'accept-encoding' }); fs.createReadStream(gz).pipe(res); return; }
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  try {
    if (url.pathname === '/api/health') return send(res, 200, { ok: true });
    if (url.pathname === '/api/config') return send(res, 200, { ai: AI_PROVIDER !== 'none', provider: AI_PROVIDER === 'none' ? null : AI_PROVIDER });

    if (url.pathname === '/api/game/start' && req.method === 'POST') {
      if (limited(ip, 'start', 60, 3600000)) return send(res, 429, { error: 'Zu viele Spiele – kurz durchatmen.' });
      const b = await readBody(req);
      if (!MISSIONS.includes(b.mission) || !DIFFS.includes(b.difficulty)) return send(res, 400, { error: 'ungültig' });
      const id = crypto.randomUUID();
      const daily = null;
      db.prepare('INSERT INTO games (id, created, mission, difficulty, daily) VALUES (?, ?, ?, ?, ?)').run(id, Date.now(), b.mission, b.difficulty, daily);
      return send(res, 200, { gameId: id });
    }

    if (url.pathname === '/api/ai/briefing' && req.method === 'POST') {
      if (limited(ip, 'brief', 40, 3600000)) return send(res, 429, { error: 'Limit erreicht' });
      const b = await readBody(req);
      const r = await aiBriefing(b);
      return send(res, 200, r || {});
    }
    if (url.pathname === '/api/ai/director' && req.method === 'POST') {
      const b = await readBody(req);
      const g = db.prepare('SELECT * FROM games WHERE id = ?').get(String(b.gameId || ''));
      if (!g || g.used || g.ai_calls >= 40 || Date.now() - g.last_ai < 15000) return send(res, 200, {});
      db.prepare('UPDATE games SET ai_calls = ai_calls + 1, last_ai = ? WHERE id = ?').run(Date.now(), g.id);
      const r = await aiDirector({ ...(b.summary || {}), lang: b.lang });
      return send(res, 200, r || {});
    }
    if (url.pathname === '/api/ai/debrief' && req.method === 'POST') {
      if (limited(ip, 'debrief', 40, 3600000)) return send(res, 429, { error: 'Limit erreicht' });
      const b = await readBody(req);
      if (!MISSIONS.includes(b.mission)) return send(res, 400, { error: 'ungültig' });
      const r = await aiDebrief(b);
      return send(res, 200, r || {});
    }

    if (url.pathname === '/api/leaderboard') {
      const q = Object.fromEntries(url.searchParams);
      return send(res, 200, leaderboard(q));
    }

    if (url.pathname === '/api/scores' && req.method === 'POST') {
      if (limited(ip, 'score', 30, 3600000)) return send(res, 429, { error: 'Zu viele Einträge.' });
      const b = await readBody(req);
      const name = clean(b.name, 32);
      if (!name) return send(res, 400, { error: 'Name fehlt' });
      if (!MISSIONS.includes(b.mission) || !DIFFS.includes(b.difficulty)) return send(res, 400, { error: 'ungültig' });
      const g = db.prepare('SELECT * FROM games WHERE id = ?').get(String(b.gameId || ''));
      if (!g) return send(res, 400, { error: 'Unbekanntes Spiel' });
      if (g.used) return send(res, 409, { error: 'Ergebnis bereits gespeichert' });
      if (g.mission !== b.mission || g.difficulty !== b.difficulty) return send(res, 400, { error: 'Spiel passt nicht' });
      const duration = Math.max(0, Math.round(Number(b.duration) || 0));
      const elapsed = (Date.now() - g.created) / 1000;
      let score = Math.max(0, Math.round(Number(b.score) || 0));
      let flagged = 0;
      if (elapsed < 120 || score > maxScore(b.difficulty)) flagged = 1; // eine Saison dauert mindestens einige Minuten
      const team = TEAM_CODE && clean(b.teamCode, 32) && clean(b.teamCode, 32).toLowerCase() === TEAM_CODE.toLowerCase() ? 1 : 0;
      const token = crypto.randomBytes(16).toString('hex');
      db.prepare('UPDATE games SET used = 1 WHERE id = ?').run(g.id);
      const r = db.prepare('INSERT INTO scores (created, day, game_id, name, company, team, mission, difficulty, score, won, duration, stats, edit_token, hidden, daily) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(Date.now(), today(), g.id, name, clean(b.company, 48), team, b.mission, b.difficulty, score, b.won ? 1 : 0, duration, JSON.stringify(b.stats || {}).slice(0, 4000), token, flagged, g.daily || null);
      const id = Number(r.lastInsertRowid);
      const rank = db.prepare('SELECT COUNT(*) AS n FROM scores WHERE mission = ? AND difficulty = ? AND hidden = 0 AND (score > ? OR (score = ? AND id < ?))').get(b.mission, b.difficulty, score, score, id).n + 1;
      const total = db.prepare('SELECT COUNT(*) AS n FROM scores WHERE mission = ? AND difficulty = ? AND hidden = 0').get(b.mission, b.difficulty).n;
      const bench = team ? null : benchFor(b.mission, b.difficulty);
      let dailyRank = null;
      if (g.daily) { const dr = db.prepare('SELECT COUNT(*) AS n FROM scores WHERE daily = ? AND hidden = 0 AND (score > ? OR (score = ? AND id < ?))').get(g.daily, score, score, id).n + 1; const dt = db.prepare('SELECT COUNT(*) AS n FROM scores WHERE daily = ? AND hidden = 0').get(g.daily).n; dailyRank = flagged ? null : { rank: dr, total: dt }; }
      return send(res, 200, { id, editToken: token, rank: flagged ? '–' : rank, total, team: !!team, benchmark: bench, beat: !!(bench && score > bench.score && !flagged), daily: dailyRank });
    }

    if (url.pathname === '/api/scores/contact' && req.method === 'POST') {
      const b = await readBody(req);
      const email = clean(b.email, 120);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { error: 'Bitte eine gültige E-Mail angeben.' });
      if (!b.consent) return send(res, 400, { error: 'Bitte die Einwilligung bestätigen.' });
      const row = db.prepare('SELECT id, edit_token FROM scores WHERE id = ?').get(Number(b.id) || 0);
      if (!row || !b.token || row.edit_token !== String(b.token)) return send(res, 403, { error: 'Nicht erlaubt.' });
      db.prepare('UPDATE scores SET email = ?, consent = 1 WHERE id = ?').run(email, row.id);
      return send(res, 200, { ok: true });
    }

    // ---------------- Admin ----------------
    if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/admin')) {
      if (!adminOk(req)) return send(res, 401, ADMIN_PASSWORD ? 'Anmeldung erforderlich' : 'Admin deaktiviert (ADMIN_PASSWORD setzen)', { 'www-authenticate': 'Basic realm="Beat RealCore Admin", charset="UTF-8"' });
      if (url.pathname === '/api/admin/scores') {
        const day = url.searchParams.get('day');
        const rows = day ? db.prepare('SELECT * FROM scores WHERE day = ? ORDER BY score DESC').all(day) : db.prepare('SELECT * FROM scores ORDER BY created DESC LIMIT 2000').all();
        return send(res, 200, { rows: rows.map(({ edit_token, ...r }) => r), teamCodeSet: !!TEAM_CODE });
      }
      if (url.pathname === '/api/admin/scores.csv') {
        const rows = db.prepare('SELECT * FROM scores ORDER BY created DESC').all();
        const cols = ['id', 'day', 'name', 'company', 'email', 'consent', 'team', 'mission', 'difficulty', 'score', 'won', 'duration', 'voucher', 'hidden', 'note'];
        const csv = '﻿' + cols.join(';') + '\n' + rows.map(r => cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
        return send(res, 200, csv, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="legacy-league-${today()}.csv"` });
      }
      if (url.pathname === '/api/admin/update' && req.method === 'POST') {
        const b = await readBody(req);
        const id = Number(b.id) || 0;
        if (b.delete) db.prepare('DELETE FROM scores WHERE id = ?').run(id);
        else {
          if (b.voucher !== undefined) db.prepare('UPDATE scores SET voucher = ? WHERE id = ?').run(b.voucher ? 1 : 0, id);
          if (b.hidden !== undefined) db.prepare('UPDATE scores SET hidden = ? WHERE id = ?').run(b.hidden ? 1 : 0, id);
          if (b.team !== undefined) db.prepare('UPDATE scores SET team = ? WHERE id = ?').run(b.team ? 1 : 0, id);
          if (b.note !== undefined) db.prepare('UPDATE scores SET note = ? WHERE id = ?').run(clean(b.note, 200), id);
        }
        return send(res, 200, { ok: true });
      }
      return serveFile(res, path.join(__dirname, 'admin.html'), true);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Methode nicht erlaubt' });
    return serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'Serverfehler' });
  }
});

server.listen(PORT, () => console.log(`Legacy League läuft auf Port ${PORT} · KI: ${AI_PROVIDER}${AI_PROVIDER !== 'none' ? ' (' + AI_MODEL + ')' : ''} · Teamcode ${TEAM_CODE ? 'gesetzt' : 'fehlt'}`));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { server.close(); try { db.close(); } catch { /* ignore */ } process.exit(0); });
void SECRET;
