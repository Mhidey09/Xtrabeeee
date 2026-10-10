// THE INTERNET COURT — deterministic 3D product film.
// window.renderAt(t) renders the frame at time t (seconds). Nothing here reads the wall clock
// except the optional ?preview playback loop, so every frame is reproducible.
import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';

export const DURATION = 80;
const W = 1920, H = 1080;

// ---------------------------------------------------------------- palette
const COL = {
  cream: '#F4EEE4', cream2: '#EDE5D8', paper: '#FBF8F2', stone: '#D8CFC1', stoneDark: '#B9AE9E',
  ink: '#1C1915', muted: '#6F675C', graphite: '#2A2A2D', black: '#111112',
  mmOrange: '#FF5C16', icRed: '#B81C1D', amber: '#E9A23B', amberSoft: '#F7DFB3',
  teal: '#3E9C8F', sage: '#9DB8A0', lilac: '#B9A6E0', sky: '#8DB3E8', sand: '#E2C08F', coral: '#E58B6D',
  champagne: '#D9CDB8', glass: '#EEF2F1', ok: '#3C8E5A'
};

// ---------------------------------------------------------------- math helpers
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, x) => a + (b - a) * x;
const eio = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eo = x => 1 - Math.pow(1 - x, 3);
const ei = x => x * x * x;
const sm = x => x * x * (3 - 2 * x);
const backOut = x => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerpV = (a, b, x) => a.clone().lerp(b, x);
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Cubic Hermite keyframe track over vectors. Keys: {t, v:[...], hold?}. "hold" pins velocity to zero.
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

// ---------------------------------------------------------------- renderer / scene
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(COL.cream);
scene.fog = new THREE.Fog(COL.cream, 55, 170);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(36, W / H, 0.05, 600);

const hemi = new THREE.HemisphereLight('#FFF8EE', '#D9CBB5', 1.35);
scene.add(hemi);
const key = new THREE.DirectionalLight('#FFF1DC', 2.6);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
key.shadow.radius = 4;
scene.add(key, key.target);
const KEY_DIR = V(-0.55, 1.0, 0.62).normalize();
const fill = new THREE.DirectionalLight('#E9F0FF', 0.45);
fill.position.set(8, 6, -6);
scene.add(fill);

// ---------------------------------------------------------------- materials
const matCache = {};
const ceramic = c => matCache['c' + c] ??= new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, metalness: 0 });
const painted = c => matCache['p' + c] ??= new THREE.MeshStandardMaterial({ color: c, roughness: 0.42, metalness: 0 });
const satin = c => matCache['s' + c] ??= new THREE.MeshStandardMaterial({ color: c, roughness: 0.32, metalness: 0.85 });
const flatSatin = c => matCache['fs' + c] ??= new THREE.MeshStandardMaterial({ color: c, roughness: 0.36, metalness: 0.55, flatShading: true });
const frosted = (c = COL.glass, o = 0.55) => matCache['g' + c + o] ??= new THREE.MeshPhysicalMaterial({
  color: c, roughness: 0.28, metalness: 0, transparent: true, opacity: o, clearcoat: 0.6, clearcoatRoughness: 0.4, depthWrite: false });
const basic = c => matCache['b' + c] ??= new THREE.MeshBasicMaterial({ color: c });

const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
function mesh(geo, mat, cast = true, receive = true) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive; return m;
}
const rbox = (w, h, d, r = 0.02, s = 4) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));

// ---------------------------------------------------------------- assets
const imgs = {};
function loadImg(name, src) { return new Promise(r => { const i = new Image(); i.onload = () => { imgs[name] = i; r(); }; i.src = src; }); }

// ---------------------------------------------------------------- canvas textures
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
const SERIF = '"Playfair Display", serif';
const SANS = '"Inter Film", sans-serif';

class DynTex {
  constructor(w, h, draw) {
    this.c = document.createElement('canvas'); this.c.width = w; this.c.height = h;
    this.ctx = this.c.getContext('2d'); this.draw = draw; this.key = null;
    this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;
  }
  update(state) {
    const k = JSON.stringify(state);
    if (k === this.key) return;
    this.key = k; this.ctx.clearRect(0, 0, this.c.width, this.c.height);
    this.draw(this.ctx, state, this.c.width, this.c.height); this.tex.needsUpdate = true;
  }
}

function highlightWord(ctx, x, y, text, font, mode, a = 1) {
  ctx.font = font;
  const w = ctx.measureText(text).width;
  if (mode) {
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = COL.amberSoft; rr(ctx, x - 8, y - 50, w + 16, 64, 10); ctx.fill();
    ctx.fillStyle = COL.amber; ctx.fillRect(x - 4, y + 10, w + 8, 6);
    ctx.restore();
  }
  ctx.fillStyle = COL.ink; ctx.fillText(text, x, y);
  return w;
}

// Card: the user's original instruction. state: {hl: 0..1, tag}
function drawInstruction(ctx, s, w, h) {
  ctx.fillStyle = COL.paper; rr(ctx, 0, 0, w, h, 26); ctx.fill();
  ctx.strokeStyle = '#E4DACB'; ctx.lineWidth = 4; rr(ctx, 2, 2, w - 4, h - 4, 24); ctx.stroke();
  ctx.fillStyle = COL.ink; ctx.font = `700 120px ${SERIF}`; ctx.fillText('“', 44, 150);
  ctx.fillStyle = COL.muted; ctx.font = `600 27px ${SANS}`; ctx.letterSpacing = '4px';
  ctx.fillText('YOUR INSTRUCTION', 48, 210); ctx.letterSpacing = '0px';
  const f = `700 64px ${SERIF}`; ctx.font = f; ctx.fillStyle = COL.ink;
  ctx.fillText('Get me a daily', 48, 330);
  highlightWord(ctx, 48, 412, 'football', f, s.hl > 0, s.hl);
  ctx.font = f; ctx.fillText('news digest.', 48, 494);
  ctx.fillStyle = '#E4DACB'; ctx.fillRect(48, 600, w - 96, 3);
  ctx.fillStyle = COL.muted; ctx.font = `500 28px ${SANS}`; ctx.fillText('From: you   →   To: your agent', 48, 660);
  if (s.tag) tagPill(ctx, w, s.tag);
}
// Card: the transaction receipt. state: {hl, tag}
function drawReceipt(ctx, s, w, h) {
  ctx.fillStyle = COL.paper; rr(ctx, 0, 0, w, h, 26); ctx.fill();
  ctx.strokeStyle = '#E4DACB'; ctx.lineWidth = 4; rr(ctx, 2, 2, w - 4, h - 4, 24); ctx.stroke();
  ctx.fillStyle = COL.ok; ctx.beginPath(); ctx.arc(76, 104, 30, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(62, 105); ctx.lineTo(73, 116); ctx.lineTo(92, 94); ctx.stroke();
  ctx.fillStyle = COL.ink; ctx.font = `700 30px ${SANS}`; ctx.letterSpacing = '3px';
  ctx.fillText('PAYMENT CONFIRMED', 124, 116); ctx.letterSpacing = '0px';
  ctx.fillStyle = COL.muted; ctx.font = `600 27px ${SANS}`; ctx.letterSpacing = '4px';
  ctx.fillText('PURCHASED', 48, 210); ctx.letterSpacing = '0px';
  const f = `700 64px ${SERIF}`;
  highlightWord(ctx, 48, 330, 'Basketball', f, s.hl > 0, s.hl);
  ctx.font = f; ctx.fillStyle = COL.ink; ctx.fillText('highlights feed', 48, 412);
  ctx.fillStyle = '#E4DACB'; ctx.fillRect(48, 480, w - 96, 3);
  const rows = [['Category', 'Sports news'], ['Permission', 'Within limits'], ['Paid via', 'x402']];
  rows.forEach(([a, b], i) => {
    const y = 548 + i * 60;
    ctx.fillStyle = COL.muted; ctx.font = `500 30px ${SANS}`; ctx.fillText(a, 48, y);
    ctx.fillStyle = COL.ink; ctx.font = `600 30px ${SANS}`; const tw = ctx.measureText(b).width; ctx.fillText(b, w - 48 - tw - (i < 2 ? 44 : 0), y);
    if (i < 2) { ctx.strokeStyle = COL.ok; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(w - 84, y - 12); ctx.lineTo(w - 72, y); ctx.lineTo(w - 52, y - 24); ctx.stroke(); }
  });
  if (s.tag) tagPill(ctx, w, s.tag);
}
function tagPill(ctx, w, text) {
  ctx.font = `700 24px ${SANS}`; ctx.letterSpacing = '3px';
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = COL.icRed; rr(ctx, w - tw - 84, 168, tw + 40, 50, 25); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(text, w - tw - 64, 202); ctx.letterSpacing = '0px';
}

// MetaMask permission interface. state: {rows: 0..4, focus, revoked, extra: 0..3}
function drawPermission(ctx, s, w, h) {
  ctx.fillStyle = 'rgba(252,250,246,0.97)'; rr(ctx, 0, 0, w, h, 36); ctx.fill();
  ctx.strokeStyle = '#E2D8C8'; ctx.lineWidth = 4; rr(ctx, 2, 2, w - 4, h - 4, 34); ctx.stroke();
  ctx.save(); rr(ctx, 56, 48, 104, 104, 22); ctx.clip(); ctx.drawImage(imgs.mm, 56, 48, 104, 104); ctx.restore();
  ctx.fillStyle = COL.ink; ctx.font = `700 50px ${SANS}`; ctx.fillText('MetaMask', 188, 116);
  ctx.fillStyle = COL.muted; ctx.font = `600 30px ${SANS}`; ctx.letterSpacing = '4px';
  const lab = 'AGENT PERMISSION'; const lw = ctx.measureText(lab).width; ctx.fillText(lab, w - 64 - lw, 112); ctx.letterSpacing = '0px';
  ctx.fillStyle = '#E8DFD0'; ctx.fillRect(56, 190, w - 112, 3);
  const rows = [
    ['Delegated to', 'Your agent'],
    ['Allowed', 'Sports-news services'],
    ['Spending', 'Within limits you set'],
    ['Delegation', s.revoked ? 'Revoked' : 'Active'],
  ];
  rows.forEach(([a, b], i) => {
    const y = 268 + i * 96;
    const vis = clamp(s.rows - i);
    if (vis <= 0) return;
    ctx.save(); ctx.globalAlpha = vis;
    if (s.focus === i) { ctx.fillStyle = 'rgba(255,92,22,0.10)'; rr(ctx, 40, y - 58, w - 80, 86, 18); ctx.fill(); }
    ctx.fillStyle = COL.muted; ctx.font = `500 40px ${SANS}`; ctx.fillText(a, 72, y);
    let col = COL.ink;
    if (i === 3) col = s.revoked ? COL.icRed : COL.ok;
    ctx.fillStyle = col; ctx.font = `600 42px ${SANS}`;
    const tw = ctx.measureText(b).width; ctx.fillText(b, w - 72 - tw, y);
    if (i === 3) { ctx.beginPath(); ctx.arc(w - 72 - tw - 26, y - 14, 11, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  });
  if (s.extra > 0) {
    const lines = [['Earlier payment', 'Already settled'], ['New payments', 'Blocked'], ['Your account & funds', 'In your control']];
    ctx.fillStyle = '#E8DFD0'; ctx.fillRect(56, 636, w - 112, 3);
    lines.forEach(([a, b], i) => {
      const vis = clamp(s.extra - i); if (vis <= 0) return;
      const y = 708 + i * 66; ctx.save(); ctx.globalAlpha = vis;
      ctx.fillStyle = COL.muted; ctx.font = `500 34px ${SANS}`; ctx.fillText(a, 72, y);
      ctx.fillStyle = i === 1 ? COL.icRed : COL.ink; ctx.font = `600 34px ${SANS}`;
      const tw = ctx.measureText(b).width; ctx.fillText(b, w - 72 - tw, y); ctx.restore();
    });
  } else {
    ctx.fillStyle = COL.muted; ctx.font = `500 30px ${SANS}`;
    ctx.globalAlpha = clamp(s.rows - 3.5) ; ctx.fillText('Smart Account delegation · enforced in code', 72, 700); ctx.globalAlpha = 1;
  }
}

// Terminal screen. state: {mode: 'idle'|'paying'|'paid'|'rejected', p}
function drawTerminal(ctx, s, w, h) {
  ctx.fillStyle = '#1E1F22'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#F4EEE4'; ctx.textAlign = 'center';
  if (s.mode === 'paid') {
    ctx.fillStyle = COL.ok; ctx.beginPath(); ctx.arc(w / 2, 120, 58, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 13; ctx.lineCap = 'round'; ctx.beginPath();
    ctx.moveTo(w / 2 - 26, 122); ctx.lineTo(w / 2 - 6, 142); ctx.lineTo(w / 2 + 28, 100); ctx.stroke();
    ctx.fillStyle = '#F4EEE4'; ctx.font = `700 46px ${SANS}`; ctx.fillText('Paid', w / 2, 248);
  } else {
    ctx.font = `700 54px ${SANS}`; ctx.fillText('x402', w / 2, 128);
    ctx.font = `500 34px ${SANS}`; ctx.fillStyle = '#B7AFA3'; ctx.fillText('Sports news services', w / 2, 192);
    ctx.fillStyle = '#3A3B40'; rr(ctx, 80, 230, w - 160, 16, 8); ctx.fill();
    ctx.fillStyle = COL.mmOrange; rr(ctx, 80, 230, (w - 160) * clamp(s.p || 0), 16, 8); ctx.fill();
  }
  ctx.textAlign = 'left';
}

// Token face
function drawToken(ctx, s, w, h) {
  ctx.fillStyle = '#E9DFCB'; ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#B9A98C'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 22, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = COL.ink; ctx.textAlign = 'center'; ctx.font = `700 70px ${SANS}`; ctx.fillText('x402', w / 2, h / 2 + 24); ctx.textAlign = 'left';
}

// Validator evidence panel. state: {i, p (0..1 progress), res (0..1), focus}
function drawValidator(ctx, s, w, h) {
  ctx.fillStyle = 'rgba(252,250,246,0.97)'; rr(ctx, 0, 0, w, h, 30); ctx.fill();
  ctx.strokeStyle = '#DDD3C3'; ctx.lineWidth = 4; rr(ctx, 2, 2, w - 4, h - 4, 28); ctx.stroke();
  ctx.fillStyle = COL.ink; ctx.font = `700 30px ${SANS}`; ctx.letterSpacing = '4px';
  ctx.fillText(`VALIDATOR ${s.i + 1}`, 48, 74); ctx.letterSpacing = '0px';
  ctx.fillStyle = COL.muted; ctx.font = `500 28px ${SANS}`;
  const st = s.res > 0.5 ? 'Assessment ready' : 'Evaluating evidence…';
  const sw = ctx.measureText(st).width; ctx.fillText(st, w - 48 - sw, 74);
  const rows = [['INSTRUCTION', 'Daily football news digest'], ['TRANSACTION', 'Basketball highlights feed · paid'], ['QUESTION', 'Did the purchase match the mandate?']];
  rows.forEach(([a, b], r) => {
    const y = 150 + r * 112;
    if (s.focus === r) { ctx.fillStyle = 'rgba(233,162,59,0.16)'; rr(ctx, 28, y - 40, w - 56, 100, 16); ctx.fill();
      ctx.fillStyle = COL.amber; rr(ctx, 28, y - 40, 8, 100, 4); ctx.fill(); }
    ctx.fillStyle = COL.muted; ctx.font = `600 24px ${SANS}`; ctx.letterSpacing = '3px'; ctx.fillText(a, 52, y); ctx.letterSpacing = '0px';
    ctx.fillStyle = COL.ink; ctx.font = `600 38px ${SANS}`; ctx.fillText(b, 52, y + 46);
  });
  const by = h - 112;
  ctx.fillStyle = '#E6DDCF'; rr(ctx, 48, by, w - 96, 14, 7); ctx.fill();
  ctx.fillStyle = COL.black; rr(ctx, 48, by, (w - 96) * clamp(s.p), 14, 7); ctx.fill();
  if (s.res > 0) {
    ctx.save(); ctx.globalAlpha = clamp(s.res);
    const txt = 'Outside the mandate'; ctx.font = `700 32px ${SANS}`;
    const tw = ctx.measureText(txt).width;
    ctx.fillStyle = COL.ink; rr(ctx, 48, by + 34, tw + 48, 56, 28); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(txt, 72, by + 73); ctx.restore();
  }
}

// Verdict panel. state: {a}
function drawVerdict(ctx, s, w, h) {
  ctx.fillStyle = 'rgba(252,250,246,0.98)'; rr(ctx, 0, 0, w, h, 36); ctx.fill();
  ctx.strokeStyle = COL.icRed; ctx.lineWidth = 6; rr(ctx, 3, 3, w - 6, h - 6, 33); ctx.stroke();
  ctx.save(); rr(ctx, 60, 54, 96, 96, 20); ctx.clip(); ctx.drawImage(imgs.ic, 60, 54, 96, 96); ctx.restore();
  ctx.fillStyle = COL.muted; ctx.font = `600 30px ${SANS}`; ctx.letterSpacing = '4px'; ctx.fillText('INTERNET COURT', 184, 96);
  ctx.fillStyle = COL.ink; ctx.font = `500 26px ${SANS}`; ctx.letterSpacing = '2px'; ctx.fillText('DECISION FINALIZED', 184, 136); ctx.letterSpacing = '0px';
  ctx.fillStyle = COL.ink; ctx.font = `900 112px ${SERIF}`; ctx.fillText('Verdict', 60, 300);
  ctx.font = `600 44px ${SANS}`; ctx.fillText('The purchase did not match', 60, 400); ctx.fillText('the user’s mandate.', 60, 456);
  ctx.fillStyle = '#E8DFD0'; ctx.fillRect(60, 510, w - 120, 3);
  ctx.fillStyle = COL.muted; ctx.font = `600 28px ${SANS}`; ctx.letterSpacing = '3px'; ctx.fillText('CONSEQUENCE', 60, 576); ctx.letterSpacing = '0px';
  ctx.fillStyle = COL.icRed; ctx.font = `700 44px ${SANS}`; ctx.fillText('Revoke this agent’s delegation', 60, 636);
  ctx.fillStyle = COL.muted; ctx.font = `500 28px ${SANS}`; ctx.fillText('Adjudicated by an AI jury · powered by GenLayer', 60, h - 60);
}

function drawLabel(ctx, s, w, h) {
  ctx.fillStyle = 'rgba(252,250,246,0.97)'; rr(ctx, 0, 0, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = COL.icRed; ctx.lineWidth = 4; rr(ctx, 2, 2, w - 4, h - 4, h / 2 - 2); ctx.stroke();
  ctx.fillStyle = COL.icRed; ctx.font = `700 40px ${SANS}`; ctx.textAlign = 'center';
  ctx.fillText(s.text, w / 2, h / 2 + 14); ctx.textAlign = 'left';
}

// ---------------------------------------------------------------- builders
function texPlane(w, h, dyn, toneMapped = false) {
  const m = new THREE.MeshBasicMaterial({ map: dyn.tex, transparent: true, toneMapped });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.castShadow = false; p.receiveShadow = false;
  return p;
}

function makeCard(drawFn) {
  const g = new THREE.Group();
  const w = 0.62, h = 0.8;
  const body = mesh(rbox(w, h, 0.014, 0.03, 3), ceramic(COL.paper)); g.add(body);
  const dyn = new DynTex(640, 826, drawFn);
  const face = texPlane(w * 0.995, h * 0.995, dyn); face.position.z = 0.0085; g.add(face);
  g.userData.dyn = dyn;
  return g;
}

function makeAgent(headColor = COL.teal, bodyColor = '#F3EDE3', gemColor = COL.champagne) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const torso = mesh(new THREE.CylinderGeometry(0.155, 0.2, 0.34, 48), ceramic(bodyColor)); torso.position.y = 0.28; body.add(torso);
  const band = mesh(new THREE.CylinderGeometry(0.163, 0.171, 0.05, 48), painted(headColor)); band.position.y = 0.37; body.add(band);
  const footG = new THREE.SphereGeometry(0.075, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const feet = [-0.095, 0.095].map(x => { const f = mesh(footG, painted(COL.graphite)); f.position.set(x, 0.0, 0.03); f.scale.set(1, 0.9, 1.25); g.add(f); return f; });
  const head = new THREE.Group(); head.position.y = 0.62; body.add(head);
  const skull = mesh(rbox(0.38, 0.28, 0.31, 0.085, 5), painted(headColor)); head.add(skull);
  const visor = mesh(rbox(0.27, 0.095, 0.03, 0.04, 4), painted(COL.graphite)); visor.position.set(0, 0.0, 0.152); head.add(visor);
  const lineMat = new THREE.MeshBasicMaterial({ color: '#C8F06A', toneMapped: false });
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.024), lineMat); line.position.set(0, 0, 0.1685); head.add(line);
  const gem = mesh(new THREE.OctahedronGeometry(0.06, 0), flatSatin(gemColor)); gem.position.y = 0.25; head.add(gem);
  g.userData = { body, head, line, lineMat, gem, feet, carry: null };
  return g;
}
// Pose an agent. p: {x,z,ry,hop,squash,tilt,turn,nod,line:{len,tilt,dim},gemSpin}
function poseAgent(a, p) {
  const u = a.userData;
  a.position.set(p.x, (p.y || 0) + (p.hop || 0), p.z); a.rotation.y = p.ry || 0;
  const sq = p.squash || 0;
  u.body.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
  u.head.rotation.set(p.nod || 0, p.turn || 0, p.tilt || 0);
  const L = p.line || {};
  u.line.scale.x = L.len ?? 1; u.line.rotation.z = L.tilt || 0;
  u.lineMat.color.set(L.dim ? '#6F7A5E' : (L.color || '#C8F06A'));
  u.gem.rotation.y = p.gemSpin || 0; u.gem.position.y = 0.25 + Math.sin((p.gemSpin || 0) * 1.3) * 0.015;
}
// Hop locomotion between two points with n hops. Returns {x,z,hop,squash}
function hopMove(t, t0, t1, from, to, n, height = 0.13) {
  const u = seg(t, t0, t1);
  const k = eio(u);
  const x = lerp(from[0], to[0], k), z = lerp(from[1], to[1], k);
  if (u <= 0 || u >= 1) {
    // landing squash just after arrival
    const land = u >= 1 ? Math.max(0, 1 - (t - t1) / 0.25) : 0;
    return { x, z, hop: 0, squash: 0.08 * Math.sin(land * Math.PI) };
  }
  const ph = (u * n) % 1;
  return { x, z, hop: Math.sin(ph * Math.PI) * height, squash: -0.06 * Math.sin(ph * Math.PI) + 0.05 * Math.max(0, 1 - ph * 6) };
}

function makeTerminal() {
  const g = new THREE.Group();
  const base = mesh(rbox(0.56, 0.92, 0.44, 0.06), ceramic('#E7DFD2')); base.position.y = 0.46; g.add(base);
  const stripe = mesh(rbox(0.565, 0.05, 0.445, 0.02), painted(COL.stoneDark)); stripe.position.y = 0.82; g.add(stripe);
  const head = new THREE.Group(); head.position.set(0, 1.04, 0.02); head.rotation.x = -0.42; g.add(head);
  head.add(mesh(rbox(0.62, 0.44, 0.07, 0.03), satin('#3A3A3E')));
  const dyn = new DynTex(512, 320, drawTerminal);
  const scr = texPlane(0.56, 0.35, dyn); scr.position.z = 0.0365; head.add(scr);
  g.userData.dyn = dyn;
  return g;
}

function makeToken() {
  const g = new THREE.Group();
  const disc = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 48), satin(COL.champagne)); disc.rotation.x = Math.PI / 2; g.add(disc);
  const dyn = new DynTex(256, 256, drawToken); dyn.update({});
  const f = texPlane(0.19, 0.19, dyn, true); f.position.z = 0.0155; g.add(f);
  const b = f.clone(); b.rotation.y = Math.PI; b.position.z = -0.0155; g.add(b);
  return g;
}

// ---------------------------------------------------------------- world
const world = new THREE.Group(); scene.add(world);
const ground = mesh(new THREE.PlaneGeometry(600, 600), ceramic(COL.cream), false, true);
ground.rotation.x = -Math.PI / 2; world.add(ground);

// main path from plaza to court (leading line)
const pathMat = ceramic('#EAE1D3');
const pathStrip = mesh(new THREE.BoxGeometry(1.7, 0.012, 27.5), pathMat, false, true); pathStrip.position.set(0, 0.006, -19.4); world.add(pathStrip);

// --- plaza
const PY = 0.06;
const plaza = new THREE.Group(); world.add(plaza);
const plinth = mesh(new THREE.CylinderGeometry(6.2, 6.3, PY, 128), ceramic('#F7F2EA'), false, true); plinth.position.set(0, PY / 2, -1.8); plaza.add(plinth);
// permission boundary: orange floor strips around the service zone
const ZONE = { x0: -2.9, x1: 2.9, z0: 0, z1: -5.0 };
const stripMat = new THREE.MeshStandardMaterial({ color: COL.mmOrange, roughness: 0.5, emissive: COL.mmOrange, emissiveIntensity: 0.15 });
function strip(x0, z0, x1, z1) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const s = mesh(new THREE.BoxGeometry(len, 0.02, 0.05), stripMat, false, true);
  s.position.set((x0 + x1) / 2, PY + 0.01, (z0 + z1) / 2); s.rotation.y = -Math.atan2(z1 - z0, x1 - x0); plaza.add(s); return s;
}
strip(ZONE.x0, ZONE.z0, -1.45, ZONE.z0); strip(1.45, ZONE.z0, ZONE.x1, ZONE.z0);
strip(ZONE.x0, ZONE.z0, ZONE.x0, ZONE.z1); strip(ZONE.x1, ZONE.z0, ZONE.x1, ZONE.z1); strip(ZONE.x0, ZONE.z1, ZONE.x1, ZONE.z1);

// gate
const gate = new THREE.Group(); gate.position.set(0, PY, 0); plaza.add(gate);
const postMat = satin('#D6CCBA');
[-1.45, 1.45].forEach(x => { const p = mesh(rbox(0.14, 1.78, 0.24, 0.04), postMat); p.position.set(x, 0.89, 0); gate.add(p); });
const lintel = mesh(rbox(3.08, 0.15, 0.26, 0.05), postMat); lintel.position.set(0, 1.78, 0); gate.add(lintel);
const lintelStripMat = new THREE.MeshStandardMaterial({ color: COL.mmOrange, roughness: 0.45, emissive: COL.mmOrange, emissiveIntensity: 0.2 });
const lintelStrip = mesh(new THREE.BoxGeometry(2.7, 0.035, 0.01), lintelStripMat, false); lintelStrip.position.set(0, 1.78, 0.132); gate.add(lintelStrip);
const slabs = [-1, 1].map(sx => {
  const s = new THREE.Group();
  const glass = mesh(rbox(0.68, 1.56, 0.05, 0.02), frosted('#E8EEF0', 0.62), true, false); s.add(glass);
  const edge = mesh(rbox(0.035, 1.56, 0.06, 0.012), satin('#CFC4B0')); edge.position.x = -sx * 0.34; s.add(edge);
  s.position.set(sx * 0.34, 0.83, 0); gate.add(s); s.userData.sx = sx; return s;
});
const lockBar = mesh(rbox(1.5, 0.08, 0.08, 0.03), satin('#4A4A50')); lockBar.position.set(0, 0.86, 0.09); gate.add(lockBar);

// permission panel (MetaMask)
const permPanel = new THREE.Group();
const PERM_POS = V(-2.45, PY, 0.75), PERM_RY = 0.38;
permPanel.position.copy(PERM_POS); permPanel.rotation.y = PERM_RY; plaza.add(permPanel);
const permInner = new THREE.Group(); permInner.position.y = 1.32; permPanel.add(permInner);
const permStand = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.75, 16), postMat); permStand.position.y = 0.37; permPanel.add(permStand);
const permBase = mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.04, 40), postMat); permBase.position.y = 0.02; permPanel.add(permBase);
permInner.add(mesh(rbox(1.56, 1.12, 0.05, 0.05), frosted('#F1F3F1', 0.7), true, false));
const permDyn = new DynTex(1200, 862, drawPermission);
const permFace = texPlane(1.5, 1.078, permDyn); permFace.position.z = 0.03; permInner.add(permFace);
const PERM_FACE_POS = () => permInner.getWorldPosition(new THREE.Vector3());

// terminal, agent, cards, tokens
const terminal = makeTerminal(); terminal.position.set(1.0, PY, -3.7); terminal.rotation.y = -0.38; plaza.add(terminal);
const hero = makeAgent(); world.add(hero);
const cardI = makeCard(drawInstruction); world.add(cardI);
const cardR = makeCard(drawReceipt); world.add(cardR);
const token = makeToken(); world.add(token);
const token2 = makeToken(); world.add(token2);
const rejectDyn = new DynTex(760, 110, drawLabel); rejectDyn.update({ text: 'Payment rejected · no funds moved' });
const rejectLabel = texPlane(1.38, 0.2, rejectDyn); world.add(rejectLabel);

// --- courtroom
const COURT = V(0, 0, -40);
const CY = 0.32;
const court = new THREE.Group(); court.position.copy(COURT); world.add(court);
court.add(at(mesh(new THREE.CylinderGeometry(7.65, 7.85, 0.16, 128), ceramic(COL.cream2)), 0, 0.08, 0));
court.add(at(mesh(new THREE.CylinderGeometry(7.25, 7.25, 0.16, 128), ceramic('#F6F1E9')), 0, 0.24, 0));
const ringFlat = (r0, r1, col, y = CY + 0.003) => { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 160), basic(col)); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; court.add(m); return m; };
const redRing = ringFlat(4.36, 4.46, COL.icRed);
ringFlat(2.05, 2.09, COL.stoneDark);
const GAP = Math.asin(1.18 / 6.6);
const lathe = (pts, phiS, phiL, mat) => { const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 160, phiS, phiL); const m = mesh(g, mat); m.material.side = THREE.DoubleSide; return m; };
const wallMat = new THREE.MeshStandardMaterial({ color: '#F3EDE3', roughness: 0.8, side: THREE.DoubleSide });
const wallPts = [[6.45, 0], [6.75, 0], [6.75, 3.0], [6.45, 3.0], [6.45, 0]];
const wall = lathe(wallPts, GAP, Math.PI * 2 - 2 * GAP, wallMat); wall.position.y = CY; court.add(wall);
const overDoor = lathe([[6.45, 2.45], [6.75, 2.45], [6.75, 3.0], [6.45, 3.0], [6.45, 2.45]], -GAP, 2 * GAP, wallMat); overDoor.position.y = CY; court.add(overDoor);
const bandMat = new THREE.MeshStandardMaterial({ color: COL.icRed, roughness: 0.5, side: THREE.DoubleSide });
const band = lathe([[6.755, 2.62], [6.79, 2.62], [6.79, 2.78], [6.755, 2.78], [6.755, 2.62]], 0, Math.PI * 2, bandMat); band.position.y = CY; court.add(band);
const capRing = lathe([[6.42, 3.0], [6.78, 3.0], [6.78, 3.04], [6.42, 3.04], [6.42, 3.0]], 0, Math.PI * 2, satin(COL.champagne)); capRing.position.y = CY; court.add(capRing);
[-1, 1].forEach(s => { const j = mesh(rbox(0.34, 2.45, 0.36, 0.03), satin(COL.champagne)); const zz = Math.sqrt(6.6 * 6.6 - 1.18 * 1.18);
  j.position.set(s * 1.18, CY + 1.225, zz); j.rotation.y = s * GAP; court.add(j); });
const doors = [-1, 1].map(s => { const d = mesh(rbox(1.18, 2.42, 0.12, 0.02), ceramic('#EFE7DA')); d.position.set(s * 0.59, CY + 1.21, 6.5);
  const seam = mesh(new THREE.BoxGeometry(0.03, 2.2, 0.01), basic(COL.icRed)); seam.position.set(-s * 0.5, 0, 0.065); d.add(seam);
  court.add(d); d.userData.s = s; return d; });
for (let k = 0; k < 20; k++) {
  const a = (k + 0.5) / 20 * Math.PI * 2;
  if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < GAP + 0.18) continue;
  const c = mesh(new THREE.CylinderGeometry(0.07, 0.085, 2.9, 24), satin(COL.champagne)); c.position.set(Math.sin(a) * 6.08, CY + 1.45, Math.cos(a) * 6.08); court.add(c);
}
for (let k = 0; k < 12; k++) {
  const a = k / 12 * Math.PI * 2 + Math.PI / 12;
  const l = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 2.2), basic('#D9CFBF'));
  l.position.set(Math.sin(a) * 3.25, CY + 0.002, Math.cos(a) * 3.25); l.rotation.set(-Math.PI / 2, 0, a); court.add(l);
}
const halo = mesh(new THREE.TorusGeometry(5.9, 0.055, 16, 220), satin(COL.champagne)); halo.rotation.x = Math.PI / 2; halo.position.y = 5.5; court.add(halo);
const halo2 = mesh(new THREE.TorusGeometry(5.6, 0.022, 12, 220), satin('#C9B99E')); halo2.rotation.x = Math.PI / 2; halo2.position.y = 5.25; court.add(halo2);
// dais + separable core
const dais = mesh(new THREE.CylinderGeometry(1.35, 1.45, 0.32, 96), ceramic('#EFE8DC')); dais.position.y = CY + 0.16; court.add(dais);
const DAIS_TOP = CY + 0.32;
const coreSegs = [];
[[1.0, COL.champagne, 'satin'], [0.82, '#F2EBDF', 'ceramic'], [0.62, COL.champagne, 'satin']].forEach(([r, c, kind], tier) => {
  for (let k = 0; k < 3; k++) {
    const a0 = k * 2 * Math.PI / 3 + 0.04, a1 = (k + 1) * 2 * Math.PI / 3 - 0.04;
    const sh = new THREE.Shape(); sh.moveTo(0, 0);
    for (let q = 0; q <= 32; q++) { const a = lerp(a0, a1, q / 32); sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    sh.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.17, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 32 });
    g.rotateX(-Math.PI / 2); g.translate(0, -0.085, 0);
    const m = mesh(g, kind === 'satin' ? satin(c) : ceramic(c));
    m.userData = { tier, k, base: V(0, DAIS_TOP + 0.085 + tier * 0.18, 0), ang: Math.PI / 2 + (k * 2 * Math.PI / 3 + Math.PI / 3) };
    court.add(m); coreSegs.push(m);
  }
});
const glCore = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.95, 3), flatSatin(COL.black)); court.add(glCore);
const glCoreBase = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 3), satin('#3A3A3E')); court.add(glCoreBase);
// jury
const JURY_ANG = [-72, -36, 0, 36, 72].map(d => Math.PI + d * Math.PI / 180);
const JR = 3.3, PR = 2.25;
const jurors = JURY_ANG.map((th, i) => {
  const g = new THREE.Group(); court.add(g);
  const geos = [new THREE.TetrahedronGeometry(0.27), new THREE.OctahedronGeometry(0.26), new THREE.IcosahedronGeometry(0.25), new THREE.DodecahedronGeometry(0.25), new THREE.OctahedronGeometry(0.25, 1)];
  const ped = mesh(new THREE.CylinderGeometry(0.22, 0.27, 0.9, 48), satin('#2E2E33')); ped.position.y = 0.45; g.add(ped);
  const cap = mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.04, 48), ceramic('#F3EDE3')); cap.position.y = 0.92; g.add(cap);
  const head = mesh(geos[i], flatSatin('#1D1D21')); head.position.y = 1.36; g.add(head);
  const ring = mesh(new THREE.TorusGeometry(0.36, 0.012, 8, 96), satin(COL.champagne)); ring.position.y = 1.36; g.add(ring);
  const hatch = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.335, 64), basic('#3A3A3E')); hatch.rotation.x = -Math.PI / 2;
  hatch.position.set(Math.sin(th) * JR, CY + 0.004, Math.cos(th) * JR); court.add(hatch);
  // evidence panel facing outward toward the validator
  const pdyn = new DynTex(960, 668, drawValidator);
  const panel = new THREE.Group();
  panel.add(mesh(rbox(0.98, 0.69, 0.03, 0.03), frosted('#F3F4F1', 0.75), true, false));
  const face = texPlane(0.955, 0.665, pdyn); face.position.z = 0.017; panel.add(face);
  court.add(panel);
  // connection strip to the core
  const link = mesh(new THREE.BoxGeometry(0.035, 0.008, 1), basic('#2E2E33'), false, false); court.add(link);
  return { g, th, head, ring, panel, pdyn, link, ped };
});
// verdict panel + seal
const verdictDyn = new DynTex(1300, 860, drawVerdict);
const verdict = new THREE.Group(); court.add(verdict);
verdict.add(mesh(rbox(1.34, 0.89, 0.035, 0.04), frosted('#F4F4F1', 0.8), true, false));
const verdictFace = texPlane(1.3, 0.86, verdictDyn); verdictFace.position.z = 0.02; verdict.add(verdictFace);
const seal = new THREE.Group(); world.add(seal);
{ const sd = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 64), painted(COL.icRed)); sd.rotation.x = Math.PI / 2; seal.add(sd); }
const sealTexMat = new THREE.MeshBasicMaterial({ toneMapped: false });
const sealFace = new THREE.Mesh(new THREE.CircleGeometry(0.13, 64), sealTexMat); sealFace.position.z = 0.021; seal.add(sealFace);
const sealBack = sealFace.clone(); sealBack.rotation.y = Math.PI; sealBack.position.z = -0.021; seal.add(sealBack);
// GenLayer foundation ring around the court (seen in the wide world shot)
const glRing = new THREE.Mesh(new THREE.RingGeometry(8.2, 8.75, 160), new THREE.MeshStandardMaterial({ color: COL.black, roughness: 0.4, metalness: 0.5 }));
glRing.rotation.x = -Math.PI / 2; glRing.position.set(COURT.x, 0.004, COURT.z); glRing.receiveShadow = true; world.add(glRing);

// --- the wider world (hubs of agent activity)
const HUBS = [
  { p: V(-9.5, 0, -11), kind: 'exchange', c: [COL.lilac, COL.sand] },
  { p: V(10.5, 0, -16), kind: 'negotiate', c: [COL.sky, COL.coral] },
  { p: V(-12.5, 0, -27), kind: 'terminal', c: [COL.sage] },
  { p: V(14, 0, -33), kind: 'exchange', c: [COL.sand, COL.sky] },
  { p: V(-11, 0, -52), kind: 'negotiate', c: [COL.coral, COL.lilac] },
  { p: V(12, 0, -53), kind: 'terminal', c: [COL.lilac] },
  { p: V(-21, 0, -16), kind: 'terminal', c: [COL.sky] },
  { p: V(22, 0, -24), kind: 'negotiate', c: [COL.sage, COL.sand] },
  { p: V(-22, 0, -40), kind: 'exchange', c: [COL.sky, COL.sage] },
  { p: V(23, 0, -45), kind: 'exchange', c: [COL.coral, COL.sky] },
  { p: V(0, 0, -60), kind: 'negotiate', c: [COL.sand, COL.lilac] },
];
const hubObjs = HUBS.map((h, hi) => {
  const g = new THREE.Group(); g.position.copy(h.p); world.add(g);
  g.add(at(mesh(new THREE.CylinderGeometry(3.0, 3.1, 0.06, 96), ceramic('#F7F2EA'), false, true), 0, 0.03, 0));
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.7, 2.75, 120), basic(COL.stone)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.065; g.add(ring);
  const agents = (h.kind === 'terminal' ? [...h.c, COL.sand] : h.c).map(c => { const a = makeAgent(c); g.add(a); return a; });
  const o = { g, h, agents, hi };
  if (h.kind === 'terminal') { o.term = makeTerminal(); o.term.position.set(0.7, 0.06, -0.3); o.term.rotation.y = -0.6; g.add(o.term); o.term.userData.dyn.update({ mode: 'idle', p: 0.6 }); }
  if (h.kind === 'exchange') { o.tok = makeToken(); g.add(o.tok); }
  if (h.kind === 'negotiate') { o.doc = mesh(rbox(0.34, 0.44, 0.01, 0.02), ceramic(COL.paper)); g.add(o.doc);
    const lines = mesh(new THREE.PlaneGeometry(0.22, 0.2), basic('#D9CFBF'), false, false); lines.position.z = 0.006; o.doc.add(lines); }
  // path to the main avenue
  const toCourt = h.p.z < -33 || h.p.z > -6;
  const target = toCourt ? COURT.clone().add(h.p.clone().sub(COURT).setLength(8.75)) : V(0, 0, h.p.z);
  const d = target.clone().sub(h.p); const len = Math.max(0.5, d.length() - 3 - (toCourt ? 0 : 0.85));
  const ps = mesh(new THREE.BoxGeometry(1.1, 0.01, len), pathMat, false, true);
  ps.position.copy(h.p.clone().add(d.clone().setLength(3 + len / 2))); ps.position.y = 0.005; ps.rotation.y = Math.atan2(d.x, d.z); world.add(ps);
  return o;
});
// geometric trees
{
  const r = rng(7);
  const trunkG = new THREE.CylinderGeometry(0.06, 0.08, 0.7, 12);
  const crowns = [new THREE.SphereGeometry(0.55, 24, 16), new THREE.ConeGeometry(0.55, 1.4, 24), new THREE.IcosahedronGeometry(0.6, 0)];
  const tones = ['#A9C2A6', '#C7D3B1', '#93B59C', '#D8C9A6'];
  let placed = 0, guard = 0;
  while (placed < 60 && guard++ < 4000) {
    const p = V((r() - 0.5) * 80, 0, 12 - r() * 84);
    const nearPath = (Math.abs(p.x) < 3.5 && p.z < 6 && p.z > -34) || HUBS.some(h => Math.abs(p.z - h.p.z) < 1.5 && Math.abs(p.x) < Math.abs(h.p.x) && Math.sign(p.x) === Math.sign(h.p.x));
    const nearCourt = p.distanceTo(COURT) < 10.5;
    const nearPlaza = p.distanceTo(V(0, 0, -1.8)) < 8.5;
    const nearHub = HUBS.some(h => p.distanceTo(h.p) < 4.6);
    if (nearPath || nearCourt || nearPlaza || nearHub) continue;
    const s = 0.8 + r() * 0.9;
    const t = new THREE.Group(); t.position.copy(p); t.scale.setScalar(s);
    const trunk = mesh(trunkG, ceramic('#BDAE97')); trunk.position.y = 0.35; t.add(trunk);
    const ci = Math.floor(r() * 3); const cr = mesh(crowns[ci], ci === 2 ? flatSatin(tones[placed % 4]) : ceramic(tones[placed % 4]));
    cr.position.y = ci === 1 ? 1.25 : 0.95; t.add(cr); world.add(t); placed++;
  }
}
// a small dispute token travelling from a hub to the court during the world shot
const travelCards = new THREE.Group(); world.add(travelCards);
[-1, 1].forEach(s => { const c = mesh(rbox(0.3, 0.4, 0.01, 0.02), ceramic(COL.paper)); c.position.x = s * 0.18; travelCards.add(c); });

// ---------------------------------------------------------------- camera shots
const P0 = PERM_POS.clone().add(V(0, 1.32, 0));
const PN = V(Math.sin(PERM_RY), 0, Math.cos(PERM_RY));
const permCam = P0.clone().add(PN.clone().multiplyScalar(2.45)).add(V(0, 0.05, 0));
const gateWide = { pos: [-1.55, 1.9, 5.4], look: [-0.95, 0.9, 0.2] };
const camA = track([
  { t: 0, v: [-0.85, 1.42, -0.3, 0.5, 1.12, -3.6, 40] },
  { t: 3.1, v: [0.1, 1.55, -0.55, 0.58, 1.6, -3.45, 35] },
  { t: 3.8, v: [0.14, 1.56, -0.68, 0.59, 1.62, -3.45, 35] },
  { t: 6.6, v: [0.92, 1.6, -2.05, 1.0, 1.62, -3.45, 33] },
]);
const camB = track([
  { t: 6.6, v: [...permCam.toArray(), ...P0.toArray(), 32], hold: true },
  { t: 9.6, v: [...permCam.clone().add(PN.clone().multiplyScalar(0.25)).toArray(), ...P0.toArray(), 33] },
  { t: 11.0, v: [...gateWide.pos, ...gateWide.look, 38] },
  { t: 12.0, v: [-0.2, 1.4, 3.1, 0.0, 0.75, -0.4, 38] },
  { t: 12.9, v: [0.05, 1.3, 1.4, 0.35, 0.8, -2.4, 38] },
  { t: 13.7, v: [0.75, 1.42, -1.25, 1.0, 1.15, -3.6, 37] },
  { t: 14.5, v: [1.35, 1.5, -1.55, 1.0, 1.5, -3.4, 36] },
  { t: 15.7, v: [0.6, 1.52, -1.3, 0.6, 1.47, -3.42, 37] },
  { t: 17.0, v: [0.25, 1.52, -1.25, 0.25, 1.47, -3.42, 37] },
  { t: 18.2, v: [0.0, 1.55, -1.1, 0.0, 1.6, -3.42, 36] },
  { t: 21.0, v: [0.0, 1.55, -0.95, 0.0, 1.75, -40, 34] },
  { t: 22.8, v: [0.0, 1.5, -1.6, 0.0, 1.6, -40, 34] },
  { t: 23.6, v: [0.0, 1.45, -3.6, 0.0, 1.35, -40, 35] },
  { t: 25.0, v: [0.0, 1.3, -24.0, 0.0, 1.15, -40, 36] },
  { t: 26.2, v: [0.0, 1.05, -32.2, 0.0, 1.15, -40, 38] },
  { t: 27.4, v: [0.0, 1.1, -35.6, 0.0, 1.25, -40, 40] },
  { t: 30.0, v: [1.4, 4.3, -34.5, 0.0, 1.0, -40, 42] },
  { t: 32.6, v: [4.5, 4.0, -36.4, 0.0, 1.1, -40, 42] },
  { t: 35.0, v: [3.0, 3.6, -35.4, 0.0, 1.3, -40.4, 40] },
  { t: 37.5, v: [1.4, 3.5, -35.0, 0.0, 1.45, -40.8, 40] },
]);
// over-the-shoulder of juror i, matched framing
function jurorShot(i, t, t0, t1) {
  const th = JURY_ANG[i]; const u = seg(t, t0, t1);
  const out = V(Math.sin(th), 0, Math.cos(th)); const side = V(Math.cos(th), 0, -Math.sin(th));
  const pc = COURT.clone().add(out.clone().multiplyScalar(PR)).add(V(0, 1.52, 0));
  const cam = COURT.clone().add(out.clone().multiplyScalar(lerp(4.05, 3.85, u))).add(side.clone().multiplyScalar(0.98)).add(V(0, lerp(2.42, 2.38, u), 0));
  return [...cam.toArray(), ...pc.clone().add(side.clone().multiplyScalar(0.1)).toArray(), 32];
}
const j4 = jurorShot(4, 42.6, 41.0, 42.6);
const camD = track([
  { t: 42.6, v: j4 },
  { t: 45.2, v: [0.0, 6.4, -31.0, 0.0, 1.25, -40.0, 40] },
  { t: 46.6, v: [0.0, 4.6, -33.2, 0.0, 1.9, -39.4, 38] },
  { t: 47.8, v: [0.0, 2.5, -36.5, 0.0, 2.35, -39.0, 36] },
  { t: 49.4, v: [0.0, 2.45, -36.1, 0.0, 2.35, -39.0, 36] },
  { t: 53.4, v: [...permCam.toArray(), ...P0.toArray(), 32], hold: true },
  { t: 54.2, v: [...permCam.clone().add(PN.clone().multiplyScalar(0.12)).toArray(), ...P0.toArray(), 32] },
  { t: 55.2, v: [...gateWide.pos, ...gateWide.look, 38] },
  { t: 57.6, v: [-1.7, 2.0, 5.7, -1.0, 0.95, 0.2, 39] },
  { t: 61.0, v: [3.5, 8.0, 12.0, 0.0, 0.5, -8.0, 40] },
  { t: 64.6, v: [2.0, 26.0, 2.0, 0.0, 0.0, -20.0, 42] },
  { t: 67.2, v: [0.0, 31.0, -12.0, 0.0, 0.0, -31.0, 42] },
  { t: 70.4, v: [0.0, 15.0, -17.0, 0.0, 4.0, -36.0, 38] },
  { t: 73.4, v: [0.0, 8.0, -24.0, 0.0, 2.8, -38.0, 38] },
  { t: 80, v: [0.0, 7.5, -25.0, 0.0, 2.8, -38.0, 38] },
]);

// verdict seal flight path
const sealPath = new THREE.CatmullRomCurve3([
  V(0, 2.35, -39.0), V(0, 2.2, -36.5), V(0, 1.9, -33.6), V(-0.4, 3.2, -24), V(-1.4, 3.4, -10), V(-2.6, 2.6, -1.0),
  P0.clone().add(PN.clone().multiplyScalar(0.9)).add(V(0, -0.3, 0)).add(V(Math.cos(PERM_RY), 0, -Math.sin(PERM_RY)).multiplyScalar(0.6)),
], false, 'centripetal');
const SEAL_T0 = 49.9, SEAL_T1 = 52.9;
const sealAt = t => sealPath.getPointAt(eio(seg(t, SEAL_T0, SEAL_T1)));

function cameraAt(t) {
  let v;
  if (t < 6.6) v = camA(t);
  else if (t < 37.5) v = camB(t);
  else if (t < 39.3) v = jurorShot(0, t, 37.5, 39.3);
  else if (t < 41.0) v = jurorShot(2, t, 39.3, 41.0);
  else if (t < 42.6) v = jurorShot(4, t, 41.0, 42.6);
  else {
    v = camD(t);
    // chase the verdict seal as it travels back to the permission system
    const w = sm(seg(t, 49.5, 50.4)) * (1 - sm(seg(t, 52.4, 53.4)));
    if (w > 0) {
      const p = sealAt(t), ahead = sealAt(Math.min(t + 0.25, SEAL_T1 + 0.3));
      const dir = ahead.clone().sub(p); dir.y = 0; if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1); dir.normalize();
      const side = V(dir.z, 0, -dir.x);
      const cp = p.clone().add(side.multiplyScalar(2.2)).add(V(0, 0.55, 0)).add(dir.clone().multiplyScalar(-1.2));
      const lk = p.clone().add(dir.clone().multiplyScalar(0.8));
      const f = [...cp.toArray(), ...lk.toArray(), 40];
      v = v.map((x, k) => lerp(x, f[k], w));
    }
  }
  camera.position.set(v[0], v[1], v[2]);
  camera.lookAt(v[3], v[4], v[5]);
  camera.fov = v[6]; camera.updateProjectionMatrix();
  return V(v[3], v[4], v[5]);
}

// ---------------------------------------------------------------- per-frame animation
const CARD_I_S1 = V(0.18, 1.5, -3.42), CARD_R_S1 = V(1.0, 1.5, -3.42);
const CARD_I_EV = V(-0.39, CY + 1.62, -40 + 1.35), CARD_R_EV = V(0.39, CY + 1.62, -40 + 1.35);

function setCard(card, pos, ry = 0, scale = 1, visible = true, rx = 0) {
  card.visible = visible && scale > 0.001; card.position.copy(pos); card.rotation.set(rx, ry, 0); card.scale.setScalar(Math.max(scale, 0.001));
}

function animate(t) {
  // freeze beat in scene 1: ambient motion holds still while the mismatch lands
  const ft = t < 3.25 ? t : t < 3.8 ? 3.25 : t - 0.55;

  // ---------- hero agent
  let hp = { x: 0.15, z: -3.05, ry: 0.55, tilt: 0, turn: 0, nod: 0, gemSpin: ft * 1.2, line: {} };
  if (t < 6.6) {
    // scene 1: confident after purchase, then puzzled
    const hop = Math.sin(seg(t, 0.25, 0.75) * Math.PI) * 0.1;
    hp.hop = hop; hp.squash = -0.05 * Math.sin(seg(t, 0.25, 0.75) * Math.PI);
    hp.nod = -0.12 * Math.sin(seg(ft, 0.7, 1.4) * Math.PI);
    hp.turn = lerp(0.25, -0.6, eio(seg(t, 1.6, 2.6)));
    hp.tilt = 0.18 * eio(seg(t, 2.8, 3.25));
    hp.line = { len: lerp(1, 0.45, eio(seg(t, 2.8, 3.25))), tilt: 0.25 * eio(seg(t, 2.8, 3.25)) };
  } else if (t < 18.2) {
    // scene 2: replay — approach the gate, pass through, pay
    const p1 = hopMove(t, 10.4, 11.4, [-0.1, 2.3], [0.0, 0.75], 3);
    const p2 = hopMove(t, 11.95, 13.2, [0.0, 0.75], [0.25, -3.0], 5);
    const p = t < 11.95 ? p1 : p2;
    hp = { ...hp, ...p, ry: t < 13.25 ? Math.PI : lerp(Math.PI, Math.PI - 0.9, eio(seg(t, 13.25, 13.7))) };
    hp.turn = 0; hp.tilt = 0;
  } else if (t < 53.0) {
    hp = { ...hp, x: 0.25, z: -3.0, ry: Math.PI - 0.9 };
  } else {
    // scene 6: a new attempt under the revoked delegation
    const a = hopMove(t, 55.25, 55.85, [-0.05, 2.25], [0.0, 0.62], 2);
    const back = hopMove(t, 56.05, 56.55, [0.0, 0.62], [0.0, 1.05], 1, 0.06);
    const p = t < 56.05 ? a : back;
    hp = { ...hp, ...p, ry: Math.PI };
    const bump = Math.sin(seg(t, 55.85, 56.05) * Math.PI);
    hp.squash = (hp.squash || 0) + 0.08 * bump;
    const pause = eio(seg(t, 56.6, 57.3));
    hp.nod = 0.28 * pause; hp.tilt = -0.12 * pause;
    hp.line = { len: lerp(1, 0.35, pause), dim: t > 56.6 };
    if (t > 55.2 && t < 56.6) hp.line = { len: 1 };
  }
  hp.y = PY;
  if (t >= 59) hero.visible = t < 66; else hero.visible = true;
  poseAgent(hero, hp);

  // ---------- gate
  const openU = t < 18.2 ? eio(seg(t, 11.35, 11.9)) * (1 - eio(seg(t, 13.4, 13.95)))
    : 0;
  slabs.forEach(s => { s.position.x = s.userData.sx * lerp(0.34, 1.02, openU); });
  const revoked = t >= 53.45;
  const lockU = eio(seg(t, 54.75, 55.15));
  lockBar.visible = lockU > 0.001; lockBar.position.x = lerp(-1.6, 0, lockU); lockBar.scale.x = Math.max(0.01, lockU);
  const stripCol = new THREE.Color(COL.mmOrange).lerp(new THREE.Color('#9C948A'), eio(seg(t, 54.75, 55.15)));
  lintelStripMat.color.copy(stripCol); lintelStripMat.emissive.copy(stripCol);
  const glowU = t < 18.2 ? Math.sin(seg(t, 11.3, 12.2) * Math.PI) : 0;
  stripMat.emissiveIntensity = 0.15 + glowU * 0.55;

  // ---------- permission panel
  const panelRot = t >= 6.6 && t < 7.5 ? -Math.PI / 2 * (1 - eo(seg(t, 6.6, 7.45))) : 0;
  permInner.rotation.y = panelRot;
  let rows = 4, focus = -1, extra = 0;
  if (t < 6.6) rows = 4;
  else if (t < 10) { rows = 0.4 + 3.6 * seg(t, 7.2, 9.0) * 1.0; rows = clamp(rows, 0, 4) + seg(t, 7.2, 9.6) * 0.6;
    focus = t > 8.0 && t < 9.9 ? 1 : (t >= 9.9 ? -1 : -1); }
  if (t >= 53.0 && t < 59) focus = 3;
  if (revoked) extra = 3 * seg(t, 56.2, 57.6) + 0.0001;
  if (t > 58.4) focus = -1;
  permDyn.update({ rows: Math.round(rows * 20) / 20, focus, revoked, extra: Math.round(extra * 20) / 20 });

  // ---------- terminal
  let tm = { mode: 'paid' };
  if (t >= 6.6 && t < 13.6) tm = { mode: 'idle', p: Math.round(seg(t, 13.0, 13.55) * 20) / 20 };
  terminal.userData.dyn.update(tm);

  // ---------- tokens
  token.visible = false;
  if (t >= 10.0 && t < 13.6) {
    token.visible = true;
    const carry = hero.position.clone().add(V(0, 1.12 + Math.sin(t * 5) * 0.012, 0).add(V(Math.sin(hero.rotation.y), 0, Math.cos(hero.rotation.y)).multiplyScalar(0.12)));
    const slot = terminal.position.clone().add(V(-0.03, 1.08, 0.12));
    const u = eio(seg(t, 13.05, 13.5));
    token.position.copy(lerpV(carry, slot, u)); token.position.y += Math.sin(u * Math.PI) * 0.25;
    token.rotation.set(0, hero.rotation.y + u * 3, 0); token.scale.setScalar(lerp(1, 0.4, ei(u)));
  }
  token2.visible = t >= 54.3 && t < 59.0;
  if (token2.visible) {
    const fwd = V(0, 0, -1);
    const base = hero.position.clone().add(V(0, 1.12, 0)).add(fwd.multiplyScalar(0.12));
    // bump into the closed gate and fall back
    const b = Math.sin(seg(t, 55.75, 56.1) * Math.PI);
    base.z += -0.3 * b; base.y += Math.sin(t * 5) * 0.01 - 0.12 * eo(seg(t, 56.1, 56.5)) + 0.12 * eo(seg(t, 56.1, 56.5)) * (1 - seg(t, 56.5, 56.9));
    token2.position.copy(base); token2.rotation.set(0.25 * b, Math.PI, 0.18 * Math.sin(t * 2));
    token2.scale.setScalar(eo(seg(t, 54.3, 54.7)));
  }
  rejectLabel.visible = t >= 56.0 && t < 59.0;
  if (rejectLabel.visible) { const u = backOut(seg(t, 56.0, 56.35)); rejectLabel.position.set(0, PY + 1.15 + 0.08 * u, 0.2); rejectLabel.scale.setScalar(Math.max(0.01, u)); }

  // ---------- evidence cards
  const hl = eio(seg(t, 2.6, 3.2));
  if (t < 6.6) {
    const ri = eo(seg(t, 0.0, 0.45));
    setCard(cardR, CARD_R_S1.clone().add(V(0, -0.1 * (1 - ri), 0)), -Math.PI / 2 * ei(seg(t, 5.75, 6.6)), lerp(0.6, 1, backOut(seg(t, 0, 0.45))));
    const ii = eo(seg(t, 1.35, 2.35));
    setCard(cardI, lerpV(V(-1.5, 1.62, -3.1), CARD_I_S1, ii), lerp(0.6, 0, ii), 1, t > 1.3);
    cardI.position.y += Math.sin(ii * Math.PI) * 0.06;
    cardI.userData.dyn.update({ hl: Math.round(hl * 10) / 10 }); cardR.userData.dyn.update({ hl: Math.round(hl * 10) / 10 });
  } else if (t < 25.6) {
    const rp = backOut(seg(t, 13.55, 13.95));
    const ii = eo(seg(t, 14.4, 15.2));
    const hl2 = eio(seg(t, 15.4, 16.0));
    // slide together, stop just before touching (17.0–18.2), then swing open like doors (22.5–23.5)
    const slide = eio(seg(t, 16.9, 18.1));
    const xr = lerp(CARD_R_S1.x, 0.335, slide), xi = lerp(CARD_I_S1.x, -0.335, slide);
    const swing = eio(seg(t, 22.4, 23.4));
    const pr = V(xr, 1.5, -3.42), pi = V(xi, 1.5, -3.42);
    // hinge on outer edges
    const hingeR = V(xr + 0.31, 1.5, -3.42), hingeI = V(xi - 0.31, 1.5, -3.42);
    const ang = swing * 1.25;
    const rPos = hingeR.clone().add(V(-0.31 * Math.cos(ang), 0, -0.31 * Math.sin(ang)));
    const iPos = hingeI.clone().add(V(0.31 * Math.cos(ang), 0, -0.31 * Math.sin(ang)));
    setCard(cardR, swing > 0 ? rPos : pr, swing > 0 ? ang : 0, Math.max(0.001, rp), t >= 13.55);
    setCard(cardI, swing > 0 ? iPos : pi, swing > 0 ? -ang : 0, Math.max(0.001, ii), t >= 14.4);
    cardI.userData.dyn.update({ hl: Math.round(hl2 * 10) / 10 }); cardR.userData.dyn.update({ hl: Math.round(hl2 * 10) / 10 });
  } else {
    // fly into the courtroom as evidence
    const u = eio(seg(t, 26.5, 29.0));
    const fromI = V(-0.7, 2.3, -31.5), fromR = V(0.7, 2.3, -31.5);
    const arc = Math.sin(u * Math.PI) * 0.6;
    let pi = lerpV(fromI, CARD_I_EV, u).add(V(0, arc, 0)), pr = lerpV(fromR, CARD_R_EV, u).add(V(0, arc, 0));
    let s = 1, vis = t >= 26.5;
    // during the verdict sequence the evidence steps back
    const away = eio(seg(t, 45.4, 46.4));
    pi.add(V(-0.25 * away, -0.5 * away, 0.4 * away)); pr.add(V(0.25 * away, -0.5 * away, 0.4 * away));
    s = lerp(1, 0.75, away);
    if (t > 49.8) vis = vis && t < 66;
    setCard(cardI, pi, lerp(-0.5, 0.06, u), s, vis); setCard(cardR, pr, lerp(0.5, -0.06, u), s, vis);
    const ev = t > 28.6;
    const hlv = t < 29.2 ? 1 : 1;
    cardI.userData.dyn.update({ hl: hlv, tag: ev ? 'EXHIBIT A' : '' }); cardR.userData.dyn.update({ hl: hlv, tag: ev ? 'EXHIBIT B' : '' });
  }

  // ---------- court doors / halo / core
  const doorU = eio(seg(t, 20.2, 22.0));
  doors.forEach(d => { d.position.x = d.userData.s * lerp(0.59, 1.85, doorU); });
  halo.rotation.z = ft * 0.05; halo2.rotation.z = -ft * 0.035;
  halo.position.y = 5.5 + Math.sin(ft * 0.6) * 0.04;
  const alive = sm(seg(t, 27.5, 30.5));
  bandMat.emissive.set(COL.icRed); bandMat.emissiveIntensity = 0.1 * alive;
  const split = eio(seg(t, 34.6, 36.4));
  const merge = eio(seg(t, 66.0, 68.0)) * 0;
  coreSegs.forEach(m => {
    const { tier, base, ang } = m.userData;
    const r = split * (0.7 + (2 - tier) * 0.25);
    m.position.set(base.x + Math.sin(ang) * r, base.y - split * tier * 0.18, base.z + Math.cos(ang) * r);
    m.rotation.y = 0;
  });
  const coreRise = eio(seg(t, 35.1, 36.6));
  glCore.position.y = DAIS_TOP + lerp(0.2, 0.75, coreRise); glCore.scale.set(1, lerp(0.15, 1, coreRise), 1);
  glCore.rotation.y = ft * 0.25; glCore.visible = coreRise > 0.01;
  glCoreBase.position.y = DAIS_TOP + 0.02; glCoreBase.rotation.y = glCore.rotation.y;

  // ---------- jury
  jurors.forEach((j, i) => {
    const out = V(Math.sin(j.th), 0, Math.cos(j.th));
    const rise = eio(seg(t, 35.4 + i * 0.22, 36.9 + i * 0.22));
    j.g.position.set(out.x * JR, CY - 1.85 * (1 - rise), out.z * JR);
    j.g.rotation.y = j.th + Math.PI;
    j.g.visible = rise > 0.001;
    const evalU = seg(t, 37.6, 43.0 + i * 0.35);
    j.head.rotation.set(ft * (0.3 + i * 0.07), ft * (0.5 + i * 0.05) * (1 - seg(t, 43.4, 45.0)), 0);
    const conv = eio(seg(t, 43.0 + i * 0.3, 44.6 + i * 0.2));
    const wob = [0.5, -0.7, 0.35, -0.45, 0.6][i];
    j.ring.rotation.set(Math.PI / 2 + wob * (1 - conv) * Math.cos(ft * (0.9 + i * 0.2)), 0, wob * (1 - conv) * Math.sin(ft * 0.8));
    // panel: appears, evaluates, converges to the verdict
    const pIn = backOut(seg(t, 36.8 + i * 0.12, 37.5 + i * 0.12));
    const toV = eio(seg(t, 45.6 + i * 0.08, 46.9 + i * 0.08));
    const pPos = out.clone().multiplyScalar(PR).add(V(0, CY + 1.3, 0));
    const vPos = V(0, CY + 2.03, 1.0);
    j.panel.position.copy(lerpV(pPos, vPos, toV));
    const yaw = lerp(j.th, 2 * Math.PI * Math.round(j.th / (2 * Math.PI)), toV);
    j.panel.rotation.set(0, yaw + (1 - pIn) * 0.6 * (i % 2 ? 1 : -1), 0);
    j.panel.scale.setScalar(Math.max(0.001, pIn * lerp(1, 0.6, toV)));
    j.panel.visible = t >= 36.8 && toV < 0.999;
    const p = clamp(evalU * (0.92 + 0.08 * i / 4));
    const res = seg(t, 43.0 + i * 0.3, 43.5 + i * 0.3);
    j.pdyn.update({ i, p: Math.round(p * 40) / 40, res: Math.round(res * 10) / 10, focus: res > 0 ? -1 : [0, 1, 2, 1, 0][i] });
    // link strip from juror to core
    const lk = eio(seg(t, 42.8, 44.4));
    j.link.visible = lk > 0.001;
    const len = (JR - 0.35 - 1.42) * lk;
    j.link.scale.z = Math.max(0.001, len);
    j.link.position.copy(out.clone().multiplyScalar(1.42 + len / 2)).setY(CY + 0.006);
    j.link.rotation.y = j.th;
  });
  // verdict panel
  const vIn = eio(seg(t, 46.4, 47.2));
  const vOut = eio(seg(t, 49.3, 49.9));
  verdict.visible = vIn > 0.001 && vOut < 0.999;
  verdict.position.set(0, CY + 2.03, 1.0);
  verdict.scale.setScalar(Math.max(0.001, lerp(0.6, 1, vIn) * (1 - vOut)));
  verdict.rotation.y = 0;
  verdictDyn.update({ a: 1 });
  // seal
  seal.visible = t >= 49.5 && t < 53.6;
  if (seal.visible) {
    const p = t < SEAL_T0 ? V(0, CY + 2.03, -39.0) : sealAt(t);
    const stamp = eio(seg(t, 52.9, 53.35));
    const target = P0.clone().add(PN.clone().multiplyScalar(0.05)).add(V(0, -0.4, 0)).add(V(Math.cos(PERM_RY), 0, -Math.sin(PERM_RY)).multiplyScalar(0.6));
    seal.position.copy(lerpV(p, target, stamp));
    const look = PERM_RY;
    seal.rotation.set(0, t < SEAL_T1 ? (t - SEAL_T0) * 2.4 : lerp((SEAL_T1 - SEAL_T0) * 2.4, Math.round((SEAL_T1 - SEAL_T0) * 2.4 / (2 * Math.PI)) * 2 * Math.PI + look, stamp), 0);
    seal.scale.setScalar(eo(seg(t, 49.5, 49.95)) * lerp(1, 0.55, eio(seg(t, 52.3, 53.0))) * (1 - ei(seg(t, 53.3, 53.6))));
  }

  // ---------- hubs (world activity)
  hubObjs.forEach(o => {
    const T = ft + o.hi * 1.7;
    if (o.h.kind === 'exchange') {
      const [a, b] = o.agents;
      poseAgent(a, { x: -0.9, z: 0, y: 0.06, ry: Math.PI / 2, gemSpin: T, nod: 0.06 * Math.sin(T * 2) });
      poseAgent(b, { x: 0.9, z: 0, y: 0.06, ry: -Math.PI / 2, gemSpin: -T, nod: 0.06 * Math.sin(T * 2 + 1) });
      const ph = (T * 0.5) % 2; const u = eio(ph % 1); const dir = ph < 1 ? 1 : -1;
      o.tok.position.set(dir * lerp(-0.62, 0.62, u), 0.62 + Math.sin(u * Math.PI) * 0.45, 0); o.tok.rotation.y = T * 2;
    } else if (o.h.kind === 'negotiate') {
      const [a, b] = o.agents;
      poseAgent(a, { x: -0.75, z: 0.1, y: 0.06, ry: Math.PI / 2 - 0.2, gemSpin: T, nod: 0.12 * Math.max(0, Math.sin(T * 1.6)), tilt: 0.08 * Math.sin(T) });
      poseAgent(b, { x: 0.75, z: 0.1, y: 0.06, ry: -Math.PI / 2 + 0.2, gemSpin: -T, nod: 0.12 * Math.max(0, Math.sin(T * 1.6 + 2)) });
      o.doc.position.set(0, 0.95 + Math.sin(T * 1.2) * 0.04, 0.1); o.doc.rotation.set(-0.2, Math.sin(T * 0.5) * 0.5, 0);
    } else {
      const [a, b] = o.agents;
      const h = Math.abs(Math.sin(T * 1.4)) * 0.06;
      poseAgent(a, { x: -0.1, z: 0.15, y: 0.06, hop: h, ry: 0.9, gemSpin: T });
      poseAgent(b, { x: -1.0, z: 0.9, y: 0.06, ry: 0.75, gemSpin: -T, nod: 0.05 * Math.sin(T * 1.1), tilt: 0.06 * Math.sin(T * 0.7) });
    }
  });
  // dispute travelling from a hub to the court (only one, during the world shot)
  const tu = seg(t, 63.0, 69.5);
  travelCards.visible = tu > 0 && tu < 1;
  if (travelCards.visible) {
    const from = HUBS[3].p.clone().add(V(-2, 1.2, 0)), to = COURT.clone().add(V(0, 2.4, 6.4));
    travelCards.position.copy(lerpV(from, to, eio(tu))); travelCards.position.y += Math.sin(tu * Math.PI) * 4;
    travelCards.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
    travelCards.scale.setScalar(2.2);
  }
}

// ---------------------------------------------------------------- overlays
const $ = id => document.getElementById(id);
const OVERLAYS = [
  ['o_rules', 0.95, 3.35, 'rise'],
  ['o_why', 3.65, 6.35, 'rise'],
  ['o_intent', 14.7, 17.9, 'rise'],
  ['o_who', 20.9, 23.5, 'settle'],
  ['o_court', 28.0, 33.6, 'rise'],
  ['o_genlayer', 36.7, 40.9, 'rise'],
  ['o_jury', 41.3, 45.3, 'rise'],
  ['o_consequence', 55.5, 58.9, 'rise'],
  ['o_economy', 61.6, 66.6, 'rise'],
  ['o_judge', 68.5, 72.5, 'settle'],
];
function overlays(t) {
  for (const [id, t0, t1, kind] of OVERLAYS) {
    const el = $(id);
    const a = eo(seg(t, t0, t0 + 0.55)) * (1 - ei(seg(t, t1 - 0.4, t1)));
    el.style.opacity = a.toFixed(3);
    if (kind === 'rise') el.style.transform = `translateY(${(1 - eo(seg(t, t0, t0 + 0.7))) * 22}px)`;
    else el.style.transform = `scale(${lerp(1.06, 1, eo(seg(t, t0, t0 + 0.9)))})`;
    if (kind === 'settle') el.style.letterSpacing = `${lerp(0.04, -0.01, eo(seg(t, t0, t0 + 1.0)))}em`;
  }
  // stillness in scene 3
  const still = sm(seg(t, 18.4, 20.5)) * (1 - sm(seg(t, 23.0, 24.6)));
  $('vignette').style.opacity = (0.45 + 0.55 * still).toFixed(3);
  renderer.toneMappingExposure = 1.0 - 0.12 * still;
  // end card
  const e = seg(t, 72.4, 73.3);
  $('endcard').style.opacity = sm(e).toFixed(3);
  $('ring1').setAttribute('stroke-dashoffset', (3268 * (1 - eio(seg(t, 73.0, 75.6)))).toFixed(1));
  $('ring2').setAttribute('stroke-dashoffset', (3130 * (1 - eio(seg(t, 73.3, 76.2)))).toFixed(1));
  $('e_logo').style.opacity = eo(seg(t, 73.2, 73.9)).toFixed(3);
  $('e_logo').style.transform = `translateY(${(1 - eo(seg(t, 73.2, 74.0))) * 18}px)`;
  $('e_title').style.opacity = eo(seg(t, 73.6, 74.3)).toFixed(3);
  $('e_title').style.transform = `translateY(${(1 - eo(seg(t, 73.6, 74.4))) * 18}px)`;
  $('e_rule').style.transform = `scaleX(${eio(seg(t, 74.2, 74.9)).toFixed(3)})`;
  $('e_by').style.opacity = eo(seg(t, 74.5, 75.2)).toFixed(3);
}

// ---------------------------------------------------------------- render
function renderAt(t) {
  t = clamp(t, 0, DURATION);
  animate(t);
  const focus = cameraAt(t);
  // keep the shadow frustum centred on what the camera is looking at
  const far = camera.position.y > 15;
  const half = far ? 70 : 9;
  const fc = far ? V(0, 0, -30) : focus.clone().setY(0);
  key.shadow.camera.left = -half; key.shadow.camera.right = half; key.shadow.camera.top = half; key.shadow.camera.bottom = -half;
  key.shadow.camera.near = 1; key.shadow.camera.far = far ? 260 : 60;
  key.shadow.camera.updateProjectionMatrix();
  key.target.position.copy(fc); key.position.copy(fc).add(KEY_DIR.clone().multiplyScalar(far ? 120 : 25));
  const reveal = sm(seg(t, 19.0, 23.0));
  const early = t < 59 && camera.position.z > -12 && t < 24 ? 1 - reveal : 0;
  scene.fog.near = lerp(45 + Math.max(0, camera.position.y - 8), 9, early);
  scene.fog.far = lerp(160 + camera.position.y, 46, early);
  overlays(t);
  renderer.render(scene, camera);
}

async function init() {
  await Promise.all([
    loadImg('mm', 'assets/logos/metamask_tile.png'),
    loadImg('ic', 'assets/logos/internet-court_tile.png'),
    document.fonts.load('900 40px "Playfair Display"'), document.fonts.load('700 40px "Playfair Display"'),
    document.fonts.load('400 40px "Inter Film"'), document.fonts.load('500 40px "Inter Film"'),
    document.fonts.load('600 40px "Inter Film"'), document.fonts.load('700 40px "Inter Film"'),
  ]);
  await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  const st = new THREE.TextureLoader().load('assets/logos/internet-court_tile.png');
  st.colorSpace = THREE.SRGBColorSpace; sealTexMat.map = st; sealTexMat.needsUpdate = true;
  await new Promise(r => { const chk = () => st.image && st.image.complete ? r() : setTimeout(chk, 20); chk(); });
  renderAt(0);
  window.renderAt = t => { renderAt(t); return true; };
  window.filmReady = true;
  const q = new URLSearchParams(location.search);
  if (q.has('t')) renderAt(parseFloat(q.get('t')));
  if (q.has('preview')) {
    const start = performance.now() - (parseFloat(q.get('preview')) || 0) * 1000;
    const loop = () => { renderAt(((performance.now() - start) / 1000) % DURATION); requestAnimationFrame(loop); };
    loop();
  }
}
init();
