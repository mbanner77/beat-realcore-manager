// 2D-Effekte über der Oberfläche: Konfetti, Lichtstrahlen – ein Canvas, ohne Abhängigkeiten
export class Confetti {
  constructor(canvas) { this.c = canvas; this.ctx = canvas.getContext('2d'); this.p = []; this.raf = 0; this.last = 0; this.rays = 0; this.rayColor = '#3ddc84'; }
  size() { const dpr = Math.min(2, devicePixelRatio || 1); const r = this.c.getBoundingClientRect(); this.c.width = Math.round(r.width * dpr); this.c.height = Math.round(r.height * dpr); this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.w = r.width; this.h = r.height; }
  // Regen von oben (count Teile), colors: Array von Farben
  rain(count = 160, colors = ['#3ddc84', '#ffd166', '#ffffff', '#38e1ff', '#ff6a3d']) {
    this.size();
    for (let i = 0; i < count; i++) this.p.push({ x: Math.random() * this.w, y: -20 - Math.random() * this.h * 0.6, vx: (Math.random() - 0.5) * 60, vy: 80 + Math.random() * 160, w: 6 + Math.random() * 6, h: 8 + Math.random() * 10, a: Math.random() * 6, va: (Math.random() - 0.5) * 8, c: colors[Math.floor(Math.random() * colors.length)], life: 6 + Math.random() * 3 });
    this.start();
  }
  // Explosion aus einem Punkt
  burst(x, y, count = 120, colors) {
    this.size(); const cs = colors || ['#3ddc84', '#ffd166', '#ffffff', '#38e1ff'];
    for (let i = 0; i < count; i++) { const an = Math.random() * Math.PI * 2, v = 180 + Math.random() * 420; this.p.push({ x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v - 150, w: 5 + Math.random() * 5, h: 7 + Math.random() * 8, a: Math.random() * 6, va: (Math.random() - 0.5) * 12, c: cs[Math.floor(Math.random() * cs.length)], life: 3 + Math.random() * 2 }); }
    this.start();
  }
  setRays(on, color) { this.rays = on ? 1 : 0; if (color) this.rayColor = color; if (on) { this.size(); this.start(); } }
  start() { if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame((t) => this.frame(t)); } }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; this.p = []; this.rays = 0; try { this.ctx.clearRect(0, 0, this.w, this.h); } catch { /* ignore */ } }
  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    if (this.rays) { // rotierende Lichtstrahlen hinter dem Text
      ctx.save(); ctx.translate(this.w / 2, this.h / 2); ctx.rotate(now / 9000); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) { ctx.rotate(Math.PI * 2 / 14); const g = ctx.createLinearGradient(0, 0, this.w, 0); g.addColorStop(0, this.rayColor + '33'); g.addColorStop(1, this.rayColor + '00'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(this.w * 1.2, -this.w * 0.06); ctx.lineTo(this.w * 1.2, this.w * 0.06); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
    for (const q of this.p) {
      q.life -= dt; q.vy += 160 * dt; q.vx *= 0.995; q.x += q.vx * dt; q.y += q.vy * dt; q.a += q.va * dt;
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.a); ctx.globalAlpha = Math.max(0, Math.min(1, q.life)); ctx.fillStyle = q.c; ctx.fillRect(-q.w / 2, -q.h / 2, q.w, q.h * Math.abs(Math.cos(q.a * 1.7))); ctx.restore();
    }
    this.p = this.p.filter(q => q.life > 0 && q.y < this.h + 40);
    if (this.p.length || this.rays) this.raf = requestAnimationFrame((t) => this.frame(t)); else { this.raf = 0; ctx.clearRect(0, 0, this.w, this.h); }
  }
}
