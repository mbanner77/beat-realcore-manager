// Filmisches Intro: Kamerafahrt durch das Stadion (Babylon.js) mit Texttafeln – die Geschichte der Legacy League.
// Ohne WebGL läuft nur die Texttafel-Variante über dem Hintergrund.
import { PW, PH, Match } from './match.js';
import { Season } from './manager.js';
import { Pitch3D, loadBabylon, webglOk } from './pitch3d.js';

const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const lerp = (a, b, t) => a + (b - a) * t;

// Einstellungen: Dauer, Kamera von → nach, Text, Flutlicht
const SHOTS = [
  { dur: 6.0, lights: 'flicker', from: { alpha: Math.PI * 1.08, beta: 1.35, radius: 40, tx: 6, tz: PH / 2 }, to: { alpha: Math.PI * 1.02, beta: 1.3, radius: 30, tx: 10, tz: PH / 2 },
    who: 'Sportschau', text: '1998. Ein System geht in Betrieb. Es wurde nie dokumentiert – und nie wieder abgeschaltet.' },
  { dur: 6.5, lights: 1, from: { alpha: -Math.PI / 2 - 0.5, beta: 0.55, radius: 150, tx: PW / 2, tz: PH / 2 }, to: { alpha: -Math.PI / 2 + 0.25, beta: 0.7, radius: 110, tx: PW / 2, tz: PH / 2 },
    who: 'Legacy-KI', text: 'Seit 1998 ungeschlagen. Ohne Tests, ohne Doku, ohne Gnade: der Legacy-Monolith FC.', legacy: true },
  { dur: 6.5, lights: 1, from: { alpha: -Math.PI / 2, beta: 1.2, radius: 28, tx: 30, tz: PH / 2 + 8 }, to: { alpha: -Math.PI / 2 + 0.15, beta: 1.05, radius: 36, tx: 60, tz: PH / 2 },
    who: 'Lena Hoff', text: 'Ein neuer Verein fordert ihn heraus: TechHub United. Ein sauberer Kern in der Abwehr, Integration im Mittelfeld, KI im Sturm.' },
  { dur: 6.0, lights: 1, from: { alpha: Math.PI / 2 + 0.3, beta: 0.95, radius: 60, tx: PW / 2, tz: PH / 2 }, to: { alpha: Math.PI / 2 - 0.3, beta: 0.85, radius: 70, tx: PW / 2, tz: PH / 2 },
    who: 'Lena Hoff', text: 'Sieben Spieltage. Sieben Legacy-Clubs. Ein Ziel: die Legacy League – und das Finale gegen den Monolithen.' },
  { dur: 5.0, lights: 1, from: { alpha: -Math.PI / 2, beta: 0.9, radius: 90, tx: PW / 2, tz: PH / 2 }, to: { alpha: -Math.PI / 2, beta: 0.95, radius: 74, tx: PW / 2, tz: PH / 2 }, title: true },
];

export async function playIntro({ canvas, captionEl, titleEl, skipBtn, audio, voice, tr, lang, onDone }) {
  let pitch = null, M = null, done = false, raf = 0, t0 = 0, last = 0;
  const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); skipBtn.onclick = null; voice?.cancel(); try { pitch?.dispose(); } catch { /* ignore */ } onDone(); };
  skipBtn.onclick = finish;
  // Demo-Spiel: TechHub United gegen den Monolithen
  try { const se = new Season({ difficulty: 'profi', seed: 4242 }); se.day = 6; const me = se.teamForMatch(), opp = se.opponentForMatch(); M = new Match(me, opp, { seed: 99 }); M.speed = 1; } catch { M = null; }
  try { await Promise.race([voice?.ready, new Promise(r => setTimeout(r, 2500))]); } catch { /* ignore */ }
  // Dauer jeder Einstellung an die gesprochene Zeile anpassen (nichts wird abgeschnitten)
  const shots = SHOTS.map(sh => { const text = sh.title ? 'Beat RealCore – Legacy League. Saison starten!' : sh.text; const d = voice ? voice.durationOf(tr ? tr(text) : text, lang) : 0; return { ...sh, dur: Math.max(sh.dur, d ? d + 1.6 : sh.dur) }; });
  if (webglOk() && await loadBabylon()) { try { pitch = new Pitch3D(canvas, { hd: false, lite: true }); pitch.resize(canvas.clientWidth, canvas.clientHeight); pitch.setLamps(0); pitch.labels = false; } catch { pitch = null; } }
  if (pitch?.ready) await Promise.race([pitch.ready, new Promise(r => setTimeout(r, 3500))]);
  if (done) return;
  canvas.hidden = !pitch; canvas.classList.remove('ready');
  const onResize = () => { if (pitch) pitch.resize(canvas.clientWidth, canvas.clientHeight); }; window.addEventListener('resize', onResize);
  let shotIdx = -1, shotT = 0;
  const showCaption = (sh) => {
    if (sh.title) { captionEl.hidden = true; titleEl.hidden = false; titleEl.classList.add('in'); voice?.say(tr ? tr('Beat RealCore – Legacy League. Saison starten!') : 'Beat RealCore – Legacy League. Saison starten!', { lang, prio: 3, interrupt: false, rate: 0.95 }); return; }
    captionEl.hidden = false; captionEl.className = 'intro-cap in' + (sh.legacy ? ' legacy' : ''); captionEl.querySelector('b').textContent = sh.who; captionEl.querySelector('p').textContent = sh.text;
    audio?.play(sh.legacy ? 'legacy' : 'type');
    voice?.say(tr ? tr(sh.text) : sh.text, { lang, prio: 3, interrupt: false, rate: 0.96, pitch: sh.legacy ? 0.75 : 1 });
  };
  const frame = (now) => {
    if (done) return;
    if (!t0) { t0 = now; last = now; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; const T = (now - t0) / 1000;
    // aktuelle Einstellung
    let acc = 0, idx = 0; for (; idx < shots.length; idx++) { if (T < acc + shots[idx].dur) break; acc += shots[idx].dur; }
    if (idx >= shots.length) { finish(); return; }
    const sh = shots[idx]; shotT = (T - acc) / sh.dur;
    if (idx !== shotIdx) { shotIdx = idx; showCaption(sh); if (idx === shots.length - 1) audio?.play('whistle3'); }
    if (sh.title && shotT > 0.9) titleEl.classList.add('out');
    if (pitch && M) {
      const e = ease(shotT), f = sh.from, g = sh.to;
      pitch.setCine({ alpha: lerp(f.alpha, g.alpha, e), beta: lerp(f.beta, g.beta, e), radius: lerp(f.radius, g.radius, e), tx: lerp(f.tx, g.tx, e), tz: lerp(f.tz, g.tz, e), ty: 1 });
      if (sh.lights === 'flicker') { const k = Math.max(0, Math.min(1, (shotT - 0.1) / 0.45)), on = k * k * (3 - 2 * k); pitch.setLamps(on); } // Flutlicht fährt weich hoch else pitch.setLamps(1);
      if (!M.over) M.tick(dt * (idx === 0 ? 0 : 1));
      pitch.draw(M, dt); if (!canvas.classList.contains('ready')) requestAnimationFrame(() => canvas.classList.add('ready'));
    }
    // Text ausblenden gegen Ende der Einstellung
    if (!sh.title) captionEl.classList.toggle('out', shotT > 0.86);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => { window.removeEventListener('resize', onResize); finish(); };
}
