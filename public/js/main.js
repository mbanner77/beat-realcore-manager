// Beat RealCore – Legacy League: Oberfläche und Spielablauf
import { initI18n, tr, isEN, LANG, setLang } from './i18n.js';
import { INTENSITY, ATTR_NAMES, SEASON_LEN, STADIUM, FACILITIES, ECON, WEATHER, TALKS, OBJECTIVES, DIFFICULTY, FORMATIONS, STYLES, TEMPO, TRAINING, OPPONENTS, POS, POS_GROUP, EVENTS, CLUB, SEASON_SCORE, INSTR, ROLES, CORNER_VAR, LEGACY_LINES } from './data.js';
import { Season, rating, posFit, ATTRS, rng } from './manager.js';
import { Match, MATCH_REAL } from './match.js';
import { Pitch } from './pitch.js';
import { Pitch3D, loadBabylon, webglOk, prefetchModels } from './pitch3d.js';
import { playIntro } from './intro.js';
import { Voice } from './voice.js';
import { Confetti } from './fx.js';
import { playCeremony } from './ceremony.js';
import { crest, avatar, shirt, ring, icon, formChips, radar } from './ui.js';
import { FILLER as FILL, HALF, WEATHER_LINE, TALK_LINE, enTemplate } from './commentary.js';
import EN_DICT from './i18n-en.js';
import { Audio } from './audio.js';
import { ACH, achLoad, achUnlock, achAfterMatch, achAfterSeason } from './achievements.js';

const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
initI18n(); document.body.classList.add('on-title');
const voice = new Voice(LANG); window.__voice = voice; voice.getCtx = () => audio.ctx;
// Untertitel: jede gesprochene Ansage auch als Text (nicht im Intro – dort gibt es eigene Tafeln)
let subT = null;
voice.onLine = (text, ms) => { const el = document.getElementById('subtitle'); if (!el) return; clearTimeout(subT); if (!text || S.screen === 'intro') { el.classList.remove('on'); return; } el.textContent = text; el.classList.add('on'); subT = setTimeout(() => el.classList.remove('on'), (ms || 4000) + 400); };
$$('#lang-sw button').forEach(b => { b.classList.toggle('on', b.dataset.l === LANG); b.addEventListener('click', () => { if (b.dataset.l !== LANG) setLang(b.dataset.l); }); });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LOC = isEN ? 'en-US' : 'de-DE';
const fmt = (n) => Math.round(n).toLocaleString(LOC);
const money = (n) => `${fmt(n)} T€`;
const params = new URLSearchParams(location.search);
const KIOSK = params.has('messe') || params.has('kiosk'), TV = params.has('board');
if (KIOSK) { document.body.classList.add('messe'); try { if (!params.has('gfx')) localStorage.setItem('brcm-gfx', 'mid'); } catch { /* ignore */ } }
if (TV) document.body.classList.add('tv');
const audio = new Audio();
const S = { screen: 'title', prev: 'title', player: { name: '', company: '', team: '' }, diff: 'messe', season: null, gameId: null, config: { ai: false }, board: { difficulty: 'all', period: 'today' }, match: null, pitch: null, brief: null };
try { const p = JSON.parse(localStorage.getItem('brcm-player')); if (p && !KIOSK) S.player = { ...S.player, ...p }; } catch { /* ignore */ }
if (params.has('debug')) window.__S = S;

async function api(path, body, timeout = 8000) {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
  } finally { clearTimeout(tm); }
}
function show(id) {
  const changed = S.screen !== id; if (changed) S.prev = S.screen; S.screen = id;
  $$('.screen').forEach(s => { const on = s.id === 'screen-' + id; s.classList.toggle('active', on); if (on && changed) { s.classList.remove('enter'); void s.offsetWidth; s.classList.add('enter'); } });
  document.body.classList.toggle('ingame', id === 'match'); document.body.classList.toggle('on-title', id === 'title');
  if (id !== 'intro' && S.prev !== 'intro') { const w = $('#wipe'); w.classList.remove('go'); void w.offsetWidth; w.classList.add('go'); }
  if (id === 'match') sizePitch();
  if (id === 'title') { ensureBg3d(); renderHomeDynamic(); } else dropBg3d();
}
// Erfolg freigeschaltet: Karte oben rechts, nacheinander
const achQ = []; let achBusy = false;
function achShow(list) { if (!list || !list.length) return; achQ.push(...list); if (!achBusy) achNext(); }
function achNext() {
  const a = achQ.shift(), el = $('#ach-pop'); if (!a) { achBusy = false; return; } achBusy = true;
  el.innerHTML = `<span class="ach-ic">${icon(a.ic)}</span><div><small>Erfolg freigeschaltet</small><b>${esc(a.name)}</b><p>${esc(a.desc)}</p></div>`; el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); audio.play('confirm');
  setTimeout(() => { el.classList.remove('go'); setTimeout(() => { el.hidden = true; achNext(); }, 380); }, 3600);
}
let toastT = null;
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2600); }
$$('[data-go]').forEach(b => b.addEventListener('click', () => { audio.play('click'); const g = b.dataset.go; show(g === 'back' ? (S.prev === 'board' || S.prev === 'howto' || S.prev === 'privacy' ? 'title' : S.prev) : g); }));

// ---------------- Einstellungen ----------------
function openSettings() {
  const ov = $('#settings'); ov.hidden = false;
  const cv = $('#opt-voice'); if (cv) { cv.checked = voice.on; cv.onchange = () => { voice.setOn(cv.checked); $('#btn-voice').classList.toggle('off', !voice.on); audio.play('confirm'); if (cv.checked) voice.say(tr('Sprecher aktiv.'), { lang: LANG, prio: 3, interrupt: true }); }; }
  { const g0 = (() => { try { return localStorage.getItem('brcm-gfx') || 'auto'; } catch { return 'auto'; } })(); $$('#opt-gfx button').forEach(b => { b.classList.toggle('on', b.dataset.g === g0); b.onclick = () => { try { localStorage.setItem('brcm-gfx', b.dataset.g); } catch { /* ignore */ } $$('#opt-gfx button').forEach(x => x.classList.toggle('on', x === b)); if (pitch && pitch.dispose && S.screen !== 'match') { pitch.dispose(); pitch = null; } audio.play('confirm'); toast(tr('Grafik geändert – gilt ab dem nächsten Spiel.')); }; }); }
  { const m0 = lsGet('brcm-mode', 'real'); $$('#opt-mode button').forEach(b => { b.classList.toggle('on', b.dataset.m === m0); b.onclick = () => { lsSet('brcm-mode', b.dataset.m); $$('#opt-mode button').forEach(x => x.classList.toggle('on', x === b)); audio.play('confirm'); }; }); }
  { const cp = $('#opt-penui'); if (cp) { cp.checked = lsGet('brcm-penui', '1') !== '0'; cp.onchange = () => { lsSet('brcm-penui', cp.checked ? '1' : '0'); audio.play('confirm'); }; } }
  { const co = $('#opt-offside'); if (co) { co.checked = lsGet('brcm-offside', '1') !== '0'; co.onchange = () => { lsSet('brcm-offside', co.checked ? '1' : '0'); audio.play('confirm'); }; } }
  const c3 = $('#opt-3d'); if (c3) { c3.checked = want3d(); c3.onchange = () => { try { localStorage.setItem('brcm-3d', c3.checked ? '1' : '0'); } catch { /* ignore */ } if (pitch) { pitch.dispose?.(); pitch = null; } audio.play('confirm'); }; }
  for (const k of ['music', 'sfx']) { const el = $('#vol-' + k), v = Math.round(audio.vol[k] * 100); el.value = v; $('#vol-' + k + '-v').textContent = v + '%'; el.oninput = () => { $('#vol-' + k + '-v').textContent = el.value + '%'; audio.setVolume(k, el.value / 100); }; el.onchange = () => audio.play('confirm'); }
  const el = $('#set-lang'); el.innerHTML = [['de', 'Deutsch'], ['en', 'English']].map(([k, n]) => `<button class="${k === LANG ? 'on' : ''}" data-l="${k}">${n}</button>`).join(''); el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { if (b.dataset.l !== LANG) setLang(b.dataset.l); }));
}
$('#btn-settings').addEventListener('click', () => { audio.unlock(); audio.play('click'); openSettings(); });
$('#set-close').addEventListener('click', () => { $('#settings').hidden = true; });
$('#btn-sound').addEventListener('click', () => { audio.unlock(); const on = audio.toggle(); $('#btn-sound').textContent = on ? '🔊' : '🔇'; });

// ---------------- Hintergrund: Demo-Spiel ----------------
const bgPitch = new Pitch($('#bg')); let bgMatch = null;
function newBg() { const T = demoTeams(); bgMatch = new Match(T[0], T[1], { seed: Date.now() & 0xffff }); bgMatch.speed = 1.2; bgMatch.hooks.onHalf = () => { bgMatch.paused = false; }; }
function demoTeams() { const s = new Season({ difficulty: 'profi', seed: 42, hooks: {} }); s.day = Math.floor(Math.random() * OPPONENTS.length); return [s.teamForMatch(), s.opponentForMatch()]; }
function sizeBg() { bgPitch.resize(innerWidth, innerHeight); }
sizeBg(); newBg();

// ---------------- Titel ----------------
const NEWS = [
  ['Die Legacy League startet. TechHub United sucht noch eine:n Manager:in.', 'Lena Hoff · Sportdirektorin'],
  ['Der FC Datensilo hat vier Kapitäne – einen pro Abteilung. Sie reden nicht miteinander.', 'Sportschau · Vorbericht'],
  ['Beim Spaghetti Interface SV wurden 312 Pässe gezählt. Keiner kam an.', 'Statistik · Spieltag'],
  ['Der Mainframe-Koloss wurde zuletzt 1998 gewartet. Er trainiert trotzdem.', 'Scouting · Rechenzentrum'],
  ['Die Excel-Makro Kickers haben sich in Version 47_final_FINAL umbenannt.', 'Meldung · Controlling'],
  ['TechHub-Gutscheine für die besten Manager:innen – schlagt den RealCore-Benchmark.', 'TechHub · Messestand'],
];
let newsI = 0;
function rotateNews() { const [t, s] = NEWS[newsI++ % NEWS.length]; $('#title-news').innerHTML = `<p class="news-t">${esc(t)}</p><p class="news-s">— ${esc(s)}</p>`; }
setInterval(rotateNews, 7000);
const TICK = ['Spaghetti-Monster blockiert Mittelfeld', 'TechHub United meldet stabile Werte', 'Release-Freeze droht – Kapitän gesperrt?', 'Datensilo in der Abwehr entdeckt', 'Fiori-Flitzer sichern die Flügel', 'TechHub-Gutscheine für die besten Manager:innen', 'Schatten-IT im gegnerischen Sturm gemeldet', 'Go-Live in Sicht – wenn die Legacy-KI es zulässt'];
$('#ticker-in').innerHTML = (TICK.concat(TICK)).map(t => `<span>${esc(t)}</span>`).join('');
async function loadTitleBoard() {
  try {
    const d = await api('/api/leaderboard?period=today&limit=6');
    const el = $('#title-board');
    el.innerHTML = d.rows.length ? `<ul>${d.rows.map(r => `<li class="${r.team ? 'rc' : ''}"><span class="n">${esc(r.name)}${r.company ? `<small> · ${esc(r.company)}</small>` : ''}${r.team ? ' <small>RealCore</small>' : ''}</span><span class="s">${fmt(r.score)}</span></li>`).join('')}</ul>` : '<p class="empty">Noch keine Ergebnisse heute – seid die Ersten!</p>';
    el.insertAdjacentHTML('beforeend', d.benchmarkTop ? `<div class="bench">RealCore-Benchmark: <b>${fmt(d.benchmarkTop.score)}</b> (${esc(d.benchmarkTop.name)}). Schafft ihr mehr?</div>` : '<div class="bench">Das RealCore-Team hat heute noch keinen Benchmark gesetzt.</div>');
  } catch { $('#title-board').innerHTML = '<p class="empty">Bestenliste offline.</p>'; }
}
// ---------------- Startseite 2.0 ----------------
const FEATS = [
  ['ball', '3D-Spieltag', 'Stadion mit Flutlicht, Wetter, Torwiederholung in Zeitlupe und vier Kameraperspektiven.'],
  ['training', 'Training 2.0', 'Schwerpunkt, Intensität, Einzeltraining – und Eingespieltheit, die im Spiel zählt.'],
  ['money', 'Wirtschaft & Stadion', 'Eintrittspreise, Fan-Stimmung, Stadionausbau, Fanshop und VIP-Logen.'],
  ['press', 'Echter Kommentar', 'Deutsche und englische Sprecher – jede Ansage auch als Untertitel.'],
  ['market', 'Transfermarkt', 'Talente verpflichten, Stars verkaufen, Potenzial entwickeln.'],
  ['bolt', 'Die Legacy-KI', 'Ein Gegner, der stört: Release-Freeze, Schatten-IT und Ticketflut.'],
];
const STYLE_NAME = { silo: 'Ballhalten', chaos: 'Chaos-Fußball', swarm: 'Schwarm', wall: 'Abwehrbeton', press: 'Pressing', longshot: 'Weitschüsse', boss: 'Endgegner' };
function renderHomeStatic() {
  $('#feat-grid').innerHTML = FEATS.map(([ic, t, d], i) => `<div class="feat" style="--i:${i}"><span class="feat-ic">${icon(ic)}</span><b>${esc(t)}</b><p>${esc(d)}</p></div>`).join('');
  $('#club-rail').innerHTML = OPPONENTS.map((o, i) => `<div class="rclub" style="--c:${o.color};--i:${i}"><div class="club-top">${crest(o, 58)}<span class="club-n">${i + 1}</span></div><b>${esc(o.club)}</b><small>${esc(STYLE_NAME[o.style] || '')}</small><div class="club-str"><i style="width:${Math.round((o.strength - 50) / 35 * 100)}%"></i></div><p>${esc(o.teaser)}</p></div>`).join('');
}
// Persönliche Bilanz (nur auf diesem Gerät)
function loadStats() { try { return JSON.parse(localStorage.getItem('brcm-stats')) || null; } catch { return null; } }
function saveStats(r, se) {
  if (KIOSK) return; const st = loadStats() || { seasons: 0, titles: 0, best: 0, bestRank: 99, goals: 0, wins: 0 };
  st.seasons++; if (r.won) st.titles++; st.best = Math.max(st.best, r.score); st.bestRank = Math.min(st.bestRank, r.rank); st.goals += se.stats.goals; st.wins += se.stats.wins; st.last = { score: r.score, rank: r.rank, at: Date.now() };
  try { localStorage.setItem('brcm-stats', JSON.stringify(st)); } catch { /* ignore */ }
}
function renderHomeDynamic() {
  const st = loadStats(), nm = S.player.name;
  $('#me-card').innerHTML = `<div class="card-head"><span>${nm ? `Deine Bilanz · ${esc(nm)}` : 'Deine Bilanz'}</span></div>` + (st && st.seasons ? `<div class="me-grid"><div><b>${st.seasons}</b><small>Saisons</small></div><div><b>${st.titles}</b><small>Titel</small></div><div><b>${fmt(st.best)}</b><small>Rekord</small></div><div><b>${st.bestRank}.</b><small>Bester Platz</small></div></div>` : '<p class="me-empty">Noch keine Saison gespielt. Deine Rekorde erscheinen hier.</p>');
  const got = achLoad(KIOSK), nGot = ACH.filter(a => got[a.k]).length;
  $('#ach-count').textContent = `${nGot} / ${ACH.length}`;
  $('#ach-grid').innerHTML = ACH.map((a, i) => `<div class="ach ${got[a.k] ? 'on' : ''}" style="--i:${i}"><span class="ach-ic">${icon(got[a.k] ? a.ic : 'lock')}</span><div><b>${esc(a.name)}</b><p>${esc(a.desc)}</p></div></div>`).join('');
  if (nGot) $('#me-card .card-head').insertAdjacentHTML('beforeend', `<span class="tag">Erfolge ${nGot}/${ACH.length}</span>`);
  const sv = readSave(); $('#btn-continue').hidden = !sv;
  if (sv) { const d = sv.season, rk = d.day ? [...d.table].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf).findIndex(t => t.me) + 1 : 0; $('#continue-sub').textContent = `Spieltag ${d.day + 1} / ${d.len} · ${d.day ? `Platz ${rk} · ` : ''}${DIFFICULTY[d.diffKey]?.name || ''}`; }
  $('#btn-play').querySelector('small').textContent = sv ? 'Neue Saison – der alte Spielstand wird ersetzt' : 'Kurze oder volle Saison bis zum Finale gegen den Monolithen';
}
// Live-Matchcenter: zeigt das Demo-Spiel im Hintergrund
let lcT = 0, lcEv = -1;
function updateLiveCard(now) {
  if (!bgMatch || now - lcT < 250) return; lcT = now; const M = bgMatch, [A, B2] = M.teams;
  const h = $('#lc-home'); if (h.dataset.k !== A.short + B2.short) { h.dataset.k = A.short + B2.short; h.innerHTML = `${crest({ ...A, me: true }, 46)}<span>${esc(A.short)}</span>`; $('#lc-away').innerHTML = `${crest(B2, 46)}<span>${esc(B2.short)}</span>`; lcEv = -1; }
  $('#lc-res').textContent = `${M.score[0]} : ${M.score[1]}`; $('#lc-min').textContent = M.over ? 'Abpfiff' : `${Math.min(90, Math.floor(M.min))}'`;
  const pt = M.poss[0] + M.poss[1]; $('#lc-poss').style.width = (pt > 1 ? Math.round(100 * M.poss[0] / pt) : 50) + '%';
  const ev = [...M.events].reverse().find(e => e.text && e.type !== 'tick'); const n = M.events.length;
  if (ev && n !== lcEv) { lcEv = n; const el = $('#lc-ev'); el.textContent = `${Math.floor(ev.min ?? M.min)}' · ${ev.text}`; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); if (ev.type === 'goal') $('#live-card').classList.add('goal'), setTimeout(() => $('#live-card').classList.remove('goal'), 2400); }
}
// 3D-Stadion als Hintergrund der Startseite (lädt nach dem ersten Bild, fällt sonst auf 2D zurück)
let bg3 = null, bg3Busy = false, bg3T0 = 0;
async function ensureBg3d() {
  if (bg3 || bg3Busy || !want3d() || !webglOk() || params.has('no3d')) return; bg3Busy = true;
  await new Promise(r => setTimeout(r, document.readyState === 'complete' ? 300 : 1400));
  if (S.screen === 'title' && await loadBabylon() && S.screen === 'title') {
    try { const c = $('#bg3d'); bg3 = new Pitch3D(c, { hd: false, lite: true }); bg3.labels = false; bg3.noFaces = true; bg3.setDaylight?.(false); bg3.resize(innerWidth, innerHeight); bg3T0 = performance.now(); setTimeout(() => document.body.classList.add('bg3d-on'), 400); } catch (e) { console.warn('3D-Hintergrund nicht verfügbar', e); bg3 = null; }
  }
  bg3Busy = false;
}
function dropBg3d() { if (!bg3) return; document.body.classList.remove('bg3d-on'); const b = bg3; bg3 = null; b.dispose(); }
// Spielstand: wird in jeder Spielwoche automatisch gesichert
const SAVE_KEY = 'brcm-save';
function writeSave() {
  const se = S.season; if (KIOSK || S.mini || !se || se.over) return;
  const { hooks, r, ...data } = se;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, at: Date.now(), gameId: S.gameId, player: S.player, diff: S.diff, len: S.len, season: data })); } catch { /* ignore */ }
}
function readSave() { if (KIOSK) return null; try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); if (!d || d.v !== 1 || !d.season || Date.now() - d.at > 21 * 864e5) return null; return d; } catch { return null; } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }
function resumeSeason() {
  const d = readSave(); if (!d) return; audio.unlock(); audio.play('confirm');
  const se = Object.assign(Object.create(Season.prototype), d.season); se.hooks = seasonHooks(); se.r = rng(Date.now() & 0xffffffff);
  S.season = se; S.gameId = d.gameId; S.player = { ...S.player, ...d.player }; S.diff = se.diffKey; S.len = se.lenKey;
  S.radioUnread = 0; S.tab = 'home'; S.selSlot = null; S.ceremonyDone = false; S.weekSpoken = null; S.decisionDay = se.decision && !se.decision.chosen ? null : se.day;
  if (want3d() && webglOk()) loadBabylon();
  renderWeek(); show('week'); toast(`Willkommen zurück! Spieltag ${se.day + 1} wartet.`);
}
$('#btn-continue').addEventListener('click', resumeSeason);
$('#btn-play2').addEventListener('click', () => $('#btn-play').click());
$('#btn-home-board').addEventListener('click', () => $('#btn-board').click());
$('#scroll-hint').addEventListener('click', (e) => { e.preventDefault(); $('#home-features').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
$('#screen-title').addEventListener('scroll', () => { const y = $('#screen-title').scrollTop; $('#scroll-hint').classList.toggle('gone', y > 40); document.body.classList.toggle('title-scrolled', y > 60); S.heroVis = y < $('.home-hero').offsetHeight - 40; }, { passive: true });
S.heroVis = true;
renderHomeStatic();
{ const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); } }), { root: $('#screen-title'), threshold: 0.12 }) : null; $$('.home-sec').forEach(el => io ? io.observe(el) : el.classList.add('seen')); }
setTimeout(() => { renderHomeDynamic(); ensureBg3d(); }, 0);
async function loadConfig() { try { S.config = await api('/api/config'); } catch { S.config = { ai: false }; } }
$('#btn-play').addEventListener('click', () => { audio.unlock(); audio.play('click'); showSetup(); });
$('#btn-intro').addEventListener('click', () => { audio.unlock(); audio.play('click'); startIntro(() => show('title')); });
function startIntro(next) {
  try { localStorage.setItem('brcm-intro', '1'); } catch { /* ignore */ }
  const cap = $('#intro-cap'), ttl = $('#intro-title'); cap.hidden = true; ttl.hidden = true; ttl.className = 'intro-title';
  show('intro');
  playIntro({ canvas: $('#intro-canvas'), captionEl: cap, titleEl: ttl, skipBtn: $('#btn-intro-skip'), audio, voice, tr, lang: LANG, onDone: () => { if (S.screen === 'intro') next(); } });
}
$('#btn-board').addEventListener('click', () => { audio.unlock(); audio.play('click'); showBoard(); });
$('#btn-howto').addEventListener('click', () => { audio.unlock(); audio.play('click'); show('howto'); });
$('#link-privacy').addEventListener('click', (e) => { e.preventDefault(); show('privacy'); });
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.screen === 'intro') { $('#btn-intro-skip').click(); return; }
  if (S.screen !== 'title' || e.target.tagName === 'INPUT') return;
  const m = { w: '#btn-continue', Enter: '#btn-play', b: '#btn-board', '?': '#btn-howto', o: '#btn-settings', i: '#btn-intro', t: '#btn-daily', d: '#btn-duel', p: '#btn-cup' }[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (m && !$(m).hidden) { e.preventDefault(); $(m).click(); }
});

// ---------------- Setup ----------------
function threat(i) { return `<span class="thr">${[1, 2, 3].map(j => `<i class="${j <= i + 1 ? 'on' : ''}"></i>`).join('')}</span>`; }
function showSetup() {
  $('#in-name').value = S.player.name; $('#in-company').value = S.player.company; $('#in-team').value = S.player.team || '';
  renderSetupCards(); show('setup');
}
function renderSetupCards() {
  $('#diff-cards').innerHTML = Object.entries(DIFFICULTY).map(([k, d], i) => `<button class="dcard ${k === S.diff ? 'on' : ''}" data-d="${k}"><b>${esc(d.name)}</b><small>${esc(d.desc)} Budget ${money(d.budget)}, Punkte × ${d.mult}.</small>${threat(i)}</button>`).join('');
  $$('#diff-cards .dcard').forEach(b => b.addEventListener('click', () => { S.diff = b.dataset.d; audio.play('click'); renderSetupCards(); }));
  S.len = S.len || (KIOSK ? 'expo' : 'short');
  $('#len-cards').innerHTML = Object.entries(SEASON_LEN).map(([k, d]) => `<button class="dcard ${k === S.len ? 'on' : ''}" data-l="${k}"><b>${esc(d.name)}</b><small>${esc(d.desc)}</small></button>`).join('');
  $$('#len-cards .dcard').forEach(b => b.addEventListener('click', () => { S.len = b.dataset.l; audio.play('click'); renderSetupCards(); }));
  $('#season-list').innerHTML = (S.len === 'expo' ? [0, 3, 6].map(i => OPPONENTS[i]) : OPPONENTS).map((o, i) => `<li><b>${esc(o.club)}</b> · ${i % 2 === 0 ? 'Heim' : 'Auswärts'}${S.len === 'long' ? ` / ${i % 2 === 0 ? 'Auswärts' : 'Heim'}` : ''}</li>`).join('');
}
$('#btn-brief').addEventListener('click', async () => {
  const name = $('#in-name').value.trim();
  if (!name) { $('#setup-err').textContent = 'Bitte einen Namen eingeben.'; $('#in-name').focus(); return; }
  $('#setup-err').textContent = '';
  S.player = { name, company: $('#in-company').value.trim(), team: $('#in-team').value.trim() };
  if (!KIOSK) try { localStorage.setItem('brcm-player', JSON.stringify(S.player)); } catch { /* ignore */ }
  audio.unlock(); audio.play('click');
  startBriefing();
});

// ---------------- Briefing ----------------
const SPK = { hub: { n: 'Lena Hoff', t: 'Sportdirektorin · TechHub United', av: '🧑‍💼' }, legacy: { n: 'LEGACY-KI', t: 'Trainer · Legacy-Monolith FC · seit 1998', av: '🖥️' }, narr: { n: 'Sportschau', t: 'Pressekonferenz', av: '🎙️' } };
function talkLine(who, text) { const P = SPK[who]; return `<div class="tl ${who}"><div class="av">${P.av}</div><div><b>${esc(P.n)}</b><small>${esc(P.t)}</small><p>${esc(text)}</p></div></div>`; }
async function startBriefing() {
  show('brief'); $('#btn-start').disabled = true;
  const co = S.player.company ? ` bei ${S.player.company}` : '';
  const lines = [['narr', `Pressekonferenz in der Clean-Core-Arena: ${S.player.name} übernimmt TechHub United${co}. ${S.len === 'long' ? 'Vierzehn Spieltage in Hin- und Rückrunde, sieben Legacy-Clubs, ein Ziel: die Legacy League.' : 'Sieben Spieltage, sieben Legacy-Clubs, ein Ziel: die Legacy League.'}`],
    ['hub', `Willkommen im Verein, ${S.player.name}! Ich bin Lena Hoff, deine Sportdirektorin. Der Kader steht, das Budget auch – ${money(DIFFICULTY[S.diff].budget)}. Erster Gegner: der FC Datensilo.`],
    ['legacy', 'Ich laufe seit 1998. Ohne Doku, ohne Tests, ohne Niederlage. Ihr wollt Meister werden? Versucht es.']];
  S.brief = null;
  if (S.config.ai) { try { const b = await api('/api/ai/briefing', { lang: LANG, name: S.player.name, company: S.player.company, difficulty: S.diff }, 9000); if (b && b.text) { S.brief = b; lines[0][1] = b.text; if (b.taunt) lines[2][1] = b.taunt; } } catch { /* lokal */ } }
  const el = $('#brief-talk'); el.innerHTML = '';
  for (let i = 0; i < lines.length; i++) { await new Promise(r => setTimeout(r, i ? 900 : 200)); if (S.screen !== 'brief') return; el.insertAdjacentHTML('beforeend', talkLine(...lines[i])); audio.play(lines[i][0] === 'legacy' ? 'legacy' : 'type'); if (i > 0) voice.say(tr(lines[i][1]), { lang: LANG, prio: 2, pitch: lines[i][0] === 'legacy' ? 0.75 : 1 }); }
  $('#btn-start').disabled = false;
}
$('#btn-start').addEventListener('click', () => { audio.play('confirm'); newSeason(); });

// ---------------- Saison ----------------
async function newSeason() {
  S.gameId = null;
  try { const r = await api('/api/game/start', { mission: 'league', difficulty: S.diff }, 4000); S.gameId = r.gameId; } catch { S.gameId = null; }
  S.radioUnread = 0;
  S.season = new Season({ difficulty: S.diff, length: S.len || 'short', hooks: seasonHooks() });
  S.tab = 'home'; S.selSlot = null; S.ceremonyDone = false;
  if (want3d() && webglOk()) loadBabylon();
  renderWeek(); show('week');
}
function seasonHooks() {
  return {
    onMessage: (m) => { S.radioUnread++; if (S.season) { renderRadio(); updateDots(); } },
    onEvent: (ev) => { if (ev.type === 'director') { audio.play('legacy'); toast(`${EVENTS[ev.event].name}: ${ev.detail}`); const last = [...S.season.log].reverse().find(m => m.who === 'legacy'); if (last) voice.say(tr(last.text), { lang: LANG, prio: 2, pitch: 0.75 }); renderWeek(); } },
    onEnd: (r) => endSeason(r),
    onDecision: (d, note) => { $('#dec-note').textContent = note; },
    director: S.config.ai && S.gameId ? (summary) => api('/api/ai/director', { gameId: S.gameId, summary, lang: LANG }, 5500).then(d => d && d.event ? d : null) : null,
  };
}
const SE = () => S.season;
function teamStrength() { const T = SE().teamForMatch(); return Math.round(T.players.reduce((s, p) => s + rating(p, p.pos), 0) / Math.max(1, T.players.length)); }
function updateDots() { $('#dot-training').classList.toggle('on', !SE().trained); $('#dot-radio').classList.toggle('on', S.radioUnread > 0 && S.tab !== 'radio'); }
function renderWeek() {
  const se = SE(); if (!se || se.over) return; const o = se.opponent;
  $('#wh-day').textContent = `Spieltag ${se.day + 1} / ${se.len}` + ((se.seasonNo || 1) > 1 || se.league === 'cloud' ? ` · Saison ${se.seasonNo || 1}${se.league === 'cloud' ? ' · Cloud League' : ''}` : ''); $('#wh-opp').textContent = `vs. ${o.club}`;
  $('#wh-where').textContent = se.home ? `Heimspiel · ${CLUB.stadium}` : `Auswärtsspiel · ${o.club}`;
  $('#wh-budget').textContent = money(se.budget); $('#wh-rank').textContent = se.day ? `${se.rank()}. (${se.table[0].pts} Pkt)` : '–';
  $('#wh-str').textContent = teamStrength(); const mor = Math.round(se.players.reduce((s, p) => s + p.morale, 0) / se.players.length); $('#wh-morale').textContent = mor >= 75 ? '😄 ' + mor : mor >= 55 ? '🙂 ' + mor : '😟 ' + mor;
  const ob = se.objective ? OBJECTIVES[se.objective] : null; $('#wh-obj').textContent = ob ? `🎯 Wochenziel: ${ob.name} (+${ob.bonus})` : '';
  if (S.weekSpoken !== se.day) { S.weekSpoken = se.day; voice.say(tr(o.lena), { lang: LANG, prio: 1, interrupt: true }); }
  const dec = se.decision && !se.decision.chosen; $('#btn-decision').hidden = !dec;
  if (dec && S.decisionDay !== se.day) { S.decisionDay = se.day; openDecision(); }
  $$('#week-nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab)); $$('.wtab').forEach(t => t.classList.toggle('on', t.id === 'tab-' + S.tab));
  renderHome(); renderSquad(); renderTactics(); renderTraining(); renderMarket(); renderFinance(); renderTable(); renderRadio(); updateDots();
  writeSave();
  const prob = se.lineupProblems(); $('#btn-match').disabled = prob.some(p => /unbesetzt|verletzt|gesperrt/.test(p));
}
$('#sq-sort').addEventListener('change', (e) => { S.sqSort = e.target.value; audio.play('click'); renderWeek(); });
$$('#sq-filter button').forEach(b => b.addEventListener('click', () => { S.sqFilter = b.dataset.f; audio.play('click'); renderWeek(); }));
$$('#week-nav button[data-ico]').forEach(b => b.insertAdjacentHTML('afterbegin', icon(b.dataset.ico)));
$$('#week-nav button').forEach(b => b.addEventListener('click', () => { audio.play('click'); if (b.dataset.tab === 'quit') { if (confirm(tr('Saison wirklich abbrechen? Der Spielstand geht verloren.'))) { S.season = null; clearSave(); show('title'); } return; } S.tab = b.dataset.tab; if (S.tab === 'radio') S.radioUnread = 0; renderWeek(); }));

// Gegneranalyse: Mannschaftsteile im Vergleich und Tipp passend zur Spielweise des Gegners
const COUNTER = {
  silo: 'Früh pressen und das Tempo hochhalten – das Silo gibt den Ball sonst nicht mehr her.',
  chaos: 'Ruhe bewahren: Clean Core und kompakte Abstände bestrafen das Chaos.',
  swarm: 'Über die Flügel spielen – der Schwarm zieht sich in der Mitte zusammen.',
  wall: 'Geduld und Weitschüsse: Gegen den Abwehrbeton hilft eine offensive Formation.',
  press: 'Schnell und direkt spielen – wer das Pressing überspielt, hat freie Bahn.',
  longshot: 'Defensive Mittelfeldspieler:innen stellen die Schusswege zu.',
  boss: 'Alles aufbieten: beste Elf, hohe Eingespieltheit, volle Fitness.',
};
function lineStr(T) { const g = { def: [], mid: [], att: [] }; for (const p of T.players) { const k = POS_GROUP[p.pos]; if (g[k]) g[k].push(rating(p, p.pos)); } const av = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0; return { def: av(g.def), mid: av(g.mid), att: av(g.att) }; }
function scoutHtml(se) {
  let A, B; try { A = lineStr(se.teamForMatch()); B = lineStr(se.opponentForMatch()); } catch { return ''; }
  const row = (k, n) => { const a = A[k], b = B[k], d = a - b; return `<div class="sc-row"><b class="${d >= 0 ? 'up' : 'down'}">${a}</b><span><i class="me" style="width:${a}%"></i></span><em>${n}</em><span class="r"><i style="width:${b}%"></i></span><b>${b}</b></div>`; };
  return `<div class="scout"><div class="sc-head"><span>Gegneranalyse</span><small>Wir · Mannschaftsteil · Gegner</small></div>${row('def', 'Abwehr')}${row('mid', 'Mittelfeld')}${row('att', 'Angriff')}<p class="sc-tip">${icon('target')} ${esc(COUNTER[se.opponent.style] || '')}</p></div>`;
}
function miniTable(se) {
  const T = [...se.table].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf), me = T.findIndex(t => t.me);
  const rows = T.map((t, i) => [t, i]).filter(([, i]) => i < 4 || i === me);
  return `<ol class="mini-t">${rows.map(([t, i]) => `<li class="${t.me ? 'me' : ''}"><em>${i + 1}</em>${crest(t.me ? { ...CLUB, me: true } : OPPONENTS.find(o => o.id === t.id) || t, 22)}<span>${esc(t.short || t.club)}</span><small>${t.gf}:${t.ga}</small><b>${t.pts}</b></li>`).join('')}</ol>`;
}
function fixtures(se) {
  const n = OPPONENTS.length, out = [];
  for (let d = se.day + 1; d < se.len && out.length < 4; d++) { const o = OPPONENTS[d % n], home = d % 2 === 0; out.push(`<li>${crest(o, 26)}<span><b>${esc(o.club)}</b><small>Spieltag ${d + 1} · ${home ? 'Heim' : 'Auswärts'}</small></span><i class="bar"><b style="width:${Math.round((o.strength - 50) / 35 * 100)}%"></b></i></li>`); }
  return out.length ? `<ul class="fix">${out.join('')}</ul>` : '<p>Das ist der letzte Spieltag – jetzt zählt alles.</p>';
}
// Übersicht
function renderHome() {
  const se = SE(), o = se.opponent, me = { ...CLUB, me: true }, str = teamStrength();
  const ob = se.objective ? OBJECTIVES[se.objective] : null, d = se.decision, ev = se.pendingEvent ? EVENTS[se.pendingEvent.event] : null;
  const form = [...se.players].filter(p => se.available(p)).sort((a, b) => (b.form * 4 + rating(b)) - (a.form * 4 + rating(a))).slice(0, 3);
  const inj = se.players.filter(p => p.injured > 0 || p.suspended > 0);
  const last = se.log.slice(-3).reverse();
  const bar = (v, max) => `<i class="bar"><b style="width:${Math.round(v / max * 100)}%"></b></i>`;
  $('#home-grid').innerHTML = `
    <div class="hcard hero">
      <div class="hero-top"><span class="tag">${icon('whistle')} Spieltag ${se.day + 1} / ${se.len}</span><span class="tag ${se.home ? 'home' : 'away'}">${se.home ? 'Heimspiel' : 'Auswärtsspiel'} · ${se.home ? 'Tag' : 'Flutlicht'} · ${WEATHER[se.weather].icon} ${esc(WEATHER[se.weather].name)}</span></div>
      <div class="hero-vs">
        <div class="club">${crest(me, 72)}<b>${esc(CLUB.name)}</b><small>${se.day ? se.rank() + '. Platz · ' + se.table[0].pts + ' Pkt' : 'Saisonstart'}</small><div class="str"><span>Stärke ${str}</span>${bar(str, 99)}</div></div>
        <div class="vs">VS</div>
        <div class="club">${crest(o, 72)}<b>${esc(o.club)}</b><small>${esc(STYLES[o.style === 'press' ? 'agile' : o.style === 'wall' ? 'clean' : 'agile'].name)} · ${esc(o.names[0])}</small><div class="str"><span>Stärke ${o.strength + (se.oppMod || 0)}</span>${bar(o.strength + (se.oppMod || 0), 99)}</div></div>
      </div>
      <p class="hero-teaser">${esc(o.teaser)}</p>
      ${scoutHtml(se)}
      <div class="tipp">${icon('star')} <span>${esc(o.lena)}</span></div>
      ${se.weather !== 'sun' ? `<div class="tipp wx"><b>${WEATHER[se.weather].icon}</b> <span>${esc(WEATHER[se.weather].desc)}</span></div>` : ''}
      <div class="hero-actions"><button class="btn" data-go="tactics">${icon('tactics')} Taktik prüfen</button><button class="btn" data-go="squad">${icon('squad')} Aufstellung</button><button class="btn primary" id="btn-match2">Zum Spiel ›</button></div>
    </div>
    <div class="hcard obj"><div class="hc-head">${icon('target')} Wochenziel</div>${ob ? `<b>${esc(ob.name)}</b><p>${esc(ob.desc)}</p><span class="bonus">+${ob.bonus} Punkte</span>` : '<p>–</p>'}</div>
    <div class="hcard dec ${d && !d.chosen ? 'open' : ''}"><div class="hc-head">${icon('board')} Vorstand</div>${d ? `<b>${esc(d.title)}</b><p>${esc(d.text)}</p>${d.chosen ? `<span class="done">✓ ${esc(d.options.find(x => x.key === d.chosen)?.label || '')}</span>` : `<div class="dec-mini">${d.options.map(x => `<button class="btn sm" data-dec="${x.key}" title="${esc(x.effect)}">${esc(x.label)}</button>`).join('')}</div>`}` : '<p>Der Vorstand meldet sich ab dem zweiten Spieltag.</p>'}</div>
    <div class="hcard ev ${ev ? 'on' : ''}"><div class="hc-head">${icon('bolt')} Legacy-KI</div>${ev ? `<b>${esc(ev.name)}</b><p>${esc(ev.desc)}</p>` : '<p>Diese Woche keine Störung gemeldet – noch nicht.</p>'}</div>
    <div class="hcard form"><div class="hc-head">${icon('up')} Form</div><div class="chips">${formChips(se.results)}</div><div class="top3">${form.map(p => `<div class="tp">${avatar(p, CLUB, 40)}<span><b>${esc(p.name.split(' ')[0])}</b><small>${esc(POS[p.pos])} · Form ${p.form > 0 ? '+' + p.form : p.form}</small></span><em>${rating(p)}</em></div>`).join('')}</div>${inj.length ? `<p class="inj">${icon('injury')} ${inj.map(p => esc(p.name) + (p.injured > 0 ? ' (verletzt)' : ' (gesperrt)')).join(', ')}</p>` : ''}</div>
    <div class="hcard kpis"><div class="hc-head">${icon('money')} Verein</div><div class="kgrid"><div><small>Budget</small><b>${money(se.budget)}</b></div><div><small>Training</small><b>${se.trained ? esc(TRAINING[se.trained].name) : '<span class="warn">offen</span>'}</b></div><div><small>Kader</small><b>${se.players.length} · Ø ${Math.round(se.players.reduce((a, p) => a + p.age, 0) / se.players.length)} J.</b></div><div><small>Stimmung</small><b>${Math.round(se.players.reduce((a, p) => a + p.morale, 0) / se.players.length)}</b></div><div><small>Eingespieltheit</small><b>${se.cohesion()}</b></div><div><small>Fans</small><b>${Math.round(se.econ.fans)}</b></div><div><small>${se.home ? 'Erwartete Zuschauer' : 'Stadion'}</small><b>${se.home ? se.forecast().att.toLocaleString('de-DE') : se.capacity.toLocaleString('de-DE') + ' Plätze'}</b></div></div></div>
    <div class="hcard mtab"><div class="hc-head">${icon('table')} Tabelle</div>${miniTable(se)}<button class="btn sm ghost" data-go="table">Ganze Tabelle →</button></div>
    <div class="hcard press"><div class="hc-head">${icon('press')} Presse</div>${last.map(m => `<div class="pm ${m.who}"><b>${esc((SPK[m.who] || SPK.hub).n)}</b><p>${esc(m.text)}</p></div>`).join('') || '<p>–</p>'}</div>
    <div class="hcard prog"><div class="hc-head">${icon('clock')} Restprogramm</div>${fixtures(se)}</div>`;
  $$('#home-grid [data-go]').forEach(b => b.addEventListener('click', () => { S.tab = b.dataset.go; audio.play('click'); renderWeek(); }));
  $$('#home-grid [data-dec]').forEach(b => b.addEventListener('click', () => { if (se.decide(b.dataset.dec)) { audio.play('confirm'); toast($('#dec-note').textContent || ''); } renderWeek(); }));
  const bm = $('#btn-match2'); if (bm) { bm.disabled = $('#btn-match').disabled; bm.addEventListener('click', () => $('#btn-match').click()); }
}
// Vorstandsentscheidung
function openDecision() {
  const se = SE(), d = se.decision; if (!d) return;
  $('#dec-title').textContent = d.title; $('#dec-day').textContent = `Spieltag ${se.day + 1}`; $('#dec-text').textContent = d.text; $('#dec-note').textContent = '';
  $('#dec-opts').innerHTML = d.options.map(o => `<button class="dopt ${d.chosen === o.key ? 'on' : ''}" data-k="${o.key}" ${d.chosen ? 'disabled' : ''}><b>${esc(o.label)}</b><small>${esc(o.effect)}</small></button>`).join('');
  $$('#dec-opts .dopt').forEach(b => b.addEventListener('click', () => { if (se.decide(b.dataset.k)) { audio.play('confirm'); $$('#dec-opts .dopt').forEach(x => { x.disabled = true; x.classList.toggle('on', x === b); }); $('#btn-dec-later').hidden = true; $('#btn-dec-close').hidden = false; } }));
  $('#btn-dec-later').hidden = !!d.chosen; $('#btn-dec-close').hidden = !d.chosen;
  $('#decision').hidden = false;
}
$('#btn-dec-later').addEventListener('click', () => { audio.play('click'); $('#decision').hidden = true; });
$('#btn-dec-close').addEventListener('click', () => { audio.play('click'); $('#decision').hidden = true; renderWeek(); });
$('#btn-decision').addEventListener('click', () => { audio.play('click'); openDecision(); });

// Spielerprofil
function openPlayer(id) {
  const se = SE(), p = se.players.find(x => x.id === id); if (!p) return;
  const inL = se.slots.includes(p.id), st = p.start || p, delta = ATTRS.map(a => Math.round(p[a]) - Math.round(st[a] ?? p[a]));
  $('#pm-title').textContent = p.name;
  $('#pm-body').innerHTML = `<div class="pm-top">${avatar(p, CLUB, 84)}<div><b>${esc(p.name)}</b><small><span>${esc(p.nick || '')}</span> · <span>${esc(POS[p.pos])}</span> · <span>${p.age} ${isEN ? "yrs" : "J."}</span></small><span class="stars">${'★'.repeat(p.pot || 3)}<i>${'★'.repeat(5 - (p.pot || 3))}</i></span><div class="pm-tags">${p.id === se.captain ? '<i class="cap">Kapitän</i>' : ''}${p.id === se.penTaker ? '<i class="pen">Elfmeter</i>' : ''}${p.id === se.cornerTaker ? '<i class="pen">Ecken</i>' : ''}${p.id === se.fkTaker ? '<i class="pen">Freistöße</i>' : ''}${inL ? '<i>Startelf</i>' : ''}${p.injured > 0 ? `<i class="down">verletzt (${p.injured})</i>` : ''}${p.suspended > 0 ? '<i class="down">gesperrt</i>' : ''}</div></div>${ring(rating(p), 64)}</div>
    <div class="pm-grid"><div>${radar(ATTRS.map(a => p[a]), ATTRS.map(a => st[a] ?? p[a]), ATTRS.map(a => tr(ATTR_NAMES[a]).slice(0, 3).toUpperCase()))}<p class="hint">Gestrichelt: Werte zum Saisonstart.</p></div>
    <div><div class="pm-attrs">${ATTRS.map((a, i) => `<div><span>${esc(ATTR_NAMES[a])}</span><i class="bar"><b style="width:${p[a]}%"></b></i><b>${Math.round(p[a])}</b>${delta[i] ? `<em class="${delta[i] > 0 ? 'up' : 'down'}">${delta[i] > 0 ? '▲' : '▼'}${Math.abs(delta[i])}</em>` : '<em></em>'}</div>`).join('')}</div>
    <div class="kgrid pm-k"><div><small>Spiele</small><b>${p.apps}</b></div><div><small>Tore / Vorlagen</small><b>${p.goals} / ${p.assists}</b></div><div><small>Fitness</small><b>${Math.round(p.fitness)} %</b></div><div><small>Stimmung</small><b>${Math.round(p.morale)}</b></div><div><small>Form</small><b>${p.form > 0 ? '+' + p.form : p.form}</b></div><div><small>Marktwert</small><b>${money(p.value)}</b></div></div></div></div>
    <p class="pm-desc">${esc(p.desc || '')}</p>
    <div class="pm-actions">${inL && p.pos !== 'TW' && p.id !== se.captain ? '<button class="btn sm" data-pa="cap">Zum Kapitän</button>' : ''}${inL && p.pos !== 'TW' && p.id !== se.penTaker ? '<button class="btn sm" data-pa="pen">Elfmeterschütze</button>' : ''}${inL && p.pos !== 'TW' && p.id !== se.cornerTaker ? '<button class="btn sm" data-pa="corner">Eckenschütze</button>' : ''}${inL && p.pos !== 'TW' && p.id !== se.fkTaker ? '<button class="btn sm" data-pa="fk">Freistoßschütze</button>' : ''}${!se.trained || se.extraTraining ? '<button class="btn sm" data-pa="train">Einzeltraining planen</button>' : ''}${se.players.length > 14 ? `<button class="btn sm" data-pa="sell">Verkaufen · ${money(se.salePrice(p))}</button>` : ''}</div>`;
  $$('#pm-body [data-pa]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.pa; audio.play('click');
    if (k === 'cap') { se.setCaptain(p.id); toast(`${p.name} trägt die Kapitänsbinde.`); }
    else if (k === 'pen') se.setPenTaker(p.id);
    else if (k === 'corner') se.setCornerTaker(p.id);
    else if (k === 'fk') se.setFkTaker(p.id);
    else if (k === 'train') { renderTraining(); const P = S.tplan, slot = P.individual.find(x => !x.id) || P.individual[1]; slot.id = p.id; const weak = [...ATTRS].sort((a, c) => p[a] - p[c]).find(a => a !== 'kondition' || p.pos === 'TW') || 'technik'; slot.attr = p.pos === 'ST' ? 'schuss' : p.pos === 'TW' || p.pos === 'IV' ? 'abwehr' : weak; $('#pmodal').hidden = true; S.tab = 'training'; renderWeek(); return; }
    else if (k === 'sell') { if (!confirm(tr(`${p.name} für ${money(se.salePrice(p))} verkaufen?`))) return; const r = se.sell(p.id); if (r.ok) { audio.play('cash'); $('#pmodal').hidden = true; renderWeek(); return; } toast(r.reason); }
    renderWeek(); openPlayer(p.id);
  }));
  $('#pmodal').hidden = false;
}
$('#btn-pm-close').addEventListener('click', () => { $('#pmodal').hidden = true; audio.play('click'); });
// Kader & Aufstellung
function attrsHtml(p) { const C = { tempo: '#38e1ff', technik: '#3ddc84', abwehr: '#ffc247', schuss: '#ff6a3d', kondition: '#b87cff' }; return `<div class="attrs">${ATTRS.map(a => `<i style="--v:${p[a]}%;--c:${C[a]}" title="${tr({ tempo: 'Tempo', technik: 'Technik', abwehr: 'Abwehr', schuss: 'Schuss', kondition: 'Kondition' }[a])} ${Math.round(p[a])}"><span>${{ tempo: 'TE', technik: 'TC', abwehr: 'AB', schuss: 'SC', kondition: 'KO' }[a]}</span></i>`).join('')}</div>`; }
function statusOf(p) { return p.injured > 0 ? ['inj', `verletzt (${p.injured})`] : p.suspended > 0 ? ['ban', 'gesperrt'] : p.fitness < 60 ? ['tired', 'müde'] : ['ok', 'fit']; }
function renderSquad() {
  const se = SE(), F = FORMATIONS[se.formation];
  $('#lineup-form').textContent = F.name; $('#squad-n').textContent = `${se.players.length} Spieler:innen`;
  const board = $('#lineup-board');
  board.innerHTML = '<div class="box"></div><div class="box b"></div>' + F.slots.map(([pos, fx, fy], i) => {
    const p = se.players.find(x => x.id === se.slots[i]); const bad = p && (posFit(p, pos) < 0.8 || !se.available(p));
    return `<div class="slot ${pos === 'TW' ? 'tw' : ''} ${p ? '' : 'empty'} ${bad ? 'bad' : ''} ${S.selSlot === i ? 'sel' : ''}" data-i="${i}" style="left:${fy * 100}%;top:${(0.97 - fx * 0.96) * 100}%">${p ? shirt(i + 1, CLUB, 44, pos === 'TW') + `<em class="rt">${rating(p, pos)}</em>` : '<div class="chip">+</div>'}<span class="nm">${p ? esc(p.name.split(' ')[0]) : esc(pos)}</span><span class="ps">${esc(pos)}</span></div>`;
  }).join('');
  $$('#lineup-board .slot').forEach(el => el.addEventListener('click', () => { const i = +el.dataset.i; if (S.selSlot === i) S.selSlot = null; else if (S.selSlot !== null) { const a = se.slots[S.selSlot]; se.slots[S.selSlot] = se.slots[i]; se.slots[i] = a; S.selSlot = null; audio.play('confirm'); } else { S.selSlot = i; audio.play('click'); } renderWeek(); }));
  const inL = new Set(se.slots);
  const PO = ['TW', 'IV', 'AV', 'DM', 'ZM', 'FL', 'ST'], sk = S.sqSort || 'pos', fk = S.sqFilter || 'all';
  const SORT = { pos: (a, b) => PO.indexOf(a.pos) - PO.indexOf(b.pos) || rating(b) - rating(a), str: (a, b) => rating(b) - rating(a), form: (a, b) => b.form - a.form || rating(b) - rating(a), fit: (a, b) => b.fitness - a.fitness, val: (a, b) => b.value - a.value, age: (a, b) => a.age - b.age, goals: (a, b) => b.goals - a.goals || b.assists - a.assists };
  const FIL = { all: () => true, xi: p => inL.has(p.id), bench: p => !inL.has(p.id) && se.available(p), out: p => !se.available(p) };
  const list = se.players.filter(FIL[fk]).sort(SORT[sk]);
  $('#sq-sort').value = sk; $$('#sq-filter button').forEach(b => b.classList.toggle('on', b.dataset.f === fk));
  $('#player-list').innerHTML = list.map(p => { const [st, stt] = statusOf(p); const r = rating(p); const canSell = se.players.length > 14;
    return `<div class="pl ${inL.has(p.id) ? 'in' : ''} ${se.available(p) ? '' : 'na'}" data-id="${p.id}">${avatar(p, CLUB, 40)}<span class="pos ${p.pos === 'TW' ? 'tw' : ''}">${esc(p.pos)}</span><span class="name"><b>${esc(p.name)}${p.id === se.captain ? ' <i class="cap" title="Kapitän">C</i>' : ''}${p.id === se.penTaker ? ' <i class="pen" title="Elfmeterschütze">11m</i>' : ''}</b><small>${esc(p.nick || '')} · ${p.age} J. · <span class="stars" title="Potenzial">${'★'.repeat(p.pot || 3)}<i>${'★'.repeat(5 - (p.pot || 3))}</i></span> · ${money(p.value)}</small></span><span class="rt ${r >= 78 ? 'hi' : r < 62 ? 'lo' : ''}">${r}</span>${attrsHtml(p)}<span class="fit"><b>${Math.round(p.fitness)} %</b>Fitness</span><span class="stt"><i class="st st-${st}" title="${esc(stt)}"></i></span><span class="act">${inL.has(p.id) && p.pos !== 'TW' && p.id !== se.captain ? `<button class="btn xs" data-cap="${p.id}" title="Zum Kapitän machen">C</button>` : ''}${inL.has(p.id) && p.pos !== 'TW' && p.id !== se.penTaker ? `<button class="btn xs" data-pen="${p.id}" title="Elfmeterschütze">11m</button>` : ''}${canSell ? `<button class="btn xs" data-sell="${p.id}" title="Verkaufen">€</button>` : ''}</span></div>`; }).join('');
  $$('#player-list .pl').forEach(el => {
    el.addEventListener('click', (e) => { if (e.target.dataset.sell || e.target.dataset.cap || e.target.dataset.pen) return; const id = el.dataset.id; const p = se.players.find(x => x.id === id);
      if (S.selSlot !== null) { if (!se.available(p)) { toast(p.injured > 0 ? 'Verletzt – nicht einsetzbar.' : 'Gesperrt – nicht einsetzbar.'); audio.play('deny'); return; } se.setSlot(S.selSlot, id); S.selSlot = null; audio.play('confirm'); renderWeek(); }
      else { $('#tip').hidden = true; openPlayer(id); } });
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showTip(el, se.players.find(x => x.id === el.dataset.id)); });
    el.addEventListener('pointerleave', () => { $('#tip').hidden = true; });
  });
  $$('[data-cap]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); se.setCaptain(b.dataset.cap); audio.play('confirm'); toast(`${se.players.find(p => p.id === b.dataset.cap).name} trägt die Kapitänsbinde.`); renderWeek(); }));
  $$('[data-pen]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); se.setPenTaker(b.dataset.pen); audio.play('confirm'); renderWeek(); }));
  $$('[data-sell]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); const p = se.players.find(x => x.id === b.dataset.sell); if (confirm(tr(`${p.name} für ${money(se.salePrice(p))} verkaufen?`))) { const r = se.sell(p.id); if (r.ok) { audio.play('cash'); } else { toast(r.reason); audio.play('deny'); } renderWeek(); } }));
  $('#lineup-problems').innerHTML = se.lineupProblems().map(p => `<li>${esc(p)}</li>`).join('');
  $('#lineup-hint').textContent = S.selSlot !== null ? 'Jetzt eine:n Spieler:in in der Liste wählen – oder eine zweite Position zum Tauschen.' : 'Klicke eine Position und dann eine:n Spieler:in in der Liste.';
}
function showTip(el, p) { const t = $('#tip'); if (!p) return; t.innerHTML = `<b>${esc(p.name)} <small>· ${esc(POS[p.pos])}</small></b><small>${esc(p.desc || '')}</small><br><small>Fitness ${Math.round(p.fitness)} % · Stimmung ${Math.round(p.morale)} · Form ${p.form > 0 ? '+' + p.form : p.form} · Potenzial ${'★'.repeat(p.pot || 3)} · Tore ${p.goals} · Vorlagen ${p.assists}</small>`; t.hidden = false; const r = el.getBoundingClientRect(); t.style.left = Math.min(innerWidth - 310, r.left) + 'px'; t.style.top = (r.bottom + 6 + 150 > innerHeight ? r.top - 110 : r.bottom + 6) + 'px'; }
$('#btn-auto').addEventListener('click', () => { SE().autoLineup(); S.selSlot = null; audio.play('confirm'); renderWeek(); });

// Taktik
function renderTactics() {
  const se = SE(), o = se.opponent;
  $('#formations').innerHTML = Object.entries(FORMATIONS).map(([k, f]) => `<button class="${k === se.formation ? 'on' : ''}" data-k="${k}">${esc(f.name)} <small class="cohv">${se.coh[k] || 40}</small></button>`).join('');
  $$('#formations button').forEach(b => b.addEventListener('click', () => { se.setFormation(b.dataset.k); audio.play('click'); renderWeek(); }));
  $('#styles').innerHTML = Object.entries(STYLES).map(([k, s]) => `<button class="scard ${k === se.style ? 'on' : ''}" data-k="${k}"><b>${esc(s.name)}</b><small>${esc(s.desc)}</small><div class="bars"><span>Pressing<b>${'▮'.repeat(Math.round(s.press * 5))}</b></span><span>Risiko<b>${'▮'.repeat(Math.round(s.risk * 5))}</b></span></div></button>`).join('');
  $$('#styles .scard').forEach(b => b.addEventListener('click', () => { se.style = b.dataset.k; audio.play('click'); renderTactics(); }));
  $('#tempos').innerHTML = Object.entries(TEMPO).map(([k, t]) => `<button class="${k === se.tempo ? 'on' : ''}" data-k="${k}">${esc(t.name)}</button>`).join('');
  $$('#tempos button').forEach(b => b.addEventListener('click', () => { se.tempo = b.dataset.k; audio.play('click'); renderTactics(); }));
  { const inL = se.slots.map(id => se.players.find(p => p.id === id)).filter(p => p && p.pos !== 'TW');
    const opt = (sel, auto) => `<option value="">${esc(tr(auto))}</option>` + inL.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)} · TC ${Math.round(p.technik)} · SC ${Math.round(p.schuss)}</option>`).join('');
    $('#setpieces').innerHTML = `<label>Ecken<select id="sp-corner">${opt(se.cornerTaker, 'Automatisch (beste Technik)')}</select></label><label>Freistöße<select id="sp-fk">${opt(se.fkTaker, 'Automatisch (Elfmeterschütze)')}</select></label><label>Eckenvariante<select id="sp-var">${Object.entries(CORNER_VAR).map(([k, v]) => `<option value="${k}" ${k === (se.cornerVar || 'mix') ? 'selected' : ''}>${esc(tr(v))}</option>`).join('')}</select></label>`;
    $('#sp-corner').onchange = (e) => { se.cornerTaker = e.target.value || null; audio.play('click'); };
    $('#sp-fk').onchange = (e) => { se.fkTaker = e.target.value || null; audio.play('click'); };
    $('#sp-var').onchange = (e) => { se.cornerVar = e.target.value; audio.play('click'); };
    const F = FORMATIONS[se.formation], R = se.roles || {};
    $('#roles').innerHTML = se.slots.map((id, i) => { const p = se.players.find(x => x.id === id), pos = F.slots[i][0], RS = ROLES[pos]; if (!p || !RS) return ''; const cur = R[p.id] && R[p.id].pos === pos ? R[p.id].role : '';
      return `<div class="rl"><span class="pos">${esc(pos)}</span><b>${esc(p.name)}</b><select data-rid="${p.id}" data-rpos="${pos}"><option value="">${esc(tr('Standard'))}</option>${Object.entries(RS).map(([k, r]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(tr(r.name))}</option>`).join('')}</select><small>${esc(tr(cur ? RS[cur].desc : 'Spielt die Position nach Plan.'))}</small></div>`; }).join('');
    $$('#roles select').forEach(sel => sel.onchange = () => { se.setRole(sel.dataset.rid, sel.dataset.rpos, sel.value); audio.play('click'); renderTactics(); }); }
  const ev = se.pendingEvent ? `<p><b style="color:var(--orange)">Störung: ${esc(EVENTS[se.pendingEvent.event].name)}</b> – ${esc(EVENTS[se.pendingEvent.event].desc)}</p>` : '';
  $('#opp-card').innerHTML = `<div class="card-head"><span>Gegner: ${esc(o.club)}</span><span class="tag">Stärke ${o.strength}</span></div><div class="oc"><div class="crest" style="background:${o.color};border-color:${o.color2}">${esc(o.short[0])}</div><div><b>${esc(o.club)}</b><p>${esc(o.teaser)}</p></div></div>${ev}<div class="tipp">💬 ${esc(o.lena)}</div>`;
}
// Training
function renderTraining() {
  const se = SE(); if (!S.tplan || S.tplan.day !== se.day) S.tplan = { day: se.day, k: 'angriff', intensity: 'normal', individual: [{ id: '', attr: 'schuss' }, { id: '', attr: 'tempo' }] };
  const P = S.tplan, done = se.trained && !se.extraTraining;
  $('#train-cards').innerHTML = Object.entries(TRAINING).map(([k, t]) => { const pv = se.trainPreview(k, P.intensity); return `<button class="tcard ${P.k === k ? 'sel' : ''} ${se.trained === k ? 'done' : ''}" data-k="${k}" ${done ? 'disabled' : ''}><b>${esc(t.name)}</b><small>${esc(t.desc)}</small><em>${t.tactic ? `Eingespieltheit ${se.cohesion()} → höher` : t.fit ? 'Fitness für alle' : t.morale ? 'Stimmung für alle' : `${pv.n} Spieler:innen · bis +${pv.gain}`}</em></button>`; }).join('');
  $$('#train-cards .tcard').forEach(b => b.addEventListener('click', () => { P.k = b.dataset.k; audio.play('click'); renderTraining(); }));
  $('#train-int').innerHTML = Object.entries(INTENSITY).map(([k, v]) => `<button class="${P.intensity === k ? 'on' : ''}" data-k="${k}" ${done ? 'disabled' : ''}>${esc(v.name)}</button>`).join('');
  $$('#train-int button').forEach(b => b.addEventListener('click', () => { P.intensity = b.dataset.k; audio.play('click'); renderTraining(); }));
  const I = INTENSITY[P.intensity]; $('#train-int-desc').textContent = I.desc + (I.inj ? ` Verletzungsrisiko je Spieler:in ${Math.round(I.inj * 100)} %.` : '');
  const avail = se.players.filter(p => p.injured <= 0).sort((a, b) => (b.pot || 3) - (a.pot || 3) || a.age - b.age);
  $('#train-indiv').innerHTML = P.individual.map((it, i) => `<div class="ind-row"><select data-i="${i}" ${done ? 'disabled' : ''}><option value="">– niemand –</option>${avail.map(p => `<option value="${p.id}" ${it.id === p.id ? 'selected' : ''}>${esc(p.name)} · ${esc(p.pos)} · ${'★'.repeat(p.pot || 3)}</option>`).join('')}</select><div class="seg sm">${ATTRS.map(a => `<button class="${it.attr === a ? 'on' : ''}" data-i="${i}" data-a="${a}" ${done ? 'disabled' : ''}>${esc(ATTR_NAMES[a])}</button>`).join('')}</div></div>`).join('');
  $$('#train-indiv select').forEach(sel => sel.addEventListener('change', () => { const o = P.individual.find((x, j) => j !== +sel.dataset.i && x.id === sel.value); if (o && sel.value) o.id = ''; P.individual[+sel.dataset.i].id = sel.value; renderTraining(); }));
  $$('#train-indiv button').forEach(b => b.addEventListener('click', () => { P.individual[+b.dataset.i].attr = b.dataset.a; audio.play('click'); renderTraining(); }));
  const n = P.individual.filter(x => x.id).length;
  $('#train-summary').textContent = done ? 'Diese Woche wurde bereits trainiert.' : `${TRAINING[P.k].name} · ${I.name}${n ? ` · ${n}× Einzeltraining` : ''}`;
  $('#btn-train').disabled = done; $('#btn-train').textContent = se.extraTraining && se.trained ? 'Zweite Einheit starten' : 'Training starten';
  // Eingespieltheit
  const ch = se.cohesion(), fc = se.coh[se.formation] || 40, sc = se.cohStyle[se.style] || 40;
  $('#coh-box').innerHTML = `<div class="coh"><b>${ch}</b><span>${ch >= 80 ? 'Blind eingespielt' : ch >= 60 ? 'Gut eingespielt' : ch >= 40 ? 'Holprig' : 'Neu zusammengewürfelt'}</span></div><div class="kgrid"><div><small>Formation ${esc(se.formation)}</small><b>${fc}</b><i class="bar"><b style="width:${fc}%"></b></i></div><div><small>Stil ${esc(STYLES[se.style].name)}</small><b>${sc}</b><i class="bar"><b style="width:${sc}%"></b></i></div></div><p class="hint">Eingespieltheit wirkt auf alle Werte im Spiel (−4 % bis +4 %). Taktiktraining und Spiele in derselben Formation erhöhen sie.</p>`;
  // Bericht
  const L = se.lastTraining && se.trained ? se.lastTraining : null;
  $('#train-report').innerHTML = L ? `<p><b>${esc(L.name)}</b> · ${esc(INTENSITY[L.intensity].name)}</p>${L.coh ? `<p class="up">Eingespieltheit ${esc(L.coh.formation)}: ${L.coh.value}</p>` : ''}${L.changes.length ? `<div class="tr-list">${L.changes.slice(0, 14).map(c => `<div class="tr-row">${avatar(se.players.find(p => p.id === c.id) || c, CLUB, 28)}<span>${esc(c.name)}</span><span class="d">${Object.entries(c.d).map(([a, v]) => `<i class="${v > 0 ? 'up' : 'down'}">${ATTR_NAMES[a].slice(0, 3)} ${v > 0 ? '+' : ''}${v}</i>`).join('')}</span></div>`).join('')}</div>` : '<p class="hint">Keine sichtbaren Wertänderungen.</p>'}${L.injured.length ? `<p class="down">Verletzt: ${esc(L.injured.join(', '))}</p>` : ''}` : '<p class="hint">Noch kein Training in dieser Woche.</p>';
}
$('#btn-train').addEventListener('click', () => { const se = SE(), P = S.tplan; const r = se.train(P.k, { intensity: P.intensity, individual: P.individual.filter(x => x.id) }); if (r) { audio.play('confirm'); toast(`${r.name}: ${r.changes.length} Verbesserungen${r.injured.length ? ' · ' + r.injured.length + ' verletzt' : ''}`); renderWeek(); } });
// Transfermarkt
function renderMarket() {
  const se = SE();
  $('#market-cards').innerHTML = se.market.map(p => `<div class="mcard2"><div class="top">${avatar(p, { color: '#5aa9ff', color2: '#1b3a6b' }, 40)}<b>${esc(p.name)}</b>${ring(rating(p), 40)}</div><div class="meta">${esc(POS[p.pos])} · ${p.age} J. · <span class="stars">${'★'.repeat(p.pot || 3)}<i>${'★'.repeat(5 - (p.pot || 3))}</i></span></div>${attrsHtml(p)}<p>${esc(p.desc)}</p><div class="foot"><span class="price">${money(p.value)}</span><button class="btn sm ${p.value <= se.budget ? 'primary' : ''}" data-buy="${p.id}" ${p.value > se.budget ? 'disabled' : ''}>Verpflichten</button></div></div>`).join('') || '<p class="hint">Diese Woche ist der Markt leer.</p>';
  $$('[data-buy]').forEach(b => b.addEventListener('click', () => { const r = se.buy(b.dataset.buy); if (r.ok) { audio.play('cash'); toast('Transfer abgeschlossen.'); } else { audio.play('deny'); toast(r.reason); } renderWeek(); }));
  const inL = new Set(se.slots), full = se.players.length <= 14;
  $('#sell-list').innerHTML = [...se.players].sort((a, b) => b.value - a.value).map(p => `<div class="sell-row ${inL.has(p.id) ? 'in' : ''}">${avatar(p, CLUB, 34)}<span class="pos ${p.pos === 'TW' ? 'tw' : ''}">${esc(p.pos)}</span><span class="nm"><b>${esc(p.name)}</b><small>${p.age} J. · Stärke ${rating(p)} · Form ${p.form > 0 ? '+' + p.form : p.form}${inL.has(p.id) ? ' · Startelf' : ''}${p.injured > 0 ? ' · verletzt' : ''}</small></span><span class="val"><small>Marktwert</small>${money(p.value)}</span><span class="price"><small>Erlös</small>${money(se.salePrice(p))}</span><button class="btn sm" data-sell2="${p.id}" ${full ? 'disabled' : ''}>Verkaufen</button></div>`).join('');
  $$('[data-sell2]').forEach(b => b.addEventListener('click', () => { const p = se.players.find(x => x.id === b.dataset.sell2); if (!p) return; if (confirm(tr(`${p.name} für ${money(se.salePrice(p))} verkaufen?`))) { const r = se.sell(p.id); if (r.ok) { audio.play('cash'); toast(tr(`${p.name} verkauft: +${money(r.gain)}`)); } else { toast(r.reason); audio.play('deny'); } renderWeek(); } }));
}
// Finanzen & Stadion
function renderFinance() {
  const se = SE(), e = se.econ, f = se.forecast(), next = STADIUM[e.stadium + 1], L = e.last;
  const pct = Math.round(f.att / se.capacity * 100), fansLbl = e.fans >= 80 ? 'Euphorisch' : e.fans >= 60 ? 'Begeistert' : e.fans >= 40 ? 'Zufrieden' : e.fans >= 25 ? 'Skeptisch' : 'Verärgert';
  const row = (k, v, neg) => `<div class="fr"><span>${esc(k)}</span><b class="${neg ? 'neg' : v > 0 ? 'pos' : ''}">${neg ? '−' : v > 0 ? '+' : ''}${money(Math.abs(v))}</b></div>`;
  const hist = e.history.slice(-14), maxV = Math.max(1, ...hist.map(h => Math.max(h.income, h.costs)));
  $('#fin-grid').innerHTML = `
    <div class="hcard fin-kpis"><div class="hc-head">${icon('money')} Kasse & Fans</div><div class="kgrid">
      <div><small>Budget</small><b class="${se.budget < 0 ? 'neg' : ''}">${money(se.budget)}</b></div><div><small>Gehälter / Woche</small><b>${money(se.wages())}</b></div>
      <div><small>Unterhalt / Woche</small><b>${money(se.upkeep())}</b></div><div><small>Fan-Stimmung</small><b>${Math.round(e.fans)} · ${esc(fansLbl)}</b><i class="bar"><b style="width:${e.fans}%"></b></i></div></div></div>
    <div class="hcard fin-ticket"><div class="hc-head">${icon('target')} Eintrittspreis</div>
      <div class="price-row"><input type="range" id="price" min="${ECON.priceMin}" max="${ECON.priceMax}" step="1" value="${e.price}"><b id="price-v">${e.price} €</b></div>
      <div class="fc-box">${se.home ? `<span>Nächstes Heimspiel gegen <b>${esc(se.opponent.club)}</b>:</span><span>erwartet <b id="fc-att">${f.att.toLocaleString('de-DE')}</b> Zuschauer (<b id="fc-pct">${pct}</b> %) · Tickets <b id="fc-tix">${money(f.tickets)}</b></span>` : `<span>Nächstes Spiel ist auswärts – keine Ticketeinnahmen. Der Preis gilt ab dem nächsten Heimspiel.</span>`}</div>
      <p class="hint">Teure Tickets bringen mehr pro Kopf, aber weniger Zuschauer – und über 35 € sinkt die Fan-Stimmung. Siege, Tore und volle Ränge machen die Fans glücklich.</p></div>
    <div class="hcard fin-stadium"><div class="hc-head">${icon('home')} Stadion</div>
      <b>${esc(STADIUM[e.stadium].name)}</b><p>${se.capacity.toLocaleString('de-DE')} Plätze${e.pending !== null ? ` · <span class="warn">Ausbau auf ${STADIUM[e.pending].cap.toLocaleString('de-DE')} läuft – fertig zum nächsten Spieltag</span>` : ''}</p>
      ${next && e.pending === null ? `<div class="build"><span>Nächste Stufe: <b>${next.cap.toLocaleString('de-DE')} Plätze</b></span><button class="btn sm ${next.cost <= se.budget ? 'primary' : ''}" id="btn-build" ${next.cost > se.budget ? 'disabled' : ''}>Ausbauen · ${money(next.cost)}</button></div>` : !next ? '<p class="done">✓ Voll ausgebaut</p>' : ''}</div>
    <div class="hcard fin-fac"><div class="hc-head">${icon('board')} Einrichtungen</div><div class="fac-list">${Object.entries(FACILITIES).map(([k, F]) => { const lv = e.fac[k], c = F.cost[lv]; return `<div class="fac"><span class="ic">${F.icon}</span><span class="nm"><b>${esc(F.name)} <small>Stufe ${lv}/${F.max}</small></b><small>${esc(F.desc)}</small></span>${lv < F.max ? `<button class="btn sm" data-fac="${k}" ${c > se.budget ? 'disabled' : ''}>${money(c)}</button>` : '<span class="done">✓</span>'}</div>`; }).join('')}</div></div>
    <div class="hcard fin-last"><div class="hc-head">${icon('table')} Letzter Spieltag</div>${L ? `${L.home ? `<p>${L.att.toLocaleString('de-DE')} Zuschauer bei ${L.price} € · Auslastung ${Math.round(L.att / L.cap * 100)} %</p>` : '<p>Auswärtsspiel</p>'}${row('Tickets', L.tickets)}${row('TV & Prämien', L.tv)}${row('Fanshop', L.merch)}${row('VIP-Logen', L.vip)}${row('Sponsor', L.sponsor)}${row('Gehälter', L.wages, true)}${row('Unterhalt', L.upkeep, true)}<div class="fr sum"><span>Bilanz</span><b class="${L.net >= 0 ? 'pos' : 'neg'}">${L.net >= 0 ? '+' : '−'}${money(Math.abs(L.net))}</b></div>` : '<p>Noch kein Spiel abgerechnet.</p>'}</div>
    <div class="hcard fin-hist"><div class="hc-head">${icon('up')} Saisonverlauf</div>${hist.length ? `<div class="bars">${hist.map(h => `<div class="bar2" title="Spieltag ${h.day + 1}: +${h.income} / −${h.costs} T€"><i class="in" style="height:${h.income / maxV * 100}%"></i><i class="out" style="height:${h.costs / maxV * 100}%"></i><small>${h.day + 1}</small></div>`).join('')}</div><p class="legend2"><i class="in"></i> Einnahmen <i class="out"></i> Ausgaben</p>` : '<p>Der Verlauf erscheint nach dem ersten Spieltag.</p>'}</div>`;
  const pr = $('#price'); if (pr) pr.addEventListener('input', () => { se.setPrice(+pr.value); $('#price-v').textContent = se.econ.price + ' €'; const g = se.forecast(); if ($('#fc-att')) { $('#fc-att').textContent = g.att.toLocaleString('de-DE'); $('#fc-pct').textContent = Math.round(g.att / se.capacity * 100); $('#fc-tix').textContent = money(g.tickets); } });
  const bb = $('#btn-build'); if (bb) bb.addEventListener('click', () => { const r = se.buildStadium(); if (r.ok) { audio.play('cash'); toast('Bauauftrag erteilt.'); } else { audio.play('deny'); toast(r.reason); } renderWeek(); });
  $$('[data-fac]').forEach(b => b.addEventListener('click', () => { const r = se.buildFacility(b.dataset.fac); if (r.ok) { audio.play('cash'); toast(`${FACILITIES[b.dataset.fac].name} ausgebaut.`); } else { audio.play('deny'); toast(r.reason); } renderWeek(); }));
}
// Tabelle & Ergebnisse
function tableRows(tb, full) { tb.innerHTML = SE().standings().map((t, i) => { const o = t.me ? { ...CLUB, me: true } : OPPONENTS.find(x => x.id === t.id); return `<tr class="${t.me ? 'me' : ''}"><td>${i + 1}</td><td class="cl">${crest(o, 22)} ${esc(t.club)}</td><td class="r">${t.w + t.d + t.l}</td>${full ? `<td class="r">${t.w}</td><td class="r">${t.d}</td><td class="r">${t.l}</td>` : ''}<td class="r">${t.gf}:${t.ga}</td><td class="r"><b>${t.pts}</b></td></tr>`; }).join(''); }
function resultRows(ul) { const se = SE(); ul.innerHTML = se.results.length ? se.results.map(r => `<li class="${r.won ? 'w' : r.draw ? 'd' : 'l'}"><small>Spieltag ${r.day + 1}</small><span>${r.home ? 'TechHub United – ' + esc(r.club) : esc(r.club) + ' – TechHub United'}</span><span class="sc">${r.home ? r.gf + ':' + r.ga : r.ga + ':' + r.gf}</span><small>+${fmt(r.pts)}</small></li>`).join('') : '<li class="none"><span>Noch kein Spiel gespielt.</span></li>'; }
function renderTable() { renderRankChart(); tableRows($('#league-table tbody'), true); resultRows($('#results-list')); const se = SE(); const top = [...se.players].filter(p => p.goals || p.assists).sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, 6); $('#scorers').innerHTML = top.length ? top.map((p, i) => `<div class="sc-row"><span class="n">${i + 1}</span>${avatar(p, CLUB, 34)}<span class="nm"><b>${esc(p.name)}</b><small>${esc(POS[p.pos])}</small></span><span class="g">${p.goals} <small>Tore</small></span><span class="a">${p.assists} <small>Vorl.</small></span></div>`).join('') : '<p class="hint">Noch keine Torschützen.</p>'; }
// Saisonverlauf: Tabellenplatz je Spieltag als Linie
function renderRankChart() {
  const se = SE(), h = se.rankHist || [], n = se.table.length, el = $('#rank-chart');
  if (h.length < 2) { el.innerHTML = h.length ? '' : ''; el.hidden = true; return; } el.hidden = false;
  const W = 900, H = 170, px = 34, py = 16, X = (i) => px + i * (W - px * 2) / Math.max(1, se.len - 1), Y = (r) => py + (r - 1) * (H - py * 2) / (n - 1);
  const pts = h.map((r, i) => `${X(i).toFixed(1)},${Y(r).toFixed(1)}`).join(' ');
  const grid = Array.from({ length: n }, (_, i) => `<line x1="${px}" x2="${W - px}" y1="${Y(i + 1)}" y2="${Y(i + 1)}" class="g${i === 0 ? ' top' : ''}"/><text x="${px - 10}" y="${Y(i + 1) + 4}" text-anchor="end">${i + 1}</text>`).join('');
  const dots = h.map((r, i) => { const x = se.results[i]; return `<circle cx="${X(i)}" cy="${Y(r)}" r="5" class="${x ? (x.won ? 'w' : x.draw ? 'd' : 'l') : ''}"><title>Spieltag ${i + 1}: Platz ${r}</title></circle>`; }).join('');
  const days = Array.from({ length: se.len }, (_, i) => `<text x="${X(i)}" y="${H - 1}" text-anchor="middle">${i + 1}</text>`).join('');
  el.innerHTML = `<h3>Saisonverlauf <small>Tabellenplatz nach jedem Spieltag</small></h3><svg viewBox="0 0 ${W} ${H + 8}">${grid}${days}<polyline points="${pts}" class="ln"/>${dots}</svg>`;
}
// Funk
function renderRadio() { const se = SE(); if (!se) return; const el = $('#radio'); el.innerHTML = [...se.log].reverse().slice(0, 30).map(m => { const P = SPK[m.who] || SPK.hub; return `<div class="msg ${m.who}"><div class="av">${P.av}</div><div><b>${esc(P.n)} · Spieltag ${m.day + 1}</b><p>${esc(m.text)}</p></div></div>`; }).join(''); }

function lsGet(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
// ---------------- Spieltag ----------------
let M = null, pitch = null, lastT = 0, matchRun = false;
function sizePitch() { const wrap = $('.pitch-wrap'); if (!pitch) return; pitch.resize(wrap.clientWidth, wrap.clientHeight); }
// 3D-Rasen (Babylon.js), sonst 2D-Darstellung
const want3d = () => { try { return localStorage.getItem('brcm-3d') !== '0'; } catch { return true; } };
async function ensurePitch() {
  if (pitch) return;
  if (want3d() && webglOk() && await loadBabylon()) { try { pitch = new Pitch3D($('#pitch')); } catch (e) { console.warn('3D nicht verfügbar', e); pitch = null; } }
  // kurz auf die Spielerfiguren warten, damit das Spiel nicht mit Platzhaltern beginnt und dann hakt
  if (pitch && pitch.ready) { const b = $('#btn-match'), t0 = b.textContent; b.textContent = tr('Stadion wird vorbereitet …'); await Promise.race([pitch.ready, new Promise(r => setTimeout(r, 6000))]); b.textContent = t0; }
  if (!pitch) pitch = new Pitch($('#pitch'));
  if (params.has('debug')) window.__P = pitch;
  S.pitch3d = pitch instanceof Pitch3D; $('.pitch-wrap').classList.toggle('three', S.pitch3d);
}
window.addEventListener('resize', () => { sizeBg(); if (bg3) bg3.resize(innerWidth, innerHeight); if (S.screen === 'match') sizePitch(); });
$('#btn-match').addEventListener('click', async () => { audio.unlock(); audio.play('whistle'); $('#btn-match').disabled = true; await ensurePitch(); $('#btn-match').disabled = false; startMatch(); });
function startMatch(mini) {
  const se = SE(), o = mini ? (mini.oppClub || se.opponent) : se.opponent; se.autoFillIfNeeded?.();
  const me = mini?.meTeam || se.teamForMatch(), opp = mini?.oppTeam || se.opponentForMatch(), atHome = mini ? true : se.home;
  const home = atHome ? me : opp, away = atHome ? opp : me;
  M = new Match(home, away, { seed: (Date.now() & 0xffff) + se.day, weather: mini?.weather || se.weather, spectacle: mini?.spect || lsGet('brcm-mode', 'real') === 'spect', walkout: !mini && !KIOSK, offside: lsGet('brcm-offside', '1') !== '0', hooks: { injMul: DIFFICULTY[S.diff].inj } }); S.talkUsed = false; S.talk = null;
  voice.prefetchFragments(); voice.prefetch(M.players.map(p => 'n:' + p.name).concat([...(home.bench || []), ...(away.bench || [])].map(p => 'n:' + p.name), ['n:' + home.short, 'n:' + away.short]));
  S.match = M; S.myTeam = atHome ? 0 : 1; S.chantT = 0;
  M.hooks = { onEvent: (e) => onMatchEvent(e), onHalf: () => openHalf('Halbzeit'), onFull: (r) => { if (mini && mini.kind === 'cup' && r.gh === r.ga && !M.shootout) { startShootoutUI(); return; } mini ? endMini(r) : endMatch(r); }, penaltyChoice: lsGet('brcm-penui', '1') !== '0' ? (info) => showPenUI(info) : null, fkChoice: lsGet('brcm-penui', '1') !== '0' ? (info) => showFkUI(info) : null, onShootoutEnd: () => { hidePenUI(); setTimeout(() => endMini(M.result()), 1600); }, onGoal: (ti) => { pitch.goalFlash(ti); }, injMul: DIFFICULTY[S.diff].inj };
  $('#sc-home').textContent = home.short; $('#sc-away').textContent = away.short; $('#sc-val').textContent = '0 : 0'; $('#sc-home-crest').innerHTML = crest(home, 30); $('#sc-away-crest').innerHTML = crest(away, 30); $('#tl-marks').innerHTML = ''; $('#tl-fill').style.width = '0%';
  if (pitch && pitch.setDaylight) { pitch.setDaylight(atHome); pitch.setWeather?.(mini?.weather || se.weather); } $('#sc-min').textContent = "0'"; $('#sc-phase').textContent = '1. Halbzeit';
  $('#ticker-list').innerHTML = ''; $('#ts-stats').textContent = ''; $('#match-banner').hidden = true;
  renderLiveTactics(); S.warned = new Set(); renderEnergy(); applyCam();
  if (!mini) showLineupIntro(home, away);
  onMatchEvent(M.events[0]);
  if (mini) applyMini(mini);
  setSpeed(KIOSK && !mini ? 2 : 1); matchRun = true; show('match'); audio.setCrowd(0.5); if (M.sp && M.sp.kind === 'walkout') setTimeout(() => audio.play('chant', 0.9), 1200);
  banner(mini ? mini.title : `${home.short} – ${away.short}`, mini ? mini.text : `Spieltag ${se.day + 1} · ${se.home ? CLUB.stadium : o.club}`, false, mini ? 4200 : 2600);
}
// Aufstellungen vor dem Anpfiff
let liTimer = null;
function showLineupIntro(home, away) {
  const el = $('#lineup-intro'); clearTimeout(liTimer);
  const col = (T) => `<div class="li-col"><div class="li-head">${crest(T, 40)}<b>${esc(T.name)}</b><small>${esc(FORMATIONS[T.formation]?.name || T.formation || '')} · ${esc(STYLES[T.style]?.name || '')}</small></div><div class="li-list">${T.players.slice(0, 11).map((p, i) => `<div class="li-p" style="animation-delay:${0.15 + i * 0.06}s">${avatar(p, T, 30)}<span class="n">${p.num}</span><span>${esc(p.name)}</span><small>${esc(p.pos)}</small></div>`).join('')}</div></div>`;
  el.innerHTML = `<div class="li-wrap">${col(home)}<div class="li-vs">VS</div>${col(away)}</div>`; el.hidden = false; el.classList.remove('out');
  liTimer = setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.hidden = true; }, 500); }, 4200);
  el.onclick = () => { clearTimeout(liTimer); el.hidden = true; };
}
// Kondition der eigenen Elf live; Lena meldet sich bei müden oder verletzten Spielern
function renderEnergy() {
  const mine = M.players.filter(p => p.team === S.myTeam && !p.out).sort((a, b) => a.num - b.num);
  $('#live-energy').innerHTML = `<small>Kondition</small><div class="le-grid">${mine.map(p => { const e = Math.round(p.energy * 100); return `<span class="${p.injured ? 'inj' : e < 50 ? 'low' : e < 70 ? 'mid' : ''}" title="${esc(p.name)} ${e} %"><b>${p.num}</b><i style="width:${e}%"></i></span>`; }).join('')}</div>`;
  const tired = mine.find(p => (p.injured || p.energy < 0.45) && !S.warned?.has(p.id));
  if (tired && M.subsLeft[S.myTeam] > 0 && M.speed < 10 && M.min > 20) { (S.warned ||= new Set()).add(tired.id); toast(`Lena: ${tired.name} ${tired.injured ? 'ist angeschlagen' : 'ist platt'} – Wechsel? (Taktik-Taste)`); }
}
function renderLiveTactics() {
  const T = M.teams[S.myTeam], se = SE();
  $('#live-tactics').innerHTML = `<small>Spielstil live</small><div class="seg">${Object.entries(STYLES).map(([k, v]) => `<button class="${k === T.style ? 'on' : ''}" data-k="${k}">${esc(v.name)}</button>`).join('')}</div><small>Anweisung</small><div class="seg live-instr">${Object.entries(INSTR).map(([k, v]) => `<button class="${k === (T.instr || 'normal') ? 'on' : ''}" data-i="${k}" title="${esc(tr(v.desc))}">${esc(v.name)}</button>`).join('')}</div>`;
  $$('#live-tactics button[data-k]').forEach(b => b.addEventListener('click', () => { T.style = b.dataset.k; se.style = b.dataset.k; audio.play('click'); renderLiveTactics(); }));
  $$('#live-tactics button[data-i]').forEach(b => b.addEventListener('click', () => { T.instr = b.dataset.i; audio.play('click'); toast(`${tr('Anweisung')}: ${tr(INSTR[b.dataset.i].name)} – ${tr(INSTR[b.dataset.i].desc)}`); renderLiveTactics(); }));
}
function setSpeed(s) { if (!M) return; M.speed = s === 'skip' ? 40 : s; if (M.speed > 2) { if (M.pen && M.pen.waiting) { hidePenUI(); M.choosePenalty({}); } if (M.sp && M.sp.waiting) { hidePenUI(); M.chooseFreeKick('top'); } } if (M.speed > 1) { clearTimeout(liTimer); $('#lineup-intro').hidden = true; } $$('#speed button[data-s]').forEach(b => b.classList.toggle('on', String(b.dataset.s) === String(s))); }
$$('#speed button[data-s]').forEach(b => b.addEventListener('click', () => { audio.play('click'); setSpeed(b.dataset.s === 'skip' ? 'skip' : +b.dataset.s); }));
$('#live-energy').addEventListener('click', () => { if (M && !M.over) { audio.play('click'); openHalf('Taktik'); } });
const CAMS = [['auto', 'Regie'], ['tv', 'TV'], ['near', 'Nah'], ['goal', 'Hinter dem Angriff'], ['top', 'Taktik']];
function applyCam() { let m = 'auto'; try { m = localStorage.getItem('brcm-cam2') || 'auto'; } catch { /* ignore */ } if (pitch && 'camMode' in pitch) pitch.camMode = m; $('#cam-name').textContent = (CAMS.find(c => c[0] === m) || CAMS[0])[1]; $('#btn-cam').hidden = !S.pitch3d; }
$('#btn-cam').addEventListener('click', () => { let m = 'auto'; try { m = localStorage.getItem('brcm-cam2') || 'auto'; } catch { /* ignore */ } const i = (CAMS.findIndex(c => c[0] === m) + 1) % CAMS.length; try { localStorage.setItem('brcm-cam2', CAMS[i][0]); } catch { /* ignore */ } audio.play('click'); applyCam(); toast(`Kamera: ${CAMS[i][1]}`); });
$('#btn-voice').addEventListener('click', () => { voice.setOn(!voice.on); $('#btn-voice').classList.toggle('off', !voice.on); audio.play('click'); });
$('#btn-tactics-live').addEventListener('click', () => { if (M && !M.over) { audio.play('click'); openHalf('Taktik'); } });
let bannerT = null;
// Druckleiste unter dem Spielstand: je Minute, wer im letzten Drittel Druck macht (oben eigenes Team)
function drawMomentum(force) {
  const c = $('#tl-mom'); if (!c || !M) return; const now = performance.now(); if (!force && now - (S.momT || 0) < 900) return; S.momT = now;
  const w = c.clientWidth || 600, h = c.clientHeight || 30; if (c.width !== Math.round(w)) c.width = Math.round(w); c.height = h * 1; const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  const mi = S.myTeam, cur = Math.min(99, Math.floor(M.min)), n = 90, bw = c.width / n, mid = c.height / 2, sm = (i, t) => { let v = 0, k = 0; for (let j = i - 2; j <= i + 2; j++) if (j >= 0 && j <= cur) { v += M.mom[j][t] * (3 - Math.abs(j - i)); k += 3 - Math.abs(j - i); } return k ? v / k : 0; };
  const mx = Math.max(4, ...Array.from({ length: Math.min(n, cur + 1) }, (_, i) => Math.max(sm(i, 0), sm(i, 1))));
  for (let i = 0; i <= Math.min(n - 1, cur); i++) { const a = sm(i, mi) / mx, b = sm(i, 1 - mi) / mx; g.fillStyle = 'rgba(61,220,132,0.75)'; g.fillRect(i * bw, mid - a * (mid - 1), Math.max(1, bw - 0.5), a * (mid - 1)); g.fillStyle = 'rgba(255,106,61,0.7)'; g.fillRect(i * bw, mid, Math.max(1, bw - 0.5), b * (mid - 1)); }
}
// Bauchbinde wie im Fernsehen
let l3Timer = null;
function lower3(name, num, sub, color, dur = 3200) { const el = $('#lower3'); if (!el || (M && M.speed > 4)) return; clearTimeout(l3Timer); el.classList.remove('out'); el.hidden = true; void el.offsetWidth; $('#l3-num').textContent = num ?? ''; $('#l3-name').textContent = name; $('#l3-sub').textContent = sub; el.style.setProperty('--l3c', color || '#3ddc84'); el.hidden = false; l3Timer = setTimeout(() => { el.classList.add('out'); l3Timer = setTimeout(() => { el.hidden = true; }, 350); }, dur); }
// Torschusskarte (eigenes Team greift nach rechts an) und Spielverlauf als SVG
function shotMapSVG(res, mi) {
  const L = res.shotLog || [], col = (t) => t === mi ? '#3ddc84' : '#ff6a3d';
  const pt = (s) => { let x = s.team === 0 ? s.x : 105 - s.x, y = s.team === 0 ? s.y : 68 - s.y; if (s.team !== mi) { x = 105 - x; y = 68 - y; } return [x, y]; };
  const lines = `<rect x="0" y="0" width="105" height="68" fill="#0f3d23"/><g fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".35"><rect x=".5" y=".5" width="104" height="67"/><line x1="52.5" y1="0" x2="52.5" y2="68"/><circle cx="52.5" cy="34" r="9.15"/><rect x="0" y="13.84" width="16.5" height="40.32"/><rect x="88.5" y="13.84" width="16.5" height="40.32"/><rect x="0" y="24.84" width="5.5" height="18.32"/><rect x="99.5" y="24.84" width="5.5" height="18.32"/></g>`;
  const dots = L.map(s => { const [x, y] = pt(s), r = 0.9 + Math.sqrt(s.xg) * 3.2, c = col(s.team), goal = s.out === 'goal'; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${goal ? c : 'none'}" fill-opacity="${goal ? 0.95 : 0}" stroke="${c}" stroke-width="${goal ? 0.5 : 0.45}" stroke-opacity="${s.out === 'save' || goal ? 1 : 0.45}"><title>${s.min}' ${esc(s.name || '')} · xG ${s.xg}${s.pen ? ' (Elfmeter)' : s.head ? ' (Kopfball)' : ''} · ${s.out}</title></circle>`; }).join('');
  const xg = (t) => L.filter(s => s.team === t).reduce((a, s) => a + s.xg, 0).toFixed(1);
  return `<svg viewBox="0 0 105 68" role="img" aria-label="Torschusskarte">${lines}${dots}<text x="3" y="5.5" font-size="3.6" fill="#ff6a3d" font-family="monospace">xG ${xg(1 - mi)}</text><text x="102" y="5.5" font-size="3.6" fill="#3ddc84" text-anchor="end" font-family="monospace">xG ${xg(mi)}</text></svg><div class="shot-legend"><span><i style="background:#3ddc84"></i>Tor</span><span><i style="border:1.5px solid #3ddc84"></i>aufs Tor / gehalten</span><span><i style="border:1.5px solid rgba(61,220,132,.45)"></i>daneben / geblockt</span><span>Kreisgröße = Torchance (xG)</span></div>`;
}
function momSVG(res, mi) {
  const m = res.mom || [], n = 90, W = 180, H = 60, mid = H / 2, sm = (i, t) => { let v = 0, k = 0; for (let j = i - 2; j <= i + 2; j++) if (m[j]) { v += m[j][t]; k++; } return k ? v / k : 0; }, mx = Math.max(4, ...Array.from({ length: n }, (_, i) => Math.max(sm(i, 0), sm(i, 1))));
  let up = `M0 ${mid}`, dn = `M0 ${mid}`; for (let i = 0; i < n; i++) { const x = (i + 0.5) / n * W; up += ` L${x.toFixed(1)} ${(mid - sm(i, mi) / mx * (mid - 2)).toFixed(1)}`; dn += ` L${x.toFixed(1)} ${(mid + sm(i, 1 - mi) / mx * (mid - 2)).toFixed(1)}`; } up += ` L${W} ${mid} Z`; dn += ` L${W} ${mid} Z`;
  const goals = (res.events || []).filter(e => e.type === 'goal').map(e => `<circle cx="${(Math.min(90, e.min) / 90 * W).toFixed(1)}" cy="${e.team === mi ? 4 : H - 4}" r="2.6" fill="${e.team === mi ? '#3ddc84' : '#ff6a3d'}"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Spielverlauf"><rect width="${W}" height="${H}" fill="rgba(255,255,255,.03)"/><line x1="${W / 2}" y1="0" x2="${W / 2}" y2="${H}" stroke="rgba(255,255,255,.2)" stroke-dasharray="2 2"/><path d="${up}" fill="rgba(61,220,132,.55)"/><path d="${dn}" fill="rgba(255,106,61,.5)"/><line x1="0" y1="${mid}" x2="${W}" y2="${mid}" stroke="rgba(255,255,255,.35)" stroke-width=".5"/>${goals}</svg><div class="shot-legend"><span><i style="background:#3ddc84"></i>Druck eigenes Team</span><span><i style="background:#ff6a3d"></i>Druck Gegner</span><span>● Tore</span></div>`;
}
function banner(t, sub, opp, dur = 2200, p = null) { const el = $('#match-banner'); el.innerHTML = `${p ? avatar(p, M.teams[p.team], 54) : ''}<span>${esc(t)}<small>${esc(sub)}</small></span>`; el.className = 'banner' + (opp ? ' opp' : ''); el.hidden = false; clearTimeout(bannerT); bannerT = setTimeout(() => { el.hidden = true; }, dur); }
// Kommentar: Vorlage + Werte → Teilstücke der echten Stimme (Untertitel = fertiger Satz)
const fillTpl = (tpl, v) => tpl.replace(/\{(p2|t2|p|t|k|s|n|a|b|pc|sh)\}/g, (_, n) => v[n] ?? '');
function speakTpl(tplDe, tplEn, vals, o = {}) { const tpl = LANG === 'en' ? tplEn : tplDe; if (!tpl) return; voice.sayTpl(tpl, vals, fillTpl(tpl, vals), { lang: LANG, ...o }); }
function speakEvent(e, o) { const en = LANG === 'en' ? enTemplate(e.tpl, EN_DICT) : null; if (e.tpl && (LANG !== 'en' || en)) speakTpl(e.tpl, en, e.vals, o); else voice.say(tr(e.text), { lang: LANG, ...o }); }
function matchVals() { const mi = S.myTeam, pt = M.poss[0] + M.poss[1]; return { t: M.teams[mi].short, n: Math.floor(M.min), a: M.score[mi], b: M.score[1 - mi], pc: Math.round(100 * M.poss[mi] / Math.max(1, pt)), sh: M.shots[mi][0], s: 'Clean-Core-Arena' }; }
function speakFiller() {
  const mi = S.myTeam, lead = M.score[mi] - M.score[1 - mi], v = matchVals(), L = LANG === 'en' ? 'en' : 'de';
  let key = Math.random() < 0.3 ? 'poss' : lead > 0 ? 'lead' : lead < 0 ? 'behind' : 'level';
  if ((M.weather === 'rain' || M.weather === 'snow') && Math.random() < 0.25) key = M.weather; if (M.min > 75 && Math.random() < 0.4) { key = 'late'; v.n = Math.max(1, 90 - Math.floor(M.min)); }
  const i = Math.floor(Math.random() * FILL.de[key].length); speakTpl(FILL.de[key][i], FILL.en[key][i], v, { prio: 0 });
}
function onMatchEvent(e) {
  const mine = e.team === S.myTeam;
  if (M && M.speed <= 2 && e.p) { const tc = M.teams[e.team]?.color || '#3ddc84';
    if (e.type === 'goal') setTimeout(() => lower3(e.p.name, e.p.num, `TOR · ${e.min}'${e.p2 ? ' · Vorlage ' + e.p2.name : ''}${e.pen ? ' · Elfmeter' : ''}`, tc, 4200), 2600);
    else if (e.type === 'chance' || e.type === 'header') { const s = M.shotLog && M.shotLog[M.shotLog.length - 1]; lower3(e.p.name, e.p.num, `${e.type === 'header' ? 'Kopfball' : 'Torschuss'} · xG ${s ? s.xg.toFixed(2) : '–'}`, tc, 2400); }
    else if (e.type === 'yellow' || e.type === 'red') lower3(e.p.name, e.p.num, e.type === 'red' ? 'Rote Karte' : 'Gelbe Karte', e.type === 'red' ? '#ff4d4d' : '#ffd400', 2800);
    else if (e.type === 'sub' && e.p2) lower3(e.p.name, e.p.num, `Einwechslung für ${e.p2.name}`, tc, 3000); }
  if (e.type === 'so_goal' || e.type === 'so_miss') { soBoard(); audio.play(e.type === 'so_goal' ? (mine ? 'goal' : 'goal_opp') : 'ooh', 0.8); }
  if (pitch && pitch.onEvent) pitch.onEvent(e, M);
  if (pitch && pitch.recordClip && M && M.speed < 10 && ['goal', 'save', 'pen_save', 'post', 'parry', 'header', 'fk_wall'].includes(e.type)) { const lb = { goal: 'TOR', save: 'Parade', pen_save: 'Elfmeter gehalten', post: 'Aluminium', parry: 'Glanzparade', header: 'Kopfball', fk_wall: 'Freistoß' }[e.type]; pitch.recordClip(M, e, `${e.min}' · ${tr(lb)} · ${e.p ? e.p.name : ''}`); }
  if (e.type === 'kickoff2') { audio.play('whistle'); return; }
  if (['intercept', 'press', 'tackle', 'cross', 'throwin', 'so_kick'].includes(e.type)) return;
  const li = document.createElement('div'); const key = e.type === 'goal' ? (mine ? 'goal' : 'goal_opp') : e.type; li.className = 'te ' + key; li.innerHTML = `<b>${e.min}'</b><span>${esc(e.text)}</span>`;
  const list = $('#ticker-list'); list.prepend(li); while (list.children.length > 60) list.lastChild.remove();
  // Sprecher: wichtige Ereignisse immer, Kleinigkeiten nur bei normalem Tempo
  const PRIO = { goal: 2, red: 2, penalty: 2, pen_save: 2, pen_miss: 2, full: 2, half: 2, kickoff: 1, yellow: 1, save: 1, post: 1, wide: 1, chance: 1, injury: 1, sub: 1, block: 0, koloss: 1, offside: 1, shootout: 2, so_goal: 1, so_miss: 1, so_end: 2, instr: 1, onetwo: 0, deflect: 1, corner: 1, freekick: 1, header: 1, parry: 1, fk_wall: 1, claim: 0, clear: 0 };
  const pr = PRIO[e.type]; if (pr !== undefined && M.speed < 10 && (M.speed <= 1 || pr >= 2)) speakEvent(e, { prio: pr, interrupt: e.type === 'goal' || e.type === 'full', rate: e.type === 'goal' ? 1.08 : 1.04, pitch: e.type === 'goal' ? 1.1 : 1 });
  if (e.type === 'kickoff' && M.speed < 10) { const w = M.weather || 'sun'; speakTpl(WEATHER_LINE.de[w], WEATHER_LINE.en[w], matchVals(), { prio: 1 }); }
  if (['goal', 'yellow', 'red', 'injury', 'sub', 'penalty'].includes(e.type)) { const mk = document.createElement('i'); mk.className = 'tm ' + e.type + (mine ? ' me' : ' opp'); mk.style.left = Math.min(100, e.min / 90 * 100) + '%'; mk.title = `${e.min}' ${e.p ? e.p.name : ''}`; mk.innerHTML = icon(e.type === 'goal' ? 'ball' : e.type === 'yellow' || e.type === 'red' ? 'card' : e.type === 'penalty' ? 'pen' : e.type); $('#tl-marks').appendChild(mk); }
  if (e.type === 'goal' && !S.mini && M.speed < 10 && Math.random() < 0.7) { const L = LEGACY_LINES[mine ? 'conceded' : 'scored'], line = L[Math.floor(Math.random() * L.length)]; setTimeout(() => { if (!M || M.over) return; const li2 = document.createElement('div'); li2.className = 'te legacy'; li2.innerHTML = `<b>KI</b><span>Legacy-KI: ${esc(tr(line))}</span>`; $('#ticker-list').prepend(li2); audio.play('legacy', 0.6); voice.say(tr(line), { lang: LANG, prio: 1, pitch: 0.75 }); }, 5200); }
  if (e.type === 'goal') { $('#sc-val').textContent = `${e.score[0]} : ${e.score[1]}`; if (pitch && pitch.startReplay && M.speed <= 1 && !M.over) { const d = pitch.startReplay(M, e.team); if (d) { M.paused = true; $('#replay-tag').hidden = false; voice.say(tr('Wiederholung.'), { lang: LANG, prio: 1 }); setTimeout(() => { if (M && M.paused && $('#half').hidden) M.paused = false; $('#replay-tag').hidden = true; pitch.stopReplay(); pitch.celebrate(e.p); }, d); } else pitch.celebrate(e.p); }
    else if (pitch && pitch.celebrate && M.speed < 10) pitch.celebrate(e.p); $('#sc-val').classList.remove('flash'); void $('#sc-val').offsetWidth; $('#sc-val').classList.add('flash'); audio.play(mine ? 'goal' : 'goal_opp'); banner(mine ? 'TOOOR!' : 'Gegentor', `${e.p ? e.p.name : ''} · ${e.min}'`, !mine, 2600, e.p); if (M.speed < 10) pitch.burst(M.ball.x, M.ball.y, mine ? '#3ddc84' : '#ff6a3d'); }
  else if (e.type === 'save' || e.type === 'post' || e.type === 'wide') audio.play('ooh', mine ? 0.8 : 0.5);
  else if (e.type === 'chance' && mine) audio.play('chance');
  else if (e.type === 'freekick') { audio.play('whistle'); if (!mine) audio.play('boo', 0.7); }
  else if (e.type === 'offside' && e.team !== S.myTeam) audio.play('applause', 0.5);
  else if (e.type === 'claim' || e.type === 'clear') audio.play('applause', e.team === S.myTeam || (e.type === 'claim' && e.team !== S.myTeam) ? 0.4 : 0.2);
  else if (e.type === 'header' || e.type === 'parry' || e.type === 'fk_wall' || e.type === 'deflect') audio.play('ooh', mine ? 0.6 : 0.4);
  else if (e.type === 'yellow' || e.type === 'red') { audio.play('card'); if (!mine) audio.play('applause', 0.4); else audio.play('boo', 0.8); if (e.type === 'red') banner('ROT', e.p.name, !mine); }
  else if (e.type === 'penalty') { audio.play('whistle'); audio.play('chance'); banner('ELFMETER', `${e.p ? e.p.name : ''} tritt an`, !mine); }
  else if (e.type === 'pen_save' || e.type === 'pen_miss') audio.play('ooh', mine ? 1 : 0.6);
  else if (e.type === 'injury') { audio.play('ooh', 0.6); if (mine) banner('Verletzung', `${e.p.name} – Wechsel?`, false); }
  else if (e.type === 'half') { audio.play('whistle'); $('#sc-phase').textContent = 'Halbzeit'; const mi = S.myTeam, lead = M.score[mi] - M.score[1 - mi]; const pt = M.poss[0] + M.poss[1], pc = Math.round(100 * M.poss[mi] / Math.max(1, pt)); { const k = lead > 0 ? 'lead' : lead < 0 ? 'behind' : 'level'; speakTpl(HALF.de[k], HALF.en[k], matchVals(), { prio: 1 }); } }
  else if (e.type === 'full') audio.play('whistle3');
  else if (e.type === 'kickoff') audio.play('whistle');
  $('#ts-stats').textContent = `Schüsse ${M.shots[0][0]} : ${M.shots[1][0]} · Ecken ${M.corners[0]} : ${M.corners[1]}`;
}
// Halbzeit / Taktik-Pause
function openHalf(title) {
  M.paused = true; audio.setCrowd(0.25);
  const se = SE(), T = M.teams[S.myTeam];
  $('#half-title').textContent = title; $('#half-score').textContent = `${M.score[0]} : ${M.score[1]} · ${Math.floor(M.min)}'`;
  { const r0 = M.result(); $('#half-viz').innerHTML = shotMapSVG(r0, S.myTeam); }
  const mk = (el, obj, cur, key) => { el.innerHTML = Object.entries(obj).map(([k, v]) => `<button class="${k === cur ? 'on' : ''}" data-k="${k}">${esc(v.name)}</button>`).join(''); el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { T[key] = b.dataset.k; se[key] = b.dataset.k; audio.play('click'); mk(el, obj, b.dataset.k, key); })); };
  mk($('#half-styles'), STYLES, T.style, 'style'); mk($('#half-tempos'), TEMPO, T.tempo, 'tempo');
  const lead = M.score[S.myTeam] - M.score[1 - S.myTeam];
  $('#half-advice').textContent = lead > 0 ? 'Lena: Führung – Clean Core und ruhiges Tempo bringen den Sieg nach Hause.' : lead < 0 ? 'Lena: Rückstand – Big Bang oder Agile Pressing, und frische Beine rein.' : 'Lena: Alles offen. Wer mehr Kondition hat, entscheidet die Schlussphase.';
  S.subOut = null; S.subIn = null; renderSubs();
  const tk = $('#half-talk'), canTalk = M.halfDone && !S.talkUsed; tk.closest('.talk-row').hidden = !canTalk;
  if (canTalk) { tk.innerHTML = Object.entries(TALKS).map(([k, v]) => `<button class="${S.talk === k ? 'on' : ''}" data-k="${k}" title="${esc(v.desc)}">${esc(v.name)}</button>`).join(''); tk.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { S.talk = b.dataset.k; audio.play('click'); tk.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); $('#talk-desc').textContent = TALKS[S.talk].desc; })); $('#talk-desc').textContent = S.talk ? TALKS[S.talk].desc : ''; }
  $('#half').hidden = false;
}
function renderSubs() {
  const T = M.teams[S.myTeam], mine = M.players.filter(p => p.team === S.myTeam && !p.out);
  $('#half-subs').textContent = `${M.subsLeft[S.myTeam]} übrig`;
  $('#sub-out').innerHTML = mine.sort((a, b) => a.num - b.num).map(p => `<button class="${S.subOut === p.id ? 'on' : ''} ${p.injured ? 'inj' : ''}" data-id="${p.id}"><span class="pos">${esc(p.pos)}</span><span>${esc(p.name)}</span><span class="en">${Math.round(p.energy * 100)} %${p.injured ? ' 🚑' : ''}</span></button>`).join('');
  $('#sub-in').innerHTML = (T.benchP || []).map(p => `<button class="${S.subIn === p.id ? 'on' : ''}" data-id="${p.id}"><span class="pos">${esc(p.pos)}</span><span>${esc(p.name)}</span><span class="en">${rating(p, p.pos)}</span></button>`).join('') || '<p class="hint">Keine Ersatzspieler mehr.</p>';
  $$('#sub-out button').forEach(b => b.addEventListener('click', () => { S.subOut = b.dataset.id; audio.play('click'); renderSubs(); }));
  $$('#sub-in button').forEach(b => b.addEventListener('click', () => { S.subIn = b.dataset.id; audio.play('click'); renderSubs(); }));
  $('#btn-sub').disabled = !(S.subOut && S.subIn && M.subsLeft[S.myTeam] > 0);
}
$('#btn-sub').addEventListener('click', () => { const T = M.teams[S.myTeam], inP = (T.benchP || []).find(p => p.id === S.subIn); if (inP && M.sub(S.myTeam, S.subOut, inP)) { audio.play('confirm'); } S.subOut = S.subIn = null; renderSubs(); });
$('#btn-resume').addEventListener('click', () => { $('#half').hidden = true; M.paused = false; renderLiveTactics();
  if (S.talk && !S.talkUsed && M.halfDone) { S.talkUsed = true; M.teamTalk(S.myTeam, S.talk); speakTpl(TALK_LINE.de[S.talk], TALK_LINE.en[S.talk], matchVals(), { prio: 1 }); } audio.play('whistle'); audio.setCrowd(0.5); if (M.halfDone && M.min < 46) $('#sc-phase').textContent = '2. Halbzeit'; });
function endMatch(res) {
  matchRun = false; hidePenUI(); audio.setCrowd(0.2);
  const se = SE(), o = se.opponent, r = se.applyResult(res);
  setTimeout(() => showFullTime(res, r, o), 900);
}
// Abpfiff-Animation: Sieg, Remis oder Niederlage – dann Spielbericht
let ftFx = null, ftTimer = null;
function showFullTime(res, r, o) {
  const el = $('#fulltime'), kind = r.won ? 'win' : r.draw ? 'draw' : 'loss', home = res.mine === 'home';
  el.className = 'fulltime ' + kind; el.hidden = false;
  $('#ft-sub').textContent = 'Abpfiff'; $('#ft-title').textContent = r.won ? 'SIEG!' : r.draw ? 'UNENTSCHIEDEN' : 'NIEDERLAGE';
  const hc = home ? { ...CLUB, me: true } : o, ac = home ? o : { ...CLUB, me: true };
  $('#ft-score').innerHTML = `<span>${crest(hc, 44)}${esc(home ? CLUB.short : o.short)}</span><b>${res.gh} : ${res.ga}</b><span>${esc(home ? o.short : CLUB.short)}${crest(ac, 44)}</span>`;
  const line = r.won ? (r.objective?.ok ? 'Lena: Sieg und Wochenziel erreicht! Sauber, wie es im Buche steht.' : 'Lena: Sauber ausgerollt! Das gibt Punkte für die Liga.') : r.draw ? 'Lena: Ein Punkt – nicht schön, aber stabil. Nächste Woche legen wir nach.' : 'Legacy-KI: Ein laufendes System fasst man nicht an. Ich hab es euch gesagt.';
  $('#ft-line').textContent = line;
  if (!ftFx) ftFx = new Confetti($('#ft-fx')); ftFx.stop();
  if (r.won) { ftFx.setRays(true, '#3ddc84'); ftFx.rain(220); } else if (r.draw) ftFx.setRays(true, '#ffc247');
  if (pitch && pitch.setMood) { pitch.setMood(r.won ? S.myTeam : r.draw ? null : 1 - S.myTeam, 9000); pitch.labels = false; S.ftOrbit = { t0: performance.now() }; }
  audio.play(r.won ? 'win' : r.draw ? 'confirm' : 'lose');
  setTimeout(() => voice.say(tr(line), { lang: LANG, prio: 3, rate: 1, pitch: r.won ? 1.05 : r.draw ? 1 : 0.8 }), 1200);
  const go = () => { clearTimeout(ftTimer); el.hidden = true; ftFx.stop(); S.ftOrbit = null; if (pitch && pitch.setCine) { pitch.setCine(null); pitch.labels = true; } showReport(res, r, o); };
  $('#btn-ft-next').onclick = () => { audio.play('click'); go(); };
  ftTimer = setTimeout(go, r.won ? 8500 : 6500);
}
function showReport(res, r, o) {
  const se = SE(), home = res.mine === 'home';
  $('#btn-highlights').hidden = !(pitch && pitch.clips && pitch.clips.length);
  { const mi = res.mine === 'home' ? 0 : 1; $('#rep-shots').innerHTML = shotMapSVG(res, mi); $('#rep-mom').innerHTML = momSVG(res, mi); }
  $('#rep-day').textContent = `Spieltag ${se.results.length} / ${se.len}`;
  $('#rep-title').textContent = r.won ? 'Sieg!' : r.draw ? 'Unentschieden' : 'Niederlage';
  const hn = home ? CLUB.name : o.club, an = home ? o.club : CLUB.name;
  $('#rep-score').className = 'rep-score ' + (r.won ? 'w' : r.draw ? 'd' : 'l');
  const hc = home ? { ...CLUB, me: true } : o, ac = home ? o : { ...CLUB, me: true };
  $('#rep-score').innerHTML = `<div class="tm">${crest(hc, 56)}<span>${esc(hn)}<small>${home ? 'HEIM' : 'GAST'}</small></span></div><b>${res.gh} : ${res.ga}</b><div class="tm r">${crest(ac, 56)}<span>${esc(an)}<small>${home ? 'GAST' : 'HEIM'}</small></span></div>`;
  const tev = res.events.filter(e => ['goal', 'yellow', 'red', 'injury', 'penalty'].includes(e.type));
  $('#rep-timeline').innerHTML = `<div class="tl-line"><span class="h">HZ</span></div>` + tev.map(e => `<i class="tm ${e.type} ${e.team === S.myTeam ? 'me' : 'opp'}" style="left:${Math.min(100, e.min / 90 * 100)}%" title="${e.min}' ${esc(e.p ? e.p.name : '')}">${icon(e.type === 'goal' ? 'ball' : e.type === 'yellow' || e.type === 'red' ? 'card' : e.type === 'penalty' ? 'pen' : e.type)}</i>`).join('');
  const byId = {}; for (const p of res.players) byId[p.id] = p;
  const goals = res.events.filter(e => e.type === 'goal');
  const mi = S.myTeam, poss = Math.round(100 * res.poss[mi] / Math.max(1, res.poss[0] + res.poss[1]));
  $('#rep-stats').innerHTML = `<ul class="scorers">${goals.length ? goals.map(e => `<li>${e.min}' ${esc(e.p.name)} (${esc(M.teams[e.team].short)})${e.p2 ? ` <small>Vorlage ${esc(e.p2.name)}</small>` : ''}</li>`).join('') : '<li>Keine Tore.</li>'}</ul>
    <div class="statline"><span>${res.shots[mi][0]}</span><span>SCHÜSSE</span><span>${res.shots[1 - mi][0]}</span></div><div class="statline"><span>${res.shots[mi][1]}</span><span>AUFS TOR</span><span>${res.shots[1 - mi][1]}</span></div><div class="statline"><span>${poss} %</span><span>BALLBESITZ</span><span>${100 - poss} %</span></div>${res.corners ? `<div class="statline"><span>${res.xg[mi].toFixed(1)}</span><span>XG</span><span>${res.xg[1 - mi].toFixed(1)}</span></div><div class="statline"><span>${res.corners[mi]}</span><span>ECKEN</span><span>${res.corners[1 - mi]}</span></div><div class="statline"><span>${res.fouls[mi]}</span><span>FOULS</span><span>${res.fouls[1 - mi]}</span></div>${res.offsides ? `<div class="statline"><span>${res.offsides[mi]}</span><span>ABSEITS</span><span>${res.offsides[1 - mi]}</span></div>` : ''}` : ''}<div class="statline"><span>${res.yellows.length}</span><span>KARTEN</span><span>${res.players.filter(p => p.team !== mi && p.yellow).length}</span></div>`;
  const mine = res.players.filter(p => p.team === mi).sort((a, b) => b.rating - a.rating);
  const mvp = mine[0]; if (mvp) $('#rep-mvp').innerHTML = `${avatar(mvp, CLUB, 64)}<div><small>${icon('star')} Spieler:in des Spiels</small><b>${esc(mvp.name)}</b><span>${esc(POS[mvp.pos])} · Note ${Math.max(1, Math.min(10, mvp.rating)).toFixed(1)}${mvp.goals ? ' · ' + mvp.goals + ' Tor' + (mvp.goals > 1 ? 'e' : '') : ''}${mvp.assists ? ' · ' + mvp.assists + ' Vorlage' + (mvp.assists > 1 ? 'n' : '') : ''}</span></div>`;
  $('#rep-ratings').innerHTML = mine.map(p => { const v = Math.max(1, Math.min(10, p.rating)); return `<div class="${v >= 7.5 ? 'hi' : v < 5.5 ? 'lo' : ''}">${avatar(p, CLUB, 30)}<span>${esc(p.name)} <small style="color:var(--muted)">${esc(p.pos)}${p.goals ? ' · ⚽' + p.goals : ''}${p.injured ? ' · 🚑' : ''}</small></span><i class="rbar"><b style="width:${v * 10}%"></b></i><b>${v.toFixed(1)}</b></div>`; }).join('');
  const lastMsgs = se.log.slice(-3);
  $('#rep-talk').innerHTML = `<div class="card-head"><span>▸ Nach dem Spiel</span></div>` + lastMsgs.map(m => talkLine(m.who, m.text)).join('');
  const ob = r.objective ? `<div class="${r.objective.ok ? 'ok' : 'miss'}"><span>🎯 Wochenziel: ${esc(r.objective.name)}</span><b>${r.objective.ok ? '+' + fmt(r.objective.bonus) : '✕'}</b></div>` : '';
  $('#rep-money').innerHTML = `<div class="money">${ob}${r.fin && r.fin.home ? `<div><span>Zuschauer</span><b>${r.fin.att.toLocaleString('de-DE')} (${Math.round(r.fin.att / r.fin.cap * 100)} %)</b></div>` : ''}<div><span>Einnahmen (Tickets, TV, Fanshop, Logen, Sponsor)</span><b>+${money(r.fin ? r.fin.income : r.income)}</b></div>${r.fin ? `<div><span>Gehälter & Unterhalt</span><b class="neg">−${money(r.fin.costs)}</b></div><div><span>Bilanz des Spieltags</span><b class="${r.fin.net >= 0 ? '' : 'neg'}">${r.fin.net >= 0 ? '+' : '−'}${money(Math.abs(r.fin.net))}</b></div><div><span>Fan-Stimmung</span><b>${r.fin.fans}</b></div>` : ''}<div><span>Punkte für die Liga</span><b>+${fmt(r.pts)}</b></div><div><span>Budget jetzt</span><b>${money(se.budget)}</b></div></div>`;
  $('#rep-hint').textContent = se.over ? 'Die Saison ist vorbei – weiter zur Auswertung.' : `Nächster Gegner: ${se.opponent.club}`;
  audio.play(r.won ? 'win' : r.draw ? 'confirm' : 'lose');
  show('report');
  setTimeout(() => achShow(achUnlock(achAfterMatch(se, res, r, S.myTeam), KIOSK)), 900);
}
$('#btn-next-week').addEventListener('click', () => { audio.play('click'); const se = SE(); if (se.over) showResult(se.result); else { S.tab = 'home'; S.radioUnread = 0; renderWeek(); show('week'); } });

// ---------------- Elfmeter selbst schießen / halten, Elfmeterschießen ----------------
let penTimer = null;
function soBoard() { const so = M && M.shootout; const el = $('#so-board'); if (!so) { el.hidden = true; return; } el.hidden = false; const row = (ti) => { const l = so.log[ti], n = Math.max(5, l.length); return `<span>${esc(M.teams[ti].short)}</span><span class="dots">${Array.from({ length: n }, (_, i) => `<i class="${l[i] === 1 ? 'g' : l[i] === 0 ? 'm' : ''}"></i>`).join('')}</span><b>${so.score[ti]}</b>`; }; el.innerHTML = row(0) + row(1); }
function showPenUI(info) {
  const ui = $('#pen-ui'), shoot = info.shoot, goal = $('#pen-goal'); clearInterval(penTimer);
  $('#pen-title').textContent = shoot ? (info.shootout ? tr('Elfmeterschießen – du schießt') : tr('Elfmeter – wohin schießt du?')) : (info.shootout ? tr('Elfmeterschießen – du hältst') : tr('Elfmeter gegen uns – wohin springst du?'));
  $('#pen-sub').textContent = shoot ? `${info.taker.name} · ${tr('Schuss')} ${Math.round(info.taker.schuss)}` : `${info.keeper.name} ${tr('gegen')} ${info.taker.name}`;
  goal.className = 'pen-goal' + (shoot ? '' : ' keep');
  goal.innerHTML = shoot ? [[-1, 1, 'Links oben'], [0, 1, 'Mitte oben'], [1, 1, 'Rechts oben'], [-1, 0, 'Links flach'], [0, 0, 'Mitte flach'], [1, 0, 'Rechts flach']].map(([c, h, l]) => `<button data-c="${c}" data-h="${h}">${esc(tr(l))}<small>${h ? esc(tr('schwer zu halten, kann drübergehen')) : c ? esc(tr('sicher, aber haltbar')) : esc(tr('frech'))}</small></button>`).join('')
    : [[-1, 'Links'], [0, 'Stehen bleiben'], [1, 'Rechts']].map(([c, l]) => `<button data-d="${c}">${esc(tr(l))}</button>`).join('');
  const pick = (c) => { clearInterval(penTimer); ui.querySelectorAll('button').forEach(b => b.disabled = true); audio.play('click'); M.choosePenalty(c); setTimeout(() => { if (!M.shootout) ui.hidden = true; else goal.innerHTML = ''; }, 300); };
  goal.querySelectorAll('button').forEach(b => b.onclick = () => pick(b.dataset.d !== undefined ? { dive: +b.dataset.d } : { col: +b.dataset.c, high: b.dataset.h === '1' }));
  ui.hidden = false; soBoard(); const t0 = performance.now(), dur = 8000, bar = $('#pen-timer');
  penTimer = setInterval(() => { const k = 1 - (performance.now() - t0) / dur; bar.style.width = Math.max(0, k * 100) + '%'; if (k <= 0) { const r = Math.random(); pick(shoot ? { col: r < 0.35 ? -1 : r < 0.65 ? 0 : 1, high: Math.random() < 0.3 } : { dive: r < 0.4 ? -1 : r < 0.6 ? 0 : 1 }); } }, 100);
  audio.play('chance');
}
function showFkUI(info) {
  const ui = $('#pen-ui'), goal = $('#pen-goal'); clearInterval(penTimer);
  $('#pen-title').textContent = tr('Freistoß – wie führst du aus?'); $('#pen-sub').textContent = `${info.taker.name} · ${info.dist} m · ${tr('Mauer')}: ${info.wall}`;
  goal.className = 'pen-goal keep'; goal.innerHTML = [['top', 'Über die Mauer ins Eck', 'schwer zu halten, Mauer selten im Weg'], ['low', 'Flach ins Torwarteck', 'überrascht, aber oft in der Mauer'], ['cross', 'Flanke in den Strafraum', 'Kopfballduell statt Schuss']].map(([k, l, d]) => `<button data-k="${k}">${esc(tr(l))}<small>${esc(tr(d))}</small></button>`).join('');
  const pick = (k) => { clearInterval(penTimer); audio.play('click'); M.chooseFreeKick(k); ui.hidden = true; };
  goal.querySelectorAll('button').forEach(b => b.onclick = () => pick(b.dataset.k));
  $('#so-board').hidden = true; ui.hidden = false; const t0 = performance.now(), dur = 8000, bar = $('#pen-timer');
  penTimer = setInterval(() => { const k = 1 - (performance.now() - t0) / dur; bar.style.width = Math.max(0, k * 100) + '%'; if (k <= 0) pick(['top', 'low', 'cross'][Math.floor(Math.random() * 3)]); }, 100);
  audio.play('chance');
}
function hidePenUI() { clearInterval(penTimer); $('#pen-ui').hidden = true; }
function startShootoutUI() { audio.play('whistle3'); banner(tr('ELFMETERSCHIESSEN'), tr('Unentschieden nach 90 Minuten'), false, 3200); M.startShootout(); $('#pen-ui').hidden = false; $('#pen-goal').innerHTML = ''; $('#pen-title').textContent = tr('Elfmeterschießen'); $('#pen-sub').textContent = ''; $('#pen-timer').style.width = '0%'; soBoard(); }

// ---------------- TechHub-Pokal: K.-o.-Runden bis zum Finale gegen den Monolithen, Unentschieden → Elfmeterschießen ----------------
const CUP_ROUNDS = ['Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale'];
function openCup() {
  const pool = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5).slice(0, 3); S.cupRun = { round: 0, opps: [...pool, 6], res: [] };
  $('#mini-title').textContent = tr('TechHub-Pokal');
  $('#mini-body').innerHTML = `<div class="scen"><b>${esc(tr('TechHub-Pokal'))}</b><span>${esc(tr('Vier K.-o.-Spiele bis zum Finale gegen den Legacy-Monolith FC. Unentschieden? Dann entscheidet das Elfmeterschießen – du schießt und hältst selbst.'))}</span></div>${cupBracket()}<div class="row"><button class="btn primary big" id="cup-go">${esc(tr('Anpfiff'))}</button></div>`;
  $('#cup-go').onclick = () => cupPlay(); $('#mini-modal').hidden = false;
}
function cupBracket() { const C = S.cupRun; return `<table>${C.opps.map((oi, i) => { const r = C.res[i]; return `<tr class="${i === C.round && !C.out ? 'me' : ''}"><td>${esc(tr(CUP_ROUNDS[i]))}</td><td>${esc(OPPONENTS[oi].club)}</td><td>${r ? `${r.gf}:${r.ga}${r.so ? ` (${r.so[0]}:${r.so[1]} i. E.)` : ''} ${r.won ? '✓' : '✗'}` : '–'}</td></tr>`; }).join('')}</table>`; }
function cupPlay() { const C = S.cupRun, oi = C.opps[C.round], o = OPPONENTS[oi]; startMini({ kind: 'cup', title: `${tr('TechHub-Pokal')} · ${tr(CUP_ROUNDS[C.round])}`, text: `${tr('gegen')} ${o.club}`, min: 0, score: [0, 0], oppIndex: oi, seed: Date.now() & 0xffff, weather: ['sun', 'rain', 'sun', 'wind'][C.round] }); }
function cupAfter(mini, res, mi, gf, ga) {
  const C = S.cupRun, so = res.so ? [res.so[mi], res.so[1 - mi]] : null, won = gf > ga || (gf === ga && so && so[0] > so[1]);
  C.res[C.round] = { gf, ga, so, won }; if (!won) C.out = true;
  if (won && so) setTimeout(() => achShow(achUnlock(['pen_hero'], KIOSK)), 1500);
  const champion = won && C.round === CUP_ROUNDS.length - 1;
  audio.play(won ? 'win' : 'lose');
  const restore = () => { S.season = mini.keep; S.gameId = mini.keepGame; S.diff = mini.keepDiff; S.mini = null; };
  $('#mini-title').textContent = tr('TechHub-Pokal');
  $('#mini-body').innerHTML = `<div class="scen"><b>${esc(mini.title)}</b><span>${esc(mini.text)}</span></div><div class="sc-big">${gf} : ${ga}${so ? `<small style="display:block;font-size:18px">${so[0]}:${so[1]} ${esc(tr('im Elfmeterschießen'))}</small>` : ''}</div><div class="pts">${champion ? esc(tr('POKALSIEGER! Der Monolith ist gestürzt.')) : won ? esc(tr('Weiter in die nächste Runde!')) : esc(tr('Ausgeschieden.'))}</div>${cupBracket()}<div class="row">${won && !champion ? `<button class="btn primary big" id="cup-next">${esc(tr(CUP_ROUNDS[C.round + 1]))} ›</button>` : `<button class="btn" id="cup-again">${esc(tr('Neuer Pokal'))}</button>`}<button class="btn" id="mini-home">${esc(tr('Zur Startseite'))}</button></div>`;
  $('#mini-modal').hidden = false;
  if (champion) { try { localStorage.setItem('brcm-cup', String((+localStorage.getItem('brcm-cup') || 0) + 1)); } catch { /* ignore */ } achShow(achUnlock(['cup'], KIOSK)); const fx = new Confetti($('#ft-fx')); fx.rain(300); setTimeout(() => fx.stop(), 7000); }
  $('#mini-home').onclick = () => { audio.play('click'); $('#mini-modal').hidden = true; restore(); goTitle(); };
  const nx = $('#cup-next'); if (nx) nx.onclick = () => { audio.play('confirm'); restore(); C.round++; cupPlay(); };
  const ag = $('#cup-again'); if (ag) ag.onclick = () => { audio.play('click'); restore(); openCup(); };
}
$('#btn-cup').addEventListener('click', () => { audio.unlock(); audio.play('click'); openCup(); });

// ---------------- Tages-Challenge & Duell ----------------
const DAILY = [
  { id: 'comeback', title: 'Die Aufholjagd', text: '0:2 hinten, noch 30 Minuten – dreh das Spiel!', min: 60, score: [0, 2] },
  { id: 'hold', title: 'Die Abwehrschlacht', text: '1:0 vorn, noch 20 Minuten gegen den Mainframe-Koloss – bring es nach Hause.', min: 70, score: [1, 0], opp: 6 },
  { id: 'ten', title: 'Zu zehnt', text: '1:1 nach einem Platzverweis gegen uns – noch 25 Minuten.', min: 65, score: [1, 1], red: true },
  { id: 'storm', title: 'Sturmspiel', text: '0:0 bei Sturm, noch 30 Minuten – ein Tor entscheidet.', min: 60, score: [0, 0], weather: 'wind' },
  { id: 'snow', title: 'Schneechaos', text: '1:2 im Schneetreiben, noch 25 Minuten.', min: 65, score: [1, 2], weather: 'snow' },
  { id: 'festival', title: 'Torfestival', text: '2:2, noch 30 Minuten im Spektakel-Modus – jedes Tor zählt.', min: 60, score: [2, 2], spect: true },
  { id: 'rain', title: 'Regenschlacht', text: '0:1 im Dauerregen, noch 35 Minuten.', min: 55, score: [0, 1], weather: 'rain' },
];
function dailyToday() { const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }), n = Math.floor(Date.parse(date) / 864e5), sc = DAILY[n % DAILY.length]; return { date, n, sc, opp: sc.opp ?? (n * 3) % OPPONENTS.length }; }
// Punkte der Tages-Challenge: Ergebnis, eigene Tore im Zeitfenster, Gegentore
function dailyPoints(sc, res, mi) { const gf = (mi === 0 ? res.gh : res.ga), ga = (mi === 0 ? res.ga : res.gh), dgf = gf - sc.score[0], dga = ga - sc.score[1]; return Math.max(0, (gf > ga ? 1200 : gf === ga ? 500 : 0) + dgf * 250 - dga * 120 + (res.shots ? res.shots[mi][1] * 20 : 0)); }
async function startMini(cfg) {
  audio.unlock(); audio.play('whistle');
  S.mini = { ...cfg, keep: S.season, keepGame: S.gameId, keepDiff: S.diff };
  const se = new Season({ difficulty: 'profi', length: 'short', seed: cfg.seed || 77, hooks: {} }); if (cfg.oppIndex !== undefined) se.day = cfg.oppIndex;
  S.season = se; S.gameId = null; S.diff = 'profi';
  if (cfg.kind === 'daily') { try { const r = await api('/api/game/start', { mission: 'daily', difficulty: 'profi' }, 4000); S.gameId = r.gameId; } catch { /* offline */ } }
  $('#mini-modal').hidden = true;
  await ensurePitch();
  startMatch({ ...cfg, meTeam: cfg.meTeam || se.teamForMatch(), oppTeam: cfg.oppTeam, oppClub: cfg.oppClub });
}
function applyMini(mini) {
  if (!mini.min) return;
  M.t = mini.min * MATCH_REAL / 90; M.min = mini.min; M.halfDone = mini.min >= 45; M.score = [...mini.score]; $('#sc-val').textContent = `${M.score[0]} : ${M.score[1]}`; $('#sc-phase').textContent = mini.min >= 45 ? '2. Halbzeit' : '1. Halbzeit';
  if (mini.red) { const c = M.alive(S.myTeam).filter(p => p.pos !== 'TW' && p.pos !== 'ST'); const p = c[Math.floor(Math.random() * c.length)]; if (p) { p.out = true; p.red = true; } }
  M.kickoff(1 - S.myTeam);
}
async function endMini(res) {
  matchRun = false; audio.setCrowd(0.2); hidePenUI(); const mini = S.mini; if (!mini) return; const mi = S.myTeam, gf = mi === 0 ? res.gh : res.ga, ga = mi === 0 ? res.ga : res.gh;
  if (mini.kind === 'cup') return cupAfter(mini, res, mi, gf, ga);
  const won = gf > ga;
  audio.play(won ? 'win' : gf === ga ? 'confirm' : 'lose');
  const body = $('#mini-body'); $('#mini-title').textContent = mini.kind === 'daily' ? 'Tages-Challenge' : 'Duell';
  const pts = mini.kind === 'daily' ? dailyPoints(mini, res, mi) : null;
  body.innerHTML = `<div class="scen"><b>${esc(mini.title)}</b><span>${esc(mini.text)}</span></div><div class="sc-big">${gf} : ${ga}</div>${pts !== null ? `<div class="pts">${fmt(pts)} Punkte</div>` : `<div class="pts">${won ? 'Duell gewonnen!' : gf === ga ? 'Unentschieden' : 'Duell verloren'}</div>`}<div id="mini-board"><p class="hint">Wird gewertet …</p></div><div class="row"><button class="btn" id="mini-again">Nochmal</button><button class="btn primary" id="mini-home">Zur Startseite</button></div>`;
  const restore = () => { S.season = mini.keep; S.gameId = mini.keepGame; S.diff = mini.keepDiff; S.mini = null; };
  $('#mini-home').onclick = () => { audio.play('click'); $('#mini-modal').hidden = true; restore(); goTitle(); };
  $('#mini-again').onclick = () => { audio.play('click'); restore(); if (mini.kind === 'daily') openDaily(true); else startDuel(mini.code); };
  $('#mini-modal').hidden = false;
  try {
    if (mini.kind === 'daily') {
      if (S.gameId) await api('/api/scores', { gameId: S.gameId, name: S.player.name || 'Gast', company: S.player.company, teamCode: S.player.team, mission: 'daily', difficulty: 'profi', score: pts, won, duration: gf, stats: { challenge: mini.id, gf, ga } });
      const d = await api(`/api/leaderboard?mission=daily&daily=${dailyToday().date}&limit=10`);
      $('#mini-board').innerHTML = `<h3>Heute</h3><table>${d.rows.map((r, i) => `<tr class="${r.name === (S.player.name || 'Gast') && r.score === pts ? 'me' : ''}"><td>${i + 1}</td><td>${esc(r.name)}</td><td class="muted">${esc(r.company || '')}</td><td>${fmt(r.score)}</td></tr>`).join('') || '<tr><td>–</td></tr>'}</table>`;
    } else {
      await api(`/api/duel/${mini.code}/result`, { name: S.player.name || 'Gast', gf, ga });
      const d = await api(`/api/duel/${mini.code}`);
      $('#mini-board').innerHTML = `<h3>Herausforderungen gegen ${esc(d.name)}</h3><table>${d.results.map(r => `<tr><td>${esc(r.name)}</td><td>${r.gf} : ${r.ga}</td></tr>`).join('')}</table>`;
    }
  } catch { $('#mini-board').innerHTML = '<p class="hint">Bestenliste gerade nicht erreichbar.</p>'; }
}
function goTitle() { if (typeof showTitle === 'function') showTitle(); else show('title'); }
function openDaily(direct) {
  const D = dailyToday(), o = OPPONENTS[D.opp], sc = D.sc;
  const go = () => startMini({ kind: 'daily', ...sc, title: `Tages-Challenge: ${sc.title}`, oppIndex: D.opp, seed: D.n });
  if (direct) return go();
  $('#mini-title').textContent = 'Tages-Challenge';
  $('#mini-body').innerHTML = `<div class="scen"><b>${esc(sc.title)}</b><span>${esc(sc.text)}</span></div><p>Gegner: <b>${esc(o.club)}</b> · ${sc.weather ? esc(WEATHER[sc.weather]?.name || '') : 'Flutlicht'} · alle spielen mit demselben Kader.</p><div id="mini-board"><p class="hint">Bestenliste wird geladen …</p></div><div class="row"><button class="btn primary big" id="mini-go">Anpfiff</button></div>`;
  $('#mini-go').onclick = go; $('#mini-modal').hidden = false;
  api(`/api/leaderboard?mission=daily&daily=${D.date}&limit=10`).then(d => { $('#mini-board').innerHTML = `<h3>Heute (${esc(D.date)})</h3><table>${d.rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td class="muted">${esc(r.company || '')}</td><td>${fmt(r.score)}</td></tr>`).join('') || '<tr><td>Noch niemand – sei die oder der Erste!</td></tr>'}</table>`; }).catch(() => { $('#mini-board').innerHTML = ''; });
}
function duelTeamOf(se) { const T = se.teamForMatch(); return { name: `${CLUB.name} (${S.player.name || 'Gast'})`, short: (S.player.name || 'Duell').slice(0, 10).toUpperCase(), formation: T.formation, style: T.style, tempo: T.tempo, cornerVar: T.cornerVar, players: T.players.map(p => ({ name: p.name, nick: p.nick, pos: p.pos, role: p.role, slot: p.slot, num: p.num, tempo: p.tempo, technik: p.technik, abwehr: p.abwehr, schuss: p.schuss, kondition: p.kondition })) }; }
function myDuels() { try { return JSON.parse(localStorage.getItem('brcm-duels')) || []; } catch { return []; } }
function openDuel() {
  $('#mini-title').textContent = 'Duell';
  const mine = myDuels();
  $('#mini-body').innerHTML = `<p>Gib den Duell-Code ein, den dir jemand geschickt hat. Du trittst mit ${S.season && !S.season.over ? 'deinem aktuellen Team' : 'dem TechHub-Kader'} an.</p><div class="row"><input class="code" id="duel-code" maxlength="5" placeholder="CODE" autocomplete="off"><button class="btn primary" id="duel-go">Antreten</button></div><p class="hint">Eigenen Code erstellst du in der Saison unter Taktik → Duell.</p><div id="mini-board">${mine.length ? '<h3>Deine Duell-Codes</h3><p class="hint">Ergebnisse werden geladen …</p>' : ''}</div>`;
  $('#duel-go').onclick = () => { const c = $('#duel-code').value.trim().toUpperCase(); if (/^[A-Z0-9]{5}$/.test(c)) startDuel(c); else toast(tr('Bitte einen fünfstelligen Code eingeben.')); };
  $('#mini-modal').hidden = false;
  if (mine.length) Promise.all(mine.slice(-5).reverse().map(c => api(`/api/duel/${c}`).catch(() => null))).then(list => { $('#mini-board').innerHTML = '<h3>Deine Duell-Codes</h3>' + list.filter(Boolean).map(d => `<p><code>${esc(d.code)}</code> · ${d.results.length} Herausforderung(en)</p><table>${d.results.slice(0, 5).map(r => `<tr><td>${esc(r.name)}</td><td>${r.gf} : ${r.ga}</td></tr>`).join('')}</table>`).join(''); });
}
async function startDuel(code) {
  let d; try { d = await api(`/api/duel/${code}`); } catch (e) { toast(tr('Duell-Code nicht gefunden.')); return; }
  const T = d.team, own = S.season && !S.season.over && !S.mini ? S.season : null;
  const oppTeam = { ...T, color: '#ff6a3d', color2: '#1a1a1a', bench: [], ai: null, me: false, players: T.players.map((p, i) => ({ ...p, slot: p.slot || [p.pos, 0.5, 0.5], num: p.num || i + 1 })) };
  startMini({ kind: 'duel', code, title: `Duell gegen ${d.name}`, text: `Code ${code} · ${T.players.length} Spieler · ${STYLES[T.style]?.name || ''}`, min: 0, score: [0, 0], weather: 'sun', oppTeam, oppClub: { club: T.name, short: T.short, color: '#ff6a3d', color2: '#1a1a1a' }, meTeam: own ? own.teamForMatch() : null });
}
$('#btn-daily').addEventListener('click', () => { audio.unlock(); audio.play('click'); openDaily(false); });
$('#btn-duel').addEventListener('click', () => { audio.unlock(); audio.play('click'); openDuel(); });
$('#btn-mini-close').addEventListener('click', () => { audio.play('click'); $('#mini-modal').hidden = true; if (S.mini && !matchRun) { S.season = S.mini.keep; S.gameId = S.mini.keepGame; S.diff = S.mini.keepDiff; S.mini = null; goTitle(); } });
$('#btn-duel-share').addEventListener('click', async () => { const se = SE(); if (!se) return; audio.play('click');
  try { const r = await api('/api/duel', { name: S.player.name || 'Gast', team: duelTeamOf(se) }); const l = myDuels(); l.push(r.code); try { localStorage.setItem('brcm-duels', JSON.stringify(l.slice(-10))); } catch { /* ignore */ }
    $('#duel-share-out').innerHTML = `Dein Code: <code>${esc(r.code)}</code> – auf der Startseite unter „Duell“ eingeben.`; try { await navigator.clipboard?.writeText(r.code); toast(tr('Code kopiert.')); } catch { /* ignore */ } }
  catch (e) { toast(tr('Duell-Code konnte nicht erstellt werden.')); } });
{ const D = dailyToday(); const el = $('#daily-sub'); if (el) el.textContent = `Heute: ${D.sc.title}`; }

// Highlights: Zusammenschnitt der aufgezeichneten Szenen auf dem Spielfeld
function playHighlights() {
  if (!pitch || !pitch.clips || !pitch.clips.length || !M) return;
  const clips = pitch.clips.slice(0, 8); let i = 0, tm = null; const back = S.screen;
  const end = () => { clearTimeout(tm); pitch.stopReplay(); $('#hl-bar').hidden = true; $('#replay-tag').hidden = true; show(back); };
  const next = () => { if (i >= clips.length || S.screen !== 'match') return end(); const c = clips[i++]; $('#hl-label').textContent = `${i}/${clips.length} · ${c.label}`; audio.play(c.kind === 'goal' ? 'goal' : 'ooh', 0.6); const d = pitch.playClip(M, c); tm = setTimeout(next, d + 300); };
  $('#btn-hl-skip').onclick = () => { audio.play('click'); end(); };
  show('match'); $('#hl-bar').hidden = false; $('#replay-tag').hidden = false; $('#fulltime').hidden = true; next();
}
$('#btn-highlights').addEventListener('click', () => { audio.play('click'); playHighlights(); });

// ---------------- Saisonende ----------------
function endSeason(r) { S.finalResult = r; }
async function showResult(r) {
  const se = SE(); S.finalResult = r; audio.setCrowd(0);
  if (!S.ceremonyDone) {
    S.ceremonyDone = true; clearSave(); saveStats(r, se); S.seasonAch = achUnlock(achAfterSeason(se, r), KIOSK); const sc = $('#screen-ceremony'); sc.className = 'screen ' + (r.won ? 'win' : 'lose'); show('ceremony');
    $('#cer-trophy').hidden = !r.won; $('#cer-sub').textContent = r.won ? 'Legacy League · Saison beendet' : 'Saisonende';
    $('#cer-title').textContent = r.won ? 'MEISTER!' : r.rank <= 3 ? `PLATZ ${r.rank}` : 'SAISONENDE';
    $('#cer-text').textContent = r.won ? `${S.player.name} führt TechHub United zum Titel – der Legacy-Monolith FC ist gestürzt.` : r.rank <= 3 ? `${S.player.name} und TechHub United landen auf Platz ${r.rank}. Die Legacy-IT bleibt knapp vorn.` : `Platz ${r.rank} für TechHub United. Die Legacy-KI hat diese Saison gewonnen.`;
    const fx = new Confetti($('#cer-fx')); if (r.won) { setTimeout(() => fx.rain(320), 600); setTimeout(() => fx.rain(200, ['#f3c74a', '#fff3b0', '#ffffff']), 3000); setTimeout(() => fx.rain(200), 6000); }
    playCeremony({ canvas: $('#cer-canvas'), season: se, rank: r.rank, won: r.won, name: S.player.name, audio, voice, tr, lang: LANG, nextBtn: $('#btn-cer-next'), onDone: () => { fx.stop(); if (S.screen === 'ceremony') showResult(r); } });
    return;
  }
  const head = $('#result-head'); head.className = 'result-head ' + (r.won ? 'win' : 'lose');
  $('#result-title').textContent = r.won ? 'MEISTER!' : r.rank <= 6 ? `PLATZ ${r.rank}` : 'ABGESTIEGEN';
  $('#result-reason').textContent = `${r.reason} · ${DIFFICULTY[se.diffKey].name}`;
  const grade = r.score >= 12000 ? 'S' : r.score >= 9000 ? 'A' : r.score >= 6500 ? 'B' : r.score >= 4000 ? 'C' : 'D';
  const gr = $('#grade'); gr.className = 'grade g-' + grade; gr.querySelector('b').textContent = grade;
  const ps = se.players, byG = [...ps].sort((a, b) => b.goals - a.goals || b.assists - a.assists)[0], byA = [...ps].sort((a, b) => b.assists - a.assists || b.goals - a.goals)[0], byR = [...ps].filter(p => p.apps).sort((a, b) => rating(b) - rating(a))[0], young = [...ps].filter(p => p.age < 24 && p.apps).sort((a, b) => b.goals + b.assists - a.goals - a.assists || rating(b) - rating(a))[0];
  const aw = [byG && byG.goals ? ['Torschützenkönig:in', byG, `${byG.goals} Tore`] : null, byA && byA.assists ? ['Vorlagengeber:in', byA, `${byA.assists} Vorlagen`] : null, byR ? ['Spieler:in der Saison', byR, `Stärke ${rating(byR)} · ${byR.apps} Spiele`] : null, young ? ['Talent der Saison', young, `${young.age} J. · ${young.goals + young.assists} Scorerpunkte`] : null].filter(Boolean);
  $('#awards').innerHTML = aw.map(([t, p, d]) => `<div class="award">${avatar(p, CLUB, 48)}<div><small>${icon('trophy')} ${t}</small><b>${esc(p.name)}</b><span>${esc(d)}</span></div></div>`).join('') || '<p class="hint">–</p>';
  { const el = $('#result-score'); const t0 = performance.now(); const tick = () => { const k = Math.min(1, (performance.now() - t0) / 1600), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(Math.round(r.score * e)); if (k < 1) requestAnimationFrame(tick); }; tick(); }
  const b = r.breakdown;
  $('#result-breakdown').innerHTML = [['Spielpunkte (Siege, Tore, Zu-null)', b.base], ['Tabellenplatz', b.place], ['Wirtschaft (Budget, Vermögen, Fans)', b.eco], ['Schwierigkeit', `× ${b.mult}`]].map(([k, v]) => `<tr><td>${esc(k)}</td><td>${typeof v === 'number' ? fmt(v) : v}</td></tr>`).join('');
  tableRows($('#final-table tbody'), false); resultRows($('#final-results'));
  $('#result-beat').className = 'beat'; $('#result-rank').textContent = 'Wird gewertet …';
  $('#voucher-form').hidden = false; $('#voucher-msg').textContent = ''; $('#in-email').value = ''; $('#in-consent').checked = false; $('#voucher-form').querySelector('button').disabled = false;
  $('#btn-career').hidden = KIOSK; $('#btn-career').textContent = r.won && se.league !== 'cloud' ? `Aufstieg: Saison ${(se.seasonNo || 1) + 1} in der Cloud League` : `Karriere fortsetzen: Saison ${(se.seasonNo || 1) + 1}`;
  audio.play(r.won ? 'win' : 'lose'); show('result'); if (S.seasonAch) { achShow(S.seasonAch); S.seasonAch = null; }
  try {
    const res = await api('/api/scores', { gameId: S.gameId, name: S.player.name, company: S.player.company, teamCode: S.player.team, mission: 'league', difficulty: se.diffKey, score: r.score, won: r.won, duration: r.rank, stats: { ...se.stats, rank: r.rank, results: se.results.map(x => `${x.gf}:${x.ga}`), events: se.events.map(e => e.event) } });
    S.scoreRow = res; if (res.beat) achShow(achUnlock(['beat_rc'], KIOSK));
    if (KIOSK && res.id && res.editToken && !res.team) { $('#voucher-qr').hidden = false; drawQR($('#voucher-qr-c'), `${PLAY_URL}?voucher=${res.id}.${res.editToken}`); } else $('#voucher-qr').hidden = true;
    $('#result-rank').textContent = res.rank === '–' ? 'Ergebnis wird von der Spielleitung geprüft.' : `Platz ${res.rank} von ${res.total} · ${DIFFICULTY[se.diffKey].name}`;
    const beat = $('#result-beat');
    if (res.team) { beat.className = 'beat on yes'; beat.textContent = 'RealCore-Team-Ergebnis – zählt als Benchmark für die Liga.'; $('#voucher-form').hidden = true; }
    else if (res.benchmark) { if (res.beat) { beat.className = 'beat on yes'; beat.textContent = `🏆 Ihr habt RealCore geschlagen! (Benchmark: ${fmt(res.benchmark.score)} von ${res.benchmark.name})`; $('#voucher-title').textContent = 'Euer Gutschein wartet!'; $('#voucher-text').textContent = 'Ihr seid besser als das RealCore-Team. Tragt eure E-Mail ein – wir melden uns mit eurem TechHub-Gutschein.'; } else { beat.className = 'beat on no'; beat.textContent = `RealCore-Benchmark: ${fmt(res.benchmark.score)} (${res.benchmark.name}) – es fehlen ${fmt(res.benchmark.score - r.score)} Punkte. Revanche?`; } }
  } catch { $('#result-rank').textContent = 'Bestenliste gerade nicht erreichbar.'; $('#voucher-form').hidden = true; }
  loadDebrief(r);
}
async function loadDebrief(r) {
  const se = SE(); const worst = [...se.results].sort((a, b) => (a.gf - a.ga) - (b.gf - b.ga))[0]; const o = OPPONENTS.find(x => x.id === (worst ? worst.opp : 'monolith'));
  $('#debrief-tag').textContent = 'Analyse';
  $('#debrief-head').textContent = r.won ? 'Clean Core gewinnt Meisterschaften.' : `${o.club}: die Legacy-IT war diesmal stärker.`;
  $('#debrief-text').textContent = o.real;
  $('#debrief-q').innerHTML = ['Wo hängt eure Transformation gerade – in der Abwehr (Betrieb) oder im Sturm (Innovation)?', 'Welches Altsystem spielt bei euch noch in der Startelf?', 'Wie viele „Change Requests“ bremsen euch pro Woche?'].map(q => `<li>${esc(q)}</li>`).join('');
  $('#debrief-offer').innerHTML = o.offer.map(x => `<span>${esc(x)}</span>`).join('');
  if (!S.config.ai) return;
  try { const d = await api('/api/ai/debrief', { lang: LANG, mission: 'league', won: r.won, score: r.score, duration: r.rank, company: S.player.company, stats: { rank: r.rank, ...se.stats, worst: o.club } }, 9000);
    if (d && d.text) { $('#debrief-tag').textContent = 'KI-Analyse'; $('#debrief-head').textContent = d.headline; $('#debrief-text').textContent = d.text; if (d.questions?.length) $('#debrief-q').innerHTML = d.questions.map(q => `<li>${esc(q)}</li>`).join(''); } } catch { /* lokal */ }
}
$('#voucher-form').addEventListener('submit', async (e) => {
  e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true;
  try { await api('/api/scores/contact', { id: S.scoreRow?.id, token: S.scoreRow?.editToken, email: $('#in-email').value.trim(), consent: $('#in-consent').checked }); $('#voucher-msg').textContent = 'Danke! Ihr seid im Rennen. Wir melden uns per E-Mail.'; audio.play('confirm'); }
  catch (err) { $('#voucher-msg').textContent = 'Das hat nicht geklappt: ' + err.message; btn.disabled = false; }
});
$('#btn-again').addEventListener('click', () => { audio.play('click'); startBriefing(); });
$('#btn-career').addEventListener('click', async () => { audio.play('confirm'); const old = SE(); if (!old) return; S.gameId = null; try { const r = await api('/api/game/start', { mission: 'league', difficulty: S.diff }, 4000); S.gameId = r.gameId; } catch { /* offline */ }
  S.season = old.nextSeason(seasonHooks()); S.tab = 'home'; S.selSlot = null; S.ceremonyDone = false; S.radioUnread = S.season.log.length; renderWeek(); show('week'); writeSave(); toast(`Saison ${S.season.seasonNo}${S.season.league === 'cloud' ? ' · Cloud League' : ''} – der Kader ist ein Jahr älter.`); });
$('#btn-new').addEventListener('click', () => { audio.play('click'); S.player = { name: '', company: '', team: '' }; showSetup(); });
$('#btn-board2').addEventListener('click', () => { audio.play('click'); showBoard(); });

// ---------------- Bestenliste ----------------
function showBoard() {
  const mk = (el, opts, key) => { el.innerHTML = opts.map(([k, n]) => `<button data-k="${k}" class="${S.board[key] === k ? 'on' : ''}">${n}</button>`).join(''); el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { S.board[key] = b.dataset.k; audio.play('click'); showBoard(); })); };
  mk($('#board-diff'), [['all', 'Alle Stufen'], ...Object.entries(DIFFICULTY).map(([k, d]) => [k, d.name])], 'difficulty');
  mk($('#board-period'), [['today', 'Heute'], ['season', 'Saison'], ['all', 'Gesamt']], 'period');
  show('board'); loadBoard();
}
async function loadBoard() {
  const tb = $('#board-table tbody'); tb.innerHTML = '<tr><td colspan="6">Lade …</td></tr>';
  try {
    const d = await api(`/api/leaderboard?difficulty=${S.board.difficulty}&period=${S.board.period}&limit=50`);
    const myId = S.scoreRow?.id;
    tb.innerHTML = d.rows.length ? d.rows.map((r, i) => `<tr class="${r.team ? 'rc' : ''} ${r.beat ? 'beat' : ''} ${r.id === myId ? 'me' : ''}"><td>${i + 1}</td><td>${esc(r.name)}</td><td class="muted">${esc(r.company || '–')}</td><td class="muted">${esc(DIFFICULTY[r.difficulty]?.name || '')}</td><td class="muted">${r.duration ? r.duration + '.' : '–'}</td><td>${fmt(r.score)}</td></tr>`).join('') : '<tr><td colspan="6">Noch keine Einträge in dieser Auswahl.</td></tr>';
    $('#board-bench').innerHTML = d.benchmarkTop ? `RealCore-Benchmark in dieser Auswahl: <b>${fmt(d.benchmarkTop.score)}</b> von ${esc(d.benchmarkTop.name)} – Kunden darüber erhalten das 🏆 <b>Beat RealCore</b>-Abzeichen.` : 'In dieser Auswahl hat das RealCore-Team noch keinen Benchmark gesetzt.';
  } catch { tb.innerHTML = '<tr><td colspan="6">Bestenliste nicht erreichbar.</td></tr>'; }
}

// QR-Code zeichnen (qrcode-generator, MIT)
let QR = null;
async function drawQR(canvas, text) { try { QR ||= (await import('../vendor/qrcode-1.4.4.js')).default; const q = QR(0, 'M'); q.addData(text); q.make(); const n = q.getModuleCount(), g = canvas.getContext('2d'), s = canvas.width / (n + 2); g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height); g.fillStyle = '#05140d'; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect(Math.floor((c + 1) * s), Math.floor((r + 1) * s), Math.ceil(s), Math.ceil(s)); return true; } catch { return false; } }
const PLAY_URL = location.origin + '/';
// Leaderboard für den zweiten Bildschirm am Stand
function startTvBoard() { S.board = { difficulty: 'all', period: 'today' }; showBoard(); $('#board-qr').hidden = false; $('#board-qr-url').textContent = PLAY_URL.replace(/^https?:\/\//, ''); drawQR($('#board-qr-c'), PLAY_URL); setInterval(() => { if (S.screen === 'board') loadBoard(); }, 20000); }
// Gutschein-Formular auf dem eigenen Handy (?voucher=id.token)
function openVoucherFromQR(v) {
  const [id, token] = String(v).split('.'); $('#mini-title').textContent = 'Gutschein-Verlosung';
  $('#mini-body').innerHTML = `<p>Trag deine E-Mail ein – die besten Ergebnisse gewinnen einen TechHub-Gutschein.</p><form id="qv-form" class="voucher"><input type="email" id="qv-mail" placeholder="name@firma.de" required><label class="check"><input type="checkbox" id="qv-consent" required><span>Ich willige ein, dass RealCore mich zur Gutschein-Vergabe per E-Mail kontaktiert. Widerruf jederzeit möglich.</span></label><button class="btn primary" type="submit">Absenden</button><p id="qv-msg" class="hint"></p></form>`;
  $('#mini-modal').hidden = false;
  $('#qv-form').addEventListener('submit', async (e) => { e.preventDefault(); try { await api('/api/scores/contact', { id: Number(id), token, email: $('#qv-mail').value.trim(), consent: $('#qv-consent').checked }); $('#qv-msg').textContent = 'Danke! Du bist im Rennen.'; e.target.querySelector('button').disabled = true; } catch (err) { $('#qv-msg').textContent = 'Das hat nicht geklappt: ' + err.message; } });
}
// Messe: nach längerer Pause zurück zur Startseite (laufende Spiele bleiben unberührt)
let lastInput = Date.now();
if (KIOSK) { ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true }));
  setInterval(() => { const idle = Date.now() - lastInput; if (S.screen === 'title' || S.screen === 'intro') return; if (S.screen === 'match' && matchRun) return; if (idle > (S.screen === 'result' || S.screen === 'report' || S.screen === 'board' ? 90000 : 150000)) { lastInput = Date.now(); $$('.overlay').forEach(o => { o.hidden = true; }); S.season = null; S.mini = null; S.player = { name: '', company: '', team: '' }; show('title'); } }, 5000); }

// ---------------- Hauptschleife ----------------
function frame(now) {
  requestAnimationFrame(frame); // zuerst neu anmelden: ein Fehler darf die Schleife nie anhalten
  try { frameBody(now); } catch (e) { if (!S.frameErr) { S.frameErr = true; console.error('frame', e); } }
}
function frameBody(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016); lastT = now;
  if (S.screen === 'match' && M) {
    if (!M.paused && !M.over) { if (M.speed >= 10) { let n = 0; while (!M.over && !M.paused && n++ < 400) M.step(1 / 30); } else M.tick(dt); }
    const sc = M.score; if (!M.paused) { $('#sc-min').textContent = M.min > 90 ? `90+${Math.max(1, Math.floor(M.min - 90))}'` : M.halfDone === false && M.min > 45 ? `45+${Math.max(1, Math.floor(M.min - 45))}'` : `${Math.floor(M.min)}'`; $('#tl-fill').style.width = Math.min(100, M.min / 90 * 100) + '%'; if ((M.stepN || 0) % 30 === 0) renderEnergy(); const pt = M.poss[0] + M.poss[1]; if (pt > 1 && (M.stepN || 0) % 20 === 0) { const l = Math.round(100 * M.poss[S.myTeam] / pt); $('#poss > i').style.width = l + '%'; $('#poss-l').textContent = l + ' %'; $('#poss-r').textContent = (100 - l) + ' %'; } }
    if (S.ftOrbit && pitch && pitch.setCine) { const t = (now - S.ftOrbit.t0) / 1000, mine = M.players.filter(p => p.team === S.myTeam && !p.out); const cx = mine.reduce((a, p) => a + p.x, 0) / Math.max(1, mine.length), cz = mine.reduce((a, p) => a + p.y, 0) / Math.max(1, mine.length); pitch.setCine({ alpha: -Math.PI / 2 + t * 0.28, beta: 1.08, radius: 30 + t * 1.2, tx: cx, tz: cz, ty: 1.2 }); }
    if (pitch) pitch.draw(M, dt); drawMomentum(); if (pitch && pitch.kicked) { pitch.kicked = false; if (M.speed <= 2) audio.play('kick', 0.5); }
    const excite = Math.min(1, 0.4 + Math.abs(sc[0] - sc[1]) * 0.1 + (M.ball.mode === 'shot' ? 0.4 : 0)); audio.setCrowd(excite * 0.8);
    if (!M.paused && !M.over && M.speed <= 1 && voice.idle && now - voice.lastEnd > 14000 && now - (S.fillerT || 0) > 24000) { S.fillerT = now; speakFiller(); }
    if (!M.paused && !M.over && M.speed <= 2 && now > (S.chantT || 0)) { const fans = SE()?.econ?.fans ?? 50, lead = M.score[S.myTeam] - M.score[1 - S.myTeam]; if (S.chantT) audio.play('chant', 0.5 + Math.min(0.5, fans / 200 + Math.max(0, lead) * 0.1)); S.chantT = now + 26000 - Math.min(12000, fans * 80) + Math.random() * 12000; }
  } else if (S.screen === 'title' || S.screen === 'setup' || S.screen === 'brief' || S.screen === 'board' || S.screen === 'howto' || S.screen === 'privacy' || S.screen === 'result' || S.screen === 'report') {
    if (bgMatch && bg3 && S.screen === 'title') { bgMatch.tick(dt); if (bgMatch.over) { if (!S.bgOverT) S.bgOverT = now; else if (now - S.bgOverT > 4000) { S.bgOverT = 0; newBg(); } }
      const t = (now - bg3T0) / 1000, b = bgMatch.ball; S.bgTx = (S.bgTx ?? 52) + ((b.x * 0.55 + 52 * 0.45) - (S.bgTx ?? 52)) * Math.min(1, dt * 0.6); S.bgTz = (S.bgTz ?? 34) + ((b.y * 0.5 + 34 * 0.5) - (S.bgTz ?? 34)) * Math.min(1, dt * 0.6);
      bg3.setCine({ alpha: -Math.PI / 2 - 0.55 + Math.sin(t * 0.045) * 0.9, beta: 1.02 + Math.sin(t * 0.07) * 0.1, radius: Math.max(46, 74 - t * 2.4) + Math.sin(t * 0.05) * 6, tx: S.bgTx, tz: S.bgTz, ty: 0.6 }); if (S.heroVis) bg3.draw(bgMatch, dt); updateLiveCard(now); }
    else if (bgMatch) { bgMatch.tick(dt); if (bgMatch.over) newBg(); if (S.screen === 'title') updateLiveCard(now); bgPitch.draw(bgMatch, dt); bgPitch.ctx.setTransform(bgPitch.dpr, 0, 0, bgPitch.dpr, 0, 0); bgPitch.ctx.fillStyle = 'rgba(3,8,7,0.62)'; bgPitch.ctx.fillRect(0, 0, bgPitch.w, bgPitch.h); }
  }
}

// ---------------- Offline (PWA) ----------------
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});

// ---------------- Start ----------------
// Startbildschirm: echte Ladeschritte mit Fortschritt, Lichtstimmung im Stadion
function gateDust(cv) {
  const ctx = cv.getContext('2d'); let w = 0, h = 0; const P = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: 0.5 + Math.random() * 1.8, s: 0.004 + Math.random() * 0.012, a: Math.random() * 6 }));
  const fit = () => { const d = Math.min(2, devicePixelRatio || 1); w = cv.clientWidth; h = cv.clientHeight; cv.width = w * d; cv.height = h * d; ctx.setTransform(d, 0, 0, d, 0, 0); }; fit(); addEventListener('resize', fit);
  const loop = (t) => { if (cv.closest('[hidden]')) return; ctx.clearRect(0, 0, w, h); for (const p of P) { p.y -= p.s * 0.016; if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); } const al = 0.18 + 0.22 * Math.sin(t / 900 + p.a); ctx.fillStyle = `rgba(200,255,220,${al.toFixed(3)})`; ctx.beginPath(); ctx.arc(p.x * w + Math.sin(t / 2400 + p.a) * 14, p.y * h, p.r, 0, 6.283); ctx.fill(); } requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
async function runGate() {
  const gate = $('#intro-gate'), bar = $('#gate-bar'), st = $('#gate-status'); gate.hidden = false; gateDust($('#gate-dust'));
  const go = $('#gate-go'); if (want3d() && webglOk()) setTimeout(prefetchModels, 1200);
  go.onclick = () => { gate.hidden = true; audio.unlock(); audio.play('confirm'); startIntro(() => show('title')); };
  $('#btn-intro-skip').onclick = () => { gate.hidden = true; show('title'); };
  const steps = [
    ['Schriften und Oberfläche', document.fonts ? document.fonts.ready : null],
    ['Sprecher und Stimmen', voice.ready],
    ['Liga und Bestenliste', loadTitleBoard()],
  ].filter(([, p]) => p);
  let done = 0; const upd = (label) => { const k = done / steps.length; bar.style.width = Math.round(8 + k * 92) + '%'; st.textContent = k >= 1 ? 'Bereit – Flutlicht an!' : `${label} …`; };
  upd(steps[0][0]);
  await Promise.all(steps.map(([l, p], i) => Promise.resolve(p).catch(() => null).then(() => { done++; const next = steps.find((_, j) => j > i) || steps[0]; upd(next[0]); })));
  upd(''); gate.classList.add('ready');
}
async function init() {
  const boot = $('#boot'); if (boot) { boot.classList.add('out'); setTimeout(() => boot.remove(), 700); }
  rotateNews(); requestAnimationFrame(frame);
  const cfg = loadConfig();
  if (TV) { $('#gate')?.setAttribute('hidden', ''); startTvBoard(); }
  else if (params.has('voucher')) { $('#gate')?.setAttribute('hidden', ''); show('title'); loadTitleBoard(); openVoucherFromQR(params.get('voucher')); }
  else if (!params.has('nointro') && !params.has('debug')) { show('intro'); runGate(); } else loadTitleBoard();
  await cfg;
  if (KIOSK) setInterval(() => { if (S.screen === 'title') loadTitleBoard(); }, 30000);
}
init();
