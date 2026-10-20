// Saisonende: Meisterfeier (Feuerwerk, Jubel, Pokal) oder stille Abschlusszene – auf dem 3D-Rasen, mit Sprecher.
import { PW, PH, Match } from './match.js';
import { Pitch3D, loadBabylon, webglOk } from './pitch3d.js';

const lerp = (a, b, t) => a + (b - a) * t;

export async function playCeremony({ canvas, season, rank, won, name, pitchEl, audio, voice, tr, lang, onDone, nextBtn }) {
  let pitch = null, M = null, done = false, raf = 0, t0 = 0, last = 0;
  const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); if (nextBtn) nextBtn.onclick = null; voice?.cancel(); try { pitch?.dispose(); } catch { /* ignore */ } onDone(); };
  if (nextBtn) nextBtn.onclick = finish;
  try {
    const d0 = season.day; season.day = Math.min(season.day, 6); const me = season.teamForMatch(), opp = season.opponentForMatch(); season.day = d0;
    if (opp) { M = new Match(me, opp, { seed: 7 }); M.paused = true; M.freeze = 9999;
      // eigene Spieler in den Mittelkreis, Gegner an den Rand
      const mine = M.players.filter(p => p.team === 0), theirs = M.players.filter(p => p.team === 1);
      mine.forEach((p, i) => { const a = i / mine.length * Math.PI * 2; p.x = PW / 2 + Math.cos(a) * 6; p.y = PH / 2 + Math.sin(a) * 5; p.vx = p.vy = 0; });
      theirs.forEach((p, i) => { p.x = 8 + i * 8; p.y = PH - 4; p.vx = p.vy = 0; });
      M.ball.x = PW / 2; M.ball.y = PH / 2; M.ball.owner = null; M.ball.mode = 'loose'; M.ball.vx = M.ball.vy = 0;
    }
  } catch { M = null; }
  if (webglOk() && await loadBabylon()) { try { pitch = new Pitch3D(canvas); pitch.resize(canvas.clientWidth, canvas.clientHeight); pitch.setDaylight(false); pitch.labels = false; } catch { pitch = null; } }
  if (done) return;
  canvas.hidden = !pitch;
  const onResize = () => { if (pitch) pitch.resize(canvas.clientWidth, canvas.clientHeight); }; window.addEventListener('resize', onResize);
  if (pitch) { pitch.setMood(won ? 0 : rank <= 3 ? 0 : null, 60000); pitch.setFireworks(won); pitch.setLamps(won ? 1 : 0.6); }
  const line = won ? `Meister der Legacy League! ${name} und TechHub United haben den Monolithen gestürzt. Clean Core gewinnt Meisterschaften!`
    : rank <= 3 ? `Saisonende. Platz ${rank} für TechHub United – stark gespielt, aber die Legacy-IT bleibt vorn. Nächste Saison holen wir den Titel.`
    : `Saisonende. Platz ${rank}. Die Legacy-KI hat diese Saison gewonnen – never touch a running system. Revanche?`;
  setTimeout(() => voice?.say(tr ? tr(line) : line, { lang, prio: 3, interrupt: true, rate: 0.98, pitch: won ? 1.05 : rank <= 3 ? 1 : 0.8 }), 900);
  audio?.play(won ? 'win' : rank <= 3 ? 'whistle3' : 'lose');
  const DUR = won ? 16 : 9;
  const frame = (now) => {
    if (done) return;
    if (!t0) { t0 = now; last = now; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; const T = (now - t0) / 1000;
    if (T > DUR) { finish(); return; }
    if (pitch && M) {
      const e = Math.min(1, T / DUR);
      pitch.setCine({ alpha: -Math.PI / 2 + T * (won ? 0.22 : 0.1), beta: won ? lerp(1.15, 0.95, e) : lerp(1.0, 1.2, e), radius: won ? lerp(34, 46, e) : lerp(60, 40, e), tx: PW / 2, tz: PH / 2 - (won ? 9 : 6), ty: 1.2 });
      pitch.draw(M, dt);
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => { window.removeEventListener('resize', onResize); finish(); };
}
