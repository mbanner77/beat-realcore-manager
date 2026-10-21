// Rasen-Darstellung: Spielfeld von oben, Spieler, Ball, Ereignis-Effekte
import { PW, PH, GOAL_W } from './match.js';

export class Pitch {
  constructor(canvas) { this.c = canvas; this.ctx = canvas.getContext('2d'); this.fx = []; this.t = 0; this.rot = false; this.trail = []; this.flash = 0; this.shake = 0; this.focus = null; }
  resize(w, h) { const dpr = Math.min(2, devicePixelRatio || 1); this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr); this.c.style.width = w + 'px'; this.c.style.height = h + 'px'; this.w = w; this.h = h; this.dpr = dpr; this.rot = h > w * 1.15; }
  // Weltkoordinaten (m) → Bildschirm
  layout() {
    const pad = 22, W = this.rot ? this.h : this.w, H = this.rot ? this.w : this.h;
    const s = Math.min((W - pad * 2) / PW, (H - pad * 2) / PH);
    return { s, ox: (W - PW * s) / 2, oy: (H - PH * s) / 2 };
  }
  goalFlash(team) { this.flash = 1; this.flashTeam = team; this.shake = 0.6; }
  burst(x, y, color) { for (let i = 0; i < 18; i++) { const a = Math.random() * Math.PI * 2, v = 6 + Math.random() * 14; this.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.9, max: 0.9, c: color }); } }
  draw(M, dt) {
    if (!(this.w > 4 && this.h > 4)) return; // unsichtbare oder noch nicht vermessene Fläche
    const ctx = this.ctx, L = this.layout(); this.t += dt;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.clearRect(0, 0, this.w, this.h);
    ctx.save();
    if (this.rot) { ctx.translate(this.w, 0); ctx.rotate(Math.PI / 2); }
    if (this.shake > 0) { this.shake -= dt; ctx.translate((Math.random() - 0.5) * 4 * this.shake, (Math.random() - 0.5) * 4 * this.shake); }
    const X = (x) => L.ox + x * L.s, Y = (y) => L.oy + y * L.s, s = L.s;
    // Rasen
    ctx.fillStyle = '#0d3b22'; ctx.fillRect(0, 0, this.rot ? this.h : this.w, this.rot ? this.w : this.h);
    for (let i = 0; i < 10; i++) { ctx.fillStyle = i % 2 ? '#15552f' : '#124b2a'; ctx.fillRect(X(i * PW / 10), Y(0), PW / 10 * s + 0.5, PH * s); }
    const g = ctx.createRadialGradient(X(PW / 2), Y(PH / 2), 1, X(PW / 2), Y(PH / 2), Math.max(2, Math.abs(PW * s * 0.7))); g.addColorStop(0, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0.35)'); ctx.fillStyle = g; ctx.fillRect(X(-2), Y(-2), (PW + 4) * s, (PH + 4) * s);
    // Linien
    ctx.strokeStyle = 'rgba(235,255,240,0.85)'; ctx.lineWidth = Math.max(1, s * 0.14);
    ctx.strokeRect(X(0), Y(0), PW * s, PH * s);
    ctx.beginPath(); ctx.moveTo(X(PW / 2), Y(0)); ctx.lineTo(X(PW / 2), Y(PH)); ctx.stroke();
    ctx.beginPath(); ctx.arc(X(PW / 2), Y(PH / 2), 9.15 * s, 0, Math.PI * 2); ctx.stroke();
    for (const side of [0, 1]) {
      const x0 = side ? PW : 0, d = side ? -1 : 1;
      ctx.strokeRect(X(Math.min(x0, x0 + d * 16.5)), Y(PH / 2 - 20.16), 16.5 * s, 40.32 * s);
      ctx.strokeRect(X(Math.min(x0, x0 + d * 5.5)), Y(PH / 2 - 9.16), 5.5 * s, 18.32 * s);
      ctx.beginPath(); ctx.arc(X(x0 + d * 11), Y(PH / 2), 9.15 * s, side ? Math.PI * 0.705 : -Math.PI * 0.295, side ? Math.PI * 1.295 : Math.PI * 0.295); ctx.stroke();
      ctx.fillStyle = 'rgba(235,255,240,0.85)'; ctx.beginPath(); ctx.arc(X(x0 + d * 11), Y(PH / 2), s * 0.3, 0, Math.PI * 2); ctx.fill();
      // Tor mit Netz
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(X(Math.min(x0, x0 - d * 2.2)), Y(PH / 2 - GOAL_W / 2), 2.2 * s, GOAL_W * s);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(1.5, s * 0.22); ctx.strokeRect(X(Math.min(x0, x0 - d * 2.2)), Y(PH / 2 - GOAL_W / 2), 2.2 * s, GOAL_W * s); ctx.lineWidth = Math.max(1, s * 0.14); ctx.strokeStyle = 'rgba(235,255,240,0.85)';
    }
    // Torjubel-Blitz
    if (this.flash > 0) { this.flash -= dt * 1.4; ctx.fillStyle = `rgba(255,255,255,${Math.max(0, this.flash) * 0.35})`; ctx.fillRect(X(-2), Y(-2), (PW + 4) * s, (PH + 4) * s); }
    // Spieler
    const b = M.ball;
    const sorted = [...M.players].filter(p => !p.out).sort((a, c) => a.y - c.y);
    for (const p of sorted) {
      const T = M.teams[p.team], r = s * 1.15, px = X(p.x), py = Y(p.y);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(px + r * 0.25, py + r * 0.35, r * 1.05, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      const moving = Math.hypot(p.vx, p.vy) > 0.5, bob = moving ? Math.sin(this.t * 14 + p.num) * r * 0.1 : 0;
      ctx.fillStyle = p.pos === 'TW' ? (p.team === 0 ? '#ffd166' : '#9ad0ff') : T.color; ctx.strokeStyle = p.pos === 'TW' ? '#2b2200' : T.color2; ctx.lineWidth = Math.max(1.2, s * 0.22);
      ctx.beginPath(); ctx.arc(px, py - bob, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (p.koloss) { ctx.strokeStyle = '#ff4d2e'; ctx.lineWidth = s * 0.3; ctx.beginPath(); ctx.arc(px, py - bob, r * 1.35, 0, Math.PI * 2); ctx.stroke(); }
      if (p.injured) { ctx.fillStyle = '#ff4d4d'; ctx.beginPath(); ctx.arc(px + r * 0.8, py - r * 0.9, r * 0.35, 0, Math.PI * 2); ctx.fill(); }
      if (p.yellow) { ctx.fillStyle = p.red ? '#ff3b3b' : '#ffd400'; ctx.fillRect(px - r * 1.1, py - r * 1.3, r * 0.45, r * 0.6); }
      if (s > 5.5) { ctx.fillStyle = p.pos === 'TW' ? '#1b1500' : '#fff'; ctx.font = `700 ${Math.max(7, s * 1.05)}px "Space Grotesk", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(p.num), px, py - bob + 0.5); }
      if (b.owner === p || this.focus === p) { ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(1, s * 0.16); ctx.beginPath(); ctx.arc(px, py, r * 1.55 + Math.sin(this.t * 8) * s * 0.1, 0, Math.PI * 2); ctx.stroke();
        if (s > 5) { const name = (p.nick || p.name).split(' ').slice(-1)[0]; ctx.font = `600 ${Math.max(8, s * 1.0)}px "Space Grotesk", sans-serif`; const w = ctx.measureText(name).width + s * 1.2; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(px - w / 2, py - r * 3.1, w, s * 1.5); ctx.fillStyle = '#fff'; ctx.fillText(name, px, py - r * 3.1 + s * 0.75); } }
    }
    // Ball mit Schatten und Spur
    this.trail.push({ x: b.x, y: b.y }); if (this.trail.length > 10) this.trail.shift();
    if (b.mode === 'shot' || b.mode === 'pass') { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = s * 0.25; ctx.beginPath(); this.trail.forEach((q, i) => i ? ctx.lineTo(X(q.x), Y(q.y)) : ctx.moveTo(X(q.x), Y(q.y))); ctx.stroke(); }
    const bz = b.mode === 'shot' ? Math.sin(Math.min(1, this.t % 1) * Math.PI) * 0 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(X(b.x) + s * 0.2, Y(b.y) + s * 0.3, s * 0.55, s * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#222'; ctx.lineWidth = Math.max(1, s * 0.12); ctx.beginPath(); ctx.arc(X(b.x), Y(b.y) - bz, s * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Partikel
    for (const f of this.fx) { f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 10 * dt; ctx.globalAlpha = Math.max(0, f.life / f.max); ctx.fillStyle = f.c; ctx.fillRect(X(f.x), Y(f.y), s * 0.5, s * 0.5); }
    ctx.globalAlpha = 1; this.fx = this.fx.filter(f => f.life > 0);
    ctx.restore();
  }
}
