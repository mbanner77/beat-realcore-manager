// Baut public/models/player-hd.glb: realistischer Körper (Quaternius Universal Base Characters, CC0)
// mit allen Animationen aus player.glb (gleiches Skelett) und schreibt die Dreiecke mit Zonen für die Trikot-Zonenkarte.
// Aufruf: node build-ubc.mjs <Superhero_Male_FullBody.gltf> <player.glb> <out.glb> <tris.json>
import { NodeIO } from '@gltf-transform/core';
import { prune, resample, dedup } from '@gltf-transform/functions';
import fs from 'node:fs';

const [, , SRC, ANIM, OUT, TRIS] = process.argv;
const io = new NodeIO();
const D = await io.read(SRC), R = D.getRoot(), buf = R.listBuffers()[0];
const A = await io.read(ANIM), AR = A.getRoot();
const byName = new Map(R.listNodes().map(n => [n.getName(), n]));

// Animationen übernehmen (Zuordnung über Knochennamen)
for (const anim of AR.listAnimations()) {
  const na = D.createAnimation(anim.getName());
  for (const ch of anim.listChannels()) {
    const tgt = byName.get(ch.getTargetNode()?.getName()); if (!tgt) continue;
    const s = ch.getSampler(), cp = (acc) => D.createAccessor().setType(acc.getType()).setArray(acc.getArray().slice()).setBuffer(buf);
    const ns = D.createAnimationSampler().setInput(cp(s.getInput())).setOutput(cp(s.getOutput())).setInterpolation(s.getInterpolation());
    na.addSampler(ns).addChannel(D.createAnimationChannel().setTargetNode(tgt).setTargetPath(ch.getTargetPath()).setSampler(ns));
  }
}
// Texturen werden zur Laufzeit gesetzt – aus der Datei entfernen; nur eine UV-Ebene behalten
for (const t of R.listTextures()) t.dispose();
for (const m of R.listMeshes()) for (const p of m.listPrimitives()) for (const sem of p.listSemantics()) if (/^(TEXCOORD_[1-9]|COLOR_\d)$/.test(sem)) p.setAttribute(sem, null);

// Zonen je Dreieck für den Körper: 0 Trikot, 1 Hose, 2 Stutzen, 3 Haut, 4 Schuhe, 5 Haare, 6 Abschluss, 7 Unterarm, 8 Hände
const skin = R.listSkins()[0], joints = skin.listJoints().map(j => j.getName());
const ARM = /^(upperarm|lowerarm|hand|index|middle|pinky|ring|thumb)/;
const body = R.listMeshes().find(m => /SuperHero|Retopology/i.test(m.getName()) || m.listPrimitives()[0].getAttribute('POSITION').getCount() > 3000);
const prim = body.listPrimitives()[0];
const P = prim.getAttribute('POSITION'), J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0'), UV = prim.getAttribute('TEXCOORD_0'), n = P.getCount();
let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9]; const pos = [], v = [0, 0, 0];
for (let i = 0; i < n; i++) { P.getElement(i, v); pos.push([...v]); for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], v[k]); max[k] = Math.max(max[k], v[k]); } }
const ext = max.map((m, k) => m - min[k]); const up = ext[1] > ext[2] ? 1 : 2, H = ext[up];
console.log('Höhe', H.toFixed(3), 'Achse', up, 'Ausdehnung', ext.map(e => e.toFixed(2)).join(' '));
const reg = new Uint8Array(n), jj = [0, 0, 0, 0], ww = [0, 0, 0, 0];
for (let i = 0; i < n; i++) {
  J.getElement(i, jj); W.getElement(i, ww); let bi = 0; for (let k = 1; k < 4; k++) if (ww[k] > ww[bi]) bi = k;
  const jn = joints[jj[bi]] || '', h = (pos[i][up] - min[up]) / H, ax = Math.abs(pos[i][0]) / H; let r;
  if (ARM.test(jn)) { if (/^(hand|index|middle|pinky|ring|thumb)/.test(jn)) r = 8; else if (jn.startsWith('lowerarm')) r = 7; else r = ax > 0.245 ? 7 : ax > 0.228 ? 6 : 0; }
  else if (/^(neck|Head)/.test(jn) && h > 0.80) r = h > 0.935 && pos[i][up === 1 ? 2 : 1] * (up === 1 ? 1 : -1) < 0.06 ? 5 : 3;
  else if (h > 0.815) r = 3;
  else if (h > 0.53) r = 0;
  else if (h > 0.415) r = 1;
  else if (h > 0.30) r = 3;
  else if (h > 0.282) r = 6;
  else if (h > 0.055) r = 2;
  else r = 4;
  reg[i] = r;
}
// je Punkt: Knochenklasse (0 Körper, 1 Oberarm, 2 Unterarm, 3 Hand, 4 Kopf/Hals), Höhe, Abstand zur Mitte, Vorwärts-Koordinate
const jc = new Uint8Array(n);
for (let i = 0; i < n; i++) { J.getElement(i, jj); W.getElement(i, ww); let bi = 0; for (let k = 1; k < 4; k++) if (ww[k] > ww[bi]) bi = k; const jn = joints[jj[bi]] || ''; jc[i] = /^(hand|index|middle|pinky|ring|thumb)/.test(jn) ? 3 : jn.startsWith('lowerarm') ? 2 : jn.startsWith('upperarm') ? 1 : /^(neck|Head)/.test(jn) ? 4 : 0; }
const idx = Array.from(prim.getIndices().getArray()), tris = [];
for (let t = 0; t < idx.length; t += 3) {
  const vs = [idx[t], idx[t + 1], idx[t + 2]], cs = vs.map(i => jc[i]), c = cs[0] === cs[1] || cs[0] === cs[2] ? cs[0] : cs[1] === cs[2] ? cs[1] : Math.max(...cs);
  const row = [c]; for (const i of vs) { const uv = UV.getElement(i, [0, 0]); row.push(+uv[0].toFixed(5), +uv[1].toFixed(5), +((pos[i][up] - min[up]) / H).toFixed(4), +(Math.abs(pos[i][0]) / H).toFixed(4), +(pos[i][2]).toFixed(4)); }
  tris.push(row);
}
fs.writeFileSync(TRIS, JSON.stringify(tris));
await D.transform(resample({ tolerance: 0.0015 }), dedup());
{ const used = new Set();
  for (const an of R.listAnimations()) for (const sm of an.listSamplers()) { used.add(sm.getInput()); used.add(sm.getOutput()); }
  for (const m of R.listMeshes()) for (const pr of m.listPrimitives()) { for (const se of pr.listSemantics()) used.add(pr.getAttribute(se)); if (pr.getIndices()) used.add(pr.getIndices()); }
  for (const sk of R.listSkins()) if (sk.getInverseBindMatrices()) used.add(sk.getInverseBindMatrices());
  for (const acc of R.listAccessors()) if (!used.has(acc)) acc.dispose(); }
await D.transform(prune({ keepAttributes: true }));
await io.write(OUT, D);
console.log('Meshes', R.listMeshes().map(m => m.getName()), 'Materialien', R.listMaterials().map(m => m.getName()), 'Animationen', R.listAnimations().length, 'Dreiecke', tris.length);
