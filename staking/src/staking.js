// WHERE SHOULD MOCHI STAKE? — a deterministic 3D explainer about GenLayer staking & delegation.
// window.renderAt(t) renders the frame at time t (seconds).
import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';

export const DURATION = 64;
const W = 1920, H = 1080;

const COL = {
  bg: '#F3EEF6', ground: '#EFE9F3', stage: '#FAF8FC', stageEdge: '#E4DCEC',
  ink: '#1E1530', muted: '#6C6280', white: '#F8F7FB', visor: '#0D1220',
  teal: '#2EE6D6', tealDeep: '#12B5A8', magenta: '#D63FDC', earInner: '#4A4458', paw: '#4B4A5A', lav: '#CDBEEB',
  coin: '#1E1B2E', red: '#E0475B', amber: '#F2A93B',
  lilac: '#B9A6E0', sky: '#8DB3E8', sage: '#9DC7A8', sand: '#E8C68F', coral: '#EE927A',
};

// ---------------------------------------------------------------- helpers
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, x) => a + (b - a) * x;
const eio = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eo = x => 1 - Math.pow(1 - x, 3);
const ei = x => x * x * x;
const sm = x => x * x * (3 - 2 * x);
const backOut = x => { const c1 = 1.6, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const pulse = (t, a, b) => Math.sin(seg(t, a, b) * Math.PI);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerpV = (a, b, x) => a.clone().lerp(b, x);

function track(keys) {
  const n = keys.length;
  const tan = j => {
    const k = keys[j];
    if (k.hold || j === 0 || j === n - 1) return k.v.map(() => 0);
    const a = keys[j - 1], b = keys[j + 1];
    return k.v.map((_, c) => (b.v[c] - a.v[c]) / (b.t - a.t));
  };
  return t => {
    if (t <= keys[0].t) return keys[0].v.slice();
    if (t >= keys[n - 1].t) return keys[n - 1].v.slice();
    let i = 0; while (t > keys[i + 1].t) i++;
    const k0 = keys[i], k1 = keys[i + 1], dt = k1.t - k0.t, u = (t - k0.t) / dt;
    const m0 = tan(i), m1 = tan(i + 1);
    const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
    return k0.v.map((p0, c) => h00 * p0 + h10 * dt * m0[c] + h01 * k1.v[c] + h11 * dt * m1[c]);
  };
}

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(COL.bg);
scene.fog = new THREE.Fog(COL.bg, 18, 48);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.6;
const camera = new THREE.PerspectiveCamera(35, W / H, 0.05, 200);
scene.add(new THREE.HemisphereLight('#FFFAFF', '#DCCFE6', 1.4));
const key = new THREE.DirectionalLight('#FFF4E8', 2.4);
key.castShadow = true; key.shadow.mapSize.set(4096, 4096); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
const S = 7; Object.assign(key.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 50 });
key.position.set(-6, 12, 8); key.target.position.set(0, 0, -2.5); scene.add(key, key.target);
const rim = new THREE.DirectionalLight('#E6F4FF', 0.7); rim.position.set(6, 5, -8); scene.add(rim);

// ---------------------------------------------------------------- materials
const mc = {};
const matte = c => mc['m' + c] ??= new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
const gloss = c => mc['g' + c] ??= new THREE.MeshStandardMaterial({ color: c, roughness: 0.38 });
const satin = c => mc['s' + c] ??= new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.75 });
const facet = c => mc['f' + c] ??= new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, flatShading: true });
const basic = c => mc['b' + c] ??= new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
const glass = mc.glass = new THREE.MeshPhysicalMaterial({ color: '#F4F6FF', roughness: 0.12, transparent: true, opacity: 0.28,
  clearcoat: 1, clearcoatRoughness: 0.1, depthWrite: false });
function mesh(g, m, cast = true, recv = true) { const x = new THREE.Mesh(g, m); x.castShadow = cast; x.receiveShadow = recv; return x; }
const rbox = (w, h, d, r = 0.02) => new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

// ---------------------------------------------------------------- textures
const imgs = {};
const loadImg = (k, src) => new Promise(r => { const i = new Image(); i.onload = () => { imgs[k] = i; r(); }; i.src = src; });
const FR = '"Fredoka", sans-serif', SANS = '"Inter Film", sans-serif';
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
class DynTex {
  constructor(w, h, draw) { this.c = document.createElement('canvas'); this.c.width = w; this.c.height = h; this.ctx = this.c.getContext('2d');
    this.draw = draw; this.key = null; this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8; }
  update(s) { const k = JSON.stringify(s); if (k === this.key) return; this.key = k; this.ctx.clearRect(0, 0, this.c.width, this.c.height);
    this.draw(this.ctx, s, this.c.width, this.c.height); this.tex.needsUpdate = true; }
}

// Mochi's face: teal pixel-grid features on the dark visor. s: {eyes, mouth, look:[x,y]}
function drawFace(ctx, s, w, h) {
  const cx = w / 2, lx = (s.look?.[0] || 0) * 18, ly = (s.look?.[1] || 0) * 12;
  ctx.save();
  ctx.fillStyle = COL.teal;
  // forehead GenLayer mark
  ctx.globalAlpha = 0.95; ctx.drawImage(imgs.glTeal, cx - 52, 52, 104, 104); ctx.globalAlpha = 1;
  const eye = (x, y, side) => {
    ctx.save(); ctx.translate(x + lx, y + ly); ctx.scale(side, 1); ctx.beginPath();
    switch (s.eyes) {
      case 'happy': // ^ ^
        ctx.lineWidth = 26; ctx.lineCap = 'round'; ctx.strokeStyle = COL.teal; ctx.moveTo(-50, 22); ctx.quadraticCurveTo(0, -48, 50, 22); ctx.stroke(); ctx.restore(); return;
      case 'wink':
        if (side > 0) { ctx.lineWidth = 24; ctx.lineCap = 'round'; ctx.strokeStyle = COL.teal; ctx.moveTo(-48, 4); ctx.lineTo(48, 4); ctx.stroke(); ctx.restore(); return; }
        ctx.moveTo(-58, -30); ctx.lineTo(56, -6); ctx.quadraticCurveTo(52, 46, -4, 46); ctx.quadraticCurveTo(-58, 40, -58, -30); break;
      case 'curious': // round, slightly uneven
        ctx.ellipse(0, 0, side > 0 ? 44 : 52, side > 0 ? 44 : 54, 0, 0, Math.PI * 2); break;
      case 'worried':
        ctx.moveTo(-56, -6); ctx.lineTo(54, -36); ctx.quadraticCurveTo(58, 40, 4, 42); ctx.quadraticCurveTo(-54, 42, -56, -6); break;
      default: // smug (reference look)
        ctx.moveTo(-58, -30); ctx.lineTo(56, -6); ctx.quadraticCurveTo(52, 46, -4, 46); ctx.quadraticCurveTo(-58, 40, -58, -30);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  };
  eye(cx - 112, 262, 1); eye(cx + 112, 262, -1);
  // tiny nose glyph
  ctx.lineWidth = 7; ctx.strokeStyle = COL.teal; ctx.beginPath(); ctx.moveTo(cx - 7 + lx, 300 + ly); ctx.lineTo(cx - 7 + lx, 318 + ly); ctx.quadraticCurveTo(cx + lx, 326 + ly, cx + 7 + lx, 318 + ly); ctx.lineTo(cx + 7 + lx, 300 + ly); ctx.stroke();
  // mouth
  ctx.lineWidth = 20; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  const my = 372 + ly;
  if (s.mouth === 'open') { ctx.fillStyle = COL.teal; ctx.ellipse(cx + lx, my + 6, 34, 26, 0, 0, Math.PI * 2); ctx.fill(); }
  else if (s.mouth === 'flat') { ctx.moveTo(cx - 40 + lx, my + 8); ctx.quadraticCurveTo(cx + lx, my - 4, cx + 40 + lx, my + 8); ctx.stroke(); }
  else { ctx.moveTo(cx - 66 + lx, my - 12); ctx.quadraticCurveTo(cx - 33 + lx, my + 36, cx + lx, my - 2); ctx.quadraticCurveTo(cx + 33 + lx, my + 36, cx + 66 + lx, my - 12); ctx.stroke(); }
  ctx.restore();
  // pixel grid over the features
  ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.strokeStyle = 'rgba(10,30,40,0.55)'; ctx.lineWidth = 2;
  for (let x = 0; x < w; x += 9) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 9) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.restore();
}
function drawCoinFace(ctx, s, w, h) {
  ctx.fillStyle = COL.coin; ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = s.rim || '#5B5476'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 14, 0, Math.PI * 2); ctx.stroke();
  ctx.drawImage(imgs.glWhite, w * 0.2, w * 0.18, w * 0.6, w * 0.6);
}
function drawTask(ctx, s, w, h) {
  ctx.fillStyle = '#FFFFFF'; rr(ctx, 0, 0, w, h, 34); ctx.fill();
  ctx.strokeStyle = '#E2DAEC'; ctx.lineWidth = 6; rr(ctx, 3, 3, w - 6, h - 6, 31); ctx.stroke();
  ctx.fillStyle = COL.muted; ctx.font = `600 34px ${SANS}`; ctx.letterSpacing = '5px'; ctx.fillText('INTELLIGENT CONTRACT', 54, 96); ctx.letterSpacing = '0px';
  ctx.fillStyle = COL.ink; ctx.font = `700 76px ${FR}`; ctx.fillText('Needs a decision', 54, 200);
  ctx.fillStyle = '#EEE8F5'; rr(ctx, 54, 250, w - 108, 22, 11); ctx.fill(); rr(ctx, 54, 296, (w - 108) * 0.7, 22, 11); ctx.fill();
}
function drawBadge(ctx, s, w, h) {
  ctx.fillStyle = s.bad ? COL.red : COL.tealDeep; ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = w * 0.11; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  if (s.bad) { ctx.moveTo(w * 0.33, h * 0.33); ctx.lineTo(w * 0.67, h * 0.67); ctx.moveTo(w * 0.67, h * 0.33); ctx.lineTo(w * 0.33, h * 0.67); }
  else { ctx.moveTo(w * 0.28, h * 0.52); ctx.lineTo(w * 0.44, h * 0.68); ctx.lineTo(w * 0.73, h * 0.34); }
  ctx.stroke();
}
function drawPill(ctx, s, w, h) {
  ctx.fillStyle = s.bg; rr(ctx, 0, 0, w, h, h / 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(h * 0.56)}px ${FR}`; ctx.textAlign = 'center'; ctx.fillText(s.text, w / 2, h * 0.7); ctx.textAlign = 'left';
}
function drawQ(ctx, s, w, h) { ctx.fillStyle = COL.magenta; ctx.font = `700 ${h * 0.8}px ${FR}`; ctx.textAlign = 'center'; ctx.fillText('?', w / 2, h * 0.8); }
const texPlane = (w, h, dyn, opts = {}) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: dyn.tex, transparent: true, toneMapped: false, side: opts.side ?? THREE.FrontSide, depthWrite: opts.depthWrite ?? true }));
  return m;
};

// ---------------------------------------------------------------- Mochi
function makeMochi() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const white = gloss(COL.white);
  const feet = [-1, 1].map(s => { const f = mesh(rbox(0.12, 0.07, 0.17, 0.035), white); f.position.set(s * 0.075, 0.035, 0.02); g.add(f); return f; });
  [-1, 1].forEach(s => { const l = mesh(new THREE.CapsuleGeometry(0.05, 0.08, 6, 16), white); l.position.set(s * 0.072, 0.13, 0); body.add(l); });
  const torso = mesh(new THREE.CapsuleGeometry(0.155, 0.13, 8, 32), white); torso.position.y = 0.32; torso.scale.z = 0.85; body.add(torso);
  const pack = mesh(rbox(0.22, 0.2, 0.08, 0.04), gloss(COL.lav)); pack.position.set(0, 0.36, -0.13); body.add(pack);
  const chestDyn = { tex: null };
  const chest = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }));
  chest.position.set(0, 0.31, 0.133); body.add(chest); chestDyn.mesh = chest;
  const arms = [-1, 1].map(s => {
    const piv = new THREE.Group(); piv.position.set(s * 0.15, 0.42, 0.0); body.add(piv);
    const a = mesh(new THREE.CapsuleGeometry(0.048, 0.11, 6, 16), white); a.position.y = -0.08; piv.add(a);
    const paw = mesh(rbox(0.1, 0.09, 0.1, 0.04), gloss(COL.paw)); paw.position.y = -0.17; piv.add(paw);
    const dot = mesh(new THREE.SphereGeometry(0.014, 12, 8), basic(COL.teal), false); dot.position.set(0, -0.15, 0.05); piv.add(dot);
    piv.userData.s = s; return piv;
  });
  // head
  const head = new THREE.Group(); head.position.y = 0.74; body.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.3, 48, 32), white));
  const visor = mesh(new THREE.SphereGeometry(0.272, 48, 32), new THREE.MeshPhysicalMaterial({ color: COL.visor, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }));
  visor.position.z = 0.055; head.add(visor);
  const rimRing = mesh(new THREE.TorusGeometry(0.246, 0.012, 12, 64), white); rimRing.position.z = 0.173; head.add(rimRing);
  // face decal projected onto the visor sphere
  const faceDyn = new DynTex(512, 512, drawFace);
  const fg = new THREE.PlaneGeometry(0.44, 0.44, 24, 24);
  const p = fg.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const r2 = 0.2735 ** 2 - x * x - y * y; p.setZ(i, 0.055 + Math.sqrt(Math.max(r2, 0))); }
  fg.computeVertexNormals();
  const face = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ map: faceDyn.tex, transparent: true, toneMapped: false, depthWrite: false }));
  face.renderOrder = 2; head.add(face);
  // ear pads
  [-1, 1].forEach(s => {
    const o = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 32), white); o.rotation.z = Math.PI / 2; o.position.set(s * 0.29, -0.01, 0); head.add(o);
    const i = mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.03, 32), gloss(COL.magenta)); i.rotation.z = Math.PI / 2; i.position.set(s * 0.32, -0.01, 0); head.add(i);
  });
  // ears
  const ears = [-1, 1].map(s => {
    const e = new THREE.Group(); e.position.set(s * 0.165, 0.2, -0.02); e.rotation.z = -s * 0.32; head.add(e);
    const o = mesh(new THREE.ConeGeometry(0.11, 0.25, 4), gloss(COL.magenta)); o.rotation.y = Math.PI / 4; o.scale.z = 0.45; o.position.y = 0.1; e.add(o);
    const i = mesh(new THREE.ConeGeometry(0.07, 0.17, 4), gloss(COL.earInner)); i.rotation.y = Math.PI / 4; i.scale.z = 0.3; i.position.set(0, 0.08, 0.025); e.add(i);
    return e;
  });
  // tail
  const tail = new THREE.Group(); tail.position.set(0.04, 0.2, -0.12); body.add(tail);
  const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0.12, -0.06, -0.1), V(0.26, 0.02, -0.15), V(0.3, 0.22, -0.13), V(0.24, 0.32, -0.1)]);
  tail.add(mesh(new THREE.TubeGeometry(curve, 48, 0.026, 12), gloss('#141218')));
  // sweat drops (worried)
  const drops = [V(0.3, 0.08, 0.12), V(0.27, -0.12, 0.17), V(-0.29, -0.05, 0.13)].map(pp => { const d = mesh(new THREE.SphereGeometry(0.018, 12, 10), new THREE.MeshPhysicalMaterial({ color: COL.teal, roughness: 0.1, transparent: true, opacity: 0.85 }), false); d.scale.y = 1.5; d.position.copy(pp); head.add(d); return d; });
  // held coin stack
  const hold = new THREE.Group(); hold.position.set(0, 0.24, 0.24); g.add(hold);
  g.userData = { body, head, arms, ears, tail, faceDyn, chest, drops, hold, feet };
  return g;
}
function poseMochi(m, p, t) {
  const u = m.userData;
  m.position.set(p.x, (p.y || 0) + (p.hop || 0), p.z); m.rotation.y = p.ry || 0;
  const sq = p.squash || 0; u.body.scale.set(1 + sq * 0.6, 1 - sq, 1 + sq * 0.6);
  u.head.rotation.set(p.nod || 0, p.turn || 0, p.tilt || 0);
  const lift = p.lift ?? 0.3; // arms forward to hold coins
  u.arms.forEach(a => { a.rotation.set(-lift * 1.1 - (p.wave && a.userData.s > 0 ? 2.2 * p.wave : 0), 0, a.userData.s * (0.18 + 0.1 * Math.sin(t * 3 + a.userData.s))); });
  u.ears.forEach((e, i) => { e.rotation.x = 0.06 * Math.sin(t * 4 + i * 1.7) * (p.earWiggle ?? 1); });
  u.tail.rotation.set(0, 0.25 * Math.sin(t * 2.2), 0.12 * Math.sin(t * 1.7));
  u.faceDyn.update({ eyes: p.eyes || 'smug', mouth: p.mouth || 'w', look: (p.look || [0, 0]).map(v => Math.round(v * 10) / 10) });
  const sw = p.sweat || 0;
  u.drops.forEach((d, i) => { d.visible = sw > 0.01; d.position.y = [0.08, -0.12, -0.05][i] - ((t * 0.25 + i * 0.3) % 1) * 0.06; d.scale.setScalar(sw); d.scale.y = 1.5 * sw; });
}

// ---------------------------------------------------------------- coins
let coinFace, coinFaceMochi;
const coinGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.022, 40);
const coinFaceGeo = new THREE.CircleGeometry(0.083, 40);
function makeCoin(mochi = false) {
  const g = new THREE.Group();
  g.add(mesh(coinGeo, satin(mochi ? '#3A2346' : COL.coin)));
  const top = new THREE.Mesh(coinFaceGeo, new THREE.MeshBasicMaterial({ map: (mochi ? coinFaceMochi : coinFace)?.tex ?? null, toneMapped: false }));
  top.rotation.x = -Math.PI / 2; top.position.y = 0.0115; g.add(top);
  return g;
}
const COIN_H = 0.024;
class Stack {
  constructor(parent, max, mochi = false) { this.g = new THREE.Group(); parent.add(this.g); this.coins = []; this.max = max; this.mochi = mochi; }
  init() { for (let i = 0; i < this.max; i++) { const c = makeCoin(this.mochi); c.position.y = i * COIN_H + COIN_H / 2; c.rotation.y = i * 0.7; this.g.add(c); this.coins.push(c); } }
  set(n) { this.coins.forEach((c, i) => { c.visible = i < Math.floor(n + 1e-6); }); }
}

// ---------------------------------------------------------------- world
const world = new THREE.Group(); scene.add(world);
const ground = mesh(new THREE.PlaneGeometry(200, 200), matte(COL.ground), false, true); ground.rotation.x = -Math.PI / 2; world.add(ground);
const STAGE_C = V(0, 0, -3.0);
const stage = new THREE.Group(); stage.position.copy(STAGE_C); world.add(stage);   // tilts in scene 5
const SY = 0.14;
stage.add(at(mesh(new THREE.CylinderGeometry(4.6, 4.75, SY, 128), matte(COL.stage)), 0, SY / 2, 0));
const ring = (r0, r1, c) => { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 160), basic(c)); m.rotation.x = -Math.PI / 2; m.position.y = SY + 0.002; stage.add(m); return m; };
ring(4.3, 4.36, '#E3D9EE'); ring(2.0, 2.04, '#E9E1F2');
// fulcrum under the stage (visible when it tilts)
world.add(at(mesh(new THREE.CylinderGeometry(0.5, 0.9, 0.2, 48), matte('#E2D8EA')), STAGE_C.x, 0.0, STAGE_C.z));

// validators ("checkers")
const VCOL = [COL.lilac, COL.sky, COL.sage, COL.coral, COL.sand];
const VX = [-2.7, -1.35, 0, 1.35, 2.7];
const vz = x => -1.15 - 0.16 * (2.7 * 2.7 - x * x) / 2.7;   // local to stage; arc bowing away from camera
const validators = VX.map((x, i) => {
  const root = new THREE.Group(); root.position.set(x, SY, vz(x)); root.rotation.y = -x * 0.08; stage.add(root);
  const pod = mesh(new THREE.CylinderGeometry(0.36, 0.4, 1, 48), matte('#FFFFFF')); root.add(pod);
  const band = mesh(new THREE.CylinderGeometry(0.365, 0.365, 0.04, 48), new THREE.MeshStandardMaterial({ color: COL.tealDeep, emissive: COL.teal, emissiveIntensity: 0, roughness: 0.4 })); root.add(band);
  const char = new THREE.Group(); root.add(char);
  const torso = mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.34, 40), gloss('#FFFFFF')); torso.position.y = 0.17; char.add(torso);
  const strip = mesh(new THREE.CylinderGeometry(0.162, 0.17, 0.05, 40), gloss(VCOL[i])); strip.position.y = 0.26; char.add(strip);
  const head = new THREE.Group(); head.position.y = 0.6; char.add(head);
  const geos = [new THREE.IcosahedronGeometry(0.23), new THREE.OctahedronGeometry(0.25), new THREE.DodecahedronGeometry(0.23), new THREE.TetrahedronGeometry(0.28), new THREE.OctahedronGeometry(0.23, 1)];
  head.add(mesh(geos[i], facet(VCOL[i])));
  const visor = mesh(rbox(0.24, 0.08, 0.04, 0.03), gloss('#24203A')); visor.position.set(0, 0, 0.2); head.add(visor);
  const lineMat = new THREE.MeshBasicMaterial({ color: COL.teal, toneMapped: false });
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.022), lineMat); line.position.set(0, 0, 0.221); head.add(line);
  // stake vault in front of the podium
  const vault = new THREE.Group(); vault.position.set(0, 0, 0.62); root.add(vault);
  vault.add(at(mesh(rbox(0.3, 0.04, 0.3, 0.015), matte('#E9E2F1')), 0, 0.02, 0));
  const vglass = mesh(rbox(0.3, 0.62, 0.3, 0.03), glass, false, false); vglass.position.y = 0.35; vault.add(vglass);
  const stack = new Stack(vault, 26); stack.g.position.y = 0.04;
  return { root, pod, band, char, head, line, lineMat, vault, stack, i, x };
});

const mochi = makeMochi(); stage.add(mochi);
const mochiStack = new Stack(mochi.userData.hold, 10, true);

// holders for scene 5 (small token-holder beans)
const HCOL = [COL.sky, COL.sage, COL.sand, COL.lilac, COL.coral, COL.sky];
const holders = HCOL.map((c, i) => {
  const g = new THREE.Group(); stage.add(g);
  g.add(at(mesh(new THREE.CapsuleGeometry(0.11, 0.12, 6, 20), gloss(c)), 0, 0.17, 0));
  g.add(at(mesh(rbox(0.13, 0.05, 0.03, 0.02), gloss('#24203A')), 0, 0.25, 0.1));
  return g;
});

// floating props
const flyCoins = Array.from({ length: 16 }, (_, i) => { const c = makeCoin(); stage.add(c); c.visible = false; return c; });
const flyCoinsM = Array.from({ length: 6 }, () => { const c = makeCoin(true); stage.add(c); c.visible = false; return c; });
const taskDyn = new DynTex(760, 360, drawTask);
const taskCards = Array.from({ length: 6 }, () => { const p = texPlane(0.62, 0.29, taskDyn, { side: THREE.DoubleSide }); stage.add(p); return p; });
const okDyn = new DynTex(256, 256, drawBadge), badDyn = new DynTex(256, 256, drawBadge);
const badges = VX.map(() => { const p = texPlane(0.24, 0.24, okDyn); stage.add(p); return p; });
const bigCheck = texPlane(0.7, 0.7, okDyn); stage.add(bigCheck);
const pillReward = new DynTex(420, 110, drawPill), pillSlash = new DynTex(420, 110, drawPill), pillShare = new DynTex(520, 110, drawPill);
const labelReward = texPlane(0.5, 0.13, pillReward), labelSlash = texPlane(0.5, 0.13, pillSlash), labelShare = texPlane(0.62, 0.13, pillShare);
[labelReward, labelSlash, labelShare].forEach(l => stage.add(l));
const qDyn = new DynTex(200, 200, drawQ);
const bubble = new THREE.Group(); stage.add(bubble);
bubble.add(at(mesh(new THREE.SphereGeometry(0.17, 32, 20), gloss('#FFFFFF'), false), 0, 0, 0));
bubble.add(at(mesh(new THREE.SphereGeometry(0.05, 16, 12), gloss('#FFFFFF'), false), -0.17, -0.2, 0));
bubble.add(at(mesh(new THREE.SphereGeometry(0.03, 16, 12), gloss('#FFFFFF'), false), -0.25, -0.3, 0));
const qPlane = texPlane(0.2, 0.2, qDyn); qPlane.position.z = 0.172; bubble.add(qPlane);
const blade = mesh(new THREE.BoxGeometry(0.5, 0.008, 0.36), satin('#C9C3D6')); stage.add(blade);
const warnRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 64), new THREE.MeshBasicMaterial({ color: COL.red, transparent: true, toneMapped: false })); warnRing.rotation.x = -Math.PI / 2; stage.add(warnRing);

// ---------------------------------------------------------------- stake bookkeeping
// Coin transfers: {t0, t1, from, to, n} where from/to are validator index or 'm' (Mochi) or 'h<k>' (holder) or 'sky'.
const BASE = [5, 5, 5, 5, 5];
const MOCHI_BASE = 6;
const transfers = [];
// scene 3: validator 2 (index 1) stakes to earn its seat, earns a reward; validator 4 (index 3) gets slashed
for (let k = 0; k < 5; k++) transfers.push({ t0: 20.2 + k * 0.28, t1: 20.75 + k * 0.28, from: 'sky', to: 1, n: 1 });
transfers.push({ t0: 25.0, t1: 25.6, from: 'sky', to: 1, n: 1 });
// scene 4: Mochi delegates 3 coins to validator 3 (index 2), gets a reward back
for (let k = 0; k < 3; k++) transfers.push({ t0: 35.4 + k * 0.32, t1: 36.1 + k * 0.32, from: 'm', to: 2, n: 1 });
transfers.push({ t0: 38.0, t1: 38.7, from: 'sky2', to: 'm', n: 1 });
// scene 5: everyone piles onto validator 1 (index 0) ...
for (let k = 0; k < 12; k++) transfers.push({ t0: 43.7 + k * 0.3, t1: 44.4 + k * 0.3, from: 'h' + (k % 6), to: 0, n: 1 });
// ... then it spreads out again
const SPREAD = [1, 2, 3, 4, 1, 2, 3, 4, 2, 3];
SPREAD.forEach((v, k) => transfers.push({ t0: 49.4 + k * 0.17, t1: 50.15 + k * 0.17, from: 0, to: v, n: 1 }));
[1, 3, 4].forEach((v, k) => transfers.push({ t0: 51.0 + k * 0.35, t1: 51.7 + k * 0.35, from: 'm', to: v, n: 1 }));
const SLASH_T = 28.6;

function counts(t) {
  const v = BASE.slice(); let m = MOCHI_BASE;
  if (t >= 19.6) v[1] = 0;                                   // validator 2 restakes for the explanation
  if (t >= SLASH_T) v[3] -= 2;
  for (const e of transfers) {
    if (t >= e.t0) { if (typeof e.from === 'number') v[e.from] -= e.n; else if (e.from === 'm') m -= e.n; }
    if (t >= e.t1) { if (typeof e.to === 'number') v[e.to] += e.n; else if (e.to === 'm') m += e.n; }
  }
  return { v, m };
}
const podH = n => 0.32 + 0.11 * n;

// ---------------------------------------------------------------- camera
const camKeys = track([
  // scene 1 — meet Mochi (Mochi at world z -0.4)
  { t: 0.0, v: [0.0, 0.9, 3.0, 0.0, 0.62, -0.4, 34] },
  { t: 4.0, v: [0.0, 0.74, 2.55, 0.0, 0.56, -0.4, 34] },
  { t: 7.2, v: [0.15, 0.74, 2.4, 0.05, 0.57, -0.4, 34] },
  // scene 2 — validators check the work
  { t: 9.2, v: [-1.4, 2.3, 3.9, 0.0, 0.95, -3.6, 38] },
  { t: 13.0, v: [-0.6, 2.6, 3.6, 0.0, 1.05, -3.8, 38] },
  { t: 17.0, v: [0.3, 2.7, 3.4, 0.0, 1.15, -3.8, 38] },
  { t: 19.2, v: [0.0, 2.5, 2.6, 0.0, 1.3, -3.8, 36] },
  // scene 3 — staking: validator 2, then validator 4 (slashed)
  { t: 20.4, v: [-0.95, 1.3, -0.75, -1.3, 0.92, -4.1, 36], hold: true },
  { t: 25.6, v: [-1.05, 1.28, -0.95, -1.3, 0.92, -4.1, 36] },
  { t: 27.0, v: [1.05, 1.3, -0.75, 1.3, 0.9, -4.1, 36] },
  { t: 30.0, v: [1.15, 1.25, -0.95, 1.3, 0.88, -4.1, 36] },
  // scene 4 — Mochi delegates (side-on)
  { t: 31.2, v: [-2.2, 1.25, 0.2, -2.3, 0.55, -3.4, 38] },
  { t: 34.2, v: [-0.4, 1.1, -1.0, -0.4, 0.55, -3.9, 36] },
  { t: 37.0, v: [0.35, 1.15, -0.85, -0.35, 0.62, -3.9, 36] },
  { t: 40.6, v: [0.4, 1.12, -1.0, -0.35, 0.62, -3.9, 36] },
  // scene 5 — where you delegate matters
  { t: 42.4, v: [0.0, 2.7, 2.7, 0.0, 0.8, -3.4, 42] },
  { t: 48.4, v: [-0.3, 2.6, 2.4, -0.2, 0.9, -3.4, 42] },
  { t: 53.4, v: [0.2, 2.5, 2.3, 0.0, 0.9, -3.4, 42] },
  // scene 6 — Mochi's answer
  { t: 55.2, v: [0.0, 0.95, 1.05, 0.0, 0.84, -1.8, 34] },
  { t: 60.8, v: [0.0, 0.92, 0.75, 0.0, 0.86, -1.8, 34] },
  { t: 64.0, v: [0.0, 0.92, 0.7, 0.0, 0.86, -1.8, 34] },
]);
function cameraAt(t) {
  const v = camKeys(t);
  camera.position.set(v[0], v[1], v[2]); camera.lookAt(v[3], v[4], v[5]); camera.fov = v[6]; camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------- animation
const local = (o, v) => o.position.copy(v);
const vaultTop = (i, n) => { const vv = validators[i]; return vv.root.position.clone().add(V(0, 0.04 + n * COIN_H + 0.02, 0.62).applyAxisAngle(V(0, 1, 0), vv.root.rotation.y)); };
function mochiHoldTop(n) { const u = mochi.userData; return mochi.position.clone().add(V(0, 0.24 + n * COIN_H + 0.02, 0.24).applyAxisAngle(V(0, 1, 0), mochi.rotation.y)); }
function hopPath(t, t0, t1, a, b, n, h = 0.1) {
  const u = seg(t, t0, t1), k = eio(u);
  const ph = (u * n) % 1;
  const air = u > 0 && u < 1 ? Math.sin(ph * Math.PI) * h : 0;
  return { x: lerp(a[0], b[0], k), z: lerp(a[1], b[1], k), hop: air, squash: u > 0 && u < 1 ? -0.05 * Math.sin(ph * Math.PI) : 0 };
}

function animate(t) {
  const C = counts(t);
  // ---- validators
  const tiltU = sm(seg(t, 44.0, 47.6)) * (1 - sm(seg(t, 49.6, 51.8)));
  const wob = Math.sin(t * 5.2) * 0.012 * tiltU + Math.sin(t * 7) * 0.02 * pulse(t, 51.4, 53.2) * 0.4;
  stage.rotation.z = 0.12 * tiltU + wob;
  validators.forEach((v, i) => {
    const n = C.v[i];
    const h = podH(Math.max(n, 3)) * (i === 0 ? 1 : lerp(1, 0.82, tiltU));
    v.pod.scale.y = h; v.pod.position.y = h / 2;
    v.band.position.y = h - 0.03;
    v.char.position.y = h;
    v.stack.set(n);
    // seat light: validator 2 "earns its seat" in scene 3
    const seat = i === 1 ? (t < 19.6 ? 1 : sm(seg(t, 21.9, 22.4))) : 1;
    v.band.material.emissiveIntensity = 0.35 * seat;
    // head motion: inspecting during scene 2, shifty for validator 4 in scene 3
    let ry = 0.12 * Math.sin(t * 0.9 + i), rx = 0.04 * Math.sin(t * 1.3 + i);
    const inspect = pulse(t, 12.4 + i * 0.15, 16.0 + i * 0.25);
    rx += 0.25 * inspect; ry += 0.3 * Math.sin(t * 2.4 + i) * inspect;
    if (i === 3 && t > 26.2 && t < 30.4) { ry += 0.45 * Math.sign(Math.sin(t * 3.1)) * 0.8; }
    v.head.rotation.set(rx, ry, 0);
    v.lineMat.color.set(i === 3 && t > 26.2 && t < 30.4 ? COL.amber : COL.teal);
    v.line.rotation.z = i === 3 && t > 26.2 && t < 30.4 ? 0.3 : 0;
    // tall validator wobbles
    v.char.rotation.z = i === 0 ? 0.05 * Math.sin(t * 4.3) * tiltU : 0;
  });

  // ---- Mochi
  let mp = { x: 0, z: 0.85, ry: 0, eyes: 'smug', mouth: 'w', lift: 0.35, y: SY };
  if (t < 7.6) {
    const hp = hopPath(t, 0.0, 1.3, [-1.5, 2.6], [0, 2.6], 4, 0.12);
    mp = { ...mp, ...hp, ry: t < 1.3 ? lerp(Math.PI / 2, 0, eio(seg(t, 0.9, 1.5))) : 0 };
    if (t > 1.3) mp.squash = 0.07 * pulse(t, 1.3, 1.6);
    mp.eyes = t < 3.6 ? 'happy' : 'curious'; mp.mouth = t < 3.6 ? 'w' : 'open';
    mp.lift = lerp(0.35, 0.75, eio(seg(t, 2.0, 2.6))) * (1 - 0.5 * eio(seg(t, 3.8, 4.4)));
    mp.tilt = 0.22 * eio(seg(t, 3.8, 4.4)); mp.look = [0.3 * eio(seg(t, 3.8, 4.4)), -0.4 * eio(seg(t, 3.8, 4.4))];
  } else if (t < 19.6) {
    // watches the validators (back three-quarter)
    mp = { ...mp, x: -2.9, z: 1.1, ry: Math.PI + 0.55, eyes: 'curious', mouth: 'w', lift: 0.3 };
    mp.tilt = 0.08 * Math.sin(t * 0.8); if (t > 17.4) { mp.eyes = 'happy'; mp.squash = 0.05 * pulse(t, 17.6, 18.0); }
  } else if (t < 30.6) {
    mp = { ...mp, x: -3.0, z: 0.4, ry: Math.PI + 0.5 };
  } else if (t < 41.4) {
    const hp = hopPath(t, 31.0, 34.2, [-3.0, -0.3], [-0.62, -0.72], 7, 0.1);
    mp = { ...mp, ...hp };
    mp.ry = t < 34.0 ? Math.PI / 2 + 0.2 : lerp(Math.PI / 2 + 0.2, 1.9, eio(seg(t, 34.0, 34.5)));
    mp.lift = 0.55; mp.eyes = 'smug';
    if (t > 37.9) { mp.eyes = 'happy'; mp.squash = 0.06 * pulse(t, 38.6, 39.0); }
    if (t > 39.4) { mp.eyes = 'worried'; mp.mouth = 'flat'; mp.sweat = eo(seg(t, 39.5, 39.9)); mp.tilt = -0.1 * eio(seg(t, 39.4, 39.9)); }
    if (t > 34.0 && t < 36.2) mp.look = [0, -0.2];
  } else if (t < 54.6) {
    mp = { ...mp, x: 0.0, z: 0.4, ry: Math.PI, eyes: 'curious', lift: 0.55 };
    if (t > 44.5 && t < 49.4) { mp.eyes = 'worried'; mp.mouth = 'flat'; mp.sweat = 1; }
    if (t > 50.8) { mp.eyes = 'happy'; mp.mouth = 'w'; }
    mp.ry = Math.PI + 0.2 * Math.sin(t * 0.7);
  } else {
    mp = { ...mp, x: 0.0, z: -0.2, ry: 0, eyes: 'happy', mouth: 'w', lift: 0.25 };
    mp.squash = 0.09 * pulse(t, 54.9, 55.35) + 0.06 * pulse(t, 57.0, 57.4);
    if (t > 55.8 && t < 57.2) { mp.eyes = 'wink'; }
    mp.tilt = 0.12 * Math.sin(seg(t, 55.8, 57.4) * Math.PI);
    mp.wave = pulse(t, 57.2, 58.8) * (0.8 + 0.2 * Math.sin(t * 14));
  }
  poseMochi(mochi, mp, t);
  mochiStack.set(t >= 54.6 ? 0 : C.m);
  mochi.userData.hold.visible = t < 54.6;

  // ---- holders (scene 5)
  holders.forEach((h, k) => {
    const vis = t > 42.6 && t < 54.6;
    h.visible = vis;
    const x = [-3.2, -2.1, -1.1, 1.1, 2.1, 3.2][k], z = 0.6 + 0.35 * Math.abs(x) * 0.25;
    const pop = backOut(seg(t, 42.6 + k * 0.1, 43.1 + k * 0.1));
    h.position.set(x, SY + Math.abs(Math.sin(t * 4 + k)) * 0.03, z); h.scale.setScalar(Math.max(0.001, pop));
    h.rotation.y = Math.PI + Math.atan2(x - VX[0], z - vz(VX[0])) * 0.6;
  });

  // ---- flying coins
  let fi = 0, fm = 0;
  flyCoins.forEach(c => c.visible = false); flyCoinsM.forEach(c => c.visible = false);
  for (const e of transfers) {
    if (t < e.t0 || t >= e.t1) continue;
    const u = seg(t, e.t0, e.t1);
    const before = counts(e.t0 - 1e-4);
    let a;
    if (e.from === 'sky') a = vaultTop(e.to, 0).add(V(0, 1.4, 0));
    else if (e.from === 'sky2') a = vaultTop(2, before.v[2]).add(V(0, 0.1, 0));
    else if (e.from === 'm') a = mochiHoldTop(before.m);
    else if (typeof e.from === 'string' && e.from[0] === 'h') a = holders[+e.from.slice(1)].position.clone().add(V(0, 0.45, 0));
    else a = vaultTop(e.from, before.v[e.from]);
    const after = counts(e.t1);
    const b = typeof e.to === 'number' ? vaultTop(e.to, after.v[e.to] - 1) : mochiHoldTop(after.m - 1);
    const c = e.from === 'm' ? flyCoinsM[fm++ % flyCoinsM.length] : flyCoins[fi++ % flyCoins.length];
    c.visible = true;
    const p = lerpV(a, b, eio(u)); p.y += Math.sin(u * Math.PI) * (e.from === 'sky' ? 0.05 : 0.55);
    c.position.copy(p); c.rotation.set(u * Math.PI * 2, 0, 0.3);
  }
  // scene 3 slash: two coins slide off validator 4's stack
  blade.visible = t > 28.0 && t < 29.2;
  if (blade.visible) {
    const top = vaultTop(3, 5);
    blade.position.copy(top).add(V(lerp(-0.7, 0.7, eio(seg(t, 28.1, 28.8))), -0.035, 0));
    blade.rotation.y = validators[3].root.rotation.y;
  }
  for (let k = 0; k < 2; k++) {
    const c = flyCoins[14 + k];
    if (t > SLASH_T && t < SLASH_T + 1.1) {
      const u = seg(t, SLASH_T, SLASH_T + 1.1);
      c.visible = true; const top = vaultTop(3, 3 + k);
      c.position.copy(top).add(V(0.25 + u * 0.8, 0.15 * Math.sin(u * Math.PI) - u * u * 0.9, 0.1));
      c.rotation.set(0, 0, -u * 4); c.scale.setScalar(1 - ei(u));
    } else c.scale.setScalar(1);
  }

  // ---- task cards & votes (scene 2)
  const center = V(0, SY + 1.7, -1.6);
  taskDyn.update({});
  taskCards.forEach((tc, k) => {
    if (k === 5) {
      const inU = eo(seg(t, 9.4, 10.6)), outU = seg(t, 11.5, 11.7);
      tc.visible = t > 9.4 && t < 11.7;
      tc.position.copy(center).add(V(0, (1 - inU) * 1.5, 0)); tc.scale.setScalar(lerp(0.6, 1.3, inU) * (1 - outU * 0.3));
      tc.lookAt(camera.position.clone().sub(stage.position)); return;
    }
    const v = validators[k];
    const u = eio(seg(t, 11.6 + k * 0.06, 12.6 + k * 0.06));
    tc.visible = t > 11.6 && t < 16.2 + k * 0.25;
    const target = v.root.position.clone().add(V(0, podH(5) + 0.62, 0.42).applyAxisAngle(V(0, 1, 0), v.root.rotation.y));
    tc.position.copy(lerpV(center, target, u)); tc.position.y += Math.sin(u * Math.PI) * 0.3;
    tc.scale.setScalar(lerp(1.3, 0.62, u) * (1 - ei(seg(t, 15.8 + k * 0.25, 16.2 + k * 0.25))));
    tc.rotation.set(-0.15, v.root.rotation.y + Math.PI * (1 - u) * 0, 0);
  });
  okDyn.update({ bad: false });
  badges.forEach((b, k) => {
    const v = validators[k];
    const tIn = 15.2 + k * 0.4;
    const pop = backOut(seg(t, tIn, tIn + 0.35));
    const merge = eio(seg(t, 17.3 + k * 0.05, 18.1 + k * 0.05));
    b.visible = t > tIn && merge < 0.999 && t < 19.6;
    const above = v.root.position.clone().add(V(0, podH(5) + 1.05, 0));
    b.position.copy(lerpV(above, center, merge)); b.scale.setScalar(Math.max(0.001, pop * (1 - 0.4 * merge)));
    b.lookAt(camera.position.clone().sub(stage.position));
  });
  bigCheck.visible = t > 18.05 && t < 19.6;
  if (bigCheck.visible) { bigCheck.position.copy(center); bigCheck.scale.setScalar(backOut(seg(t, 18.05, 18.5))); bigCheck.lookAt(camera.position.clone().sub(stage.position)); }

  // ---- labels
  const label = (L, dyn, state, vis, pos, s) => { dyn.update(state); L.visible = vis; if (vis) { L.position.copy(pos); L.scale.setScalar(Math.max(0.001, s)); L.lookAt(camera.position.clone().sub(stage.position)); } };
  label(labelReward, pillReward, { text: '+ reward', bg: COL.tealDeep }, t > 25.5 && t < 27.0, vaultTop(1, 7).add(V(0, 0.55, 0)), backOut(seg(t, 25.5, 25.85)));
  label(labelSlash, pillSlash, { text: 'slashed', bg: COL.red }, t > 28.7 && t < 30.6, vaultTop(3, 4).add(V(0, 0.55, 0)), backOut(seg(t, 28.7, 29.05)));
  label(labelShare, pillShare, { text: 'Mochi’s share', bg: COL.magenta }, t > 36.6 && t < 39.3, vaultTop(2, 8).add(V(0, 0.55, 0)), backOut(seg(t, 36.6, 36.95)));
  // risk ripple around the delegated vault
  const rw = seg(t, 39.4, 40.6);
  warnRing.visible = rw > 0 && rw < 1;
  if (warnRing.visible) { const p = vaultTop(2, 0); warnRing.position.set(p.x, SY + 0.004, p.z); warnRing.scale.setScalar(0.6 + rw * 1.4); warnRing.material.opacity = 1 - rw; }
  // thought bubble (scene 1)
  bubble.visible = t > 4.3 && t < 7.6;
  if (bubble.visible) { bubble.position.copy(mochi.position).add(V(0.5, 0.98, 0.1)); bubble.scale.setScalar(backOut(seg(t, 4.3, 4.7))); bubble.lookAt(camera.position.clone().sub(stage.position)); }
  qDyn.update({});
}

// ---------------------------------------------------------------- overlays
const $ = id => document.getElementById(id);
const OV = [['o_where', 4.6, 7.5], ['o_checkers', 12.6, 19.3], ['o_skin', 21.2, 30.3], ['o_delegate', 32.8, 41.1],
  ['o_tilt', 44.4, 48.9], ['o_spread', 49.8, 54.4], ['o_wisely', 57.0, 60.7]];
function overlays(t) {
  for (const [id, a, b] of OV) {
    const el = $(id); const o = eo(seg(t, a, a + 0.45)) * (1 - ei(seg(t, b - 0.35, b)));
    el.style.opacity = o.toFixed(3);
    el.style.transform = `translateY(${((1 - backOut(seg(t, a, a + 0.6))) * 30).toFixed(1)}px) scale(${lerp(0.94, 1, eo(seg(t, a, a + 0.5))).toFixed(3)})`;
  }
  const e = seg(t, 60.6, 61.2);
  $('endcard').style.opacity = sm(e).toFixed(3);
  $('e_mochi').style.transform = `translateY(${((1 - backOut(seg(t, 60.8, 61.5))) * 60).toFixed(1)}px)`;
  [['e_l1', 61.0], ['e_l2', 61.4], ['e_brand', 61.9]].forEach(([id, a]) => {
    $(id).style.opacity = eo(seg(t, a, a + 0.4)).toFixed(3); $(id).style.transform = `translateY(${((1 - eo(seg(t, a, a + 0.5))) * 22).toFixed(1)}px)`;
  });
}

function renderAt(t) {
  t = clamp(t, 0, DURATION);
  cameraAt(t);
  animate(t);
  overlays(t);
  renderer.render(scene, camera);
}

async function init() {
  await Promise.all([
    loadImg('glTeal', 'assets/logos/genlayer_mark_teal.png'), loadImg('glWhite', 'assets/logos/genlayer_mark_white.png'),
    loadImg('glMag', 'assets/logos/genlayer_mark_magenta.png'),
    document.fonts.load('700 40px "Fredoka"'), document.fonts.load('600 40px "Fredoka"'),
    document.fonts.load('600 40px "Inter Film"'), document.fonts.load('700 40px "Inter Film"'),
  ]);
  await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  coinFace = new DynTex(256, 256, drawCoinFace); coinFace.update({});
  coinFaceMochi = new DynTex(256, 256, drawCoinFace); coinFaceMochi.update({ rim: COL.magenta });
  validators.forEach(v => v.stack.init()); mochiStack.init();
  // coins created before textures existed get their maps now
  [...flyCoins, ...flyCoinsM].forEach((c, k) => { c.children[1].material.map = (k >= flyCoins.length ? coinFaceMochi : coinFace).tex; c.children[1].material.needsUpdate = true; });
  const chestTex = new THREE.CanvasTexture(imgs.glMag); chestTex.colorSpace = THREE.SRGBColorSpace;
  mochi.userData.chest.material.map = chestTex; mochi.userData.chest.material.needsUpdate = true;
  renderAt(0);
  window.renderAt = t => { renderAt(t); return true; };
  window.filmReady = true;
  const q = new URLSearchParams(location.search);
  if (q.has('t')) renderAt(parseFloat(q.get('t')));
  if (q.has('preview')) { const s0 = performance.now(); const loop = () => { renderAt(((performance.now() - s0) / 1000) % DURATION); requestAnimationFrame(loop); }; loop(); }
}
init();
