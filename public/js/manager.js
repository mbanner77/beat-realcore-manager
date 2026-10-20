// Saison- und Vereinslogik: Kader, Training, Transfers, Taktik, Tabelle, Störungen der Legacy-KI, Punktewertung
import { DIFFICULTY, FORMATIONS, STYLES, TEMPO, SQUAD, MARKET_POOL, MARKET_SELL_FACTOR, TRAINING, OPPONENTS, SEASON_SCORE, EVENTS, TAUNTS, POS_GROUP, CLUB } from './data.js';

// Deterministischer Zufall (für Tages-Challenge und Tests)
export function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
export const ATTRS = ['tempo', 'technik', 'abwehr', 'schuss', 'kondition'];
// Gesamtstärke je Position (0–99)
export function rating(p, pos = p.pos) {
  const w = { TW: [0.05, 0.1, 0.75, 0, 0.1], IV: [0.12, 0.15, 0.55, 0.05, 0.13], AV: [0.25, 0.2, 0.35, 0.05, 0.15], DM: [0.15, 0.25, 0.35, 0.1, 0.15], ZM: [0.2, 0.4, 0.15, 0.15, 0.1], FL: [0.35, 0.3, 0.05, 0.2, 0.1], ST: [0.25, 0.2, 0.0, 0.45, 0.1] }[pos];
  return Math.round(ATTRS.reduce((s, k, i) => s + p[k] * w[i], 0));
}
// Passt die Position? 1 = perfekt, 0.9 = benachbart, 0.75 = fremd
export function posFit(p, pos) {
  if (p.pos === pos) return 1;
  const g = POS_GROUP[p.pos], h = POS_GROUP[pos];
  if (g === 'tw' || h === 'tw') return 0.45;
  if (g === h) return 0.93;
  const adj = { def: ['mid'], mid: ['def', 'att'], att: ['mid'] };
  return adj[g].includes(h) ? 0.84 : 0.72;
}

export class Season {
  constructor(o) {
    this.diffKey = o.difficulty; this.diff = DIFFICULTY[o.difficulty];
    this.hooks = o.hooks || {}; this.r = rng(o.seed || (Date.now() & 0xffffffff));
    this.day = 0; this.budget = this.diff.budget; this.over = false;
    this.players = SQUAD.map(p => ({ ...p, fitness: 100, morale: 70, form: 0, injured: 0, suspended: 0, yellows: 0, goals: 0, assists: 0, apps: 0, own: true }));
    this.formation = '4-4-2'; this.style = 'clean'; this.tempo = 'normal';
    this.slots = []; this.autoLineup();
    this.results = []; this.log = []; this.events = []; this.trained = null; this.market = [];
    this.table = [{ id: 'techhub', club: CLUB.name, short: CLUB.short, pts: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0, me: true }, ...OPPONENTS.map(o => ({ id: o.id, club: o.club, short: o.short, pts: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0 }))];
    this.stats = { goals: 0, conceded: 0, wins: 0, draws: 0, losses: 0, transfersIn: 0, transfersOut: 0, trainings: 0, cleanSheets: 0 };
    this.pendingEvent = null; this.weekMsgs = [];
    this.prepareWeek(true);
  }
  get opponent() { return OPPONENTS[this.day]; }
  get home() { return this.day % 2 === 0; }
  msg(who, text) { const m = { who, text, day: this.day }; this.log.push(m); this.hooks.onMessage?.(m); }

  // ---------- Woche ----------
  prepareWeek(first = false) {
    this.trained = null; this.weekMsgs = [];
    for (const p of this.players) {
      if (!first) { p.fitness = clamp(p.fitness + 22, 0, 100); if (p.injured > 0) p.injured--; if (p.suspended > 0) p.suspended--; p.morale = clamp(p.morale + (p.morale < 60 ? 3 : -1), 20, 100); }
    }
    this.genMarket();
    this.pendingEvent = null;
    if (!first) this.fillLineup();
    if (!first) this.requestEvent();
    const o = this.opponent;
    this.msg('hub', o.lena);
    this.hooks.onWeek?.(this);
  }
  genMarket() {
    const r = this.r, taken = new Set(this.players.map(p => p.name));
    const pool = MARKET_POOL.filter(t => !taken.has(t.name));
    const n = 4 + Math.floor(r() * 2); this.market = [];
    for (let i = 0; i < n && pool.length; i++) {
      const t = pool.splice(Math.floor(r() * pool.length), 1)[0];
      const k = 0.9 + r() * 0.22 + this.day * 0.02;
      const p = { id: 'm' + this.day + '_' + i, name: t.name, nick: t.nick || '', pos: t.pos, age: 19 + Math.floor(r() * 14), desc: t.desc, unit: 'market', fitness: 100, morale: 65, form: 0, injured: 0, suspended: 0, yellows: 0, goals: 0, assists: 0, apps: 0 };
      ATTRS.forEach((a, j) => p[a] = clamp(Math.round(t.base[j] * k), 30, 97));
      p.value = Math.round((rating(p) ** 2) / 9 + (p.age < 24 ? 120 : 0)) * 10 / 10;
      p.value = Math.round(p.value / 10) * 10;
      this.market.push(p);
    }
  }
  train(k) {
    if (this.trained || !TRAINING[k]) return false;
    const T = TRAINING[k]; this.trained = k; this.stats.trainings++;
    for (const p of this.players) {
      if (T.group.includes(POS_GROUP[p.pos])) for (const a in T.gain) p[a] = clamp(p[a] + T.gain[a] * (p.age < 25 ? 1.3 : p.age > 31 ? 0.6 : 1), 1, 99);
      if (T.fit) p.fitness = 100;
      if (T.morale) p.morale = clamp(p.morale + T.morale, 0, 100);
      if (!T.fit && !T.morale) p.fitness = clamp(p.fitness - 6, 0, 100);
    }
    this.msg('hub', `Training: ${T.name}. ${T.fit ? 'Alle sind wieder topfit.' : T.morale ? 'Die Stimmung ist spürbar besser.' : 'Die Werte steigen – aber die Beine sind etwas schwerer.'}`);
    return true;
  }
  buy(id) {
    const i = this.market.findIndex(p => p.id === id); if (i < 0) return { ok: false, reason: 'Nicht verfügbar.' };
    const p = this.market[i];
    if (p.value > this.budget) return { ok: false, reason: 'Nicht genug Budget.' };
    if (this.players.length >= 22) return { ok: false, reason: 'Kader voll (22).' };
    this.budget -= p.value; this.market.splice(i, 1); this.players.push({ ...p, own: false }); this.stats.transfersIn++;
    this.msg('hub', `${p.name} unterschreibt bei TechHub United. ${p.desc}`);
    return { ok: true };
  }
  sell(id) {
    const i = this.players.findIndex(p => p.id === id); if (i < 0) return { ok: false };
    const p = this.players[i];
    if (this.players.length <= 14) return { ok: false, reason: 'Mindestens 14 Spieler im Kader.' };
    const gain = Math.round(p.value * MARKET_SELL_FACTOR);
    this.budget += gain; this.players.splice(i, 1); this.stats.transfersOut++;
    this.slots = this.slots.map(s => s === id ? null : s); this.fillLineup();
    this.msg('hub', `${p.name} wechselt für ${gain} T€. Das Budget freut sich, die Kabine weniger.`);
    return { ok: true, gain };
  }
  // ---------- Aufstellung ----------
  available(p) { return p.injured <= 0 && p.suspended <= 0; }
  autoLineup() {
    const F = FORMATIONS[this.formation]; const used = new Set(); this.slots = [];
    for (const [pos] of F.slots) {
      const best = this.players.filter(p => !used.has(p.id) && this.available(p)).map(p => [p, rating(p, pos) * posFit(p, pos) * (0.7 + 0.3 * p.fitness / 100)]).sort((a, b) => b[1] - a[1])[0];
      this.slots.push(best ? best[0].id : null); if (best) used.add(best[0].id);
    }
  }
  fillLineup() { const F = FORMATIONS[this.formation]; const used = new Set(this.slots.filter(Boolean)); this.slots = this.slots.map((s, i) => { if (s && this.players.find(p => p.id === s && this.available(p))) return s; const pos = F.slots[i][0]; const b = this.players.filter(p => !used.has(p.id) && this.available(p)).sort((a, c) => rating(c, pos) * posFit(c, pos) - rating(a, pos) * posFit(a, pos))[0]; if (b) used.add(b.id); return b ? b.id : null; }); }
  setFormation(k) { if (!FORMATIONS[k]) return; this.formation = k; this.autoLineup(); }
  setSlot(i, id) {
    const j = this.slots.indexOf(id);
    if (j >= 0) this.slots[j] = this.slots[i]; // Tausch
    this.slots[i] = id;
  }
  lineupProblems() {
    const F = FORMATIONS[this.formation], out = [];
    this.slots.forEach((id, i) => { const p = this.players.find(x => x.id === id); const pos = F.slots[i][0]; if (!p) out.push(`Position ${pos} ist unbesetzt.`); else if (p.injured > 0) out.push(`${p.name} ist verletzt.`); else if (p.suspended > 0) out.push(`${p.name} ist gesperrt.`); else if (posFit(p, pos) < 0.8) out.push(`${p.name} spielt auf einer fremden Position (${pos}).`); });
    return out;
  }
  bench() { const inL = new Set(this.slots); return this.players.filter(p => !inL.has(p.id) && this.available(p)).sort((a, b) => rating(b) - rating(a)).slice(0, 7); }
  effective(p, pos) {
    const fit = posFit(p, pos), cond = 0.78 + 0.22 * p.fitness / 100, mor = 0.9 + 0.2 * p.morale / 100, form = 1 + p.form * 0.02;
    const e = {}; for (const a of ATTRS) e[a] = clamp(p[a] * fit * cond * mor * form, 5, 99); return e;
  }
  teamForMatch() {
    const F = FORMATIONS[this.formation];
    const players = this.slots.map((id, i) => { const p = this.players.find(x => x.id === id); if (!p) return null; const pos = F.slots[i][0]; return { ref: p, id: p.id, name: p.name, nick: p.nick, pos, slot: F.slots[i], num: i + 1, ...this.effective(p, pos) }; }).filter(Boolean);
    const bench = this.bench().map((p, i) => ({ ref: p, id: p.id, name: p.name, nick: p.nick, pos: p.pos, num: 12 + i, ...this.effective(p, p.pos) }));
    return { name: CLUB.name, short: CLUB.short, color: CLUB.color, color2: CLUB.color2, players, bench, formation: this.formation, style: this.style, tempo: this.tempo, ai: null, me: true };
  }
  opponentForMatch() {
    const o = this.opponent, r = rng(o.seed * 7 + this.diffKey.length), ev = this.pendingEvent?.event;
    const base = o.strength * this.diff.opp * (1 + (ev === 'shadow_it' ? 0.08 : 0));
    const F = FORMATIONS[o.style === 'wall' ? '5-3-2' : o.style === 'boss' || o.style === 'longshot' ? '4-3-3' : '4-4-2'];
    const players = F.slots.map(([pos, x, y], i) => {
      const k = 0.55 + base / 140, p = { id: 'o' + i, name: o.names[i] || `${o.short} ${i + 1}`, pos, slot: F.slots[i], num: i + 1 };
      const prof = { TW: [40, 50, 95, 15, 70], IV: [55, 55, 90, 30, 75], AV: [75, 60, 75, 40, 80], DM: [60, 65, 80, 45, 85], ZM: [70, 85, 55, 60, 75], FL: [90, 72, 30, 65, 75], ST: [80, 70, 25, 92, 70] }[pos];
      ATTRS.forEach((a, j) => p[a] = clamp(prof[j] * k * (0.92 + r() * 0.16), 20, 99));
      if (o.style === 'wall') { p.abwehr = clamp(p.abwehr * 1.12, 20, 99); p.tempo *= 0.85; }
      if (o.style === 'press') p.kondition = clamp(p.kondition * 1.12, 20, 99);
      if (o.style === 'longshot' && pos !== 'TW') p.schuss = clamp(p.schuss * 1.15, 20, 99);
      if (o.style === 'silo') { p.technik *= 0.85; p.abwehr = clamp(p.abwehr * 1.05, 20, 99); }
      if (o.style === 'chaos') { p.technik *= 0.9; p.tempo = clamp(p.tempo * 1.08, 20, 99); }
      if (o.style === 'swarm') { p.schuss *= 0.8; p.tempo = clamp(p.tempo * 1.1, 20, 99); }
      return p;
    });
    if (o.style === 'boss' || ev === 'koloss') { const st = players.find(p => p.pos === 'ST'); Object.assign(st, { name: 'Mainframe-Koloss', nick: 'Der Koloss', koloss: true, tempo: 30, schuss: 97, technik: 60, abwehr: 60, kondition: 95 }); }
    if (ev === 'shadow_it') { const z = players.find(p => p.pos === 'ZM'); Object.assign(z, { name: 'Schatten-IT Sascha', technik: 92, tempo: 85, schuss: 80 }); }
    return { name: o.club, short: o.short, color: o.color, color2: o.color2, players, bench: [], formation: 'opp', style: o.style === 'press' || ev === 'wave_now' ? 'agile' : o.style === 'wall' ? 'clean' : 'agile', tempo: o.style === 'wall' || o.style === 'silo' ? 'slow' : 'normal', ai: o.style, press: ev === 'wave_now' ? 1 : null, me: false };
  }
  // ---------- Störungen der Legacy-KI ----------
  summary() {
    const top = [...this.players].filter(p => this.available(p)).sort((a, b) => rating(b) - rating(a)).slice(0, 3).map(p => p.name);
    return { day: this.day + 1, opponent: this.opponent.club, budget: Math.round(this.budget), pts: this.table[0].pts, wins: this.stats.wins, losses: this.stats.losses, goals: this.stats.goals, conceded: this.stats.conceded, squad: this.players.length, injured: this.players.filter(p => p.injured > 0).length, topPlayers: top, style: this.style, formation: this.formation, lastEvent: this.events.at(-1)?.event || null, difficulty: this.diffKey };
  }
  requestEvent() {
    const s = this.summary();
    const local = () => this.applyEvent(this.localEvent(s), false);
    if (!this.hooks.director) { local(); return; }
    let done = false; const t = setTimeout(() => { if (!done) { done = true; local(); } }, 6000);
    Promise.resolve(this.hooks.director(s)).then(d => { if (done) return; done = true; clearTimeout(t); if (d && EVENTS[d.event]) this.applyEvent(d, true); else local(); }).catch(() => { if (!done) { done = true; clearTimeout(t); local(); } });
  }
  localEvent(s) {
    const r = this.r, opts = [];
    if (s.budget > 1200) opts.push(['budget_cut', 2.5]);
    opts.push(['release_freeze', 2], ['change_requests', 2], ['wave_now', 1.5]);
    if (this.day >= 2) opts.push(['shadow_it', 1.5]);
    if (this.day >= 3 && this.opponent.style !== 'boss' && !this.events.some(e => e.event === 'koloss')) opts.push(['koloss', 1.2]);
    if (this.day === 1 && r() < 0.5) return null; // am zweiten Spieltag gern mal Ruhe
    const pool = opts.filter(([k]) => k !== s.lastEvent);
    let x = r() * pool.reduce((a, [, w]) => a + w, 0); let ev = pool[0][0];
    for (const [k, w] of pool) { x -= w; if (x <= 0) { ev = k; break; } }
    return { event: ev, message: pick(r, TAUNTS[ev]) };
  }
  applyEvent(d, fromAI) {
    if (!d || !EVENTS[d.event]) { this.pendingEvent = null; return; }
    const r = this.r, ev = d.event; this.pendingEvent = { event: ev, ai: fromAI }; this.events.push({ day: this.day, event: ev, ai: fromAI });
    let detail = '';
    if (ev === 'release_freeze') { const c = this.slots.map(id => this.players.find(p => p.id === id)).filter(p => p && this.available(p) && p.pos !== 'TW').sort((a, b) => rating(b) - rating(a)).slice(0, 3); const p = pick(r, c); if (p) { p.suspended = 1; detail = `${p.name} ist für dieses Spiel gesperrt.`; } }
    else if (ev === 'change_requests') { const c = this.slots.map(id => this.players.find(p => p.id === id)).filter(p => p && this.available(p)); const p = pick(r, c); if (p) { p.injured = 1 + Math.floor(r() * 2 * this.diff.inj); detail = `${p.name} fällt ${p.injured === 1 ? 'ein Spiel' : p.injured + ' Spiele'} aus.`; } }
    else if (ev === 'budget_cut') { const cut = Math.round(Math.min(this.budget * 0.2, 150 + this.day * 60)); this.budget -= cut; detail = `−${cut} T€ Transferbudget.`; }
    else if (ev === 'shadow_it') detail = 'Der Gegner stellt einen Spieler aus dem Keller auf: Schatten-IT Sascha.';
    else if (ev === 'koloss') detail = 'Der Mainframe-Koloss steht im gegnerischen Sturm.';
    else if (ev === 'wave_now') detail = 'Der Gegner wird 90 Minuten lang pressen.';
    this.fillLineup();
    this.msg('legacy', d.message || pick(r, TAUNTS[ev]));
    this.msg('hub', `Störung durch die Legacy-KI: ${EVENTS[ev].name}. ${detail}`);
    this.hooks.onEvent?.({ type: 'director', event: ev, detail, ai: fromAI });
  }
  // ---------- Spielergebnis ----------
  applyResult(res) {
    // res: { home, away, gh, ga, mine: 'home'|'away', events, ratings: {id: n}, injuries: [id], yellows: [id], reds: [id], scorers: [id], assists: [id] }
    const gf = res.mine === 'home' ? res.gh : res.ga, ga = res.mine === 'home' ? res.ga : res.gh;
    const won = gf > ga, draw = gf === ga; const o = this.opponent;
    const T = this.table[0], O = this.table.find(t => t.id === o.id);
    T.gf += gf; T.ga += ga; O.gf += ga; O.ga += gf;
    if (won) { T.pts += 3; T.w++; O.l++; this.stats.wins++; } else if (draw) { T.pts++; O.pts++; T.d++; O.d++; this.stats.draws++; } else { O.pts += 3; O.w++; T.l++; this.stats.losses++; }
    this.stats.goals += gf; this.stats.conceded += ga; if (ga === 0) this.stats.cleanSheets++;
    // Spieler
    for (const p of this.players) {
      if (res.played?.includes(p.id)) { p.apps++; p.fitness = clamp(p.fitness - (res.minutes?.[p.id] ?? 90) * 0.34, 0, 100); p.form = clamp(p.form + (won ? 1 : draw ? 0 : -1), -3, 3); p.morale = clamp(p.morale + (won ? 6 : draw ? 1 : -6), 0, 100); }
      else p.morale = clamp(p.morale - 2, 0, 100);
      if (res.yellows?.includes(p.id)) { p.yellows++; if (p.yellows % 2 === 0) { p.suspended = 1; this.msg('hub', `${p.name} hat die zweite gelbe Karte – ein Spiel Sperre.`); } }
      if (res.reds?.includes(p.id)) { p.suspended = 1; this.msg('hub', `${p.name} sieht Rot und fehlt im nächsten Spiel.`); }
      if (res.injuries?.includes(p.id)) { p.injured = 1 + Math.floor(this.r() * 2 * this.diff.inj); this.msg('hub', `${p.name} ist verletzt – ${p.injured === 1 ? 'ein Spiel' : p.injured + ' Spiele'} Pause.`); }
      p.goals += (res.scorers || []).filter(id => id === p.id).length; p.assists += (res.assists || []).filter(id => id === p.id).length;
    }
    // Einnahmen: Zuschauer, Prämie, Sponsor „Data Lake“
    const income = Math.round((this.home ? 260 : 140) + (won ? 220 : draw ? 90 : 30) + gf * 25 + this.day * 20);
    this.budget += income;
    const pts = (won ? SEASON_SCORE.win : draw ? SEASON_SCORE.draw : 0) + gf * SEASON_SCORE.goal + (ga === 0 ? SEASON_SCORE.cleanSheet : 0);
    this.results.push({ day: this.day, opp: o.id, club: o.club, home: this.home, gf, ga, won, draw, pts, income, event: this.pendingEvent?.event || null });
    this.simulateOthers();
    this.msg(won ? 'hub' : 'legacy', won ? `${gf}:${ga} gegen ${o.club} – ${o.real}` : pick(this.r, TAUNTS.win));
    if (won) this.msg('legacy', pick(this.r, TAUNTS.lose));
    this.hooks.onEvent?.({ type: 'result', won, draw, gf, ga, income, pts });
    this.day++;
    if (this.day >= OPPONENTS.length) { this.over = true; this.finish(); } else this.prepareWeek();
    return { won, draw, gf, ga, income, pts };
  }
  simulateOthers() {
    // die anderen sechs Clubs spielen untereinander; Paarungen rotieren
    const others = this.table.slice(1).filter(t => t.id !== this.opponent.id);
    const r = this.r, d = this.day;
    for (let i = 0; i < 3; i++) {
      const a = others[(i + d) % 6], b = others[(5 - i + d) % 6]; if (a === b) continue;
      const sa = OPPONENTS.find(o => o.id === a.id).strength, sb = OPPONENTS.find(o => o.id === b.id).strength;
      const ga = Math.floor(Math.max(0, (sa - 50) / 12 + r() * 2.2 + (r() < 0.2 ? 1 : 0))), gb = Math.floor(Math.max(0, (sb - 50) / 12 + r() * 2.2));
      a.gf += ga; a.ga += gb; b.gf += gb; b.ga += ga;
      if (ga > gb) { a.pts += 3; a.w++; b.l++; } else if (ga < gb) { b.pts += 3; b.w++; a.l++; } else { a.pts++; b.pts++; a.d++; b.d++; }
    }
  }
  standings() { return [...this.table].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf); }
  rank() { return this.standings().findIndex(t => t.me) + 1; }
  computeScore() {
    const base = this.results.reduce((s, r) => s + r.pts, 0);
    const rk = this.rank(), place = rk === 1 ? SEASON_SCORE.title : rk === 2 ? SEASON_SCORE.second : rk === 3 ? SEASON_SCORE.third : 0;
    const eco = Math.round(Math.max(0, this.budget) * SEASON_SCORE.budget);
    const mult = this.diff.mult;
    return { score: Math.round((base + place + eco) * mult), breakdown: { base, place, eco, mult, rank: rk } };
  }
  finish() {
    const sc = this.computeScore(); const rk = sc.breakdown.rank;
    this.result = { won: rk === 1, rank: rk, ...sc, duration: this.results.length, reason: rk === 1 ? 'Meister der Legacy League – der Monolith ist gestürzt!' : rk <= 3 ? `Platz ${rk} – stark, aber die Legacy-IT bleibt vorn.` : `Platz ${rk} – die Legacy-IT hat diese Saison gewonnen.` };
    this.hooks.onEnd?.(this.result);
  }
}
