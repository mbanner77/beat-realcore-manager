import { rating } from './manager.js';
// Erfolge: werden geräteweit gespeichert und gelten über alle Saisons
export const ACH = [
  { k: 'first_win', ic: 'trophy', name: 'Erster Sieg', desc: 'Gewinne ein Spiel in der Legacy League.' },
  { k: 'cup', ic: 'trophy', name: 'Pokalsieger', desc: 'Gewinne den TechHub-Pokal.' },
  { k: 'pen_hero', ic: 'target', name: 'Elfmeterheld', desc: 'Gewinne ein Elfmeterschießen.' },
  { k: 'clean', ic: 'target', name: 'Weiße Weste', desc: 'Spiele zu null.' },
  { k: 'five', ic: 'ball', name: 'Torfestival', desc: 'Schieße fünf Tore in einem Spiel.' },
  { k: 'hattrick', ic: 'star', name: 'Hattrick', desc: 'Ein:e Spieler:in trifft dreimal in einem Spiel.' },
  { k: 'comeback', ic: 'up', name: 'Comeback', desc: 'Gewinne nach einem Rückstand.' },
  { k: 'streak', ic: 'bolt', name: 'Siegesserie', desc: 'Gewinne drei Spiele in Folge.' },
  { k: 'monolith', ic: 'goal', name: 'Monolith gestürzt', desc: 'Besiege den Legacy-Monolith FC.' },
  { k: 'full_house', ic: 'squad', name: 'Ausverkauft', desc: 'Fülle das Stadion bei einem Heimspiel komplett.' },
  { k: 'builder', ic: 'board', name: 'Bauherr:in', desc: 'Baue das Stadion aus.' },
  { k: 'talent', ic: 'training', name: 'Talentschmiede', desc: 'Ein:e Spieler:in steigert die Stärke in einer Saison um 6.' },
  { k: 'champion', ic: 'trophy', name: 'Meister:in', desc: 'Gewinne die Legacy League.' },
  { k: 'unbeaten', ic: 'target', name: 'Ungeschlagen', desc: 'Beende eine Saison ohne Niederlage.' },
  { k: 'boss_mode', ic: 'star', name: 'Chefsache', desc: 'Werde Meister:in auf der Stufe Geschäftsführung.' },
  { k: 'marathon', ic: 'clock', name: 'Marathon', desc: 'Beende eine volle Saison mit 14 Spieltagen.' },
  { k: 'rich', ic: 'money', name: 'Schwarze Zahlen', desc: 'Beende eine Saison mit über 5.000 T€ Budget.' },
  { k: 'beat_rc', ic: 'trophy', name: 'Beat RealCore', desc: 'Schlage den Benchmark des RealCore-Teams.' },
];
const KEY = 'brcm-ach';
let mem = null;
export function achLoad(kiosk) { if (mem) return mem; mem = {}; if (!kiosk) try { mem = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { mem = {}; } return mem; }
export function achUnlock(keys, kiosk) {
  const got = achLoad(kiosk), fresh = keys.filter(k => !got[k] && ACH.some(a => a.k === k));
  for (const k of fresh) got[k] = Date.now();
  if (fresh.length && !kiosk) try { localStorage.setItem(KEY, JSON.stringify(got)); } catch { /* ignore */ }
  return fresh.map(k => ACH.find(a => a.k === k));
}
// Nach einem Spiel: Ereignisse auswerten (Tore in Reihenfolge für Comeback und Hattrick)
export function achAfterMatch(se, res, r, mine) {
  const out = [], gf = mine === 0 ? res.gh : res.ga, ga = mine === 0 ? res.ga : res.gh;
  if (r.won) out.push('first_win'); if (ga === 0) out.push('clean'); if (gf >= 5) out.push('five');
  const goals = res.events.filter(e => e.type === 'goal'), byP = {}; let a = 0, b = 0, behind = false;
  for (const e of goals) { if (e.team === mine) { a++; if (e.p) byP[e.p.id] = (byP[e.p.id] || 0) + 1; } else b++; if (b > a) behind = true; }
  if (Object.values(byP).some(n => n >= 3)) out.push('hattrick');
  if (behind && r.won) out.push('comeback');
  const last3 = se.results.slice(-3); if (last3.length === 3 && last3.every(x => x.won)) out.push('streak');
  if (r.won && se.results.at(-1)?.opp === 'monolith') out.push('monolith');
  const lr = se.results.at(-1); if (lr && lr.home && lr.cap && lr.att >= lr.cap) out.push('full_house');
  if (se.econ?.stadium > 0) out.push('builder');
  if (se.players.some(p => p.start && rating(p) - rating({ ...p, ...p.start }) >= 6)) out.push('talent');
  return out;
}
export function achAfterSeason(se, r) {
  const out = [];
  if (r.won) out.push('champion'); if (r.won && se.diffKey === 'gf') out.push('boss_mode');
  if (!se.results.some(x => !x.won && !x.draw)) out.push('unbeaten');
  if (se.len >= 14) out.push('marathon'); if (se.budget > 5000) out.push('rich');
  return out;
}
