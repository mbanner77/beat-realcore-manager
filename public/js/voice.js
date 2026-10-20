// Sprecher: echte, vorproduzierte Stimmen (MP3 unter /audio/voice/<lang>/) für Intro, Lena und Legacy-KI;
// Web Speech API (Sprachausgabe des Geräts) nur als Ergänzung für den Live-Kommentar mit Spielernamen.
// Kurze Sätze, Warteschlange mit Prioritäten, keine Überlappung. Ohne Sprachausgabe im Browser bleibt alles stumm.
const PREF = {
  de: ['Anna', 'Petra', 'Google Deutsch', 'Microsoft Katja', 'Microsoft Hedda', 'Microsoft Stefan', 'Markus', 'Helena', 'Vicki'],
  en: ['Daniel', 'Samantha', 'Google UK English Male', 'Google UK English Female', 'Google US English', 'Microsoft Ryan', 'Microsoft George', 'Microsoft Zira', 'Microsoft David', 'Arthur', 'Karen'],
};
// Aussprachehilfen für die Sprachausgabe des Geräts (nur gesprochen, nie angezeigt): englische Namen in deutscher Lautschrift
const SPOKEN_DE = [
  [/Firewall/g, 'Feierwoll'], [/Gateway/g, 'Gehtwäi'], [/Joule/g, 'Dschuhl'], [/Max Mech/g, 'Max Meck'], [/Kyma/g, 'Kima'], [/Ops-Center/g, 'Opps-Senter'], [/Service-Center/g, 'Sörwis-Senter'],
  [/Pipeline/g, 'Peiplein'], [/Clean-Core/g, 'Klien-Kohr'], [/Clean Core/g, 'Klien Kohr'], [/\bBTP\b/g, 'Beh-Teh-Peh'], [/\bCPI\b/g, 'Zeh-Peh-Ih'], [/\bABAP\b/g, 'Abapp'], [/AI4BIZ/g, 'Äi for Biss'],
  [/Mainframe/g, 'Mehnfrehm'], [/COBOL/g, 'Kobol'], [/Legacy/g, 'Leggessi'], [/TechHub/g, 'Teck-Hab'], [/Excel/g, 'Exel'], [/Interface/g, 'Interfeis'], [/Monolith FC/g, 'Monolieth Eff-Zeh'],
  [/Kickers/g, 'Kickers'], [/Spaghetti/g, 'Spagetti'], [/Security-Analyst/g, 'Sikjuriti-Analüst'], [/Security/g, 'Sikjuriti'], [/Hypercare/g, 'Heiper-Kähr'], [/Rollout/g, 'Rollaut'], [/Terraform/g, 'Terraform'],
  [/Kubernetes/g, 'Kubernetes'], [/Native/g, 'Nehtiv'], [/OAuth/g, 'O-Auth'], [/Monitoring/g, 'Monitoring'], [/Low-Code/g, 'Lo-Kohd'], [/Yaml/g, 'Jammel'], [/Quantum/g, 'Kwantum'], [/Datasphere/g, 'Dätasfir'],
  [/Governance/g, 'Gawwernens'], [/Integration/g, 'Integration'], [/Timeout/g, 'Teim-aut'], [/Flat-File/g, 'Flätt-Feil'], [/Mapping/g, 'Mäpping'], [/Middleware/g, 'Middelwähr'], [/IDoc/g, 'Ei-Dock'], [/P2P/g, 'Peh-zu-Peh'],
  [/Incident/g, 'Inzident'], [/Reopen/g, 'Ri-open'], [/Deadline/g, 'Dädlein'], [/Hotline/g, 'Hottlein'], [/Never-Touch/g, 'Näwwer-Tatsch'], [/Running-System/g, 'Ranning-Sistem'], [/Uptime/g, 'App-Teim'], [/Root/g, 'Ruht'], [/Kernel/g, 'Körnel'], [/Dump/g, 'Damp'], [/Telex/g, 'Telex'],
];
export class Voice {
  constructor(lang = 'de') {
    this.lang = lang; this.q = []; this.busy = false; this.voices = []; this.cur = null; this.lastEnd = 0;
    this.on = true; try { this.on = localStorage.getItem('brcm-voice') !== '0'; } catch { /* ignore */ }
    this.ok = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    if (this.ok) { this.load(); window.speechSynthesis.onvoiceschanged = () => this.load(); }
    this.files = {}; this.audioEl = null; this.frags = {}; this.bufs = new Map(); this.getCtx = null;
    this.ready = Promise.all([this.loadManifest(lang), lang !== 'de' ? this.loadManifest('de') : null, this.loadFrags(lang)]);
  }
  async loadFrags(lang) { try { const r = await fetch(`/audio/voice/${lang}/c/manifest.json`); if (r.ok) this.frags[lang] = await r.json(); } catch { /* ohne Teilstücke */ } }
  // Teilstück (Satzteil, Name, Zahl) laden und dekodieren – zwischengespeichert
  buf(lang, key) {
    const m = this.frags[lang], e = m && m[key], ctx = this.getCtx?.(); if (!e || !ctx) return null;
    const url = `/audio/voice/${lang}/c/${e.f}`; let pr = this.bufs.get(url);
    if (!pr) { pr = fetch(url).then(r => r.arrayBuffer()).then(a => ctx.decodeAudioData(a)).catch(() => null); this.bufs.set(url, pr); }
    return pr;
  }
  // Vorlage + Werte in Teilstücke übersetzen; null, wenn etwas fehlt
  parts(tpl, vals, lang) {
    const m = this.frags[lang]; if (!m || !tpl) return null; const out = [];
    const re = /\{(p2|t2|p|t|k|s|n|a|b|pc|sh)\}/g; let i = 0, x;
    const pushText = (raw) => { const lead = /^\s*[–,:;.!?…]/.test(raw) ? 0.16 : 0; const c = raw.replace(/^[\s–,:;.!?…]+/, '').trim(); if (!c || !/[A-Za-zÄÖÜäöüß]/.test(c)) { if (out.length && /[.!?]/.test(raw)) out[out.length - 1].after = Math.max(out[out.length - 1].after, 0.22); else if (out.length && /[–,:;]/.test(raw)) out[out.length - 1].after = Math.max(out[out.length - 1].after, 0.12); return true; } const k = 'f:' + c; if (!m[k]) return false; if (lead && out.length) out[out.length - 1].after = Math.max(out[out.length - 1].after, lead); out.push({ key: k, after: /[.!?…]$/.test(c) ? 0.24 : /[,;:–]$/.test(c) ? 0.12 : 0.04 }); return true; };
    while ((x = re.exec(tpl))) {
      if (x.index > i && !pushText(tpl.slice(i, x.index))) return null;
      const v = vals[x[1]]; if (v === undefined || v === null || v === '') return null;
      const k = typeof v === 'number' ? 'z:' + Math.max(0, Math.min(130, Math.round(v))) : 'n:' + v; if (!m[k]) return null; out.push({ key: k, after: 0.05 });
      i = x.index + x[0].length;
    }
    if (i < tpl.length && !pushText(tpl.slice(i))) return null;
    return out;
  }
  // Kommentar aus Teilstücken sprechen; ohne Teilstücke: Gerätestimme mit fallback-Text
  sayTpl(tpl, vals, text, o = {}) {
    const lang = o.lang || this.lang, ps = this.parts(tpl, vals, lang);
    if (!ps || !this.getCtx?.()) { this.say(text, o); return; }
    if (!this.on) return;
    const prio = o.prio ?? 1;
    if (o.interrupt) this.cancel();
    if (this.q.length >= (prio >= 2 ? 3 : 2) && !o.interrupt) { if (prio < 2) return; this.q = this.q.filter(x => x.prio >= 2); }
    for (const p of ps) this.buf(lang, p.key); // vorladen
    this.q.push({ text, lang, prio, parts: ps }); this.pump();
  }
  prefetch(keys, lang = this.lang) { for (const k of keys) this.buf(lang, k); }
  prefetchFragments(lang = this.lang) { const m = this.frags[lang]; if (m) for (const k of Object.keys(m)) if (k.startsWith('f:')) this.buf(lang, k); }
  async loadManifest(lang) { try { const r = await fetch(`/audio/voice/${lang}/manifest.json`); if (r.ok) this.files[lang] = await r.json(); } catch { /* ohne Dateien */ } }
  file(text, lang) { const m = this.files[lang]; if (!m) return null; const e = m[text] || m[String(text).replace(/\s+/g, ' ').trim()]; return e ? { src: `/audio/voice/${lang}/${e.f}`, d: e.d } : null; }
  // Dauer einer vorproduzierten Zeile in Sekunden (0, wenn keine Datei)
  durationOf(text, lang = this.lang) { const f = this.file(text, lang); return f ? f.d : 0; }
  load() { try { this.voices = window.speechSynthesis.getVoices() || []; } catch { this.voices = []; } }
  setOn(v) { this.on = v; try { localStorage.setItem('brcm-voice', v ? '1' : '0'); } catch { /* ignore */ } if (!v) this.cancel(); }
  pick(lang) {
    const l = lang === 'en' ? 'en' : 'de', vs = this.voices.filter(v => (v.lang || '').toLowerCase().startsWith(l));
    if (!vs.length) return null;
    for (const n of PREF[l]) { const v = vs.find(x => x.name === n || x.name.startsWith(n)); if (v) return v; }
    return vs.find(v => v.localService) || vs[0];
  }
  // prio: 0 Füller, 1 normal, 2 wichtig (Tor, Karte), 3 Intro (unterbricht)
  say(text, o = {}) {
    if (!this.on || !text) return;
    const prio = o.prio ?? 1;
    if (o.interrupt) this.cancel();
    if (this.q.length >= (prio >= 2 ? 3 : 2) && !o.interrupt) { if (prio < 2) return; this.q = this.q.filter(x => x.prio >= 2); }
    const clean = String(text).replace(/[▸•]/g, '').replace(/\s+/g, ' ').trim(), lang = o.lang || this.lang;
    this.q.push({ text: clean, lang, rate: o.rate || 1.02, pitch: o.pitch || 1, prio, file: this.file(clean, lang) });
    this.pump();
  }
  pump() {
    if (this.busy || !this.q.length) return;
    const it = this.q.shift();
    if (it.parts) { // zusammengesetzter Kommentar (Web Audio, nahtlos geplant)
      const ctx = this.getCtx(); this.busy = true; const token = {}; this.cur = token;
      const done = () => { if (this.cur !== token) return; this.busy = false; this.cur = null; this.lastEnd = performance.now(); this.onLine?.(null); setTimeout(() => this.pump(), 150); };
      Promise.race([Promise.all(it.parts.map(p => this.buf(it.lang, p.key))), new Promise(r => setTimeout(() => r(null), 2500))]).then(bs => {
        if (this.cur !== token) return;
        if (!bs || bs.some(b => !b)) { this.busy = false; this.cur = null; this.q.unshift({ text: it.text, lang: it.lang, rate: 1.02, pitch: 1, prio: it.prio }); this.pump(); return; }
        const g = ctx.createGain(); g.gain.value = 1; g.connect(ctx.destination); this.gainNode = g; this.srcs = [];
        let t = ctx.currentTime + 0.03; const t0 = t;
        bs.forEach((b, i) => { const s = ctx.createBufferSource(); s.buffer = b; s.connect(g); s.start(t); this.srcs.push(s); t += b.duration + it.parts[i].after; });
        const total = t - t0; this.onLine?.(it.text, total * 1000);
        setTimeout(done, total * 1000 + 60);
      });
      return;
    }
    if (it.file) { // echte Stimme
      const a = new Audio(it.file.src); a.preload = 'auto'; this.busy = true; this.audioEl = a; this.cur = a; this.onLine?.(it.text, it.file.d * 1000);
      const done = () => { if (this.cur !== a) return; this.busy = false; this.cur = null; this.audioEl = null; this.lastEnd = performance.now(); this.onLine?.(null); setTimeout(() => this.pump(), 150); };
      a.onended = done; a.onerror = done; a.play().catch(done); setTimeout(() => { if (this.cur === a) { try { a.pause(); } catch { /* ignore */ } done(); } }, (it.file.d + 2) * 1000);
      return;
    }
    if (!this.ok) { this.busy = false; setTimeout(() => this.pump(), 50); return; }
    let spoken = it.text; if (it.lang !== 'en') for (const [a, b] of SPOKEN_DE) spoken = spoken.replace(a, b);
    const u = new SpeechSynthesisUtterance(spoken);
    const v = this.pick(it.lang); if (v) u.voice = v; u.lang = v ? v.lang : (it.lang === 'en' ? 'en-GB' : 'de-DE'); u.rate = it.rate; u.pitch = it.pitch; u.volume = 1;
    this.busy = true; this.cur = u; this.onLine?.(it.text, Math.min(12000, 1500 + it.text.length * 65));
    const done = () => { if (this.cur !== u) return; this.busy = false; this.cur = null; this.lastEnd = performance.now(); this.onLine?.(null); setTimeout(() => this.pump(), 120); };
    u.onend = done; u.onerror = done;
    try { window.speechSynthesis.speak(u); } catch { done(); }
    // Schutz: hängende Sprachausgabe (Chrome) nach 12 s freigeben
    setTimeout(() => { if (this.cur === u) { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } done(); } }, 12000);
  }
  cancel() { this.q = []; this.cur = null; this.busy = false; this.onLine?.(null); if (this.srcs) { for (const s of this.srcs) { try { s.stop(); } catch { /* ignore */ } } this.srcs = null; } if (this.audioEl) { try { this.audioEl.pause(); } catch { /* ignore */ } this.audioEl = null; } try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }
  get idle() { return !this.busy && !this.q.length; }
}
