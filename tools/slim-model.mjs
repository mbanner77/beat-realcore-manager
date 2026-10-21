// Entfernt ungenutzte Animationen und dünnt Schlüsselbilder aus
import { NodeIO } from '@gltf-transform/core'; import { resample, prune } from '@gltf-transform/functions';
const KEEP = new Set(['Idle_Loop', 'Walk_Loop', 'Sprint_Loop', 'Jog_Fwd_Loop', 'Idle_No_Loop', 'Crouch_Idle_Loop']);
const [, , IN, OUT, TOL] = process.argv; const io = new NodeIO(); const d = await io.read(IN), r = d.getRoot();
let before = 0; for (const a of r.listAnimations()) before += a.listSamplers().reduce((s, x) => s + x.getInput().getCount(), 0);
for (const a of r.listAnimations()) if (!a.getName().startsWith('M_') && !KEEP.has(a.getName())) a.dispose();
await d.transform(resample({ tolerance: +(TOL || 0.004) }));
const used = new Set(); for (const an of r.listAnimations()) for (const sm of an.listSamplers()) { used.add(sm.getInput()); used.add(sm.getOutput()); }
for (const m of r.listMeshes()) for (const pr of m.listPrimitives()) { for (const se of pr.listSemantics()) used.add(pr.getAttribute(se)); if (pr.getIndices()) used.add(pr.getIndices()); }
for (const sk of r.listSkins()) if (sk.getInverseBindMatrices()) used.add(sk.getInverseBindMatrices());
for (const acc of r.listAccessors()) if (!used.has(acc)) acc.dispose();
await d.transform(prune({ keepAttributes: true, keepLeaves: false }));
let after = 0; for (const a of r.listAnimations()) after += a.listSamplers().reduce((s, x) => s + x.getInput().getCount(), 0);
await io.write(OUT, d); console.log(r.listAnimations().length, 'Animationen, Schlüsselbilder', before, '→', after);
