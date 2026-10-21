// 3D-Darstellung des Spiels mit Babylon.js: Stadion, Rasen, Spielerfiguren mit Laufanimation, Ball mit Flugkurve, Kamera, Effekte.
// Gleiche Schnittstelle wie die 2D-Variante (pitch.js): resize(w, h), draw(M, dt), goalFlash(team), burst(x, y, color), focus.
import { PW, PH, GOAL_W } from './match.js';
// Spielerfiguren: CC0-Modell und Animationen von Quaternius (Universal Animation Library 1+2), aufbereitet mit tools/build-player-model.mjs
const RIG_URL = '/models/player.glb?v=4';
let rigData = null;
// Einzelaktionen aus Mixamo: Start kurz vor dem Ballkontakt, gespielte Länge, Tempo
const ONCE_NAMES = new Set(['M_pass', 'M_chip', 'M_strike', 'M_penalty', 'M_gkdropkick', 'M_gkthrow', 'M_header', 'M_tackle', 'M_gkdiveL', 'M_gkdiveR', 'M_gkcatch', 'M_trip', 'M_standup']);
const ONCE = {
  pass: { n: 'M_pass', from: 0.32, len: 0.85, sp: 1.15 }, chip: { n: 'M_chip', from: 0.38, len: 0.9, sp: 1.1 },
  shot: { n: 'M_strike', from: 0.32, len: 0.85, sp: 1.05 }, penalty: { n: 'M_penalty', from: 0.62, len: 0.75, sp: 1 },
  gkkick: { n: 'M_gkdropkick', from: 1.95, len: 0.95, sp: 1 }, throw: { n: 'M_gkthrow', from: 1.38, len: 0.95, sp: 1.1 },
  header: { n: 'M_header', from: 1.2, len: 0.75, sp: 1.1 }, tackle: { n: 'M_tackle', from: 0, len: 1.35, sp: 1.15 },
  diveL: { n: 'M_gkdiveL', from: 0.95, len: 1.7, sp: 1.35 }, diveR: { n: 'M_gkdiveR', from: 0.85, len: 1.7, sp: 1.35 },
  catch: { n: 'M_gkcatch', from: 0.45, len: 0.85, sp: 1 }, trip: { n: 'M_trip', from: 0, len: 1.45, sp: 1.1 },
  standup: { n: 'M_standup', from: 0, len: 1.6, sp: 1.05 },
}; // ArrayBuffer, einmal je Seite geladen
async function rigBytes() { if (!rigData) rigData = fetch(RIG_URL).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null); return rigData; }
// HD-Figur: realistischer Körper (Quaternius Universal Base Characters, CC0) mit Texturen und Trikot-Zonenkarte
const HD_URL = '/models/player-hd.glb?v=3', HD_DIR = '/models/hd/', HDF_URL = '/models/player-hd-f.glb?v=1', HDF_DIR = '/models/hd/f/';
// Spielerinnen erkennen (Vornamen der Kader- und Gegnerlisten)
const FEM = new Set(['Sina', 'Pia', 'Clara', 'Fiona', 'Kim', 'Dana', 'Hanna', 'Ida', 'Greta', 'Mila', 'Lotte', 'Hilde', 'Ines', 'Marta', 'Elke', 'Mandy', 'Vera', 'Zenzi', 'Sabine', 'Moni', 'Tanja', 'Inka', 'Nadja', 'Ria', 'Dagmar', 'Silke', 'Doris', 'Pamela', 'Conny', 'Rosa', 'Nele', 'Lia', 'Mia', 'Yara', 'Lena', 'Anna', 'Lisa', 'Sara', 'Julia']);
export const isFemale = (p) => !!p && (p.female === true || (p.female !== false && String(p.name || '').split(/[\s-]+/).some(w => FEM.has(w))));
export const gfx = () => { try { return localStorage.getItem('brcm-gfx') || 'auto'; } catch { return 'auto'; } };
const wantHD = () => { try { const q = new URLSearchParams(location.search).get('hd'); if (q) return q !== '0'; } catch { /* ignore */ } const g = gfx(); if (g === 'high') return true; if (g === 'mid' || g === 'low') return false; return (navigator.hardwareConcurrency || 4) > 4 && Math.min(screen.width, screen.height) >= 700; };
// Modelle schon im Hintergrund laden (nur Netzwerk), damit Intro und Anpfiff nicht warten
export function prefetchModels() { rigBytes(); if (wantHD()) { hdAssets(); hdAssetsF(); } }
let hdData = null, hdDataF = null; const KIT_PIX = new Map(); // Trikotbilder (Pixel) seitenweit wiederverwenden
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
async function hdAssets() {
  if (!hdData) hdData = (async () => {
    const [bytes, zones, light, dark] = await Promise.all([fetch(HD_URL).then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error('HD'))), loadImg(HD_DIR + 'kit-zones.png'), loadImg(HD_DIR + 'skin-light.jpg'), loadImg(HD_DIR + 'skin-dark.jpg')]);
    const S = 512, cv = (img, smooth = true) => { const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = smooth; g.drawImage(img, 0, 0, S, S); return g.getImageData(0, 0, S, S).data; };
    return { bytes, S, zones: cv(zones, false), light: cv(light), dark: cv(dark) };
  })().catch(() => null);
  return hdData;
}
async function hdAssetsF() {
  if (!hdDataF) hdDataF = (async () => {
    const [bytes, zones, light, dark] = await Promise.all([fetch(HDF_URL).then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error('HDF'))), loadImg(HDF_DIR + 'kit-zones.png'), loadImg(HDF_DIR + 'skin-light.jpg'), loadImg(HDF_DIR + 'skin-dark.jpg')]);
    const S = 512, cv = (img, smooth = true) => { const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = smooth; g.drawImage(img, 0, 0, S, S); return g.getImageData(0, 0, S, S).data; };
    return { bytes, S, zones: cv(zones, false), light: cv(light), dark: cv(dark), female: true };
  })().catch(() => null);
  return hdDataF;
}

let B = null; // Babylon-Modul (lazy)
export async function loadBabylon() {
  if (B) return B;
  try { B = await import('../vendor/babylon-lite-9.js'); return B; } catch { return null; }
}
export function webglOk() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

const SKIN = ['#f1c9a5', '#d9a479', '#8d5524', '#c68642', '#ffdbac', '#5c3a21'];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a, b, t) => a + (b - a) * t;

export class Pitch3D {
  constructor(canvas, opt = {}) {
    this.t0 = performance.now(); this.c = canvas; this.noHD = opt.hd === false; this.gfx = gfx(); this.lite = !!opt.lite || this.gfx === 'low'; this.M = null; this.figs = new Map(); this.t = 0; this.rot = false; this.flash = 0; this.shake = 0; this.focus = null;
    this.ballH = 0; this.flight = null; this.camT = null; this.ownerRingT = 0; this.cine = null; this.celeb = null; this.lamps = []; this.day = false; this.lampLevel = 1; this.mood = null; this.fw = false; this.fwNext = 0; this.labels = true; this.prevMode = 'held'; this.hist = []; this.replay = null; this.anim = new Map(); this.crowdPulse = 0;
    const { Engine, Scene, Color4, Vector3, HemisphericLight, DirectionalLight, ArcRotateCamera } = B;
    this.engine = new Engine(canvas, true, { stencil: false, preserveDrawingBuffer: false, antialias: true });
    this.engine.setHardwareScalingLevel(this.gfx === 'low' ? 1.25 : 1 / Math.min(this.gfx === 'high' ? 1.5 : 1.25, devicePixelRatio || 1));
    const scene = this.scene = new Scene(this.engine);
    scene.clearColor = new Color4(0.012, 0.03, 0.028, 1); scene.skipPointerMovePicking = true; scene.autoClearDepthAndStencil = true;
    scene.ambientColor = new B.Color3(0.25, 0.3, 0.28);
    this.hemi = new HemisphericLight('h', new Vector3(0.2, 1, 0.1), scene); this.hemi.intensity = 0.75; this.hemi.groundColor = new B.Color3(0.08, 0.15, 0.1);
    this.sun = new DirectionalLight('d', new Vector3(-0.45, -1, -0.35), scene); this.sun.position = new Vector3(PW * 0.7, 60, PH * 0.7); this.sun.intensity = 0.95;
    // Schatten als weiche Scheiben (zuverlässig auf jeder Hardware, günstig auf Tablets)
    this.blobMat = this.mat('blob', '#000000', { alpha: 0.38, spec: 0 });
    this.cam = new ArcRotateCamera('cam', -Math.PI / 2, 0.98, 64, new Vector3(PW / 2, 0, PH / 2), scene);
    this.cam.fov = 0.78; this.cam.minZ = 0.5; this.cam.maxZ = 600;
    this.buildStadium(); this.buildBall(); this.buildFx(); this.ref = null; this.camMode = 'auto'; this.trail.particleTexture = this.ptex;
    // Nachbearbeitung: Kantenglättung, leichtes Leuchten, Kontrast, Vignette – bei schwacher Hardware automatisch aus
    try {
      const pl = this.pipe = new B.DefaultRenderingPipeline('pp', false, scene, [this.cam]);
      pl.fxaaEnabled = true; pl.bloomEnabled = true; pl.bloomThreshold = 0.82; pl.bloomWeight = 0.28; pl.bloomKernel = 48; pl.bloomScale = 0.5;
      pl.imageProcessingEnabled = true; pl.imageProcessing.contrast = 1.18; pl.imageProcessing.exposure = 1.06; pl.imageProcessing.vignetteEnabled = true; pl.imageProcessing.vignetteWeight = 1.6; pl.imageProcessing.vignetteColor = new B.Color4(0, 0, 0, 0);
      pl.sharpenEnabled = true; pl.sharpen.edgeAmount = 0.25;
    } catch { this.pipe = null; }
    if (this.gfx === 'low' && this.pipe) { this.pipe.dispose(); this.pipe = null; }
    this.fpsT = 0; this.fpsN = 0; this.fpsChecked = false;
    this.rig = null; this.rigN = 0; this.rigPromise = this.loadRig(); this.updateSky();
    try { this.buildCrowd(); } catch (e) { console.warn('Publikum', e); }
    // Echte Schatten der Spieler (Sonne bzw. Flutlicht), bei schwacher Hardware wieder aus
    this.shadow = null; this.quality = 2; this.qT = 0; this.qN = 0; this.qGood = 0;
    this.ready = this.rigPromise; // Intro und Spiel warten darauf (mit Zeitlimit)
    // Schussbewegung als Zusatz auf die Skelett-Animation (Oberschenkel nach hinten, dann durchziehen)
    scene.onAfterAnimationsObservable.add(() => { const now = performance.now(); for (const f of this.kickers || []) { const an = f.kick; if (!an || now > an.until) continue; const k = 1 - (an.until - now) / an.len, back = k < 0.36, t = back ? k / 0.36 : (k - 0.36) / 0.64;
      const th = back ? 0.75 * t : 0.75 - 2.05 * Math.min(1, t * 1.5) + (t > 0.7 ? (t - 0.7) * 2.4 : 0), ca = back ? 1.3 * t : 1.3 * Math.max(0, 1 - t * 2);
      const Q = B.Quaternion, ax = B.Vector3; if (f.j.thighR?.rotationQuaternion) f.j.thighR.rotationQuaternion.multiplyInPlace(Q.RotationAxis(new ax(1, 0, 0), th)); if (f.j.calfR?.rotationQuaternion) f.j.calfR.rotationQuaternion.multiplyInPlace(Q.RotationAxis(new ax(0, 0, 1), ca)); } });
  }
  // Echte Schatten (nur wenn genug Leistung da ist)
  enableShadows() {
    if (this.shadow || this.lite) return; try { const sg = this.shadow = new B.ShadowGenerator(1024, this.sun); sg.usePercentageCloserFiltering = true; sg.filteringQuality = B.ShadowGenerator.QUALITY_LOW; sg.bias = 0.0015; sg.normalBias = 0.02; sg.setDarkness(0.35); this.sun.shadowMinZ = 1; this.sun.shadowMaxZ = 160; this.ground.receiveShadows = true; this.blobMat.alpha = 0.16; if (this.ball) sg.addShadowCaster(this.ball);
      for (const f of this.figs.values()) for (const m of f.root.getChildMeshes()) if (m.skeleton) sg.addShadowCaster(m, false); } catch { this.shadow = null; }
  }
  disableShadows() { if (!this.shadow) return; this.shadow.dispose(); this.shadow = null; this.ground.receiveShadows = false; this.blobMat.alpha = 0.38; }
  // Publikum: einfache Figuren (Körper, Kopf, Arme) als Instanzen, Farben je Verein, Jubel bei Toren
  buildCrowd() {
    const { MeshBuilder, Mesh, StandardMaterial, Color3, Matrix, Vector3 } = B, scene = this.scene;
    const torso = MeshBuilder.CreateBox('ct', { width: 0.46, height: 0.62, depth: 0.28 }, scene); torso.position.y = 0.62;
    const head = MeshBuilder.CreateSphere('ch', { diameter: 0.25, segments: 4 }, scene); head.position.y = 1.08;
    const body = torso; body.name = 'crowd'; body.bakeCurrentTransformIntoVertices(); head.bakeCurrentTransformIntoVertices(); head.name = 'crowdHeads';
    const armL = MeshBuilder.CreateBox('ca', { width: 0.11, height: 0.5, depth: 0.11 }, scene); armL.position.set(-0.29, -0.22, 0);
    const armR = armL.clone('cb'); armR.position.x = 0.29; const arms = Mesh.MergeMeshes([armL, armR], true, true); arms.name = 'crowdArms';
    const mat = new StandardMaterial('crowdM', scene); mat.specularColor = Color3.Black(); mat.emissiveColor = new Color3(0.12, 0.12, 0.12);
    body.material = mat; arms.material = mat; head.material = mat; body.isPickable = arms.isPickable = head.isPickable = false;
    const low = (navigator.hardwareConcurrency || 4) <= 4 || Math.min(innerWidth, innerHeight) < 600;
    const seats = [];
    for (const st of this.stands || []) {
      st.s.computeWorldMatrix(true); const W = st.s.getWorldMatrix(), c0 = Vector3.TransformCoordinates(Vector3.Zero(), W); let nrm = Vector3.TransformNormal(new Vector3(0, 0, -1), W).normalize(); if (Vector3.Dot(nrm, new Vector3(PW / 2 - c0.x, 0, PH / 2 - c0.z)) < 0) nrm = nrm.scale(-1); nrm.y = Math.max(0, nrm.y); const front = Math.abs(st.roty - Math.PI) < 0.01, step = low || this.lite ? 1.3 : 1.05, fill = front ? 0.3 : low || this.lite ? 0.5 : 0.66;
      for (let v = -st.h / 2 + 0.6; v < st.h / 2 - 0.4; v += 1.05) for (let u = -st.len / 2 + 0.5; u < st.len / 2 - 0.5; u += step) {
        if (Math.random() > fill) continue;
        const p = Vector3.TransformCoordinates(new Vector3(u + (Math.random() - 0.5) * 0.25, v, 0), W).add(nrm.scale(0.55));
        seats.push({ x: p.x, y: p.y - 0.45, z: p.z, ry: Math.atan2(PW / 2 - p.x, PH / 2 - p.z) + (Math.random() - 0.5) * 0.5, ph: Math.random() * 6.28, k: Math.random(), s: 0.92 + Math.random() * 0.16 });
      }
    }
    const n = seats.length; this.crowd = { body, arms, head, skin: new Float32Array(n * 4), seats, mBody: new Float32Array(n * 16), mArms: new Float32Array(n * 16), col: new Float32Array(n * 4), t: 0 };
    this.crowdPose(0, true); body.thinInstanceSetBuffer('matrix', this.crowd.mBody, 16, false); head.thinInstanceSetBuffer('matrix', this.crowd.mBody, 16, false); arms.thinInstanceSetBuffer('matrix', this.crowd.mArms, 16, false);
    this.crowdColors(null); body.thinInstanceSetBuffer('color', this.crowd.col, 4, false); arms.thinInstanceSetBuffer('color', this.crowd.col, 4, false);
    { const SK = ['#f1c9a5', '#d9a479', '#8d5524', '#c68642', '#ffdbac', '#5c3a21', '#e0ac69']; seats.forEach((s, i) => { const c = B.Color3.FromHexString(SK[Math.floor(s.k * 7919) % SK.length]); this.crowd.skin.set([c.r * 0.8, c.g * 0.8, c.b * 0.8, 1], i * 4); }); head.thinInstanceSetBuffer('color', this.crowd.skin, 4, true); }
    body.alwaysSelectAsActiveMesh = arms.alwaysSelectAsActiveMesh = head.alwaysSelectAsActiveMesh = true;
    // Die Tribünenfläche zeigt jetzt Sitzreihen statt gemalter Zuschauer
    if (this.crowdMat) { const t = this.crowdMat.diffuseTexture, g = t.getContext(); g.fillStyle = '#1a2124'; g.fillRect(0, 0, 1024, 256); for (let r = 0; r < 256; r += 16) { g.fillStyle = '#2b3438'; g.fillRect(0, r + 6, 1024, 7); g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, r + 13, 1024, 3); } t.update(); this.crowdMat.emissiveColor = new Color3(0.18, 0.18, 0.18); }
  }
  // Farben: Heimfans in Heimfarben, Gästeblock in Gästefarben, dazu neutrale Zuschauer
  crowdColors(M) {
    const C = this.crowd; if (!C) return; const { Color3 } = B;
    const home = M ? [M.teams[0].color, M.teams[0].color2 || '#ffffff', '#ffffff'] : ['#3ddc84', '#0b3b22', '#ffffff'], away = M ? [M.teams[1].color, M.teams[1].color2 || '#222222'] : ['#ff6a3d', '#2a2f33'];
    const neutral = ['#d8d8d8', '#2a2f33', '#5a6b73', '#8a6a4a', '#b8c4cc'];
    C.seats.forEach((s, i) => { const awayBlock = s.x > PW * 0.72 && s.z > PH * 0.3; const pal = s.k < 0.18 ? neutral : awayBlock ? away : s.k < 0.3 ? away : home; const c = Color3.FromHexString(pal[Math.floor(s.k * 997) % pal.length]); const sh = 0.8 + s.k * 0.35; C.col.set([c.r * sh, c.g * sh, c.b * sh, 1], i * 4); });
    if (C.body.thinInstanceCount) { C.body.thinInstanceBufferUpdated('color'); C.arms.thinInstanceBufferUpdated('color'); }
  }
  // Haltung: leichtes Wippen, nach Toren Aufspringen mit erhobenen Armen
  crowdPose(excite, force) {
    const C = this.crowd; if (!C) return; const { Matrix, Quaternion, Vector3 } = B; const t = C.t, mb = C.mBody, ma = C.mArms;
    const tmp = Matrix.Identity(), tmpA = Matrix.Identity(), q = new Quaternion(), qa = new Quaternion(), sc = new Vector3(1, 1, 1), pos = new Vector3(), pa = new Vector3();
    for (let i = 0; i < C.seats.length; i++) {
      const s = C.seats[i], jump = excite > 0.05 ? Math.max(0, Math.sin(t * 9 + s.ph)) * 0.45 * excite * (0.4 + s.k) : 0, sway = Math.sin(t * 1.6 + s.ph) * 0.03;
      Quaternion.RotationYawPitchRollToRef(s.ry, 0, sway, q); sc.set(s.s, s.s, s.s); pos.set(s.x, s.y + jump, s.z);
      Matrix.ComposeToRef(sc, q, pos, tmp); tmp.copyToArray(mb, i * 16);
      const up = excite > 0.05 && s.k > 0.25 ? 1 : 0; Quaternion.RotationYawPitchRollToRef(s.ry, up ? Math.PI - 0.25 * Math.sin(t * 7 + s.ph) : 0, 0, qa); pa.set(s.x, s.y + jump + 0.88 * s.s, s.z);
      Matrix.ComposeToRef(sc, qa, pa, tmpA); tmpA.copyToArray(ma, i * 16);
    }
    if (!force) { C.body.thinInstanceBufferUpdated('matrix'); C.head.thinInstanceBufferUpdated('matrix'); C.arms.thinInstanceBufferUpdated('matrix'); }
  }
  async loadRig() {
    if (!B.LoadAssetContainerAsync || this.noRig) return;
    try {
      const hd = !this.noHD && wantHD() ? await hdAssets() : null; this.hd = hd;
      const bytes = hd ? hd.bytes : await rigBytes(); if (!bytes || this.disposed) return; const tl0 = performance.now(); this.tFetch = tl0 - this.t0;
      const c = await B.LoadAssetContainerAsync(new Uint8Array(bytes), this.scene, { pluginExtension: '.glb' }); if (this.disposed) return; this.tParse = performance.now() - tl0;
      if (hd) { try { const hf = await hdAssetsF(); if (hf && !this.disposed) { this.rigF = await B.LoadAssetContainerAsync(new Uint8Array(hf.bytes), this.scene, { pluginExtension: '.glb' }); this.hdF = hf; this.hdNormalF = new B.Texture(HDF_DIR + 'normal.jpg', this.scene, false, false); } } catch (e) { console.warn('Spielerinnen-Modell nicht geladen', e); this.rigF = null; this.hdF = null; } }
      if (hd) { const { Texture, StandardMaterial, Color3 } = B; this.hdNormal = new Texture(HD_DIR + 'normal.jpg', this.scene, false, false); const em = this.hdEye = new StandardMaterial('hdEye', this.scene); em.diffuseTexture = new Texture(HD_DIR + 'eye.jpg', this.scene, false, false); em.specularColor = new Color3(0.6, 0.6, 0.6); em.specularPower = 64; this.hdBrowTex = new Texture(HD_DIR + 'brows.png', this.scene, false, false); this.kitCache = new Map(); }
      this.rig = c; this.figCheck = null; this.rigNames = c.animationGroups.map(g => g.name); this.mx = this.rigNames.includes('M_jog');
      for (const f of this.figs.values()) this.disposeFig(f); this.figs.clear(); if (this.ref) { const o = this.ref; this.disposeFig(o); this.ref = null; }
    } catch (e) { console.warn('Spielermodell nicht geladen – einfache Figuren', e); }
  }
  // Rückfall, wenn die Spielerfiguren auf diesem Gerät nicht gezeichnet werden können (Shaderfehler oder nie bereit):
  // erst ohne HD-Körper und Schatten, dann einfache Figuren
  figFail(why) {
    if (this.figFailing) return; this.figFailing = true; console.warn('Spielerfiguren: Rückfall', why, this.hd ? 'HD' : 'Standard');
    if (this.shadow) this.disableShadows(); this.shadowTried = true;
    const wasHD = !!this.hd; this.figCheck = null;
    if (wasHD) { this.noHD = true; this.hd = null; this.rig = null; this.rigF = null; this.hdF = null; for (const f of this.figs.values()) this.disposeFig(f); this.figs.clear(); this.rigPromise = this.loadRig().then(() => { this.figFailing = false; }); }
    else { this.noRig = true; this.rig = null; this.mx = false; for (const f of this.figs.values()) this.disposeFig(f); this.figs.clear(); if (this.ref) { this.disposeFig(this.ref); this.ref = null; } this.figFailing = false; }
  }
  // Prüft einige Sekunden nach dem Anlegen, ob die Körper wirklich gezeichnet werden können
  checkFigs(now) {
    if (!this.rig || this.figFailing || !this.figs.size) return; const C = this.figCheck || (this.figCheck = { t0: now, done: false }); if (C.done || now - C.t0 < 5000) return; C.done = true;
    let bad = 0, n = 0; for (const f of this.figs.values()) { const m = f.root.getChildMeshes().find(x => x.skeleton); if (!m) continue; n++; if (!m.isReady(true)) bad++; }
    if (n && bad > n / 2) this.figFail(`${bad}/${n} Körper nicht bereit`);
  }
  disposeFig(f) { try { if (this.shadow) for (const m of f.root.getChildMeshes()) this.shadow.removeShadowCaster(m, false); if (f.agStore || f.ags) for (const g of Object.values(f.agStore || f.ags)) g?.dispose(); if (f.skel) f.skel.dispose(); f.root.dispose(false, true); } catch { /* ignore */ } if (this.kickers) this.kickers = this.kickers.filter(x => x !== f); }
  // Figur aus dem Modell: Farbzonen über eine 16×1-Palette (Trikot, Hose, Stutzen, Haut, Schuhe, Haare, Abschluss, Unterarm, Hände)
  rigFigure(c, scale = 1.45) {
    const { TransformNode, DynamicTexture, StandardMaterial, Texture, Color3, MeshBuilder } = B, scene = this.scene, id = ++this.rigN;
    const fem = !!(c.female && this.hd && this.rigF && this.hdF), RC = fem ? this.rigF : this.rig;
    const allAg = RC.animationGroups; RC.animationGroups = []; let inst; try { inst = RC.instantiateModelsToScene(n => n + '#' + id, false, { doNotInstantiate: true }); } finally { RC.animationGroups = allAg; }
    const root = new TransformNode('fig', scene), mr = inst.rootNodes[0]; mr.parent = root; root.scaling.set(scale, scale, scale);
    const tex = new DynamicTexture('pal' + id, { width: 16, height: 1 }, scene, false, Texture.NEAREST_SAMPLINGMODE), g = tex.getContext();
    const pal = [c.shirt, c.shorts, c.socks, c.skin, c.boots || '#141414', c.hair, c.trim || c.shorts, c.longSleeves ? c.shirt : c.skin, c.gloves || c.skin];
    pal.forEach((col, i) => { g.fillStyle = col; g.fillRect(i, 0, 1, 1); }); tex.update(); tex.wrapU = tex.wrapV = Texture.CLAMP_ADDRESSMODE;
    const mat = new StandardMaterial('pm' + id, scene); mat.diffuseTexture = tex; mat.specularColor = new Color3(0.14, 0.14, 0.14); mat.specularPower = 24; mat.onError = (e, errs) => this.figFail('Shader: ' + String(errs).slice(0, 200));
    if (this.hd) {
      mat.diffuseTexture = this.kitTexture(c, fem); tex.dispose(); mat.bumpTexture = fem ? this.hdNormalF : this.hdNormal; mat.specularColor = new Color3(0.1, 0.1, 0.1); mat.specularPower = 18;
      const brow = new StandardMaterial('br' + id, scene); brow.diffuseTexture = this.hdBrowTex; brow.diffuseColor = Color3.FromHexString(c.hair).scale(2.2); brow.specularColor = Color3.Black();
      for (const m of mr.getChildMeshes()) { const mn = m.material?.name || ''; m.material = /Eyes/.test(mn) ? this.hdEye : /Hair/.test(mn) ? brow : mat; m.isPickable = false; m.alwaysSelectAsActiveMesh = true; if (m.skeleton) this.shadow?.addShadowCaster(m, false); }
    } else for (const m of mr.getChildMeshes()) { m.material = mat; m.isPickable = false; m.alwaysSelectAsActiveMesh = true; if (m.skeleton) this.shadow?.addShadowCaster(m, false); }
    const d = mr.getDescendants(false), bone = (n) => d.find(x => x.name === n + '#' + id);
    const j = { thighR: bone('thigh_r'), calfR: bone('calf_r'), spine: bone('spine_03'), head: bone('Head') };
    const nodeMap = new Map(d.map(nd => [nd.name.slice(0, nd.name.lastIndexOf('#')), nd]));
    const store = {}, ags = new Proxy(store, { get: (o, name) => { if (typeof name !== 'string') return o[name]; if (!(name in o)) { const src = allAg.find(g => g.name === name); let cl; if (src) { cl = src.clone(name + '#' + id, (t) => nodeMap.get(t.name) || null); cl.stop(); } o[name] = cl; } return o[name]; } });
    root.computeWorldMatrix(true); for (const n of d) n.computeWorldMatrix(true);
    // Rückennummer und Wappen folgen dem Oberkörper
    const deco = (mesh, x, y, z, ry) => { mesh.parent = root; mesh.position.set(x, y, z); mesh.rotation.y = ry; mesh.isPickable = false; mesh.computeWorldMatrix(true); if (j.spine) mesh.setParent(j.spine); };
    const hd = !!this.hd;
    if (c.numMat) { const np = MeshBuilder.CreatePlane('num', { width: 0.24, height: 0.24 }, scene); np.material = c.numMat; deco(np, 0, hd ? 1.34 : 1.36, hd ? -0.185 : -0.155, Math.PI); }
    if (c.crest) { const cp = MeshBuilder.CreatePlane('crest', { width: 0.08, height: 0.08 }, scene); cp.material = c.crest; deco(cp, 0.08, hd ? 1.42 : 1.43, hd ? 0.17 : 0.135, 0); }
    const blob = MeshBuilder.CreateDisc('blob', { radius: 0.5 / scale * 1.32, tessellation: 16 }, scene); blob.rotation.x = Math.PI / 2; blob.position.y = 0.015; blob.scaling.set(1, 0.75, 1); blob.material = this.blobMat; blob.parent = root; blob.isPickable = false;
    return { root, j, ags, agStore: store, w: {}, rig: true, mat, skel: inst.skeletons[0], phase: Math.random() * 6, scale, face: null, faceOn: false };
  }
  // Trikot auf die Körpertextur malen: Zonen aus der Karte, Schattierung aus dem Körperbild, Haut hell/dunkel gemischt
  kitTexture(c, fem) {
    const key = [c.shirt, c.shorts, c.socks, c.boots, c.trim, c.hair, c.gloves, c.longSleeves ? 1 : 0, c.skinT, fem ? 'f' : 'm'].join('|'); if (this.kitCache.has(key)) return this.kitCache.get(key);
    const { DynamicTexture } = B, H = fem ? this.hdF : this.hd, S = H.S, rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const col = [rgb(c.shirt), rgb(c.shorts), rgb(c.socks), null, rgb(c.boots || '#141414'), rgb(c.hair), rgb(c.trim || c.shorts), c.longSleeves ? rgb(c.shirt) : null, c.gloves ? rgb(c.gloves) : null];
    const tex = new DynamicTexture('kit' + this.kitCache.size, { width: S, height: S }, this.scene, true), g = tex.getContext(), out = g.createImageData(S, S), o = out.data, t = c.skinT || 0;
    const cached = KIT_PIX.get(key); if (cached) { o.set(cached); g.putImageData(out, 0, 0); tex.update(false); this.kitCache.set(key, tex); return tex; }
    for (let i = 0; i < S * S; i++) {
      const p = i * 4, z = Math.round(H.zones[p] / 16), br = H.light[p] * (1 - t) + H.dark[p] * t, bg = H.light[p + 1] * (1 - t) + H.dark[p + 1] * t, bb = H.light[p + 2] * (1 - t) + H.dark[p + 2] * t;
      const kc = col[z];
      if (!kc) { o[p] = br; o[p + 1] = bg; o[p + 2] = bb; o[p + 3] = 255; continue; }
      const lum = (0.3 * H.light[p] + 0.59 * H.light[p + 1] + 0.11 * H.light[p + 2]) / 255;
      let sh = z === 1 ? 0.92 + (lum - 0.25) * 0.35 : z === 5 ? 0.55 + ((i * 2654435761 >>> 0) % 997) / 997 * 0.55 : 0.8 + (lum - 0.62) * 0.75;
      sh = Math.max(0.55, Math.min(1.15, sh)); o[p] = kc[0] * sh; o[p + 1] = kc[1] * sh; o[p + 2] = kc[2] * sh; o[p + 3] = 255;
    }
    KIT_PIX.set(key, new Uint8ClampedArray(o)); g.putImageData(out, 0, 0); tex.update(false); tex.hasAlpha = false; this.kitCache.set(key, tex); return tex;
  }
  // Animationen mischen: Ziele { Name: Gewicht } (Summe 1), Tempo je Animation
  rigAnim(f, tw, dt, speeds = {}, rate = 8, once = null) {
    const k = Math.min(1, dt * rate);
    for (const name of new Set([...Object.keys(f.w), ...Object.keys(tw)])) {
      const g = f.ags[name]; if (!g) continue; const target = tw[name] || 0, w = (f.w[name] || 0) + (target - (f.w[name] || 0)) * k;
      if (w < 0.01 && target === 0) { if (g.isStarted) g.stop(); delete f.w[name]; continue; }
      if (once && once.n === name && f.onceKey !== once.key) { f.onceKey = once.key; g.stop(); g.start(false, once.sp, g.from + once.from * 60, g.to); }
      else if (!g.isStarted && !(once && once.n === name) && !ONCE_NAMES.has(name)) g.start(true, speeds[name] || 1);
      if (!(once && once.n === name)) g.speedRatio = speeds[name] || 1; g.setWeightForAllAnimatables(w); f.w[name] = w;
    }
  }
  // ---------- Aufbau ----------
  cmat(hex, spec = 0.08) { this.mc ||= new Map(); const k = hex + spec; if (!this.mc.has(k)) this.mc.set(k, this.mat('c' + k, hex, { spec })); return this.mc.get(k); }
  mat(name, hex, o = {}) { const { StandardMaterial, Color3 } = B; const m = new StandardMaterial(name, this.scene); m.diffuseColor = Color3.FromHexString(hex); m.specularColor = new Color3(o.spec ?? 0.08, o.spec ?? 0.08, o.spec ?? 0.08); if (o.em) m.emissiveColor = Color3.FromHexString(o.em); if (o.alpha !== undefined) m.alpha = o.alpha; m.backFaceCulling = o.bfc ?? true; return m; }
  buildStadium() {
    const { MeshBuilder, DynamicTexture, StandardMaterial, Color3, Vector3, ParticleSystem } = B, scene = this.scene;
    // Rasen mit Linien als Textur
    const MX = 10, MZ = 9, W = PW + MX * 2, H = PH + MZ * 2, px = 20; // Pixel pro Meter
    const tex = new DynamicTexture('grass', { width: Math.round(W * px), height: Math.round(H * px) }, scene, true);
    const g = tex.getContext(); const X = (x) => (x + MX) * px, Y = (y) => (y + MZ) * px;
    g.fillStyle = '#0c3a1f'; g.fillRect(0, 0, W * px, H * px);
    for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#14552d' : '#114a28'; g.fillRect(X(i * PW / 12), Y(0), PW / 12 * px + 1, PH * px); }
    // leichte Mäh-Spuren quer
    g.globalAlpha = 0.07; for (let j = 0; j < 8; j++) { g.fillStyle = j % 2 ? '#fff' : '#000'; g.fillRect(X(0), Y(j * PH / 8), PW * px, PH / 8 * px); } g.globalAlpha = 1;
    // Grashalme und leichte Abnutzung vor den Toren und im Mittelkreis
    for (let i = 0; i < 26000; i++) { const x = Math.random() * W * px, y = Math.random() * H * px; g.fillStyle = Math.random() < 0.5 ? 'rgba(160,255,170,0.06)' : 'rgba(0,30,10,0.09)'; g.fillRect(x, y, 1, 2 + Math.random() * 2); }
    const wear = (cx, cy, r) => { const gr = g.createRadialGradient(X(cx), Y(cy), 0, X(cx), Y(cy), r * px); gr.addColorStop(0, 'rgba(110,90,50,0.22)'); gr.addColorStop(1, 'rgba(110,90,50,0)'); g.fillStyle = gr; g.fillRect(X(cx - r), Y(cy - r), r * 2 * px, r * 2 * px); };
    wear(5, PH / 2, 7); wear(PW - 5, PH / 2, 7); wear(PW / 2, PH / 2, 5); wear(11, PH / 2, 4); wear(PW - 11, PH / 2, 4);
    // Umrandung außerhalb (Laufbahn dunkel)
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, W * px, Y(-1.5)); g.fillRect(0, Y(PH + 1.5), W * px, H * px); g.fillRect(0, 0, X(-1.5), H * px); g.fillRect(X(PW + 1.5), 0, W * px, H * px);
    g.strokeStyle = 'rgba(240,255,245,0.95)'; g.lineWidth = 0.14 * px; g.lineCap = 'round';
    g.strokeRect(X(0), Y(0), PW * px, PH * px);
    g.beginPath(); g.moveTo(X(PW / 2), Y(0)); g.lineTo(X(PW / 2), Y(PH)); g.stroke();
    g.beginPath(); g.arc(X(PW / 2), Y(PH / 2), 9.15 * px, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(240,255,245,0.95)'; g.beginPath(); g.arc(X(PW / 2), Y(PH / 2), 0.25 * px, 0, Math.PI * 2); g.fill();
    for (const side of [0, 1]) {
      const x0 = side ? PW : 0, d = side ? -1 : 1;
      g.strokeRect(X(Math.min(x0, x0 + d * 16.5)), Y(PH / 2 - 20.16), 16.5 * px, 40.32 * px);
      g.strokeRect(X(Math.min(x0, x0 + d * 5.5)), Y(PH / 2 - 9.16), 5.5 * px, 18.32 * px);
      g.beginPath(); g.arc(X(x0 + d * 11), Y(PH / 2), 9.15 * px, side ? Math.PI * 0.705 : -Math.PI * 0.295, side ? Math.PI * 1.295 : Math.PI * 0.295); g.stroke();
      g.beginPath(); g.arc(X(x0 + d * 11), Y(PH / 2), 0.25 * px, 0, Math.PI * 2); g.fill();
      for (const cy of [0, PH]) { g.beginPath(); g.arc(X(x0), Y(cy), 1 * px, 0, Math.PI * 2); g.stroke(); }
    }
    tex.update();
    const ground = this.ground = MeshBuilder.CreateGround('ground', { width: W, height: H, subdivisions: 2 }, scene);
    ground.position = new Vector3(PW / 2, 0, PH / 2);
    const gm = new StandardMaterial('gm', scene); gm.diffuseTexture = tex; gm.specularColor = new Color3(0.03, 0.05, 0.03); ground.material = gm;
    // Rasen-Relief: Normalenkarte (Poly Haven „Leafy Grass“, CC0), fein gekachelt
    { const nt = new B.Texture('/img/grass-normal.jpg', scene); nt.uScale = W / 1.6; nt.vScale = H / 1.6; gm.bumpTexture = nt; gm.bumpTexture.level = 0.55; gm.specularColor = new Color3(0.07, 0.1, 0.07); gm.specularPower = 18; }
    // Umgebung (dunkler Boden weit außen)
    const outer = MeshBuilder.CreateGround('outer', { width: 420, height: 320 }, scene); outer.position = new Vector3(PW / 2, -0.05, PH / 2); outer.material = this.mat('om', '#07120c');
    // Tore
    const postM = this.mat('post', '#f4f4f4', { spec: 0.3 });
    const netTex = new DynamicTexture('net', { width: 256, height: 256 }, scene, false); const nc = netTex.getContext(); nc.clearRect(0, 0, 256, 256); nc.strokeStyle = 'rgba(255,255,255,0.75)'; nc.lineWidth = 2;
    for (let i = 0; i <= 256; i += 16) { nc.beginPath(); nc.moveTo(i, 0); nc.lineTo(i, 256); nc.stroke(); nc.beginPath(); nc.moveTo(0, i); nc.lineTo(256, i); nc.stroke(); } netTex.update(); netTex.hasAlpha = true;
    const netM = new StandardMaterial('netm', scene); netM.diffuseTexture = netTex; netM.opacityTexture = netTex; netM.emissiveColor = new Color3(0.5, 0.5, 0.5); netM.backFaceCulling = false; netM.alpha = 0.55;
    for (const side of [0, 1]) {
      const x0 = side ? PW : 0, d = side ? 1 : -1, depth = 2.0, h = 2.44;
      for (const dy of [-GOAL_W / 2, GOAL_W / 2]) { const p = MeshBuilder.CreateCylinder('p', { height: h, diameter: 0.14 }, scene); p.position = new Vector3(x0, h / 2, PH / 2 + dy); p.material = postM; }
      const bar = MeshBuilder.CreateCylinder('bar', { height: GOAL_W + 0.14, diameter: 0.14 }, scene); bar.rotation.x = Math.PI / 2; bar.position = new Vector3(x0, h, PH / 2); bar.material = postM;
      for (const dy of [-GOAL_W / 2, GOAL_W / 2]) { const p = MeshBuilder.CreateCylinder('p2', { height: h * 0.8, diameter: 0.08 }, scene); p.position = new Vector3(x0 + d * depth, h * 0.4, PH / 2 + dy); p.material = postM; }
      const back = MeshBuilder.CreatePlane('nb', { width: GOAL_W, height: h * 0.8 }, scene); (this.nets ||= [])[side] = { m: back, x0: x0 + d * depth, d }; back.position = new Vector3(x0 + d * depth, h * 0.4, PH / 2); back.rotation.y = Math.PI / 2; back.material = netM;
      const top = MeshBuilder.CreatePlane('nt', { width: GOAL_W, height: depth * 1.1 }, scene); top.position = new Vector3(x0 + d * depth / 2, h - 0.15, PH / 2); top.rotation.x = Math.PI / 2; top.rotation.y = Math.PI / 2; top.rotation.z = -d * 0.2; top.material = netM;
      for (const dy of [-GOAL_W / 2, GOAL_W / 2]) { const s = MeshBuilder.CreatePlane('ns', { width: depth, height: h }, scene); s.position = new Vector3(x0 + d * depth / 2, h / 2, PH / 2 + dy); s.material = netM; }
    }
    // Tribünen rundherum mit Publikum
    const crowd = new DynamicTexture('crowd', { width: 1024, height: 256 }, scene, false); const cc = crowd.getContext();
    cc.fillStyle = '#141a1c'; cc.fillRect(0, 0, 1024, 256);
    const cols = ['#3ddc84', '#ffffff', '#1d6b3c', '#cfd8d3', '#ffd166', '#2a2f33', '#8bd3a8', '#0b3b22'];
    for (let i = 0; i < 9000; i++) { cc.fillStyle = cols[Math.floor(Math.random() * cols.length)]; const x = Math.random() * 1024, y = 12 + Math.random() * 232; cc.fillRect(x, y, 3, 5); }
    for (let r = 0; r < 256; r += 24) { cc.fillStyle = 'rgba(0,0,0,0.35)'; cc.fillRect(0, r, 1024, 3); } crowd.update();
    const cm = this.crowdMat = new StandardMaterial('cm', scene); cm.diffuseTexture = crowd; cm.specularColor = Color3.Black(); cm.emissiveColor = new Color3(0.35, 0.35, 0.35);
    const standH = 16, tilt = 0.62;
    const mk = (len, cx, cz, roty, off) => {
      const s = MeshBuilder.CreatePlane('stand', { width: len, height: standH }, scene); s.material = cm; (this.stands ||= []).push({ s, len, roty, h: standH });
      s.position = new Vector3(cx, standH * Math.cos(tilt) / 2 + 0.3, cz); s.rotation.y = roty; s.rotation.x = tilt; // steigt vom Spielfeld weg an
      s.position.x += Math.sin(roty) * off; s.position.z += Math.cos(roty) * off;
      // Kameragrenze: Ebene der Tribüne mit Normale zum Spielfeld (die Kamera bleibt immer davor)
      { s.computeWorldMatrix(true); const W = s.getWorldMatrix(), c0 = Vector3.TransformCoordinates(Vector3.Zero(), W); let n = Vector3.TransformNormal(new Vector3(0, 0, -1), W).normalize(); if (Vector3.Dot(n, new Vector3(PW / 2 - c0.x, 0, PH / 2 - c0.z)) < 0) n = n.scale(-1); (this.camPlanes ||= []).push({ c: c0, n });
        // Rückwand und Seitenteile, damit die Tribüne von hinten massiv wirkt
        const back = Vector3.TransformCoordinates(new Vector3(0, standH / 2, 0), W), wall = MeshBuilder.CreateBox('sw', { width: len + 2, height: back.y + 2.6, depth: 0.6 }, scene); wall.material = this.mat('swm', '#232c2f'); wall.position.set(back.x - n.x * 0.5, (back.y + 2.6) / 2, back.z - n.z * 0.5); wall.rotation.y = roty; wall.isPickable = false; }
      const base = MeshBuilder.CreateBox('sb', { width: len + 4, height: 1.2, depth: 3 }, scene); base.material = this.mat('sbm', '#1c2426'); base.position = new Vector3(s.position.x, 0.6, s.position.z); base.rotation.y = roty; base.position.x -= Math.sin(roty) * 1.2; base.position.z -= Math.cos(roty) * 1.2;
      // Dachkante
      const roof = MeshBuilder.CreateBox('roof', { width: len + 6, height: 0.5, depth: 4 }, scene); roof.material = this.mat('rm', '#2d3a3d'); roof.position = new Vector3(s.position.x, standH * Math.cos(tilt) + 2.2, s.position.z); roof.rotation.y = roty; roof.position.x += Math.sin(roty) * (standH * Math.sin(tilt) / 2 + 1); roof.position.z += Math.cos(roty) * (standH * Math.sin(tilt) / 2 + 1);
    };
    mk(PW + 30, PW / 2, PH + MZ + 2, 0, 4);                 // hinten (gegenüber der Kamera)
    mk(PW + 30, PW / 2, -MZ - 2, Math.PI, 4);               // vorn (hinter der Kamera, nur Rand sichtbar)
    mk(PH + 28, PW + MX + 2, PH / 2, Math.PI / 2, 4);       // rechts
    mk(PH + 28, -MX - 2, PH / 2, -Math.PI / 2, 4);          // links
    // Flutlichtmasten
    for (const [x, z] of [[-MX - 6, -MZ - 6], [PW + MX + 6, -MZ - 6], [-MX - 6, PH + MZ + 6], [PW + MX + 6, PH + MZ + 6]]) {
      const pole = MeshBuilder.CreateCylinder('pole', { height: 34, diameter: 0.8 }, scene); pole.position = new Vector3(x, 17, z); pole.material = this.mat('pm', '#3a4446');
      const lamp = MeshBuilder.CreateBox('lamp', { width: 5, height: 2.4, depth: 0.6 }, scene); lamp.position = new Vector3(x, 34, z); lamp.material = this.mat('lm' + x, '#ffffff', { em: '#fff6d8' }); lamp.lookAt(new Vector3(PW / 2, 0, PH / 2)); this.lamps.push(lamp);
    }
    // Flutlicht-Lichthof und Blendstrahl (Billboards, additiv) – sichtbar bei Nacht, stärker beim Blick ins Licht
    { const gt = new DynamicTexture('glow', { width: 256, height: 256 }, scene, false), g = gt.getContext(), gr = g.createRadialGradient(128, 128, 2, 128, 128, 128);
      gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(0.12, 'rgba(255,240,200,0.85)'); gr.addColorStop(0.35, 'rgba(255,220,160,0.25)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      g.globalCompositeOperation = 'lighter'; const st = g.createLinearGradient(0, 0, 256, 0); st.addColorStop(0, 'rgba(180,210,255,0)'); st.addColorStop(0.5, 'rgba(220,235,255,0.55)'); st.addColorStop(1, 'rgba(180,210,255,0)'); g.fillStyle = st; g.fillRect(0, 124, 256, 8); gt.hasAlpha = true; gt.update();
      const gm = new StandardMaterial('glowM', scene); gm.diffuseTexture = gt; gm.opacityTexture = gt; gm.emissiveColor = new Color3(1, 1, 1); gm.disableLighting = true; gm.alphaMode = 1; gm.disableDepthWrite = true; gm.backFaceCulling = false; gm.fogEnabled = false;
      this.glows = this.lamps.map(l => { const q = MeshBuilder.CreatePlane('glow', { size: 22 }, scene); q.material = gm; q.position = l.position.clone(); q.billboardMode = 7; q.isPickable = false; return q; }); }
    // Bandenwerbung
    const adTex = new DynamicTexture('ad', { width: 2048, height: 128 }, scene, false); const ac = adTex.getContext();
    const ads = ['RealCore', 'TechHub', 'Clean Core', 'SAP BTP', 'AI4BIZ', 'Z-Insight', 'realERP', 'RealCore', 'TechHub', 'Legacy League'];
    ads.forEach((a, i) => { ac.fillStyle = i % 2 ? '#0b3b22' : '#3ddc84'; ac.fillRect(i * 204.8, 0, 204.8, 128); ac.fillStyle = i % 2 ? '#3ddc84' : '#06261a'; ac.font = 'bold 44px sans-serif'; ac.textAlign = 'center'; ac.textBaseline = 'middle'; ac.fillText(a, i * 204.8 + 102, 64); }); adTex.update();
    const am = new StandardMaterial('am', scene); am.diffuseTexture = adTex; am.emissiveColor = new Color3(0.45, 0.45, 0.45); am.specularColor = Color3.Black(); am.backFaceCulling = false;
    for (const [cx, cz, ry, len] of [[PW / 2, PH + 3.2, 0, PW + 8], [PW / 2, -3.2, 0, PW + 8], [PW + 3.2, PH / 2, Math.PI / 2, PH + 6], [-3.2, PH / 2, -Math.PI / 2, PH + 6]]) {
      const b = MeshBuilder.CreatePlane('band', { width: len, height: 0.9 }, scene); b.position = new Vector3(cx, 0.45, cz); b.rotation.y = ry; b.material = am;
    }
    // Eckfahnen
    this.flags = [];
    for (const [fx, fz] of [[0, 0], [PW, 0], [0, PH], [PW, PH]]) {
      const pole = MeshBuilder.CreateCylinder('fp', { height: 1.6, diameter: 0.05 }, scene); pole.position = new Vector3(fx, 0.8, fz); pole.material = this.cmat('#f2f2f2');
      const fl = MeshBuilder.CreatePlane('flag', { width: 0.5, height: 0.35 }, scene); fl.material = this.mat('flm', '#ff6a3d', { bfc: false, em: '#5a1a08' }); fl.setPivotPoint(new Vector3(-0.25, 0, 0)); fl.position = new Vector3(fx + 0.25, 1.42, fz); this.flags.push(fl);
    }
    // Trainerbänke auf der Gegenseite
    for (const bx of [PW / 2 - 13, PW / 2 + 13]) {
      const roof = MeshBuilder.CreateBox('dug', { width: 7, height: 0.12, depth: 2.2 }, scene); roof.position = new Vector3(bx, 2.3, PH + 3.4); roof.material = this.mat('dugm', '#9fd8ff', { alpha: 0.45, em: '#0a1a22' });
      const back = MeshBuilder.CreateBox('dugb', { width: 7, height: 2.3, depth: 0.15 }, scene); back.position = new Vector3(bx, 1.15, PH + 4.4); back.material = this.cmat('#1f2a2e');
      const seat = MeshBuilder.CreateBox('dugs', { width: 6.6, height: 0.5, depth: 0.7 }, scene); seat.position = new Vector3(bx, 0.25, PH + 4.0); seat.material = this.cmat(bx < PW / 2 ? '#3ddc84' : '#ff6a3d');
    }
    // Anzeigetafel über der Gegentribüne
    { const sc = this.scoreTex = new DynamicTexture('score', { width: 1024, height: 256 }, scene, false);
      const sm = new StandardMaterial('scm', scene); sm.diffuseTexture = sc; sm.emissiveTexture = sc; sm.emissiveColor = new Color3(1, 1, 1); sm.disableLighting = true;
      const scr = MeshBuilder.CreatePlane('screen', { width: 14, height: 3.5 }, scene); scr.position = new Vector3(PW - 6, 9.5, PH + MZ + 1.2); scr.rotation.x = -0.25; scr.material = sm;
      const frame = MeshBuilder.CreateBox('scf', { width: 14.8, height: 4.2, depth: 0.4 }, scene); frame.position = new Vector3(PW - 6, 9.5, PH + MZ + 1.45); frame.rotation.x = -0.25; frame.material = this.cmat('#111a1c');
      for (const lx of [-5, 5]) { const leg = MeshBuilder.CreateCylinder('scl', { height: 8, diameter: 0.4 }, scene); leg.position = new Vector3(PW - 6 + lx, 4, PH + MZ + 1.8); leg.material = this.cmat('#2d3a3d'); }
      this.scoreKey = ''; }
    // Flugspur bei Schüssen
    { const tr = this.trail = new ParticleSystem('trail', 300, scene); tr.particleTexture = null; tr.emitter = new Vector3(0, -10, 0); tr.minSize = 0.12; tr.maxSize = 0.22; tr.minLifeTime = 0.25; tr.maxLifeTime = 0.4; tr.emitRate = 0; tr.minEmitPower = 0; tr.maxEmitPower = 0.1; tr.color1 = new B.Color4(1, 1, 1, 0.55); tr.color2 = new B.Color4(0.8, 1, 0.9, 0.35); tr.colorDead = new B.Color4(1, 1, 1, 0); tr.blendMode = ParticleSystem.BLENDMODE_ADD; tr.start(); }
    // Ring unter dem Ballführenden
    const ring = this.ring = MeshBuilder.CreateTorus('ring', { diameter: 3.0, thickness: 0.16, tessellation: 32 }, scene); ring.material = this.mat('ringm', '#ffffff', { em: '#ffffff', alpha: 0.7 }); ring.position.y = 0.05; ring.isVisible = false;
  }
  buildBall() {
    const { MeshBuilder, DynamicTexture, StandardMaterial, Color3 } = B, scene = this.scene;
    const tex = new DynamicTexture('ballt', { width: 256, height: 128 }, scene, true); const c = tex.getContext(); c.fillStyle = '#f6f6f6'; c.fillRect(0, 0, 256, 128); c.fillStyle = '#15181c';
    for (let i = 0; i < 12; i++) { const x = (i % 6) * 42 + (i >= 6 ? 21 : 0) + 10, y = i >= 6 ? 90 : 36; c.beginPath(); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * Math.PI * 2 / 5; c.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 13); } c.closePath(); c.fill(); } tex.update();
    this.ball = MeshBuilder.CreateSphere('ball', { diameter: 0.5, segments: 12 }, scene); const m = new StandardMaterial('bm', scene); m.diffuseTexture = tex; m.specularColor = new Color3(0.4, 0.4, 0.4); this.ball.material = m;
    this.ballBlob = MeshBuilder.CreateDisc('bblob', { radius: 0.32, tessellation: 16 }, scene); this.ballBlob.rotation.x = Math.PI / 2; this.ballBlob.material = this.blobMat; this.ballBlob.position.y = 0.02;
  }
  buildFx() {
    const { ParticleSystem, DynamicTexture, Vector3, Color4 } = B, scene = this.scene;
    const t = new DynamicTexture('pt', { width: 32, height: 32 }, scene, false); const c = t.getContext(); const gr = c.createRadialGradient(16, 16, 2, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 32, 32); t.update(); t.hasAlpha = true;
    this.ptex = t;
    const ps = this.ps = new ParticleSystem('fx', 400, scene); ps.particleTexture = t; ps.emitter = new Vector3(PW / 2, 1, PH / 2);
    ps.minEmitBox = new Vector3(-0.3, 0, -0.3); ps.maxEmitBox = new Vector3(0.3, 0.5, 0.3); ps.minSize = 0.25; ps.maxSize = 0.6; ps.minLifeTime = 0.7; ps.maxLifeTime = 1.4;
    ps.emitRate = 0; ps.direction1 = new Vector3(-4, 6, -4); ps.direction2 = new Vector3(4, 12, 4); ps.minEmitPower = 1; ps.maxEmitPower = 2.2; ps.gravity = new Vector3(0, -14, 0); ps.updateSpeed = 0.012; ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.color1 = new Color4(1, 1, 1, 1); ps.color2 = new Color4(0.3, 0.9, 0.5, 1); ps.colorDead = new Color4(0, 0, 0, 0); ps.start();
    // Feuerwerk über den Tribünen
    const fw = this.fwPs = new ParticleSystem('fw', 3000, scene); fw.particleTexture = t; fw.emitter = new Vector3(PW / 2, 30, PH / 2);
    fw.minEmitBox = new Vector3(0, 0, 0); fw.maxEmitBox = new Vector3(0, 0, 0); fw.minSize = 0.5; fw.maxSize = 1.1; fw.minLifeTime = 1.1; fw.maxLifeTime = 2.0;
    fw.emitRate = 0; fw.createSphereEmitter(0.5); fw.minEmitPower = 9; fw.maxEmitPower = 15; fw.gravity = new Vector3(0, -7, 0); fw.updateSpeed = 0.012; fw.blendMode = ParticleSystem.BLENDMODE_ADD;
    fw.colorDead = new Color4(0, 0, 0, 0); fw.start();
  }
  // Spielerfigur: Körper, Kopf, Beine, Arme, Nummernschild
  // Körper mit Gelenken: Hüfte, Wirbelsäule, Kopf, Schultern/Ellbogen, Hüftgelenk/Knie/Fuß
  body(c, scale = 1.32) {
    const { MeshBuilder, TransformNode, Vector3 } = B, scene = this.scene;
    const N = (name, parent, x = 0, y = 0, z = 0) => { const t = new TransformNode(name, scene); t.parent = parent; t.position = new Vector3(x, y, z); return t; };
    const cyl = (parent, h, d1, d2, mat, y, tess = 10) => { const m = MeshBuilder.CreateCylinder('c', { height: h, diameterTop: d1, diameterBottom: d2, tessellation: tess }, scene); m.parent = parent; m.position.y = y; m.material = mat; m.isPickable = false; return m; };
    const sph = (parent, d, mat, x, y, z, sx = 1, sy = 1, sz = 1, seg = 10) => { const m = MeshBuilder.CreateSphere('s', { diameter: d, segments: seg }, scene); m.parent = parent; m.position.set(x, y, z); m.scaling.set(sx, sy, sz); m.material = mat; m.isPickable = false; return m; };
    const shirt = c.shirtMat || this.cmat(c.shirt, 0.12), shorts = this.cmat(c.shorts), skin = this.cmat(c.skin, 0.05), socks = this.cmat(c.socks), boots = this.cmat(c.boots || '#151515', 0.3), hair = this.cmat(c.hair), gloves = this.cmat(c.gloves || c.skin);
    const root = new TransformNode('fig', scene); root.scaling.set(scale, scale, scale);
    const j = {};
    j.hips = N('hips', root, 0, 0.98, 0);
    cyl(j.hips, 0.26, 0.4, 0.45, shorts, -0.06);                                   // Hose
    j.spine = N('spine', j.hips, 0, 0.06, 0);
    cyl(j.spine, 0.5, 0.46, 0.38, shirt, 0.26);                                    // Oberkörper
    sph(j.spine, 0.5, shirt, 0, 0.5, 0, 1.05, 0.42, 0.62);                         // Schultern
    j.chest = j.spine;
    cyl(j.spine, 0.12, 0.11, 0.12, skin, 0.62, 8);                                 // Hals
    j.head = N('head', j.spine, 0, 0.78, 0);
    sph(j.head, 0.27, skin, 0, 0, 0, 0.9, 1.08, 1);
    const hs = c.hairStyle ?? 0;
    if (hs !== 3) sph(j.head, 0.285, hair, 0, 0.035, -0.012, 0.93, hs === 1 ? 1.05 : 0.86, 1.02, 10); // Haare
    sph(j.head, 0.04, skin, 0, -0.01, 0.135, 1, 1.2, 1, 6);                        // Nase
    const face = [], n0 = j.head.getChildMeshes(true).length; const dark = this.cmat('#1a1410', 0.3), white = this.cmat('#f4f1ea', 0.2), lip = this.cmat('#7a3b2e');
    for (const ex of [-0.045, 0.045]) { sph(j.head, 0.034, white, ex, 0.025, 0.112, 1, 0.8, 0.5, 6); sph(j.head, 0.018, dark, ex, 0.025, 0.126, 1, 1, 0.5, 6); const br = MeshBuilder.CreateBox('brow', { width: 0.045, height: 0.008, depth: 0.01 }, scene); br.parent = j.head; br.position.set(ex, 0.055, 0.118); br.material = hair; br.isPickable = false; sph(j.head, 0.06, skin, ex * 2.9, 0, 0, 0.45, 0.8, 0.6, 6); }
    const mo = MeshBuilder.CreateBox('mouth', { width: 0.05, height: 0.01, depth: 0.01 }, scene); mo.parent = j.head; mo.position.set(0, -0.06, 0.118); mo.material = lip; mo.isPickable = false;
    face.push(...j.head.getChildMeshes(true).slice(n0));
    if (c.crest) { const cp = MeshBuilder.CreatePlane('crest', { width: 0.11, height: 0.11 }, scene); cp.parent = j.spine; cp.position.set(0.1, 0.4, 0.205); cp.rotation.x = 0.1; cp.material = c.crest; cp.isPickable = false; }
    for (const sd of [-1, 1]) {
      // Arm
      const sh = j[sd < 0 ? 'shL' : 'shR'] = N('sh', j.spine, sd * 0.28, 0.5, 0);
      cyl(sh, 0.2, 0.15, 0.13, shirt, -0.08);                                       // Ärmel
      cyl(sh, 0.16, 0.1, 0.09, skin, -0.24, 8);                                     // Oberarm
      const el = j[sd < 0 ? 'elL' : 'elR'] = N('el', sh, 0, -0.32, 0);
      cyl(el, 0.27, 0.085, 0.07, c.longSleeves ? shirt : skin, -0.13, 8);           // Unterarm
      sph(el, 0.1, gloves, 0, -0.3, 0.01, 0.9, 1.1, 0.7, 8);                        // Hand
      // Bein
      const hp = j[sd < 0 ? 'hipL' : 'hipR'] = N('hip', j.hips, sd * 0.11, -0.08, 0);
      cyl(hp, 0.4, 0.17, 0.13, skin, -0.2, 10);                                     // Oberschenkel
      const kn = j[sd < 0 ? 'knL' : 'knR'] = N('kn', hp, 0, -0.42, 0);
      cyl(kn, 0.4, 0.125, 0.09, socks, -0.2, 10);                                   // Stutzen
      const ft = j[sd < 0 ? 'ftL' : 'ftR'] = N('ft', kn, 0, -0.42, 0);
      const boot = MeshBuilder.CreateBox('boot', { width: 0.1, height: 0.08, depth: 0.25 }, scene); boot.parent = ft; boot.position.set(0, -0.02, 0.05); boot.material = boots; boot.isPickable = false;
    }
    const blob = MeshBuilder.CreateDisc('blob', { radius: 0.5, tessellation: 16 }, scene); blob.rotation.x = Math.PI / 2; blob.position.y = 0.015; blob.scaling.set(1, 0.75, 1); blob.material = this.blobMat; blob.parent = root; blob.isPickable = false;
    return { root, j, phase: Math.random() * 6, scale, face, faceOn: true };
  }
  // Pose anwenden (Winkel in Radiant; x negativ = nach vorn)
  pose(f, P) {
    const j = f.j;
    j.hips.position.y = 0.98 - (P.drop || 0); j.hips.rotation.set(0, P.twist || 0, 0);
    j.spine.rotation.set(P.lean || 0, -(P.twist || 0) * 0.6, P.side || 0);
    j.head.rotation.set(P.head || 0, P.headYaw || 0, 0);
    j.shL.rotation.set(P.shL || 0, 0, P.spreadL ?? 0.12); j.shR.rotation.set(P.shR || 0, 0, -(P.spreadR ?? 0.12));
    j.elL.rotation.set(P.elL ?? -0.35, 0, 0); j.elR.rotation.set(P.elR ?? -0.35, 0, 0);
    j.hipL.rotation.set(P.hipL || 0, 0, P.legSpread ? P.legSpread : 0); j.hipR.rotation.set(P.hipR || 0, 0, P.legSpread ? -P.legSpread : 0);
    j.knL.rotation.set(P.knL ?? 0.08, 0, 0); j.knR.rotation.set(P.knR ?? 0.08, 0, 0);
    j.ftL.rotation.set(-(P.knL ?? 0.08) * 0.4 + (P.hipL || 0) * -0.2, 0, 0); j.ftR.rotation.set(-(P.knR ?? 0.08) * 0.4 + (P.hipR || 0) * -0.2, 0, 0);
  }
  // weicher Übergang zwischen Posen (keine Sprünge beim Wechsel Laufen → Schuss → Jubel)
  blendPose(f, P, dt, rate) {
    const D = { spreadL: 0.12, spreadR: 0.12, elL: -0.35, elR: -0.35, knL: 0.08, knR: 0.08 }, cur = f.pc ||= {}, k = Math.min(1, dt * rate);
    for (const key of new Set([...Object.keys(cur), ...Object.keys(P)])) { const target = P[key] ?? D[key] ?? 0, from = cur[key] ?? D[key] ?? 0; cur[key] = from + (target - from) * k; }
    this.pose(f, cur);
  }
  // Laufzyklus (run 0…1, Phase)
  runPose(ph, run, sprint = 0) {
    const s = Math.sin(ph), c = Math.cos(ph), amp = 0.25 + run * 0.65 + sprint * 0.15;
    const knee = (x) => 0.12 + run * (0.25 + 0.95 * Math.max(0, Math.sin(x - 0.9)));
    return { lean: 0.06 + run * 0.2 + sprint * 0.08, hipL: -s * amp, hipR: s * amp, knL: knee(ph), knR: knee(ph + Math.PI), shL: s * amp * 0.85, shR: -s * amp * 0.85, elL: -0.45 - run * 0.85, elR: -0.45 - run * 0.85, spreadL: 0.12 + run * 0.05, spreadR: 0.12 + run * 0.05, twist: s * 0.12 * run, drop: run * 0.04 + Math.abs(c) * 0.04 * run, head: -0.05 - run * 0.1 };
  }
  // Trikot mit Muster je Verein (Streifen, Ringel, Seitenbahnen) – zwischengespeichert
  teamShirt(T, ti) {
    this.shirts ||= new Map(); const key = T.short + ti; if (this.shirts.has(key)) return this.shirts.get(key);
    const { DynamicTexture, StandardMaterial, Color3 } = B, tex = new DynamicTexture('shirt' + key, { width: 256, height: 128 }, this.scene, true), g = tex.getContext();
    const h = [...(T.short || '')].reduce((a, ch) => a + ch.charCodeAt(0), 0), kind = T.me ? 'panel' : ['stripes', 'hoops', 'sash', 'plain', 'stripes'][h % 5];
    g.fillStyle = T.color; g.fillRect(0, 0, 256, 128); g.fillStyle = T.color2 || '#000';
    if (kind === 'stripes') for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 12, 128);
    else if (kind === 'hoops') for (let y = 8; y < 128; y += 28) g.fillRect(0, y, 256, 11);
    else if (kind === 'sash') { g.save(); g.translate(128, 64); g.rotate(-0.5); g.fillRect(-160, -10, 320, 20); g.restore(); }
    else if (kind === 'panel') { g.globalAlpha = 0.55; g.fillRect(52, 0, 16, 128); g.fillRect(188, 0, 16, 128); g.globalAlpha = 1; }
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, 256, 5); // Kragen
    tex.update();
    const m = new StandardMaterial('shm' + key, this.scene); m.diffuseTexture = tex; m.specularColor = new Color3(0.12, 0.12, 0.12);
    this.shirts.set(key, m); return m;
  }
  teamCrest(T, ti) {
    this.crests ||= new Map(); const key = T.short + ti; if (this.crests.has(key)) return this.crests.get(key);
    const { DynamicTexture, StandardMaterial, Color3 } = B, tex = new DynamicTexture('cr' + key, { width: 64, height: 64 }, this.scene, true), g = tex.getContext(); tex.hasAlpha = true;
    g.clearRect(0, 0, 64, 64); g.fillStyle = T.color2 || '#000'; g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.moveTo(32, 4); g.lineTo(58, 12); g.lineTo(58, 34); g.quadraticCurveTo(58, 52, 32, 60); g.quadraticCurveTo(6, 52, 6, 34); g.lineTo(6, 12); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((T.short || '?')[0], 32, 34); tex.update();
    const m = new StandardMaterial('crm' + key, this.scene); m.diffuseTexture = tex; m.opacityTexture = tex; m.specularColor = Color3.Black(); this.crests.set(key, m); return m;
  }
  figure(p) {
    const { MeshBuilder, DynamicTexture, StandardMaterial, Color3, Mesh } = B, scene = this.scene, T = this.M.teams[p.team];
    const gk = p.pos === 'TW', h = (p.num * 7 + p.team * 13 + (p.name || '').length);
    const shirt = gk ? (p.team === 0 ? '#ffd166' : '#9ad0ff') : T.color, shorts = gk ? '#222222' : T.color2;
    if (this.rig) {
      const nt = new DynamicTexture('num' + p.id, { width: 128, height: 128 }, scene, false); nt.hasAlpha = true; const c = nt.getContext(); c.clearRect(0, 0, 128, 128);
      c.fillStyle = gk ? '#222' : (T.color2 && T.color2 !== shirt ? (T.me ? '#ffffff' : T.color2) : '#fff'); c.font = 'bold 84px "Space Grotesk", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(p.num), 64, 70); nt.update();
      const numMat = new StandardMaterial('nm' + p.id, scene); numMat.diffuseTexture = nt; numMat.opacityTexture = nt; numMat.specularColor = Color3.Black(); numMat.zOffset = -2;
      const fig = this.rigFigure({ shirt, shorts, socks: gk ? '#222222' : shirt, trim: gk ? '#111111' : (T.color2 || '#000'), skin: SKIN[h % SKIN.length], skinT: [0, 0, 0.25, 0.5, 0.8, 1][(h >> 2) % 6], hair: ['#2a1a0e', '#111111', '#6b4423', '#b58a3c', '#3b2a1a', '#8a8a8a'][h % 6], gloves: gk ? '#f2f2f2' : null, longSleeves: gk, numMat, crest: this.teamCrest(T, p.team), female: isFemale(p) }, isFemale(p) && this.rigF ? 1.4 : 1.45);
      const tex = new DynamicTexture('lbl' + p.id, { width: 512, height: 192 }, scene, false); tex.hasAlpha = true;
      const plane = MeshBuilder.CreatePlane('lbl', { width: 2.4 / fig.scale, height: 0.9 / fig.scale }, scene); plane.position.y = 2.15; plane.parent = fig.root; plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
      const lm = new StandardMaterial('lm', scene); lm.diffuseTexture = tex; lm.opacityTexture = tex; lm.emissiveColor = new Color3(1, 1, 1); lm.disableLighting = true; lm.backFaceCulling = false; plane.material = lm; plane.isPickable = false;
      Object.assign(fig, { plane, tex, state: '', gk }); this.label(fig, p); (this.kickers ||= []).push(fig);
      return fig;
    }
    const fig = this.body({ shirt, shirtMat: gk ? null : this.teamShirt(T, p.team), crest: this.teamCrest(T, p.team), shorts, socks: gk ? '#222222' : shirt, skin: SKIN[h % SKIN.length], hair: ['#2a1a0e', '#111111', '#6b4423', '#b58a3c', '#3b2a1a', '#8a8a8a'][h % 6], hairStyle: h % 4, gloves: gk ? '#f2f2f2' : null, longSleeves: gk });
    // Rückennummer
    const nt = new DynamicTexture('num' + p.id, { width: 128, height: 128 }, scene, false); nt.hasAlpha = true; const c = nt.getContext(); c.clearRect(0, 0, 128, 128);
    c.fillStyle = gk ? '#222' : (T.color2 || '#000'); c.font = 'bold 84px "Space Grotesk", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(p.num), 64, 70); nt.update();
    const nm = new StandardMaterial('nm' + p.id, scene); nm.diffuseTexture = nt; nm.opacityTexture = nt; nm.specularColor = Color3.Black(); nm.backFaceCulling = true;
    const np = MeshBuilder.CreatePlane('num', { width: 0.3, height: 0.3 }, scene); np.parent = fig.j.spine; np.position.set(0, 0.32, -0.215); np.rotation.y = Math.PI; np.rotation.x = -0.08; np.material = nm; np.isPickable = false;
    // Schild mit Nummer und Name
    const tex = new DynamicTexture('lbl' + p.id, { width: 512, height: 192 }, scene, false); tex.hasAlpha = true;
    const plane = MeshBuilder.CreatePlane('lbl', { width: 2.4, height: 0.9 }, scene); plane.position.y = 2.45; plane.parent = fig.root; plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    const lm = new StandardMaterial('lm', scene); lm.diffuseTexture = tex; lm.opacityTexture = tex; lm.emissiveColor = new Color3(1, 1, 1); lm.disableLighting = true; lm.backFaceCulling = false; plane.material = lm; plane.isPickable = false;
    Object.assign(fig, { plane, tex, state: '', gk });
    this.label(fig, p);
    return fig;
  }
  label(fig, p) {
    const T = this.M.teams[p.team], key = `${p.num}|${p.yellow}|${p.red}|${p.injured}|${p === this.M.ball.owner}`; if (fig.state === key) return; fig.state = key;
    const c = fig.tex.getContext(); c.clearRect(0, 0, 512, 192);
    const name = (p.nick || p.name || '').split(' ').slice(-1)[0].slice(0, 12);
    c.fillStyle = 'rgba(5,12,10,0.74)'; c.beginPath(); c.roundRect(56, 20, 400, 152, 30); c.fill();
    c.fillStyle = p.pos === 'TW' ? '#ffd166' : T.color; c.font = 'bold 92px "Space Grotesk", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(String(p.num), 80, 96);
    c.fillStyle = '#fff'; c.font = '600 62px "Space Grotesk", sans-serif'; c.fillText(name, 200, 96);
    if (p.yellow) { c.fillStyle = p.red ? '#ff3b3b' : '#ffd400'; c.fillRect(420, 36, 24, 36); }
    if (p.injured) { c.fillStyle = '#ff4d4d'; c.beginPath(); c.arc(432, 140, 16, 0, Math.PI * 2); c.fill(); }
    fig.tex.update();
  }
  // ---------- Laufzeit ----------
  // Ereignisse aus dem Spiel: Parade, Grätsche, Tor (Publikum)
  onEvent(e, M) {
    const now = performance.now();
    const act = (pl, kind, extra = {}) => { const c = ONCE[kind]; this.anim.set(pl, { kind, until: now + (c ? c.len / c.sp * 1000 : 900), t0: now, ...extra }); };
    if (e.type === 'save' || e.type === 'pen_save') {
      const k = M.keeper(1 - e.team); if (!k) return; const f = this.figs.get(k), b = M.ball;
      // Seite aus Sicht des Torwarts: Ball links oder rechts der Blickrichtung
      const fy = f ? f.root.rotation.y : 0, rx = b.x - k.x, rz = b.y - k.y, cross = Math.sin(fy) * rz - Math.cos(fy) * rx, side = cross > 0 ? -1 : 1;
      if (this.mx) { if (Math.hypot(rx, rz) < 1.6 || Math.random() < 0.25) act(k, 'catch'); else act(k, side < 0 ? 'diveL' : 'diveR'); }
      else this.anim.set(k, { kind: 'dive', until: now + 900, side, t0: now });
    }
    else if ((e.type === 'header' || e.type === 'clear') && e.p && this.mx) act(e.p, 'header');
    else if ((e.type === 'claim') && this.mx) { const k = M.keeper(1 - e.team); if (k) act(k, 'catch'); }
    else if (e.type === 'tackle' && e.p) { if (this.mx) act(e.p, 'tackle'); else this.anim.set(e.p, { kind: 'slide', until: now + 700 }); }
    else if (e.type === 'injury' && e.p && this.mx) act(e.p, 'trip', { next: { kind: 'down', ms: 2200, then: 'standup' } });
    else if (e.type === 'goal') { this.crowdPulse = 1; const gx = M.goalOf(e.team).x; this.netHit = { side: gx > PW / 2 ? 1 : 0, t: performance.now() }; }
    else if (e.type === 'yellow' || e.type === 'red') { if (e.p) this.anim.set(e.p, { kind: 'protest', until: now + 1500 }); }
  }
  // Torwiederholung: letzte Sekunden aus einer Kamera hinter dem Tor, in Zeitlupe. Gibt die Dauer in ms zurück (0 = keine Aufnahme).
  startReplay(M, team) {
    const now = performance.now(), frames = this.hist.filter(h => h.t > now - 3200); if (frames.length < 20) return 0;
    const g = M.goalOf(team), slow = 0.55; this.replay = { frames, t0: now, slow, g, dur: (frames[frames.length - 1].t - frames[0].t) / slow + 600 };
    return this.replay.dur;
  }
  stopReplay() { this.replay = null; }
  // Höhepunkte für den Zusammenschnitt nach dem Spiel: die letzten Sekunden bis zum Ereignis
  recordClip(M, e, label) {
    const now = performance.now(), frames = this.hist.filter(h => h.t > now - 3600); if (frames.length < 8) return;
    (this.clips ||= []).push({ frames, team: e.team, label, kind: e.type }); if (this.clips.length > 10) this.clips.splice(this.clips.findIndex(c => c.kind !== 'goal'), 1);
  }
  playClip(M, clip) { const now = performance.now(), slow = clip.kind === 'goal' ? 0.6 : 0.75; this.replay = { frames: clip.frames, t0: now, slow, g: M.goalOf(clip.team), dur: (clip.frames[clip.frames.length - 1].t - clip.frames[0].t) / slow + 700 }; return this.replay.dur; }
  // Tageszeit: Tag (Heimspiel) oder Flutlicht (Auswärts / Intro)
  setDaylight(day) {
    const { Color4, Color3 } = B; this.day = day;
    this.scene.clearColor = day ? new Color4(0.55, 0.72, 0.9, 1) : new Color4(0.012, 0.03, 0.028, 1);
    this.hemi.intensity = day ? 1.0 : 0.75; this.sun.intensity = day ? 1.25 : 0.95; this.hemi.groundColor = day ? new Color3(0.2, 0.3, 0.2) : new Color3(0.08, 0.15, 0.1);
    this.setLamps(day ? 0 : 1); this.updateSky();
  }
  // Himmelskuppel mit echten Himmelsfotos (Poly Haven, CC0): Sonne mit Wolken, bedeckt, Nacht
  updateSky() {
    const { MeshBuilder, StandardMaterial, Texture, Color3, Mesh } = B, w = this.weatherKind || 'sun';
    const want = !this.day ? 'night' : w === 'sun' ? 'day' : 'grey'; if (this.skyKind === want) return; this.skyKind = want;
    if (!this.sky) { const m = MeshBuilder.CreateSphere('sky', { diameter: 900, segments: 24, sideOrientation: Mesh.BACKSIDE }, this.scene); m.position.set(PW / 2, -170, PH / 2); m.isPickable = false; m.infiniteDistance = false; const mat = new StandardMaterial('skyM', this.scene); mat.disableLighting = true; mat.backFaceCulling = false; mat.fogEnabled = false; m.material = mat; this.sky = m; this.skyTex = {}; }
    const t = this.skyTex[want] ||= (() => { const tx = new Texture(`/img/sky-${want}.jpg`, this.scene, false, false, Texture.TRILINEAR_SAMPLINGMODE, () => { if (this.skyKind === want && this.sky) this.sky.setEnabled(true); }); tx.uScale = -1; tx.wrapU = Texture.WRAP_ADDRESSMODE; return tx; })();
    this.sky.setEnabled(t.isReady()); this.sky.material.emissiveTexture = t; this.sky.material.diffuseColor = Color3.Black(); this.sky.material.emissiveColor = Color3.Black(); this.sky.material.specularColor = Color3.Black();
  }
  setLamps(level) { const { Color3 } = B; this.lampLevel = level; for (const l of this.lamps) l.material.emissiveColor = new Color3(1, 0.96, 0.85).scale(level); if (!this.day) { this.hemi.intensity = 0.25 + 0.5 * level; this.sun.intensity = 0.2 + 0.75 * level; } }
  // Kamerafahrt (Intro): { alpha, beta, radius, tx, tz } oder null
  // Kamera nie hinter oder in die Tribünen: Abstand entlang der Blickrichtung so weit verkürzen, dass sie vor jeder Tribünenebene bleibt
  keepCamInside() {
    const P = this.camPlanes; if (!P) return; const c = this.cam, t = c.target, m = 3.2;
    const rmax = (beta) => { const sb = Math.sin(beta), dx = Math.cos(c.alpha) * sb, dy = Math.cos(beta), dz = Math.sin(c.alpha) * sb; let r = Infinity;
      for (const { c: p, n } of P) { const dn = dx * n.x + dy * n.y + dz * n.z, t0 = (t.x - p.x) * n.x + (t.y - p.y) * n.y + (t.z - p.z) * n.z; if (dn < -1e-4) r = Math.min(r, (t0 - m) / -dn); } return r; };
    if (rmax(c.beta) >= c.radius) return;
    // zuerst etwas höher gehen (Blick von oben über die Bande), erst dann näher heran
    if (!this.cine) for (let bb = c.beta - 0.04; bb >= 0.45; bb -= 0.04) if (rmax(bb) >= c.radius * 0.8) { c.beta = bb; c.radius = Math.min(c.radius, rmax(bb)); return; }
    c.radius = Math.max(6, rmax(c.beta));
  }
  setCine(c) { this.cine = c; }
  // Wetter: Regen/Schnee als Partikel, Himmel und Licht passend
  setWeather(w) {
    const { ParticleSystem, Vector3, Color4, Color3 } = B; this.weatherKind = w;
    if (this.wps) { this.wps.dispose(); this.wps = null; }
    if (w === 'rain' || w === 'snow') {
      const ps = this.wps = new ParticleSystem('weather', w === 'rain' ? 4000 : 2500, this.scene); ps.particleTexture = this.ptex;
      ps.emitter = new Vector3(PW / 2, 34, PH / 2); ps.minEmitBox = new Vector3(-PW * 0.75, 0, -PH * 0.8); ps.maxEmitBox = new Vector3(PW * 0.75, 4, PH * 0.8);
      if (w === 'rain') { ps.minSize = 0.06; ps.maxSize = 0.1; ps.minScaleY = 7; ps.maxScaleY = 10; ps.emitRate = 2600; ps.direction1 = new Vector3(-1, -30, 0); ps.direction2 = new Vector3(1, -36, 0); ps.minLifeTime = 1.0; ps.maxLifeTime = 1.2; ps.color1 = new Color4(0.75, 0.85, 1, 0.45); ps.color2 = new Color4(0.7, 0.8, 1, 0.3); ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED; }
      else { ps.minSize = 0.18; ps.maxSize = 0.35; ps.emitRate = 900; ps.direction1 = new Vector3(-2, -5, -1); ps.direction2 = new Vector3(2, -7, 1); ps.minLifeTime = 5; ps.maxLifeTime = 7; ps.color1 = new Color4(1, 1, 1, 0.9); ps.color2 = new Color4(0.9, 0.95, 1, 0.7); }
      ps.minEmitPower = 1; ps.maxEmitPower = 1; ps.updateSpeed = 0.016; ps.colorDead = new Color4(1, 1, 1, 0); ps.blendMode = ParticleSystem.BLENDMODE_STANDARD; ps.preWarmCycles = 60; ps.start();
    }
    if (this.day) this.scene.clearColor = w === 'sun' ? new Color4(0.55, 0.72, 0.9, 1) : w === 'snow' ? new Color4(0.78, 0.8, 0.84, 1) : new Color4(0.42, 0.47, 0.52, 1);
    this.updateSky();
    this.weatherDim = w === 'rain' ? 0.8 : w === 'snow' ? 0.92 : w === 'wind' ? 0.95 : 1;
    if (this.ground && w === 'snow') this.ground.material.diffuseColor = new Color3(1.15, 1.18, 1.2); else if (this.ground) this.ground.material.diffuseColor = new Color3(1, 1, 1);
    // nasser Rasen glänzt im Regen
    if (this.ground) { const gm = this.ground.material, wet = w === 'rain'; gm.specularColor = wet ? new Color3(0.32, 0.36, 0.32) : new Color3(0.07, 0.1, 0.07); gm.specularPower = wet ? 48 : 18; }
  }
  // Stimmung nach dem Spiel: Gewinner jubeln, Verlierer hängen die Köpfe (team: Index oder null)
  setMood(winTeam, ms = 6000) { this.mood = winTeam === null || winTeam === undefined ? null : { win: winTeam, until: performance.now() + ms }; }
  // Feuerwerk an/aus (Meisterfeier)
  setFireworks(on) { this.fw = on; }
  // Torjubel: Schütze reißt die Arme hoch, Kamera fährt heran
  celebrate(p) { if (p) this.celeb = { p, until: performance.now() + 2100 }; }
  resize(w, h) { this.w = w; this.h = h; this.rot = h > w * 1.15; this.engine.resize(); this.cam.fov = this.rot ? 0.95 : 0.78; }
  goalFlash(team) { this.flash = 1; this.shake = 0.7; }
  burst(x, y, color) {
    const { Color4, Color3 } = B; const c = Color3.FromHexString(color);
    this.ps.emitter.set(x, 0.6, y); this.ps.color1 = new Color4(1, 1, 1, 1); this.ps.color2 = new Color4(c.r, c.g, c.b, 1); this.ps.manualEmitCount = 160;
  }
  buildRef() {
    if (this.rig) { const f = this.rigFigure({ shirt: '#1c1c1c', shorts: '#111111', socks: '#1c1c1c', trim: '#ffd400', skin: '#e0ac69', skinT: 0.3, hair: '#3b2a1a', boots: '#0d0d0d' }, 1.3); return Object.assign(f, { x: PW / 2 + 8, y: PH / 2 + 6 }); }
    const f = this.body({ shirt: '#1c1c1c', shorts: '#111111', socks: '#1c1c1c', skin: '#e0ac69', hair: '#3b2a1a', hairStyle: 2 }, 1.28);
    return Object.assign(f, { x: PW / 2 + 8, y: PH / 2 + 6 });
  }
  syncRoster(M) {
    if (!this.ref) this.ref = this.buildRef();
    if (this.M !== M) { this.figCheck = null; this.clips = []; this.crowdColors(M); for (const f of this.figs.values()) this.disposeFig(f); this.figs.clear(); this.M = M; this.flight = null; this.camT = null; }
    for (const p of M.players) { if (p.out) { const f = this.figs.get(p); if (f) f.root.setEnabled(false); continue; } if (!this.figs.has(p)) this.figs.set(p, this.figure(p)); }
  }
  ballHeight(M) {
    const b = M.ball;
    if (b.mode === 'held' || b.mode === 'loose') { this.flight = null; return 0; }
    if (!this.flight || this.flight.mode !== b.mode || this.flight.from !== b.from || this.flight.shooter !== b.shooter) {
      let end; if (b.mode === 'pass' && b.target) end = { x: b.target.x, y: b.target.y }; else if (b.mode === 'shot') end = M.goalOf(b.shooter.team); else end = { x: b.x + b.vx, y: b.y + b.vy };
      const total = Math.max(2, dist(b, end)); const r = Math.random();
      const h = b.mode === 'shot' ? (b.header ? 0.4 : b.freekick ? 1.4 + r * 0.8 : r < 0.5 ? 0.3 + r : 1.2 + r * 1.2) : b.cross ? 3 + r * 2 : (total > 22 ? 2 + Math.min(4, total / 10) * r : r < 0.35 ? 0.6 + r : 0);
      this.flight = { mode: b.mode, from: b.from, shooter: b.shooter, start: { x: b.x, y: b.y }, total, h, base: b.mode === 'shot' && b.header ? 2.3 : 0 }; this.lastFlightH = h;
    }
    const f = this.flight, pr = Math.min(1, dist(f.start, b) / f.total);
    return f.base * (1 - pr) + f.h * 4 * pr * (1 - pr);
  }
  // Welche Schuss-/Passbewegung passt? (Torwart: Abwurf oder Abstoß, lange Bälle als Chip, Schüsse aus dem Stand oder Lauf)
  actionFor(k, b, M, now) {
    const f = this.figs.get(k), v = f ? Math.hypot(f.mvx || 0, f.mvy || 0) : 0, len = b.mode === 'pass' && b.target ? Math.hypot(b.target.x - k.x, b.target.y - k.y) : 0;
    let kind = b.throwIn ? 'throw' : b.mode === 'shot' ? (v < 1.2 ? 'penalty' : 'shot') : k.pos === 'TW' ? (len > 32 || Math.random() < 0.4 ? 'gkkick' : 'throw') : len > 28 ? 'chip' : 'pass';
    if (!this.mx) kind = k.pos === 'TW' && b.mode === 'pass' && this.rig && Math.random() < 0.5 ? 'throw' : 'kick';
    const c = ONCE[kind]; return { kind, until: now + (c && this.mx ? c.len / c.sp * 1000 : kind === 'throw' ? 650 : 420), t0: now };
  }
  // Modellfigur: Laufen/Sprinten/Stehen gemischt, Sonderaktionen als eigene Animationen
  driveRig(f, p, s, dt) {
    const { v, run, sprint, an, now } = s, MX = this.mx; let tw, sp = {}, rate = 8, once = null;
    f.root.position.y = 0; f.root.rotation.z = an ? 0 : (f.leanZ || 0);
    const cfg = an && MX ? ONCE[an.kind] : null;
    if (cfg) { once = { n: cfg.n, key: an.t0, from: cfg.from, sp: cfg.sp }; tw = { [cfg.n]: 1 }; rate = 20; }
    else if (an && an.kind === 'down') tw = MX ? { M_fallen: 1 } : { Crouch_Idle_Loop: 1 };
    else if (an && an.kind === 'slide' || an && an.kind === 'tackle') { tw = { Slide_Loop: 1 }; rate = 14; }
    else if (an && (an.kind === 'dive' || an.kind === 'diveL' || an.kind === 'diveR')) { const k = 1 - (an.until - now) / 950, kk = Math.sin(Math.min(1, k * 1.25) * Math.PI); f.root.rotation.z = (an.side || 1) * 1.3 * kk; f.root.position.y = 0.5 * kk; tw = { Jump_Loop: 1 }; rate = 16; }
    else if (an && an.kind === 'protest') tw = { Idle_No_Loop: 1 };
    else if (an && an.kind === 'throw') { tw = { OverhandThrow: 1 }; sp = { OverhandThrow: 1.6 }; rate = 14; }
    else if (s.celebrating || s.happy) {
      if (MX) { const scorer = p === this.celeb?.p; tw = scorer ? { M_cheer: 1 } : s.happy ? (p.num % 3 === 0 ? { M_victory: 1 } : p.num % 3 === 1 ? { M_cheer: 1 } : { M_fistpump: 1 }) : (p.num % 2 ? { M_fistpump: 1 } : { M_cheer: 1 }); sp = { M_cheer: 1.1, M_fistpump: 1.1, M_victory: 1 }; }
      else { tw = (p.num % 2 || p === this.celeb?.p) ? { Dance_Loop: 1 } : { Yes: 1 }; sp = { Dance_Loop: 1.15, Yes: 1.1 }; }
    }
    else if (s.sad) { tw = { Idle_No_Loop: 1 }; sp = { Idle_No_Loop: 0.55 }; }
    else if (p.injured) tw = MX ? { M_fallen: 1 } : { Crouch_Idle_Loop: 1 };
    else if (s.ready && MX) {
      // Torwart: Bereitschaft, seitliche Schritte je nach Bewegungsrichtung
      const fw = f.root.rotation.y, lat = Math.cos(fw) * (f.mvx || 0) - Math.sin(fw) * (f.mvy || 0);
      if (v > 0.6) { tw = lat > 0 ? { M_gkstepR: 1 } : { M_gkstepL: 1 }; sp = { M_gkstepL: Math.max(0.7, Math.min(1.6, v / 2.4)), M_gkstepR: Math.max(0.7, Math.min(1.6, v / 2.4)) }; }
      else tw = { M_gkidle: 1 };
    }
    else if (s.ready) tw = { Crouch_Idle_Loop: 1 };
    else {
      const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
      const walkIn = ss(0.25, 1.1, v), jogIn = ss(1.6, 3.4, v), sprIn = ss(6.2, 8.2, v);
      const idleN = MX && !f.gk && !f.ref ? 'M_offidle' : MX && f.gk ? 'M_gkidle' : 'Idle_Loop', jogN = MX ? (s.owner ? 'M_dribble' : 'M_jog') : 'Jog_Fwd_Loop';
      tw = { [idleN]: 1 - walkIn, Walk_Loop: walkIn * (1 - jogIn), [jogN]: jogIn * (1 - sprIn), Sprint_Loop: sprIn };
      sp = { Walk_Loop: Math.max(0.6, Math.min(1.5, v / 2.0)), [jogN]: Math.max(0.7, Math.min(1.6, v / (MX ? 4.0 : 4.4))), Sprint_Loop: Math.max(0.8, Math.min(1.5, v / 8.6)), [idleN]: 1 };
    }
    if (an && an.kind === 'kick' && !MX) { f.kick = { until: an.until, len: 420 }; }
    this.rigAnim(f, tw, dt, sp, rate, once);
  }
  draw(M, dt) {
    if (!M) return; this.t += dt; this.syncRoster(M);
    this.checkFigs(performance.now());
    const { Vector3 } = B, now = performance.now();
    // Wiederholung: Positionen aus der Aufzeichnung statt aus dem Spiel
    let b = M.ball, rp = null;
    if (this.replay) {
      const R = this.replay, tt = R.frames[0].t + (now - R.t0) * R.slow; let i = 0; while (i < R.frames.length - 1 && R.frames[i + 1].t < tt) i++;
      rp = R.frames[Math.min(i, R.frames.length - 1)]; b = rp.ball;
      if (now - R.t0 > R.dur) { this.replay = null; rp = null; b = M.ball; }
    }
    // Abschlag/Pass: Beinschwung des Schützen, Kick-Sound-Hinweis
    if (!rp) { if (this.prevMode === 'held' && (b.mode === 'pass' || b.mode === 'shot')) { const k = b.mode === 'pass' ? b.from : b.shooter; if (k) this.anim.set(k, this.actionFor(k, b, M, now)); this.kicked = true; }
      if (this.mx && this.prevMode === 'pass' && b.mode === 'held' && b.owner && this.lastFlightH > 1.6 && b.owner.pos !== 'TW') { const c = ONCE.header; this.anim.set(b.owner, { kind: 'header', t0: now, until: now + c.len / c.sp * 1000 }); } this.prevMode = b.mode; }
    // Spieler
    for (const [p, f] of this.figs) {
      if (p.out) continue; f.root.setEnabled(true);
      const rpp = rp ? rp.pl.get(p) : null; const px = rpp ? rpp.x : p.x, py = rpp ? rpp.y : p.y, pvx = rpp ? rpp.vx : p.vx, pvy = rpp ? rpp.vy : p.vy;
      // tatsächliche Bewegung auf dem Bildschirm (steht das Spiel, stehen auch die Figuren still)
      let mvx = 0, mvy = 0; if (f.prev && dt > 0) { mvx = (px - f.prev.x) / dt; mvy = (py - f.prev.y) / dt; if (Math.hypot(mvx, mvy) > 16) { mvx = 0; mvy = 0; } } f.prev = { x: px, y: py };
      const kv = Math.min(1, dt * 7); f.mvx = (f.mvx || 0) + (mvx - (f.mvx || 0)) * kv; f.mvy = (f.mvy || 0) + (mvy - (f.mvy || 0)) * kv;
      const v = Math.hypot(f.mvx, f.mvy), run = Math.min(1, v / 6), sprint = Math.max(0, Math.min(1, (v - 6) / 3));
      f.phase += dt * (3 + v * 1.35);
      f.root.position.set(px, 0, py); f.root.rotation.z = 0; f.root.rotation.x = 0;
      const ry0 = f.root.rotation.y;
      if (v > 0.8 && !(f.gk && v < 3.5 && b.owner !== p)) { const ty = Math.atan2(f.mvx, f.mvy); let d = ty - f.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); f.root.rotation.y += d * Math.min(1, dt * (v > 6 ? 5.5 : v > 3 ? 8 : 11)); }
      else { const ty = Math.atan2(b.x - px, b.y - py); let d = ty - f.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); f.root.rotation.y += d * Math.min(1, dt * 4); }
      // in Kurven leicht nach innen neigen (je schneller, desto mehr)
      { let dr = f.root.rotation.y - ry0; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); const turn = dt > 0 ? dr / dt : 0, want = Math.max(-0.14, Math.min(0.14, -turn * v * 0.01)); f.leanZ = (f.leanZ || 0) + (want - (f.leanZ || 0)) * Math.min(1, dt * 6); }
      let P = this.runPose(f.phase, run, sprint);
      f.root.position.y = run > 0.15 ? Math.max(0, Math.sin(f.phase * 2)) * 0.05 * run : 0;
      if (run < 0.15) { const br = Math.sin(this.t * 2 + p.num) * 0.02; P = { lean: 0.08 + br, knL: 0.14, knR: 0.12, hipL: -0.05, hipR: 0.04, shL: 0.05, shR: -0.05, elL: -0.35, elR: -0.3, head: 0.02 }; }
      // Torwart: Bereitschaftshaltung, wenn der Ball nah ist
      if (f.gk && run < 0.4 && Math.hypot(b.x - px, b.y - py) < 24) P = { lean: 0.32, drop: 0.12, hipL: -0.45, hipR: -0.45, knL: 0.8, knR: 0.8, legSpread: 0.22, shL: -0.85, shR: -0.85, spreadL: 0.45, spreadR: 0.45, elL: -0.6, elR: -0.6, head: -0.2 };
      // Ballführung: leicht gebeugt, Blick zum Ball
      if (b.owner === p && run > 0.15) { P.lean += 0.1; P.head = 0.15; }
      // Sonderanimationen: Schuss, Parade, Grätsche, Protest
      const an = this.anim.get(p);
      if (an && an.until > now) {
        const k = 1 - (an.until - now) / (an.kind === 'kick' ? 420 : an.kind === 'dive' ? 950 : an.kind === 'slide' ? 750 : 1500);
        if (an.kind === 'kick') { const back = k < 0.38, t = back ? k / 0.38 : (k - 0.38) / 0.62; P = { lean: back ? 0.05 : 0.2, hipR: back ? 0.75 * t : 0.75 - 2.1 * Math.min(1, t * 1.3), knR: back ? 1.4 * t : 1.4 * (1 - Math.min(1, t * 1.6)) + 0.05, hipL: -0.15, knL: 0.35, shL: -0.9, shR: 0.5, spreadL: 0.75, spreadR: 0.5, elL: -0.3, elR: -0.3, twist: back ? -0.25 * t : 0.3 * t, drop: 0.06, head: 0.25 }; }
        else if (an.kind === 'dive') { const kk = Math.sin(Math.min(1, k * 1.25) * Math.PI); f.root.rotation.z = an.side * 1.35 * kk; f.root.position.y = 0.55 * kk; P = { lean: 0.1, shL: -2.9 * kk, shR: -2.9 * kk, spreadL: 0.25, spreadR: 0.25, elL: -0.1, elR: -0.1, hipL: 0.1, hipR: -0.4 * kk, knL: 0.3, knR: 0.6 * kk, head: -0.2 }; }
        else if (an.kind === 'slide') { const kk = Math.sin(Math.min(1, k) * Math.PI); P = { lean: -0.6 * kk, drop: 0.55 * kk, hipL: -1.45 * kk, knL: 0.05, hipR: -0.35 * kk, knR: 1.6 * kk, shL: 0.6 * kk, shR: -0.9 * kk, spreadL: 0.6, spreadR: 0.4, elL: -0.2, elR: -0.4, head: 0.3 * kk }; }
        else if (an.kind === 'protest') { const kk = Math.abs(Math.sin(now / 160)); P = { ...P, shL: -1.5 - kk * 0.5, shR: -1.5 - kk * 0.5, spreadL: 0.8, spreadR: 0.8, elL: -0.5, elR: -0.5, lean: -0.05, head: -0.1 }; }
      } else if (an) { this.anim.delete(p); if (an.next) { const nx = an.next, c = ONCE[nx.kind]; this.anim.set(p, { kind: nx.kind, t0: now, until: now + (nx.ms || (c ? c.len / c.sp * 1000 : 1000)), next: nx.then ? { kind: nx.then } : null }); } }
      const celebrating = this.celeb && this.celeb.until > now && p.team === this.celeb.p.team && (p === this.celeb.p || Math.hypot(p.x - this.celeb.p.x, p.y - this.celeb.p.y) < 12);
      const happy = this.mood && this.mood.until > now && p.team === this.mood.win, sad = this.mood && this.mood.until > now && this.mood.win !== null && p.team !== this.mood.win;
      if (celebrating || happy) { const j = Math.abs(Math.sin(this.t * (happy ? 7 : 9) + p.num * 1.3)); P = { lean: -0.1, shL: -2.7 - j * 0.3, shR: -2.7 - j * 0.3, spreadL: 0.5, spreadR: 0.5, elL: -0.2, elR: -0.2, hipL: -0.3 * j, hipR: -0.3 * j, knL: 0.7 * j, knR: 0.7 * j, head: -0.3 }; f.root.position.y = j * (p === this.celeb?.p ? 0.55 : 0.35); }
      else if (sad) { P = { lean: 0.55, head: 0.45, shL: 0.05, shR: 0.05, spreadL: 0.05, spreadR: 0.05, elL: -0.1, elR: -0.1, knL: 0.15, knR: 0.15, hipL: -0.1, hipR: 0.05 }; f.root.position.y = 0; }
      if (p.injured) { P.lean = 0.45; P.knL = 0.6; P.shR = -0.6; P.elR = -1.4; }
      if (f.rig) { this.driveRig(f, p, { v, run, sprint, owner: b.owner === p, an: an && an.until > now ? an : null, celebrating, happy, sad, ready: f.gk && run < 0.4 && Math.hypot(b.x - px, b.y - py) < 24, now }, dt); const showLbl = this.labels && (this.camMode === 'tv' || this.camMode === 'top' || (this.camMode === 'auto' && this.cam.radius > 33) || b.owner === p); f.plane.setEnabled(showLbl); if (showLbl) this.label(f, p); continue; }
      { const want = !this.noFaces && (!!this.cine || this.camMode === 'near' || this.camMode === 'goal' || (this.camMode === 'auto' && this.cam.radius < 30) || !!this.celeb); if (f.face && f.faceOn !== want) { f.faceOn = want; for (const m of f.face) m.setEnabled(want); } }
      // Kopf folgt dem Ball
      { const ang = Math.atan2(b.x - px, b.y - py) - f.root.rotation.y; P.headYaw = Math.max(-0.9, Math.min(0.9, Math.atan2(Math.sin(ang), Math.cos(ang)))); }
      this.blendPose(f, P, dt, an && an.until > now ? 22 : 12);
      const showLbl = this.labels && (this.camMode === 'tv' || this.camMode === 'top' || (this.camMode === 'auto' && this.cam.radius > 33) || b.owner === p); f.plane.setEnabled(showLbl); if (showLbl) this.label(f, p);
    }
    // Ball
    const h = rp ? (b.h || 0) : this.ballHeight(M); this.ballH = rp ? h : lerp(this.ballH, h, Math.min(1, dt * 12));
    let bx = b.x, bz = b.y;
    if (!rp && b.owner && this.figs.get(b.owner)) { const f = this.figs.get(b.owner), sp = Math.hypot(b.owner.vx, b.owner.vy), off = 0.55 + (sp > 1 ? 0.45 * Math.abs(Math.sin(f.phase)) : 0); bx = b.owner.x + Math.sin(f.root.rotation.y) * off * f.scale; bz = b.owner.y + Math.cos(f.root.rotation.y) * off * f.scale; }
    this.ballVis = this.ballVis || { x: bx, z: bz }; const kb = Math.min(1, dt * 18); this.ballVis.x += (bx - this.ballVis.x) * kb; this.ballVis.z += (bz - this.ballVis.z) * kb;
    if (b.mode === 'shot' || b.mode === 'pass' || rp) { this.ballVis.x = bx; this.ballVis.z = bz; }
    const bvx = this.ballVis.x, bvz = this.ballVis.z;
    this.trail.emitter = this.ball.position; this.trail.emitRate = b.mode === 'shot' && !rp ? 260 : 0;
    // Netz wölbt sich nach einem Tor
    if (this.netHit && this.nets) { const t = (now - this.netHit.t) / 1000, n = this.nets[this.netHit.side]; if (n) { const a = t < 1.5 ? Math.sin(t * 9) * Math.exp(-t * 2.6) * 0.9 : 0; n.m.position.x = n.x0 + n.d * a; n.m.scaling.y = 1 + Math.abs(a) * 0.15; } if (t > 1.6) this.netHit = null; }
    // Eckfahnen flattern
    if (this.flags) this.flags.forEach((fl, i) => { fl.rotation.y = Math.sin(this.t * (this.weatherKind === 'wind' ? 6 : 2.5) + i) * (this.weatherKind === 'wind' ? 0.6 : 0.25); });
    // Anzeigetafel
    if (this.scoreTex) { const key = `${M.score[0]}:${M.score[1]}|${Math.floor(M.min)}`; if (key !== this.scoreKey) { this.scoreKey = key; const g = this.scoreTex.getContext(); g.fillStyle = '#04100a'; g.fillRect(0, 0, 1024, 256); g.fillStyle = '#3ddc84'; g.fillRect(0, 0, 1024, 10); g.font = 'bold 60px sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'right'; g.fillStyle = '#ffffff'; g.fillText((M.teams[0].short || '').toUpperCase().slice(0, 10), 370, 120); g.textAlign = 'left'; g.fillText((M.teams[1].short || '').toUpperCase().slice(0, 10), 654, 120); g.textAlign = 'center'; g.fillStyle = '#ffd166'; g.font = 'bold 110px monospace'; g.fillText(`${M.score[0]}:${M.score[1]}`, 512, 120); g.fillStyle = '#8aa79d'; g.font = 'bold 44px monospace'; g.fillText(`${Math.min(90, Math.floor(M.min))}'`, 512, 215); this.scoreTex.update(); } }
    this.ball.position.set(bvx, 0.25 + this.ballH, bvz); this.ballBlob.position.x = bvx + this.ballH * 0.3; this.ballBlob.position.z = bvz - this.ballH * 0.2; const bs = 1 / (1 + this.ballH * 0.5); this.ballBlob.scaling.set(bs, bs, bs);
    const bv = Math.hypot(b.vx, b.vy); this.ball.rotation.z -= b.vx * dt * 2.2; this.ball.rotation.x += b.vy * dt * 2.2; if (bv < 0.1 && b.owner) { this.ball.rotation.z -= dt * 6; }
    // Ring unter Ballbesitzer / Fokus
    const o = rp ? null : (b.owner || this.focus); this.ring.isVisible = !!o; if (o) { this.ring.position.set(o.x, 0.06, o.y); this.ring.rotation.y += dt * 1.5; const T = M.teams[o.team]; this.ring.material.emissiveColor = B.Color3.FromHexString(T.color); this.ring.material.diffuseColor = this.ring.material.emissiveColor; }
    // Schiedsrichter: hält Abstand zum Ball, läuft mit
    if (this.ref && !rp) { const R = this.ref, tx = Math.max(6, Math.min(PW - 6, b.x - (b.x > PW / 2 ? 12 : -12))), tz = Math.max(4, Math.min(PH - 4, b.y + 9)); const dx = tx - R.x, dz = tz - R.y, d = Math.hypot(dx, dz); const sp = Math.min(6.5, d * 1.2);
      if (d > 0.3) { R.x += dx / d * sp * dt; R.y += dz / d * sp * dt; } const face = Math.atan2(b.x - R.x, b.y - R.y); let dd = face - R.root.rotation.y; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); R.root.rotation.y += dd * Math.min(1, dt * 5);
      R.phase += dt * (3 + sp * 1.35); const rr = Math.min(1, sp / 6); if (R.rig) { R.root.position.set(R.x, 0, R.y); this.rigAnim(R, rr > 0.15 ? { Jog_Fwd_Loop: 1 } : { Idle_Loop: 1 }, dt, { Jog_Fwd_Loop: Math.max(0.7, Math.min(1.5, sp / 4.2)) }); } else { R.root.position.set(R.x, rr > 0.15 ? Math.max(0, Math.sin(R.phase * 2)) * 0.04 * rr : 0, R.y); this.pose(R, rr > 0.15 ? this.runPose(R.phase, rr) : { lean: 0.04, knL: 0.08, knR: 0.08, elL: -0.25, elR: -0.25 }); } }
    if (this.ref) this.ref.root.setEnabled(!rp);
    // Aufzeichnung für die Wiederholung (letzte ~4 s)
    if (!rp && !this.cine) { const pl = new Map(); for (const [p] of this.figs) if (!p.out) pl.set(p, { x: p.x, y: p.y, vx: p.vx, vy: p.vy }); this.hist.push({ t: now, pl, ball: { x: b.x, y: b.y, h: this.ballH, mode: b.mode, owner: null } }); while (this.hist.length && this.hist[0].t < now - 4500) this.hist.shift(); }
    // Publikum pulsiert nach einem Tor
    if (this.crowd) { this.crowd.t += dt; const ex = Math.max(0, this.crowdPulse || 0); if (ex > 0.05) { this.crowd.dirty = true; this.crowdPose(Math.min(1, ex * 1.3)); } else if (this.crowd.dirty) { this.crowd.dirty = false; this.crowdPose(0); } }
    if (this.crowdPulse > 0) { this.crowdPulse -= dt * 0.5; const k = Math.max(0, this.crowdPulse); if (this.crowdMat) { this.crowdMat.diffuseTexture.vOffset = Math.sin(now / 70) * 0.006 * k; } if (this.crowdMat) this.crowdMat.emissiveColor.set(0.35 + k * 0.5 * Math.abs(Math.sin(now / 90)), 0.35 + k * 0.5 * Math.abs(Math.sin(now / 90)), 0.35 + k * 0.4); }
    // Kamera: Kamerafahrt (Intro), Wiederholung, Torjubel oder TV-Kamera, die dem Ball folgt
    const land = !this.rot;
    if (rp) { const R = this.replay, behind = R.g.x > PW / 2; this.cam.alpha = behind ? 0.15 : Math.PI - 0.15; this.cam.beta = 1.05; this.cam.radius = 44; this.cam.target.set(R.g.x + (behind ? -16 : 16), 1, PH / 2 + (b.y - PH / 2) * 0.3); this.keepCamInside(); this.scene.render(); return; }
    if (this.cine) { const c = this.cine; this.cam.alpha = c.alpha; this.cam.beta = c.beta; this.cam.radius = c.radius; this.cam.target.set(c.tx, c.ty ?? 0.5, c.tz); this.camT = null; }
    else {
      const cel = this.celeb && this.celeb.until > performance.now() && M.speed < 10 ? this.celeb : null;
      const auto = this.camMode === 'auto', aspect = Math.max(0, 1.7 - this.w / this.h);
      let tx = cel ? cel.p.x : this.camMode === 'top' ? PW / 2 + (b.x - PW / 2) * 0.35 : this.camMode === 'near' || this.camMode === 'goal' ? b.x : land ? Math.max(30, Math.min(PW - 30, b.x)) : PW / 2 + (b.x - PW / 2) * 0.25, tz = cel ? cel.p.y : land ? PH / 2 + (b.y - PH / 2) * 0.2 : PH / 2 + (b.y - PH / 2) * 0.1, ty = cel ? 1.2 : 0.5, follow = cel ? 4 : 1.6;
      const want = land ? { alpha: -Math.PI / 2, beta: 0.95, radius: 56 + aspect * 24 } : { alpha: Math.PI, beta: 0.6, radius: 80 + Math.max(0, 1.9 - this.h / this.w) * 30 };
      if (this.camMode === 'near') { want.radius = land ? 26 : 34; want.beta = land ? 1.08 : 0.85; }
      else if (this.camMode === 'top') { want.radius = land ? 92 : 110; want.beta = 0.18; }
      else if (this.camMode === 'goal') { if (b.owner) this.lastAtt = b.owner.team; const att = this.lastAtt ?? 0, gx = M.goalOf(att).x; want.alpha = gx > PW / 2 ? Math.PI : 0; want.beta = 1.05; want.radius = 36; }
      if (cel) { want.radius = 26; want.beta = 1.1; }
      else if (auto) {
        // Regie: Einstellung je nach Spielsituation (mit Mindestdauer, damit nicht hektisch geschnitten wird)
        if (b.owner) this.lastAtt = b.owner.team; else if (b.mode === 'shot' && b.shooter) this.lastAtt = b.shooter.team; else if (b.mode === 'pass' && b.from) this.lastAtt = b.from.team;
        const att = this.lastAtt ?? 0, G = M.goalOf(att), toGoal = Math.abs(b.x - G.x), nowMs = performance.now();
        let shot = M.pen ? 'pen' : M.sp ? M.sp.kind : (b.mode === 'shot' || toGoal < 30) ? 'attack' : 'mid';
        const D = this.dir || (this.dir = { shot: 'mid', since: 0 });
        if (shot !== D.shot) { const urgent = shot === 'pen' || shot === 'corner' || shot === 'fk' || D.shot === 'pen' || D.shot === 'corner' || D.shot === 'fk' || b.mode === 'shot'; if (urgent || nowMs - D.since > 1800) { D.shot = shot; D.since = nowMs; } else shot = D.shot; }
        const side = G.x > PW / 2 ? 1 : -1;
        if (shot === 'pen' || shot === 'fk') { // hinter dem Schützen auf das Tor
          const ux = G.x - b.x, uy = G.y - b.y, ul = Math.hypot(ux, uy) || 1; want.alpha = Math.atan2(-uy / ul, -ux / ul); want.beta = shot === 'pen' ? 1.22 : 1.12; want.radius = shot === 'pen' ? 15 : 20 + Math.min(10, ul * 0.2);
          tx = b.x + ux * (shot === 'pen' ? 0.55 : 0.45); tz = b.y + uy * (shot === 'pen' ? 0.55 : 0.45); ty = 1; follow = 3.5;
        } else if (shot === 'corner') { // erhöht aus dem Feld in den Strafraum
          want.alpha = side > 0 ? Math.PI - (b.y < PH / 2 ? -0.55 : 0.55) : (b.y < PH / 2 ? -0.55 : 0.55); want.beta = 0.98; want.radius = 30; tx = G.x - side * 10; tz = PH / 2 + (b.y - PH / 2) * 0.15; ty = 1; follow = 3;
        } else if (shot === 'attack') { // nah von der Seite, leicht zum Tor gedreht
          want.alpha = -Math.PI / 2 - side * 0.32; want.beta = 1.06; want.radius = 27 + aspect * 8; tx = b.x - side * 3; tz = PH / 2 + (b.y - PH / 2) * 0.55; follow = 2.4;
        } else { // Spielaufbau: klassische Seitenkamera, nah am Ball
          want.alpha = -Math.PI / 2; want.beta = 1.02; want.radius = 36 + aspect * 10; tx = Math.max(12, Math.min(PW - 12, b.x)); tz = PH / 2 + (b.y - PH / 2) * 0.45; follow = 2;
        }
        if (!land && shot !== 'pen' && shot !== 'fk') { want.alpha += Math.PI * 1.5; want.radius *= 1.3; } else if (!land) want.radius *= 1.15;
      }
      else if (land && this.camMode === 'tv') { const edge = Math.max(0, Math.abs(b.x - PW / 2) - 25) / 27.5; want.radius -= edge * 12; want.beta += edge * 0.06; } // TV-Zoom im Angriffsdrittel
      if (!this.camT) this.camT = new Vector3(tx, 0, tz);
      const k = Math.min(1, dt * follow); this.camT.x = lerp(this.camT.x, tx, k); this.camT.z = lerp(this.camT.z, tz, k); this.camTy = lerp(this.camTy ?? 0.5, ty, k);
      this.cam.target.set(this.camT.x + (this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0), this.camTy, this.camT.z + (this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0));
      const kc = Math.min(1, dt * 3); { let da = want.alpha - this.cam.alpha; da = Math.atan2(Math.sin(da), Math.cos(da)); this.cam.alpha += da * Math.min(1, dt * 2.5); } this.cam.beta = lerp(this.cam.beta, want.beta, kc); this.cam.radius = lerp(this.cam.radius, want.radius, kc);
    }
    if (this.shake > 0) this.shake -= dt;
    if (this.glows) { const cp = this.cam.position, cf = this.cam.getForwardRay(1).direction; for (const q of this.glows) { const d = q.position.subtract(cp), dl = d.length() || 1, f = Math.max(0, (d.x * cf.x + d.y * cf.y + d.z * cf.z) / dl); const v = this.day ? 0 : this.lampLevel * (0.25 + 0.75 * Math.pow(f, 6)) * (this.weatherDim || 1); q.visibility = v; q.setEnabled(v > 0.02); q.scaling.setAll(0.7 + dl / 160); } }
    const baseH = (this.day ? 1.0 : 0.25 + 0.5 * this.lampLevel) * (this.weatherDim || 1); if (this.flash > 0) { this.flash -= dt * 1.4; this.hemi.intensity = baseH + Math.max(0, this.flash) * 0.6; } else this.hemi.intensity = baseH;
    if (this.fw && performance.now() > this.fwNext) {
      const { Color4 } = B; this.fwNext = performance.now() + 350 + Math.random() * 500;
      const cols = [[1, 0.3, 0.2], [1, 0.85, 0.3], [0.3, 1, 0.55], [0.4, 0.8, 1], [1, 0.5, 1], [1, 1, 1]], c = cols[Math.floor(Math.random() * cols.length)];
      this.fwPs.emitter.set(-10 + Math.random() * (PW + 20), 22 + Math.random() * 18, -8 + Math.random() * (PH + 16)); this.fwPs.color1 = new Color4(c[0], c[1], c[2], 1); this.fwPs.color2 = new Color4(1, 1, 1, 1); this.fwPs.manualEmitCount = 160 + Math.floor(Math.random() * 120);
      this.flash = Math.max(this.flash, 0.35);
    }
    // Automatische Qualität: alle 2,5 s messen; bei Ruckeln Effekte abschalten, bei viel Luft Schatten zuschalten
    { const ft = this.lastNow ? now - this.lastNow : 16; this.lastNow = now; if (ft < 250) { this.qT += ft; this.qN++; }
      if (this.qT > 2500) { const fps = 1000 * this.qN / this.qT; this.qT = 0; this.qN = 0;
        if (fps < 42) { this.qGood = 0; if (this.shadow) this.disableShadows(); else if (this.pipe) { this.pipe.dispose(); this.pipe = null; } else if (this.quality > 0) { this.quality = 0; this.engine.setHardwareScalingLevel(Math.min(1.6, this.engine.getHardwareScalingLevel() * 1.3)); if (this.crowd && fps < 30) { this.crowd.arms.setEnabled(false); } } }
        else if (fps > (this.gfx === 'high' ? 45 : 56) && !this.cine && this.rig && !this.shadow && this.quality > 0 && this.gfx !== 'mid' && ++this.qGood >= 2 && !this.shadowTried) { this.shadowTried = true; this.enableShadows(); } } }
    this.keepCamInside();
    this.scene.render();
  }
  dispose() { this.disposed = true; if (this.kitCache) for (const t of this.kitCache.values()) t.dispose(); try { this.engine.dispose(); } catch { /* ignore */ } }
}
