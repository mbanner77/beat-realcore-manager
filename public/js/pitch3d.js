// 3D-Darstellung des Spiels mit Babylon.js: Stadion, Rasen, Spielerfiguren mit Laufanimation, Ball mit Flugkurve, Kamera, Effekte.
// Gleiche Schnittstelle wie die 2D-Variante (pitch.js): resize(w, h), draw(M, dt), goalFlash(team), burst(x, y, color), focus.
import { PW, PH, GOAL_W } from './match.js';

let B = null; // Babylon-Modul (lazy)
export async function loadBabylon() {
  if (B) return B;
  try { B = await import('../vendor/babylon-lite-8.js'); return B; } catch { return null; }
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
    this.ballH = 0; this.flight = null; this.camT = null; this.ownerRingT = 0;
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
    this.buildStadium(); this.buildBall(); this.buildFx();
  }
  // ---------- Aufbau ----------
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
    const ground = MeshBuilder.CreateGround('ground', { width: W, height: H, subdivisions: 2 }, scene);
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
    const cm = new StandardMaterial('cm', scene); cm.diffuseTexture = crowd; cm.specularColor = Color3.Black(); cm.emissiveColor = new Color3(0.35, 0.35, 0.35);
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
      const lamp = MeshBuilder.CreateBox('lamp', { width: 5, height: 2.4, depth: 0.6 }, scene); lamp.position = new Vector3(x, 34, z); lamp.material = this.mat('lm', '#ffffff', { em: '#fff6d8' }); lamp.lookAt(new Vector3(PW / 2, 0, PH / 2));
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
    const ps = this.ps = new ParticleSystem('fx', 400, scene); ps.particleTexture = t; ps.emitter = new Vector3(PW / 2, 1, PH / 2);
    ps.minEmitBox = new Vector3(-0.3, 0, -0.3); ps.maxEmitBox = new Vector3(0.3, 0.5, 0.3); ps.minSize = 0.25; ps.maxSize = 0.6; ps.minLifeTime = 0.7; ps.maxLifeTime = 1.4;
    ps.emitRate = 0; ps.direction1 = new Vector3(-4, 6, -4); ps.direction2 = new Vector3(4, 12, 4); ps.minEmitPower = 1; ps.maxEmitPower = 2.2; ps.gravity = new Vector3(0, -14, 0); ps.updateSpeed = 0.012; ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.color1 = new Color4(1, 1, 1, 1); ps.color2 = new Color4(0.3, 0.9, 0.5, 1); ps.colorDead = new Color4(0, 0, 0, 0); ps.start();
  }
  // Spielerfigur: Körper, Kopf, Beine, Arme, Nummernschild
  figure(p) {
    const { MeshBuilder, TransformNode, Vector3, DynamicTexture, StandardMaterial, Color3, Mesh } = B, scene = this.scene, T = this.M.teams[p.team];
    const root = new TransformNode('pl' + p.id, scene); root.scaling.set(1.45, 1.45, 1.45);
    const gk = p.pos === 'TW';
    const shirt = gk ? (p.team === 0 ? '#ffd166' : '#9ad0ff') : T.color, shorts = gk ? '#222' : T.color2;
    const sm = this.mat('shirt', shirt, { spec: 0.1 }), hm = this.mat('shorts', shorts), km = this.mat('skin', SKIN[(p.num + p.team * 3) % SKIN.length]), socks = this.mat('socks', shirt);
    const body = MeshBuilder.CreateCapsule('body', { height: 1.0, radius: 0.3, tessellation: 10, capSubdivisions: 3 }, scene); body.position.y = 1.05; body.material = sm; body.parent = root;
    const sh = MeshBuilder.CreateCylinder('sh', { height: 0.34, diameterTop: 0.56, diameterBottom: 0.62 }, scene); sh.position.y = 0.62; sh.material = hm; sh.parent = root;
    const head = MeshBuilder.CreateSphere('head', { diameter: 0.4, segments: 8 }, scene); head.position.y = 1.78; head.material = km; head.parent = root;
    const hair = MeshBuilder.CreateSphere('hair', { diameter: 0.42, segments: 8, slice: 0.5 }, scene); hair.position.y = 1.8; hair.material = this.mat('hair', ['#2a1a0e', '#111', '#6b4423', '#b58a3c', '#3b2a1a'][(p.num * 7 + p.team) % 5]); hair.parent = root;
    const legs = [], arms = [];
    for (const s of [-1, 1]) {
      const leg = new TransformNode('leg', scene); leg.position = new Vector3(s * 0.14, 0.5, 0); leg.parent = root;
      const th = MeshBuilder.CreateCylinder('th', { height: 0.5, diameter: 0.17 }, scene); th.position.y = -0.25; th.material = socks; th.parent = leg;
      const boot = MeshBuilder.CreateBox('boot', { width: 0.16, height: 0.1, depth: 0.28 }, scene); boot.position = new Vector3(0, -0.5, 0.05); boot.material = this.mat('boot', '#111'); boot.parent = leg;
      legs.push(leg);
      const arm = new TransformNode('arm', scene); arm.position = new Vector3(s * 0.38, 1.45, 0); arm.parent = root;
      const ua = MeshBuilder.CreateCapsule('ua', { height: 0.62, radius: 0.08, tessellation: 6 }, scene); ua.position.y = -0.28; ua.material = s < 0 ? sm : sm; ua.parent = arm;
      const hand = MeshBuilder.CreateSphere('hand', { diameter: 0.14, segments: 6 }, scene); hand.position.y = -0.6; hand.material = km; hand.parent = arm;
      arms.push(arm);
    }
    const blob = MeshBuilder.CreateDisc('blob', { radius: 0.55, tessellation: 16 }, scene); blob.rotation.x = Math.PI / 2; blob.position.y = 0.015; blob.scaling.set(1, 0.8, 1); blob.material = this.blobMat; blob.parent = root;
    for (const m of root.getChildMeshes()) m.isPickable = false;
    // Schild mit Nummer und Name
    const tex = new DynamicTexture('lbl' + p.id, { width: 512, height: 192 }, scene, false); tex.hasAlpha = true;
    const plane = MeshBuilder.CreatePlane('lbl', { width: 3.0, height: 1.12 }, scene); plane.position.y = 2.5; plane.parent = root; plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    const lm = new StandardMaterial('lm', scene); lm.diffuseTexture = tex; lm.opacityTexture = tex; lm.emissiveColor = new Color3(1, 1, 1); lm.disableLighting = true; lm.backFaceCulling = false; plane.material = lm; plane.isPickable = false;
    const fig = { root, legs, arms, body, head, plane, tex, phase: Math.random() * 6, state: '', bob: 0, mats: [sm, hm, km, socks, lm] };
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
  resize(w, h) { this.w = w; this.h = h; this.rot = h > w * 1.15; this.engine.resize(); this.cam.fov = this.rot ? 0.95 : 0.78; }
  goalFlash(team) { this.flash = 1; this.shake = 0.7; }
  burst(x, y, color) {
    const { Color4, Color3 } = B; const c = Color3.FromHexString(color);
    this.ps.emitter.set(x, 0.6, y); this.ps.color1 = new Color4(1, 1, 1, 1); this.ps.color2 = new Color4(c.r, c.g, c.b, 1); this.ps.manualEmitCount = 160;
  }
  syncRoster(M) {
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
    const { Vector3 } = B, b = M.ball;
    // Spieler
    for (const [p, f] of this.figs) {
      if (p.out) continue; f.root.setEnabled(true);
      const v = Math.hypot(p.vx, p.vy), run = Math.min(1, v / 5);
      f.phase += dt * (2 + v * 1.6);
      f.root.position.set(p.x, 0, p.y);
      if (v > 0.3) { const ty = Math.atan2(p.vx, p.vy); let d = ty - f.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); f.root.rotation.y += d * Math.min(1, dt * 10); }
      f.root.rotation.x = 0.18 * run;
      const sw = Math.sin(f.phase) * 0.75 * run;
      f.legs[0].rotation.x = sw; f.legs[1].rotation.x = -sw; f.arms[0].rotation.x = -sw * 0.8; f.arms[1].rotation.x = sw * 0.8;
      f.arms[0].rotation.z = 0.25; f.arms[1].rotation.z = -0.25;
      f.root.position.y = Math.abs(Math.sin(f.phase)) * 0.07 * run;
      if (p.injured) { f.root.rotation.x = 0.35; }
      this.label(f, p);
    }
    // Ball
    const h = this.ballHeight(M); this.ballH = lerp(this.ballH, h, Math.min(1, dt * 12));
    this.ball.position.set(b.x, 0.25 + this.ballH, b.y); this.ballBlob.position.x = b.x + this.ballH * 0.3; this.ballBlob.position.z = b.y - this.ballH * 0.2; const bs = 1 / (1 + this.ballH * 0.5); this.ballBlob.scaling.set(bs, bs, bs);
    const bv = Math.hypot(b.vx, b.vy); this.ball.rotation.z -= b.vx * dt * 2.2; this.ball.rotation.x += b.vy * dt * 2.2; if (bv < 0.1 && b.owner) { this.ball.rotation.z -= dt * 6; }
    // Ring unter Ballbesitzer / Fokus
    const o = b.owner || this.focus; this.ring.isVisible = !!o; if (o) { this.ring.position.set(o.x, 0.06, o.y); this.ring.rotation.y += dt * 1.5; const T = M.teams[o.team]; this.ring.material.emissiveColor = B.Color3.FromHexString(T.color); this.ring.material.diffuseColor = this.ring.material.emissiveColor; }
    // Kamera: folgt dem Ball weich
    const land = !this.rot;
    const tx = land ? Math.max(30, Math.min(PW - 30, b.x)) : PW / 2 + (b.x - PW / 2) * 0.25, tz = land ? PH / 2 + (b.y - PH / 2) * 0.2 : PH / 2 + (b.y - PH / 2) * 0.1;
    if (!this.camT) this.camT = new Vector3(tx, 0, tz);
    this.camT.x = lerp(this.camT.x, tx, Math.min(1, dt * 1.6)); this.camT.z = lerp(this.camT.z, tz, Math.min(1, dt * 1.6));
    this.cam.target.set(this.camT.x + (this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0), 0.5, this.camT.z + (this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0));
    if (land) { this.cam.alpha = -Math.PI / 2; this.cam.beta = 0.9; this.cam.radius = 74 + Math.max(0, 1.7 - this.w / this.h) * 26; }
    else { this.cam.alpha = Math.PI; this.cam.beta = 0.52; this.cam.radius = 96 + Math.max(0, 1.9 - this.h / this.w) * 30; }
    if (this.shake > 0) this.shake -= dt;
    if (this.flash > 0) { this.flash -= dt * 1.4; this.hemi.intensity = 0.75 + Math.max(0, this.flash) * 0.6; } else this.hemi.intensity = 0.75;
    this.scene.render();
  }
  dispose() { try { this.engine.dispose(); } catch { /* ignore */ } }
}
