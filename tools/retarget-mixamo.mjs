// Überträgt Mixamo-Animationen (Skelett „mixamorig:*“) auf das Quaternius/Unreal-Skelett des Spielermodells.
// Verfahren: Weltdrehung je Knochen relativ zur Ruhehaltung übertragen (G_t = G_s · G_s0⁻¹ · G_t0), Hüftbewegung skaliert.
// Aufruf: node retarget.mjs <ziel.glb> <ausgabe.glb> name=datei.glb[:inplace] ...
import { NodeIO } from '@gltf-transform/core';
import { quat, vec3, mat4 } from 'gl-matrix';

const MAP = { Hips: 'pelvis', Spine: 'spine_01', Spine1: 'spine_02', Spine2: 'spine_03', Neck: 'neck_01', Head: 'Head',
  LeftShoulder: 'clavicle_l', LeftArm: 'upperarm_l', LeftForeArm: 'lowerarm_l', LeftHand: 'hand_l',
  RightShoulder: 'clavicle_r', RightArm: 'upperarm_r', RightForeArm: 'lowerarm_r', RightHand: 'hand_r',
  LeftUpLeg: 'thigh_l', LeftLeg: 'calf_l', LeftFoot: 'foot_l', LeftToeBase: 'ball_l',
  RightUpLeg: 'thigh_r', RightLeg: 'calf_r', RightFoot: 'foot_r', RightToeBase: 'ball_r' };
const [, , TGT, OUT, ...SRCS] = process.argv;
const io = new NodeIO();
const T = await io.read(TGT), TR = T.getRoot(), buf = TR.listBuffers()[0];
const tByName = new Map(TR.listNodes().map(n => [n.getName(), n]));

const localMat = (n, rot, tr) => mat4.fromRotationTranslationScale(mat4.create(), rot || n.getRotation(), tr || n.getTranslation(), n.getScale());
const parentOf = (n) => n.getParentNode ? n.getParentNode() : n.listParents().find(p => p.propertyType === 'Node');
function worldMat(n, over) { const chain = []; for (let c = n; c; c = parentOf(c)) chain.unshift(c); let m = mat4.create(); for (const c of chain) { const o = over?.get(c); mat4.multiply(m, m, localMat(c, o?.r, o?.t)); } return m; }
const rotOf = (m) => { const q = quat.create(); mat4.getRotation(q, m); return quat.normalize(q, q); };

// Ziel-Ruhehaltung (Weltdrehungen) und Reihenfolge von oben nach unten
const tJoints = TR.listSkins()[0].listJoints();
const tRestW = new Map(tJoints.map(j => [j, rotOf(worldMat(j))]));
const pelvis = tByName.get('pelvis'), pelvisRestW = mat4.getTranslation(vec3.create(), worldMat(pelvis));
const depth = (n) => { let d = 0; for (let c = parentOf(n); c; c = parentOf(c)) d++; return d; };
const order = [...tJoints].sort((a, b) => depth(a) - depth(b));
const targetToSrc = new Map(Object.entries(MAP).map(([s, t]) => [t, s]));

function sampler(acc, times, comps) { const out = acc.getArray(), n = times.length; return (t) => {
  if (t <= times[0]) return Array.from(out.slice(0, comps)); if (t >= times[n - 1]) return Array.from(out.slice((n - 1) * comps, n * comps));
  let i = 1; while (times[i] < t) i++; const k = (t - times[i - 1]) / (times[i] - times[i - 1]);
  const a = out.slice((i - 1) * comps, i * comps), b = out.slice(i * comps, (i + 1) * comps);
  if (comps === 4) { const q = quat.create(); quat.slerp(q, a, b, k); return Array.from(q); } return Array.from(a).map((v, j) => v + (b[j] - v) * k); }; }

for (const spec of SRCS) {
  const [name, rest] = spec.split('='), [file, flag] = rest.split(':'), inplace = flag === 'inplace';
  const S = await io.read(file), SR = S.getRoot(), anim = SR.listAnimations()[0];
  const sByName = new Map(SR.listNodes().map(n => [n.getName().replace('mixamorig:', ''), n]));
  const chans = new Map(); let times = null;
  for (const ch of anim.listChannels()) { const n = ch.getTargetNode(), smp = ch.getSampler(), tt = Array.from(smp.getInput().getArray()); if (!times || tt.length > times.length) times = tt; chans.set(n.getName() + '|' + ch.getTargetPath(), sampler(smp.getOutput(), tt, ch.getTargetPath() === 'rotation' ? 4 : 3)); }
  const sRestW = new Map(); for (const sn of Object.keys(MAP)) { const n = sByName.get(sn); if (n) sRestW.set(sn, rotOf(worldMat(n))); }
  const hips = sByName.get('Hips'), hipsRestW = mat4.getTranslation(vec3.create(), worldMat(hips));
  const ratio = pelvisRestW[1] / hipsRestW[1];
  const outRot = new Map(order.map(j => [j, []])), outPel = [];
  for (const t of times) {
    // Quelle: lokale Werte zum Zeitpunkt t, daraus Weltdrehungen
    const over = new Map(); for (const n of SR.listNodes()) { const r = chans.get(n.getName() + '|rotation'), tr = chans.get(n.getName() + '|translation'); if (r || tr) over.set(n, { r: r ? r(t) : null, t: tr ? tr(t) : null }); }
    const sW = new Map(); for (const sn of Object.keys(MAP)) { const n = sByName.get(sn); if (n) sW.set(sn, rotOf(worldMat(n, over))); }
    const hipsW = mat4.getTranslation(vec3.create(), worldMat(hips, over));
    // Ziel von oben nach unten aufbauen
    const tW = new Map();
    for (const j of order) {
      const p = parentOf(j), pW = p && tW.has(p) ? tW.get(p) : p ? rotOf(worldMat(p)) : quat.create();
      const sn = targetToSrc.get(j.getName()); let gw;
      if (sn && sW.has(sn)) { gw = quat.create(); const inv = quat.invert(quat.create(), sRestW.get(sn)); quat.multiply(gw, sW.get(sn), inv); quat.multiply(gw, gw, tRestW.get(j)); quat.normalize(gw, gw); }
      else { gw = quat.multiply(quat.create(), pW, j.getRotation()); }
      tW.set(j, gw);
      const loc = quat.multiply(quat.create(), quat.invert(quat.create(), pW), gw); quat.normalize(loc, loc); outRot.get(j).push(...loc);
    }
    // Hüfte: Verschiebung gegenüber der Ruhehaltung, auf unsere Größe skaliert
    const d = vec3.sub(vec3.create(), hipsW, hipsRestW); vec3.scale(d, d, ratio); if (inplace) { d[0] = 0; d[2] = 0; }
    const wp = vec3.add(vec3.create(), pelvisRestW, d);
    const pInv = mat4.invert(mat4.create(), worldMat(parentOf(pelvis))); const lp = vec3.transformMat4(vec3.create(), wp, pInv); outPel.push(...lp);
  }
  const A = T.createAnimation('M_' + name), inp = T.createAccessor().setType('SCALAR').setArray(new Float32Array(times)).setBuffer(buf);
  for (const j of order) { if (!targetToSrc.has(j.getName())) continue; const s = T.createAnimationSampler().setInput(inp).setOutput(T.createAccessor().setType('VEC4').setArray(new Float32Array(outRot.get(j))).setBuffer(buf)).setInterpolation('LINEAR'); A.addSampler(s).addChannel(T.createAnimationChannel().setTargetNode(j).setTargetPath('rotation').setSampler(s)); }
  const sp = T.createAnimationSampler().setInput(inp).setOutput(T.createAccessor().setType('VEC3').setArray(new Float32Array(outPel)).setBuffer(buf)).setInterpolation('LINEAR'); A.addSampler(sp).addChannel(T.createAnimationChannel().setTargetNode(pelvis).setTargetPath('translation').setSampler(sp));
  console.log('M_' + name, times.length, 'Bilder', (times.at(-1)).toFixed(2) + ' s', 'Faktor', ratio.toFixed(3));
}
const { resample, prune } = await import('@gltf-transform/functions');
await T.transform(resample({ tolerance: 0.0015 }), prune({ keepAttributes: true }));
await io.write(OUT, T);
