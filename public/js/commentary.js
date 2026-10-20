// Kommentar-Bausteine: Vorlagen mit benannten Platzhaltern, die der Sprecher aus vorproduzierten
// Teilstücken (Satzteile, Namen, Zahlen) zusammensetzt. Platzhalter: {p} {p2} {k} Spieler, {t} {t2} Vereine,
// {s} Stadion, {n} {a} {b} {pc} {sh} Zahlen.
export const FILLER = {
  de: {
    lead: ['Nach {n} Minuten führt {t} mit {a} zu {b}. Der Gegner sucht noch nach einer Lücke im Pflichtenheft.', '{t} verwaltet die Führung – sauberer Kern im Mittelfeld.', 'Es steht {a} zu {b}. {t} hat das Spiel im Griff wie eine saubere Auslieferung.'],
    behind: ['{n} Minuten gespielt, {t} liegt zurück. Zeit für eine Schnellkorrektur?', 'Es steht {a} zu {b} – {t} braucht jetzt einen Änderungsantrag mit höchster Dringlichkeit.', 'Die Uhr läuft: {n} Minuten, {t} im Rückstand.'],
    level: ['Noch kein Unterschied nach {n} Minuten – beide Teams tasten sich ab wie beim Projektauftakt.', 'Es steht {a} zu {b}. Die Abwehrreihen stehen wie zwei Brandmauern.', 'Unentschieden nach {n} Minuten.'],
    poss: ['{t} hat {pc} Prozent Ballbesitz – die Integration läuft.', '{pc} Prozent Ballbesitz für {t}, aber ein Tor braucht am Ende einen Abschluss.'],
    rain: ['Der Regen wird stärker. Der Rasen ist rutschig wie ein ungetestetes Update.'],
    snow: ['Es schneit in der Arena. Kurze Pässe sind jetzt Gold wert.'],
    late: ['Noch {n} Minuten zu spielen. Jetzt entscheidet die Kondition.', 'Die Schlussphase läuft. {t} muss jetzt alles geben.'],
  },
  en: {
    lead: ['After {n} minutes {t} lead {a} to {b}. The opponent is still looking for a gap in the spec.', '{t} manage the lead – a clean core in midfield.', 'It is {a} to {b}. {t} have the game under control like a clean delivery.'],
    behind: ['{n} minutes played, {t} are behind. Time for a hotfix?', 'It is {a} to {b} – {t} need a top priority change request now.', 'The clock is ticking: {n} minutes, {t} behind.'],
    level: ['Nothing between them after {n} minutes – both teams feeling each other out like a project kick-off.', 'It is {a} to {b}. Both defences stand like two firewalls.', 'Level after {n} minutes.'],
    poss: ['{t} have {pc} percent possession – the integration is running.', '{pc} percent possession for {t}, but a goal needs a finish in the end.'],
    rain: ['The rain is getting heavier. The pitch is as slippery as an untested update.'],
    snow: ['It is snowing in the arena. Short passes are worth their weight in gold now.'],
    late: ['{n} minutes left to play. Stamina decides it now.', 'The final phase is under way. {t} have to give everything now.'],
  },
};
export const HALF = {
  de: { lead: 'Halbzeit. {t} führt mit {a} zu {b} – {pc} Prozent Ballbesitz, {sh} Schüsse.', behind: 'Halbzeit. {t} liegt mit {a} zu {b} zurück – {pc} Prozent Ballbesitz, {sh} Schüsse.', level: 'Halbzeit. Es steht {a} zu {b} – {pc} Prozent Ballbesitz für {t}, {sh} Schüsse.' },
  en: { lead: 'Half-time. {t} lead {a} to {b} – {pc} percent possession, {sh} shots.', behind: 'Half-time. {t} trail {a} to {b} – {pc} percent possession, {sh} shots.', level: 'Half-time. It is {a} to {b} – {pc} percent possession for {t}, {sh} shots.' },
};
export const WEATHER_LINE = {
  de: { sun: 'Bestes Fußballwetter in der {s}.', rain: 'Regen über der {s}. Der Ball wird schnell, die Pässe werden ungenau.', snow: 'Schnee über der {s}! Wer hier sicher passt, gewinnt.', wind: 'Starker Wind in der {s}. Weite Bälle werden zur Lotterie.' },
  en: { sun: 'Perfect football weather at the {s}.', rain: 'Rain over the {s}. The ball gets quick, the passes get sloppy.', snow: 'Snow over the {s}! Whoever passes safely here wins.', wind: 'Strong wind at the {s}. Long balls become a lottery.' },
};
export const TALK_LINE = {
  de: { push: 'Die Kabinenansprache war deutlich. {t} kommt mit Feuer aus der Kabine.', calm: '{t} kommt ruhig und konzentriert zurück auf den Platz.', praise: 'Lob in der Kabine – {t} wirkt befreit.' },
  en: { push: 'That was a fiery team talk. {t} come out of the dressing room on fire.', calm: '{t} come back out calm and focused.', praise: 'Praise in the dressing room – {t} look liberated.' },
};

// Vorlage in Teile zerlegen: [{t: 'Text'} | {ph: 'p'}]
export function splitTpl(tpl) {
  const out = []; const re = /\{(p2|t2|p|t|k|s|n|a|b|pc|sh)\}/g; let i = 0, m;
  while ((m = re.exec(tpl))) { if (m.index > i) out.push({ t: tpl.slice(i, m.index) }); out.push({ ph: m[1] }); i = m.index + m[0].length; }
  if (i < tpl.length) out.push({ t: tpl.slice(i) });
  return out;
}
// Textteil für die Aufnahme säubern: führende Satzzeichen weg (werden als Pause gespielt)
export function cleanFrag(s) { return s.replace(/^[\s–,:;.!?…]+/, '').replace(/\s+$/, '').replace(/^\s+/, ''); }
export function leadPause(s) { return /^\s*[–,:;.!?…]/.test(s) ? 0.16 : 0; }
// englische Vorlage aus dem Wörterbuch (positionelle Platzhalter) → benannte Platzhalter
export function enTemplate(deTpl, EN) {
  const names = [...deTpl.matchAll(/\{(p2|t2|p|t|k|s|n|a|b|pc|sh)\}/g)].map(m => m[1]);
  let i = 0; const key = deTpl.replace(/\{(p2|t2|p|t|k|s|n|a|b|pc|sh)\}/g, () => `{${i++}}`);
  const v = EN[key]; if (!v) return null;
  return v.replace(/\{(\d)\}/g, (_, d) => names[+d] ? `{${names[+d]}}` : '');
}
