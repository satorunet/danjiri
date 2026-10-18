// 3D モデル: だんじり・人（関節つき）・壊せる小物
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, withOutline, outlineMat, colored, col, lanternTex, bannerTex, happiTex, carveTex, woodTex, stripeTex, ropeTex, shideGeo } from './gfx.js?v=101';

// ---------------- 形の道具 ----------------
export function merge(list) {
  const norm = list.map(g => {
    g = g.index ? g.toNonIndexed() : g;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    return g;
  });
  const hasColor = norm.some(g => g.attributes.color);
  for (const g of norm) {
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    if (hasColor && !g.attributes.color) colored(g, 1, 1, 1);
    if (!hasColor && g.attributes.color) g.deleteAttribute('color');
  }
  return mergeGeometries(norm);
}
const T = (g, x = 0, y = 0, z = 0) => g.translate(x, y, z);
const box = (w, h, d, x = 0, y = 0, z = 0) => T(new THREE.BoxGeometry(w, h, d), x, y, z);
const cyl = (rt, rb, h, seg = 12, x = 0, y = 0, z = 0) => T(new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z);
const sph = (r, x = 0, y = 0, z = 0, ws = 12, hs = 9) => T(new THREE.SphereGeometry(r, ws, hs), x, y, z);
function rotX(g, a) { return g.rotateX(a); }
function rotY(g, a) { return g.rotateY(a); }
function rotZ(g, a) { return g.rotateZ(a); }

// 反りのある屋根（棟は前後方向 = z）。上面・裏面・軒先の板を返す
function roofY(x, z, w, d, h) {
  const t = Math.min(1, Math.abs(x) / (w / 2)), u = Math.min(1, Math.abs(z) / (d / 2));
  let y = h * Math.pow(1 - t, 1.6);
  y += h * 0.22 * Math.pow(t, 3) * Math.pow(u, 3);                    // 軒の反り
  y += h * 0.28 * Math.exp(-Math.pow(x / (w * 0.22), 2)) * Math.pow(u, 8); // 唐破風のふくらみ
  return y;
}
function curvedRoof(w, d, h) {
  const nx = 20, nz = 12, top = [], bot = [], uvs = [];
  for (let iz = 0; iz <= nz; iz++) for (let ix = 0; ix <= nx; ix++) {
    const x = -w / 2 + w * ix / nx, z = -d / 2 + d * iz / nz, y = roofY(x, z, w, d, h);
    top.push(x, y, z); bot.push(x, y - 0.09, z); uvs.push(ix / nx * 3, iz / nz * 3);
  }
  const idx = [], idxB = [];
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const a = iz * (nx + 1) + ix, b = a + 1, c = a + nx + 1, dd = c + 1;
    idx.push(a, c, b, b, c, dd); idxB.push(a, b, c, b, dd, c);
  }
  const mk = (pos, ind) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(ind); g.computeVertexNormals(); return g; };
  const topG = mk(top, idx), botG = mk(bot, idxB);
  // 軒先・破風の縁（黒漆と金）
  const edges = [];
  const edgeStrip = (pts, hgt, thick) => {
    const p = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0, z0] = pts[i], [x1, y1, z1] = pts[i + 1];
      p.push(x0, y0 + 0.02, z0, x0, y0 - hgt, z0, x1, y1 + 0.02, z1, x1, y1 + 0.02, z1, x0, y0 - hgt, z0, x1, y1 - hgt, z1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals();
    return g;
  };
  for (const sx of [-1, 1]) {
    const pts = []; for (let iz = 0; iz <= nz; iz++) { const z = -d / 2 + d * iz / nz; pts.push([sx * w / 2, roofY(sx * w / 2, z, w, d, h), z]); }
    if (sx < 0) pts.reverse();
    edges.push(edgeStrip(pts, 0.14, 0));
  }
  const hafu = [];
  for (const sz of [-1, 1]) {
    const pts = []; for (let ix = 0; ix <= nx * 2; ix++) { const x = -w / 2 + w * ix / (nx * 2); pts.push([x, roofY(x, sz * d / 2, w, d, h), sz * d / 2]); }
    if (sz > 0) pts.reverse();
    hafu.push(edgeStrip(pts, 0.2, 0));
  }
  return { top: topG, bot: botG, eave: merge(edges), hafu: merge(hafu) };
}
// 妻の彫り板（屋根の下の三角）
function gableBoard(w, d, h, z, depth = 0.06) {
  const s = new THREE.Shape(), n = 24, half = w * 0.42;
  s.moveTo(-half, 0);
  for (let i = 0; i <= n; i++) { const x = -half + 2 * half * i / n; s.lineTo(x, Math.max(0.02, roofY(x, z, w, d, h) - 0.12)); }
  s.lineTo(half, 0); s.lineTo(-half, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  // UV を板全体に
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + half) / (2 * half), p.getY(i) / h);
  return g;
}
function hafuArch(w, d, h, z, r = 0.05) {
  const pts = [];
  for (let i = 0; i <= 40; i++) { const x = -w / 2 + w * i / 40; pts.push(new THREE.Vector3(x, roofY(x, z, w, d, h) - 0.05, z)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, r, 6, false);
}

// ---------------- 人（関節つき） ----------------
// 腰の高さ 0.94。胴体の原点は腰、手足の原点は付け根
export const HIP_Y = 0.94;
export const BODY = (() => {
  const torso = box(0.46, 0.66, 0.27, 0, 0.3, 0);
  // 前面 = 左半分、背中 = 右半分、側面などは無地の端
  const uv = torso.attributes.uv;
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k, u = uv.getX(i), v = uv.getY(i);
    if (f === 4) uv.setXY(i, u * 0.5, v);
    else if (f === 5) uv.setXY(i, 0.5 + u * 0.5, v);
    else uv.setXY(i, 0.02 + u * 0.05, 0.3 + v * 0.4);
  }
  const belt = col(box(0.48, 0.08, 0.29, 0, 0.0, 0), 0xf4efe2);
  const head = merge([
    col(cyl(0.06, 0.07, 0.12, 8, 0, 0.04, 0), 0xe8b896),
    col(sph(0.145, 0, 0.21, 0.01).scale(1, 1.08, 1), 0xf0c4a0),
    col(sph(0.151, 0, 0.25, -0.012, 12, 6).scale(1, 0.75, 1).translate(0, 0.06, 0), 0x1b1512),
    col(T(new THREE.TorusGeometry(0.15, 0.032, 6, 16).rotateX(Math.PI / 2), 0, 0.27, 0), 0xf6f2ea),
    col(sph(0.05, 0, 0.27, -0.16), 0xf6f2ea),
    col(sph(0.02, 0.05, 0.22, 0.135), 0x1b1512), col(sph(0.02, -0.05, 0.22, 0.135), 0x1b1512),
  ]);
  const upperArm = merge([col(box(0.14, 0.31, 0.14, 0, -0.14, 0), 0xffffff)]);
  const foreArm = merge([col(box(0.1, 0.27, 0.1, 0, -0.13, 0), 0xe8b896), col(sph(0.065, 0, -0.3, 0.01), 0xe8b896)]);
  const thigh = merge([col(box(0.19, 0.45, 0.2, 0, -0.22, 0), 0xf2efe8)]);
  const shin = merge([col(box(0.15, 0.43, 0.16, 0, -0.21, 0), 0xf2efe8), col(box(0.14, 0.08, 0.27, 0, -0.46, 0.05), 0x1a1a1e)]);
  return { torso, belt, head, upperArm, foreArm, thigh, shin };
})();
// 引き手のカスタム: 髪型（頭の形）と服装（股引・袖の色）
const SKIN = 0xf0c4a0, NECK = 0xe8b896;
const face = () => [col(cyl(0.06, 0.07, 0.12, 8, 0, 0.04, 0), NECK), col(sph(0.145, 0, 0.21, 0.01).scale(1, 1.08, 1), SKIN), col(sph(0.02, 0.05, 0.22, 0.135), 0x1b1512), col(sph(0.02, -0.05, 0.22, 0.135), 0x1b1512)];
const hairCap = c => col(sph(0.151, 0, 0.25, -0.012, 12, 6).scale(1, 0.75, 1).translate(0, 0.06, 0), c);
const band = (c, r = 0.032) => col(T(new THREE.TorusGeometry(0.15, r, 6, 16).rotateX(Math.PI / 2), 0, 0.27, 0), c);
export const HAIRS = [
  { ja: '鉢巻', en: 'Headband', geo: () => BODY.head },
  { ja: 'ねじり鉢巻', en: 'Twisted band', geo: () => merge([...face(), hairCap(0x5a3418), band(0xf6f2ea, 0.045), col(sph(0.07, 0, 0.29, 0.15), 0xf6f2ea), col(sph(0.05, 0.05, 0.31, 0.14), 0xd42a1e)]) },
  { ja: '坊主', en: 'Shaved', geo: () => merge([...face(), col(sph(0.149, 0, 0.25, -0.012, 12, 6).scale(1, 0.72, 1).translate(0, 0.06, 0), 0xc89a7a), band(0x1d2f6b, 0.026)]) },
  { ja: '金髪', en: 'Blond', geo: () => merge([...face(), col(sph(0.158, 0, 0.26, -0.015, 12, 6).scale(1, 0.85, 1).translate(0, 0.05, 0), 0xf0c84a), band(0xd42a1e)]) },
  { ja: 'ちょんまげ', en: 'Topknot', geo: () => merge([...face(), hairCap(0x1b1512), col(cyl(0.035, 0.035, 0.16, 6, 0, 0.42, -0.02).rotateX(Math.PI / 2).translate(0, 0.4, 0.06), 0x1b1512), col(cyl(0.02, 0.02, 0.05, 6, 0, 0.39, -0.01), 0xf6f2ea)]) },
];
export const OUTFITS = [
  { ja: '白股引', en: 'White', legs: 0xffffff, sleeve: null },
  { ja: '黒股引', en: 'Black', legs: 0x2a2a30, sleeve: null },
  { ja: '紺股引', en: 'Navy', legs: 0x34407a, sleeve: null },
  { ja: '鯉口シャツ', en: 'Koikuchi', legs: 0xffffff, sleeve: 0xf4efe2 },
  { ja: 'ジーンズ', en: 'Jeans', legs: 0x4a6aa8, sleeve: 0x2a2a30 },
];

const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();
// pose: { lean, twist, headPitch, arm:[ [pitch, out, elbow] x2 ], leg: [ [pitch, out, knee] x2 ] }
export function poseMatrices(root, p, out) {
  // out: { torso, head, ua:[2], fa:[2], th:[2], sh:[2] } に Matrix4 を書き込む
  out.torso.copy(root).multiply(_r.makeRotationFromEuler(_e.set(p.lean, p.twist || 0, p.side || 0, 'YXZ')));
  out.head.copy(out.torso).multiply(_m.makeTranslation(0, 0.63, 0)).multiply(_r.makeRotationFromEuler(_e.set(p.headPitch || 0, p.headYaw || 0, 0, 'YXZ')));
  for (let i = 0; i < 2; i++) {
    const sd = i ? 1 : -1, a = p.arm[i];
    out.ua[i].copy(out.torso).multiply(_m.makeTranslation(sd * 0.3, 0.56, 0)).multiply(_r.makeRotationFromEuler(_e.set(a[0], 0, sd * a[1], 'XYZ')));
    out.fa[i].copy(out.ua[i]).multiply(_m.makeTranslation(0, -0.29, 0)).multiply(_r.makeRotationX(a[2]));
    const l = p.leg[i];
    out.th[i].copy(root).multiply(_m.makeTranslation(sd * 0.11, 0, 0)).multiply(_r.makeRotationFromEuler(_e.set(l[0], 0, sd * l[1], 'XYZ')));
    out.sh[i].copy(out.th[i]).multiply(_m.makeTranslation(0, -0.44, 0)).multiply(_r.makeRotationX(l[2]));
  }
}
export function newPoseOut() {
  const M = () => new THREE.Matrix4();
  return { torso: M(), head: M(), ua: [M(), M()], fa: [M(), M()], th: [M(), M()], sh: [M(), M()] };
}
export function newPose() { return { lean: 0, twist: 0, side: 0, headPitch: 0, headYaw: 0, arm: [[0, 0.1, 0], [0, 0.1, 0]], leg: [[0, 0.04, 0], [0, 0.04, 0]] }; }

// 走る・引く・押す・宙を舞う 姿勢
export function crewPose(p, kind, ph, v, air, crash, t, seed) {
  const run = Math.min(1, v / 14), swing = 0.35 + 0.55 * run;
  const s = Math.sin(ph), c = Math.cos(ph);
  if (air) {
    const k = t * 9 + seed;
    p.lean = -0.2 + Math.sin(k * 0.7) * 0.3; p.side = Math.sin(k * 0.5) * 0.3; p.twist = 0; p.headPitch = -0.3;
    p.arm[0] = [-2.2 + Math.sin(k) * 0.8, 0.6, -0.4]; p.arm[1] = [-2.2 + Math.sin(k + 2) * 0.8, 0.6, -0.4];
    p.leg[0] = [-0.6 + Math.sin(k * 1.3) * 0.9, 0.35, 0.9 + Math.sin(k) * 0.5]; p.leg[1] = [0.4 + Math.sin(k * 1.1 + 1) * 0.9, 0.35, 1.0];
    return;
  }
  if (crash) {
    p.lean = -0.35 + Math.sin(t * 6 + seed) * 0.15; p.side = Math.sin(t * 4 + seed) * 0.25; p.headPitch = 0.2;
    p.arm[0] = [-1.4, 0.9, -0.5]; p.arm[1] = [-1.6, 0.9, -0.3];
    p.leg[0] = [-0.5, 0.2, 0.6]; p.leg[1] = [0.3, 0.2, 0.8];
    return;
  }
  p.leg[0] = [-s * swing, 0.03, Math.max(0, c) * 1.3 * run + 0.15];
  p.leg[1] = [s * swing, 0.03, Math.max(0, -c) * 1.3 * run + 0.15];
  p.side = 0; p.twist = s * 0.12 * run;
  if (kind === 'rope') {
    p.lean = 0.25 + run * 0.5; p.headPitch = -p.lean * 0.6;
    p.arm[0] = [-0.9 - run * 0.4 + s * 0.08, 0.15, -0.5]; p.arm[1] = [-1.0 - run * 0.4 - s * 0.08, 0.1, -0.4];
  } else if (kind === 'beam') {
    p.lean = 0.3 + run * 0.45; p.headPitch = -p.lean * 0.7;
    p.arm[0] = [-0.7, -0.35, -0.6]; p.arm[1] = [-0.7, -0.35, -0.6];
  } else if (kind === 'push') {
    p.lean = 0.45 + run * 0.4; p.headPitch = -p.lean * 0.8;
    p.arm[0] = [-1.45, 0.05, -0.15]; p.arm[1] = [-1.45, 0.05, -0.15];
  } else { // 見物・待機
    p.lean = 0.04; p.headPitch = 0;
    p.arm[0] = [Math.sin(t * 2 + seed) * 0.1, 0.12, -0.2]; p.arm[1] = [-Math.sin(t * 2 + seed) * 0.1, 0.12, -0.2];
  }
  if (v < 0.4) { p.leg[0] = [0.05, 0.05, 0.1]; p.leg[1] = [-0.05, 0.05, 0.1]; p.lean = Math.min(p.lean, 0.15); }
}

// 引き手・大工方を描くための InstancedMesh 一式（胴体は町ごとに別テクスチャ）
export class CrowdRig {
  constructor(scene, capacity, teamCount) {
    const mk = (geo, mat, n, outline = true) => {
      const m = new THREE.InstancedMesh(geo, mat, n);
      m.frustumCulled = false; m.castShadow = true; m.receiveShadow = false; m.count = 0;
      scene.add(m);
      if (outline) { const o = withOutline(m, 0.018); scene.add(o); }
      return m;
    };
    this.capacity = capacity;
    this.limbMat = toon({ vertexColors: true });
    this.heads = HAIRS.map(h => mk(h.geo(), toon({ vertexColors: true }), capacity));
    this.hn = new Array(HAIRS.length).fill(0);
    this.belt = mk(BODY.belt, toon({ vertexColors: true }), capacity, false);
    this.ua = mk(BODY.upperArm, toon({ vertexColors: true }), capacity * 2);
    this.fa = mk(BODY.foreArm, this.limbMat, capacity * 2);
    this.th = mk(BODY.thigh, this.limbMat, capacity * 2);
    this.sh = mk(BODY.shin, this.limbMat, capacity * 2);
    this.torsos = [];
    for (let i = 0; i < teamCount; i++) this.torsos.push(mk(BODY.torso, toon({ color: 0xffffff }), capacity));
    // 顔に貼る写真（カスタム）: 町ごとに丸い板を顔の前へ
    const faceGeo = new THREE.CircleGeometry(0.135, 20).translate(0, 0.215, 0.158);
    this.faces = []; this.faceOn = new Array(teamCount).fill(false); this.fcn = new Array(teamCount).fill(0);
    for (let i = 0; i < teamCount; i++) { const m = mk(faceGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), capacity, false); m.castShadow = false; this.faces.push(m); }
    // 大工方のうちわ（赤と白）
    this.fans = [0xd42a1e, 0xf6f2ea].map(c => mk(merge([col(cyl(0.012, 0.012, 0.22, 5, 0, -0.1, 0), 0x4a2e14), col(T(new THREE.CircleGeometry(0.17, 18), 0, -0.32, 0), c)]), toon({ vertexColors: true, side: THREE.DoubleSide }), capacity, false));
    this.nf = 0;
    this.fanLocal = new THREE.Matrix4().makeTranslation(0, -0.3, 0.04).multiply(new THREE.Matrix4().makeRotationX(-0.4));
    this.fm = new THREE.Matrix4();
    this.sleeveColors = []; this.n = 0; this.tn = new Array(teamCount).fill(0);
    this.out = newPoseOut();
    this.tmpC = new THREE.Color();
  }
  setTeamTexture(i, team, icon = null, text = '') {
    const t = this.torsos[i];
    if (t.material.map) t.material.map.dispose();
    t.material.map = happiTex(team, icon, text); t.material.needsUpdate = true;
  }
  setFace(i, img) {   // img: 画像（なければ顔の写真はなし）
    const f = this.faces[i]; if (!f) return;
    if (f.material.map) { f.material.map.dispose(); f.material.map = null; }
    this.faceOn[i] = !!img;
    if (img) { const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; f.material.map = t; }
    f.material.needsUpdate = true;
  }
  begin() { this.n = 0; this.nf = 0; this.tn.fill(0); this.hn.fill(0); this.fcn.fill(0); }
  // look: { hair, outfit }（引き手のカスタム）
  add(root, pose, slot, sleeveColor, fans = false, look = null) {
    if (this.n >= this.capacity) return;
    poseMatrices(root, pose, this.out);
    const o = this.out, n = this.n, t = this.torsos[slot];
    t.setMatrixAt(this.tn[slot]++, o.torso);
    this.belt.setMatrixAt(n, o.torso);
    const hi = look && HAIRS[look.hair] ? look.hair : 0, of = (look && OUTFITS[look.outfit]) || OUTFITS[0];
    this.heads[hi].setMatrixAt(this.hn[hi]++, o.head);
    if (this.faceOn[slot] && look && look.face) this.faces[slot].setMatrixAt(this.fcn[slot]++, o.head);
    for (let k = 0; k < 2; k++) {
      this.ua.setMatrixAt(n * 2 + k, o.ua[k]); this.fa.setMatrixAt(n * 2 + k, o.fa[k]);
      this.th.setMatrixAt(n * 2 + k, o.th[k]); this.sh.setMatrixAt(n * 2 + k, o.sh[k]);
      this.ua.setColorAt(n * 2 + k, this.tmpC.setHex(of.sleeve ?? sleeveColor));
      this.th.setColorAt(n * 2 + k, this.tmpC.setHex(of.legs)); this.sh.setColorAt(n * 2 + k, this.tmpC.setHex(of.legs));
      this.fa.setColorAt(n * 2 + k, this.tmpC.setHex(0xffffff));
      if (fans) this.fans[k].setMatrixAt(this.nf, this.fm.copy(o.fa[k]).multiply(this.fanLocal));
    }
    if (fans) this.nf++;
    this.n++;
  }
  end() {
    const all = [this.belt, this.ua, this.fa, this.th, this.sh];
    for (const m of all) { m.count = this.n * (m === this.belt ? 1 : 2); m.instanceMatrix.needsUpdate = true; if (m.userData.outline) m.userData.outline.count = m.count; }
    this.faces.forEach((f, i) => { f.count = this.fcn[i]; f.instanceMatrix.needsUpdate = true; });
    this.heads.forEach((h, i) => { h.count = this.hn[i]; h.instanceMatrix.needsUpdate = true; if (h.userData.outline) h.userData.outline.count = h.count; });
    for (const m of [this.ua, this.fa, this.th, this.sh]) if (m.instanceColor) m.instanceColor.needsUpdate = true;
    this.torsos.forEach((t, i) => { t.count = this.tn[i]; t.instanceMatrix.needsUpdate = true; if (t.userData.outline) t.userData.outline.count = t.count; });
    for (const f of this.fans) { f.count = this.nf; f.instanceMatrix.needsUpdate = true; }
  }
}

// ---------------- だんじり ----------------
let SHARED = null;
function shared() {
  if (SHARED) return SHARED;
  const wood = woodTex('#8a5a30', '#5a3618'), woodD = woodTex('#5a361b', '#2e1a0b');
  const lan = lanternTex();
  SHARED = {
    wood: toon({ map: wood }),
    woodD: toon({ map: woodD }),
    roof: toon({ map: woodTex('#6b4122', '#3a220e'), side: THREE.DoubleSide }),
    roofUnder: toon({ color: 0x3a2412, side: THREE.DoubleSide }),
    carve: toon({ map: carveTex() }),
    gold: toon({ color: 0xf0bc3c, emissive: 0x3a2400, side: THREE.DoubleSide }),
    black: toon({ color: 0x1c1816, side: THREE.DoubleSide }),
    redwhite: toon({ map: stripeTex('#d42a1e', '#f7f2e8', true) }),
    rope: toon({ map: ropeTex() }),
    lantern: toon({ map: lan, emissiveMap: lan, emissive: 0xffffff, emissiveIntensity: 0.15 }),
    shide: toon({ color: 0xffffff, side: THREE.DoubleSide, emissive: 0x222222 }),
    vc: toon({ vertexColors: true }),
    drumHead: toon({ color: 0xf3e6c8 }),
  };
  return SHARED;
}
// だんじりの仕上げ（カスタム）: 0 欅・1 白木・2 朱塗り・3 黒漆・4 金ピカ。共有の材質を仕上げ用の材質に差し替える
export const FINISHES = [
  { ja: '欅（標準）', en: 'Keyaki' },
  { ja: '白木', en: 'Plain wood', wood: [0xfff4dc, 0x2a2416], woodD: [0xf6e2c0, 0x201a10], carve: [0xfff0d8, 0x2a2416] },
  { ja: '朱塗り', en: 'Vermilion', wood: [0xff6a4c, 0x220400], woodD: [0xe8442c, 0x1a0200], carve: [0xff9a80, 0x200400] },
  { ja: '黒漆', en: 'Black lacquer', wood: [0x3c3636, 0x050505], woodD: [0x2a2424, 0x030303], carve: [0x6a6060, 0x080808] },
  { ja: '金ピカ', en: 'All gold', wood: [0xffd060, 0x3a2600], woodD: [0xe8b440, 0x2a1a00], carve: [0xffe28a, 0x3a2800], black: [0xb08820, 0x201400] },
];
const finishMats = {};
export function setFinish(D, k) {
  const S = shared(), F = FINISHES[k] || FINISHES[0];
  const map = new Map();
  for (const key of ['wood', 'woodD', 'carve', 'black']) {
    if (!F[key]) continue;
    const id = k + key;
    if (!finishMats[id]) { const m = S[key].clone(); m.color.setHex(F[key][0]); if (m.emissive) m.emissive.setHex(F[key][1]); finishMats[id] = m; }
    map.set(S[key], finishMats[id]);
  }
  // 元に戻す時のために、最初の材質を覚えておく
  D.body.traverse(o => {
    if (!o.isMesh) return;
    if (o.userData.baseMat === undefined) o.userData.baseMat = o.material;
    o.material = map.get(o.userData.baseMat) || o.userData.baseMat;
  });
}
export function setLanternGlow(v) { const S = shared(); S.lantern.emissiveIntensity = v; }

// だんじりの型（カスタム）: 形そのものが変わる
export const DJ_TYPES = [
  { ja: '岸和田型', en: 'Kishiwada' },
  { ja: '布団太鼓', en: 'Futon drum' },
  { ja: '提灯山', en: 'Lantern tower' },
  { ja: '鳳凰神輿', en: 'Phoenix' },
  { ja: '龍の曳山', en: 'Dragon' },
];
export function makeDanjiri(team, type = 0) {
  const S = shared();
  const group = new THREE.Group();
  const tilt = new THREE.Group(); group.add(tilt);           // ロール・ピッチ用
  const body = new THREE.Group(); tilt.add(body);
  const curtainTex = (() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = team.css; g.fillRect(0, 0, 512, 64);
    g.strokeStyle = '#f2c14e'; g.lineWidth = 4;
    for (let x = -20; x < 532; x += 40) { g.beginPath(); g.arc(x, 64, 26, Math.PI, 0); g.stroke(); g.beginPath(); g.arc(x + 20, 64, 14, Math.PI, 0); g.stroke(); }
    g.fillStyle = '#f2c14e'; g.fillRect(0, 0, 512, 6); g.fillRect(0, 58, 512, 6);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1); return t;
  })();
  const curtain = toon({ map: curtainTex });
  const buckets = new Map();
  const put = (mat, g) => { if (!buckets.has(mat)) buckets.set(mat, []); buckets.get(mat).push(g); };

  // 台・車輪まわり
  for (const x of [-0.86, 0.86]) put(S.woodD, box(0.28, 0.34, 4.3, x, 1.04, 0));
  for (const z of [-1.45, 1.45, 0]) put(S.woodD, box(2.1, 0.24, 0.26, 0, 1.0, z));
  for (const x of [-0.55, 0.55]) put(S.wood, box(0.2, 0.2, 2.7, x, 0.98, 3.05));     // 前梃子
  put(S.wood, box(1.6, 0.17, 0.17, 0, 0.98, 4.32));
  put(S.wood, box(0.24, 0.24, 2.1, 0, 1.02, -2.95));                                  // 後梃子
  put(S.wood, box(1.7, 0.17, 0.17, 0, 1.02, -3.92));
  put(S.gold, box(0.26, 0.26, 0.06, 0, 1.02, -4.02));
  for (const x of [-0.55, 0.55]) put(S.gold, box(0.24, 0.24, 0.05, x, 0.98, 4.42));
  // 下段: 黒漆の台輪・彫り物の腰板・金の縁
  put(S.black, box(2.24, 0.14, 3.44, 0, 1.24, 0));
  put(S.carve, box(2.08, 0.82, 3.26, 0, 1.72, 0));
  for (const y of [1.3, 2.14]) put(S.gold, box(2.14, 0.06, 3.32, 0, y, 0));
  for (const x of [-1.05, 1.05]) for (const z of [-1.64, 1.64]) put(S.gold, box(0.07, 0.86, 0.07, x, 1.72, z));
  // 高欄（手すり）の床
  put(S.woodD, box(2.6, 0.12, 3.85, 0, 2.22, 0));
  put(S.black, box(2.64, 0.05, 3.89, 0, 2.15, 0));
  // 手すり
  const railH = 2.52;
  const rails = [];
  for (const sx of [-1, 1]) {
    rails.push(box(0.06, 0.06, 3.7, sx * 1.27, railH, 0));
    for (let z = -1.8; z <= 1.81; z += 0.4) rails.push(box(0.05, 0.3, 0.05, sx * 1.27, 2.4, z));
  }
  for (const sz of [-1, 1]) {
    rails.push(box(2.5, 0.06, 0.06, 0, railH, sz * 1.88));
    for (let x = -1.2; x <= 1.21; x += 0.4) rails.push(box(0.05, 0.3, 0.05, x, 2.4, sz * 1.88));
  }
  put(S.woodD, merge(rails));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(S.gold, sph(0.07, sx * 1.27, railH + 0.08, sz * 1.88, 8, 6));
  // 柱（紅白）と奥の黒壁
  for (const x of [-0.92, 0.92]) for (const z of [-1.35, 1.35]) put(S.redwhite, cyl(0.095, 0.095, 1.5, 12, x, 2.98, z));
  put(S.black, box(1.5, 1.2, 2.2, 0, 2.86, -0.1));
  put(S.carve, box(1.52, 0.5, 0.05, 0, 3.3, 1.02));
  // 太鼓と鉦
  const drum = cyl(0.3, 0.3, 0.46, 18); drum.rotateX(Math.PI / 2); drum.translate(0, 2.68, 0.55);
  put(S.vc, col(drum, 0x9a2a18));
  const dh = cyl(0.29, 0.29, 0.48, 18); dh.rotateX(Math.PI / 2); dh.translate(0, 2.68, 0.55); put(S.drumHead, dh);
  put(S.gold, rotX(cyl(0.16, 0.16, 0.04, 16), Math.PI / 2).translate(0.45, 2.9, 0.95));
  // 水引幕
  put(curtain, box(2.0, 0.3, 2.95, 0, 3.52, 0));
  // 布団締め（太い綱）と前の結び目
  {
    const pts = [], hw = 1.08, hd = 1.55, r = 0.3;
    const corners = [[hw, hd], [-hw, hd], [-hw, -hd], [hw, -hd]];
    for (let k = 0; k < 4; k++) {
      const [cx, cz] = corners[k], a0 = [0, Math.PI / 2, Math.PI, Math.PI * 1.5][k];
      for (let i = 0; i <= 6; i++) { const a = a0 + i / 6 * Math.PI / 2; pts.push(new THREE.Vector3(cx - Math.sign(cx) * r + Math.cos(a) * r, 3.78, cz - Math.sign(cz) * r + Math.sin(a) * r)); }
    }
    const ropeG = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 120, 0.11, 8, true);
    const uv = ropeG.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 40);
    put(S.rope, ropeG);
    for (const sx of [-1, 1]) {
      const k = new THREE.TorusGeometry(0.22, 0.09, 8, 18); k.rotateY(sx * 0.5); k.translate(sx * 0.24, 3.62, 1.62);
      const kuv = k.attributes.uv; for (let i = 0; i < kuv.count; i++) kuv.setX(i, kuv.getX(i) * 6);
      put(S.rope, k);
    }
    const tail = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 3.7, 1.66), new THREE.Vector3(0.05, 3.3, 1.7), new THREE.Vector3(-0.06, 2.95, 1.72)]), 12, 0.07, 6);
    put(S.rope, tail);
  }
  const extraLan = [];   // 型ごとに足す提灯 [x, y, z, 大きさ]
  let daikuAt = null;   // 型ごとの大工方の立ち位置
  if (type === 0 || type === 4) {
  // 小屋根（前）
  {
    const w = 2.5, d = 1.5, h = 0.62, y0 = 3.86, z0 = 1.42;
    const r = curvedRoof(w, d, h);
    for (const [g, m] of [[r.top, S.roof], [r.bot, S.roofUnder], [r.eave, S.black], [r.hafu, S.gold]]) put(m, g.clone().translate(0, y0, z0));
    put(S.carve, gableBoard(w, d, h, d / 2).translate(0, y0, z0 + d / 2 - 0.12));
    put(S.gold, hafuArch(w, d, h, d / 2 + 0.02).translate(0, y0, z0));
    put(S.black, box(0.16, 0.14, d * 0.9, 0, y0 + h + 0.05, z0));
  }
  // 大屋根
  {
    const w = 3.3, d = 3.5, h = 1.05, y0 = 4.05, z0 = -0.35;
    const r = curvedRoof(w, d, h);
    for (const [g, m] of [[r.top, S.roof], [r.bot, S.roofUnder], [r.eave, S.black], [r.hafu, S.gold]]) put(m, g.clone().translate(0, y0, z0));
    for (const sz of [-1, 1]) {
      const gb = gableBoard(w, d, h, sz * d / 2); if (sz < 0) gb.rotateY(Math.PI);
      put(S.carve, gb.translate(0, y0, z0 + sz * (d / 2 - 0.14)));
      put(S.gold, hafuArch(w, d, h, sz * (d / 2 + 0.02), 0.06).translate(0, y0, z0));
    }
    put(S.black, box(0.3, 0.24, d * 0.92, 0, y0 + h + 0.08, z0));
    put(S.gold, box(0.33, 0.05, d * 0.94, 0, y0 + h + 0.2, z0));
    for (const sz of [-1, 1]) {
      put(S.gold, box(0.62, 0.5, 0.14, 0, y0 + h + 0.22, z0 + sz * d * 0.47));
      put(S.black, box(0.4, 0.3, 0.16, 0, y0 + h + 0.2, z0 + sz * d * 0.47));
      put(S.gold, sph(0.1, 0, y0 + h + 0.56, z0 + sz * d * 0.47, 8, 6));
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(S.gold, sph(0.09, sx * w / 2, y0 + roofY(w / 2, d / 2, w, d, h) - 0.05, z0 + sz * d / 2, 8, 6));
    // 紙垂
    const sg = shideGeo(1.1);
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
      const g = sg.clone(); if (sx < 0) g.scale(-1, 1, 1); g.rotateY(sz < 0 ? Math.PI : 0);
      put(S.shide, g.translate(sx * 0.42, y0 + h + 0.32, z0 + sz * (d * 0.47 + 0.1)));
    }
    const sg2 = shideGeo(0.8);
    for (const sx of [-1, 1]) put(S.shide, sg2.clone().rotateY(sx * Math.PI / 2).translate(sx * (w / 2 + 0.02), y0 + 0.05, z0 + d * 0.3));
  }
  }
  if (type === 4) {   // 龍の曳山: 屋根の上をうねる長い胴、口を開けた頭、枝角・ひげ・炎のたてがみ、前足に宝珠
    const G = 0x1f8a4c, Gd = 0x13552e, BELLY = 0xe8c860, RED = 0xd42a1e;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    // 胴: 頭（前）から屋根の上をうねって後ろへ。だんだん細く
    const path = new THREE.CatmullRomCurve3([V(0, 5.0, 2.3), V(0.55, 5.55, 1.4), V(-0.5, 5.6, 0.4), V(0.55, 5.55, -0.6), V(-0.45, 5.45, -1.6), V(0.25, 5.2, -2.4), V(0.6, 5.7, -3.0)]);
    const body = new THREE.TubeGeometry(path, 80, 0.3, 10, false);
    { const pos = body.attributes.position, n = 81, ring = 11;   // しっぽへ向けて細くする
      for (let i = 0; i < n; i++) { const t = i / (n - 1), k = 1 - t * 0.75, c = path.getPointAt(t); for (let j = 0; j < ring; j++) { const q = i * ring + j; pos.setXYZ(q, c.x + (pos.getX(q) - c.x) * k, c.y + (pos.getY(q) - c.y) * k, c.z + (pos.getZ(q) - c.z) * k); } }
      body.computeVertexNormals(); }
    put(S.vc, col(body, G));
    // 背びれ（赤）と腹の金の帯
    for (let i = 1; i < 18; i++) {
      const t = i / 18, c = path.getPointAt(t), tg = path.getTangentAt(t), k = 1 - t * 0.75;
      const fin = new THREE.ConeGeometry(0.1 * k + 0.03, 0.42 * k + 0.12, 4).scale(0.4, 1, 1).translate(0, 0.28 * k + 0.08, 0);
      fin.rotateX(Math.atan2(tg.z, tg.y) * 0 + (tg.z > 0 ? -0.35 : 0.35)).translate(c.x, c.y + 0.12 * k, c.z);
      put(S.vc, col(fin, i % 2 ? RED : 0xf0bc3c));
      put(S.vc, col(sph(0.16 * k + 0.04, c.x, c.y - 0.2 * k, c.z, 6, 4).scale(1, 0.5, 1).translate(0, (c.y - 0.2 * k) * 0.5, 0), BELLY));
    }
    // 頭（前を向いて口を開ける）
    const hz = 2.75, hy = 5.25;
    put(S.vc, col(new THREE.SphereGeometry(0.48, 12, 10).scale(1, 0.85, 1.15).translate(0, hy, hz), G));
    put(S.vc, col(box(0.62, 0.3, 0.85, 0, hy + 0.05, hz + 0.7), G));                 // 上あご
    put(S.vc, col(box(0.56, 0.16, 0.8, 0, hy - 0.35, hz + 0.62).rotateX(0), Gd));    // 下あご（開いた口）
    put(S.vc, col(box(0.5, 0.06, 0.7, 0, hy - 0.16, hz + 0.6), RED));                // 口の中
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 3; k++) put(S.vc, col(new THREE.ConeGeometry(0.04, 0.16, 4).rotateX(Math.PI).translate(sx * 0.2, hy - 0.16, hz + 0.95 - k * 0.2), 0xffffff));   // 牙
      put(S.vc, col(new THREE.ConeGeometry(0.035, 0.12, 4).translate(sx * 0.18, hy - 0.22, hz + 0.95), 0xffffff));
      put(S.vc, col(sph(0.12, sx * 0.3, hy + 0.25, hz + 0.32, 8, 6), 0xffd23a));      // 目（金）
      put(S.vc, col(sph(0.055, sx * 0.36, hy + 0.27, hz + 0.4, 6, 4), RED));
      put(S.vc, col(box(0.2, 0.06, 0.3, sx * 0.25, hy + 0.36, hz + 0.3).rotateZ(0), Gd));   // まゆ
      // 枝角（金）
      const horn = new THREE.CatmullRomCurve3([V(sx * 0.22, hy + 0.35, hz), V(sx * 0.42, hy + 0.85, hz - 0.35), V(sx * 0.55, hy + 1.25, hz - 0.85)]);
      put(S.gold, new THREE.TubeGeometry(horn, 12, 0.06, 6));
      put(S.gold, new THREE.CylinderGeometry(0.02, 0.04, 0.4, 5).rotateX(-0.5).rotateZ(-sx * 0.4).translate(sx * 0.48, hy + 0.95, hz - 0.45));
      // ひげ（長く後ろへなびく）
      const wh = new THREE.CatmullRomCurve3([V(sx * 0.28, hy, hz + 1.05), V(sx * 0.7, hy + 0.1, hz + 0.9), V(sx * 1.05, hy - 0.2, hz + 0.3), V(sx * 1.2, hy - 0.5, hz - 0.4)]);
      put(S.vc, col(new THREE.TubeGeometry(wh, 16, 0.025, 4), 0xf6e6b0));
      // 炎のたてがみ
      for (let k = 0; k < 4; k++) put(S.vc, col(new THREE.ConeGeometry(0.1, 0.55, 5).rotateZ(sx * (0.9 + k * 0.15)).rotateX(0.5).translate(sx * 0.42, hy + 0.1 - k * 0.12, hz - 0.2 - k * 0.15), k % 2 ? RED : 0xf08a1e));
      // 前足（爪で屋根の前をつかむ）
      const leg = new THREE.CatmullRomCurve3([V(sx * 0.25, 5.05, 2.15), V(sx * 0.55, 4.7, 2.5), V(sx * 0.4, 4.45, 2.85)]);
      put(S.vc, col(new THREE.TubeGeometry(leg, 10, 0.09, 6), G));
      for (let k = -1; k <= 1; k++) put(S.gold, new THREE.ConeGeometry(0.035, 0.18, 4).rotateX(Math.PI / 2 + 0.6).translate(sx * 0.4 + k * 0.06, 4.38, 2.98));
    }
    // 宝珠（炎つき）を前足の間に
    put(S.vc, col(sph(0.2, 0, 4.55, 3.15, 12, 10), 0xfff2c0));
    for (let k = 0; k < 5; k++) put(S.vc, col(new THREE.ConeGeometry(0.06, 0.3, 5).rotateZ((k - 2) * 0.4).translate((k - 2) * 0.07, 4.8, 3.15), k % 2 ? RED : 0xf08a1e));
  }
  if (type === 1 || type === 3) {   // 布団太鼓・神輿: 長い担ぎ棒（金の金具つき）
    for (const sx of [-1, 1]) { put(S.wood, box(0.18, 0.18, 7.4, sx * 1.32, 1.6, 0)); for (const sz of [-1, 1]) put(S.gold, box(0.22, 0.22, 0.12, sx * 1.32, 1.6, sz * 3.7)); }
    for (const sz of [-1, 1]) put(S.wood, box(2.84, 0.16, 0.16, 0, 1.6, sz * 3.2));
  }
  if (type === 1) {   // 布団太鼓: 赤と黒の布団を逆さ台形に積む
    const y0 = 3.8;
    for (let i = 0; i < 5; i++) {
      const w = 2.3 + i * 0.32, d = 2.9 + i * 0.32, y = y0 + i * 0.3;
      put(S.vc, col(box(w, 0.26, d, 0, y, -0.2), i % 2 ? 0x1a1414 : 0xc0201a));
      put(S.gold, box(w + 0.04, 0.04, d + 0.04, 0, y + 0.14, -0.2));
    }
    const top = y0 + 4 * 0.3 + 0.16, tw = 2.3 + 4 * 0.32, td = 2.9 + 4 * 0.32;
    put(S.gold, box(0.5, 0.3, 0.5, 0, top + 0.15, -0.2));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {   // 四隅の房
      put(S.vc, col(cyl(0.05, 0.05, 0.4, 6, sx * tw / 2, top - 0.35, -0.2 + sz * td / 2), 0xf0bc3c));
      put(S.vc, col(new THREE.ConeGeometry(0.22, 1.0, 10).translate(sx * tw / 2, top - 1.05, -0.2 + sz * td / 2), 0xd42a1e));
    }
    daikuAt = [{ x: 0, y: top + 0.02, z: 0.4, s: 1, base: top + 0.02 }, { x: 0, y: top + 0.02, z: -0.8, s: 0.92, base: top + 0.02 }];
  } else if (type === 2) {   // 提灯山: 提灯をピラミッドに積む
    put(S.woodD, cyl(0.06, 0.06, 4.2, 6, 0, 5.7, -0.1));
    for (let k = 0; k < 5; k++) {
      const n = 12 - k * 2, r = 1.35 - k * 0.27, y = 3.95 + k * 0.5;
      put(S.black, new THREE.TorusGeometry(r, 0.025, 4, 24).rotateX(Math.PI / 2).translate(0, y + 0.26, -0.1));
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + k * 0.3; extraLan.push([Math.cos(a) * r, y, -0.1 + Math.sin(a) * r * 1.15, 0.95]); }
    }
    extraLan.push([0, 6.5, -0.1, 2.0]);
    daikuAt = [{ x: 0, y: 2.28, z: 1.65, s: 1, base: 2.28 }, { x: 0, y: 2.28, z: -1.65, s: 0.92, base: 2.28 }];
  } else if (type === 3) {   // 鳳凰神輿: 金の四角錐の屋根に鳳凰
    put(S.black, box(2.9, 0.16, 3.6, 0, 3.92, -0.1));
    put(S.gold, new THREE.ConeGeometry(2.25, 1.5, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 1.22).translate(0, 4.75, -0.1));
    put(S.gold, cyl(0.12, 0.2, 0.45, 8, 0, 5.65, -0.1));
    // 鳳凰: 宝珠の上で翼を大きく広げ、首をもたげて長い尾羽を跳ね上げる
    {
      const cx = 0, cy = 6.0, cz = -0.1, RED = 0xd42a1e, GRN = 0x1d7a5a, PUR = 0x6a2aa6;
      const tube = (pts, r, c) => put(S.vc, col(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(cx + x, cy + y, cz + z))), 24, r, 6), c));
      put(S.gold, sph(0.26, cx, cy - 0.12, cz, 12, 10));                                       // 宝珠
      put(S.vc, col(new THREE.TorusGeometry(0.27, 0.04, 6, 20).rotateX(Math.PI / 2).translate(cx, cy - 0.12, cz), RED));
      put(S.gold, sph(0.34, cx, cy + 0.38, cz - 0.05, 12, 10).scale(1, 1, 1));                 // 胴
      put(S.gold, new THREE.SphereGeometry(0.3, 12, 10).scale(0.85, 0.75, 1.5).translate(cx, cy + 0.42, cz - 0.08));
      // 首（S 字）と頭
      tube([[0, 0.55, 0.25], [0, 0.85, 0.42], [0, 1.15, 0.38], [0, 1.32, 0.52]], 0.09, 0xf0bc3c);
      put(S.gold, sph(0.17, cx, cy + 1.36, cz + 0.6, 10, 8));
      put(S.vc, col(new THREE.ConeGeometry(0.07, 0.3, 6).rotateX(Math.PI / 2).translate(cx, cy + 1.32, cz + 0.84), RED));   // くちばし
      for (const sx of [-1, 1]) put(S.vc, col(sph(0.04, cx + sx * 0.11, cy + 1.42, cz + 0.7, 6, 4), RED));               // 目
      for (let i = 0; i < 4; i++) put(S.vc, col(new THREE.ConeGeometry(0.045, 0.45 - i * 0.06, 5).rotateX(-0.6 - i * 0.25).translate(cx, cy + 1.6 - i * 0.04, cz + 0.5 - i * 0.12), i % 2 ? RED : 0xf0bc3c));   // 冠羽
      tube([[0, 1.2, 0.45], [0, 1.0, 0.62], [0, 0.82, 0.58]], 0.04, RED);                         // あごの垂れ
      // 翼: 羽根を扇に 7 枚ずつ、内側は金・外側は赤と緑
      for (const sx of [-1, 1]) for (let j = 0; j < 7; j++) {
        const a = 0.25 + j * 0.2, len = 0.9 + j * 0.12;
        const g = new THREE.ConeGeometry(0.13, len, 4).scale(1, 1, 0.22).translate(0, len / 2, 0)
          .rotateZ(-sx * (Math.PI / 2 - a)).rotateY(sx * 0.25).translate(cx + sx * 0.22, cy + 0.55, cz - 0.05 - j * 0.03);
        put(j < 3 ? S.gold : S.vc, j < 3 ? g : col(g, j % 2 ? RED : GRN));
      }
      for (const sx of [-1, 1]) put(S.gold, new THREE.BoxGeometry(0.75, 0.08, 0.32).rotateZ(sx * 0.55).translate(cx + sx * 0.42, cy + 0.72, cz - 0.05));   // 翼の付け根
      // 尾羽: 5 本、後ろへ流れて先が跳ね上がる
      [[0, RED], [-0.28, 0xf0bc3c], [0.28, 0xf0bc3c], [-0.5, GRN], [0.5, PUR]].forEach(([sx, c], i) => {
        const L = 1 + (i < 3 ? 0.35 : 0);
        tube([[0, 0.35, -0.35], [sx * 0.4, 0.1, -0.9 * L], [sx * 0.9, 0.25, -1.5 * L], [sx * 1.15, 0.85, -1.85 * L], [sx * 1.0, 1.25, -1.7 * L]], 0.05, c);
        put(S.gold, sph(0.09, cx + sx * 1.0, cy + 1.27, cz - 1.7 * L, 8, 6));
      });
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(S.vc, col(new THREE.ConeGeometry(0.12, 0.5, 8).translate(sx * 1.45, 3.6, -0.1 + sz * 1.78), 0xd42a1e));
    daikuAt = [{ x: 0, y: 2.28, z: 1.65, s: 1, base: 2.28 }, { x: 0, y: 2.28, z: -1.65, s: 0.92, base: 2.28 }];
  }
  // 提灯
  {
    const lan = [], caps = [];
    const L = (x, y, z, s = 1) => {
      const g = cyl(0.17 * s, 0.17 * s, 0.36 * s, 16, x, y, z); g.scale(1, 1, 1);
      const bulge = g.attributes.position; for (let i = 0; i < bulge.count; i++) { const yy = (bulge.getY(i) - y) / (0.18 * s); const k = 1 + 0.18 * (1 - yy * yy); bulge.setX(i, x + (bulge.getX(i) - x) * k); bulge.setZ(i, z + (bulge.getZ(i) - z) * k); }
      g.computeVertexNormals(); lan.push(g);
      caps.push(cyl(0.1 * s, 0.11 * s, 0.05 * s, 10, x, y + 0.2 * s, z), cyl(0.11 * s, 0.1 * s, 0.05 * s, 10, x, y - 0.2 * s, z), cyl(0.008, 0.008, 0.25, 4, x, y + 0.35 * s, z));
    };
    for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) L(sx * 1.5, 3.62, -1.7 + i * 0.52);
    for (let i = 0; i < 4; i++) L(-0.84 + i * 0.56, 3.45, 2.14, 0.95);
    for (let i = 0; i < 3; i++) L(-0.6 + i * 0.6, 3.6, -2.1);
    for (const [x, y, z, sc] of extraLan) L(x, y, z, sc);
    put(S.lantern, merge(lan));
    put(S.black, merge(caps));
  }
  // 材質ごとに 1 つへまとめる
  const outlineSrc = [];
  for (const [mat, list] of buckets) {
    const g = merge(list);
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
    body.add(m);
    if (mat !== S.lantern && mat !== S.shide) outlineSrc.push(g);
  }
  const ol = new THREE.Mesh(merge(outlineSrc.map(g => { const c = g.clone(); if (c.attributes.color) c.deleteAttribute('color'); return c; })), outlineMat(0.028));
  body.add(ol);

  // 車輪（回る）
  const wheelGeo = merge([
    col(rotZ(cyl(0.5, 0.5, 0.3, 22), Math.PI / 2), 0x6a4020),
    col(rotZ(cyl(0.53, 0.53, 0.2, 22), Math.PI / 2), 0x2c2a2a),
    col(rotZ(cyl(0.16, 0.16, 0.38, 10), Math.PI / 2), 0xc9a040),
    ...[0, 1, 2, 3].map(k => col(rotX(box(0.32, 0.06, 0.9), k * Math.PI / 4), 0x4a2c14)),
  ]);
  const wheels = [];
  for (const x of [-0.98, 0.98]) for (const z of [-1.45, 1.45]) {
    const wm = new THREE.Mesh(wheelGeo, S.vc); wm.position.set(x, 0.53, z); wm.castShadow = true; body.add(wm); withOutline(wm, 0.02); wheels.push(wm);
  }
  // 幟（御祭禮）: 後ろの角に 2 本。竿ごと揺れる
  const banners = [];
  const bTex = bannerTex(team), bMat = toon({ map: bTex, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) {
    const pole = new THREE.Group(); pole.position.set(sx * 1.22, 2.25, -1.95); body.add(pole);
    const pm = new THREE.Mesh(merge([col(cyl(0.035, 0.04, 4.2, 6, 0, 2.1, 0), 0x2a1a0e), col(sph(0.07, 0, 4.25, 0, 8, 6), 0xf0bc3c), col(rotZ(cyl(0.025, 0.025, 0.8, 5, 0, 0, 0), Math.PI / 2).translate(sx * 0.38, 4.05, 0), 0x2a1a0e)]), S.vc);
    pm.castShadow = true; pole.add(pm);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 2.1, 1, 8), bMat);
    cloth.rotation.y = Math.PI / 2; cloth.position.set(sx * 0.38, 2.97, 0); cloth.castShadow = true; pole.add(cloth);
    pole.rotation.z = -sx * 0.12;
    banners.push({ pole, cloth, sx, base: cloth.geometry.attributes.position.array.slice() });
  }
  // 大工方は CrowdRig でまとめて描く。ここでは立ち位置だけ持つ
  const daiku = daikuAt || [{ x: 0, y: 5.18, z: 0.5, s: 1, base: 5.18 }, { x: 0, y: 4.5, z: 1.45, s: 0.92, base: 4.5 }];
  return { group, tilt, body, wheels, banners, daiku, daikuPose: [newPose(), newPose()] };
}

// だんじりの見た目を物理の状態に合わせる
export function animateDanjiri(D, car, dt, t, music) {
  const roll = car.roll, pitch = car.pitch;
  // 外側の車輪を支点に傾く（片輪走行）
  const x0 = -Math.sign(roll || 1) * 1.05;
  const ca = Math.cos(roll), sa = Math.sin(roll);
  D.tilt.position.set(x0 - x0 * ca, -x0 * sa, 0);
  D.tilt.rotation.z = roll;
  D.body.rotation.x = pitch;
  D.body.position.y = car.air ? 0 : Math.abs(Math.sin(t * (6 + car.speed * 0.4))) * Math.min(0.05, car.speed * 0.003);
  const spin = (car.vF || 0) * dt / 0.5;
  for (const w of D.wheels) w.rotation.x += spin;
  // 幟のはためき
  for (const b of D.banners) {
    const pos = b.cloth.geometry.attributes.position, base = b.base, sp = Math.min(1, car.speed / 20);
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3], by = base[i * 3 + 1];
      const k = (bx + 0.35) / 0.7;
      pos.setZ(i, Math.sin(t * (5 + sp * 8) + by * 2.2 + bx * 4) * 0.12 * k * (0.4 + sp));
    }
    pos.needsUpdate = true;
    b.pole.rotation.x = -sp * 0.25 + Math.sin(t * 3 + b.sx) * 0.03 - car.pitch * 0.5;
    b.pole.rotation.z = -b.sx * 0.12 - roll * 0.4;
  }
  // 大工方: 鳴物に合わせて舞い、傾きに逆らって踏ん張る
  D.daiku.forEach((fig, i) => {
    const p = D.daikuPose[i], beat = music + i * 0.5;
    const hop = Math.abs(Math.sin(beat * Math.PI));
    if (car.crashT > 0) {
      p.lean = -0.5; p.side = -roll * 1.2; p.headPitch = 0.3;
      p.arm[0] = [-2.6, 0.9, -0.2]; p.arm[1] = [-2.4, 1.0, -0.2];
      p.leg[0] = [-0.9, 0.3, 1.2]; p.leg[1] = [0.2, 0.4, 0.6];
      fig.y = fig.base + 0.2;
    } else if (car.air) {
      p.lean = 0.2; p.side = Math.sin(t * 10) * 0.2; p.headPitch = -0.3;
      p.arm[0] = [-2.9 + Math.sin(t * 18) * 0.4, 0.5, -0.2]; p.arm[1] = [-2.9 + Math.cos(t * 18) * 0.4, 0.5, -0.2];
      p.leg[0] = [-0.8, 0.3, 1.4]; p.leg[1] = [-0.8, 0.3, 1.4];
      fig.y = fig.base + 0.35;
    } else {
      const bal = -roll * 1.6;
      p.lean = 0.08 + Math.min(0.3, car.speed * 0.01) - pitch * 0.8; p.side = bal; p.twist = Math.sin(beat * Math.PI * 0.5) * 0.25; p.headPitch = -0.15;
      p.arm[0] = [-2.2 - hop * 0.7, 0.35 + hop * 0.3, -0.5 - hop * 0.4]; p.arm[1] = [-1.4 + hop * 0.6 - Math.sin(t * 7) * 0.3, 0.9, -0.6];
      if (i) { p.arm[0] = [-1.0 - hop * 0.6, 0.6, -0.8]; p.arm[1] = [-1.0 - (1 - hop) * 0.6, 0.6, -0.8]; }
      const crouch = 0.25 + hop * 0.35 + Math.abs(roll) * 0.6;
      p.leg[0] = [-crouch, 0.25 + Math.max(0, roll) * 0.5, crouch * 2]; p.leg[1] = [-crouch * 0.9, 0.25 + Math.max(0, -roll) * 0.5, crouch * 1.8];
      fig.y = fig.base - crouch * 0.25 + hop * 0.12 * (car.speed > 3 ? 1 : 0.4);
    }
    fig.x = -roll * 0.25;
  });
}

// ---------------- 壊せる小物 ----------------
export const PROP_TYPES = {
  cone: { r: 0.35, mass: 0.2, geo: () => merge([col(cyl(0.05, 0.3, 0.7, 12, 0, 0.38, 0), 0xff6a1a), col(cyl(0.16, 0.22, 0.14, 12, 0, 0.36, 0), 0xf8f8f8), col(box(0.6, 0.05, 0.6, 0, 0.025, 0), 0x2a2a2a)]) },
  barricade: { r: 0.9, mass: 0.4, geo: () => merge([col(box(1.8, 0.28, 0.06, 0, 0.85, 0), 0xf2c400), ...[-0.6, -0.2, 0.2, 0.6].map(x => col(box(0.18, 0.28, 0.065, x, 0.85, 0), 0x111111)), ...[-0.8, 0.8].map(x => col(box(0.06, 1.0, 0.5, x, 0.5, 0), 0xdddddd))]) },
  crate: { r: 0.55, mass: 0.6, geo: () => merge([col(box(0.9, 0.9, 0.9, 0, 0.45, 0), 0xb3803f), ...[-0.4, 0.4].map(y => col(box(0.94, 0.1, 0.94, 0, 0.45 + y, 0), 0x7a5128)), col(box(0.1, 0.94, 0.94, 0, 0.45, 0), 0x7a5128)]) },
  tawara: { r: 0.55, mass: 0.7, geo: () => merge([col(rotZ(cyl(0.42, 0.42, 1.0, 14), Math.PI / 2).translate(0, 0.42, 0), 0xd6b768), ...[-0.3, 0, 0.3].map(x => col(rotZ(cyl(0.44, 0.44, 0.06, 14), Math.PI / 2).translate(x, 0.42, 0), 0x8a6a2a))]) },
  sign: { r: 0.5, mass: 0.3, geo: () => merge([col(rotX(box(0.7, 1.1, 0.05, 0, 0.55, 0.15), -0.25), 0xf4efe2), col(rotX(box(0.7, 1.1, 0.05, 0, 0.55, -0.15), 0.25), 0x1e3f8a), col(box(0.5, 0.15, 0.07, 0, 0.8, 0.2), 0xc62828)]) },
  bin: { r: 0.4, mass: 0.3, geo: () => merge([col(cyl(0.32, 0.28, 0.85, 14, 0, 0.43, 0), 0x2f7a4a), col(cyl(0.34, 0.34, 0.08, 14, 0, 0.88, 0), 0x245c38)]) },
  bike: { r: 0.6, mass: 0.3, geo: () => merge([...[-0.5, 0.5].map(z => col(T(new THREE.TorusGeometry(0.33, 0.035, 6, 18).rotateY(Math.PI / 2), 0, 0.35, z), 0x222222)), col(box(0.05, 0.05, 1.0, 0, 0.6, 0), 0xc62828), col(rotX(box(0.05, 0.5, 0.05, 0, 0.55, 0.2), 0.3), 0xc62828), col(box(0.5, 0.04, 0.04, 0, 0.95, 0.5), 0x333333), col(box(0.18, 0.06, 0.25, 0, 0.88, -0.2), 0x222222)]) },
};

// ---------------- 見物客（1 つにまとめた形） ----------------
export function spectatorGeo(armsUp) {
  const parts = [
    col(box(0.4, 0.82, 0.24, 0, 0.41, 0), 0x2a2a30),
    col(box(0.46, 0.62, 0.27, 0, 1.13, 0), 0xffffff),
    col(sph(0.145, 0, 1.62, 0.01, 8, 6).scale(1, 1.08, 1), 0xf0c4a0),
    col(sph(0.152, 0, 1.68, -0.012, 8, 4), 0x1b1512),
  ];
  for (const sd of [-1, 1]) {
    if (armsUp) {
      parts.push(col(rotZ(box(0.12, 0.62, 0.12, 0, 0.3, 0), -sd * 0.35).translate(sd * 0.3, 1.38, 0), 0xffffff));
      parts.push(col(sph(0.065, sd * 0.52, 1.95, 0, 6, 4), 0xf0c4a0));
    } else {
      parts.push(col(rotZ(box(0.12, 0.6, 0.12, 0, -0.3, 0), sd * 0.12).translate(sd * 0.3, 1.4, 0.03), 0xffffff));
    }
  }
  return merge(parts);
}
