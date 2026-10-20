// Stadion-Sound (prozedural, ohne Dateien): Publikum, Pfiff, Torjubel, Oberfläche
export class Audio {
  constructor() {
    this.ctx = null; this.enabled = true; this.vol = { music: 0.5, sfx: 0.8 };
    try { const v = JSON.parse(localStorage.getItem('brcm-audio')); if (v) Object.assign(this.vol, v); if (v && v.enabled === false) this.enabled = false; } catch { /* ignore */ }
    this.crowd = null; this.level = 0; this.target = 0;
  }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = this.enabled ? 1 : 0; this.master.connect(this.ctx.destination);
    this.sfxG = this.ctx.createGain(); this.sfxG.gain.value = this.vol.sfx; this.sfxG.connect(this.master);
    this.ambG = this.ctx.createGain(); this.ambG.gain.value = 0; this.ambG.connect(this.master);
    // Publikum: gefiltertes Rauschen mit langsamer Modulation
    const n = this.ctx.createBuffer(1, this.ctx.sampleRate * 4, this.ctx.sampleRate), d = n.getChannelData(0);
    let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    const src = this.ctx.createBufferSource(); src.buffer = n; src.loop = true;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.5;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.13; const lg = this.ctx.createGain(); lg.gain.value = 0.25; lfo.connect(lg); lg.connect(this.ambG.gain); lfo.start();
    src.connect(bp); bp.connect(this.ambG); src.start(); this.crowd = src;
  }
  save() { try { localStorage.setItem('brcm-audio', JSON.stringify({ ...this.vol, enabled: this.enabled })); } catch { /* ignore */ } }
  setVolume(k, v) { this.vol[k] = v; if (k === 'sfx' && this.sfxG) this.sfxG.gain.value = v; this.save(); }
  toggle() { this.enabled = !this.enabled; if (this.master) this.master.gain.setTargetAtTime(this.enabled ? 1 : 0, this.ctx.currentTime, 0.05); this.save(); return this.enabled; }
  // Stimmung im Stadion 0…1 (Spielverlauf)
  setCrowd(level) { this.target = level; if (!this.ctx) return; this.ambG.gain.setTargetAtTime(level * 0.55 * this.vol.music, this.ctx.currentTime, 0.6); }
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
    try {
      switch (name) {
        case 'click': this.tone(900, 700, 0.05, 'square', 0.04 * v); break;
        case 'confirm': this.tone(600, 900, 0.09, 'triangle', 0.08 * v); this.tone(900, 1300, 0.12, 'triangle', 0.06 * v, 0.07); break;
        case 'deny': this.tone(200, 120, 0.18, 'sawtooth', 0.07 * v); break;
        case 'cash': this.tone(1320, 1320, 0.08, 'square', 0.04 * v); this.tone(1760, 1760, 0.14, 'square', 0.04 * v, 0.06); break;
        case 'whistle': this.tone(2600, 2500, 0.35, 'square', 0.06 * v); this.noise(0.35, 2600, 'bandpass', 8, 0.05 * v); break;
        case 'whistle3': [0, 0.25, 0.5].forEach((d, i) => { this.tone(2600, 2500, i === 2 ? 0.7 : 0.18, 'square', 0.06 * v, d); }); break;
        case 'kick': this.noise(0.08, 300, 'lowpass', 1, 0.12 * v); break;
        case 'goal': this.noise(2.5, 900, 'bandpass', 0.4, 0.45 * v); [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.5, 'triangle', 0.08 * v, i * 0.12)); break;
        case 'goal_opp': this.noise(1.6, 500, 'lowpass', 0.6, 0.25 * v); this.tone(220, 110, 0.9, 'sawtooth', 0.06 * v); break;
        case 'ooh': this.noise(0.9, 1200, 'bandpass', 0.7, 0.22 * v); break;
        case 'card': this.tone(1200, 900, 0.12, 'square', 0.05 * v); this.noise(0.3, 1500, 'bandpass', 2, 0.08 * v); break;
        case 'legacy': this.tone(110, 70, 0.4, 'sawtooth', 0.1 * v); this.noise(0.3, 2000, 'bandpass', 4, 0.08 * v); break;
        case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, f, 0.5, 'triangle', 0.11 * v, i * 0.13)); this.noise(3, 900, 'bandpass', 0.4, 0.4 * v, 0.5); break;
        case 'lose': [392, 330, 262, 196].forEach((f, i) => this.tone(f, f * 0.97, 0.55, 'sawtooth', 0.07 * v, i * 0.24)); break;
        case 'type': this.tone(1800, 1500, 0.03, 'square', 0.02 * v); break;
      }
    } catch { /* ignore */ }
  }
}
