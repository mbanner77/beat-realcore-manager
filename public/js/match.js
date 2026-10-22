// Spielsimulation: Positionsspiel auf 105 × 68 m, Pässe, Schüsse, Zweikämpfe, Karten, Verletzungen, Kommentar
import { STYLES, TEMPO, WEATHER, INSTR } from './data.js';
const INSTR_NAMES = Object.fromEntries(Object.entries(INSTR).map(([k, v]) => [k, v.name]));
import { rng } from './manager.js';

export const PW = 105, PH = 68, GOAL_W = 7.32;
export const MATCH_REAL = 180;            // Sekunden Realzeit für 90 Minuten (bei Tempo 1×)
const MIN_PER_SEC = 90 / MATCH_REAL;      // Spielminuten pro Simulationssekunde
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Kommentar-Vorlagen mit SAP-Humor; {p} Spieler, {t} Team, {o} Gegner, {k} Torwart
export const COMMENT = {
  kickoff: ['Anpfiff in der {s}! {t} stößt an.', 'Es geht los – Inbetriebnahme für 90 Minuten.'],
  half: ['Halbzeit. Zeit für eine Schnellkorrektur in der Kabine.', 'Pause. Der Änderungsbeirat tagt in der Kabine.'],
  full: ['Abpfiff! Das Spiel ist ausgerollt.', 'Schluss! Der Stapellauf ist durch.'],
  goal: ['TOR! {p} integriert den Ball sauber ins Netz!', 'TOOOR für {t}! {p} – Schnittstelle sauber, Ball drin.', 'Inbetriebnahme! {p} trifft, {k} ohne Chance.', 'TOR! {p} schließt ab wie eine erfolgreiche Systemumstellung.'],
  goal_opp: ['Tor für {t}. {p} trifft – das riecht nach Altlast.', 'Gegentor durch {p}. Der Absturz sitzt.', 'Tor für {t}: {p} nutzt eine Lücke, die nicht im Pflichtenheft stand.'],
  save: ['{k} hält! Da kommt nichts durch.', 'Starke Parade von {k} – Zugriff verweigert.', '{p} zieht ab, {k} ist da. Anfrage abgelehnt.'],
  wide: ['{p} schießt – vorbei. Das ging ins Archiv.', 'Knapp daneben, {p}! Vorgang geschlossen ohne Lösung.', '{p} aus der Distanz – über das Tor, wie ein Fax ins Nirgendwo.'],
  post: ['PFOSTEN! {p} scheitert am Aluminium – Zeitüberschreitung an der Schnittstelle.', 'Latte! {p} hat den Treffer im Testsystem, aber nicht im Produktivsystem.'],
  block: ['Geblockt! Die Abwehr von {t2} steht wie ein sauberer Systemkern.', '{p} zieht ab, aber der Schuss wird geblockt – Berechtigung fehlt.'],
  yellow: ['Gelbe Karte für {p}. Der Schiedsrichter eröffnet einen Vorgang.', 'Gelb für {p} – ungenehmigte Änderung am Gegenspieler.'],
  red: ['ROT für {p}! Der Zugriff wird komplett entzogen.', 'Platzverweis {p} – Prozess beendet.'],
  injury: ['{p} bleibt liegen. Der Basis-Administrator rennt aufs Feld.', '{p} hat sich verletzt – zu viele Änderungsanträge auf einmal.'],
  sub: ['Wechsel bei {t}: {p} kommt für {p2}. Schnellkorrektur eingespielt.', 'Einwechslung: {p} ersetzt {p2} – Aktualisierung ohne Ausfallzeit.'],
  chance: ['{p} kommt frei zum Abschluss …', 'Großchance für {t}!'],
  press: ['{t} presst wie am ersten Tag nach der Inbetriebnahme.'],
  koloss: ['Der Koloss setzt sich in Bewegung. Das Stadion wackelt.', 'Großrechner-Koloss mit dem Ball – langsam, aber unaufhaltsam.'],
  tackle: ['{p} grätscht dazwischen – Zugriff entzogen.'],
  penalty: ['ELFMETER für {t}! {p} legt sich den Ball zurecht.', 'Strafstoß! Änderungsantrag mit höchster Dringlichkeit – {p} tritt an.'],
  pen_goal: ['{p} verwandelt den Elfmeter – eiskalt wie eine Umstellung um Mitternacht.', 'TOR! {p} schiebt den Strafstoß ein. {k} war in der falschen Ecke.'],
  pen_save: ['{k} HÄLT DEN ELFMETER! Zugriff verweigert, Vorgang geschlossen.', 'Gehalten! {k} ahnt die Ecke von {p}.'],
  corner: ['Ecke für {t}. {p} läuft an.', 'Eckball für {t} – {p} bringt ihn herein.'],
  freekick: ['Freistoß für {t} in gefährlicher Position. {p} legt sich den Ball zurecht.', 'Freistoß! {p} gegen die Mauer von {t2}.'],
  fk_wall: ['{p} schießt – in die Mauer. Die Firewall von {t2} hält.', 'Freistoß von {p}, aber die Mauer steht wie ein Systemkern.'],
  cross: ['{p} flankt in den Strafraum …', 'Flanke von {p} – wer geht hin?'],
  header: ['Kopfball {p}!', '{p} steigt hoch und köpft!'],
  clear: ['{p} klärt per Kopf – Gefahr gebannt.', 'Geklärt! {p} ist zuerst am Ball.'],
  claim: ['{k} pflückt die Flanke herunter.', '{k} kommt raus und fängt die Flanke sicher.'],
  shootout: ['Elfmeterschießen! Die Nerven liegen blank.'],
  so_kick: ['{p} legt sich den Ball zurecht.'],
  so_goal: ['{p} trifft!', 'Drin! {p} bleibt eiskalt.'],
  so_miss: ['{p} vergibt!', 'Gehalten – {p} scheitert.'],
  so_end: ['Das Elfmeterschießen ist entschieden – {t} gewinnt!'],
  throwin: ['Einwurf für {t}.'],
  offside: ['Abseits! {p} stand zu weit vorn – die Fahne ist oben.', 'Die Fahne geht hoch: {p} im Abseits. Zugriff außerhalb des Berechtigungsrahmens.'],
  onetwo: ['Doppelpass! {p} und {p2} spielen sich frei.'],
  instr: ['{t} stellt um: {p}.'],
  deflect: ['{p} zieht ab – abgefälscht, Ecke!', 'Der Schuss von {p} wird abgefälscht und geht ins Toraus. Ecke.'],
  parry: ['{k} lenkt den Ball zur Ecke!', 'Glanzparade – {k} dreht den Ball um den Pfosten.'],
  pen_miss: ['{p} setzt den Elfmeter neben das Tor. Das ging an die falsche Adresse.', 'Vorbei! {p} verzieht vom Punkt – Aussetzer im Kopf.'],
};

export class Match {
  constructor(home, away, o = {}) {
    this.r = rng(o.seed || 1); this.hooks = o.hooks || {}; this.spect = !!o.spectacle; this.offside = o.offside !== false; this.offsides = [0, 0]; this.weather = o.weather || 'sun'; this.W = WEATHER[this.weather] || WEATHER.sun; this.t = 0; this.min = 0; this.speed = 1; this.paused = false; this.halfDone = false; this.over = false; this.stoppage = 0;
    this.score = [0, 0]; this.events = []; this.shots = [[0, 0], [0, 0]]; this.poss = [0, 0]; this.corners = [0, 0]; this.fouls = [0, 0]; this.xgSum = [0, 0]; this.sp = null; this.shotLog = []; this.mom = Array.from({ length: 100 }, () => [0, 0]); this.heat = [new Array(96).fill(0), new Array(96).fill(0)];
    this.teams = [home, away]; this.players = [];
    this.subsLeft = [3, 3]; this.subsDone = [];
    this.teams.forEach((T, ti) => { T.players.forEach(p => this.players.push(this.mkPlayer(p, ti))); T.benchP = (T.bench || []).map(p => ({ ...p })); });
    this.ball = { x: PW / 2, y: PH / 2, vx: 0, vy: 0, z: 0, owner: null, mode: 'loose', target: null, from: null, last: null };
    this.kickoff(0); this.freeze = 0; this.lastTouch = null; this.assist = null;
    if (o.walkout) this.startWalkout();
    this.log('kickoff', { team: 0 });
  }
  mkPlayer(p, ti) {
    const sl = p.slot || ['ZM', 0.5, 0.5];
    return { ...p, team: ti, x: 0, y: 0, vx: 0, vy: 0, energy: 1, yellow: 0, red: false, injured: false, out: false, minutes: 0, rating: 6, goals: 0, assists: 0, saves: 0, decideT: this.r() * 0.4, tackleT: 0, anchor: this.anchorOf(sl, ti), pos: sl[0] };
  }
  anchorOf(sl, ti) { const [, fx, fy] = sl; return ti === 0 ? { x: fx * PW, y: fy * PH } : { x: (1 - fx) * PW, y: (1 - fy) * PH }; }
  goalOf(ti) { return { x: ti === 0 ? PW : 0, y: PH / 2 }; }  // Tor, auf das Team ti schießt
  alive(ti) { return this.players.filter(p => p.team === ti && !p.out); }
  instr(ti) { return this.teams[ti].instr || 'normal'; }
  role(p) { return p.role || ''; }
  // Abseitslinie: vorletzter Verteidiger (inkl. Torwart) bzw. Mittellinie, gesehen vom angreifenden Team ti
  offLine(ti) { const dir = ti === 0 ? 1 : -1, us = this.alive(1 - ti).map(q => q.x * dir).sort((a, b) => b - a); const second = us.length > 1 ? us[1] : (us[0] ?? 0); return Math.max(second, PW / 2 * dir, this.ball.x * dir) * dir; }
  styleOf(ti) { const T = this.teams[ti]; return STYLES[T.style] || STYLES.clean; }
  tempoOf(ti) { const T = this.teams[ti]; return TEMPO[T.tempo] || TEMPO.normal; }
  keeper(ti) { return this.alive(ti).find(p => p.pos === 'TW') || this.alive(ti)[0]; }
  nearest(ti, pt, excl) { let b = null, bd = 1e9; for (const p of this.alive(ti)) { if (p === excl) continue; const d = dist(p, pt); if (d < bd) { bd = d; b = p; } } return [b, bd]; }
  log(type, d = {}) {
    const e = { type, min: Math.floor(this.min), ...d };
    e.text = this.comment(e); this.events.push(e); this.hooks.onEvent?.(e); return e;
  }
  comment(e) {
    const me = this.teams[0].me ? 0 : 1, T = e.team !== undefined ? this.teams[e.team] : null;
    let key = e.type; if (e.type === 'goal') key = e.pen ? 'pen_goal' : e.team === me ? 'goal' : 'goal_opp';
    const arr = COMMENT[key] || [e.type]; const tpl = arr[Math.floor(this.r() * arr.length)];
    const k = e.team !== undefined ? this.keeper(1 - e.team) : null;
    const vals = { p2: e.p2 ? e.p2.name : '', p: e.p ? e.p.name : '', t2: e.team !== undefined ? this.teams[1 - e.team].short : '', t: T ? T.short : '', k: k ? k.name : 'Torwart', s: 'Clean-Core-Arena' };
    e.tpl = tpl; e.vals = vals; // für den Sprecher (Teilstücke)
    return tpl.replace(/\{(p2|t2|p|t|k|s)\}/g, (_, n) => vals[n]);
  }
  // ---------- Spielstart / Standards ----------
  kickoff(ti) {
    for (const p of this.players) if (!p.out) { p.x = p.anchor.x; p.y = p.anchor.y; p.vx = p.vy = 0; }
    const st = this.alive(ti).filter(p => p.pos === 'ST').sort((a, b) => dist(a, { x: PW / 2, y: PH / 2 }) - dist(b, { x: PW / 2, y: PH / 2 }))[0] || this.alive(ti)[5];
    st.x = PW / 2 + (ti === 0 ? -1 : 1); st.y = PH / 2;
    // beide Teams in die eigene Hälfte, der Gegner zusätzlich außerhalb des Anstoßkreises
    for (const p of this.alive(0)) if (p !== st) p.x = Math.min(p.x, PW / 2 - 1.5);
    for (const p of this.alive(1)) if (p !== st) p.x = Math.max(p.x, PW / 2 + 1.5);
    for (const p of this.alive(1 - ti)) p.x = ti === 0 ? Math.max(p.x, PW / 2 + 9.15) : Math.min(p.x, PW / 2 - 9.15);
    this.give(st); this.freeze = 0.8;
  }
  give(p, keep) { const b = this.ball; if (this.lastTouch && this.lastTouch.team !== p.team) { p.wonAt = this.t; if (this.instr(p.team) === 'counter' && (p.x - PW / 2) * (p.team === 0 ? 1 : -1) < 0) { this.teams[p.team].cT = this.t + 4; for (const q of this.alive(p.team)) if (q.pos === 'ST' || q.pos === 'FL') { q.runStart = this.t; q.runUntil = this.t + 2.6; q.runSafe = true; } } } if (this.spOn && !keep) { this.spOn = false; for (const q of this.players) q.spT = null; } b.owner = p; b.mode = 'held'; b.vx = b.vy = 0; b.z = 0; b.x = p.x; b.y = p.y; this.lastTouch = p; p.decideT = 0.35 + this.r() * 0.3; }
  loose(x, y, vx, vy) { const b = this.ball; b.owner = null; b.mode = 'loose'; b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.z = 0; }
  // ---------- Hauptschleife ----------
  tick(dt) {
    if (this.paused || this.over) return;
    dt *= this.speed; const steps = Math.max(1, Math.ceil(dt / (1 / 40)));
    for (let i = 0; i < steps; i++) this.step(dt / steps);
  }
  step(dt) {
    if (this.shootout) return this.stepShootout(dt);
    this.t += dt * (this.sp && this.sp.kind === 'walkout' || (this.pen && this.pen.waiting) ? 0 : this.sp || this.pen ? 0.4 : 1); this.min = this.t * MIN_PER_SEC; // Unterbrechungen kosten kaum Spielzeit
    if (!this.halfDone && !this.pen && this.min >= 45 + this.stoppage) { this.halfDone = true; this.stoppage = 0; this.min = 45; this.t = 45 / MIN_PER_SEC; this.log('half'); this.paused = true; this.kickoff(1); this.hooks.onHalf?.(); return; }
    if (!this.pen && this.min >= 90 + this.stoppage) { this.over = true; this.log('full'); this.hooks.onFull?.(this.result()); return; }
    const b = this.ball;
    if (b.owner) { this.poss[b.owner.team] += dt; { const o = b.owner, hx = o.team === 0 ? o.x : PW - o.x, hy = o.team === 0 ? o.y : PH - o.y; this.heat[o.team][Math.max(0, Math.min(7, Math.floor(hy / PH * 8))) * 12 + Math.max(0, Math.min(11, Math.floor(hx / PW * 12)))] += dt; } const o = b.owner, g = this.goalOf(o.team); if (Math.abs(o.x - g.x) < 35) { const mi = Math.min(99, Math.floor(this.min)); this.mom[mi][o.team] += dt * (Math.abs(o.x - g.x) < 18 ? 2 : 1); } }
    for (const p of this.players) if (!p.out) p.minutes += dt * MIN_PER_SEC;
    if (this.pen) { const pn = this.pen;
      if (pn.waiting) { this.movePlayers(dt, true); return; }
      pn.t -= dt; if (pn.t <= 0.7 && pn.ask && !pn.asked) { pn.asked = true; pn.waiting = true; this.hooks.penaltyChoice?.({ shoot: !!this.teams[pn.ti].me, taker: pn.taker, keeper: this.keeper(1 - pn.ti), shootout: this.shootout }); return; }
      if (pn.t <= 0) this.takePenalty(); else this.movePlayers(dt, true); return; }
    if (this.sp) { const sp = this.sp; sp.t -= dt; if (sp.wait > 0) { sp.wait -= dt; if (sp.wait <= 0 && sp.kind === 'kickoff') { this.ball.x = PW / 2; this.ball.y = PH / 2; } } sp.el = (sp.el || 0) + dt;
      if (sp.waiting) { this.movePlayers(dt, true); return; }
      if (sp.kind === 'walkout') { const arrived = this.players.every(p => p.out || !p.spT || dist(p, p.spT) < 0.9); if (arrived || sp.el > (sp.stage ? 14 : 12)) { sp.hold += dt; if (sp.stage === 0 && sp.hold > 2.6) { sp.stage = 1; sp.hold = 0; sp.el = 0; const T = this.kickoffTargets(0); for (const [p, t] of T) p.spT = t; } else if (sp.stage === 1 && sp.hold > 0.6) { for (const p of this.players) p.spT = null; this.sp = null; this.kickoff(0); this.log('kickoff2', { team: 0 }); return; } } this.movePlayers(dt, true); return; }
      const ready = sp.taker && sp.taker.spT ? dist(sp.taker, sp.taker.spT) < 0.5 : true, all = sp.kind === 'kickoff' ? this.players.every(p => p.out || !p.spT || dist(p, p.spT) < 1.2) : true;
      const go = sp.t <= 0 || (sp.el > (sp.min || 0) && ready && all && sp.el > (sp.min || 0) + 0.5 * (sp.kind !== 'kickoff'));
      if (go && sp.ask && !sp.asked) { sp.asked = true; sp.waiting = true; this.hooks.fkChoice?.({ taker: sp.taker, wall: sp.wall.length, dist: Math.round(dist(this.ball, this.goalOf(sp.ti))) }); return; }
      if (go) this.takeSetPiece(); else this.movePlayers(dt, true); return; }
    if (this.freeze > 0) { this.freeze -= dt; this.movePlayers(dt, true); return; }
    this.movePlayers(dt, false);
    this.moveBall(dt);
    if (b.owner) this.decide(b.owner, dt);
    this.tackles(dt);
    this.aiSubs(); this.aiCoach();
  }
  spd(p) { const T = this.tempoOf(p.team); return ((this.teams[p.team].cT || 0) > this.t && p.pos !== 'TW' ? 1.1 : 1) * (this.instr(p.team) === 'waste' && this.ball.owner && this.ball.owner.team === p.team ? 0.88 : 1) * (5.2 + p.tempo / 100 * 6.5) * (0.6 + 0.4 * p.energy) * T.k * (p.injured ? 0.55 : 1) * this.W.spd; }
  // Zielpunkt eines Spielers ohne Ball
  targetOf(p) {
    const b = this.ball, ti = p.team, S = this.styleOf(ti), own = b.owner && b.owner.team === ti, dir = ti === 0 ? 1 : -1;
    const a = p.anchor;
    if (this.sp && this.sp.celeb && this.sp.wait > 0) { const c = this.sp.celeb; if (p === c.scorer) return c.flag; if (p.team === c.team && p.pos !== 'TW') { const k = (p.num || 1) % 6; return { x: c.scorer.x + Math.cos(k) * 1.6, y: c.scorer.y + Math.sin(k) * 1.6 }; } return { x: p.x, y: p.y }; }
    if (p.spT && (this.sp || this.pen || (b.mode === 'pass' && b.cross))) return p.spT;
    if (p.pos === 'TW') {
      // Torwart: auf der Linie zwischen Ball und Tormitte, je näher der Ball, desto weiter heraus (Winkel verkürzen); bei eigenem Angriff mitspielend weit vor dem Tor
      const gx = ti === 0 ? 0 : PW, gy = PH / 2, dx = b.x - gx, dy = b.y - gy, bd = Math.hypot(dx, dy) || 1;
      if (p.react && this.t < p.react.until) return p.react;
      if (own && Math.abs(b.x - gx) > PW * 0.45) return { x: gx + dir * clamp(Math.abs(b.x - gx) * 0.22, 6, 16), y: gy + (b.y - gy) * 0.15 };
      const out = bd > 40 ? 6 : clamp(1.3 + (32 - bd) * 0.11, 1.3, 4.8) + (bd < 12 && !own ? Math.min(3.5, (12 - bd) * 0.45) : 0);
      return { x: gx + dx / bd * out, y: clamp(gy + dy / bd * out, gy - 5, gy + 5) };
    }
    const ins = this.instr(ti), hp = this.teams[ti].press === 1 || ins === 'highpress', rl = this.role(p);
    const line = (own ? (ins === 'waste' ? 3 : 8) : -5 + (hp ? 6 : 0) - (ins === 'counter' ? 3 : 0)) * dir + S.line * PW * dir;
    const compact = own ? 0.28 : 0.3 + (1 - S.press) * 0.26;
    let tx = a.x + (b.x - PW / 2) * 0.42 + line, ty = a.y + (b.y - PH / 2) * compact;
    if (own) { // Anspielstationen: Laufwege nach vorn, Flügel breit
      if (p.pos === 'ST' || p.pos === 'FL') tx += dir * 6;
      if (p.pos === 'FL') { ty += (a.y < PH / 2 ? -3 : 3); if ((b.x - PW / 2) * dir > 5) tx += dir * 7; } // Flügel hinterlaufen in der gegnerischen Hälfte
      if (p.pos === 'FL' && rl === 'inside') ty = PH / 2 + (ty - PH / 2) * 0.62; else if (p.pos === 'FL' && (rl === 'winger' || ins === 'wings')) ty = PH / 2 + (ty - PH / 2) * 1.18;
      if (p.pos === 'AV' && rl !== 'fullback' && (rl === 'wingback' || ins === 'wings') && (b.x - PW / 2) * dir > 0) { tx += dir * 13; ty = PH / 2 + (a.y - PH / 2) * 1.05; } // Hinterlaufen
      if (p.pos === 'ST' && (rl === 'poacher' || ins === 'counter')) tx += dir * 4;
      if (p.pos === 'FL' && (ins === 'wings' || rl === 'winger') && (b.x - PW / 2) * dir > -10) tx += dir * 6;
      if (ins === 'waste' && p.pos !== 'TW') tx -= dir * 5;
      // Abseits vermeiden: auf Höhe des vorletzten Verteidigers bleiben (Konterstürmer reizt die Linie aus)
      if (this.offside && p.pos !== 'TW') { const ol = this.offLine(ti), m = rl === 'poacher' ? 0.15 : 0.6;
        // Steilläufe der Stürmer hinter die Abwehr (zu früh gestartet = Abseits)
        if ((p.pos === 'ST' || p.pos === 'FL') && b.owner && b.owner !== p && (b.x - PW / 2) * dir > -15) { if (!p.runUntil || this.t > p.runUntil + 3) { if (this.r() < 0.0025 * (rl === 'poacher' || this.instr(ti) === 'counter' ? 2 : 1)) { p.runStart = this.t; p.runUntil = this.t + 1.8; p.runSafe = false; } } }
        if (p.runUntil && this.t < p.runUntil) tx = ol + dir * 5; else if ((tx - ol) * dir > -m) tx = ol - dir * m; }
    } else {
      // Pressing: die nächsten Spieler zum Ball
      // vor dem eigenen Tor verteidigt jedes Team aktiv – der Stil regelt vor allem das Pressing in der gegnerischen Hälfte
      const ownThird = ti === 0 ? b.x < PW * 0.4 : b.x > PW * 0.6;
      const pr = hp ? 1 : Math.max(S.press, ownThird ? 0.8 : 0) + (rl === 'destroyer' ? 0.15 : 0);
      const near = this.alive(ti).filter(q => q.pos !== 'TW').sort((q1, q2) => dist(q1, b) - dist(q2, b));
      const idx = near.indexOf(p);
      if (idx >= 0 && idx < (pr > 0.7 ? 2 : 1) && dist(p, b) < 7 + pr * 12) return { x: b.x, y: b.y, chase: true };
    }
    const ph = (p.num || 1) * 1.7 + p.team * 3.1; tx += Math.sin(this.t * 0.13 + ph) * 1.1; ty += Math.cos(this.t * 0.11 + ph * 1.3) * 1.2; // nicht wie auf Schienen
    return { x: clamp(tx, 1, PW - 1), y: clamp(ty, 1, PH - 1) };
  }
  movePlayers(dt, frozen) {
    const b = this.ball;
    // Reihenfolge je Schritt wechseln, sonst ist das später bewegte Team im Vorteil
    this.stepN = (this.stepN || 0) + 1; const order = this.stepN % 2 ? this.players : [...this.players].reverse();
    for (const p of order) {
      if (p.out) continue;
      let tg;
      if (b.owner === p || (this.sp && this.sp.taker === p)) {
        if (frozen || p.gkHold > 0) { if (p.gkHold > 0) { p.vx *= 0.8; p.vy *= 0.8; } continue; }
        const g = this.goalOf(p.team), dir = p.team === 0 ? 1 : -1;
        const [opp, od] = this.nearest(1 - p.team, p);
        let ty = p.y + (g.y - p.y) * 0.12, tx = p.x + dir * 10;
        if (opp && od < 5) { ty += (p.y - opp.y) > 0 ? 4 : -4; }  // dem Gegner ausweichen
        if ((p.pos === 'FL' && p.role !== 'inside' || p.pos === 'AV' && Math.abs(p.x - g.x) < 40) && Math.abs(p.y - PH / 2) > 9 && (!opp || od > 3)) ty = p.y + (p.y < PH / 2 ? -0.5 : 0.5); // Flügel bleibt außen
        else if (p.pos === 'FL' && p.role === 'inside' && Math.abs(p.x - g.x) < 34) ty = PH / 2 + (p.y - PH / 2) * 0.3;
        else if (Math.abs(p.x - g.x) < 22) ty = PH / 2 + (p.y - PH / 2) * 0.6;
        tg = { x: clamp(tx, 1, PW - 1), y: clamp(ty, 2, PH - 2) };
        this.moveTo(p, tg, this.spd(p) * 0.82, dt);
        b.x = p.x + dir * 0.6; b.y = p.y;
      } else if (b.mode === 'loose' && !frozen && this.chaser(p)) {
        this.moveTo(p, b, this.spd(p), dt);
      } else if (b.mode === 'pass' && !frozen && (b.target === p || (b.cross && b.target && p.team !== b.target.team && p.pos !== 'TW' && p === this.nearest(p.team, b.target)[0]))) {
        this.moveTo(p, this.predict(), this.spd(p), dt);
      } else this.moveTo(p, this.targetOf(p), this.spd(p) * (frozen && !this.sp && !this.pen ? 0.6 : this.sp ? (this.sp.kind === 'walkout' ? (this.sp.stage ? 0.75 : 0.42) : this.sp.kind === 'kickoff' ? (this.sp.wait > 0 ? (this.sp.celeb && p.team === this.sp.celeb.team ? (p === this.sp.celeb.scorer ? 0.9 : 0.85) : 0) : 0.85) : 1.05) : this.pen ? 0.8 : 0.9), dt);
      // Kondition
      const S = this.styleOf(p.team); p.energy = Math.max(0.3, p.energy - dt * (0.0014 + S.press * 0.0038 + (this.instr(p.team) === 'highpress' ? 0.0022 : 0)) * (1.5 - p.kondition / 100) * this.tempoOf(p.team).k * (this.hasCaptain(p.team) ? 0.94 : 1));
    }
    // Ballgewinn bei losem Ball
    if (b.mode === 'loose' && !frozen) {
      let best = null, bd = 1.4;
      for (const p of order) if (!p.out) { const d = dist(p, b); const rad = p.pos === 'TW' && this.inBox(b, p.team) ? 2.6 : 1.4; if (d < rad && d < bd) { bd = d; best = p; } }
      if (best) { if (this.lastTouch && this.lastTouch.team !== best.team) { best.rating += 0.06; if (b.from && b.from.team !== best.team) this.log('intercept', { team: best.team, p: best }); } this.give(best); }
    }
  }
  hasCaptain(ti) { const T = this.teams[ti]; if (!T.captain) return false; if (this._capT === undefined) this._capT = [null, null]; return this.alive(ti).some(p => p.id === T.captain); }
  chaser(p) { const b = this.ball; const [n] = this.nearest(p.team, b); const [n2] = this.nearest(p.team, b, n); return p === n || p === n2 || (p.pos === 'TW' && this.inBox(b, p.team)); }
  inBox(pt, ti) { return (ti === 0 ? pt.x < 16.5 : pt.x > PW - 16.5) && Math.abs(pt.y - PH / 2) < 20.16; } // Strafraum von Team ti (Verteidiger)
  // Bewegung mit Trägheit: Beschleunigen, Abbremsen vor dem Ziel, Richtungswechsel kosten Tempo; Mitspieler halten Abstand
  moveTo(p, tg, v, dt) {
    const dx = tg.x - p.x, dy = tg.y - p.y, d = Math.hypot(dx, dy), acc = (11 + (p.tempo || 60) / 100 * 6) * (p.injured ? 0.6 : 1), dec = 16;
    const chase = tg.chase || tg === this.ball; // dem Ball nachjagen: nicht abbremsen
    // weich ankommen: kurz vor dem Ziel proportional abbremsen (kein Überschießen und Zurückpendeln)
    const des = d < 0.06 ? 0 : Math.min(v, chase ? v : Math.sqrt(2 * dec * 0.8 * Math.max(0, d - 0.05)), chase ? d / Math.max(dt, 1e-3) : d * 2.2);
    let wx = d > 1e-6 ? dx / d * des : 0, wy = d > 1e-6 ? dy / d * des : 0;
    if (this.ball.owner !== p && d > 1.2 && !(this.sp && (this.sp.kind === 'walkout' || this.sp.kind === 'kickoff'))) for (const q of this.players) { if (q === p || q.out || q.team !== p.team) continue; const ox = p.x - q.x, oy = p.y - q.y, od = Math.hypot(ox, oy); if (od < 1.3 && od > 1e-4) { const k = (1.3 - od) * 2; wx += ox / od * k; wy += oy / od * k; } }
    const ax = wx - p.vx, ay = wy - p.vy, a = Math.hypot(ax, ay), cur = Math.hypot(p.vx, p.vy), lim = (Math.hypot(wx, wy) > cur ? acc : dec) * dt;
    if (a > lim) { p.vx += ax / a * lim; p.vy += ay / a * lim; } else { p.vx = wx; p.vy = wy; }
    p.x = clamp(p.x + p.vx * dt, -3, PW + 3); p.y = clamp(p.y + p.vy * dt, -3, PH + 3);
  }
  predict() { const b = this.ball; return { x: b.x + b.vx * 0.25, y: b.y + b.vy * 0.25 }; }
  moveBall(dt) {
    const b = this.ball;
    if (b.mode === 'held') return;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.mode === 'loose') { const f = Math.exp(-dt * 1.1); b.vx *= f; b.vy *= f; }
    if (b.mode === 'pass') {
      const tg = b.target; if (!tg || tg.out) { b.mode = 'loose'; return; }
      // Abfangen
      for (const q of this.alive(1 - tg.team)) { if (dist(q, b) < 1.25 && this.r() < 0.06 + q.abwehr / 100 * 0.5) { q.rating += 0.08; this.log('intercept', { team: q.team, p: q }); this.give(q); return; } }
      const d = dist(tg, b);
      if (b.cross && d < 1.8) { this.headerDuel(tg); return; }
      if (d < 1.5) { if (this.r() < 0.04 + (100 - tg.technik) / 100 * 0.14) { this.loose(b.x, b.y, b.vx * 0.3, b.vy * 0.3 + (this.r() - 0.5) * 4); b.last = tg; } else { if (b.from) { b.from.rating += 0.03; this.assist = b.from; } this.give(tg); } return; }
      { const f = Math.exp(-dt * 0.18); b.vx *= f; b.vy *= f; }
      if (Math.hypot(b.vx, b.vy) < 2 || b.x < -0.5 || b.x > PW + 0.5 || b.y < -0.5 || b.y > PH + 0.5) { b.mode = 'loose'; b.cross = false; b.throwIn = false; }
    }
    if (b.mode === 'shot') {
      const g = this.goalOf(b.shooter.team), arrived = b.shooter.team === 0 ? b.x >= PW : b.x <= 0;
      if (b.outcome === 'block' && dist(b, b.blocker) < 1.2) { this.log(b.wall ? 'fk_wall' : 'block', { team: b.shooter.team, p: b.shooter }); if (this.r() < 0.3) { this.assist = null; this.startCorner(b.shooter.team, b.y < PH / 2 ? 0 : 1); return; } this.loose(b.x, b.y, -b.vx * 0.15 + (this.r() - 0.5) * 6, (this.r() - 0.5) * 8); b.last = b.blocker; return; }
      if (arrived) {
        const ti = b.shooter.team, k = this.keeper(1 - ti);
        const pen = b.penalty; b.penalty = false;
        if (pen && this.shootout) { this.shootoutResult(ti, b.outcome === 'goal', b.shooter, k); return; }
        if (b.outcome === 'goal') { this.score[ti]++; b.shooter.goals++; b.shooter.rating += pen ? 0.5 : 0.8; if (this.assist && this.assist !== b.shooter && this.assist.team === ti) { this.assist.assists++; this.assist.rating += 0.5; } for (const d of this.alive(1 - ti)) if (d.pos !== 'ST') d.rating -= 0.08; this.log('goal', { team: ti, p: b.shooter, p2: this.assist && this.assist !== b.shooter ? this.assist : null, score: [...this.score], pen }); this.hooks.onGoal?.(ti); this.startRestart('kickoff', 1 - ti, { scorer: b.shooter, team: ti }); this.stoppage += 0.5; }
        else if (b.outcome === 'save') { k.saves++; k.rating += pen ? 0.8 : 0.22; this.log(pen ? 'pen_save' : 'save', { team: ti, p: b.shooter }); k.react = null;
          if (!pen && this.r() < 0.32) { this.log('parry', { team: ti, p: b.shooter }); this.startCorner(ti, b.y < PH / 2 ? 0 : 1); } else { this.give(k); k.gkHold = 1.6 + this.r() * 1.2; this.freeze = 0.5; } }
        else if (b.outcome === 'post') { this.log('post', { team: ti, p: b.shooter }); this.loose(g.x - (ti === 0 ? 2 : -2), g.y + (this.r() - 0.5) * 10, (ti === 0 ? -1 : 1) * 9, (this.r() - 0.5) * 8); }
        else if (!pen && !b.header && this.r() < 0.2) { this.log('deflect', { team: ti, p: b.shooter }); this.startCorner(ti, b.y < PH / 2 ? 0 : 1); }
        else { this.log(pen ? 'pen_miss' : 'wide', { team: ti, p: b.shooter }); if (pen) b.shooter.rating -= 0.5; this.startRestart('goalkick', 1 - ti); }
        this.assist = null;
      }
      return;
    }
    // Seitenaus / Toraus
    if (b.mode === 'loose') {
      if (b.y < 0 || b.y > PH) { const lt = b.last || this.lastTouch; const ti = lt ? 1 - lt.team : 0; this.startRestart('throw', ti, { x: clamp(b.x, 1, PW - 1), y: b.y < 0 ? 0 : PH }); }
      else if (b.x < 0 || b.x > PW) { const side = b.x < 0 ? 0 : 1; const lt = b.last || this.lastTouch; const defending = side === 0 ? 0 : 1; // Team 0 verteidigt x=0
        if (lt && lt.team !== defending) this.startRestart('goalkick', defending);
        else this.startCorner(1 - defending, b.y < PH / 2 ? 0 : 1); }
    }
  }
  // ---------- Entscheidungen am Ball ----------
  decide(p, dt) {
    if (p.pos === 'TW' && p.gkHold > 0) { p.gkHold -= dt; p.vx = p.vy = 0; if (p.gkHold > 0) return;
      const dir = p.team === 0 ? 1 : -1, mates = this.alive(p.team).filter(q => q !== p), free = (q) => { const [, od] = this.nearest(1 - p.team, q); return od; };
      const shortT = mates.filter(q => (q.pos === 'IV' || q.pos === 'AV' || q.pos === 'DM') && free(q) > 6 && dist(p, q) < 34).sort((a, b) => free(b) - free(a))[0];
      const longT = mates.filter(q => (q.x - p.x) * dir > 30).sort((a, b) => free(b) - free(a))[0];
      const q = shortT && this.r() < 0.62 ? shortT : longT || shortT; if (q) { this.pass(p, q); if (this.ball.mode === 'pass') this.ball.gkOut = dist(p, q) < 34 ? 'throw' : 'kick'; } return; }
    p.decideT -= dt; if (p.decideT > 0) return;
    p.decideT = 0.35 + this.r() * 0.35;
    const T = this.teams[p.team], S = this.styleOf(p.team), ai = T.ai, g = this.goalOf(p.team), dir = p.team === 0 ? 1 : -1;
    const d = dist(p, g), [opp, od] = this.nearest(1 - p.team, p), pressured = opp && od < 2.8;
    // Schuss?
    const xg = this.xg(p, d);
    const ins = this.instr(p.team), rl = this.role(p), waste = ins === 'waste';
    const shootRange = (ai === 'longshot' ? 38 : ai === 'swarm' ? 30 : 27) + (this.spect ? 5 : 0) + (rl === 'inside' ? 4 : 0);
    const thr = waste ? 0.2 : ai === 'swarm' ? 0.05 : rl === 'inside' ? 0.065 : this.spect ? 0.07 : 0.09;
    const want = (xg > thr || (pressured && xg > 0.05 && !waste)) && d < shootRange && Math.abs(p.y - PH / 2) < 24;
    if (want && this.r() < 0.5 + S.risk * 0.15 + (p.koloss ? 0.3 : 0)) { this.shoot(p, xg); return; }
    // Doppelpass: der Mitspieler, der gerade abgespielt hat, ist vorn frei
    const rt = p.retTo; p.retTo = null;
    if (rt && !rt.p.out && this.t - rt.t < 2.6 && (rt.p.x - p.x) * dir > 3 && !waste) { const [, rd] = this.nearest(1 - p.team, rt.p); if (rd > 3 && !this.laneBlocked(p, rt.p) && this.r() < 0.5) { this.log('onetwo', { team: p.team, p: rt.p, p2: p }); this.pass(p, rt.p); return; } }
    // Flanke von außen in den Strafraum?
    const crossK = (p.pos === 'FL' ? (rl === 'inside' ? 0.12 : 0.42) : p.pos === 'AV' ? 0.3 : 0.14) + S.risk * 0.12 + (ins === 'wings' ? 0.15 : 0) + (rl === 'winger' || rl === 'wingback' ? 0.15 : 0) - (waste ? 0.2 : 0);
    if (Math.abs(p.x - g.x) < 36 && Math.abs(p.x - g.x) > 9 && Math.abs(p.y - PH / 2) > (p.pos === 'FL' ? 9 : 8) && this.r() < crossK) { const tg = this.crossTarget(p.team, p); if (tg) { this.cross(p, tg); return; } }
    const fresh = p.wonAt !== undefined && this.t - p.wonAt < 2.5; // Ballgewinn gerade eben (Konter)
    // Pass?
    const mates = this.alive(p.team).filter(q => q !== p);
    let best = null, bv = -1e9;
    for (const q of mates) {
      const gain = (q.x - p.x) * dir, dq = dist(p, q); if (dq < 4 || dq > 45) continue;
      const [oq, oqd] = this.nearest(1 - p.team, q); const open = Math.min(10, oqd || 10);
      const lane = this.laneBlocked(p, q) ? -6 : 0;
      const gw = (0.5 + S.risk * 0.5) * (ins === 'counter' && fresh ? 2 : 1) * (rl === 'playmaker' ? 1.3 : 1) * (waste ? 0.25 : 1);
      let v = gain * gw + open * (waste ? 1.6 : 0.9) + lane * (waste ? 2 : 1) - (q.pos === 'TW' ? (waste ? 4 : 12) : 0) + this.r() * 6 + (q.pos === 'FL' && Math.abs(q.x - g.x) < 45 ? (ins === 'wings' ? 12 : 6) : 0) + (q.pos === 'AV' && ins === 'wings' && (q.x - PW / 2) * dir > 0 ? 6 : 0) + (q.pos === 'ST' && ins === 'counter' && fresh ? 8 : 0) + (q.role === 'target' && gain > 8 ? 3 : 0) + (q.runUntil && this.t < q.runUntil && !waste ? 7 + (rl === 'playmaker' ? 4 : 0) : 0);
      if (ai === 'chaos') v = this.r() * 20 + lane; if (ai === 'boss' && q.koloss) v += 8; if (ai === 'silo') v -= 10;
      if (v > bv) { bv = v; best = q; }
    }
    const passWill = ai === 'silo' ? 0.38 : ai === 'chaos' ? 0.95 : 0.55 + (pressured ? 0.3 : 0) + (p.pos === 'TW' ? 0.5 : 0) + (p.koloss ? -0.3 : 0) + (waste ? 0.3 : 0) + (ins === 'counter' && fresh ? 0.3 : 0) - ((p.pos === 'FL' || p.pos === 'AV') && (ins === 'wings' || rl === 'winger' || rl === 'wingback') && (p.x - PW / 2) * dir > 0 && Math.abs(p.x - g.x) > 14 && !pressured ? 0.35 : 0);
    if (best && (this.r() < passWill || bv > 14)) this.pass(p, best);
    // sonst: dribbeln
  }
  laneBlocked(a, b) { const d = dist(a, b); for (const q of this.alive(1 - a.team)) { const t = ((q.x - a.x) * (b.x - a.x) + (q.y - a.y) * (b.y - a.y)) / (d * d); if (t <= 0.08 || t >= 0.92) continue; const px = a.x + (b.x - a.x) * t, py = a.y + (b.y - a.y) * t; if (Math.hypot(q.x - px, q.y - py) < 1.3) return true; } return false; }
  pass(p, q) {
    const b = this.ball, d = dist(p, q), tgt = { x: q.x + q.vx * 0.3, y: q.y + q.vy * 0.3 };
    const dir = p.team === 0 ? 1 : -1;
    b.throwIn = false; b.gkOut = null;
    if (this.offside && !this.noOff && q.pos !== 'TW' && (q.x - p.x) * dir > 0) { const ol = this.offLine(p.team); const running = q.runUntil && this.t < q.runUntil, mist = running && !q.runSafe && this.r() < 0.3 - (p.technik - 60) / 250 - (this.role(q) === 'poacher' ? 0.06 : 0); if ((((q.x - ol) * dir > 0.3 && !running) || mist) && this.r() < 0.92) { this.offsides[p.team]++; this.log('offside', { team: q.team, p: q }); const [n] = this.nearest(1 - p.team, q); if (n) { this.give(n); n.x = clamp(q.x, 1, PW - 1); n.y = q.y; } this.freeze = 0.8; return; } }
    q.retTo = { p, t: this.t };
    const err = (1 - p.technik / 100) * 3.5 * (this.r() - 0.5) * this.W.err * (d > 22 ? this.W.long : 1) * (this.role(p) === 'playmaker' ? 0.7 : 1); tgt.y += err; tgt.x += err * 0.5;
    const sp = clamp(12 + d * 0.5, 13, 30), dd = dist(p, tgt) || 1;
    b.owner = null; b.mode = 'pass'; b.target = q; b.from = p; b.vx = (tgt.x - p.x) / dd * sp; b.vy = (tgt.y - p.y) / dd * sp; b.x = p.x; b.y = p.y; this.lastTouch = p; b.last = p; p.rating += 0.015;
  }
  xg(p, d) {
    const g = this.goalOf(p.team), ang = Math.max(0.15, 1 - Math.abs(p.y - g.y) / 34);
    const k = this.keeper(1 - p.team);
    let v = 1.2 * Math.exp(-d / 13) * ang * (0.55 + 0.65 * p.schuss / 100) * (1.2 - 0.45 * k.abwehr / 100);
    let crowd = 0; for (const q of this.alive(1 - p.team)) if (q.pos !== 'TW' && dist(q, p) < 6) crowd++;
    v *= 1 - 0.1 * Math.min(3, crowd);
    if (p.koloss) v *= 1.2;
    v *= 1.15; if (this.spect) v *= 1.3; { const kd = Math.hypot(k.x - p.x, k.y - p.y); if (kd < 6) v *= 0.82 + kd * 0.03; } if (k.role === 'line') v *= 0.95;
    v *= this.W.xg * (d > 22 && this.weather === 'wind' ? 0.85 : 1);
    return clamp(v, 0.015, 0.7);
  }
  shoot(p, xg, o = {}) {
    const b = this.ball, g = this.goalOf(p.team), ti = p.team, r = this.r();
    this.shots[ti][0]++; this.xgSum[ti] += xg; this.lastTouch = p; b.last = p; p.rating += 0.08;
    // Block durch Verteidiger in der Schusslinie
    let blocker = null; if (o.wall) { const w = o.wall.filter(q => !q.out); if (w.length && this.r() < (o.wallP ?? 0.26)) blocker = w[Math.floor(this.r() * w.length)]; } else if (!o.header) for (const q of this.alive(1 - ti)) { if (q.pos === 'TW') continue; const t = ((q.x - p.x) * (g.x - p.x) + (q.y - p.y) * (g.y - p.y)) / (dist(p, g) ** 2); if (t > 0.05 && t < 0.9) { const px = p.x + (g.x - p.x) * t, py = p.y + (g.y - p.y) * t; if (Math.hypot(q.x - px, q.y - py) < 1.1 && this.r() < 0.55 + q.abwehr / 300) { blocker = q; break; } } }
    let outcome, ty;
    if (blocker) { outcome = 'block'; ty = g.y; }
    else if (r < xg) { outcome = 'goal'; ty = g.y + (this.r() - 0.5) * (GOAL_W - 1.2); this.shots[ti][1]++; }
    else if (r < xg + 0.03) { outcome = 'post'; ty = g.y + (this.r() < 0.5 ? -1 : 1) * GOAL_W / 2; }
    else if (r < xg + 0.05 + (xg > 0.1 ? 0.3 : 0.18)) { outcome = 'save'; ty = g.y + (this.r() - 0.5) * (GOAL_W - 1); this.shots[ti][1]++; }
    else { outcome = 'wide'; ty = g.y + (this.r() < 0.5 ? -1 : 1) * (GOAL_W / 2 + 1 + this.r() * 5); }
    this.shotLog.push({ min: Math.floor(this.min), team: ti, x: p.x, y: p.y, xg: Math.round(xg * 100) / 100, out: outcome, head: !!o.header, fk: !!o.fk, name: p.name }); { const mi = Math.min(99, Math.floor(this.min)); this.mom[mi][ti] += 3 + xg * 10; }
    const sp = 24 + p.schuss / 100 * 12, dd = Math.hypot(g.x - p.x, ty - p.y) || 1;
    { const k = this.keeper(1 - ti); if (k) { const kx = k.x, t = (kx - p.x) / ((g.x - p.x) || 1e-3), ly = p.y + (ty - p.y) * clamp(t, 0, 1); k.react = { x: kx, y: clamp(ly, PH / 2 - 4, PH / 2 + 4), until: this.t + 0.9, chase: true }; } }
    b.owner = null; b.mode = 'shot'; b.shooter = p; b.outcome = outcome; b.blocker = blocker; b.wall = !!o.wall; b.header = !!o.header; b.freekick = !!o.fk; b.cross = false; b.vx = (g.x - p.x) / dd * sp; b.vy = (ty - p.y) / dd * sp; b.x = p.x; b.y = p.y;
    if (xg > 0.2 && !o.header) this.log('chance', { team: ti, p });
    if (p.koloss && this.r() < 0.3) this.log('koloss', { team: ti, p });
  }
  // ---------- Zweikämpfe ----------
  tackles(dt) {
    const b = this.ball, o = b.owner; if (!o || b.mode !== 'held' || o.gkHold > 0) return;
    for (const q of this.alive(1 - o.team)) {
      if (dist(q, o) > 1.7) continue;
      q.tackleT -= dt; if (q.tackleT > 0) continue; q.tackleT = 0.55;
      const S = this.styleOf(q.team);
      const win = 0.5 * (q.abwehr / (q.abwehr + o.technik)) * (1 + S.press * 0.1) * (q.pos === 'TW' ? 1.3 : 1) * (0.7 + 0.3 * q.energy) * (q.role === 'destroyer' || q.role === 'stopper' ? 1.12 : 1);
      const r = this.r();
      if (r < win) { q.rating += 0.1; o.rating -= 0.03; this.log('tackle', { team: q.team, p: q, p2: o }); this.loose(b.x, b.y, (q.x - o.x) * 3 + (this.r() - 0.5) * 4, (q.y - o.y) * 3 + (this.r() - 0.5) * 4); b.last = q; this.lastTouch = q; return; }
      if (r < win + (this.inBox(o, q.team) ? 0.14 : 0.09)) { // Foul (im Strafraum etwas häufiger: Elfmeter)
        this.freeze = 0.9; o.decideT = 0.4;
        const ownHalf = q.team === 0 ? q.x < PW / 2 : q.x > PW / 2;
        if (this.inBox(o, q.team) && this.r() < 0.9) { this.startPenalty(o.team, q); return; }
        if (q.yellow >= 1 && this.r() < 0.35) { q.yellow++; q.red = true; q.out = true; q.rating -= 1; this.log('red', { team: q.team, p: q }); }
        else if (this.r() < (ownHalf ? 0.3 : 0.18)) { q.yellow++; q.rating -= 0.15; this.log('yellow', { team: q.team, p: q }); }
        if (!o.injured && this.r() < 0.045 * (this.hooks.injMul || 1)) { o.injured = true; this.log('injury', { team: o.team, p: o }); this.hooks.onInjury?.(o); }
        this.stoppage += 0.4; this.fouls[q.team]++;
        { const g = this.goalOf(o.team), gd = dist(o, g); if (gd < 33 && !o.out && !o.injured) this.startFreeKick(o.team, { x: b.x, y: b.y }); }
        return;
      }
    }
  }
  // ---------- Flanken, Ecken, Freistöße ----------
  heading(p) { return p.schuss * 0.35 + p.abwehr * 0.35 + p.tempo * 0.1 + p.kondition * 0.2 + (p.pos === 'ST' || p.pos === 'IV' ? 6 : 0) + (p.koloss ? 12 : 0) + (p.role === 'target' || p.role === 'stopper' ? 10 : 0); }
  // Mitspieler im Strafraum, gewichtet nach Kopfballstärke und Freiraum
  crossTarget(ti, from) {
    const g = this.goalOf(ti); let best = null, bv = -1e9;
    for (const q of this.alive(ti)) { if (q === from || q.pos === 'TW') continue; const dx = Math.abs(q.x - g.x), dy = Math.abs(q.y - PH / 2); if (dx > 24 || dy > 15) continue;
      const [, od] = this.nearest(1 - ti, q); const v = this.heading(q) * 0.08 + Math.min(4, od || 4) + this.r() * 3 - dx * 0.08; if (v > bv) { bv = v; best = q; } }
    return best;
  }
  cross(p, q, set) {
    const b = this.ball, err = (1 - p.technik / 100) * 4.5 * this.W.err * (this.r() - 0.5), g = this.goalOf(p.team), dir = p.team === 0 ? 1 : -1;
    // Flanke in den Raum vor dem Tor – der Mitspieler läuft ein
    const tgt = { x: g.x - dir * clamp(Math.abs(q.x - g.x), 6, 12) + err * 0.4, y: PH / 2 + clamp(q.y - PH / 2, -8, 8) * 0.7 + err };
    const dd = dist(p, tgt) || 1, sp = clamp(16 + dd * 0.35, 18, 28);
    b.owner = null; b.mode = 'pass'; b.cross = true; b.target = q; b.from = p; b.vx = (tgt.x - p.x) / dd * sp; b.vy = (tgt.y - p.y) / dd * sp; b.x = p.x; b.y = p.y; this.lastTouch = p; b.last = p; p.rating += 0.02;
    if (!set) this.log('cross', { team: p.team, p });
  }
  headerDuel(att) {
    const b = this.ball, ti = att.team, g = this.goalOf(ti), k = this.keeper(1 - ti); b.cross = false; this.spOn = false; for (const q of this.players) q.spT = null;
    // Torwart fängt Flanken im Fünfmeterraum ab
    if (Math.abs(b.x - g.x) < 7 && Math.abs(b.y - PH / 2) < 9 && this.r() < 0.18 + k.abwehr / 100 * 0.32 + (k.role === 'sweeper' ? 0.12 : 0)) { k.rating += 0.1; this.log('claim', { team: ti, p: att }); this.give(k); k.gkHold = 1.4 + this.r(); this.freeze = 0.6; return; }
    let def = null, dd = 3.2; for (const q of this.alive(1 - ti)) { if (q.pos === 'TW') continue; const d = dist(q, b); if (d < dd) { dd = d; def = q; } }
    const ha = this.heading(att) * (0.7 + 0.3 * att.energy), hd = def ? this.heading(def) * (0.7 + 0.3 * def.energy) * (1.15 - dd * 0.2) : 0;
    if (def && this.r() > ha / (ha + hd)) { def.rating += 0.08; this.log('clear', { team: def.team, p: def });
      if (this.r() < 0.22) { this.startCorner(ti, b.y < PH / 2 ? 0 : 1); return; }
      const dir = ti === 0 ? -1 : 1; this.loose(b.x, b.y, dir * (10 + this.r() * 8), (this.r() - 0.5) * 12); b.last = def; this.lastTouch = def; return; }
    // Kopfball aufs Tor
    att.x = b.x; att.y = b.y; const gd = dist(att, g), ang = Math.max(0.3, 1 - Math.abs(att.y - g.y) / 20);
    const xg = clamp((0.55 * Math.exp(-gd / 7.5) * ang) * (0.6 + this.heading(att) / 140) * (1.15 - 0.4 * k.abwehr / 100) * this.W.xg, 0.03, 0.5);
    if (b.from && b.from.team === ti) this.assist = b.from;
    this.log('header', { team: ti, p: att }); this.shoot(att, xg, { header: true });
  }
  startCorner(ti, sideY) {
    const g = this.goalOf(ti), b = this.ball, cx = g.x === PW ? PW - 0.4 : 0.4, cy = sideY ? PH - 0.4 : 0.4;
    const pool = this.alive(ti).filter(p => p.pos !== 'TW'); if (!pool.length) return;
    const taker = pool.find(p => p.id === this.teams[ti].cornerTaker) || [...pool].sort((a, c) => (c.technik + (c.pos === 'FL' || c.pos === 'ZM' ? 8 : 0)) - (a.technik + (a.pos === 'FL' || a.pos === 'ZM' ? 8 : 0)))[0];
    this.corners[ti]++; this.stoppage += 0.25;
    b.owner = null; b.mode = 'held'; b.vx = b.vy = 0; b.x = cx; b.y = cy; b.cross = false;
    const dir = g.x === PW ? -1 : 1, X = (m) => g.x + dir * m, Y = (m) => PH / 2 + (sideY ? m : -m);
    const spots = [[6, -3], [7.5, 2.5], [11, 0], [9, 5], [14, -6], [17, 3]];
    const atk = pool.filter(p => p !== taker).sort((a, c) => this.heading(c) - this.heading(a));
    for (const p of this.players) p.spT = null;
    atk.forEach((p, i) => { if (i < spots.length - (this.teams[ti].press === 1 ? 0 : 1)) p.spT = { x: X(spots[i][0]), y: Y(spots[i][1]) }; else p.spT = { x: g.x === PW ? PW * 0.58 : PW * 0.42, y: p.anchor.y }; });
    const markers = this.alive(1 - ti).filter(p => p.pos !== 'TW');
    const used = new Set(); for (const a of atk.slice(0, 5)) { let m = null, md = 1e9; for (const q of markers) { if (used.has(q)) continue; const d = dist(q, a.spT); if (d < md) { md = d; m = q; } } if (m) { used.add(m); m.spT = { x: a.spT.x + dir * 0.9, y: a.spT.y + (sideY ? -0.4 : 0.4) }; } }
    for (const q of markers) if (!used.has(q)) q.spT = used.size < 7 ? (used.add(q), { x: X(used.size % 2 ? 1 : 12), y: Y(used.size % 2 ? 3.6 : -2) }) : { x: g.x === PW ? PW * 0.66 : PW * 0.34, y: q.anchor.y };
    const k = this.keeper(1 - ti); if (k) k.spT = { x: X(0.8), y: PH / 2 + (sideY ? 1 : -1) };
    taker.spT = { x: cx + (g.x === PW ? 0.7 : -0.7), y: cy + (sideY ? 0.7 : -0.7) };
    this.sp = { kind: 'corner', ti, taker, t: 6, min: 2.4 }; this.spOn = true; this.assist = null;
    this.log('corner', { team: ti, p: taker });
  }
  startFreeKick(ti, at) {
    const T = this.teams[ti], alive = this.alive(ti).filter(p => p.pos !== 'TW'), g = this.goalOf(ti), b = this.ball;
    const taker = alive.find(p => p.id === T.fkTaker) || alive.find(p => p.id === T.penTaker) || [...alive].sort((a, c) => (c.schuss + c.technik) - (a.schuss + a.technik))[0]; if (!taker) return;
    b.owner = null; b.mode = 'held'; b.vx = b.vy = 0; b.x = clamp(at.x, 1, PW - 1); b.y = clamp(at.y, 1, PH - 1); b.cross = false;
    const ux = (g.x - b.x), uy = (g.y - b.y), ul = Math.hypot(ux, uy) || 1, nx = ux / ul, ny = uy / ul;
    for (const p of this.players) p.spT = null;
    taker.spT = { x: b.x - nx * 1.3, y: b.y - ny * 1.3 };
    // Mauer: 3–4 Verteidiger 9,15 m vor dem Ball
    const def = this.alive(1 - ti).filter(p => p.pos !== 'TW').sort((a, c) => dist(a, b) - dist(c, b)), wn = ul < 24 ? 4 : 3, wall = def.slice(0, wn);
    wall.forEach((p, i) => { const off = (i - (wn - 1) / 2) * 0.75; p.spT = { x: b.x + nx * 9.15 - ny * off, y: b.y + ny * 9.15 + nx * off }; });
    // Angreifer in den Strafraum, übrige Verteidiger an die Gegenspieler
    const atk = alive.filter(p => p !== taker).sort((a, c) => this.heading(c) - this.heading(a)).slice(0, 4), dir = g.x === PW ? -1 : 1;
    atk.forEach((p, i) => { p.spT = { x: g.x + dir * (8 + i * 2.5), y: PH / 2 + (i - 1.5) * 4.5 }; });
    def.slice(wn, wn + 4).forEach((q, i) => { const a = atk[i]; if (a) q.spT = { x: a.spT.x + dir * 0.9, y: a.spT.y }; });
    const k = this.keeper(1 - ti); if (k) k.spT = { x: g.x + dir * 0.9, y: PH / 2 + clamp((b.y - PH / 2) * 0.12, -1.5, 1.5) };
    const direct = ul < 30 && Math.abs(b.y - PH / 2) < 19;
    this.sp = { kind: 'fk', ti, taker, t: 6, min: 3, wall, direct, ask: direct && !!this.hooks.fkChoice && !!this.teams[ti].me && this.speed <= 2 }; this.spOn = true; this.assist = null; this.freeze = 0;
    this.log('freekick', { team: ti, p: taker });
  }
  // Einlaufen: aus dem Tunnel an die Mittellinie, Aufstellung vor der Haupttribüne, dann auf die Positionen
  startWalkout() {
    const b = this.ball; b.owner = null; b.mode = 'held'; b.x = PW / 2; b.y = PH / 2;
    for (let ti = 0; ti < 2; ti++) this.alive(ti).forEach((p, i) => { p.x = PW / 2 + (ti ? 0.9 : -0.9); p.y = -3 - i * 0.7; p.vx = p.vy = 0; p.spT = { x: PW / 2 + (ti ? 1 : -1) * (2.2 + i * 1.45), y: 5 }; });
    this.sp = { kind: 'walkout', ti: 0, taker: null, t: 40, stage: 0, hold: 0 };
  }
  startRestart(kind, ti, at) {
    const b = this.ball; b.owner = null; b.mode = 'held'; b.vx = b.vy = 0; b.cross = false; this.assist = null; for (const p of this.players) p.spT = null;
    if (kind === 'kickoff') { const T = this.kickoffTargets(ti); for (const [p, t] of T) p.spT = t;
      // Torjubel: Schütze läuft Richtung Eckfahne, die Mitspieler hinterher – erst danach geht es zurück zum Anstoß
      let celeb = null; if (at && at.scorer && !at.scorer.out) { const sc = at.scorer, cy = sc.y < PH / 2 ? 1.5 : PH - 1.5, cx = clamp(sc.x + (sc.team === 0 ? 1 : -1) * 6, 3, PW - 3); celeb = { scorer: sc, team: at.team, flag: { x: cx, y: cy } }; }
      if (!celeb) { b.x = PW / 2; b.y = PH / 2; }
      this.sp = { kind, ti, taker: T.taker, t: celeb ? 9 : 6.5, wait: celeb ? 3.6 : 2.0, min: celeb ? 4.4 : 2.8, celeb }; return; }
    if (kind === 'throw') { b.x = at.x; b.y = at.y; const [p] = this.nearest(ti, b); if (!p) return; p.spT = { x: at.x, y: at.y === 0 ? -0.6 : PH + 0.6 }; this.sp = { kind, ti, taker: p, t: 5, min: 0.6 }; this.log('throwin', { team: ti, p }); return; }
    if (kind === 'goalkick') { const k = this.keeper(ti), gx = ti === 0 ? 5.5 : PW - 5.5; b.x = gx; b.y = PH / 2 + (this.r() - 0.5) * 8; k.spT = { x: b.x + (ti === 0 ? -1 : 1), y: b.y }; this.sp = { kind, ti, taker: k, t: 4, min: 0.9 }; return; }
  }
  // Anstoßpositionen (wie kickoff(), aber als Ziele zum Hinlaufen)
  kickoffTargets(ti) {
    const res = new Map(), st = this.alive(ti).filter(p => p.pos === 'ST').sort((a, b) => dist(a, { x: PW / 2, y: PH / 2 }) - dist(b, { x: PW / 2, y: PH / 2 }))[0] || this.alive(ti)[5];
    for (const p of this.players) if (!p.out) { let x = p.anchor.x, y = p.anchor.y; if (p.team === 0) x = Math.min(x, PW / 2 - 1.5); else x = Math.max(x, PW / 2 + 1.5); if (p.team !== ti) x = ti === 0 ? Math.max(x, PW / 2 + 9.15) : Math.min(x, PW / 2 - 9.15); res.set(p, { x, y }); }
    if (st) res.set(st, { x: PW / 2 + (ti === 0 ? -1 : 1), y: PH / 2 }); res.taker = st; return res;
  }
  takeSetPiece() {
    const sp = this.sp; this.sp = null; const { ti, taker } = sp; if (taker && taker.spT && sp.kind !== 'kickoff') { taker.x = taker.spT.x; taker.y = taker.spT.y; taker.vx = taker.vy = 0; } if (taker) taker.spT = null;
    if (sp.kind === 'kickoff') { for (const p of this.players) p.spT = null; this.kickoff(ti); this.freeze = 0.4; return; }
    if (sp.kind === 'throw') { const mates = this.alive(ti).filter(q => q !== taker && q.pos !== 'TW' && dist(q, taker) < 22).sort((a, c) => dist(a, taker) - dist(c, taker)); this.give(taker); const q = mates[Math.floor(this.r() * Math.min(3, mates.length))]; if (q) { this.noOff = true; this.pass(taker, q); this.noOff = false; if (this.ball.mode === 'pass') this.ball.throwIn = true; } return; }
    if (sp.kind === 'goalkick') { this.give(taker); const dir = ti === 0 ? 1 : -1, far = this.alive(ti).filter(q => q.pos !== 'TW' && (q.x - taker.x) * dir > 25).sort(() => this.r() - 0.5)[0], near = this.alive(ti).filter(q => q.pos === 'IV' || q.pos === 'AV')[0]; const q = this.r() < 0.6 ? far || near : near || far; if (q) this.pass(taker, q); return; }
    if (taker.out) { const [n] = this.nearest(ti, this.ball); if (n) this.give(n); return; }
    if (sp.kind === 'corner') {
      const cv = this.teams[ti].cornerVar || 'mix';
      if (this.r() < (cv === 'short' ? 0.8 : 0.14)) { const [q] = this.nearest(ti, taker, taker); if (q) { this.give(taker); this.pass(taker, q); return; } }
      let q = this.crossTarget(ti, taker);
      if (cv === 'near' || cv === 'far') { const g = this.goalOf(ti), cy = this.ball.y < PH / 2 ? 0 : PH; const c = this.alive(ti).filter(p => p !== taker && p.pos !== 'TW' && Math.abs(p.x - g.x) < 14).sort((a, b) => cv === 'near' ? Math.abs(a.y - cy) - Math.abs(b.y - cy) : Math.abs(b.y - cy) - Math.abs(a.y - cy))[0]; if (c) q = c; }
      this.give(taker, true); if (q) this.cross(taker, q, true); return;
    }
    // Freistoß: direkt aufs Tor oder hoch in den Strafraum
    const g = this.goalOf(ti), d = dist(this.ball, g); this.give(taker, true);
    if (sp.choice === 'cross') { const q = this.crossTarget(ti, taker); if (q) { this.cross(taker, q, true); return; } }
    if (sp.choice || (sp.direct && this.r() < 0.72)) { const ang = Math.max(0.35, 1 - Math.abs(this.ball.y - g.y) / 30); const xg = clamp((0.05 + 0.1 * Math.exp(-(d - 17) / 7)) * ang * (0.55 + taker.schuss / 100 * 0.6 + taker.technik / 100 * 0.25) * this.W.xg, 0.02, 0.2); const ch = sp.choice, mul = ch === 'top' ? 1.25 : ch === 'low' ? 0.9 : 1, wp = ch === 'top' ? 0.16 : ch === 'low' ? 0.38 : 0.26; this.shoot(taker, xg * mul, { wall: sp.wall, fk: true, wallP: wp, missUp: ch === 'top' ? 0.06 : 0 }); return; }
    const q = this.crossTarget(ti, taker); if (q) this.cross(taker, q, true);
  }
  // ---------- Elfmeter ----------
  startPenalty(ti, fouler, takerIn) {
    const T = this.teams[ti], alive = this.alive(ti);
    const taker = takerIn || alive.find(p => p.id === T.penTaker && p.pos !== 'TW') || alive.filter(p => p.pos !== 'TW').sort((a, b) => b.schuss - a.schuss)[0];
    const g = this.goalOf(ti), spot = { x: g.x + (ti === 0 ? -11 : 11), y: PH / 2 };
    if (fouler && this.r() < 0.35) { fouler.yellow++; fouler.rating -= 0.15; this.log('yellow', { team: fouler.team, p: fouler }); }
    this.ball.owner = null; this.ball.mode = 'held'; this.ball.vx = this.ball.vy = 0; this.ball.x = spot.x; this.ball.y = spot.y;
    for (const p of this.players) p.spT = null;
    taker.spT = { x: spot.x + (ti === 0 ? -1.4 : 1.4), y: spot.y };
    // alle anderen an den Strafraum, Torwart auf die Linie
    for (const p of this.players) { if (p.out || p === taker) continue; if (p.pos === 'TW' && p.team !== ti) { p.spT = { x: g.x + (ti === 0 ? -0.6 : 0.6), y: PH / 2 }; continue; }
      if (this.shootout) { const k = this.players.indexOf(p) % 11, a = k / 11 * Math.PI * 2; p.spT = { x: PW / 2 + Math.cos(a) * 6 + (p.team === 0 ? -1.2 : 1.2), y: PH / 2 + Math.sin(a) * 6 }; if (p.pos === 'TW') p.spT = { x: PW / 2 + (p.team === 0 ? -14 : 14), y: PH / 2 + 10 }; continue; }
      if (p.pos === 'TW') continue; if (Math.abs(p.x - g.x) < 22) p.spT = { x: g.x + (ti === 0 ? -21 : 21) - (ti === 0 ? this.r() * 4 : -this.r() * 4), y: clamp(p.y, PH / 2 - 18, PH / 2 + 18) }; }
    const ask = !!this.hooks.penaltyChoice && (this.teams[ti].me || this.teams[1 - ti].me) && this.speed <= 2;
    this.pen = { ti, taker, t: this.shootout ? 3.0 : 3.4, ask }; if (!this.shootout) this.stoppage += 0.6;
    this.log(this.shootout ? 'so_kick' : 'penalty', { team: ti, p: taker });
  }
  // Wahl aus der Oberfläche: Schütze { col: -1|0|1, high } (aus Sicht hinter dem Schützen) oder Torwart { dive: -1|0|1 }
  chooseFreeKick(c) { if (this.sp && this.sp.kind === 'fk') { this.sp.choice = c; this.sp.waiting = false; } }
  choosePenalty(c) { const pn = this.pen; if (!pn) return; if (c.col !== undefined) pn.aim = { col: c.col, high: !!c.high }; if (c.dive !== undefined) pn.dive = c.dive; pn.waiting = false; pn.t = Math.min(pn.t, 0.5); }
  takePenalty() {
    const { ti, taker } = this.pen; if (this.pen.aim) this.penAim = this.pen.aim; if (this.pen.dive !== undefined) this.penDive = this.pen.dive; this.pen = null; for (const p of this.players) p.spT = null; const b = this.ball, g = this.goalOf(ti), k = this.keeper(1 - ti);
    taker.x = b.x + (ti === 0 ? -1.2 : 1.2); taker.y = b.y; k.x = g.x + (ti === 0 ? -0.6 : 0.6);
    this.shots[ti][0]++; this.xgSum[ti] += 0.76; this.lastTouch = taker; b.last = taker;
    // Ecke (links/Mitte/rechts, hoch/flach) gegen die Sprungrichtung des Torwarts
    const aim = this.penAim || (() => { const x = this.r(); return { col: x < 0.38 ? -1 : x < 0.62 ? 0 : 1, high: this.r() < 0.3 }; })(), dive = this.penDive ?? (() => { const x = this.r(); return x < 0.42 ? -1 : x < 0.58 ? 0 : 1; })();
    this.penAim = null; this.penDive = null;
    const ws = ti === 0 ? -1 : 1, skill = taker.schuss / 100, miss = (aim.high ? 0.17 : aim.col ? 0.06 : 0.025) * (1.45 - skill), r = this.r();
    let outcome, ty = g.y + ws * aim.col * 2.55;
    if (r < miss) { outcome = this.r() < 0.35 ? 'post' : 'wide'; ty = outcome === 'post' ? g.y + ws * (aim.col || (this.r() < 0.5 ? -1 : 1)) * GOAL_W / 2 : g.y + ws * (aim.col || 1) * (GOAL_W / 2 + 0.6 + this.r() * 1.2); }
    else if (dive === aim.col && this.r() < clamp((aim.high ? 0.32 : aim.col ? 0.68 : 0.82) * (0.55 + k.abwehr / 100 * 0.6), 0.15, 0.92)) { outcome = 'save'; this.shots[ti][1]++; }
    else { outcome = 'goal'; this.shots[ti][1]++; }
    if (!this.shootout) this.shotLog.push({ min: Math.floor(this.min), team: ti, x: b.x, y: b.y, xg: 0.76, out: outcome, pen: true, name: taker.name });
    const sp = 30, dd = Math.hypot(g.x - b.x, ty - b.y) || 1;
    b.owner = null; b.mode = 'shot'; b.shooter = taker; b.outcome = outcome; b.blocker = null; b.penalty = true; b.vx = (g.x - b.x) / dd * sp; b.vy = (ty - b.y) / dd * sp;
    b.aimHigh = aim.high && outcome !== 'wide' ? 2.0 : aim.high ? 2.9 : 0.35; b.keeperDive = { y: g.y + ws * dive * 2.4, col: dive };
    this.assist = null;
  }
  // ---------- Elfmeterschießen ----------
  startShootout() {
    this.over = false; this.paused = false; this.sp = null; this.freeze = 0; for (const p of this.players) p.spT = null;
    const order = (ti) => { const T = this.teams[ti], a = this.alive(ti).filter(p => p.pos !== 'TW').sort((x, y) => (y.id === T.penTaker) - (x.id === T.penTaker) || y.schuss - x.schuss); return a; };
    this.shootout = { score: [0, 0], kicks: [0, 0], log: [[], []], order: [order(0), order(1)], turn: this.r() < 0.5 ? 0 : 1, wait: 2.5, done: false };
    this.log('shootout', { team: this.shootout.turn });
  }
  stepShootout(dt) {
    const so = this.shootout; if (so.done) return;
    if (this.pen) { const pn = this.pen; if (pn.waiting) { this.movePlayers(dt, true); return; } pn.t -= dt; if (pn.t <= 0.7 && pn.ask && !pn.asked) { pn.asked = true; pn.waiting = true; this.hooks.penaltyChoice?.({ shoot: !!this.teams[pn.ti].me, taker: pn.taker, keeper: this.keeper(1 - pn.ti), shootout: so }); return; } if (pn.t <= 0) this.takePenalty(); else this.movePlayers(dt, true); return; }
    if (this.ball.mode === 'shot') { this.moveBall(dt); return; }
    if (so.wait > 0) { so.wait -= dt; this.movePlayers(dt, true); return; }
    const ti = so.turn, list = so.order[ti]; if (!list.length) { so.done = true; return; }
    const taker = list[so.kicks[ti] % list.length]; this.startPenalty(ti, null, taker);
  }
  shootoutResult(ti, scored, taker, keeper) {
    const so = this.shootout; so.kicks[ti]++; if (scored) so.score[ti]++; so.log[ti].push(scored ? 1 : 0);
    this.log(scored ? 'so_goal' : 'so_miss', { team: ti, p: taker });
    this.give(keeper); this.ball.owner = null; this.ball.mode = 'held'; this.ball.x = PW / 2; this.ball.y = PH / 2;
    const [a, b] = so.score, [ka, kb] = so.kicks, left = (k) => Math.max(0, 5 - k);
    let winner = null;
    if (ka <= 5 && kb <= 5) { if (a > b + left(kb)) winner = 0; else if (b > a + left(ka)) winner = 1; else if (ka === 5 && kb === 5 && a !== b) winner = a > b ? 0 : 1; }
    else if (ka === kb && a !== b) winner = a > b ? 0 : 1;
    if (winner !== null) { so.done = true; so.winner = winner; this.log('so_end', { team: winner, score: [a, b] }); this.over = true; this.hooks.onShootoutEnd?.(so); return; }
    so.turn = 1 - ti; so.wait = 1.8;
  }
  // Kabinenansprache (eigenes Team)
  teamTalk(ti, kind) {
    for (const p of this.alive(ti)) {
      if (kind === 'push') { p.tempo = clamp(p.tempo * 1.04, 1, 99); p.schuss = clamp(p.schuss * 1.04, 1, 99); p.energy = Math.max(0.3, p.energy - 0.03); }
      else if (kind === 'calm') { p.technik = clamp(p.technik * 1.04, 1, 99); p.abwehr = clamp(p.abwehr * 1.04, 1, 99); }
      else if (kind === 'praise') { for (const a of ['tempo', 'technik', 'abwehr', 'schuss']) p[a] = clamp(p[a] * 1.02, 1, 99); p.energy = Math.min(1, p.energy + 0.05); }
    }
    this.talked = kind;
  }
  // Gegnerische Trainerbank: müde oder verletzte Spieler ab der 55. Minute auswechseln
  aiCoach() {
    if (this.min < 55 || (this.aiCoachT && this.t < this.aiCoachT)) return; this.aiCoachT = this.t + 8 / MIN_PER_SEC;
    for (let ti = 0; ti < 2; ti++) { const T = this.teams[ti]; if (T.me) continue; const diff = this.score[ti] - this.score[1 - ti], cur = this.instr(ti);
      const want = diff < 0 ? (this.min > 75 ? 'highpress' : (T.ai === 'longshot' || T.ai === 'boss' ? 'wings' : 'highpress')) : diff > 0 && this.min > 70 ? (T.ai === 'wall' || T.ai === 'silo' ? 'waste' : 'counter') : 'normal';
      if (want !== cur && this.r() < 0.6) { T.instr = want; if (want !== 'normal') this.log('instr', { team: ti, p: { name: INSTR_NAMES[want] } }); } }
  }
  aiSubs() {
    if (this.min < 55 || (this.aiSubT && this.t < this.aiSubT)) return; this.aiSubT = this.t + 6 / (90 / MATCH_REAL);
    for (let ti = 0; ti < 2; ti++) {
      const T = this.teams[ti]; if (T.me || this.subsLeft[ti] <= 0 || !(T.benchP || []).length) continue;
      const tired = this.alive(ti).filter(p => p.pos !== 'TW' && (p.injured || p.energy < 0.45)).sort((a, b) => (a.injured ? -1 : a.energy) - (b.injured ? -1 : b.energy))[0];
      if (!tired) continue;
      const inP = T.benchP.find(p => p.pos === tired.pos) || T.benchP[0];
      this.sub(ti, tired.id, inP);
    }
  }
  // ---------- Wechsel ----------
  sub(ti, outId, inP) {
    if (this.subsLeft[ti] <= 0) return false;
    const o = this.players.find(p => p.team === ti && p.id === outId && !p.out); if (!o) return false;
    const n = this.mkPlayer({ ...inP, slot: [o.pos, 0.5, 0.5] }, ti); n.anchor = o.anchor; n.pos = o.pos; n.x = PW / 2 + (ti === 0 ? -1.5 : 1.5); n.y = -0.8; n.num = inP.num;
    o.out = true; o.subOff = { x: o.x, y: o.y, t: this.t }; if (this.ball.owner === o) { const [m] = this.nearest(ti, o); if (m) this.give(m); }
    this.players.push(n); this.subsLeft[ti]--; this.subsDone.push({ team: ti, out: o, in: n, min: Math.floor(this.min) });
    const T = this.teams[ti]; T.benchP = (T.benchP || []).filter(p => p.id !== inP.id);
    this.log('sub', { team: ti, p: n, p2: o });
    return true;
  }
  result() {
    const me = this.teams[0].me ? 0 : 1, mine = this.players.filter(p => p.team === me);
    return { gh: this.score[0], ga: this.score[1], mine: me === 0 ? 'home' : 'away', events: this.events, shots: this.shots, poss: this.poss, corners: this.corners, fouls: this.fouls, offsides: this.offsides, so: this.shootout ? [...this.shootout.score] : null, shotLog: this.shotLog, heat: this.heat.map(h => h.map(v => Math.round(v * 10) / 10)), mom: this.mom.slice(0, Math.max(90, Math.ceil(this.min))), xg: this.xgSum.map(v => Math.round(v * 100) / 100),
      played: mine.map(p => p.id), minutes: Object.fromEntries(mine.map(p => [p.id, Math.round(p.minutes)])), ratings: Object.fromEntries(mine.map(p => [p.id, Math.round(clamp(p.rating, 1, 10) * 10) / 10])),
      yellows: mine.filter(p => p.yellow >= 1).map(p => p.id), reds: mine.filter(p => p.red).map(p => p.id), injuries: mine.filter(p => p.injured).map(p => p.id),
      scorers: mine.flatMap(p => Array(p.goals).fill(p.id)), assists: mine.flatMap(p => Array(p.assists).fill(p.id)), players: this.players };
  }
  // komplette Simulation ohne Darstellung (Tests, Tempo „überspringen“)
  runToEnd(maxSec = 400) { const was = this.paused; this.paused = false; let s = 0; while (!this.over && s < maxSec) { if (this.paused) { this.paused = false; } this.step(1 / 30); s += 1 / 30; } this.paused = was && !this.over; return this.result(); }
}
