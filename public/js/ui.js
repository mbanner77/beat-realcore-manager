// UI-Bausteine: Vereinswappen, Spieler-Avatare, Trikots, Ringe, Icons – alles als Inline-SVG ohne Bilddateien
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

// Wappen: Schild in Vereinsfarben mit Kürzel; TechHub bekommt ein Sechseck (Clean Core)
export function crest(club, size = 40) {
  const c1 = club.color || '#888', c2 = club.color2 || '#222', me = club.me || club.id === 'techhub' || club.short === 'TechHub';
  const txt = (club.short || club.name || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || '?';
  const id = 'cg' + hash(club.short + c1);
  const shape = me ? `<path d="M32 3 58 17v30L32 61 6 47V17z" fill="url(#${id})" stroke="${c1}" stroke-width="2.5"/><path d="M32 12 50 22v20L32 52 14 42V22z" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>`
    : `<path d="M32 3 58 11v24c0 14-12 22-26 27C18 57 6 49 6 35V11z" fill="url(#${id})" stroke="${c1}" stroke-width="2.5"/><path d="M6 27h52" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>`;
  return `<svg class="crest" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>${shape}<text x="32" y="${me ? 39 : 42}" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="${txt.length > 2 ? 17 : 21}" fill="#fff" stroke="rgba(0,0,0,0.35)" stroke-width="0.6">${esc(txt)}</text></svg>`;
}

// Avatar: Kopf mit Haar und Trikot in Vereinsfarben, deterministisch je Spieler:in
const SKIN = ['#f1c9a5', '#d9a479', '#8d5524', '#c68642', '#ffdbac', '#5c3a21', '#e0ac69'];
const HAIR = ['#2a1a0e', '#111', '#6b4423', '#b58a3c', '#3b2a1a', '#d94f2b', '#9a9a9a'];
export function avatar(p, colors = { color: '#3ddc84', color2: '#0b3b22' }, size = 44) {
  const h = hash(p.id || p.name), skin = SKIN[h % SKIN.length], hair = HAIR[(h >> 3) % HAIR.length], style = (h >> 6) % 4, gk = p.pos === 'TW';
  const shirt = gk ? '#ffd166' : colors.color, shirt2 = gk ? '#8a6a00' : colors.color2;
  const hairShape = style === 0 ? `<path d="M20 22c0-9 6-14 12-14s12 5 12 14v3c-3-5-6-7-12-7s-9 2-12 7z" fill="${hair}"/>`
    : style === 1 ? `<path d="M19 24c0-10 6-16 13-16s13 6 13 16l-2 9c-1-7-4-11-11-11s-10 4-11 11z" fill="${hair}"/>`
    : style === 2 ? `<path d="M21 22c0-8 5-12 11-12s11 4 11 12v2H21z" fill="${hair}"/>`
    : `<path d="M20 23c1-10 7-15 12-15 6 0 11 5 12 15-2-3-5-5-7-5-3 0-5 2-5 4 0-2-2-4-5-4-2 0-5 2-7 5z" fill="${hair}"/>`;
  return `<svg class="avatar" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="#0c1a16"/><clipPath id="av${h}"><circle cx="32" cy="32" r="30"/></clipPath><g clip-path="url(#av${h})"><path d="M8 66c0-14 8-22 24-22s24 8 24 22z" fill="${shirt}"/><path d="M26 44l6 6 6-6" fill="none" stroke="${shirt2}" stroke-width="3"/><rect x="8" y="48" width="48" height="18" fill="none"/><path d="M8 66c0-14 8-22 24-22s24 8 24 22" fill="none" stroke="${shirt2}" stroke-width="2"/><rect x="27" y="36" width="10" height="10" fill="${skin}"/><ellipse cx="32" cy="27" rx="12" ry="13" fill="${skin}"/>${hairShape}<circle cx="27.5" cy="28" r="1.4" fill="#1a1a1a"/><circle cx="36.5" cy="28" r="1.4" fill="#1a1a1a"/><path d="M28.5 34q3.5 2.5 7 0" fill="none" stroke="#7a4a30" stroke-width="1.3" stroke-linecap="round"/></g></svg>`;
}

// Trikot (Aufstellungsbrett) mit Nummer
export function shirt(num, colors, size = 46, gk = false) {
  const c1 = gk ? '#ffd166' : colors.color, c2 = gk ? '#8a6a00' : colors.color2;
  return `<svg class="shirt" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><path d="M22 8 32 12 42 8 58 16l-5 14-7-3v29H18V27l-7 3L6 16z" fill="${c1}" stroke="${c2}" stroke-width="2.5" stroke-linejoin="round"/><path d="M26 10c2 4 10 4 12 0" fill="none" stroke="${c2}" stroke-width="2.5"/><text x="32" y="43" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="22" fill="${gk ? '#2b2200' : '#fff'}" stroke="rgba(0,0,0,0.3)" stroke-width="0.5">${num}</text></svg>`;
}

// Ring-Anzeige 0–99
export function ring(v, size = 40, color = 'var(--green)') {
  const r = 16, c = 2 * Math.PI * r, p = Math.max(0, Math.min(99, v)) / 99;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="${r}" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.1)" stroke-width="3.5"/><circle cx="20" cy="20" r="${r}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 20 20)"/><text x="20" y="24.5" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="700" font-size="13" fill="#fff">${Math.round(v)}</text></svg>`;
}

// Icons (Stroke-Icons, 24er Raster)
const I = {
  home: 'M3 11 12 3l9 8v10h-6v-6H9v6H3z', squad: 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0', tactics: 'M4 4h16v16H4zM12 4v16M4 12h16', training: 'M6 12h12M4 9v6M20 9v6M8 7v10M16 7v10',
  market: 'M3 6h18l-2 9H6zM8 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', table: 'M4 5h16M4 12h16M4 19h16', press: 'M4 5h16v14H4zM8 9h8M8 13h5', quit: 'M9 5H5v14h4M13 17l5-5-5-5M18 12H9',
  goal: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4 4 3-1.5 5h-5L8 10z', card: 'M7 3h10v18H7z', injury: 'M12 3v18M3 12h18', sub: 'M7 7h10l-3-3M17 17H7l3 3', whistle: 'M14 6h5v4l-4 2-1 6a5 5 0 1 1-6-5l2-7z', trophy: 'M8 3h8v4a4 4 0 0 1-8 0zM6 5H3v2a3 3 0 0 0 3 3M18 5h3v2a3 3 0 0 1-3 3M12 11v5M8 21h8M10 16h4v5',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2z', board: 'M4 4h16v12H4zM8 20h8M12 16v4', bolt: 'M13 2 4 14h7l-1 8 9-12h-7z', star: 'm12 3 2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17l-5.6 3 1.2-6.2L3 9.5l6.3-.8z',
  pen: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm-3 8h6', clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v5l3 2', money: 'M3 7h18v10H3zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', up: 'M12 19V5M5 12l7-7 7 7', ball: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7l4 3-1.5 5h-5L8 10zM12 7V3M16 10l4-1M14.5 15l2 4M9.5 15l-2 4M8 10 4 9',
};
export function icon(name, cls = '') { return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${I[name] || I.ball}"/></svg>`; }

// Formkurve: letzte Ergebnisse als Chips
export function formChips(results) { return results.slice(-5).map(r => `<i class="fc ${r.won ? 'w' : r.draw ? 'd' : 'l'}" title="${esc(r.club)} ${r.gf}:${r.ga}">${r.won ? 'S' : r.draw ? 'U' : 'N'}</i>`).join('') || '<i class="fc n">–</i>'; }

// Netzdiagramm der fünf Werte (aktuell gefüllt, Saisonstart als Linie)
export function radar(vals, start, labels, color = '#3ddc84', size = 220) {
  const n = vals.length, c = size / 2, R = size / 2 - 30, pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [c + Math.cos(a) * R * v / 99, c + Math.sin(a) * R * v / 99]; };
  const poly = (arr) => arr.map((v, i) => pt(i, v).map(x => x.toFixed(1)).join(',')).join(' ');
  const rings = [25, 50, 75, 99].map(r => `<polygon points="${poly(Array(n).fill(r))}" fill="none" stroke="rgba(255,255,255,0.08)"/>`).join('');
  const axes = vals.map((_, i) => { const [x, y] = pt(i, 99); return `<line x1="${c}" y1="${c}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.08)"/>`; }).join('');
  const lbl = labels.map((l, i) => { const [x, y] = pt(i, 122); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="#8aa79d" font-family="JetBrains Mono, monospace">${l} ${Math.round(vals[i])}</text>`; }).join('');
  return `<svg class="radar" viewBox="-26 -6 ${size + 52} ${size + 12}" width="${size + 52}" height="${size + 12}" style="overflow:visible">${rings}${axes}${start ? `<polygon points="${poly(start)}" fill="none" stroke="rgba(255,255,255,0.45)" stroke-dasharray="3 3"/>` : ''}<polygon points="${poly(vals)}" fill="${color}33" stroke="${color}" stroke-width="2"/>${lbl}</svg>`;
}
