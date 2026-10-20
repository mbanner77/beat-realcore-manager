// Sprecher: Web Speech API (Sprachausgabe des Geräts) für Intro und Spielkommentar, DE und EN.
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
  }
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
    if (!this.ok || !this.on || !text) return;
    const prio = o.prio ?? 1;
    if (o.interrupt) this.cancel();
    if (this.q.length >= (prio >= 2 ? 3 : 1) && !o.interrupt) { if (prio < 2) return; this.q = this.q.filter(x => x.prio >= 2); }
    this.q.push({ text: String(text).replace(/[▸•]/g, '').replace(/\s+/g, ' ').trim(), lang: o.lang || this.lang, rate: o.rate || 1.02, pitch: o.pitch || 1, prio });
    this.pump();
  }
  pump() {
    if (this.busy || !this.q.length) return;
    const it = this.q.shift(); const u = new SpeechSynthesisUtterance(it.text);
    const v = this.pick(it.lang); if (v) u.voice = v; u.lang = v ? v.lang : (it.lang === 'en' ? 'en-GB' : 'de-DE'); u.rate = it.rate; u.pitch = it.pitch; u.volume = 1;
    this.busy = true; this.cur = u;
    const done = () => { if (this.cur !== u) return; this.busy = false; this.cur = null; this.lastEnd = performance.now(); setTimeout(() => this.pump(), 120); };
    u.onend = done; u.onerror = done;
    try { window.speechSynthesis.speak(u); } catch { done(); }
    // Schutz: hängende Sprachausgabe (Chrome) nach 12 s freigeben
    setTimeout(() => { if (this.cur === u) { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } done(); } }, 12000);
  }
  cancel() { this.q = []; this.cur = null; this.busy = false; try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }
  get idle() { return !this.busy && !this.q.length; }
}
