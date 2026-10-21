// Baut public/models/player.glb aus den CC0-Paketen von Quaternius (Universal Animation Library 1 + 2):
// eine Figur, ausgewählte Animationen, vereinfachtes Netz, Farbzonen als UV-Koordinate (Palette 16×1 px).
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup, resample, weld, simplify } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const A_PATH = process.argv[2], B_PATH = process.argv[3], OUT = process.argv[4];
const KEEP_A = ['Idle_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Walk_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Roll', 'Dance_Loop', 'Hit_Chest', 'Idle_Talking_Loop', 'Crouch_Idle_Loop'];
const KEEP_B = ['Slide_Start', 'Slide_Loop', 'Slide_Exit', 'OverhandThrow', 'Hit_Knockback', 'Idle_No_Loop', 'Yes', 'Idle_FoldArms_Loop'];

const io = new NodeIO();
const A = await io.read(A_PATH), B = await io.read(B_PATH);
const rootA = A.getRoot(), rootB = B.getRoot();
const byName = new Map(rootA.listNodes().map(n => [n.getName(), n]));
const buf = rootA.listBuffers()[0];

// Animationen aus Paket 2 übernehmen (gleiches Skelett, Zuordnung über Knochennamen)
for (const anim of rootB.listAnimations()) {
  if (!KEEP_B.includes(anim.getName())) continue;
  const na = A.createAnimation(anim.getName());
  for (const ch of anim.listChannels()) {
    const tgt = byName.get(ch.getTargetNode()?.getName()); if (!tgt) continue;
    const s = ch.getSampler();
    const cp = (acc) => A.createAccessor().setType(acc.getType()).setArray(acc.getArray().slice()).setBuffer(buf);
    const ns = A.createAnimationSampler().setInput(cp(s.getInput())).setOutput(cp(s.getOutput())).setInterpolation(s.getInterpolation());
    na.addSampler(ns).addChannel(A.createAnimationChannel().setTargetNode(tgt).setTargetPath(ch.getTargetPath()).setSampler(ns));
  }
}
for (const anim of rootA.listAnimations()) if (!KEEP_A.includes(anim.getName()) && !KEEP_B.includes(anim.getName())) anim.dispose();

// Spuren ausdünnen: keine Fingerbewegung, keine Skalierung, Verschiebung nur für Becken/Wurzel
const FING = /^(index|middle|pinky|ring|thumb)_/;
for (const anim of rootA.listAnimations()) for (const ch of anim.listChannels()) {
  const nm = ch.getTargetNode()?.getName() || '', path = ch.getTargetPath();
  if (FING.test(nm) || path === 'scale' || (path === 'translation' && !/^(pelvis|root)$/.test(nm))) { const s = ch.getSampler(); ch.dispose(); s.dispose(); }
}
// Netz vereinfachen
await A.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.5, error: 0.002 }));

// Farbzonen: 0 Trikot, 1 Hose, 2 Stutzen, 3 Haut, 4 Schuhe, 5 Haare, 6 Abschluss (Kragen/Ärmel/Stutzenrand), 7 Unterarm, 8 Hände
const skin = rootA.listSkins()[0], joints = skin.listJoints().map(j => j.getName());
const ARM = /^(upperarm|lowerarm|hand|index|middle|pinky|ring|thumb|clavicle)/;
for (const mesh of rootA.listMeshes()) for (const prim of mesh.listPrimitives()) {
  const P = prim.getAttribute('POSITION'), J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0'), n = P.getCount();
  const pos = [], v = [0, 0, 0];
  let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (let i = 0; i < n; i++) { P.getElement(i, v); pos.push([...v]); for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], v[k]); max[k] = Math.max(max[k], v[k]); } }
  globalThis.__bounds ||= { min, max };
  const ext = max.map((m, k) => m - min[k]);
  // Hochachse = größte Ausdehnung ohne die Armspannweite: in T-Pose sind Höhe und Spannweite ähnlich, daher über die Knochen bestimmen
  const up = globalThis.__up ?? 1, side = up === 1 ? 0 : 0;
  const H = ext[up], cx = (min[side] + max[side]) / 2;
  const reg = new Uint8Array(n), jj = [0, 0, 0, 0], ww = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    J.getElement(i, jj); W.getElement(i, ww);
    let bi = 0; for (let k = 1; k < 4; k++) if (ww[k] > ww[bi]) bi = k;
    const jn = joints[jj[bi]] || '', h = (pos[i][up] - min[up]) / H, ax = Math.abs(pos[i][side] - cx) / H;
    let r;
    if (ARM.test(jn) && !jn.startsWith('clavicle')) {
      if (/^(hand|index|middle|pinky|ring|thumb)/.test(jn)) r = 8;
      else if (jn.startsWith('lowerarm')) r = 7;
      else r = ax > 0.25 ? 7 : ax > 0.232 ? 6 : 0;
    } else if (h > 0.955) r = 5;
    else if (h > 0.83) r = 3;
    else if (h > 0.53) r = 0;
    else if (h > 0.40) r = 1;
    else if (h > 0.29) r = 3;
    else if (h > 0.27) r = 6;
    else if (h > 0.055) r = 2;
    else r = 4;
    reg[i] = r;
  }
  // Zone je Dreieck (Mehrheit), Punkte an Zonengrenzen werden verdoppelt – so verlaufen keine Farben
  const idx = prim.getIndices(), ia = Array.from(idx.getArray()), sem = prim.listSemantics().filter(x => x !== 'TEXCOORD_0' && x !== 'TEXCOORD_1');
  const src = Object.fromEntries(sem.map(x => [x, prim.getAttribute(x)])), out = Object.fromEntries(sem.map(x => [x, []])), outR = [], key = new Map();
  const vtx = (v, r) => { const k = v * 16 + r; if (key.has(k)) return key.get(k); const ni = outR.length; key.set(k, ni); outR.push(r); for (const x of sem) out[x].push(src[x].getElement(v, [])); return ni; };
  const nIdx = [];
  for (let t = 0; t < ia.length; t += 3) {
    const rs = [reg[ia[t]], reg[ia[t + 1]], reg[ia[t + 2]]]; const r = rs[0] === rs[1] || rs[0] === rs[2] ? rs[0] : rs[1] === rs[2] ? rs[1] : Math.min(...rs);
    for (let q = 0; q < 3; q++) nIdx.push(vtx(ia[t + q], r));
  }
  for (const x of sem) { const a0 = src[x], C = a0.getArray().constructor, flat = new C(out[x].length * a0.getElementSize()); out[x].forEach((e, i) => flat.set(e, i * a0.getElementSize())); prim.setAttribute(x, A.createAccessor().setType(a0.getType()).setArray(flat).setNormalized(a0.getNormalized()).setBuffer(buf)); }
  const uv = new Float32Array(outR.length * 2); outR.forEach((r, i) => { uv[i * 2] = (r + 0.5) / 16; uv[i * 2 + 1] = 0.5; });
  prim.setIndices(A.createAccessor().setType('SCALAR').setArray(new Uint16Array(nIdx)).setBuffer(buf));
  prim.setAttribute('TEXCOORD_0', A.createAccessor().setType('VEC2').setArray(uv).setBuffer(buf));
  prim.setAttribute('TEXCOORD_1', null);
}
await A.transform(resample({ tolerance: 0.0015 }), dedup());
// verwaiste Daten entfernen (Accessoren ohne Verwendung)
{ const used = new Set();
  for (const an of rootA.listAnimations()) for (const sm of an.listSamplers()) { used.add(sm.getInput()); used.add(sm.getOutput()); }
  for (const m of rootA.listMeshes()) for (const pr of m.listPrimitives()) { for (const se of pr.listSemantics()) used.add(pr.getAttribute(se)); if (pr.getIndices()) used.add(pr.getIndices()); for (const t of pr.listTargets()) for (const se of t.listSemantics()) used.add(t.getAttribute(se)); }
  for (const sk of rootA.listSkins()) if (sk.getInverseBindMatrices()) used.add(sk.getInverseBindMatrices());
  for (const acc of rootA.listAccessors()) if (!used.has(acc)) acc.dispose(); }
await A.transform(prune({ keepAttributes: true }));
await io.write(OUT, A);
console.log('anims', rootA.listAnimations().map(a => a.getName()).join(', '));
console.log('bounds', globalThis.__bounds);
