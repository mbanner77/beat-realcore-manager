// Sammelt alle Teilstücke für den Live-Kommentar (Satzteile, Namen, Zahlen) je Sprache → tools/voice/frags_<lang>.json
import fs from 'node:fs';
import { COMMENT } from '../../public/js/match.js';
import { SQUAD, MARKET_POOL, OPPONENTS, CLUB } from '../../public/js/data.js';
import EN from '../../public/js/i18n-en.js';
import { FILLER, HALF, WEATHER_LINE, TALK_LINE, splitTpl, cleanFrag, enTemplate } from '../../public/js/commentary.js';
const names = new Set(['Mainframe-Koloss', 'Schatten-IT Sascha', 'Torwart', 'Clean-Core-Arena', 'Yara Young', 'Timo Trainee', 'Neo Newbie', CLUB.short]);
for (const p of SQUAD) names.add(p.name); for (const p of MARKET_POOL) names.add(p.name);
for (const o of OPPONENTS) { names.add(o.short); for (const n of o.names) names.add(n); }
const out = { de: new Map(), en: new Map() }, missing = [];
const addTpl = (lang, tpl) => { for (const part of splitTpl(tpl)) if (part.t) { const c = cleanFrag(part.t); if (c && /[A-Za-zÄÖÜäöüß]/.test(c)) out[lang].set('f:' + c, c); } };
for (const arr of Object.values(COMMENT)) for (const tpl of arr) { addTpl('de', tpl); const e = enTemplate(tpl, EN); if (e) addTpl('en', e); else missing.push(tpl); }
for (const [lang, F] of [['de', FILLER.de], ['en', FILLER.en]]) for (const arr of Object.values(F)) for (const t of arr) addTpl(lang, t);
for (const L of [HALF, WEATHER_LINE, TALK_LINE]) for (const lang of ['de', 'en']) for (const t of Object.values(L[lang])) addTpl(lang, t);
for (const lang of ['de', 'en']) { for (const n of names) out[lang].set('n:' + n, n); for (let i = 0; i <= 130; i++) out[lang].set('z:' + i, String(i)); }
for (const lang of ['de', 'en']) fs.writeFileSync(new URL(`frags_${lang}.json`, import.meta.url), JSON.stringify([...out[lang]].map(([key, text]) => ({ key, text })), null, 0));
console.log('de', out.de.size, 'en', out.en.size, 'names', names.size, 'missing EN', missing);
