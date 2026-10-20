// Mehrsprachigkeit: Deutsch ist die Originalsprache, Englisch wird zur Laufzeit übersetzt.
// Übersetzt Texte im DOM (inkl. später eingefügter Inhalte), Canvas-Beschriftungen und Sprachansagen.
import EN from './i18n-en.js';

function detect() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'de' || q === 'en') { localStorage.setItem('brc-lang', q); return q; }
    const s = localStorage.getItem('brc-lang'); if (s === 'de' || s === 'en') return s;
  } catch { /* ignore */ }
  const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'de';
  return /^de\b/i.test(nav) ? 'de' : 'en';
}
export const LANG = typeof window === 'undefined' ? 'de' : detect();
export const isEN = LANG === 'en';
export function setLang(l) { try { localStorage.setItem('brc-lang', l); } catch { /* ignore */ } location.reload(); }

// Exakte Treffer und Muster mit Platzhaltern {0} … (Platzhalter werden selbst rekursiv übersetzt)
const EXACT = new Map(), PATS = [];
for (const [k, v] of Object.entries(EN)) {
  if (/\{\d\}/.test(k)) {
    const esc = k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{(\d)\\?\}/g, '(.+?)');
    const order = [...k.matchAll(/\{(\d)\}/g)].map(m => +m[1]);
    PATS.push({ re: new RegExp('^' + esc + '$', 's'), order, v, n: k.length });
  } else EXACT.set(k, v);
}
PATS.sort((a, b) => b.n - a.n); // spezifischere (längere) Muster zuerst
const cache = new Map();

export function tr(s) {
  if (!isEN || s == null) return s;
  s = String(s);
  const hit = cache.get(s); if (hit !== undefined) return hit;
  let out = s;
  const m0 = s.match(/^(\s*)([\s\S]*?)(\s*)$/), core = m0[2];
  if (core && /[A-Za-zÄÖÜäöüß]{2}/.test(core)) {
    let t = EXACT.get(core);
    if (t === undefined) {
      for (const p of PATS) {
        const m = core.match(p.re); if (!m) continue;
        t = p.v.replace(/\{(\d)\}/g, (_, i) => { const idx = p.order.indexOf(+i); return idx < 0 ? '' : tr(m[idx + 1]); });
        break;
      }
    }
    if (t === undefined) { // gekürzte Varianten (ohne Schlusspunkt / Ausrufezeichen)
      for (const end of ['.', '!']) { const x = EXACT.get(core + end); if (x !== undefined) { t = x.replace(/[.!]$/, ''); break; } }
      if (t === undefined && /[.!]$/.test(core)) { const x = EXACT.get(core.slice(0, -1)); if (x !== undefined) t = x + core.slice(-1); }
    }
    if (t !== undefined) out = m0[1] + t + m0[3];
  }
  if (cache.size > 6000) cache.clear();
  cache.set(s, out);
  return out;
}

// ---------- DOM ----------
const ATTRS = ['placeholder', 'title', 'aria-label', 'data-k', 'alt'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE']);
function trText(node) {
  const p = node.parentNode; if (!p || SKIP.has(p.nodeName) || (p.closest && p.closest('[data-nt]'))) return;
  const v = node.nodeValue, t = tr(v); if (t !== v) node.nodeValue = t;
}
function trEl(el) {
  if (el.nodeType === 3) { trText(el); return; }
  if (el.nodeType !== 1 || el.hasAttribute('data-nt')) return;
  for (const a of ATTRS) { const v = el.getAttribute(a); if (v) { const t = tr(v); if (t !== v) el.setAttribute(a, t); } }
  if (SKIP.has(el.nodeName)) return;
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n; while ((n = w.nextNode())) {
    if (n.nodeType === 3) trText(n);
    else for (const a of ATTRS) { const v = n.getAttribute(a); if (v) { const t = tr(v); if (t !== v) n.setAttribute(a, t); } }
  }
}
export function initI18n() {
  if (!isEN) return;
  document.documentElement.lang = 'en';
  document.title = tr(document.title);
  trEl(document.body);
  const mo = new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'characterData') trText(m.target);
      else if (m.type === 'attributes') { const v = m.target.getAttribute(m.attributeName); if (v) { const t = tr(v); if (t !== v) m.target.setAttribute(m.attributeName, t); } }
      else for (const n of m.addedNodes) trEl(n);
    }
  });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
