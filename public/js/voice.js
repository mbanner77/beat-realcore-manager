// Sprecher: echte, vorproduzierte Stimmen (MP3 unter /audio/voice/<lang>/) für Intro, Lena und Legacy-KI;
// Web Speech API (Sprachausgabe des Geräts) nur als Ergänzung für den Live-Kommentar mit Spielernamen.
// Kurze Sätze, Warteschlange mit Prioritäten, keine Überlappung. Ohne Sprachausgabe im Browser bleibt alles stumm.
const PREF = {
  de: ['Anna', 'Petra', 'Google Deutsch', 'Microsoft Katja', 'Microsoft Hedda', 'Microsoft Stefan', 'Markus', 'Helena', 'Vicki'],
  en: ['Daniel', 'Samantha', 'Google UK English Male', 'Google UK English Female', 'Google US English', 'Microsoft Ryan', 'Microsoft George', 'Microsoft Zira', 'Microsoft David', 'Arthur', 'Karen'],
};
export class Voice {
  constructor(lang = 'de') {
    this.lang = lang; this.q = []; this.busy = false; this.voices = []; this.cur = null; this.lastEnd = 0;
    this.on = true; try { this.on = localStorage.getItem('brcm-voice') !== '0'; } catch { /* ignore */ }
    this.ok = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    if (this.ok) { this.load(); window.speechSynthesis.onvoiceschanged = () => this.load(); }
    this.files = {}; this.audioEl = null; this.ready = Promise.all([this.loadManifest(lang), lang !== 'de' ? this.loadManifest('de') : null]);
  }
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
    if (this.q.length >= (prio >= 2 ? 3 : 1) && !o.interrupt) { if (prio < 2) return; this.q = this.q.filter(x => x.prio >= 2); }
    const clean = String(text).replace(/[▸•]/g, '').replace(/\s+/g, ' ').trim(), lang = o.lang || this.lang;
    this.q.push({ text: clean, lang, rate: o.rate || 1.02, pitch: o.pitch || 1, prio, file: this.file(clean, lang) });
    this.pump();
  }
  pump() {
    if (this.busy || !this.q.length) return;
    const it = this.q.shift();
    if (it.file) { // echte Stimme
      const a = new Audio(it.file.src); a.preload = 'auto'; this.busy = true; this.audioEl = a; this.cur = a;
      const done = () => { if (this.cur !== a) return; this.busy = false; this.cur = null; this.audioEl = null; this.lastEnd = performance.now(); setTimeout(() => this.pump(), 150); };
      a.onended = done; a.onerror = done; a.play().catch(done); setTimeout(() => { if (this.cur === a) { try { a.pause(); } catch { /* ignore */ } done(); } }, (it.file.d + 2) * 1000);
      return;
    }
    if (!this.ok) { this.busy = false; setTimeout(() => this.pump(), 50); return; }
    const u = new SpeechSynthesisUtterance(it.text);
    const v = this.pick(it.lang); if (v) u.voice = v; u.lang = v ? v.lang : (it.lang === 'en' ? 'en-GB' : 'de-DE'); u.rate = it.rate; u.pitch = it.pitch; u.volume = 1;
    this.busy = true; this.cur = u;
    const done = () => { if (this.cur !== u) return; this.busy = false; this.cur = null; this.lastEnd = performance.now(); setTimeout(() => this.pump(), 120); };
    u.onend = done; u.onerror = done;
    try { window.speechSynthesis.speak(u); } catch { done(); }
    // Schutz: hängende Sprachausgabe (Chrome) nach 12 s freigeben
    setTimeout(() => { if (this.cur === u) { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } done(); } }, 12000);
  }
  cancel() { this.q = []; this.cur = null; this.busy = false; if (this.audioEl) { try { this.audioEl.pause(); } catch { /* ignore */ } this.audioEl = null; } try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }
  get idle() { return !this.busy && !this.q.length; }
}
