// Stadion-Sound (prozedural, ohne Dateien): Pfiffe, Torjubel, Reaktionen, Oberfläche.
// Bewusst ohne Dauer-Rauschen: das Publikum ist nur bei Ereignissen zu hören (kurze, weiche Anschwellungen).
export class Audio {
  constructor() {
    this.ctx = null; this.enabled = true; this.vol = { music: 0.5, sfx: 0.8 };
    try { const v = JSON.parse(localStorage.getItem('brcm-audio')); if (v) Object.assign(this.vol, v); if (v && v.enabled === false) this.enabled = false; } catch { /* ignore */ }
    this.level = 0;
  }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = this.enabled ? 1 : 0; this.master.connect(this.ctx.destination);
    this.sfxG = this.ctx.createGain(); this.sfxG.gain.value = this.vol.sfx; this.sfxG.connect(this.master);
    this.crowdG = this.ctx.createGain(); this.crowdG.gain.value = this.vol.music; this.crowdG.connect(this.master);
    // weiches Publikums-Rauschen als Quelle für Reaktionen (nur über Hüllkurven hörbar)
    const n = this.ctx.createBuffer(2, this.ctx.sampleRate * 3, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = n.getChannelData(c); let l1 = 0, l2 = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; l1 = (l1 + 0.04 * w) / 1.04; l2 = (l2 + 0.3 * l1) / 1.3; d[i] = l2 * 6; } }
    this.crowdBuf = n;
  }
  save() { try { localStorage.setItem('brcm-audio', JSON.stringify({ ...this.vol, enabled: this.enabled })); } catch { /* ignore */ } }
  setVolume(k, v) { this.vol[k] = v; if (k === 'sfx' && this.sfxG) this.sfxG.gain.value = v; if (k === 'music' && this.crowdG) this.crowdG.gain.value = v; this.save(); }
  toggle() { this.enabled = !this.enabled; if (this.master) this.master.gain.setTargetAtTime(this.enabled ? 1 : 0, this.ctx.currentTime, 0.05); this.save(); return this.enabled; }
  // Stimmung im Stadion 0…1 – beeinflusst nur noch die Lautstärke der Reaktionen (kein Dauerton)
  setCrowd(level) { this.level = level; }
  // Publikumsreaktion: weiche Hüllkurve (Anschwellen, Halten, Abklingen) über gefiltertes Rauschen
  swell(vol, attack, hold, release, f = 900, q = 0.6, delay = 0) {
    const c = this.ctx; if (!c || !this.crowdBuf) return; const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.crowdBuf; s.loop = true; s.playbackRate.value = 0.9 + Math.random() * 0.2;
    const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + attack); g.gain.setValueAtTime(Math.max(0.001, vol), t + attack + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    s.connect(fl); fl.connect(g); g.connect(this.crowdG); s.start(t); s.stop(t + attack + hold + release + 0.1);
  }
  tone(f0, f1, dur, type = 'sine', vol = 0.1, delay = 0, curve = 0.02) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + curve); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxG); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, f, type = 'bandpass', q = 1, vol = 0.1, delay = 0) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + delay, n = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(); s.buffer = n; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = vol;
    s.connect(fl); fl.connect(g); g.connect(this.sfxG); s.start(t);
  }
  play(name, v = 1) {
    if (!this.ctx || !this.enabled) return;
    const lv = 0.5 + this.level * 0.5;
    try {
      switch (name) {
        case 'click': this.tone(900, 700, 0.05, 'square', 0.04 * v); break;
        case 'confirm': this.tone(600, 900, 0.09, 'triangle', 0.08 * v); this.tone(900, 1300, 0.12, 'triangle', 0.06 * v, 0.07); break;
        case 'deny': this.tone(200, 120, 0.18, 'sawtooth', 0.07 * v); break;
        case 'cash': this.tone(1320, 1320, 0.08, 'square', 0.04 * v); this.tone(1760, 1760, 0.14, 'square', 0.04 * v, 0.06); break;
        case 'whistle': this.tone(2600, 2500, 0.35, 'square', 0.05 * v); this.swell(0.25 * lv, 0.4, 0.3, 1.2, 800); break;
        case 'whistle3': [0, 0.25, 0.5].forEach((d, i) => { this.tone(2600, 2500, i === 2 ? 0.7 : 0.18, 'square', 0.05 * v, d); }); this.swell(0.35 * lv, 0.6, 1.0, 2.0, 700, 0.5, 0.5); break;
        case 'kick': this.noise(0.08, 300, 'lowpass', 1, 0.12 * v); break;
        // Torjubel: anschwellender Jubel plus kleine Fanfare
        case 'goal': this.swell(0.9 * lv, 0.25, 1.4, 2.2, 1000, 0.5); this.swell(0.5 * lv, 0.3, 1.0, 1.8, 400, 0.7, 0.1); [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.45, 'triangle', 0.06 * v, 0.3 + i * 0.12)); break;
        // Gegentor: kurzes Raunen, dann Stille
        case 'goal_opp': this.swell(0.35 * lv, 0.15, 0.3, 1.4, 500, 0.8); this.tone(220, 110, 0.9, 'sawtooth', 0.04 * v); break;
        case 'ooh': this.swell(0.4 * lv * v, 0.12, 0.2, 0.9, 1100, 0.7); break;
        case 'chance': this.swell(0.3 * lv, 0.3, 0.3, 0.8, 900, 0.6); break;
        case 'card': this.tone(1200, 900, 0.12, 'square', 0.05 * v); this.swell(0.25 * lv, 0.1, 0.3, 1.0, 1300, 0.8); break;
        case 'legacy': this.tone(110, 70, 0.4, 'sawtooth', 0.1 * v); this.noise(0.3, 2000, 'bandpass', 4, 0.08 * v); break;
        case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, f, 0.5, 'triangle', 0.11 * v, i * 0.13)); this.swell(0.8 * lv, 0.5, 2.0, 3.0, 900, 0.5, 0.4); break;
        case 'lose': [392, 330, 262, 196].forEach((f, i) => this.tone(f, f * 0.97, 0.55, 'sawtooth', 0.07 * v, i * 0.24)); break;
        case 'type': this.tone(1800, 1500, 0.03, 'square', 0.02 * v); break;
      }
    } catch { /* ignore */ }
  }
}
