// 3D-Darstellung des Spiels mit Babylon.js: Stadion, Rasen, Spielerfiguren mit Laufanimation, Ball mit Flugkurve, Kamera, Effekte.
// Gleiche Schnittstelle wie die 2D-Variante (pitch.js): resize(w, h), draw(M, dt), goalFlash(team), burst(x, y, color), focus.
import { PW, PH, GOAL_W } from './match.js';

let B = null; // Babylon-Modul (lazy)
export async function loadBabylon() {
  if (B) return B;
  try { B = await import('../vendor/babylon-lite-8b.js'); return B; } catch { return null; }
}
export function webglOk() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

const SKIN = ['#f1c9a5', '#d9a479', '#8d5524', '#c68642', '#ffdbac', '#5c3a21'];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a, b, t) => a + (b - a) * t;

export class Pitch3D {
  constructor(canvas) {
    this.c = canvas; this.M = null; this.figs = new Map(); this.t = 0; this.rot = false; this.flash = 0; this.shake = 0; this.focus = null;
    this.ballH = 0; this.flight = null; this.camT = null; this.ownerRingT = 0; this.cine = null; this.celeb = null; this.lamps = []; this.day = false; this.lampLevel = 1; this.mood = null; this.fw = false; this.fwNext = 0; this.labels = true; this.prevMode = 'held'; this.hist = []; this.replay = null; this.anim = new Map(); this.crowdPulse = 0;
    const { Engine, Scene, Color4, Vector3, HemisphericLight, DirectionalLight, ArcRotateCamera } = B;
    this.engine = new Engine(canvas, true, { stencil: false, preserveDrawingBuffer: false, antialias: true });
    this.engine.setHardwareScalingLevel(1 / Math.min(1.5, devicePixelRatio || 1));
    const scene = this.scene = new Scene(this.engine);
    scene.clearColor = new Color4(0.012, 0.03, 0.028, 1);
    scene.ambientColor = new B.Color3(0.25, 0.3, 0.28);
    this.hemi = new HemisphericLight('h', new Vector3(0.2, 1, 0.1), scene); this.hemi.intensity = 0.75; this.hemi.groundColor = new B.Color3(0.08, 0.15, 0.1);
    this.sun = new DirectionalLight('d', new Vector3(-0.45, -1, -0.35), scene); this.sun.position = new Vector3(PW * 0.7, 60, PH * 0.7); this.sun.intensity = 0.95;
    // Schatten als weiche Scheiben (zuverlässig auf jeder Hardware, günstig auf Tablets)
    this.blobMat = this.mat('blob', '#000000', { alpha: 0.38, spec: 0 });
    this.cam = new ArcRotateCamera('cam', -Math.PI / 2, 0.98, 64, new Vector3(PW / 2, 0, PH / 2), scene);
    this.cam.fov = 0.78; this.cam.minZ = 0.5; this.cam.maxZ = 600;
    this.buildStadium(); this.buildBall(); this.buildFx(); this.ref = null; this.camMode = 'tv';
    // Nachbearbeitung: Kantenglättung, leichtes Leuchten, Kontrast, Vignette – bei schwacher Hardware automatisch aus
    try {
      const pl = this.pipe = new B.DefaultRenderingPipeline('pp', false, scene, [this.cam]);
      pl.fxaaEnabled = true; pl.bloomEnabled = true; pl.bloomThreshold = 0.82; pl.bloomWeight = 0.28; pl.bloomKernel = 48; pl.bloomScale = 0.5;
      pl.imageProcessingEnabled = true; pl.imageProcessing.contrast = 1.18; pl.imageProcessing.exposure = 1.06; pl.imageProcessing.vignetteEnabled = true; pl.imageProcessing.vignetteWeight = 1.6; pl.imageProcessing.vignetteColor = new B.Color4(0, 0, 0, 0);
      pl.sharpenEnabled = true; pl.sharpen.edgeAmount = 0.25;
    } catch { this.pipe = null; }
    this.fpsT = 0; this.fpsN = 0; this.fpsChecked = false;
  }
  // ---------- Aufbau ----------
  cmat(hex, spec = 0.08) { this.mc ||= new Map(); const k = hex + spec; if (!this.mc.has(k)) this.mc.set(k, this.mat('c' + k, hex, { spec })); return this.mc.get(k); }
  mat(name, hex, o = {}) { const { StandardMaterial, Color3 } = B; const m = new StandardMaterial(name, this.scene); m.diffuseColor = Color3.FromHexString(hex); m.specularColor = new Color3(o.spec ?? 0.08, o.spec ?? 0.08, o.spec ?? 0.08); if (o.em) m.emissiveColor = Color3.FromHexString(o.em); if (o.alpha !== undefined) m.alpha = o.alpha; m.backFaceCulling = o.bfc ?? true; return m; }
  buildStadium() {
    const { MeshBuilder, DynamicTexture, StandardMaterial, Color3, Vector3 } = B, scene = this.scene;
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
      const back = MeshBuilder.CreatePlane('nb', { width: GOAL_W, height: h * 0.8 }, scene); back.position = new Vector3(x0 + d * depth, h * 0.4, PH / 2); back.rotation.y = Math.PI / 2; back.material = netM;
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
      const s = MeshBuilder.CreatePlane('stand', { width: len, height: standH }, scene); s.material = cm;
      s.position = new Vector3(cx, standH * Math.cos(tilt) / 2 + 0.3, cz); s.rotation.y = roty; s.rotation.x = -tilt;
      s.position.x += Math.sin(roty) * off; s.position.z += Math.cos(roty) * off;
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
    // Bandenwerbung
    const adTex = new DynamicTexture('ad', { width: 2048, height: 128 }, scene, false); const ac = adTex.getContext();
    const ads = ['RealCore', 'TechHub', 'Clean Core', 'SAP BTP', 'AI4BIZ', 'Z-Insight', 'realERP', 'RealCore', 'TechHub', 'Legacy League'];
    ads.forEach((a, i) => { ac.fillStyle = i % 2 ? '#0b3b22' : '#3ddc84'; ac.fillRect(i * 204.8, 0, 204.8, 128); ac.fillStyle = i % 2 ? '#3ddc84' : '#06261a'; ac.font = 'bold 44px sans-serif'; ac.textAlign = 'center'; ac.textBaseline = 'middle'; ac.fillText(a, i * 204.8 + 102, 64); }); adTex.update();
    const am = new StandardMaterial('am', scene); am.diffuseTexture = adTex; am.emissiveColor = new Color3(0.45, 0.45, 0.45); am.specularColor = Color3.Black(); am.backFaceCulling = false;
    for (const [cx, cz, ry, len] of [[PW / 2, PH + 3.2, 0, PW + 8], [PW / 2, -3.2, 0, PW + 8], [PW + 3.2, PH / 2, Math.PI / 2, PH + 6], [-3.2, PH / 2, -Math.PI / 2, PH + 6]]) {
      const b = MeshBuilder.CreatePlane('band', { width: len, height: 0.9 }, scene); b.position = new Vector3(cx, 0.45, cz); b.rotation.y = ry; b.material = am;
    }
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
    const shirt = this.cmat(c.shirt, 0.12), shorts = this.cmat(c.shorts), skin = this.cmat(c.skin, 0.05), socks = this.cmat(c.socks), boots = this.cmat(c.boots || '#151515', 0.3), hair = this.cmat(c.hair), gloves = this.cmat(c.gloves || c.skin);
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
    return { root, j, phase: Math.random() * 6, scale };
  }
  // Pose anwenden (Winkel in Radiant; x negativ = nach vorn)
  pose(f, P) {
    const j = f.j;
    j.hips.position.y = 0.98 - (P.drop || 0); j.hips.rotation.set(0, P.twist || 0, 0);
    j.spine.rotation.set(P.lean || 0, -(P.twist || 0) * 0.6, P.side || 0);
    j.head.rotation.set(P.head || 0, 0, 0);
    j.shL.rotation.set(P.shL || 0, 0, P.spreadL ?? 0.12); j.shR.rotation.set(P.shR || 0, 0, -(P.spreadR ?? 0.12));
    j.elL.rotation.set(P.elL ?? -0.35, 0, 0); j.elR.rotation.set(P.elR ?? -0.35, 0, 0);
    j.hipL.rotation.set(P.hipL || 0, 0, P.legSpread ? P.legSpread : 0); j.hipR.rotation.set(P.hipR || 0, 0, P.legSpread ? -P.legSpread : 0);
    j.knL.rotation.set(P.knL ?? 0.08, 0, 0); j.knR.rotation.set(P.knR ?? 0.08, 0, 0);
    j.ftL.rotation.set(-(P.knL ?? 0.08) * 0.4 + (P.hipL || 0) * -0.2, 0, 0); j.ftR.rotation.set(-(P.knR ?? 0.08) * 0.4 + (P.hipR || 0) * -0.2, 0, 0);
  }
  // Laufzyklus (run 0…1, Phase)
  runPose(ph, run, sprint = 0) {
    const s = Math.sin(ph), c = Math.cos(ph), amp = 0.25 + run * 0.65 + sprint * 0.15;
    const knee = (x) => 0.12 + run * (0.25 + 0.95 * Math.max(0, Math.sin(x - 0.9)));
    return { lean: 0.06 + run * 0.2 + sprint * 0.08, hipL: -s * amp, hipR: s * amp, knL: knee(ph), knR: knee(ph + Math.PI), shL: s * amp * 0.85, shR: -s * amp * 0.85, elL: -0.45 - run * 0.85, elR: -0.45 - run * 0.85, spreadL: 0.12 + run * 0.05, spreadR: 0.12 + run * 0.05, twist: s * 0.12 * run, drop: run * 0.04 + Math.abs(c) * 0.04 * run, head: -0.05 - run * 0.1 };
  }
  figure(p) {
    const { MeshBuilder, DynamicTexture, StandardMaterial, Color3, Mesh } = B, scene = this.scene, T = this.M.teams[p.team];
    const gk = p.pos === 'TW', h = (p.num * 7 + p.team * 13 + (p.name || '').length);
    const shirt = gk ? (p.team === 0 ? '#ffd166' : '#9ad0ff') : T.color, shorts = gk ? '#222222' : T.color2;
    const fig = this.body({ shirt, shorts, socks: gk ? '#222222' : shirt, skin: SKIN[h % SKIN.length], hair: ['#2a1a0e', '#111111', '#6b4423', '#b58a3c', '#3b2a1a', '#8a8a8a'][h % 6], hairStyle: h % 4, gloves: gk ? '#f2f2f2' : null, longSleeves: gk });
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
    if (e.type === 'save' || e.type === 'pen_save') { const k = M.keeper(1 - e.team); if (k) this.anim.set(k, { kind: 'dive', until: now + 900, side: Math.random() < 0.5 ? -1 : 1 }); }
    else if (e.type === 'tackle' && e.p) this.anim.set(e.p, { kind: 'slide', until: now + 700 });
    else if (e.type === 'goal') this.crowdPulse = 1;
    else if (e.type === 'yellow' || e.type === 'red') { if (e.p) this.anim.set(e.p, { kind: 'protest', until: now + 1500 }); }
  }
  // Torwiederholung: letzte Sekunden aus einer Kamera hinter dem Tor, in Zeitlupe. Gibt die Dauer in ms zurück (0 = keine Aufnahme).
  startReplay(M, team) {
    const now = performance.now(), frames = this.hist.filter(h => h.t > now - 3200); if (frames.length < 20) return 0;
    const g = M.goalOf(team), slow = 0.55; this.replay = { frames, t0: now, slow, g, dur: (frames[frames.length - 1].t - frames[0].t) / slow + 600 };
    return this.replay.dur;
  }
  stopReplay() { this.replay = null; }
  // Tageszeit: Tag (Heimspiel) oder Flutlicht (Auswärts / Intro)
  setDaylight(day) {
    const { Color4, Color3 } = B; this.day = day;
    this.scene.clearColor = day ? new Color4(0.55, 0.72, 0.9, 1) : new Color4(0.012, 0.03, 0.028, 1);
    this.hemi.intensity = day ? 1.0 : 0.75; this.sun.intensity = day ? 1.25 : 0.95; this.hemi.groundColor = day ? new Color3(0.2, 0.3, 0.2) : new Color3(0.08, 0.15, 0.1);
    this.setLamps(day ? 0 : 1);
  }
  setLamps(level) { const { Color3 } = B; this.lampLevel = level; for (const l of this.lamps) l.material.emissiveColor = new Color3(1, 0.96, 0.85).scale(level); if (!this.day) { this.hemi.intensity = 0.25 + 0.5 * level; this.sun.intensity = 0.2 + 0.75 * level; } }
  // Kamerafahrt (Intro): { alpha, beta, radius, tx, tz } oder null
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
    this.weatherDim = w === 'rain' ? 0.8 : w === 'snow' ? 0.92 : w === 'wind' ? 0.95 : 1;
    if (this.ground && w === 'snow') this.ground.material.diffuseColor = new Color3(1.15, 1.18, 1.2); else if (this.ground) this.ground.material.diffuseColor = new Color3(1, 1, 1);
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
    const f = this.body({ shirt: '#1c1c1c', shorts: '#111111', socks: '#1c1c1c', skin: '#e0ac69', hair: '#3b2a1a', hairStyle: 2 }, 1.28);
    return Object.assign(f, { x: PW / 2 + 8, y: PH / 2 + 6 });
  }
  syncRoster(M) {
    if (!this.ref) this.ref = this.buildRef();
    if (this.M !== M) { for (const f of this.figs.values()) f.root.dispose(); this.figs.clear(); this.M = M; this.flight = null; this.camT = null; }
    for (const p of M.players) { if (p.out) { const f = this.figs.get(p); if (f) f.root.setEnabled(false); continue; } if (!this.figs.has(p)) this.figs.set(p, this.figure(p)); }
  }
  ballHeight(M) {
    const b = M.ball;
    if (b.mode === 'held' || b.mode === 'loose') { this.flight = null; return 0; }
    if (!this.flight || this.flight.mode !== b.mode || this.flight.from !== b.from || this.flight.shooter !== b.shooter) {
      let end; if (b.mode === 'pass' && b.target) end = { x: b.target.x, y: b.target.y }; else if (b.mode === 'shot') end = M.goalOf(b.shooter.team); else end = { x: b.x + b.vx, y: b.y + b.vy };
      const total = Math.max(2, dist(b, end)); const r = Math.random();
      const h = b.mode === 'shot' ? (r < 0.5 ? 0.3 + r : 1.2 + r * 1.2) : (total > 22 ? 2 + Math.min(4, total / 10) * r : r < 0.35 ? 0.6 + r : 0);
      this.flight = { mode: b.mode, from: b.from, shooter: b.shooter, start: { x: b.x, y: b.y }, total, h };
    }
    const f = this.flight, pr = Math.min(1, dist(f.start, b) / f.total);
    return f.h * 4 * pr * (1 - pr);
  }
  draw(M, dt) {
    if (!M) return; this.t += dt; this.syncRoster(M);
    const { Vector3 } = B, now = performance.now();
    // Wiederholung: Positionen aus der Aufzeichnung statt aus dem Spiel
    let b = M.ball, rp = null;
    if (this.replay) {
      const R = this.replay, tt = R.frames[0].t + (now - R.t0) * R.slow; let i = 0; while (i < R.frames.length - 1 && R.frames[i + 1].t < tt) i++;
      rp = R.frames[Math.min(i, R.frames.length - 1)]; b = rp.ball;
      if (now - R.t0 > R.dur) { this.replay = null; rp = null; b = M.ball; }
    }
    // Abschlag/Pass: Beinschwung des Schützen, Kick-Sound-Hinweis
    if (!rp) { if (this.prevMode === 'held' && (b.mode === 'pass' || b.mode === 'shot')) { const k = b.mode === 'pass' ? b.from : b.shooter; if (k) this.anim.set(k, { kind: 'kick', until: now + 380, t0: now }); this.kicked = true; } this.prevMode = b.mode; }
    // Spieler
    for (const [p, f] of this.figs) {
      if (p.out) continue; f.root.setEnabled(true);
      const rpp = rp ? rp.pl.get(p) : null; const px = rpp ? rpp.x : p.x, py = rpp ? rpp.y : p.y, pvx = rpp ? rpp.vx : p.vx, pvy = rpp ? rpp.vy : p.vy;
      const v = Math.hypot(pvx, pvy), run = Math.min(1, v / 6), sprint = Math.max(0, Math.min(1, (v - 6) / 3));
      f.phase += dt * (3 + v * 1.35);
      f.root.position.set(px, 0, py); f.root.rotation.z = 0; f.root.rotation.x = 0;
      if (v > 0.3) { const ty = Math.atan2(pvx, pvy); let d = ty - f.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); f.root.rotation.y += d * Math.min(1, dt * 10); }
      else if (b.owner === p || (!rp && p.pos !== 'TW')) { const ty = Math.atan2(b.x - px, b.y - py); let d = ty - f.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); f.root.rotation.y += d * Math.min(1, dt * 4); }
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
      } else if (an) this.anim.delete(p);
      const celebrating = this.celeb && this.celeb.until > now && p.team === this.celeb.p.team && (p === this.celeb.p || Math.hypot(p.x - this.celeb.p.x, p.y - this.celeb.p.y) < 12);
      const happy = this.mood && this.mood.until > now && p.team === this.mood.win, sad = this.mood && this.mood.until > now && this.mood.win !== null && p.team !== this.mood.win;
      if (celebrating || happy) { const j = Math.abs(Math.sin(this.t * (happy ? 7 : 9) + p.num * 1.3)); P = { lean: -0.1, shL: -2.7 - j * 0.3, shR: -2.7 - j * 0.3, spreadL: 0.5, spreadR: 0.5, elL: -0.2, elR: -0.2, hipL: -0.3 * j, hipR: -0.3 * j, knL: 0.7 * j, knR: 0.7 * j, head: -0.3 }; f.root.position.y = j * (p === this.celeb?.p ? 0.55 : 0.35); }
      else if (sad) { P = { lean: 0.55, head: 0.45, shL: 0.05, shR: 0.05, spreadL: 0.05, spreadR: 0.05, elL: -0.1, elR: -0.1, knL: 0.15, knR: 0.15, hipL: -0.1, hipR: 0.05 }; f.root.position.y = 0; }
      if (p.injured) { P.lean = 0.45; P.knL = 0.6; P.shR = -0.6; P.elR = -1.4; }
      this.pose(f, P);
      const showLbl = this.labels && (this.camMode === 'tv' || this.camMode === 'top' || b.owner === p); f.plane.setEnabled(showLbl); if (showLbl) this.label(f, p);
    }
    // Ball
    const h = rp ? (b.h || 0) : this.ballHeight(M); this.ballH = rp ? h : lerp(this.ballH, h, Math.min(1, dt * 12));
    this.ball.position.set(b.x, 0.25 + this.ballH, b.y); this.ballBlob.position.x = b.x + this.ballH * 0.3; this.ballBlob.position.z = b.y - this.ballH * 0.2; const bs = 1 / (1 + this.ballH * 0.5); this.ballBlob.scaling.set(bs, bs, bs);
    const bv = Math.hypot(b.vx, b.vy); this.ball.rotation.z -= b.vx * dt * 2.2; this.ball.rotation.x += b.vy * dt * 2.2; if (bv < 0.1 && b.owner) { this.ball.rotation.z -= dt * 6; }
    // Ring unter Ballbesitzer / Fokus
    const o = rp ? null : (b.owner || this.focus); this.ring.isVisible = !!o; if (o) { this.ring.position.set(o.x, 0.06, o.y); this.ring.rotation.y += dt * 1.5; const T = M.teams[o.team]; this.ring.material.emissiveColor = B.Color3.FromHexString(T.color); this.ring.material.diffuseColor = this.ring.material.emissiveColor; }
    // Schiedsrichter: hält Abstand zum Ball, läuft mit
    if (this.ref && !rp) { const R = this.ref, tx = Math.max(6, Math.min(PW - 6, b.x - (b.x > PW / 2 ? 12 : -12))), tz = Math.max(4, Math.min(PH - 4, b.y + 9)); const dx = tx - R.x, dz = tz - R.y, d = Math.hypot(dx, dz); const sp = Math.min(6.5, d * 1.2);
      if (d > 0.3) { R.x += dx / d * sp * dt; R.y += dz / d * sp * dt; } const face = Math.atan2(b.x - R.x, b.y - R.y); let dd = face - R.root.rotation.y; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); R.root.rotation.y += dd * Math.min(1, dt * 5);
      R.phase += dt * (3 + sp * 1.35); const rr = Math.min(1, sp / 6); R.root.position.set(R.x, rr > 0.15 ? Math.max(0, Math.sin(R.phase * 2)) * 0.04 * rr : 0, R.y); this.pose(R, rr > 0.15 ? this.runPose(R.phase, rr) : { lean: 0.04, knL: 0.08, knR: 0.08, elL: -0.25, elR: -0.25 }); }
    if (this.ref) this.ref.root.setEnabled(!rp);
    // Aufzeichnung für die Wiederholung (letzte ~4 s)
    if (!rp && !this.cine) { const pl = new Map(); for (const [p] of this.figs) if (!p.out) pl.set(p, { x: p.x, y: p.y, vx: p.vx, vy: p.vy }); this.hist.push({ t: now, pl, ball: { x: b.x, y: b.y, h: this.ballH, mode: b.mode, owner: null } }); while (this.hist.length && this.hist[0].t < now - 4500) this.hist.shift(); }
    // Publikum pulsiert nach einem Tor
    if (this.crowdPulse > 0) { this.crowdPulse -= dt * 0.5; const k = Math.max(0, this.crowdPulse); if (this.crowdMat) { this.crowdMat.diffuseTexture.vOffset = Math.sin(now / 70) * 0.006 * k; } if (this.crowdMat) this.crowdMat.emissiveColor.set(0.35 + k * 0.5 * Math.abs(Math.sin(now / 90)), 0.35 + k * 0.5 * Math.abs(Math.sin(now / 90)), 0.35 + k * 0.4); }
    // Kamera: Kamerafahrt (Intro), Wiederholung, Torjubel oder TV-Kamera, die dem Ball folgt
    const land = !this.rot;
    if (rp) { const R = this.replay, behind = R.g.x > PW / 2; this.cam.alpha = behind ? 0.15 : Math.PI - 0.15; this.cam.beta = 1.05; this.cam.radius = 44; this.cam.target.set(R.g.x + (behind ? -16 : 16), 1, PH / 2 + (b.y - PH / 2) * 0.3); this.scene.render(); return; }
    if (this.cine) { const c = this.cine; this.cam.alpha = c.alpha; this.cam.beta = c.beta; this.cam.radius = c.radius; this.cam.target.set(c.tx, c.ty ?? 0.5, c.tz); this.camT = null; }
    else {
      const cel = this.celeb && this.celeb.until > performance.now() && M.speed < 10 ? this.celeb : null;
      const tx = cel ? cel.p.x : this.camMode === 'top' ? PW / 2 + (b.x - PW / 2) * 0.35 : this.camMode === 'near' || this.camMode === 'goal' ? b.x : land ? Math.max(30, Math.min(PW - 30, b.x)) : PW / 2 + (b.x - PW / 2) * 0.25, tz = cel ? cel.p.y : land ? PH / 2 + (b.y - PH / 2) * 0.2 : PH / 2 + (b.y - PH / 2) * 0.1;
      if (!this.camT) this.camT = new Vector3(tx, 0, tz);
      const k = Math.min(1, dt * (cel ? 4 : 1.6)); this.camT.x = lerp(this.camT.x, tx, k); this.camT.z = lerp(this.camT.z, tz, k);
      this.cam.target.set(this.camT.x + (this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0), cel ? 1.2 : 0.5, this.camT.z + (this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0));
      const want = land ? { alpha: -Math.PI / 2, beta: 0.9, radius: 74 + Math.max(0, 1.7 - this.w / this.h) * 26 } : { alpha: Math.PI, beta: 0.52, radius: 96 + Math.max(0, 1.9 - this.h / this.w) * 30 };
      if (this.camMode === 'near') { want.radius = land ? 26 : 34; want.beta = land ? 1.08 : 0.85; }
      else if (this.camMode === 'top') { want.radius = land ? 92 : 110; want.beta = 0.18; }
      else if (this.camMode === 'goal') { if (b.owner) this.lastAtt = b.owner.team; const att = this.lastAtt ?? 0, gx = M.goalOf(att).x; want.alpha = gx > PW / 2 ? Math.PI : 0; want.beta = 1.05; want.radius = 36; }
      if (cel) { want.radius = 26; want.beta = 1.1; }
      else if (land && this.camMode === 'tv') { const edge = Math.max(0, Math.abs(b.x - PW / 2) - 25) / 27.5; want.radius -= edge * 16; want.beta += edge * 0.08; } // TV-Zoom im Angriffsdrittel
      const kc = Math.min(1, dt * 3); { let da = want.alpha - this.cam.alpha; da = Math.atan2(Math.sin(da), Math.cos(da)); this.cam.alpha += da * Math.min(1, dt * 2.5); } this.cam.beta = lerp(this.cam.beta, want.beta, kc); this.cam.radius = lerp(this.cam.radius, want.radius, kc);
    }
    if (this.shake > 0) this.shake -= dt;
    const baseH = (this.day ? 1.0 : 0.25 + 0.5 * this.lampLevel) * (this.weatherDim || 1); if (this.flash > 0) { this.flash -= dt * 1.4; this.hemi.intensity = baseH + Math.max(0, this.flash) * 0.6; } else this.hemi.intensity = baseH;
    if (this.fw && performance.now() > this.fwNext) {
      const { Color4 } = B; this.fwNext = performance.now() + 350 + Math.random() * 500;
      const cols = [[1, 0.3, 0.2], [1, 0.85, 0.3], [0.3, 1, 0.55], [0.4, 0.8, 1], [1, 0.5, 1], [1, 1, 1]], c = cols[Math.floor(Math.random() * cols.length)];
      this.fwPs.emitter.set(-10 + Math.random() * (PW + 20), 22 + Math.random() * 18, -8 + Math.random() * (PH + 16)); this.fwPs.color1 = new Color4(c[0], c[1], c[2], 1); this.fwPs.color2 = new Color4(1, 1, 1, 1); this.fwPs.manualEmitCount = 160 + Math.floor(Math.random() * 120);
      this.flash = Math.max(this.flash, 0.35);
    }
    if (!this.fpsChecked) { this.fpsT += dt; this.fpsN++; if (this.fpsT > 4) { this.fpsChecked = true; const fps = this.fpsN / this.fpsT; if (fps < 28 && this.pipe) { this.pipe.dispose(); this.pipe = null; this.engine.setHardwareScalingLevel(1); } } }
    this.scene.render();
  }
  dispose() { try { this.engine.dispose(); } catch { /* ignore */ } }
}
