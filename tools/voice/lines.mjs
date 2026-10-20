import EN from '/home/claude/beat-realcore-manager/public/js/i18n-en.js';
import { OPPONENTS, TAUNTS } from '/home/claude/beat-realcore-manager/public/js/data.js';
import fs from 'node:fs';
const de = [];
const add = (who, text) => de.push({ who, text });
add('narr', '1998. Ein System geht live. Es wurde nie dokumentiert – und nie wieder abgeschaltet.');
add('legacy', 'Seit 1998 ungeschlagen. Ohne Tests, ohne Doku, ohne Gnade: der Legacy-Monolith FC.');
add('lena', 'Ein neuer Verein fordert ihn heraus: TechHub United. Clean Core in der Abwehr, Integration im Mittelfeld, KI im Sturm.');
add('lena', 'Sieben Spieltage. Sieben Legacy-Clubs. Ein Ziel: die Legacy League – und das Finale gegen den Monolithen.');
add('narr', 'Beat RealCore – Legacy League. Saison starten!');
add('lena', 'Lena: Sieg und Wochenziel erreicht! Clean Core, wie es im Buche steht.');
add('lena', 'Lena: Sauber deployed! Das gibt Punkte für die Liga.');
add('lena', 'Lena: Ein Punkt – nicht schön, aber stabil. Nächste Woche legen wir nach.');
add('legacy', 'Legacy-KI: Never touch a running system. Ich hab es euch gesagt.');
add('narr', 'Meister der Legacy League! TechHub United hat den Monolithen gestürzt. Clean Core gewinnt Meisterschaften!');
for (const r of [2, 3]) add('lena', `Saisonende. Platz ${r} für TechHub United – stark gespielt, aber die Legacy-IT bleibt vorn. Nächste Saison holen wir den Titel.`);
for (const r of [4, 5, 6, 7, 8]) add('legacy', `Saisonende. Platz ${r}. Die Legacy-KI hat diese Saison gewonnen – never touch a running system. Revanche?`);
add('legacy', 'Ich laufe seit 1998. Ohne Doku, ohne Tests, ohne Niederlage. Ihr wollt Meister werden? Versucht es.');
for (const o of OPPONENTS) { add('lena', o.lena); add('legacy', o.legacy); }
for (const k in TAUNTS) for (const t of TAUNTS[k]) add('legacy', t);
add('lena', 'Sprecher aktiv.');
// EN via dictionary (patterns for ranks)
const tr = (t) => { if (EN[t]) return EN[t]; for (const [k, v] of Object.entries(EN)) { if (!k.includes('{0}') || k.includes('{1}')) continue; const esc = k.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&').replace('\\{0\\}', '(.+?)'); const m = t.match(new RegExp('^' + esc + '$')); if (m) return v.replace('{0}', m[1]); } return null; };
const en = de.map(l => ({ who: l.who, text: tr(l.text) })).filter(l => l.text);
console.log(de.length, en.length, de.filter(l => !tr(l.text)).map(l => l.text));
fs.writeFileSync('/tmp/tts/mgr/lines_de.json', JSON.stringify(de, null, 1)); fs.writeFileSync('/tmp/tts/mgr/lines_en.json', JSON.stringify(en, null, 1));
