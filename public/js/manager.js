// Saison- und Vereinslogik: Kader, Training, Transfers, Taktik, Tabelle, Störungen der Legacy-KI, Punktewertung
import { DIFFICULTY, FORMATIONS, STYLES, TEMPO, SQUAD, MARKET_POOL, MARKET_SELL_FACTOR, TRAINING, OPPONENTS, SEASON_SCORE, EVENTS, TAUNTS, POS_GROUP, CLUB, OBJECTIVES, DECISIONS, SEASON_LEN, STADIUM, FACILITIES, ECON, INTENSITY, ATTR_NAMES } from './data.js';

// Deterministischer Zufall (für Tages-Challenge und Tests)
export function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
export const ATTRS = ['tempo', 'technik', 'abwehr', 'schuss', 'kondition'];
// Potenzial 1–5 Sterne: junge Spieler:innen entwickeln sich schneller
export function potentialOf(p, r = Math.random) { const base = p.age <= 21 ? 4.3 : p.age <= 24 ? 3.6 : p.age <= 28 ? 2.8 : p.age <= 31 ? 2.0 : 1.3; return Math.max(1, Math.min(5, Math.round(base + (r() - 0.5) * 1.4))); }
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
    this.lenKey = SEASON_LEN[o.length] ? o.length : 'short'; this.len = SEASON_LEN[this.lenKey].days;
    // Wirtschaft
    this.econ = { price: ECON.priceDefault, stadium: 0, pending: null, fac: { shop: 0, vip: 0, train: 0, medic: 0 }, fans: 50, invested: 0, history: [], last: null };
    this.players = SQUAD.map(p => ({ ...p, fitness: 100, morale: 70, form: 0, injured: 0, suspended: 0, yellows: 0, goals: 0, assists: 0, apps: 0, own: true, pot: potentialOf(p, this.r) }));
    for (const p of this.players) p.start = Object.fromEntries(ATTRS.map(a => [a, p[a]]));
    this.formation = '4-4-2'; this.style = 'clean'; this.tempo = 'normal';
    this.coh = { '4-4-2': 60, '4-3-3': 40, '5-3-2': 40, '3-5-2': 35 }; this.cohStyle = { clean: 60, agile: 40, bigbang: 40 }; this.lastTraining = null;
    this.slots = []; this.autoLineup();
    this.captain = null; this.penTaker = null; this.cornerTaker = null; this.fkTaker = null; this.cornerVar = 'mix'; this.roles = {}; this.pickLeaders();
    this.objective = null; this.decision = null; this.decided = []; this.sponsorPerWin = false; this.oppMod = 0; this.extraTraining = false;
    this.results = []; this.log = []; this.events = []; this.trained = null; this.market = [];
    this.table = [{ id: 'techhub', club: CLUB.name, short: CLUB.short, pts: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0, me: true }, ...OPPONENTS.map(o => ({ id: o.id, club: o.club, short: o.short, pts: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0 }))];
    this.stats = { goals: 0, conceded: 0, wins: 0, draws: 0, losses: 0, transfersIn: 0, transfersOut: 0, trainings: 0, cleanSheets: 0, bonus: 0, objectives: 0, developed: 0 };
    this.pendingEvent = null; this.weekMsgs = [];
    this.seasonNo = 1; this.league = 'legacy';
    this.prepareWeek(true);
  }
  // Karriere: nächste Saison mit demselben Kader (älter, entwickelt), Nachwuchs, Aufstieg in die Cloud League
  nextSeason(hooks) {
    const n = new Season({ difficulty: this.diffKey, length: this.lenKey, hooks: hooks || this.hooks, seed: (this.r() * 0xffffffff) >>> 0 });
    const r = n.r, msgs = [], promoted = this.rank() === 1 && this.league !== 'cloud';
    n.seasonNo = (this.seasonNo || 1) + 1; n.league = promoted || this.league === 'cloud' ? 'cloud' : 'legacy';
    const players = [];
    for (const p0 of this.players) {
      const p = { ...p0, age: p0.age + 1, fitness: 100, morale: clamp(p0.morale + 5, 40, 100), form: 0, injured: 0, suspended: 0, yellows: 0, goals: 0, assists: 0, apps: 0 };
      if (p.age >= 35 && r() < 0.6) { msgs.push(`${p.name} beendet mit ${p.age} die Karriere.`); continue; }
      const grow = p.age <= 23 ? (p.pot || 3) * 1.4 : p.age <= 27 ? (p.pot || 3) * 0.6 : p.age <= 30 ? 0 : -(p.age - 30) * 0.9;
      for (const a of ATTRS) { if (p.pos === 'TW' && a === 'schuss') continue; p[a] = clamp(Math.round(p[a] + grow * (0.6 + r() * 0.8)), 15, 99); }
      p.start = Object.fromEntries(ATTRS.map(a => [a, p[a]])); p.value = Math.max(80, Math.round(p.value * (grow > 0 ? 1.12 : grow < 0 ? 0.88 : 1) / 10) * 10);
      players.push(p);
    }
    // Nachwuchs aus der TechHub-Akademie
    const NAMES = ['Kai Kubernetes', 'Nele Node', 'Pia Pipeline', 'Tom Terraform', 'Lia Lambda', 'Ben Bytecode', 'Mia Microservice', 'Jan JSON'];
    const need = Math.max(2, 18 - players.length), POS = ['IV', 'AV', 'ZM', 'FL', 'ST', 'DM'];
    for (let i = 0; i < need; i++) { const pos = POS[Math.floor(r() * POS.length)], b = 46 + r() * 10, prof = { IV: [0, 2, 12, -8, 4], AV: [8, 2, 6, -4, 6], DM: [0, 4, 10, -2, 6], ZM: [2, 10, 0, 2, 4], FL: [12, 6, -10, 4, 4], ST: [6, 2, -12, 14, 2] }[pos];
      const p = { id: 'y' + n.seasonNo + '_' + i, name: NAMES[(n.seasonNo * 3 + i) % NAMES.length], nick: 'Akademie', pos, age: 18 + Math.floor(r() * 2), value: 120, unit: 'youth', desc: 'Aus der eigenen TechHub-Akademie.', fitness: 100, morale: 75, form: 0, injured: 0, suspended: 0, yellows: 0, goals: 0, assists: 0, apps: 0, own: true, pot: 4 + (r() < 0.35 ? 1 : 0) };
      ATTRS.forEach((a, j) => p[a] = clamp(Math.round(b + prof[j] + (r() - 0.5) * 6), 25, 80)); p.start = Object.fromEntries(ATTRS.map(a => [a, p[a]])); players.push(p); msgs.push(`Nachwuchs: ${p.name} (${pos}, ${p.age} J.) rückt aus der Akademie auf.`); }
    n.players = players; n.budget = Math.round(n.diff.budget * 0.6 + Math.max(0, this.budget) * 0.5);
    n.econ = { ...this.econ, pending: null, history: [], last: null, fac: { ...this.econ.fac } };
    n.formation = this.formation; n.style = this.style; n.tempo = this.tempo; n.coh = { ...this.coh }; n.cohStyle = { ...this.cohStyle };
    n.cornerVar = this.cornerVar; n.roles = {}; n.log = []; n.slots = []; n.autoLineup(); n.pickLeaders(); n.genMarket();
    n.msg('hub', `Saison ${n.seasonNo}${n.league === 'cloud' ? ' in der Cloud League – die Gegner sind deutlich stärker.' : '.'} ${promoted ? 'Aufstieg geschafft! ' : ''}Der Kader ist ein Jahr älter.`);
    for (const m of msgs) n.msg('hub', m);
    return n;
  }
  get opponent() { return this.lenKey === 'expo' ? OPPONENTS[[0, 3, 6][this.day % 3]] : OPPONENTS[this.day % OPPONENTS.length]; }
  get home() { return this.day % 2 === 0; }
  msg(who, text) { const m = { who, text, day: this.day }; this.log.push(m); this.hooks.onMessage?.(m); }

  // ---------- Woche ----------
  prepareWeek(first = false) {
    this.trained = null; this.weekMsgs = []; this.extraTraining = false; this.oppMod = 0;
    this.pickObjective(); this.pickDecision(first); this.pickWeather();
    for (const p of this.players) {
      if (!first) { p.fitness = clamp(p.fitness + 22 + (this.econ?.fac.medic ? 8 : 0), 0, 100); if (p.injured > 0) p.injured -= this.econ?.fac.medic && p.injured > 1 ? 2 : 1; if (p.suspended > 0) p.suspended--; p.morale = clamp(p.morale + (p.morale < 60 ? 3 : -1), 20, 100); }
    }
    this.genMarket();
    this.pendingEvent = null;
    if (!first) { this.fillLineup(); this.pickLeaders(); }
    if (!first) this.requestEvent();
    const o = this.opponent;
    this.msg('hub', o.lena);
    if (this.objective) this.msg('hub', `Wochenziel: ${OBJECTIVES[this.objective].name} (+${OBJECTIVES[this.objective].bonus} Punkte).`);
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
      p.pot = potentialOf(p, r);
      ATTRS.forEach((a, j) => p[a] = clamp(Math.round(t.base[j] * k), 30, 97));
      p.value = Math.round((rating(p) ** 2) / 9 + (p.age < 24 ? 120 : 0)) * 10 / 10;
      p.value = Math.round(p.value / 10) * 10;
      this.market.push(p);
    }
  }
  // Training: Schwerpunkt + Intensität + bis zu zwei Einzeltrainings; liefert einen Bericht mit den Veränderungen
  train(k, o = {}) {
    if ((this.trained && !this.extraTraining) || !TRAINING[k]) return false;
    const T = TRAINING[k], I = INTENSITY[o.intensity] || INTENSITY.normal, fac = 1 + 0.2 * (this.econ?.fac.train || 0), r = this.r;
    if (this.trained) this.extraTraining = false; this.trained = k; this.stats.trainings++;
    const before = new Map(this.players.map(p => [p.id, Object.fromEntries(ATTRS.map(a => [a, p[a]]))])), injured = [];
    const pf = (p) => (0.5 + (p.pot || 3) * 0.2) * (p.age >= 31 ? 0.75 : 1);
    for (const p of this.players) {
      if (p.injured > 0) continue;
      const inGroup = T.group.includes(POS_GROUP[p.pos]);
      if (inGroup) for (const a in T.gain) p[a] = clamp(p[a] + T.gain[a] * pf(p) * fac * I.gain, 1, 99);
      if (T.fit) p.fitness = clamp(o.intensity === 'hard' ? 85 : 100, 0, 100);
      else p.fitness = clamp(p.fitness + I.fit, 0, 100);
      if (T.morale) p.morale = clamp(p.morale + T.morale, 0, 100);
      p.morale = clamp(p.morale + I.morale, 0, 100);
      if (I.inj && (inGroup || T.fit) && r() < I.inj) { p.injured = 1; injured.push(p.name); }
    }
    // Einzeltraining
    for (const it of (o.individual || []).slice(0, 2)) {
      const p = this.players.find(x => x.id === it.id); if (!p || p.injured > 0 || !ATTRS.includes(it.attr)) continue;
      p[it.attr] = clamp(p[it.attr] + 1.6 * pf(p) * fac * I.gain, 1, 99); p.fitness = clamp(p.fitness - 4, 0, 100);
    }
    // Taktiktraining: Eingespieltheit
    let coh = null;
    if (T.tactic) { const g = Math.round(18 * I.gain + 4); this.coh[this.formation] = clamp((this.coh[this.formation] || 40) + g, 0, 100); this.cohStyle[this.style] = clamp((this.cohStyle[this.style] || 40) + Math.round(g * 0.6), 0, 100); coh = { formation: this.formation, style: this.style, value: this.coh[this.formation], styleValue: this.cohStyle[this.style] }; }
    // Bericht: sichtbare Veränderungen (gerundet)
    const changes = [];
    for (const p of this.players) { const b0 = before.get(p.id); if (!b0) continue; const d = {}; for (const a of ATTRS) { const x = Math.round(p[a]) - Math.round(b0[a]); if (x) d[a] = x; } if (Object.keys(d).length) changes.push({ id: p.id, name: p.name, pos: p.pos, d }); }
    for (const c of changes) { const p = this.players.find(x => x.id === c.id), r0 = rating({ ...p, ...before.get(p.id) }), r1 = rating(p); if (r0 > 0) p.value = Math.round(p.value * (r1 / r0) ** 2 / 10) * 10; }
    this.lastTraining = { k, name: T.name, intensity: o.intensity || 'normal', changes, injured, coh, individual: o.individual || [] };
    this.msg('hub', `Training: ${T.name} (${I.name}). ${changes.length ? changes.length + ' Spieler:innen haben sich verbessert.' : T.fit ? 'Alle sind wieder topfit.' : T.morale ? 'Die Stimmung ist spürbar besser.' : coh ? 'Die Abläufe sitzen besser.' : ''}${injured.length ? ' Verletzt: ' + injured.join(', ') + '.' : ''}`);
    if (injured.length) this.fillLineup();
    return this.lastTraining;
  }
  // Vorschau: wer profitiert vom Schwerpunkt
  trainPreview(k, intensity = 'normal') {
    const T = TRAINING[k], I = INTENSITY[intensity] || INTENSITY.normal; if (!T) return null;
    const who = this.players.filter(p => p.injured <= 0 && T.group.includes(POS_GROUP[p.pos]));
    const gain = Object.values(T.gain).reduce((a, b) => a + b, 0) * I.gain * (1 + 0.2 * (this.econ?.fac.train || 0));
    return { n: who.length, gain: Math.round(gain * 10) / 10, risk: I.inj, fit: T.fit ? (intensity === 'hard' ? 85 : 100) : null };
  }
  cohesion() { return Math.round(((this.coh[this.formation] || 40) * 0.6 + (this.cohStyle[this.style] || 40) * 0.4)); }
  buy(id) {
    const i = this.market.findIndex(p => p.id === id); if (i < 0) return { ok: false, reason: 'Nicht verfügbar.' };
    const p = this.market[i];
    if (p.value > this.budget) return { ok: false, reason: 'Nicht genug Budget.' };
    if (this.players.length >= 22) return { ok: false, reason: 'Kader voll (22).' };
    this.budget -= p.value; this.market.splice(i, 1); this.players.push({ ...p, own: false, start: Object.fromEntries(ATTRS.map(a => [a, p[a]])) }); this.stats.transfersIn++;
    this.msg('hub', `${p.name} unterschreibt bei TechHub United. ${p.desc}`);
    return { ok: true };
  }
  // Verkaufspreis: Grundwert 60 % des Marktwerts, Form und Alter verschieben ihn; Verletzte bringen weniger
  salePrice(p) { const f = MARKET_SELL_FACTOR + (p.form || 0) * 0.03 + (p.age <= 23 ? 0.08 : p.age >= 31 ? -0.08 : 0) - (p.injured > 0 ? 0.15 : 0); return Math.max(20, Math.round(p.value * f / 10) * 10); }
  sell(id) {
    const i = this.players.findIndex(p => p.id === id); if (i < 0) return { ok: false };
    const p = this.players[i];
    if (this.players.length <= 14) return { ok: false, reason: 'Mindestens 14 Spieler im Kader.' };
    if (p.pos === 'TW' && this.players.filter(x => x.pos === 'TW').length <= 1) return { ok: false, reason: 'Der letzte Torwart bleibt im Kader.' };
    const gain = this.salePrice(p);
    if (this.captain === id) this.captain = null; if (this.penTaker === id) this.penTaker = null; if (this.cornerTaker === id) this.cornerTaker = null; if (this.fkTaker === id) this.fkTaker = null;
    this.budget += gain; this.players.splice(i, 1); this.stats.transfersOut++;
    this.slots = this.slots.map(s => s === id ? null : s); this.fillLineup(); this.pickLeaders();
    this.msg('hub', `${p.name} wechselt für ${gain} T€. Das Budget freut sich, die Kabine weniger.`);
    return { ok: true, gain };
  }
  // ---------- Wirtschaft ----------
  get capacity() { return STADIUM[this.econ.stadium].cap; }
  wages() { return Math.round(this.players.reduce((a, p) => a + p.value, 0) * ECON.wageRate); }
  upkeep() { return ECON.upkeep * (1 + this.econ.stadium) + 10 * Object.values(this.econ.fac).reduce((a, b) => a + b, 0); }
  // erwartete Zuschauer bei einem Heimspiel (Preis in €)
  demand(price = this.econ.price, opp = this.opponent) {
    const form = this.results.slice(-3).reduce((a, r) => a + (r.won ? 0.04 : r.draw ? 0.01 : -0.03), 0);
    const attr = (opp.strength - 58) / 24 * 0.14 + (opp.style === 'boss' ? 0.08 : 0);
    const weather = this.weather === 'rain' ? -0.06 : this.weather === 'snow' ? -0.1 : this.weather === 'wind' ? -0.03 : 0.02;
    const priceEff = (price - 25) / 35 * 0.42;
    return clamp(0.2 + this.econ.fans / 100 * 0.62 + attr + form + weather - priceEff, 0.06, 1);
  }
  forecast(price = this.econ.price) { const att = Math.round(this.capacity * this.demand(price) / 10) * 10; return { att, tickets: Math.round(att * price / 1000) }; }
  setPrice(p) { this.econ.price = clamp(Math.round(p), ECON.priceMin, ECON.priceMax); }
  // Ausbau: Stadion ist zum nächsten Spieltag fertig, Einrichtungen sofort
  buildStadium() { const n = this.econ.stadium + 1; if (n >= STADIUM.length || this.econ.pending) return { ok: false, reason: 'Ausbau nicht möglich.' }; const c = STADIUM[n].cost; if (c > this.budget) return { ok: false, reason: 'Nicht genug Budget.' }; this.budget -= c; this.econ.invested += c; this.econ.pending = n; this.msg('hub', `Bauauftrag erteilt: ${STADIUM[n].name} (${STADIUM[n].cap.toLocaleString('de-DE')} Plätze) – fertig zum nächsten Spieltag.`); return { ok: true }; }
  buildFacility(k) { const F = FACILITIES[k], lv = this.econ.fac[k]; if (!F || lv >= F.max) return { ok: false, reason: 'Bereits voll ausgebaut.' }; const c = F.cost[lv]; if (c > this.budget) return { ok: false, reason: 'Nicht genug Budget.' }; this.budget -= c; this.econ.invested += c; this.econ.fac[k] = lv + 1; this.msg('hub', `${F.name} ausgebaut (Stufe ${lv + 1}).`); return { ok: true }; }
  // Abrechnung nach dem Spiel
  settle(won, draw, gf) {
    const e = this.econ, home = this.home, mor = this.players.reduce((a, p) => a + p.morale, 0) / Math.max(1, this.players.length);
    const f = home ? this.forecast() : { att: 0, tickets: 0 };
    const att = home ? Math.round(f.att * (0.95 + this.r() * 0.1) / 10) * 10 : 0, tickets = Math.round(att * e.price / 1000);
    const tv = ECON.tv + (won ? ECON.tvWin : draw ? ECON.tvDraw : 0) + gf * 15;
    const merch = Math.round(e.fac.shop * (25 + e.fans * 0.9) * (0.9 + mor / 500));
    const vip = home ? e.fac.vip * 70 : 0, sponsor = 60 + (won && this.sponsorPerWin ? 150 : 0);
    const wages = this.wages(), upkeep = this.upkeep();
    const income = tickets + tv + merch + vip + sponsor, costs = wages + upkeep, net = income - costs;
    this.budget += net;
    // Fans: Ergebnisse, Tore, Ticketpreis, volle Ränge
    let df = (won ? 4 : draw ? 1 : -3) + gf * 0.6;
    if (home && e.price > 35) df -= (e.price - 35) / 6; if (home && e.price < 18) df += 1;
    if (home && att >= this.capacity * 0.97) df += 1;
    e.fans = clamp(e.fans + df, 5, 100);
    const rec = { day: this.day, home, att, cap: home ? this.capacity : 0, price: home ? e.price : 0, tickets, tv, merch, vip, sponsor, wages, upkeep, income, costs, net, fans: Math.round(e.fans) };
    e.last = rec; e.history.push(rec);
    if (e.pending !== null) { e.stadium = e.pending; e.pending = null; this.msg('hub', `Ausbau fertig: ${STADIUM[e.stadium].name} mit ${this.capacity.toLocaleString('de-DE')} Plätzen.`); }
    if (home) this.msg('hub', `${att.toLocaleString('de-DE')} Zuschauer (${Math.round(att / this.capacity * 100)} %) – Tickets ${tickets} T€, Bilanz ${net >= 0 ? '+' : ''}${net} T€.`);
    if (this.budget < 0) this.msg('hub', 'Achtung: Das Konto ist im Minus. Verkaufe Spieler oder senke die Kosten.');
    return rec;
  }
  // ---------- Wetter ----------
  pickWeather() { const x = this.r(); this.weather = x < 0.52 ? 'sun' : x < 0.77 ? 'rain' : x < 0.9 || this.day < 4 ? 'wind' : 'snow'; }
  // ---------- Kapitän, Elfmeterschütze ----------
  pickLeaders() {
    const inL = this.slots.map(id => this.players.find(p => p.id === id)).filter(p => p && this.available(p));
    if (!inL.find(p => p.id === this.captain)) { const c = inL.filter(p => p.pos !== 'TW').sort((a, b) => (b.age + rating(b) / 3) - (a.age + rating(a) / 3))[0]; this.captain = c ? c.id : null; }
    if (!inL.find(p => p.id === this.penTaker)) { const t = inL.filter(p => p.pos !== 'TW').sort((a, b) => b.schuss - a.schuss)[0]; this.penTaker = t ? t.id : null; }
  }
  setCaptain(id) { if (this.players.find(p => p.id === id)) { this.captain = id; const p = this.players.find(x => x.id === id); p.morale = clamp(p.morale + 5, 0, 100); } }
  setPenTaker(id) { if (this.players.find(p => p.id === id)) this.penTaker = id; }
  setCornerTaker(id) { if (this.players.find(p => p.id === id)) this.cornerTaker = id; }
  setFkTaker(id) { if (this.players.find(p => p.id === id)) this.fkTaker = id; }
  setRole(id, pos, role) { (this.roles ||= {}); if (!role) delete this.roles[id]; else this.roles[id] = { pos, role }; }
  // ---------- Wochenziel ----------
  pickObjective() {
    const keys = Object.keys(OBJECTIVES).filter(k => k !== this.objective && !(k === 'margin' && this.opponent.strength >= 76));
    this.objective = keys[Math.floor(this.r() * keys.length)];
  }
  checkObjective(res, gf, ga) {
    const k = this.objective; if (!k) return null; const mi = res.mine === 'home' ? 0 : 1;
    const myEv = (res.events || []).filter(e => e.team === mi);
    const ok = k === 'clean' ? ga === 0 : k === 'goals2' ? gf >= 2 : k === 'margin' ? gf - ga >= 2 : k === 'poss' ? (res.poss?.[mi] || 0) > (res.poss?.[1 - mi] || 0)
      : k === 'fair' ? !myEv.some(e => e.type === 'yellow' || e.type === 'red') : k === 'young' ? (res.scorers || []).some(id => (this.players.find(p => p.id === id)?.age || 99) < 24)
      : k === 'early' ? myEv.some(e => e.type === 'goal' && e.min < 45) : k === 'shots' ? (res.shots?.[mi]?.[0] || 0) >= 10 : false;
    return { key: k, name: OBJECTIVES[k].name, ok, bonus: ok ? OBJECTIVES[k].bonus : 0 };
  }
  // ---------- Vorstandsentscheidung ----------
  pickDecision(first) {
    this.decision = null; if (first) return;
    let keys = Object.keys(DECISIONS).filter(k => !this.decided.includes(k) && (k !== 'offer' || this.offerCandidate()));
    if (!keys.length) keys = ['fanday', 'overtime', 'press', 'scout', 'hypercare', 'hotfix', 'demo'].filter(k => k !== this.decided.at(-1));
    if (!keys.length) return;
    const key = keys[Math.floor(this.r() * keys.length)]; const d = { key, ...DECISIONS[key], chosen: null };
    if (key === 'offer') { const p = this.offerCandidate(); d.pid = p.id; d.price = Math.round(p.value * 1.5 / 10) * 10; d.text = d.text.replace('{p}', p.name); d.options = d.options.map(o => ({ ...o, effect: o.effect.replace('{v}', d.price) })); }
    this.decision = d;
  }
  offerCandidate() { const inL = new Set(this.slots); return [...this.players].filter(p => !inL.has(p.id) && this.players.length > 14).sort((a, b) => b.value - a.value)[0] || null; }
  decide(optKey) {
    const d = this.decision; if (!d || d.chosen) return false; const o = d.options.find(x => x.key === optKey); if (!o) return false;
    d.chosen = optKey; this.decided.push(d.key); const r = this.r; let note = '';
    if (d.key === 'sponsor') { if (optKey === 'now') { this.budget += 300; note = 'Data Lake GmbH überweist 300 T€.'; } else { this.sponsorPerWin = true; note = 'Data Lake GmbH zahlt ab jetzt 150 T€ pro Sieg.'; } }
    else if (d.key === 'talent') { if (optKey === 'promote') { const t = { id: 'y' + this.day, name: ['Yara Young', 'Timo Trainee', 'Neo Newbie'][this.day % 3], nick: 'Das Talent', pos: ['ZM', 'FL', 'ST', 'AV'][Math.floor(r() * 4)], age: 18, desc: 'Frisch aus der Akademie. Noch roh, aber lernt in jedem Training.', unit: 'academy', fitness: 100, morale: 80, form: 0, injured: 0, suspended: 0, yellows: 0, goals: 0, assists: 0, apps: 0, pot: 5, own: false }; ATTRS.forEach(a => t[a] = 46 + Math.floor(r() * 14)); t.value = 180; if (this.players.length < 22) { this.players.push(t); note = `${t.name} rückt in den Kader auf.`; } else { this.budget += 120; note = 'Kader voll – das Talent wird verliehen (+120 T€).'; } } else { this.budget += 120; note = 'Das Talent spielt auf Leihbasis – 120 T€ für die Kasse.'; } }
    else if (d.key === 'fanday') { if (optKey === 'yes') { this.budget -= 120; for (const p of this.players) p.morale = clamp(p.morale + 10, 0, 100); note = 'Der Fan-Tag war ein Erfolg – die Kabine strahlt.'; } else note = 'Kein Fan-Tag diese Woche.'; }
    else if (d.key === 'overtime') { if (optKey === 'yes') { this.extraTraining = true; for (const p of this.players) p.fitness = clamp(p.fitness - 12, 0, 100); note = 'Zweite Trainingseinheit freigeschaltet.'; } else { for (const p of this.players) p.fitness = clamp(p.fitness + 6, 0, 100); note = 'Regeneration – alle etwas frischer.'; } }
    else if (d.key === 'press') { if (optKey === 'bold') { for (const p of this.players) p.morale = clamp(p.morale + 6, 0, 100); this.oppMod += 4; note = 'Die Kampfansage macht die Runde – der Gegner ist gewarnt.'; } else { for (const p of this.players) p.morale = clamp(p.morale + 2, 0, 100); note = 'Bescheiden und ruhig – so mag es Lena.'; } }
    else if (d.key === 'scout') { if (optKey === 'buy') { this.budget -= 100; this.oppMod -= 6; note = 'Die Analyse liegt vor: Der Gegner hat Lücken hinter den Außenverteidigern.'; } else note = 'Keine Analyse – wir vertrauen auf Lenas Bauchgefühl.'; }
    else if (d.key === 'hypercare') { if (optKey === 'yes') { this.budget += 200; const c = this.slots.map(id => this.players.find(p => p.id === id)).filter(p => p && p.pos !== 'TW'); const p = c[Math.floor(r() * c.length)]; if (p) { p.fitness = clamp(p.fitness - 45, 0, 100); note = `${p.name} hilft beim Go-Live – und kommt müde zurück. +200 T€.`; } } else note = 'Der Betrieb muss ohne uns auskommen.'; }
    else if (d.key === 'hotfix') { if (optKey === 'patch') { this.oppMod -= 3; for (const p of this.players) p.morale = clamp(p.morale - 4, 0, 100); note = 'Notfall-Patch eingespielt – läuft, aber keiner weiß genau warum.'; } else { this.budget -= 150; this.coh[this.formation] = clamp((this.coh[this.formation] || 40) + 8, 0, 100); note = 'Saubere Migration: Das Team versteht das System jetzt wirklich.'; } }
    else if (d.key === 'joule') { if (optKey === 'yes') { this.budget -= 180; for (const p of this.players) p.technik = clamp(p.technik + 1, 1, 99); note = 'Der KI-Assistent ist im Trainerteam angekommen.'; } else note = 'Der KI-Assistent bleibt auf der Wunschliste.'; }
    else if (d.key === 'hackathon') { if (optKey === 'yes') { this.econ.fans = clamp(this.econ.fans + 6, 0, 100); for (const p of this.players) p.fitness = clamp(p.fitness - 8, 0, 100); note = 'Der Hackathon war ein Fest – die Stadion-App ist live.'; } else { this.econ.fans = clamp(this.econ.fans - 2, 0, 100); note = 'Kein Hackathon – der Fanclub ist enttäuscht.'; } }
    else if (d.key === 'demo') { if (optKey === 'yes') { this.budget += 250; for (const p of this.players) p.morale = clamp(p.morale - 4, 0, 100); note = 'Die Demo lief sauber – 250 T€ fließen in die Vereinskasse.'; } else { for (const p of this.players) p.morale = clamp(p.morale + 2, 0, 100); note = 'Die Demo wird vertagt, volle Konzentration aufs Spiel.'; } }
    else if (d.key === 'cloud') { if (optKey === 'yes') { this.budget -= 100; for (const p of this.players) { p.kondition = clamp(p.kondition + 2, 1, 99); p.fitness = clamp(p.fitness + 8, 0, 100); } note = 'Die Fitnessdaten sind in der Cloud – Regeneration nach Plan.'; } else note = 'Der Server im Keller brummt weiter.'; }
    else if (d.key === 'offer') { const p = this.players.find(x => x.id === d.pid); if (optKey === 'sell' && p && this.players.length > 14) { this.budget += d.price; this.players = this.players.filter(x => x !== p); this.stats.transfersOut++; this.fillLineup(); note = `${p.name} wechselt für ${d.price} T€.`; } else if (p) { p.morale = clamp(p.morale + 8, 0, 100); note = `${p.name} bleibt – und freut sich über das Vertrauen.`; } }
    this.msg('hub', `Vorstand: ${d.title} – ${note}`);
    this.hooks.onDecision?.(d, note);
    return true;
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
    const fit = posFit(p, pos), cond = 0.78 + 0.22 * p.fitness / 100, mor = 0.9 + 0.2 * p.morale / 100, form = 1 + p.form * 0.02, coh = 0.96 + this.cohesion() / 100 * 0.08;
    const e = {}; for (const a of ATTRS) e[a] = clamp(p[a] * fit * cond * mor * form * coh, 5, 99); return e;
  }
  teamForMatch() {
    const F = FORMATIONS[this.formation];
    const R = this.roles || {}, players = this.slots.map((id, i) => { const p = this.players.find(x => x.id === id); if (!p) return null; const pos = F.slots[i][0]; return { ref: p, id: p.id, name: p.name, nick: p.nick, pos, slot: F.slots[i], num: i + 1, role: (R[p.id] && R[p.id].pos === pos) ? R[p.id].role : '', ...this.effective(p, pos) }; }).filter(Boolean);
    const bench = this.bench().map((p, i) => ({ ref: p, id: p.id, name: p.name, nick: p.nick, pos: p.pos, num: 12 + i, ...this.effective(p, p.pos) }));
    return { name: CLUB.name, short: CLUB.short, color: CLUB.color, color2: CLUB.color2, players, bench, formation: this.formation, style: this.style, tempo: this.tempo, ai: null, me: true, captain: this.captain, penTaker: this.penTaker, cornerTaker: this.cornerTaker, fkTaker: this.fkTaker, cornerVar: this.cornerVar || 'mix', instr: 'normal' };
  }
  opponentForMatch() {
    const o = this.opponent, r = rng(o.seed * 7 + this.diffKey.length), ev = this.pendingEvent?.event;
    const base = (o.strength + (this.oppMod || 0) + (this.league === 'cloud' ? 9 : 0) + ((this.seasonNo || 1) - 1) * 2) * this.diff.opp * (1 + (ev === 'shadow_it' ? 0.08 : 0));
    const fk = o.style === 'wall' ? '5-3-2' : o.style === 'boss' || o.style === 'longshot' ? '4-3-3' : '4-4-2', F = FORMATIONS[fk];
    const players = F.slots.map(([pos, x, y], i) => {
      const k = (0.55 + base / 140) * 0.975, p = { id: 'o' + i, name: o.names[i] || `${o.short} ${i + 1}`, pos, slot: F.slots[i], num: i + 1 };
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
    const bench = ['ZM', 'ST', 'IV'].map((pos, i) => { const k = 0.55 + base / 140, p = { id: 'ob' + i, name: o.names[11 + i] || `${o.short} ${12 + i}`, pos, num: 12 + i }; const prof = { IV: [55, 55, 88, 30, 75], ZM: [70, 82, 55, 60, 75], ST: [78, 68, 25, 88, 70] }[pos]; ATTRS.forEach((a, j) => p[a] = clamp(prof[j] * k * 0.95 * (0.92 + r() * 0.16), 20, 99)); return p; });
    return { name: o.club, short: o.short, color: o.color, color2: o.color2, players, bench, formation: fk, style: o.style === 'press' || ev === 'wave_now' ? 'agile' : o.style === 'wall' ? 'clean' : 'agile', tempo: o.style === 'wall' || o.style === 'silo' ? 'slow' : 'normal', ai: o.style, press: ev === 'wave_now' ? 1 : null, me: false };
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
      if (res.played?.includes(p.id)) { p.apps++; p.fitness = clamp(p.fitness - (res.minutes?.[p.id] ?? 90) * 0.34, 0, 100); p.form = clamp(p.form + (won ? 1 : draw ? 0 : -1), -3, 3); p.morale = clamp(p.morale + (won ? 6 : draw ? 1 : -6) + (res.played.includes(this.captain) && !won ? 2 : 0), 0, 100); }
      else p.morale = clamp(p.morale - 2, 0, 100);
      if (res.yellows?.includes(p.id)) { p.yellows++; if (p.yellows % 2 === 0) { p.suspended = 1; this.msg('hub', `${p.name} hat die zweite gelbe Karte – ein Spiel Sperre.`); } }
      if (res.reds?.includes(p.id)) { p.suspended = 1; this.msg('hub', `${p.name} sieht Rot und fehlt im nächsten Spiel.`); }
      if (res.injuries?.includes(p.id)) { p.injured = 1 + Math.floor(this.r() * 2 * this.diff.inj); this.msg('hub', `${p.name} ist verletzt – ${p.injured === 1 ? 'ein Spiel' : p.injured + ' Spiele'} Pause.`); }
      p.goals += (res.scorers || []).filter(id => id === p.id).length; p.assists += (res.assists || []).filter(id => id === p.id).length;
    }
    // Wirtschaft: Zuschauer, TV, Fanshop, Logen, Sponsor – minus Gehälter und Unterhalt
    const fin = this.settle(won, draw, gf), income = fin.net;
    this.coh[this.formation] = clamp((this.coh[this.formation] || 40) + 5, 0, 100); this.cohStyle[this.style] = clamp((this.cohStyle[this.style] || 40) + 3, 0, 100);
    if (won && this.sponsorPerWin) this.msg('hub', 'Data Lake GmbH zahlt den Siegbonus: +150 T€.');
    const obj = this.checkObjective(res, gf, ga);
    if (obj) { this.stats.bonus += obj.bonus; if (obj.ok) this.stats.objectives++; this.msg('hub', obj.ok ? `Wochenziel erreicht: ${obj.name} (+${obj.bonus} Punkte).` : `Wochenziel verfehlt: ${obj.name}.`); }
    const pts = (won ? SEASON_SCORE.win : draw ? SEASON_SCORE.draw : 0) + gf * SEASON_SCORE.goal + (ga === 0 ? SEASON_SCORE.cleanSheet : 0) + (obj ? obj.bonus : 0);
    // Entwicklung: junge Spieler:innen mit guter Note lernen dazu
    const dev = [];
    for (const p of this.players) { const rt = res.ratings?.[p.id]; if (rt !== undefined && rt >= 7 && p.age < 27 && this.r() < 0.25 + (p.pot || 3) * 0.12) { const a = ATTRS[Math.floor(this.r() * ATTRS.length)]; p[a] = clamp(p[a] + 1 + (p.pot >= 5 ? 1 : 0), 1, 99); p.value = Math.round(p.value * 1.04 / 10) * 10; dev.push(p.name); this.stats.developed++; } }
    if (dev.length) this.msg('hub', `Entwicklung: ${dev.join(', ')} ${dev.length > 1 ? 'haben' : 'hat'} im Spiel dazugelernt.`);
    this.results.push({ day: this.day, opp: o.id, club: o.club, home: this.home, gf, ga, won, draw, pts, income, att: fin.att, cap: fin.cap, event: this.pendingEvent?.event || null, objective: obj });
    this.simulateOthers();
    (this.rankHist ||= []).push(this.rank());
    this.msg(won ? 'hub' : 'legacy', won ? `${gf}:${ga} gegen ${o.club} – ${o.real}` : pick(this.r, TAUNTS.win));
    if (won) this.msg('legacy', pick(this.r, TAUNTS.lose));
    this.hooks.onEvent?.({ type: 'result', won, draw, gf, ga, income, pts });
    this.day++;
    const ret = { won, draw, gf, ga, income, pts, objective: obj, fin };
    if (this.day >= this.len) { this.over = true; this.finish(); } else this.prepareWeek();
    return ret;
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
    const base = Math.round(this.results.reduce((s, r) => s + r.pts, 0) * 7 / this.len); // auf 7 Spieltage normiert
    const rk = this.rank(), place = rk === 1 ? SEASON_SCORE.title : rk === 2 ? SEASON_SCORE.second : rk === 3 ? SEASON_SCORE.third : 0;
    const assets = Math.round(this.econ.invested * 0.5); // Stadion und Einrichtungen zählen zur Hälfte als Vereinsvermögen
    const eco = Math.round(Math.max(0, (this.budget + assets) * 7 / this.len) * SEASON_SCORE.budget + this.econ.fans * 8);
    const mult = this.diff.mult;
    return { score: Math.round((base + place + eco) * mult), breakdown: { base, place, eco, mult, rank: rk, fans: Math.round(this.econ.fans), len: this.len } };
  }
  finish() {
    const sc = this.computeScore(); const rk = sc.breakdown.rank;
    this.result = { won: rk === 1, rank: rk, ...sc, duration: this.results.length, len: this.len, reason: rk === 1 ? 'Meister der Legacy League – der Monolith ist gestürzt!' : rk <= 3 ? `Platz ${rk} – stark, aber die Legacy-IT bleibt vorn.` : `Platz ${rk} – die Legacy-IT hat diese Saison gewonnen.` };
    this.hooks.onEnd?.(this.result);
  }
}
