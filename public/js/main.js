// Beat RealCore – Legacy League: Oberfläche und Spielablauf
import { initI18n, tr, isEN, LANG, setLang } from './i18n.js';
import { OBJECTIVES, DIFFICULTY, FORMATIONS, STYLES, TEMPO, TRAINING, OPPONENTS, POS, POS_GROUP, EVENTS, CLUB, SEASON_SCORE } from './data.js';
import { Season, rating, posFit, ATTRS } from './manager.js';
import { Match, MATCH_REAL } from './match.js';
import { Pitch } from './pitch.js';
import { Pitch3D, loadBabylon, webglOk } from './pitch3d.js';
import { playIntro } from './intro.js';
import { crest, avatar, shirt, ring, icon, formChips } from './ui.js';
import { Audio } from './audio.js';

const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
initI18n(); document.body.classList.add('on-title');
$$('#lang-sw button').forEach(b => { b.classList.toggle('on', b.dataset.l === LANG); b.addEventListener('click', () => { if (b.dataset.l !== LANG) setLang(b.dataset.l); }); });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LOC = isEN ? 'en-US' : 'de-DE';
const fmt = (n) => Math.round(n).toLocaleString(LOC);
const money = (n) => `${fmt(n)} T€`;
const params = new URLSearchParams(location.search);
const KIOSK = params.has('messe') || params.has('kiosk');
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
  const w = $('#wipe'); w.classList.remove('go'); void w.offsetWidth; w.classList.add('go');
  if (id === 'match') sizePitch();
}
let toastT = null;
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2600); }
$$('[data-go]').forEach(b => b.addEventListener('click', () => { audio.play('click'); const g = b.dataset.go; show(g === 'back' ? (S.prev === 'board' || S.prev === 'howto' || S.prev === 'privacy' ? 'title' : S.prev) : g); }));

// ---------------- Einstellungen ----------------
function openSettings() {
  const ov = $('#settings'); ov.hidden = false;
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
function demoTeams() { const s = new Season({ difficulty: 'profi', seed: 42, hooks: {} }); s.day = 6; return [s.teamForMatch(), s.opponentForMatch()]; }
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
async function loadConfig() { try { S.config = await api('/api/config'); } catch { S.config = { ai: false }; } }
$('#btn-play').addEventListener('click', () => { audio.unlock(); audio.play('click'); let seen = false; try { seen = localStorage.getItem('brcm-intro') === '1'; } catch { /* ignore */ } if (seen && !params.has('intro')) showSetup(); else startIntro(showSetup); });
$('#btn-intro').addEventListener('click', () => { audio.unlock(); audio.play('click'); startIntro(() => show('title')); });
function startIntro(next) {
  try { localStorage.setItem('brcm-intro', '1'); } catch { /* ignore */ }
  const cap = $('#intro-cap'), ttl = $('#intro-title'); cap.hidden = true; ttl.hidden = true; ttl.className = 'intro-title';
  show('intro');
  playIntro({ canvas: $('#intro-canvas'), captionEl: cap, titleEl: ttl, skipBtn: $('#btn-intro-skip'), audio, onDone: () => { if (S.screen === 'intro') next(); } });
}
$('#btn-board').addEventListener('click', () => { audio.unlock(); audio.play('click'); showBoard(); });
$('#btn-howto').addEventListener('click', () => { audio.unlock(); audio.play('click'); show('howto'); });
$('#link-privacy').addEventListener('click', (e) => { e.preventDefault(); show('privacy'); });
window.addEventListener('keydown', (e) => {
  if (S.screen !== 'title' || e.target.tagName === 'INPUT') return;
  const m = { Enter: '#btn-play', b: '#btn-board', '?': '#btn-howto', o: '#btn-settings', i: '#btn-intro' }[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (m) { e.preventDefault(); $(m).click(); }
});

// ---------------- Setup ----------------
function threat(i) { return `<span class="thr">${[1, 2, 3].map(j => `<i class="${j <= i + 1 ? 'on' : ''}"></i>`).join('')}</span>`; }
function showSetup() {
  $('#in-name').value = S.player.name; $('#in-company').value = S.player.company; $('#in-team').value = S.player.team || '';
  $('#diff-cards').innerHTML = Object.entries(DIFFICULTY).map(([k, d], i) => `<button class="dcard ${k === S.diff ? 'on' : ''}" data-d="${k}"><b>${esc(d.name)}</b><small>${esc(d.desc)} Budget ${money(d.budget)}, Punkte × ${d.mult}.</small>${threat(i)}</button>`).join('');
  $$('#diff-cards .dcard').forEach(b => b.addEventListener('click', () => { S.diff = b.dataset.d; audio.play('click'); showSetup(); }));
  $('#season-list').innerHTML = OPPONENTS.map((o, i) => `<li><b>${esc(o.club)}</b> · ${i % 2 === 0 ? 'Heim' : 'Auswärts'}</li>`).join('');
  show('setup');
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
  const lines = [['narr', `Pressekonferenz in der Clean-Core-Arena: ${S.player.name} übernimmt TechHub United${co}. Sieben Spieltage, sieben Legacy-Clubs, ein Ziel: die Legacy League.`],
    ['hub', `Willkommen im Verein, ${S.player.name}! Ich bin Lena Hoff, deine Sportdirektorin. Der Kader steht, das Budget auch – ${money(DIFFICULTY[S.diff].budget)}. Erster Gegner: der FC Datensilo.`],
    ['legacy', 'Ich laufe seit 1998. Ohne Doku, ohne Tests, ohne Niederlage. Ihr wollt Meister werden? Versucht es.']];
  S.brief = null;
  if (S.config.ai) { try { const b = await api('/api/ai/briefing', { lang: LANG, name: S.player.name, company: S.player.company, difficulty: S.diff }, 9000); if (b && b.text) { S.brief = b; lines[0][1] = b.text; if (b.taunt) lines[2][1] = b.taunt; } } catch { /* lokal */ } }
  const el = $('#brief-talk'); el.innerHTML = '';
  for (let i = 0; i < lines.length; i++) { await new Promise(r => setTimeout(r, i ? 900 : 200)); if (S.screen !== 'brief') return; el.insertAdjacentHTML('beforeend', talkLine(...lines[i])); audio.play(lines[i][0] === 'legacy' ? 'legacy' : 'type'); }
  $('#btn-start').disabled = false;
}
$('#btn-start').addEventListener('click', () => { audio.play('confirm'); newSeason(); });

// ---------------- Saison ----------------
async function newSeason() {
  S.gameId = null;
  try { const r = await api('/api/game/start', { mission: 'league', difficulty: S.diff }, 4000); S.gameId = r.gameId; } catch { S.gameId = null; }
  S.radioUnread = 0;
  S.season = new Season({ difficulty: S.diff, hooks: {
    onMessage: (m) => { S.radioUnread++; if (S.season) { renderRadio(); updateDots(); } },
    onEvent: (ev) => { if (ev.type === 'director') { audio.play('legacy'); toast(`${EVENTS[ev.event].name}: ${ev.detail}`); renderWeek(); } },
    onEnd: (r) => endSeason(r),
    onDecision: (d, note) => { $('#dec-note').textContent = note; },
    director: S.config.ai && S.gameId ? (summary) => api('/api/ai/director', { gameId: S.gameId, summary, lang: LANG }, 5500).then(d => d && d.event ? d : null) : null,
  } });
  S.tab = 'home'; S.selSlot = null;
  if (want3d() && webglOk()) loadBabylon();
  renderWeek(); show('week');
}
const SE = () => S.season;
function teamStrength() { const T = SE().teamForMatch(); return Math.round(T.players.reduce((s, p) => s + rating(p, p.pos), 0) / Math.max(1, T.players.length)); }
function updateDots() { $('#dot-training').classList.toggle('on', !SE().trained); $('#dot-radio').classList.toggle('on', S.radioUnread > 0 && S.tab !== 'radio'); }
function renderWeek() {
  const se = SE(); if (!se || se.over) return; const o = se.opponent;
  $('#wh-day').textContent = `Spieltag ${se.day + 1} / ${OPPONENTS.length}`; $('#wh-opp').textContent = `vs. ${o.club}`;
  $('#wh-where').textContent = se.home ? `Heimspiel · ${CLUB.stadium}` : `Auswärtsspiel · ${o.club}`;
  $('#wh-budget').textContent = money(se.budget); $('#wh-rank').textContent = se.day ? `${se.rank()}. (${se.table[0].pts} Pkt)` : '–';
  $('#wh-str').textContent = teamStrength(); const mor = Math.round(se.players.reduce((s, p) => s + p.morale, 0) / se.players.length); $('#wh-morale').textContent = mor >= 75 ? '😄 ' + mor : mor >= 55 ? '🙂 ' + mor : '😟 ' + mor;
  const ob = se.objective ? OBJECTIVES[se.objective] : null; $('#wh-obj').textContent = ob ? `🎯 Wochenziel: ${ob.name} (+${ob.bonus})` : '';
  const dec = se.decision && !se.decision.chosen; $('#btn-decision').hidden = !dec;
  if (dec && S.decisionDay !== se.day) { S.decisionDay = se.day; openDecision(); }
  $$('#week-nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab)); $$('.wtab').forEach(t => t.classList.toggle('on', t.id === 'tab-' + S.tab));
  renderHome(); renderSquad(); renderTactics(); renderTraining(); renderMarket(); renderTable(); renderRadio(); updateDots();
  const prob = se.lineupProblems(); $('#btn-match').disabled = prob.some(p => /unbesetzt|verletzt|gesperrt/.test(p));
}
$$('#week-nav button[data-ico]').forEach(b => b.insertAdjacentHTML('afterbegin', icon(b.dataset.ico)));
$$('#week-nav button').forEach(b => b.addEventListener('click', () => { audio.play('click'); if (b.dataset.tab === 'quit') { if (confirm(tr('Saison wirklich abbrechen? Der Spielstand geht verloren.'))) { S.season = null; show('title'); } return; } S.tab = b.dataset.tab; if (S.tab === 'radio') S.radioUnread = 0; renderWeek(); }));

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
      <div class="hero-top"><span class="tag">${icon('whistle')} Spieltag ${se.day + 1} / ${OPPONENTS.length}</span><span class="tag ${se.home ? 'home' : 'away'}">${se.home ? 'Heimspiel' : 'Auswärtsspiel'} · ${se.home ? '☀️ Tag' : '💡 Flutlicht'}</span></div>
      <div class="hero-vs">
        <div class="club">${crest(me, 72)}<b>${esc(CLUB.name)}</b><small>${se.day ? se.rank() + '. Platz · ' + se.table[0].pts + ' Pkt' : 'Saisonstart'}</small><div class="str"><span>Stärke ${str}</span>${bar(str, 99)}</div></div>
        <div class="vs">VS</div>
        <div class="club">${crest(o, 72)}<b>${esc(o.club)}</b><small>${esc(STYLES[o.style === 'press' ? 'agile' : o.style === 'wall' ? 'clean' : 'agile'].name)} · ${esc(o.names[0])}</small><div class="str"><span>Stärke ${o.strength + (se.oppMod || 0)}</span>${bar(o.strength + (se.oppMod || 0), 99)}</div></div>
      </div>
      <p class="hero-teaser">${esc(o.teaser)}</p>
      <div class="tipp">${icon('star')} <span>${esc(o.lena)}</span></div>
      <div class="hero-actions"><button class="btn" data-go="tactics">${icon('tactics')} Taktik prüfen</button><button class="btn" data-go="squad">${icon('squad')} Aufstellung</button><button class="btn primary" id="btn-match2">Zum Spiel ›</button></div>
    </div>
    <div class="hcard obj"><div class="hc-head">${icon('target')} Wochenziel</div>${ob ? `<b>${esc(ob.name)}</b><p>${esc(ob.desc)}</p><span class="bonus">+${ob.bonus} Punkte</span>` : '<p>–</p>'}</div>
    <div class="hcard dec ${d && !d.chosen ? 'open' : ''}"><div class="hc-head">${icon('board')} Vorstand</div>${d ? `<b>${esc(d.title)}</b><p>${esc(d.text)}</p>${d.chosen ? `<span class="done">✓ ${esc(d.options.find(x => x.key === d.chosen)?.label || '')}</span>` : `<div class="dec-mini">${d.options.map(x => `<button class="btn sm" data-dec="${x.key}" title="${esc(x.effect)}">${esc(x.label)}</button>`).join('')}</div>`}` : '<p>Der Vorstand meldet sich ab dem zweiten Spieltag.</p>'}</div>
    <div class="hcard ev ${ev ? 'on' : ''}"><div class="hc-head">${icon('bolt')} Legacy-KI</div>${ev ? `<b>${esc(ev.name)}</b><p>${esc(ev.desc)}</p>` : '<p>Diese Woche keine Störung gemeldet – noch nicht.</p>'}</div>
    <div class="hcard form"><div class="hc-head">${icon('up')} Form</div><div class="chips">${formChips(se.results)}</div><div class="top3">${form.map(p => `<div class="tp">${avatar(p, CLUB, 40)}<span><b>${esc(p.name.split(' ')[0])}</b><small>${esc(POS[p.pos])} · Form ${p.form > 0 ? '+' + p.form : p.form}</small></span><em>${rating(p)}</em></div>`).join('')}</div>${inj.length ? `<p class="inj">${icon('injury')} ${inj.map(p => esc(p.name) + (p.injured > 0 ? ' (verletzt)' : ' (gesperrt)')).join(', ')}</p>` : ''}</div>
    <div class="hcard kpis"><div class="hc-head">${icon('money')} Verein</div><div class="kgrid"><div><small>Budget</small><b>${money(se.budget)}</b></div><div><small>Training</small><b>${se.trained ? esc(TRAINING[se.trained].name) : '<span class="warn">offen</span>'}</b></div><div><small>Kader</small><b>${se.players.length} · Ø ${Math.round(se.players.reduce((a, p) => a + p.age, 0) / se.players.length)} J.</b></div><div><small>Stimmung</small><b>${Math.round(se.players.reduce((a, p) => a + p.morale, 0) / se.players.length)}</b></div></div></div>
    <div class="hcard press"><div class="hc-head">${icon('press')} Presse</div>${last.map(m => `<div class="pm ${m.who}"><b>${esc((SPK[m.who] || SPK.hub).n)}</b><p>${esc(m.text)}</p></div>`).join('') || '<p>–</p>'}</div>`;
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
  const list = [...se.players].sort((a, b) => { const o = ['TW', 'IV', 'AV', 'DM', 'ZM', 'FL', 'ST']; return o.indexOf(a.pos) - o.indexOf(b.pos) || rating(b) - rating(a); });
  $('#player-list').innerHTML = list.map(p => { const [st, stt] = statusOf(p); const r = rating(p); const canSell = se.players.length > 14 && !inL.has(p.id);
    return `<div class="pl ${inL.has(p.id) ? 'in' : ''} ${se.available(p) ? '' : 'na'}" data-id="${p.id}">${avatar(p, CLUB, 40)}<span class="pos ${p.pos === 'TW' ? 'tw' : ''}">${esc(p.pos)}</span><span class="name"><b>${esc(p.name)}${p.id === se.captain ? ' <i class="cap" title="Kapitän">C</i>' : ''}${p.id === se.penTaker ? ' <i class="pen" title="Elfmeterschütze">11m</i>' : ''}</b><small>${esc(p.nick || '')} · ${p.age} J. · <span class="stars" title="Potenzial">${'★'.repeat(p.pot || 3)}<i>${'★'.repeat(5 - (p.pot || 3))}</i></span> · ${money(p.value)}</small></span><span class="rt ${r >= 78 ? 'hi' : r < 62 ? 'lo' : ''}">${r}</span>${attrsHtml(p)}<span class="fit"><b>${Math.round(p.fitness)} %</b>Fitness</span><span class="stt"><i class="st st-${st}" title="${esc(stt)}"></i></span><span class="act">${inL.has(p.id) && p.pos !== 'TW' && p.id !== se.captain ? `<button class="btn xs" data-cap="${p.id}" title="Zum Kapitän machen">C</button>` : ''}${inL.has(p.id) && p.pos !== 'TW' && p.id !== se.penTaker ? `<button class="btn xs" data-pen="${p.id}" title="Elfmeterschütze">11m</button>` : ''}${canSell ? `<button class="btn xs" data-sell="${p.id}" title="Verkaufen">€</button>` : ''}</span></div>`; }).join('');
  $$('#player-list .pl').forEach(el => {
    el.addEventListener('click', (e) => { if (e.target.dataset.sell || e.target.dataset.cap || e.target.dataset.pen) return; const id = el.dataset.id; const p = se.players.find(x => x.id === id);
      if (S.selSlot !== null) { if (!se.available(p)) { toast(p.injured > 0 ? 'Verletzt – nicht einsetzbar.' : 'Gesperrt – nicht einsetzbar.'); audio.play('deny'); return; } se.setSlot(S.selSlot, id); S.selSlot = null; audio.play('confirm'); renderWeek(); }
      else showTip(el, p); });
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showTip(el, se.players.find(x => x.id === el.dataset.id)); });
    el.addEventListener('pointerleave', () => { $('#tip').hidden = true; });
  });
  $$('[data-cap]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); se.setCaptain(b.dataset.cap); audio.play('confirm'); toast(`${se.players.find(p => p.id === b.dataset.cap).name} trägt die Kapitänsbinde.`); renderWeek(); }));
  $$('[data-pen]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); se.setPenTaker(b.dataset.pen); audio.play('confirm'); renderWeek(); }));
  $$('[data-sell]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); const p = se.players.find(x => x.id === b.dataset.sell); if (confirm(tr(`${p.name} für ${money(Math.round(p.value * 0.6))} verkaufen?`))) { const r = se.sell(p.id); if (r.ok) { audio.play('cash'); } else { toast(r.reason); audio.play('deny'); } renderWeek(); } }));
  $('#lineup-problems').innerHTML = se.lineupProblems().map(p => `<li>${esc(p)}</li>`).join('');
  $('#lineup-hint').textContent = S.selSlot !== null ? 'Jetzt eine:n Spieler:in in der Liste wählen – oder eine zweite Position zum Tauschen.' : 'Klicke eine Position und dann eine:n Spieler:in in der Liste.';
}
function showTip(el, p) { const t = $('#tip'); if (!p) return; t.innerHTML = `<b>${esc(p.name)} <small>· ${esc(POS[p.pos])}</small></b><small>${esc(p.desc || '')}</small><br><small>Fitness ${Math.round(p.fitness)} % · Stimmung ${Math.round(p.morale)} · Form ${p.form > 0 ? '+' + p.form : p.form} · Potenzial ${'★'.repeat(p.pot || 3)} · Tore ${p.goals} · Vorlagen ${p.assists}</small>`; t.hidden = false; const r = el.getBoundingClientRect(); t.style.left = Math.min(innerWidth - 310, r.left) + 'px'; t.style.top = (r.bottom + 6 + 150 > innerHeight ? r.top - 110 : r.bottom + 6) + 'px'; }
$('#btn-auto').addEventListener('click', () => { SE().autoLineup(); S.selSlot = null; audio.play('confirm'); renderWeek(); });

// Taktik
function renderTactics() {
  const se = SE(), o = se.opponent;
  $('#formations').innerHTML = Object.entries(FORMATIONS).map(([k, f]) => `<button class="${k === se.formation ? 'on' : ''}" data-k="${k}">${esc(f.name)}</button>`).join('');
  $$('#formations button').forEach(b => b.addEventListener('click', () => { se.setFormation(b.dataset.k); audio.play('click'); renderWeek(); }));
  $('#styles').innerHTML = Object.entries(STYLES).map(([k, s]) => `<button class="scard ${k === se.style ? 'on' : ''}" data-k="${k}"><b>${esc(s.name)}</b><small>${esc(s.desc)}</small><div class="bars"><span>Pressing<b>${'▮'.repeat(Math.round(s.press * 5))}</b></span><span>Risiko<b>${'▮'.repeat(Math.round(s.risk * 5))}</b></span></div></button>`).join('');
  $$('#styles .scard').forEach(b => b.addEventListener('click', () => { se.style = b.dataset.k; audio.play('click'); renderTactics(); }));
  $('#tempos').innerHTML = Object.entries(TEMPO).map(([k, t]) => `<button class="${k === se.tempo ? 'on' : ''}" data-k="${k}">${esc(t.name)}</button>`).join('');
  $$('#tempos button').forEach(b => b.addEventListener('click', () => { se.tempo = b.dataset.k; audio.play('click'); renderTactics(); }));
  const ev = se.pendingEvent ? `<p><b style="color:var(--orange)">Störung: ${esc(EVENTS[se.pendingEvent.event].name)}</b> – ${esc(EVENTS[se.pendingEvent.event].desc)}</p>` : '';
  $('#opp-card').innerHTML = `<div class="card-head"><span>Gegner: ${esc(o.club)}</span><span class="tag">Stärke ${o.strength}</span></div><div class="oc"><div class="crest" style="background:${o.color};border-color:${o.color2}">${esc(o.short[0])}</div><div><b>${esc(o.club)}</b><p>${esc(o.teaser)}</p></div></div>${ev}<div class="tipp">💬 ${esc(o.lena)}</div>`;
}
// Training
function renderTraining() {
  const se = SE();
  $('#train-cards').innerHTML = Object.entries(TRAINING).map(([k, t]) => `<button class="tcard ${se.trained === k ? 'done' : ''}" data-k="${k}" ${se.trained && !se.extraTraining ? 'disabled' : ''}><b>${esc(t.name)}</b><small>${esc(t.desc)}</small></button>`).join('');
  $('#train-extra')?.remove(); if (se.extraTraining && se.trained) $('#train-cards').insertAdjacentHTML('beforebegin', '<p class="hint" id="train-extra">Zusatzschicht: Eine zweite Einheit ist möglich.</p>');
  $$('#train-cards .tcard').forEach(b => b.addEventListener('click', () => { if (se.train(b.dataset.k)) { audio.play('confirm'); toast(`Training: ${TRAINING[b.dataset.k].name}`); } renderWeek(); }));
}
// Transfermarkt
function renderMarket() {
  const se = SE();
  $('#market-cards').innerHTML = se.market.map(p => `<div class="mcard2"><div class="top">${avatar(p, { color: '#5aa9ff', color2: '#1b3a6b' }, 40)}<b>${esc(p.name)}</b>${ring(rating(p), 40)}</div><div class="meta">${esc(POS[p.pos])} · ${p.age} J. · <span class="stars">${'★'.repeat(p.pot || 3)}<i>${'★'.repeat(5 - (p.pot || 3))}</i></span></div>${attrsHtml(p)}<p>${esc(p.desc)}</p><div class="foot"><span class="price">${money(p.value)}</span><button class="btn sm ${p.value <= se.budget ? 'primary' : ''}" data-buy="${p.id}" ${p.value > se.budget ? 'disabled' : ''}>Verpflichten</button></div></div>`).join('') || '<p class="hint">Diese Woche ist der Markt leer.</p>';
  $$('[data-buy]').forEach(b => b.addEventListener('click', () => { const r = se.buy(b.dataset.buy); if (r.ok) { audio.play('cash'); toast('Transfer abgeschlossen.'); } else { audio.play('deny'); toast(r.reason); } renderWeek(); }));
}
// Tabelle & Ergebnisse
function tableRows(tb, full) { tb.innerHTML = SE().standings().map((t, i) => { const o = t.me ? { ...CLUB, me: true } : OPPONENTS.find(x => x.id === t.id); return `<tr class="${t.me ? 'me' : ''}"><td>${i + 1}</td><td class="cl">${crest(o, 22)} ${esc(t.club)}</td><td class="r">${t.w + t.d + t.l}</td>${full ? `<td class="r">${t.w}</td><td class="r">${t.d}</td><td class="r">${t.l}</td>` : ''}<td class="r">${t.gf}:${t.ga}</td><td class="r"><b>${t.pts}</b></td></tr>`; }).join(''); }
function resultRows(ul) { const se = SE(); ul.innerHTML = se.results.length ? se.results.map(r => `<li class="${r.won ? 'w' : r.draw ? 'd' : 'l'}"><small>Spieltag ${r.day + 1}</small><span>${r.home ? 'TechHub United – ' + esc(r.club) : esc(r.club) + ' – TechHub United'}</span><span class="sc">${r.home ? r.gf + ':' + r.ga : r.ga + ':' + r.gf}</span><small>+${fmt(r.pts)}</small></li>`).join('') : '<li class="none"><span>Noch kein Spiel gespielt.</span></li>'; }
function renderTable() { tableRows($('#league-table tbody'), true); resultRows($('#results-list')); const se = SE(); const top = [...se.players].filter(p => p.goals || p.assists).sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, 6); $('#scorers').innerHTML = top.length ? top.map((p, i) => `<div class="sc-row"><span class="n">${i + 1}</span>${avatar(p, CLUB, 34)}<span class="nm"><b>${esc(p.name)}</b><small>${esc(POS[p.pos])}</small></span><span class="g">${p.goals} <small>Tore</small></span><span class="a">${p.assists} <small>Vorl.</small></span></div>`).join('') : '<p class="hint">Noch keine Torschützen.</p>'; }
// Funk
function renderRadio() { const se = SE(); if (!se) return; const el = $('#radio'); el.innerHTML = [...se.log].reverse().slice(0, 30).map(m => { const P = SPK[m.who] || SPK.hub; return `<div class="msg ${m.who}"><div class="av">${P.av}</div><div><b>${esc(P.n)} · Spieltag ${m.day + 1}</b><p>${esc(m.text)}</p></div></div>`; }).join(''); }

// ---------------- Spieltag ----------------
let M = null, pitch = null, lastT = 0, matchRun = false;
function sizePitch() { const wrap = $('.pitch-wrap'); if (!pitch) return; pitch.resize(wrap.clientWidth, wrap.clientHeight); }
// 3D-Rasen (Babylon.js), sonst 2D-Darstellung
const want3d = () => { try { return localStorage.getItem('brcm-3d') !== '0'; } catch { return true; } };
async function ensurePitch() {
  if (pitch) return;
  if (want3d() && webglOk() && await loadBabylon()) { try { pitch = new Pitch3D($('#pitch')); } catch (e) { console.warn('3D nicht verfügbar', e); pitch = null; } }
  if (!pitch) pitch = new Pitch($('#pitch'));
  S.pitch3d = pitch instanceof Pitch3D; $('.pitch-wrap').classList.toggle('three', S.pitch3d);
}
window.addEventListener('resize', () => { sizeBg(); if (S.screen === 'match') sizePitch(); });
$('#btn-match').addEventListener('click', async () => { audio.unlock(); audio.play('whistle'); $('#btn-match').disabled = true; await ensurePitch(); $('#btn-match').disabled = false; startMatch(); });
function startMatch() {
  const se = SE(), o = se.opponent; se.autoFillIfNeeded?.();
  const me = se.teamForMatch(), opp = se.opponentForMatch();
  const home = se.home ? me : opp, away = se.home ? opp : me;
  M = new Match(home, away, { seed: (Date.now() & 0xffff) + se.day, hooks: { injMul: DIFFICULTY[S.diff].inj } });
  S.match = M; S.myTeam = se.home ? 0 : 1;
  M.hooks = { onEvent: (e) => onMatchEvent(e), onHalf: () => openHalf('Halbzeit'), onFull: (r) => endMatch(r), onGoal: (ti) => { pitch.goalFlash(ti); }, injMul: DIFFICULTY[S.diff].inj };
  $('#sc-home').textContent = home.short; $('#sc-away').textContent = away.short; $('#sc-val').textContent = '0 : 0'; $('#sc-home-crest').innerHTML = crest(home, 30); $('#sc-away-crest').innerHTML = crest(away, 30); $('#tl-marks').innerHTML = ''; $('#tl-fill').style.width = '0%';
  if (pitch && pitch.setDaylight) pitch.setDaylight(se.home); $('#sc-min').textContent = "0'"; $('#sc-phase').textContent = '1. Halbzeit';
  $('#ticker-list').innerHTML = ''; $('#ts-stats').textContent = ''; $('#match-banner').hidden = true;
  renderLiveTactics();
  onMatchEvent(M.events[0]);
  setSpeed(1); matchRun = true; show('match'); audio.setCrowd(0.5);
  banner(`${home.short} – ${away.short}`, `Spieltag ${se.day + 1} · ${se.home ? CLUB.stadium : o.club}`, false, 2600);
}
function renderLiveTactics() {
  const T = M.teams[S.myTeam], se = SE();
  $('#live-tactics').innerHTML = `<small>Spielstil live</small><div class="seg">${Object.entries(STYLES).map(([k, v]) => `<button class="${k === T.style ? 'on' : ''}" data-k="${k}">${esc(v.name)}</button>`).join('')}</div>`;
  $$('#live-tactics button').forEach(b => b.addEventListener('click', () => { T.style = b.dataset.k; se.style = b.dataset.k; audio.play('click'); renderLiveTactics(); }));
}
function setSpeed(s) { if (!M) return; M.speed = s === 'skip' ? 40 : s; $$('#speed button[data-s]').forEach(b => b.classList.toggle('on', String(b.dataset.s) === String(s))); }
$$('#speed button[data-s]').forEach(b => b.addEventListener('click', () => { audio.play('click'); setSpeed(b.dataset.s === 'skip' ? 'skip' : +b.dataset.s); }));
$('#btn-tactics-live').addEventListener('click', () => { if (M && !M.over) { audio.play('click'); openHalf('Taktik'); } });
let bannerT = null;
function banner(t, sub, opp, dur = 2200) { const el = $('#match-banner'); el.innerHTML = `${esc(t)}<small>${esc(sub)}</small>`; el.className = 'banner' + (opp ? ' opp' : ''); el.hidden = false; clearTimeout(bannerT); bannerT = setTimeout(() => { el.hidden = true; }, dur); }
function onMatchEvent(e) {
  const mine = e.team === S.myTeam;
  if (['intercept', 'corner', 'press'].includes(e.type)) return;
  const li = document.createElement('div'); const key = e.type === 'goal' ? (mine ? 'goal' : 'goal_opp') : e.type; li.className = 'te ' + key; li.innerHTML = `<b>${e.min}'</b><span>${esc(e.text)}</span>`;
  const list = $('#ticker-list'); list.prepend(li); while (list.children.length > 60) list.lastChild.remove();
  if (['goal', 'yellow', 'red', 'injury', 'sub', 'penalty'].includes(e.type)) { const mk = document.createElement('i'); mk.className = 'tm ' + e.type + (mine ? ' me' : ' opp'); mk.style.left = Math.min(100, e.min / 90 * 100) + '%'; mk.title = `${e.min}' ${e.p ? e.p.name : ''}`; mk.innerHTML = icon(e.type === 'goal' ? 'ball' : e.type === 'yellow' || e.type === 'red' ? 'card' : e.type === 'penalty' ? 'pen' : e.type); $('#tl-marks').appendChild(mk); }
  if (e.type === 'goal') { $('#sc-val').textContent = `${e.score[0]} : ${e.score[1]}`; if (pitch && pitch.celebrate && M.speed < 10) pitch.celebrate(e.p); $('#sc-val').classList.remove('flash'); void $('#sc-val').offsetWidth; $('#sc-val').classList.add('flash'); audio.play(mine ? 'goal' : 'goal_opp'); banner(mine ? 'TOOOR!' : 'Gegentor', `${e.p ? e.p.name : ''} · ${e.min}'`, !mine); if (M.speed < 10) pitch.burst(M.ball.x, M.ball.y, mine ? '#3ddc84' : '#ff6a3d'); }
  else if (e.type === 'save' || e.type === 'post' || e.type === 'wide') audio.play('ooh', mine ? 0.8 : 0.5);
  else if (e.type === 'chance' && mine) audio.play('chance');
  else if (e.type === 'yellow' || e.type === 'red') { audio.play('card'); if (e.type === 'red') banner('ROT', e.p.name, !mine); }
  else if (e.type === 'penalty') { audio.play('whistle'); audio.play('chance'); banner('ELFMETER', `${e.p ? e.p.name : ''} tritt an`, !mine); }
  else if (e.type === 'pen_save' || e.type === 'pen_miss') audio.play('ooh', mine ? 1 : 0.6);
  else if (e.type === 'injury') { audio.play('ooh', 0.6); if (mine) banner('Verletzung', `${e.p.name} – Wechsel?`, false); }
  else if (e.type === 'half') { audio.play('whistle'); $('#sc-phase').textContent = 'Halbzeit'; }
  else if (e.type === 'full') audio.play('whistle3');
  else if (e.type === 'kickoff') audio.play('whistle');
  $('#ts-stats').textContent = `Schüsse ${M.shots[0][0]} : ${M.shots[1][0]}`;
}
// Halbzeit / Taktik-Pause
function openHalf(title) {
  M.paused = true; audio.setCrowd(0.25);
  const se = SE(), T = M.teams[S.myTeam];
  $('#half-title').textContent = title; $('#half-score').textContent = `${M.score[0]} : ${M.score[1]} · ${Math.floor(M.min)}'`;
  const mk = (el, obj, cur, key) => { el.innerHTML = Object.entries(obj).map(([k, v]) => `<button class="${k === cur ? 'on' : ''}" data-k="${k}">${esc(v.name)}</button>`).join(''); el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { T[key] = b.dataset.k; se[key] = b.dataset.k; audio.play('click'); mk(el, obj, b.dataset.k, key); })); };
  mk($('#half-styles'), STYLES, T.style, 'style'); mk($('#half-tempos'), TEMPO, T.tempo, 'tempo');
  const lead = M.score[S.myTeam] - M.score[1 - S.myTeam];
  $('#half-advice').textContent = lead > 0 ? 'Lena: Führung – Clean Core und ruhiges Tempo bringen den Sieg nach Hause.' : lead < 0 ? 'Lena: Rückstand – Big Bang oder Agile Pressing, und frische Beine rein.' : 'Lena: Alles offen. Wer mehr Kondition hat, entscheidet die Schlussphase.';
  S.subOut = null; S.subIn = null; renderSubs();
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
$('#btn-resume').addEventListener('click', () => { $('#half').hidden = true; M.paused = false; renderLiveTactics(); audio.play('whistle'); audio.setCrowd(0.5); if (M.halfDone && M.min < 46) $('#sc-phase').textContent = '2. Halbzeit'; });
function endMatch(res) {
  matchRun = false; audio.setCrowd(0.2);
  const se = SE(), o = se.opponent, r = se.applyResult(res);
  setTimeout(() => showReport(res, r, o), 1200);
}
function showReport(res, r, o) {
  const se = SE(), home = res.mine === 'home';
  $('#rep-day').textContent = `Spieltag ${se.results.length} / ${OPPONENTS.length}`;
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
    <div class="statline"><span>${res.shots[mi][0]}</span><span>SCHÜSSE</span><span>${res.shots[1 - mi][0]}</span></div><div class="statline"><span>${res.shots[mi][1]}</span><span>AUFS TOR</span><span>${res.shots[1 - mi][1]}</span></div><div class="statline"><span>${poss} %</span><span>BALLBESITZ</span><span>${100 - poss} %</span></div><div class="statline"><span>${res.yellows.length}</span><span>KARTEN</span><span>${res.players.filter(p => p.team !== mi && p.yellow).length}</span></div>`;
  const mine = res.players.filter(p => p.team === mi).sort((a, b) => b.rating - a.rating);
  const mvp = mine[0]; if (mvp) $('#rep-mvp').innerHTML = `${avatar(mvp, CLUB, 64)}<div><small>${icon('star')} Spieler:in des Spiels</small><b>${esc(mvp.name)}</b><span>${esc(POS[mvp.pos])} · Note ${Math.max(1, Math.min(10, mvp.rating)).toFixed(1)}${mvp.goals ? ' · ' + mvp.goals + ' Tor' + (mvp.goals > 1 ? 'e' : '') : ''}${mvp.assists ? ' · ' + mvp.assists + ' Vorlage' + (mvp.assists > 1 ? 'n' : '') : ''}</span></div>`;
  $('#rep-ratings').innerHTML = mine.map(p => { const v = Math.max(1, Math.min(10, p.rating)); return `<div class="${v >= 7.5 ? 'hi' : v < 5.5 ? 'lo' : ''}">${avatar(p, CLUB, 30)}<span>${esc(p.name)} <small style="color:var(--muted)">${esc(p.pos)}${p.goals ? ' · ⚽' + p.goals : ''}${p.injured ? ' · 🚑' : ''}</small></span><i class="rbar"><b style="width:${v * 10}%"></b></i><b>${v.toFixed(1)}</b></div>`; }).join('');
  const lastMsgs = se.log.slice(-3);
  $('#rep-talk').innerHTML = `<div class="card-head"><span>▸ Nach dem Spiel</span></div>` + lastMsgs.map(m => talkLine(m.who, m.text)).join('');
  const ob = r.objective ? `<div class="${r.objective.ok ? 'ok' : 'miss'}"><span>🎯 Wochenziel: ${esc(r.objective.name)}</span><b>${r.objective.ok ? '+' + fmt(r.objective.bonus) : '✕'}</b></div>` : '';
  $('#rep-money').innerHTML = `<div class="money">${ob}<div><span>Einnahmen (Zuschauer, Prämie, Sponsor)</span><b>+${money(r.income)}</b></div><div><span>Punkte für die Liga</span><b>+${fmt(r.pts)}</b></div><div><span>Budget jetzt</span><b>${money(se.budget)}</b></div></div>`;
  $('#rep-hint').textContent = se.over ? 'Die Saison ist vorbei – weiter zur Auswertung.' : `Nächster Gegner: ${se.opponent.club}`;
  audio.play(r.won ? 'win' : r.draw ? 'confirm' : 'lose');
  show('report');
}
$('#btn-next-week').addEventListener('click', () => { audio.play('click'); const se = SE(); if (se.over) showResult(se.result); else { S.tab = 'home'; S.radioUnread = 0; renderWeek(); show('week'); } });

// ---------------- Saisonende ----------------
function endSeason(r) { S.finalResult = r; }
async function showResult(r) {
  const se = SE(); S.finalResult = r; audio.setCrowd(0);
  const head = $('#result-head'); head.className = 'result-head ' + (r.won ? 'win' : 'lose');
  $('#result-title').textContent = r.won ? 'MEISTER!' : r.rank <= 6 ? `PLATZ ${r.rank}` : 'ABGESTIEGEN';
  $('#result-reason').textContent = `${r.reason} · ${DIFFICULTY[se.diffKey].name}`;
  const grade = r.score >= 12000 ? 'S' : r.score >= 9000 ? 'A' : r.score >= 6500 ? 'B' : r.score >= 4000 ? 'C' : 'D';
  const gr = $('#grade'); gr.className = 'grade g-' + grade; gr.querySelector('b').textContent = grade;
  const ps = se.players, byG = [...ps].sort((a, b) => b.goals - a.goals || b.assists - a.assists)[0], byA = [...ps].sort((a, b) => b.assists - a.assists || b.goals - a.goals)[0], byR = [...ps].filter(p => p.apps).sort((a, b) => rating(b) - rating(a))[0], young = [...ps].filter(p => p.age < 24 && p.apps).sort((a, b) => b.goals + b.assists - a.goals - a.assists || rating(b) - rating(a))[0];
  const aw = [byG && byG.goals ? ['Torschützenkönig:in', byG, `${byG.goals} Tore`] : null, byA && byA.assists ? ['Vorlagengeber:in', byA, `${byA.assists} Vorlagen`] : null, byR ? ['Spieler:in der Saison', byR, `Stärke ${rating(byR)} · ${byR.apps} Spiele`] : null, young ? ['Talent der Saison', young, `${young.age} J. · ${young.goals + young.assists} Scorerpunkte`] : null].filter(Boolean);
  $('#awards').innerHTML = aw.map(([t, p, d]) => `<div class="award">${avatar(p, CLUB, 48)}<div><small>${icon('trophy')} ${t}</small><b>${esc(p.name)}</b><span>${esc(d)}</span></div></div>`).join('') || '<p class="hint">–</p>';
  $('#result-score').textContent = fmt(r.score);
  const b = r.breakdown;
  $('#result-breakdown').innerHTML = [['Spielpunkte (Siege, Tore, Zu-null)', b.base], ['Tabellenplatz', b.place], ['Restbudget', b.eco], ['Schwierigkeit', `× ${b.mult}`]].map(([k, v]) => `<tr><td>${esc(k)}</td><td>${typeof v === 'number' ? fmt(v) : v}</td></tr>`).join('');
  tableRows($('#final-table tbody'), false); resultRows($('#final-results'));
  $('#result-beat').className = 'beat'; $('#result-rank').textContent = 'Wird gewertet …';
  $('#voucher-form').hidden = false; $('#voucher-msg').textContent = ''; $('#in-email').value = ''; $('#in-consent').checked = false; $('#voucher-form').querySelector('button').disabled = false;
  audio.play(r.won ? 'win' : 'lose'); show('result');
  try {
    const res = await api('/api/scores', { gameId: S.gameId, name: S.player.name, company: S.player.company, teamCode: S.player.team, mission: 'league', difficulty: se.diffKey, score: r.score, won: r.won, duration: r.rank, stats: { ...se.stats, rank: r.rank, results: se.results.map(x => `${x.gf}:${x.ga}`), events: se.events.map(e => e.event) } });
    S.scoreRow = res;
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

// ---------------- Hauptschleife ----------------
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016); lastT = now;
  if (S.screen === 'match' && M) {
    if (!M.paused && !M.over) { if (M.speed >= 10) { let n = 0; while (!M.over && !M.paused && n++ < 400) M.step(1 / 30); } else M.tick(dt); }
    const sc = M.score; if (!M.paused) { $('#sc-min').textContent = `${Math.floor(M.min)}'`; $('#tl-fill').style.width = Math.min(100, M.min / 90 * 100) + '%'; const pt = M.poss[0] + M.poss[1]; if (pt > 1 && (M.stepN || 0) % 20 === 0) { const l = Math.round(100 * M.poss[S.myTeam] / pt); $('#poss > i').style.width = l + '%'; $('#poss-l').textContent = l + ' %'; $('#poss-r').textContent = (100 - l) + ' %'; } }
    if (pitch) pitch.draw(M, dt);
    const excite = Math.min(1, 0.4 + Math.abs(sc[0] - sc[1]) * 0.1 + (M.ball.mode === 'shot' ? 0.4 : 0)); audio.setCrowd(excite * 0.8);
  } else if (S.screen === 'title' || S.screen === 'setup' || S.screen === 'brief' || S.screen === 'board' || S.screen === 'howto' || S.screen === 'privacy' || S.screen === 'result' || S.screen === 'report') {
    if (bgMatch) { bgMatch.tick(dt); if (bgMatch.over) newBg(); bgPitch.draw(bgMatch, dt); bgPitch.ctx.setTransform(bgPitch.dpr, 0, 0, bgPitch.dpr, 0, 0); bgPitch.ctx.fillStyle = 'rgba(3,8,7,0.62)'; bgPitch.ctx.fillRect(0, 0, bgPitch.w, bgPitch.h); }
  }
  requestAnimationFrame(frame);
}

// ---------------- Offline (PWA) ----------------
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});

// ---------------- Start ----------------
async function init() {
  rotateNews(); await loadConfig(); loadTitleBoard(); requestAnimationFrame(frame);
  if (KIOSK) setInterval(() => { if (S.screen === 'title') loadTitleBoard(); }, 30000);
}
init();
