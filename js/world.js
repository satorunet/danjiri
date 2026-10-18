// 町をつくる: 道・家並み・電柱・鳥居・お城・見物客・壊せる小物
import * as THREE from 'three';
import {
  toon, withOutline, atlasify, atlasAttr, canvasTex, col, colored, asphaltTex, stoneTex, tileWalkTex, gravelTex, grassTex, waterTex, plankTex,
  facadeAtlas, machiyaAtlas, roofTileTex, awningTex, signAtlas, noboriAtlas, lanternTex, shideGeo, stripeTex,
} from './gfx.js?v=136';
import { merge, PROP_TYPES, spectatorGeo } from './models.js?v=136';
import * as ST from './stages.js?v=136';
import { HALF_W, WALL, SIDE, BIN, heightS, sampleS, project, binOf, sideOf, kickAt } from './sim.js?v=136';

// 毎回同じ町並みになるように種つき乱数
let seed = 20261018;
const R = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rr = (a, b) => a + R() * (b - a);
const rpick = a => a[Math.floor(R() * a.length)];

const T = (g, x = 0, y = 0, z = 0) => g.translate(x, y, z);
const box = (w, h, d, x = 0, y = 0, z = 0) => T(new THREE.BoxGeometry(w, h, d), x, y, z);
const cyl = (rt, rb, h, seg = 10, x = 0, y = 0, z = 0) => T(new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z);
const blob = (r, x, y, z, detail = 1) => {
  const g = new THREE.IcosahedronGeometry(r, detail); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1 + (Math.sin(p.getX(i) * 5.1 + p.getY(i) * 3.7) * 0.08); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.85, p.getZ(i) * k); }
  g.computeVertexNormals(); return T(g, x, y, z);
};
const PROP_NAMES = { cone: ['コーン', 3], barricade: ['バリケード', 15], crate: ['木箱', 25], tawara: ['俵', 60], sign: ['立て看板', 8], bin: ['ゴミ箱', 12], bike: ['自転車', 15] };
const SIDE_MOD = SIDE, SIDE_OLD = SIDE - 0.6; // 家の正面までの距離
const O = WALL - 7;                  // 道を広げたぶんのずらし（歩道より外の物の位置）

export function buildWorld(scene, course, opts = {}) {
  seed = 20261018;
  const TH = opts.theme || 'jp', JP = TH === 'jp', NIGHT = !!opts.night;   // ステージの町並み: jp / paris / ny / giza
  const W = { props: [], specs: [], anim: [], nightMats: [], dayOnly: [], nightOnly: [], water: null };
  // 壊れる物: 道の左右・区切りごとに登録しておき、だんじりが突っ込んで幅が広がったら壊す
  W.pieces = [];
  const nb = course.nb, byBin = [0, 1].map(() => Array.from({ length: nb }, () => []));
  const PQ = {};
  const piece = (kind, x, y, z, front = 0, span = 0, extra = {}) => {
    project(course, x, z, -1, PQ);
    const pc = { kind, px: x, py: y, pz: z, s: PQ.s, side: sideOf(PQ.lat), lat: Math.abs(PQ.lat) - front, parts: [], st: 0, ...extra };
    W.pieces.push(pc);
    const b0 = binOf(course, PQ.s - span / 2), n = Math.max(1, Math.ceil(span / BIN) + 1);
    for (let k = 0; k < n; k++) byBin[pc.side][(b0 + k) % nb].push(pc);
    return pc;
  };
  // 道をまたぐ物（提灯の列・鳥居）: くぐる時に引っかかる
  W.spans = [];
  const spanPiece = (kind, s, x, y, z, extra = {}) => { const pc = { kind, s, px: x, py: y, pz: z, gy: heightS(course, s), parts: [], st: 0, ...extra }; W.spans.push(pc); return pc; };
  const addPart = (pc, m, i, mat) => pc.parts.push({ m, i, base: mat.clone() });
  const add = (m, shadow = true, recv = true) => { m.castShadow = shadow; m.receiveShadow = recv; scene.add(m); return m; };
  const hAt = (x, z) => heightS(course, project(course, x, z).s);
  const inst = (geo, mat, list, setup, { shadow = true, outline = 0 } = {}) => {
    if (!list.length) return null;
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    const d = new THREE.Object3D();
    list.forEach((it, i) => { d.position.set(0, 0, 0); d.rotation.set(0, 0, 0, 'YXZ'); d.scale.set(1, 1, 1); setup(d, it, i, m); d.updateMatrix(); m.setMatrixAt(i, d.matrix); if (it.pc) it.pc.parts.push({ m, i, base: d.matrix.clone() }); });
    add(m, shadow, true);
    if (outline) { const o = withOutline(m, outline); m.userData.twin = o; scene.add(o); }
    return m;
  };

  // ---------- 地面・空のまわり ----------
  const grass = ST.groundTex(TH) || grassTex(); grass.repeat.set(220, 220);
  if (TH === 'venice') W.lagoon = grass;   // ベネチアは一面の水（ゆっくり流す）
  add(new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600).rotateX(-Math.PI / 2).translate(0, -0.06, 0), toon({ map: grass, color: { jp: 0xb9c8a0, paris: 0xc4d4a4, ny: 0xffffff, giza: 0xffffff, venice: 0xffffff }[TH] })), false, true);

  // ---------- 道（高低差つきのリボン） ----------
  const straightStyle = j => course.segs[course.straights[j].seg].style;
  const tint = { jp: 0xffffff, paris: 0xf4f0ea, ny: 0xd8d8e0, giza: 0xf2dcb0, venice: 0xffffff }[TH];
  // ベネチアは道が水路（だんじりは水しぶきを上げて運河を進む）
  if (TH === 'venice') { W.canal = ST.groundTex('venice'); W.canal.repeat.set(3, 1); }
  const roadMats = TH === 'venice' ? (() => { const w = toon({ map: W.canal, color: 0xd8f0f0 }); return { modern: w, plain: w, old: w, shrine: w, plank: toon({ map: plankTex() }) }; })() : {
    modern: toon({ map: TH === 'venice' ? stoneTex('#b8b4ac', '#8a867e') : asphaltTex(true), color: tint }), plain: toon({ map: TH === 'venice' ? stoneTex('#c4c0b6', '#9a968e') : asphaltTex(false), color: tint }),
    old: toon({ map: TH === 'paris' || TH === 'venice' ? stoneTex('#a8a49c', '#76726a') : TH === 'giza' ? stoneTex('#d8bc8a', '#a88a58') : TH === 'ny' ? asphaltTex(true) : stoneTex('#c4b9a6', '#8e8576'), color: TH === 'ny' ? tint : 0xffffff }),
    shrine: toon({ map: TH === 'paris' || TH === 'venice' ? stoneTex('#d8d0c0', '#a8a090') : TH === 'giza' ? stoneTex('#e2c898', '#b89a66') : TH === 'ny' ? asphaltTex(true) : stoneTex('#d3cdc0', '#a59d8e'), color: TH === 'ny' ? tint : 0xffffff }),
    plank: toon({ map: plankTex() }),
  };
  const walkMats = JP ? { modern: toon({ map: tileWalkTex() }), old: toon({ map: stoneTex('#a99f8f', '#7d7466') }), shrine: toon({ map: gravelTex() }) }
    : (() => { const m = toon({ map: TH === 'giza' ? stoneTex('#d8bc8a', '#b09060') : TH === 'ny' ? stoneTex('#a8a8ac', '#88888c') : stoneTex('#d8d2c4', '#b4ac9c') }); return { modern: m, old: m, shrine: m }; })();
  const wallMat = toon({ map: stoneTex('#a6a093', '#77716a'), side: THREE.DoubleSide });
  // 道・歩道・石垣は材質ごとに 1 つへまとめて描く（描画回数を減らす）
  const strips = new Map();
  const addStrip = (g, mat) => { if (!strips.has(mat)) strips.set(mat, []); strips.get(mat).push(g); };
  const ribbon = (s0, s1, latA, latB, mat, { step = 1, yOff = 0, vScale = 12, skirt = false, skirtTo = null } = {}) => {
    const pos = [], uv = [], idx = [], P = {};
    const ss = [];
    const fine = s => { const r = ((s % course.L) + course.L) % course.L; return Math.abs(r - course.prof.jumpS) < 3 || kickAt(course, r) || course.prof.rough.some(([a, b]) => r > a && r < b); };
    for (let s = s0; s < s1; s += (fine(s) ? 0.25 : step)) ss.push(s);
    ss.push(s1);
    ss.forEach((s, k) => {
      sampleS(course, s, P); const h = heightS(course, s) + yOff;
      for (const lat of [latA, latB]) pos.push(P.x - P.tz * lat, h, P.z + P.tx * lat);
      uv.push(0, s / vScale, 1, s / vScale);
      if (k) { const a = (k - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    addStrip(g, mat);
    if (skirt) {
      // 道の端から地面までの石垣
      for (const lat of [latA, latB]) {
        const sp = [], su = [], si = [];
        ss.forEach((s, k) => {
          sampleS(course, s, P); const h = heightS(course, s) + yOff, bottom = skirtTo ? skirtTo(s, h) : -0.2;
          sp.push(P.x - P.tz * lat, h, P.z + P.tx * lat, P.x - P.tz * lat, bottom, P.z + P.tx * lat);
          su.push(s / 4, h / 4, s / 4, bottom / 4);
          if (k) { const a = (k - 1) * 2; si.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
        });
        const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(su, 2)); sg.setIndex(si); sg.computeVertexNormals();
        addStrip(sg, wallMat);
      }
    }
  };
  const bridge = course.prof.bridge;
  course.straights.forEach((st, j) => {
    const style = straightStyle(j);
    const mat = style === 'old' ? roadMats.old : style === 'shrine' ? roadMats.shrine : roadMats.modern;
    ribbon(st.a, st.b, -WALL, WALL, mat, { step: 1 });
    // 歩道（縁石つき）
    const wm = style === 'old' ? walkMats.old : style === 'shrine' ? walkMats.shrine : walkMats.modern;
    const out = style === 'old' || style === 'shrine' ? SIDE_OLD : SIDE_MOD;
    for (const sd of [-1, 1]) {
      const a = sd < 0 ? -out : WALL, b = sd < 0 ? -WALL : out;
      const isBridge = s => j === 0 && s > bridge[0] && s < bridge[1];
      ribbon(st.a + 6, st.b - 6, a, b, wm, { yOff: 0.16, vScale: 4, skirt: true, skirtTo: (s, h) => isBridge(s) ? h - 0.8 : -0.2 });
    }
  });
  // 角の広場（交差点の四角）
  course.corners.forEach((c, k) => {
    const h = heightS(course, c.s);
    const g = new THREE.PlaneGeometry(HALF_W * 2 + 2.4, HALF_W * 2 + 2.4).rotateX(-Math.PI / 2);
    const m = add(new THREE.Mesh(g, roadMats.plain), false, true);
    m.position.set(c.c.x, h - 0.012, c.c.z); m.rotation.y = Math.atan2(c.dIn.x, c.dIn.z);
    ribbon(c.s, c.e, -WALL, WALL, roadMats.plain, { step: 0.7, yOff: 0.004 });
  });
  // ジャンプ台の板張り
  const js = course.prof.jumpS;
  ribbon(js - 12, js + 0.05, -5.5, 5.5, roadMats.plank, { step: 0.5, yOff: 0.03, vScale: 3 });
  if (TH === 'venice') ribbon(course.prof.bridge[0] - 2, course.prof.bridge[1] + 2, -WALL, WALL, toon({ map: stoneTex('#e2dccc', '#b8b0a0') }), { step: 0.5, yOff: 0.03, vScale: 6 });   // 渡る石の橋
  // 小さなジャンプ台（道幅いっぱいの板張り）
  for (const q of course.prof.kick) ribbon(q.s - 0.2, q.s + q.len + 0.02, -WALL + 0.3, WALL - 0.3, roadMats.plank, { step: 0.25, yOff: 0.035, vScale: 3 });

  for (const [mat, list] of strips) add(new THREE.Mesh(merge(list), mat), false, true);
  strips.clear();

  // ---------- 家並み ----------
  const FAC = { jp: facadeAtlas, paris: ST.parisFacade, ny: ST.nyFacade, giza: ST.gizaFacade, venice: ST.veniceFacade }[TH];
  const fac = atlasify(toon({ map: FAC(false), emissiveMap: FAC(true), emissive: 0xffffff, emissiveIntensity: 0 }), 4, 2);
  const mach = atlasify(toon({ map: machiyaAtlas(false), emissiveMap: machiyaAtlas(true), emissive: 0xffffff, emissiveIntensity: 0 }), 2, 1);
  W.nightMats.push([fac, 0.55], [mach, 0.5]);
  const modern = [], machiya = [], occupied = [];
  const free = (x, z, r) => occupied.every(o => Math.hypot(o.x - x, o.z - z) > o.r + r);
  const roadClear = (x, z, w, d, rot) => {
    const fx = Math.sin(rot), fz = Math.cos(rot), lx = fz, lz = -fx;
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1]]) {
      const cx = x + lx * a * w / 2 + fx * b * d / 2, cz = z + lz * a * w / 2 + fz * b * d / 2;
      for (const s of course.segs) {
        const ax = s.a.x, az = s.a.z, dx = s.b.x - ax, dz = s.b.z - az, l2 = dx * dx + dz * dz;
        const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cz - az) * dz) / l2));
        if (Math.hypot(cx - ax - dx * t, cz - az - dz * t) < SIDE_OLD - 0.2) return false;
      }
    }
    return true;
  };
  const CASTLE = { x: 30, z: 160 }, PAGODA = { x: -104, z: 140 }, HALL = { x: -100, z: 214 };
  occupied.push({ x: CASTLE.x, z: CASTLE.z, r: TH === 'giza' ? 66 : TH === 'paris' ? 34 : 30 });
  // 階数: ステージごと
  const FLOORS = { jp: st => [2, st === 'high' ? 4 : 5.5], paris: () => [4, 6.4], ny: () => [6, 20], giza: () => [1, 3.4], venice: () => [3, 5.4] }[TH];
  // 角の突き当たりは必ず建物で塞ぐ（激突の相手）
  course.corners.forEach(c => {
    if (TH === 'ny' && c.c.x === 200 && c.c.z === 0) return;   // スタートの直線の先は海（自由の女神が見える）
    const seg = course.segs[c.seg], style = seg.style === 'old' ? 'old' : 'modern';
    const setback = style === 'old' ? SIDE_OLD : SIDE_MOD, d = 10;
    const x = c.c.x + c.dIn.x * (setback + d / 2), z = c.c.z + c.dIn.z * (setback + d / 2);
    const rot = Math.atan2(-c.dIn.x, -c.dIn.z), base = heightS(course, c.s);
    (JP && style === 'old' ? machiya : modern).push({ x, z, w: HALF_W * 2 + 3, d, rot, base, floors: TH === 'ny' ? 14 : TH === 'giza' ? 2 : TH === 'paris' ? 5 : TH === 'venice' ? 4 : 3, tile: Math.floor(R() * 6), shop: 6, h: 6.5 });
    occupied.push({ x, z, r: 9 });
  });
  W.solid = [];
  const pyrs = [];
  course.segs.forEach((sg, si) => {
    const style = sg.style;
    if (style === 'shrine' && (JP || TH === 'giza')) return;
    if (TH === 'giza' && [0, 3, 5].includes(si)) {
      // ピラミッドの間を走る通り: 家の代わりに両側へピラミッドを並べる（壊れない）
      const dx = sg.b.x - sg.a.x, dz = sg.b.z - sg.a.z, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len, rx = -uz, rz = ux;
      for (const side of [-1, 1]) for (let t = HALF_W + 22 + (side > 0 ? 0 : 24); t < len - HALF_W - 20; t += 50) {
        const B = rr(32, 40), H = B * 0.64, off = SIDE + 1.5 + B / 2;
        const x = sg.a.x + ux * t + rx * side * off, z = sg.a.z + uz * t + rz * side * off;
        const pr = project(course, sg.a.x + ux * t, sg.a.z + uz * t);
        pyrs.push({ x, z, B, H, rot: Math.atan2(ux, uz) });
        W.solid.push({ s0: pr.s - B / 2 - 2, s1: pr.s + B / 2 + 2, side: side > 0 ? 1 : 0 });
        occupied.push({ x, z, r: B * 0.7 });
      }
      return;
    }
    const dx = sg.b.x - sg.a.x, dz = sg.b.z - sg.a.z, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len, rx = -uz, rz = ux;
    const old = JP && style === 'old', setback = old ? SIDE_OLD : SIDE_MOD;
    for (const side of [-1, 1]) {
      if (TH === 'venice' && side < 0 && (si === 5 || si === 7)) continue;   // ラグーン側は開けておく
      let t = HALF_W + 1;
      while (t < len - HALF_W - 3) {
        const w = old ? rr(6.5, 9.5) : rr(7, 12), d = old ? rr(8, 10) : rr(9, 13);
        if (t + w > len - HALF_W - 1) break;
        const off = setback + d / 2;
        const x = sg.a.x + ux * (t + w / 2) + rx * side * off, z = sg.a.z + uz * (t + w / 2) + rz * side * off;
        const rot = Math.atan2(-side * rx, -side * rz);
        const pr = project(course, sg.a.x + ux * (t + w / 2), sg.a.z + uz * (t + w / 2));
        const onBridge = si === 7 && pr.s > bridge[0] - 6 && pr.s < bridge[1] + 6 || TH === 'paris' && Math.abs(pr.s - course.prof.torii[0]) < 18 || JP && si === 7 && Math.abs(pr.s - 182) < 12;
        if (!onBridge && roadClear(x, z, w, d, rot) && free(x, z, Math.min(w, d) * 0.45)) {
          const base = heightS(course, pr.s);
          if (old) machiya.push({ x, z, w, d, rot, base, h: rr(5.6, 7.2), tile: R() < 0.3 ? 1 : 0 });
          else { const [f0, f1] = FLOORS(style); modern.push({ x, z, w, d, rot, base, floors: Math.floor(rr(f0, f1)), tile: Math.floor(R() * 6), shop: R() < (JP ? 0.75 : 0.95) ? (R() < 0.65 ? 6 : 7) : -1, side, s: pr.s }); }
          occupied.push({ x, z, r: Math.min(w, d) * 0.45 });
        }
        t += w + rr(0.1, 0.8);
      }
    }
  });
  // 近代の建物
  {
    const n = modern.length;
    const upper = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), fac, n), ua = atlasAttr(upper, n);
    const ground = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), fac, n), ga = atlasAttr(ground, n);
    const d = new THREE.Object3D();
    const caps = [], awn = [], hs = [], vs = [], tanks = [], acs = [], founds = [], chims = [], dorms = [], bills = [], dishes = [];
    const AWN = { jp: [0xd8463a, 0x2f6fb8, 0x3a8a4a, 0xe08a2a, 0x7a4a2a, 0xc23a7a], paris: [0xb8202a, 0x1f4a3a, 0x1e2f5c, 0x5a1f2a], ny: [0x111111, 0xc0182c, 0x1e2f6c], giza: [0xb8282a, 0x2a5ab0, 0xe8b42a, 0x2a8a5a], venice: [0x2a5a3a, 0x8a1a1a, 0x1e3c7a, 0xc89a3a] }[TH];
    modern.forEach((b, i) => {
      const fh = 3.2, gh = 3.6, top = b.base + gh + b.floors * fh;
      const pc = b.pc = piece('bld', b.x, b.base, b.z, b.d / 2, b.w, { w: b.w, d: b.d, rot: b.rot, col: [0xc9c3b6, 0x8e959c, 0xd8cfc0, 0x6a6e72] });
      const fx = Math.sin(b.rot), fz = Math.cos(b.rot), lx = fz, lz = -fx;
      d.rotation.set(0, b.rot, 0);
      d.position.set(b.x, b.base + gh + b.floors * fh / 2, b.z); d.scale.set(b.w, b.floors * fh, b.d); d.updateMatrix(); upper.setMatrixAt(i, d.matrix); addPart(pc, upper, i, d.matrix);
      const bays = Math.max(1, Math.round(b.w / 3.6));
      ua.setXYZW(i, b.tile % 4, Math.floor(b.tile / 4), bays, b.floors);
      d.position.set(b.x, b.base + gh / 2, b.z); d.scale.set(b.w, gh, b.d); d.updateMatrix(); ground.setMatrixAt(i, d.matrix); addPart(pc, ground, i, d.matrix);
      const shopTile = b.shop >= 0 ? b.shop : b.tile;
      ga.setXYZW(i, shopTile % 4, Math.floor(shopTile / 4), bays, 1);
      if (b.base > 0.3) founds.push({ x: b.x, z: b.z, rot: b.rot, w: b.w, d: b.d, h: b.base });
      caps.push({ x: b.x, y: top, z: b.z, rot: b.rot, w: b.w + 0.3, d: b.d + 0.3, pc });
      if (TH === 'venice') for (let k = 0; k < 2; k++) chims.push({ x: b.x + lx * rr(-b.w / 3, b.w / 3), y: top + 0.2, z: b.z + lz * rr(-b.w / 3, b.w / 3), rot: b.rot, pc });
      if (TH === 'paris') { // マンサード屋根の窓と煙突
        for (let u = -b.w / 2 + 1.8; u < b.w / 2 - 1.2; u += 3.2) dorms.push({ x: b.x + lx * u + fx * (b.d / 2 - 0.9), y: top + 0.4, z: b.z + lz * u + fz * (b.d / 2 - 0.9), rot: b.rot, pc });
        for (let k = 0; k < 2; k++) chims.push({ x: b.x + lx * rr(-b.w / 3, b.w / 3) - fx * rr(0, b.d / 5), y: top + 3.0, z: b.z + lz * rr(-b.w / 3, b.w / 3) - fz * rr(0, b.d / 5), rot: b.rot, pc });
      }
      if (TH === 'ny' && b.floors >= 6 && R() < 0.6) { // 巨大広告
        const bh = Math.min(b.floors * fh * 0.55, rr(9, 15)), bw = Math.min(b.w * 0.92, bh * 1.6);
        bills.push({ x: b.x + fx * (b.d / 2 + 0.2), y: b.base + gh + rr(1, Math.max(1.2, b.floors * fh - bh - 1)) + bh / 2, z: b.z + fz * (b.d / 2 + 0.2), rot: b.rot, w: bw, h: bh, tile: Math.floor(R() * 8), pc });
      }
      if (TH === 'giza' && R() < 0.5) dishes.push({ x: b.x + lx * rr(-b.w / 3, b.w / 3), y: top + 0.3, z: b.z + fz * rr(-b.d / 4, b.d / 4), rot: b.rot + rr(-1, 1), pc });
      if (b.shop >= 0) {
        awn.push({ x: b.x + fx * (b.d / 2 + 0.6), y: b.base + 3.05, z: b.z + fz * (b.d / 2 + 0.6), rot: b.rot, w: b.w * 0.86, c: rpick(AWN), pc });
        hs.push({ x: b.x + fx * (b.d / 2 + 0.05), y: b.base + 3.9, z: b.z + fz * (b.d / 2 + 0.05), rot: b.rot, w: Math.min(b.w * 0.7, 6.5), tile: Math.floor(R() * 16), pc });
      }
      if (TH !== 'giza' && R() < (TH === 'paris' || TH === 'venice' ? 0.15 : TH === 'ny' ? 0.6 : 0.45) && b.floors >= 2) { const sd = R() < 0.5 ? -1 : 1; vs.push({ x: b.x + lx * sd * (b.w / 2 - 0.6) + fx * (b.d / 2 + 0.55), y: b.base + gh + 2.4, z: b.z + lz * sd * (b.w / 2 - 0.6) + fz * (b.d / 2 + 0.55), rot: b.rot + Math.PI / 2, tile: Math.floor(R() * 16), pc }); }
      if (TH !== 'paris' && TH !== 'venice' && R() < (TH === 'ny' ? 0.5 : 0.35)) tanks.push({ x: b.x + lx * rr(-b.w / 4, b.w / 4), y: top + 0.2, z: b.z - fx * 0 - fz * rr(0, b.d / 4), rot: R() * 6, pc });
      for (let k = 0; k < b.floors; k++) if ((JP || TH === 'ny') && R() < (JP ? 0.35 : 0.12)) { const u = rr(-b.w / 2 + 1, b.w / 2 - 1); acs.push({ x: b.x + lx * u + fx * (b.d / 2 + 0.3), y: b.base + gh + k * fh + 0.4, z: b.z + lz * u + fz * (b.d / 2 + 0.3), rot: b.rot, pc }); }
    });
    for (const m of [upper, ground]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
    const grey = toon({ color: 0x9a9ea2 });
    if (TH === 'paris') {
      inst(ST.mansardGeo(), toon({ color: 0x6a7886 }), caps, (d, c) => { d.position.set(c.x, c.y, c.z); d.rotation.y = c.rot; d.scale.set(c.w + 0.4, 3.2, c.d + 0.4); }, { outline: 0.03 });
      inst(ST.dormerGeo(), toon({ vertexColors: true }), dorms, (d, c) => { d.position.set(c.x, c.y, c.z); d.rotation.y = c.rot; }, { outline: 0.02 });
      inst(ST.chimneyGeo(), toon({ vertexColors: true }), chims, (d, c) => { d.position.set(c.x, c.y, c.z); d.rotation.y = c.rot; }, { outline: 0.02 });
    } else {
      if (chims.length) inst(ST.chimneyGeo(), toon({ vertexColors: true }), chims, (d, c) => { d.position.set(c.x, c.y, c.z); d.rotation.y = c.rot; d.scale.set(0.8, 1.3, 0.8); }, { outline: 0.02 });
      inst(new THREE.BoxGeometry(1, 0.4, 1), TH === 'venice' ? toon({ color: 0xb8604a }) : TH === 'giza' ? toon({ color: 0xc9a46a }) : grey, caps, (d, c) => { d.position.set(c.x, c.y + 0.2, c.z); d.rotation.y = c.rot; d.scale.set(c.w, TH === 'giza' ? 2 : 1, c.d); });
    }
    if (bills.length) { // NY の巨大広告（いつも光っている）
      const bt = ST.billboardAtlas();
      const bm = atlasify(toon({ map: bt, emissiveMap: bt, emissive: 0xffffff, emissiveIntensity: 1.0 }), 4, 2);
      const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.2), bm, bills.length), at = atlasAttr(m, bills.length);
      bills.forEach((c, i) => { d.position.set(c.x, c.y, c.z); d.rotation.set(0, c.rot, 0); d.scale.set(c.w, c.h, 1); d.updateMatrix(); m.setMatrixAt(i, d.matrix); addPart(c.pc, m, i, d.matrix); at.setXYZW(i, c.tile % 4, Math.floor(c.tile / 4), 1, 1); });
      add(m, false, false); W.billMat = { mat: bm, attr: atlasAttr };
    }
    if (dishes.length) inst(ST.dishGeo(), toon({ vertexColors: true }), dishes, (d, c) => { d.position.set(c.x, c.y, c.z); d.rotation.y = c.rot; }, { outline: 0.015 });
    inst(new THREE.BoxGeometry(1, 1, 1), toon({ color: 0x8c8780 }), founds, (d, c) => { d.position.set(c.x, c.h / 2 - 0.2, c.z); d.rotation.y = c.rot; d.scale.set(c.w, c.h + 0.4, c.d); });
    const aw = inst(new THREE.BoxGeometry(1, 0.08, 1.4), toon({ map: awningTex() }), awn, (d, c, i, m) => { d.position.set(c.x, c.y, c.z); d.rotation.set(0.38, c.rot, 0); d.scale.set(c.w, 1, 1); m.setColorAt(i, new THREE.Color(c.c)); }, { outline: 0.02 });
    const HS = JP ? signAtlas(false) : ST.themeSignAtlas(TH, false), VS = JP ? signAtlas(true) : ST.themeSignAtlas(TH, true);
    const hsMat = atlasify(toon({ map: HS.tex, emissiveMap: HS.tex, emissive: 0xffffff, emissiveIntensity: 0 }), HS.cols, HS.rows);
    const vsMat = atlasify(toon({ map: VS.tex, emissiveMap: VS.tex, emissive: 0xffffff, emissiveIntensity: 0, side: THREE.DoubleSide }), VS.cols, VS.rows);
    W.nightMats.push([hsMat, 0.45], [vsMat, TH === 'ny' ? 1.1 : 0.5]);
    const hsm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.95, 0.12), hsMat, hs.length), hsa = atlasAttr(hsm, hs.length);
    hs.forEach((c, i) => { d.position.set(c.x, c.y, c.z); d.rotation.set(0, c.rot, 0); d.scale.set(c.w, 1, 1); d.updateMatrix(); hsm.setMatrixAt(i, d.matrix); addPart(c.pc, hsm, i, d.matrix); hsa.setXYZW(i, c.tile % HS.cols, Math.floor(c.tile / HS.cols), 1, 1); });
    add(hsm); scene.add(withOutline(hsm, 0.02));
    const vsm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 3.0, 0.14), vsMat, vs.length), vsa = atlasAttr(vsm, vs.length);
    vs.forEach((c, i) => { d.position.set(c.x, c.y, c.z); d.rotation.set(0, c.rot, 0); d.scale.set(1, 1, 1); d.updateMatrix(); vsm.setMatrixAt(i, d.matrix); addPart(c.pc, vsm, i, d.matrix); vsa.setXYZW(i, c.tile % VS.cols, Math.floor(c.tile / VS.cols), 1, 1); });
    add(vsm); scene.add(withOutline(vsm, 0.02));
    const tankGeo = merge([col(cyl(0.7, 0.7, 1.3, 14, 0, 1.45, 0), 0xd9d4c4), col(cyl(0.72, 0.72, 0.1, 14, 0, 2.12, 0), 0x8a8f94), ...[[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].map(([x, z]) => col(box(0.08, 0.8, 0.08, x, 0.4, z), 0x5a5e62))]);
    inst(TH === 'ny' ? ST.waterTowerGeo() : tankGeo, toon({ vertexColors: true }), tanks, (d, c) => { d.position.set(c.x, c.y, c.z); d.rotation.y = c.rot; }, { outline: 0.02 });
    const acGeo = merge([col(box(0.85, 0.6, 0.32), 0xe8e8e2), col(T(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 14).rotateX(Math.PI / 2), -0.12, 0, 0.17), 0x55595e), col(box(0.9, 0.04, 0.36, 0, -0.32, 0), 0x777b80)]);
    inst(acGeo, toon({ vertexColors: true }), acs, (d, c) => { d.position.set(c.x, c.y, c.z); d.rotation.y = c.rot; }, { outline: 0.015 });
  }
  if (pyrs.length) {
    const proto = ST.pyramid(36, 23);
    for (const p of pyrs) { const m = proto.clone(); m.position.set(p.x, 0, p.z); m.rotation.y = p.rot; m.scale.set(p.B / 36, p.H / 23, p.B / 36); scene.add(m); }
  }
  // 町家
  {
    const n = machiya.length, d = new THREE.Object3D();
    const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mach, n), wa = atlasAttr(walls, n);
    const roofG = (() => {
      const p = [-.5, 0, .5, .5, 0, .5, .5, 1, 0, -.5, 0, .5, .5, 1, 0, -.5, 1, 0, .5, 0, -.5, -.5, 0, -.5, -.5, 1, 0, .5, 0, -.5, -.5, 1, 0, .5, 1, 0, .5, 0, .5, .5, 0, -.5, .5, 1, 0, -.5, 0, -.5, -.5, 0, .5, -.5, 1, 0];
      const uv = []; for (let i = 0; i < p.length; i += 3) uv.push(p[i] * 6 + 3, i < 36 ? Math.hypot(p[i + 1], p[i + 2]) * 4 : p[i + 1] * 4);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
    })();
    const kawara = toon({ map: roofTileTex(), side: THREE.DoubleSide });
    const roofs = [], eaves = [], fences = [], lamps = [];
    machiya.forEach((b, i) => {
      const pc = b.pc = piece('bld', b.x, b.base, b.z, b.d / 2, b.w, { w: b.w, d: b.d, rot: b.rot, col: [0x5a3a1c, 0xe8dcc0, 0x3a3a40, 0x8a6a4a] });
      d.rotation.set(0, b.rot, 0); d.position.set(b.x, b.base + b.h / 2 - 0.3, b.z); d.scale.set(b.w, b.h + 0.6, b.d); d.updateMatrix(); walls.setMatrixAt(i, d.matrix); addPart(pc, walls, i, d.matrix);
      wa.setXYZW(i, b.tile, 0, Math.max(1, Math.round(b.w / 4.5)), 1);
      roofs.push({ x: b.x, y: b.base + b.h, z: b.z, rot: b.rot, w: b.w + 0.7, h: rr(1.8, 2.5), d: b.d + 1.6, pc });
      const fx = Math.sin(b.rot), fz = Math.cos(b.rot);
      eaves.push({ x: b.x + fx * (b.d / 2 + 0.55), y: b.base + b.h * 0.5 + 0.15, z: b.z + fz * (b.d / 2 + 0.55), rot: b.rot, w: b.w + 0.3, pc });
      fences.push({ x: b.x + fx * (b.d / 2 + 0.25), y: b.base, z: b.z + fz * (b.d / 2 + 0.25), rot: b.rot, w: b.w * 0.8, pc });
      if (R() < 0.5) lamps.push({ x: b.x + fx * (b.d / 2 + 0.5) + fz * rr(-b.w / 3, b.w / 3), y: b.base + 2.6, z: b.z + fz * (b.d / 2 + 0.5) - fx * rr(-b.w / 3, b.w / 3), pc });
    });
    walls.castShadow = walls.receiveShadow = true; scene.add(walls);
    inst(roofG, kawara, roofs, (d, c) => { d.position.set(c.x, c.y, c.z); d.rotation.y = c.rot; d.scale.set(c.w, c.h, c.d); }, { outline: 0.03 });
    inst(new THREE.BoxGeometry(1, 0.14, 1.3), kawara, eaves, (d, c) => { d.position.set(c.x, c.y, c.z); d.rotation.set(0.32, c.rot, 0); d.scale.set(c.w, 1, 1); }, { outline: 0.02 });
    const fenceG = (() => { const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 1, true, 0, Math.PI); g.rotateZ(Math.PI / 2); g.scale(1, 0.9, 0.55); g.translate(0, 0, 0); return col(g, 0x5a3a1c); })();
    inst(fenceG, toon({ vertexColors: true, side: THREE.DoubleSide }), fences, (d, c) => { d.position.set(c.x, c.y, c.z); d.rotation.y = c.rot; d.scale.set(c.w, 1, 1); });
    W.lampSpots = lamps;
  }

  // ---------- 通りの設備: 電柱・ガードレール・街路樹・自販機・のぼり・植木 ----------
  const poles = [], rails = [], trees = [], vend = [], nobori = [], plants = [], wires = [], stoneLan = [], bamboo = [], toriis = [], walls2 = [], willow = [];
  const sidewalkPts = []; // 見物客を置かない所
  course.straights.forEach((st, j) => {
    const style = straightStyle(j);
    const P = {};
    const len = st.b - st.a;
    if ((!JP || style !== 'old') && style !== 'shrine') {
      // ガードレール（橋の上は朱塗りの欄干）
      for (let s = st.a + 7; s < st.b - 9; s += 2.4) {
        const onBridge = j === 0 && s > bridge[0] - 2 && s < bridge[1] + 2;
        for (const sd of [-1, 1]) rails.push({ s, sd, red: onBridge });
      }
      // 電柱（片側）と電線
      const side = j % 2 ? 1 : -1;
      let prev = null;
      for (let s = st.a + 12; s < st.b - 10; s += 26) {
        if (j === 0 && s > bridge[0] - 4 && s < bridge[1] + 4) { prev = null; continue; }
        sampleS(course, s, P); const h = heightS(course, s) + 0.16, lat = side * (8.3 + O);
        const x = P.x - P.tz * lat, z = P.z + P.tx * lat;
        poles.push({ x, y: h, z, rot: Math.atan2(P.tx, P.tz), pc: piece('small', x, h, z, 0.3, 0, { tall: 1, col: [0xb8b6b0, 0xf2c400] }) });
        sidewalkPts.push({ x, z, r: 1.2 });
        if (prev && JP) wires.push([prev, { x, y: h, z, tx: P.tx, tz: P.tz }]);
        prev = { x, y: h, z, tx: P.tx, tz: P.tz };
      }
      // 街路樹
      for (let s = st.a + 20; s < st.b - 14; s += rr(24, 34)) {
        if (j === 0 && s > bridge[0] - 6 && s < bridge[1] + 6) continue;
        const sd = R() < 0.5 ? -1 : 1; sampleS(course, s, P); const lat = sd * (8.25 + O);
        const x = P.x - P.tz * lat, z = P.z + P.tx * lat;
        if (poles.some(p => Math.hypot(p.x - x, p.z - z) < 4)) continue;
        trees.push({ x, y: heightS(course, s) + 0.16, z, rot: Math.atan2(-P.tz * sd, P.tx * sd), k: Math.floor(R() * 3), sc: rr(0.9, 1.15), pc: piece('small', x, heightS(course, s) + 0.16, z, 0.5, 0, { tall: 1, col: [0x4f8f35, 0x63a840, 0x6b4a2e] }) });
        sidewalkPts.push({ x, z, r: 1.4 });
      }
      // 自販機（建物の前）
      for (let s = st.a + 15; s < st.b - 12; s += rr(30, 55)) {
        const sd = R() < 0.5 ? -1 : 1; sampleS(course, s, P); const lat = sd * (8.75 + O);
        const x = P.x - P.tz * lat, z = P.z + P.tx * lat;
        if (j === 0 && s > bridge[0] - 6 && s < bridge[1] + 6) continue;
        vend.push({ x, y: heightS(course, s) + 0.16, z, rot: Math.atan2(P.tz * sd, -P.tx * sd), k: Math.floor(R() * 2), pc: piece('small', x, heightS(course, s) + 0.16, z, 0.4, 0, { stick: 1, col: [0xd8231b, 0xf4f4f4, 0x2a6fd8] }) });
        sidewalkPts.push({ x, z, r: 1.0 });
      }
    }
    if (style === 'old' || style === 'start') {
      for (let s = st.a + 10; s < st.b - 10; s += rr(14, 22)) {
        if (j === 0 && s > bridge[0] - 4 && s < bridge[1] + 4) continue;
        const sd = R() < 0.5 ? -1 : 1; sampleS(course, s, P); const lat = sd * ((style === 'old' ? 8.2 : 8.6) + O);
        plants.push({ x: P.x - P.tz * lat, y: heightS(course, s) + 0.16, z: P.z + P.tx * lat, k: R(), pc: piece('small', P.x - P.tz * lat, heightS(course, s) + 0.16, P.z + P.tx * lat, 0.3, 0, { stick: 1, col: [0x9a5a3a, 0x4f8f35] }) });
      }
    }
    // のぼり旗
    if (style !== 'old') {
      for (let s = st.a + 9; s < st.b - 9; s += 15) {
        if (j === 0 && s > bridge[0] - 3 && s < bridge[1] + 3) continue;
        for (const sd of [-1, 1]) { if (R() < 0.45) continue; sampleS(course, s + sd * 3, P); const lat = sd * ((style === 'shrine' ? 7.9 : 7.7) + O); nobori.push({ x: P.x - P.tz * lat, y: heightS(course, s + sd * 3) + 0.16, z: P.z + P.tx * lat, rot: Math.atan2(P.tx, P.tz) + Math.PI / 2, tile: style === 'shrine' ? 1 + Math.floor(R() * 2) : Math.floor(R() * 4), pc: piece('small', P.x - P.tz * lat, heightS(course, s + sd * 3) + 0.16, P.z + P.tx * lat, 0.1, 0, { stick: 1, col: [0xd8401f, 0xf4efe2] }) }); sidewalkPts.push({ x: P.x - P.tz * lat, z: P.z + P.tx * lat, r: 0.6 }); }
      }
    }
    // 参道: 石灯籠・竹林・玉垣・千本鳥居
    if (style === 'shrine') {
      for (let s = st.a + 8; s < st.b - 8; s += 10) for (const sd of [-1, 1]) {
        sampleS(course, s, P); const lat = sd * (7.95 + O);
        stoneLan.push({ x: P.x - P.tz * lat, y: heightS(course, s) + 0.16, z: P.z + P.tx * lat, rot: Math.atan2(P.tx, P.tz), pc: piece('small', P.x - P.tz * lat, heightS(course, s) + 0.16, P.z + P.tx * lat, 0.45, 0, { stick: 1, col: [0x9d978a, 0xb1ab9c] }) });
        sidewalkPts.push({ x: P.x - P.tz * lat, z: P.z + P.tx * lat, r: 1.0 });
      }
      if (JP || TH === 'giza') for (let s = st.a + 4; s < st.b - 4; s += 3) for (const sd of [-1, 1]) {
        sampleS(course, s, P); const lat = sd * (9.4 + O);
        walls2.push({ x: P.x - P.tz * lat, y: heightS(course, s), z: P.z + P.tx * lat, rot: Math.atan2(P.tx, P.tz), s, pc: piece('small', P.x - P.tz * lat, heightS(course, s), P.z + P.tx * lat, 0.2, 3, { col: [0xb7b1a2, 0x9d978a] }) });
        for (let k = 0; k < (JP ? 3 : 1); k++) { const l2 = sd * rr(11 + O, 26 + O); const bx = P.x - P.tz * l2 + rr(-1.5, 1.5), bz = P.z + P.tx * l2 + rr(-1.5, 1.5); bamboo.push({ x: bx, y: heightS(course, s) - 0.5, z: bz, h: rr(9, 14), lean: rr(-0.08, 0.08), rot: R() * 6, pc: piece('small', bx, heightS(course, s) - 0.5, bz, 0.2, 0, { tall: 1, col: [0x6aa84f, 0x84c25a] }) }); }
      }
      const [t0, t1] = course.prof.torii;
      const GATE = { jp: ['鳥居', 3000], ny: ['鉄骨の門', 8000], giza: ['神殿の門', 20000] }[TH];
      if (GATE) for (let s = t0 + (JP ? 0 : 5.2); s < t1; s += JP ? 5.2 : 10.4) { sampleS(course, s, P); toriis.push({ x: P.x, y: heightS(course, s), z: P.z, rot: Math.atan2(P.tx, P.tz), big: JP && s === t0, pc: JP && s === t0 ? null : spanPiece('torii', s, P.x, heightS(course, s), P.z, { name: GATE[0], kg: GATE[1] }) }); }
    }
  });
  // ベネチア: 水路をまたぐ石のアーチ橋（下をくぐる）
  if (TH === 'venice') {
    const P = {}, br = course.prof.bridge;
    course.straights.forEach((st, j) => {
      for (let s = st.a + 26; s < st.b - 18; s += 58) {
        if ((j === 0 && s > br[0] - 16 && s < br[1] + 16) || Math.abs(s - 40) < 14 || course.prof.kick.some(q => Math.abs(s - q.s) < 14) || Math.abs(s - course.prof.jumpS) < 24) continue;
        sampleS(course, s, P);
        toriis.push({ x: P.x, y: heightS(course, s), z: P.z, rot: Math.atan2(P.tx, P.tz), big: false, pc: spanPiece('torii', s, P.x, heightS(course, s), P.z, { name: '石の橋', kg: 40000 }) });
      }
    });
  }
  // 橋のたもとの柳
  for (const [s, sd] of [[bridge[0] - 4, -1], [bridge[0] - 4, 1], [bridge[1] + 4, -1], [bridge[1] + 4, 1]]) { const P = sampleS(course, s, {}); const lat = sd * (9.5 + O); if (TH !== 'ny' && TH !== 'venice') willow.push({ x: P.x - P.tz * lat, y: 0, z: P.z + P.tx * lat }); }

  const vc = toon({ vertexColors: true });
  // ガードレール
  {
    const P = {}, Q = {};
    const geo = merge([col(cyl(0.045, 0.045, 0.85, 6, -1.2, 0.42, 0), 0xffffff), col(T(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6).rotateZ(Math.PI / 2), 0, 0.82, 0), 0xffffff), col(T(new THREE.CylinderGeometry(0.035, 0.035, 2.4, 6).rotateZ(Math.PI / 2), 0, 0.5, 0), 0xffffff)]);
    const orange = rails.filter(r => !r.red), red = rails.filter(r => r.red);
    const setup = (d, r) => {
      sampleS(course, r.s, P); sampleS(course, r.s + 2.4, Q);
      const lat = r.sd * (WALL + 0.25);
      const x0 = P.x - P.tz * lat, z0 = P.z + P.tx * lat, x1 = Q.x - Q.tz * lat, z1 = Q.z + Q.tx * lat;
      const h0 = heightS(course, r.s) + 0.16, h1 = heightS(course, r.s + 2.4) + 0.16;
      d.position.set((x0 + x1) / 2, (h0 + h1) / 2, (z0 + z1) / 2);
      if (!r.pc) r.pc = piece('small', (x0 + x1) / 2, (h0 + h1) / 2, (z0 + z1) / 2, 0, 2.4, { name: r.red ? '欄干' : 'ガードレール', kg: 80, col: r.red ? [0xd13a1f, 0xf0bc3c] : [0xf08a1c, 0xd0d0d0] });
      d.rotation.set(0, Math.atan2(-(z1 - z0), x1 - x0), Math.atan2(h1 - h0, Math.hypot(x1 - x0, z1 - z0)), 'YZX');
    };
    inst(geo, toon({ color: { jp: 0xf08a1c, paris: 0x1c1c22, ny: 0x8a9098, giza: 0xc9a46a, venice: 0xf0ece0 }[TH] }), orange, setup, { outline: 0.012 });
    const redGeo = merge([col(cyl(0.09, 0.09, 1.05, 8, -1.2, 0.52, 0), 0xffffff), col(T(new THREE.BoxGeometry(2.4, 0.12, 0.14), 0, 1.02, 0), 0xffffff), col(T(new THREE.BoxGeometry(2.4, 0.08, 0.08), 0, 0.55, 0), 0xffffff), col(sph2(0.12, -1.2, 1.12, 0), 0xf0bc3c)]);
    inst(redGeo, toon({ color: { jp: 0xd13a1f, paris: 0x2a2a30, ny: 0x8a9098, giza: 0xc9a46a, venice: 0xf0ece0 }[TH] }), red, setup, { outline: 0.015 });
  }
  function sph2(r, x, y, z) { return T(new THREE.SphereGeometry(r, 8, 6), x, y, z); }
  // 電柱
  const poleGeo = merge([
    col(cyl(0.13, 0.18, 10.5, 10, 0, 5.25, 0), 0xb8b6b0), col(cyl(0.2, 0.2, 1.6, 10, 0, 0.8, 0), 0xf2c400),
    ...[0.2, 0.6, 1.0, 1.4].map(y => col(cyl(0.205, 0.205, 0.18, 10, 0, y, 0), 0x1a1a1a)),
    col(box(1.9, 0.12, 0.12, 0, 9.6, 0), 0x6d6d6d), col(box(1.3, 0.1, 0.1, 0, 8.9, 0), 0x6d6d6d),
    ...[-0.8, 0, 0.8].map(x => col(cyl(0.05, 0.06, 0.18, 6, x, 9.75, 0), 0xf4f4f4)),
    col(cyl(0.32, 0.32, 0.95, 12, 0.5, 7.7, 0), 0x9aa0a4), col(cyl(0.34, 0.34, 0.08, 12, 0.5, 8.2, 0), 0x6d7276),
  ]);
  inst(JP ? poleGeo : TH === 'paris' || TH === 'venice' ? ST.parisLampGeo() : TH === 'ny' ? ST.nyLightGeo() : ST.palmGeo(1), vc, poles, (d, p) => { d.position.set(p.x, p.y, p.z); d.rotation.y = p.rot + (TH === 'ny' ? (p.x * 7 % 1 > 0.5 ? Math.PI / 2 : -Math.PI / 2) : 0); }, { outline: 0.02 });
  {
    const pts = [];
    for (const [a, b] of wires) for (const off of [-0.8, 0, 0.8]) {
      const ax = a.x + (-a.tz) * 0 + a.tz * 0, n = 10;
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n;
        const p = t => { const x = a.x + (b.x - a.x) * t + off * Math.cos(Math.atan2(a.tx, a.tz)), z = a.z + (b.z - a.z) * t - off * Math.sin(Math.atan2(a.tx, a.tz)); const y = a.y + (b.y - a.y) * t + 9.75 - Math.sin(Math.PI * t) * 0.6; return [x, y, z]; };
        pts.push(...p(t0), ...p(t1));
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x1b1b1f })));
  }
  // 街路樹（3 種）
  const treeGeos = [0, 1, 2].map(k => {
    const parts = [col(cyl(0.18, 0.28, 4.2, 8, 0, 2.1, 0), 0x6b4a2e), col(T(new THREE.CylinderGeometry(0.1, 0.14, 2.2, 6).rotateZ(0.7), -0.7, 4.4, 0), 0x6b4a2e), col(T(new THREE.CylinderGeometry(0.1, 0.14, 2.2, 6).rotateZ(-0.6), 0.7, 4.6, 0.3), 0x6b4a2e)];
    const greens = [0x4f8f35, 0x63a840, 0x3f7a2c, 0x78b84a];
    const n = 7 + k * 2;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + k, r = 1.4 + (i % 3) * 0.5;
      parts.push(col(blob(1.5 + (i % 2) * 0.5, Math.cos(a) * r, 5.6 + Math.sin(i * 1.7) * 0.9 + (i % 3) * 0.4, Math.sin(a) * r * 0.9 + 0.6), greens[(i + k) % 4]));
    }
    parts.push(col(blob(2.0, 0, 6.8, 0.4), greens[(k + 1) % 4]));
    return merge(parts);
  });
  [0, 1, 2].forEach(k => inst(TH === 'paris' || TH === 'venice' ? ST.platanGeo(k) : TH === 'giza' ? ST.palmGeo(k) : treeGeos[k], vc, trees.filter(t => t.k === k), (d, t) => { d.position.set(t.x, t.y, t.z); d.rotation.y = t.rot; d.scale.setScalar(t.sc); }, { outline: 0.03 }));
  // 柳
  {
    const parts = [col(cyl(0.22, 0.35, 4, 8, 0, 2, 0), 0x5a4a32)];
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; parts.push(col(T(new THREE.ConeGeometry(0.9, 4.2, 6).rotateX(Math.PI), Math.cos(a) * 1.6, 3.6, Math.sin(a) * 1.6), i % 2 ? 0x8fbf5a : 0x7aae48)); }
    parts.push(col(blob(1.9, 0, 5.6, 0), 0x8fbf5a));
    inst(TH === 'giza' ? ST.palmGeo(2) : merge(parts), vc, willow, (d, t) => { d.position.set(t.x, t.y, t.z); }, { outline: 0.03 });
  }
  // 自販機（2 種）。よそのステージでは広告塔・消火栓・つぼ
  if (!JP) {
    if (TH === 'paris') { const mc = ST.morrisGeo(); const g = merge([mc.geo, col(mc.body.geometry.clone(), 0x3a6a4a)]); inst(g, vc, vend, (d, v) => { d.position.set(v.x, v.y, v.z); d.rotation.y = v.rot; }, { outline: 0.02 }); }
    else inst(TH === 'ny' ? ST.hydrantGeo() : TH === 'venice' ? ST.palinaGeo() : ST.THEME_PROPS.pot.geo(), vc, vend, (d, v) => { d.position.set(v.x, v.y, v.z); d.rotation.y = v.rot; d.scale.setScalar(TH === 'ny' ? 1.3 : TH === 'venice' ? 1 : 1.6); }, { outline: 0.02 });
  } else [[0xd8231b, 0xf4f4f4], [0xf4f4f4, 0x2a6fd8]].forEach(([a, b], k) => {
    const g = merge([col(box(1.0, 1.85, 0.75, 0, 0.93, 0), a), col(box(0.86, 0.95, 0.05, 0, 1.3, 0.38), 0xe9f3f8),
      ...[0, 1, 2].flatMap(r => [0, 1, 2, 3, 4].map(c => col(box(0.12, 0.22, 0.04, -0.34 + c * 0.17, 1.02 + r * 0.3, 0.41), [0xd84a3a, 0x3a8ad8, 0xf2c14e, 0x4ab86a, 0x8a4a2a][(c + r) % 5]))),
      col(box(0.86, 0.32, 0.05, 0, 0.45, 0.38), b), col(box(0.5, 0.12, 0.06, 0, 0.2, 0.39), 0x222222)]);
    inst(g, vc, vend.filter(v => v.k === k), (d, v) => { d.position.set(v.x, v.y, v.z); d.rotation.y = v.rot; }, { outline: 0.02 });
  });
  // 植木鉢
  inst(merge([col(cyl(0.32, 0.24, 0.5, 10, 0, 0.25, 0), 0x9a5a3a), col(blob(0.42, 0, 0.75, 0), 0x4f8f35), col(blob(0.3, 0.2, 0.95, 0.1), 0x63a840)]), vc, plants, (d, p) => { d.position.set(p.x, p.y, p.z); d.scale.setScalar(0.8 + p.k * 0.5); }, { outline: 0.02 });
  // のぼり
  {
    const na = JP ? noboriAtlas() : ST.themeBannerAtlas(TH);
    const g = new THREE.PlaneGeometry(0.75, 2.6, 1, 6); g.translate(0.4, 3.1, 0);
    const mat = atlasify(toon({ map: na, side: THREE.DoubleSide }), 4, 1);
    const m = new THREE.InstancedMesh(g, mat, nobori.length), at = atlasAttr(m, nobori.length);
    const d = new THREE.Object3D();
    nobori.forEach((n, i) => { d.position.set(n.x, n.y, n.z); d.rotation.set(0, n.rot, 0); d.updateMatrix(); m.setMatrixAt(i, d.matrix); addPart(n.pc, m, i, d.matrix); at.setXYZW(i, n.tile, 0, 1, 1); });
    add(m);
    const pg = merge([col(cyl(0.03, 0.035, 4.6, 6, 0, 2.3, 0), 0x2a2a2a), col(T(new THREE.CylinderGeometry(0.02, 0.02, 0.85, 5).rotateZ(Math.PI / 2), 0.42, 4.42, 0), 0x2a2a2a)]);
    inst(pg, vc, nobori, (d, n) => { d.position.set(n.x, n.y, n.z); d.rotation.y = n.rot; });
  }
  // 石灯籠
  {
    const g = merge([col(box(0.9, 0.3, 0.9, 0, 0.15, 0), 0x9d978a), col(cyl(0.16, 0.2, 1.2, 8, 0, 0.9, 0), 0xa8a294), col(box(0.75, 0.15, 0.75, 0, 1.55, 0), 0x9d978a),
      col(box(0.55, 0.5, 0.55, 0, 1.88, 0), 0xb1ab9c), col(box(0.32, 0.26, 0.6, 0, 1.9, 0), 0xffd27a), col(box(0.6, 0.26, 0.32, 0, 1.9, 0), 0xffd27a),
      col(T(new THREE.ConeGeometry(0.62, 0.42, 4).rotateY(Math.PI / 4), 0, 2.35, 0), 0x8c8678), col(new THREE.SphereGeometry(0.1, 8, 6).translate(0, 2.62, 0), 0x8c8678)]);
    const m = inst(JP ? g : TH === 'paris' || TH === 'venice' ? ST.parisLampGeo() : TH === 'ny' ? ST.nyLightGeo() : ST.sphinxSmallGeo(), toon({ vertexColors: true, emissive: 0x000000 }), stoneLan, (d, p) => { d.position.set(p.x, p.y, p.z); d.rotation.y = p.rot; }, { outline: 0.02 });
    if (m) W.stoneLanMat = m.material;
  }
  // 玉垣（低い石の塀）
  inst(merge([col(box(3.0, 0.9, 0.35, 0, 0.45, 0), JP ? 0xb7b1a2 : 0xd8b884), col(box(3.1, 0.12, 0.45, 0, 0.95, 0), JP ? 0x9d978a : 0xb8945a)]), vc, walls2, (d, p) => { d.position.set(p.x, p.y, p.z); d.rotation.y = p.rot + Math.PI / 2; });
  // 竹林
  {
    const parts = [col(cyl(0.07, 0.09, 1, 6, 0, 0.5, 0), 0x6aa84f)];
    for (let k = 1; k < 10; k++) parts.push(col(cyl(0.095, 0.095, 0.04, 6, 0, k * 0.1, 0), 0x4f8a3a));
    const stalk = merge(parts);
    if (TH === 'giza') inst(ST.palmGeo(0), vc, bamboo, (d, b) => { d.position.set(b.x, b.y + 0.5, b.z); d.rotation.y = b.rot; d.scale.setScalar(b.h / 11); }, { outline: 0.03 });
    else inst(stalk, toon({ vertexColors: true }), bamboo, (d, b) => { d.position.set(b.x, b.y, b.z); d.rotation.set(b.lean, b.rot, 0); d.scale.set(1, b.h, 1); }, { shadow: false });
    const leaf = merge([col(blob(1.4, 0, 0, 0), 0x6fae4a), col(blob(1.1, 0.9, -0.4, 0.3), 0x84c25a), col(blob(1.0, -0.8, -0.2, -0.4), 0x5b9a3e)]);
    if (JP) inst(leaf, vc, bamboo.filter((_, i) => i % 2 === 0), (d, b) => { d.position.set(b.x + Math.sin(b.lean) * b.h, b.y + b.h - 0.6, b.z); d.rotation.y = b.rot; d.scale.set(1.2, 1.6, 1.2); }, { shadow: false });
  }
  // 千本鳥居
  {
    const red = 0xd8401f, black = 0x1e1a18, TP = WALL + 0.7;
    const g = !JP ? ST.spanGateGeo(TH, TP) : merge([
      col(cyl(0.36, 0.42, 7.2, 12, -TP, 3.6, 0), red), col(cyl(0.36, 0.42, 7.2, 12, TP, 3.6, 0), red),
      col(cyl(0.48, 0.5, 0.5, 12, -TP, 0.25, 0), black), col(cyl(0.48, 0.5, 0.5, 12, TP, 0.25, 0), black),
      col(box(TP * 2 + 1.8, 0.45, 0.5, 0, 5.9, 0), red),
      col(box(TP * 2 + 3.6, 0.42, 0.75, 0, 7.15, 0), red), col(box(TP * 2 + 4.2, 0.32, 0.9, 0, 7.5, 0), black),
      col(T(new THREE.BoxGeometry(1.2, 0.3, 0.9).rotateZ(0.18), -TP - 2.2, 7.65, 0), black), col(T(new THREE.BoxGeometry(1.2, 0.3, 0.9).rotateZ(-0.18), TP + 2.2, 7.65, 0), black),
      col(box(0.4, 1.2, 0.4, 0, 6.5, 0), red),
    ]);
    inst(g, toon({ vertexColors: true }), toriis, (d, t) => { d.position.set(t.x, t.y, t.z); d.rotation.y = t.rot; d.scale.setScalar(t.big ? 1.12 : 1); }, { outline: 0.035 });
    const big = toriis.find(t => t.big);
    if (big) {
      const grp = new THREE.Group(); grp.position.set(big.x, big.y, big.z); grp.rotation.y = big.rot; grp.scale.setScalar(1.12); scene.add(grp);
      const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([-1, -0.5, 0, 0.5, 1].map(f => new THREE.Vector3(f * (TP - 0.2), 5.55 - Math.cos(f * Math.PI / 2) * 0.5, 0.3))), 40, 0.16, 8), toon({ color: 0xd9c08a }));
      grp.add(rope);
      const sg = shideGeo(1.1);
      for (const x of [-6.6, -2.2, 2.2, 6.6]) { const m = new THREE.Mesh(sg, toon({ color: 0xffffff, side: THREE.DoubleSide })); m.position.set(x, 5.1 - Math.cos(x / (TP - 0.2) * Math.PI / 2) * 0.5, 0.35); grp.add(m); }
      const plaque = canvasTex(128, 256, (c, w, h) => { c.fillStyle = '#1e1a18'; c.fillRect(0, 0, w, h); c.strokeStyle = '#f0bc3c'; c.lineWidth = 8; c.strokeRect(8, 8, w - 16, h - 16); c.fillStyle = '#f0bc3c'; c.font = "bold 80px 'Zen Old Mincho', serif"; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('地', w / 2, 80); c.fillText('車', w / 2, 175); });
      const pm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.12), toon({ map: plaque })); pm.position.set(0, 6.5, 0.28); grp.add(pm);
    }
  }

  // ---------- 提灯の飾り（通りを横切る） ----------
  {
    // 吊り物: 日本は提灯、パリは電球、NY は信号機、ギザは色ガラスのランタン
    const lanTex = TH === 'giza' ? ST.hangTex('giza') : lanternTex();
    const lanMat = TH === 'venice' ? toon({ color: 0xffffff }) : TH === 'paris' ? toon({ vertexColors: true, emissive: 0xffd890, emissiveIntensity: 0.5 }) : TH === 'ny' ? toon({ vertexColors: true })
      : toon({ map: lanTex, emissiveMap: lanTex, emissive: 0xffffff, emissiveIntensity: 0.1 });
    W.nightMats.push([lanMat, TH === 'paris' ? 1.2 : TH === 'ny' ? 0 : 0.9]);
    const HANG = { jp: ['提灯', 1.5], paris: ['電球', 0.2], ny: ['信号機', 40], giza: ['ランタン', 2], venice: ['洗濯物', 1] }[TH];
    const lanGeo = ST.hangGeo(TH) || (() => { const g = new THREE.CylinderGeometry(0.3, 0.3, 0.62, 14, 4); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 0.31, k = 1 + 0.2 * (1 - y * y); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } g.computeVertexNormals(); return g; })();
    const list = [], wireList = [];
    course.straights.forEach((st, j) => {
      const P = {};
      for (let s = st.a + 14; s < st.b - 10; s += 20) {
        if (j === 0 && s > bridge[0] - 3 && s < bridge[1] + 3) continue;
        sampleS(course, s, P); const h = heightS(course, s);
        const rx = -P.tz, rz = P.tx;
        const wp = spanPiece('wire', s, P.x, h + 7.6, P.z);
        wireList.push({ x: P.x, y: h + 7.6, z: P.z, rot: Math.atan2(rx, rz), pc: wp });
        for (let k = 0; k < 9; k++) { const off = -9.6 + k * 2.4, y = h + 7.0 - Math.cos(off / 9.6 * 1.3) * 0.35; const lp = spanPiece('lan', s, P.x + rx * off, y, P.z + rz * off, { name: HANG[0], kg: HANG[1], off, wire: wp, col: [0xf4efe2, 0xd8231b] }); (wp.lans ||= []).push(lp); list.push({ x: P.x + rx * off, y, z: P.z + rz * off, rot: Math.atan2(P.tx, P.tz), pc: lp }); }
      }
    });
    const LAUNDRY = [0xf4f4f4, 0x7aa6d8, 0xe88c8c, 0xf0d070, 0x8ac87a, 0xffffff, 0xc87ab8];
    inst(lanGeo, lanMat, list, (d, l, i, m) => { d.position.set(l.x, l.y - (TH === 'ny' ? 0.5 : 0), l.z); d.rotation.y = JP || TH === 'giza' ? Math.atan2(l.x, l.z) : l.rot + (TH === 'venice' ? Math.PI / 2 : 0); if (TH === 'venice') m.setColorAt(i, new THREE.Color(LAUNDRY[i % LAUNDRY.length])); }, { shadow: false, outline: TH === 'ny' || TH === 'venice' ? 0.02 : 0 });
    inst(new THREE.BoxGeometry(0.04, 0.04, 1), toon({ color: 0x1b1410 }), wireList, (d, w) => { d.position.set(w.x, w.y, w.z); d.rotation.y = w.rot; d.scale.set(1, 1, HALF_W * 2 + 3); }, { shadow: false });
    // 町家の軒先の提灯
    if (W.lampSpots) inst(lanGeo, lanMat, W.lampSpots, (d, l) => { d.position.set(l.x, l.y, l.z); d.scale.setScalar(0.85); }, { shadow: false });
    W.lanMat = lanMat;
  }

  // ---------- 運河と橋のたもと ----------
  {
    const mid = sampleS(course, (bridge[0] + bridge[1]) / 2, {});
    const wt = waterTex(); wt.repeat.set(2, 18);
    const water = add(new THREE.Mesh(new THREE.PlaneGeometry(12, 150).rotateX(-Math.PI / 2), toon({ map: wt, color: 0xcfe8f0, transparent: true, opacity: 0.95 })), false, true);
    water.position.set(mid.x, 0.04, mid.z);
    W.water = wt;
    for (const sd of [-1, 1]) {
      const bank = add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 150), toon({ map: stoneTex('#b0a894', '#857d6c') })));
      bank.position.set(mid.x + sd * 6.5, 0.25, mid.z);
    }
  }

  // ---------- 名所（日本はお城・五重塔・拝殿） ----------
  if (JP) {
    // 日本の名所: 富士山・タワー・大仏・金閣・大提灯の門・水に立つ大鳥居
    // （富士山・タワー・大仏・金閣・水の大鳥居は用意済み。まずは雷門だけ）
    const MORE_JP = false;
    if (MORE_JP) {
      { const f = ST.fuji(); f.position.set(-260, -12, 720); scene.add(f); }
      { const tw = ST.tower(false); tw.position.set(268, 0, 132); scene.add(tw); }
      { const db = ST.daibutsu(); db.position.set(-118, 0, 52); db.rotation.y = Math.PI / 2; scene.add(db); }
      { const kk = ST.kinkaku(); kk.position.set(70, 0, -78); scene.add(kk); }
    }
    { const P = sampleS(course, 182, {}), lan = lanternTex('雷'); const gate = ST.kaminarimon(WALL + 0.8, lan); gate.position.set(P.x, heightS(course, 182), P.z); gate.rotation.y = Math.atan2(P.tx, P.tz); scene.add(gate); W.nightMats.push([gate.userData.lantern.material, 0.9]);
      // 大提灯と門そのもの: ひっつけた物で届く高さが伸びていれば持っていける
      W.bigObjs = [{ kind: 'gateobj', name: '雷門', kg: 120000, s: 182, need: 11, obj: gate, sc: 0.2, st: 0 }, { kind: 'gateobj', name: '雷門の大提灯', kg: 300, s: 182, need: 7.5, obj: gate.userData.lantern, sc: 0.55, st: 0 }]; }
    if (MORE_JP) {
      const mid = sampleS(course, (bridge[0] + bridge[1]) / 2, {}), red = 0xd8401f, black = 0x1e1a18, TP = 9;
      const g = merge([col(cyl(0.7, 0.8, 14, 12, -TP, 7, 0), red), col(cyl(0.7, 0.8, 14, 12, TP, 7, 0), red), col(box(TP * 2 + 3, 0.9, 1.0, 0, 11.4, 0), red), col(box(TP * 2 + 6, 0.8, 1.4, 0, 13.6, 0), red), col(box(TP * 2 + 7, 0.6, 1.7, 0, 14.3, 0), black), col(box(0.8, 2.2, 0.8, 0, 12.6, 0), red)]);
      const ot = new THREE.Mesh(g, toon({ vertexColors: true })); ot.position.set(mid.x, -1, mid.z + 48); ot.rotation.y = Math.atan2(mid.tx, mid.tz) * 0; scene.add(ot); withOutline(ot, 0.06);
    }
    const white = toon({ color: 0xf4f0e6 }), stone = toon({ map: stoneTex('#b3ab98', '#8a8270') }), roofC = toon({ color: 0x3f4f5a, side: THREE.DoubleSide }), gold = toon({ color: 0xf0bc3c, emissive: 0x3a2400 }), dark = toon({ color: 0x2a2a2e });
    const castle = new THREE.Group(); castle.position.set(CASTLE.x, 0, CASTLE.z); scene.add(castle);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(15, 20, 10, 4, 3).rotateY(Math.PI / 4), stone); base.position.y = 5; castle.add(base);
    let y = 10;
    [[18, 5.5], [14, 5], [10, 4.6]].forEach(([s, h], k) => {
      const wb = new THREE.Mesh(new THREE.BoxGeometry(s, h, s * 0.8), white); wb.position.y = y + h / 2; castle.add(wb);
      const band = new THREE.Mesh(new THREE.BoxGeometry(s + 0.05, 0.9, s * 0.8 + 0.05), dark); band.position.y = y + h * 0.45; castle.add(band);
      const rf = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.45, s * 0.86, 2.6, 4, 1).rotateY(Math.PI / 4), roofC); rf.scale.set(1, 1, 0.82); rf.position.y = y + h + 1.3; castle.add(rf);
      for (const sz of [-1, 1]) { // 千鳥破風
        const gb = new THREE.Mesh(new THREE.ConeGeometry(s * 0.22, 2.0, 3).rotateY(Math.PI / 2 * sz), roofC); gb.rotation.x = 0; gb.position.set(0, y + h + 1.2, sz * s * 0.36); gb.scale.set(1.6, 1, 0.6); castle.add(gb);
      }
      y += h + 2.6;
    });
    for (const sx of [-1, 1]) { const sh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6, 0.5), gold); sh.position.set(sx * 2.4, y + 0.5, 0); castle.add(sh); }
    const outlineAll = (g, th) => { const ms = []; g.traverse(o => { if (o.isMesh) ms.push(o); }); ms.forEach(o => { o.castShadow = true; o.receiveShadow = true; withOutline(o, th); }); };
    outlineAll(castle, 0.12);
    // 五重塔
    const pagoda = new THREE.Group(); pagoda.position.set(PAGODA.x, 0, PAGODA.z); scene.add(pagoda);
    const wood = toon({ color: 0x8a3a24 }); y = 0;
    const pbase = new THREE.Mesh(new THREE.BoxGeometry(9, 1.2, 9), stone); pbase.position.y = 0.6; pagoda.add(pbase);
    y = 1.2;
    for (let k = 0; k < 5; k++) {
      const s = 6.2 - k * 0.7, h = 3.0 - k * 0.15;
      const b = new THREE.Mesh(new THREE.BoxGeometry(s, h, s), wood); b.position.y = y + h / 2; pagoda.add(b);
      const rf = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.55, s * 1.05, 1.0, 4, 1).rotateY(Math.PI / 4), roofC); rf.position.y = y + h + 0.5; pagoda.add(rf);
      y += h + 1.0;
    }
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 7, 8), gold); spire.position.y = y + 3.5; pagoda.add(spire);
    for (let k = 0; k < 9; k++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 6, 16).rotateX(Math.PI / 2), gold); ring.position.y = y + 1 + k * 0.5; pagoda.add(ring); }
    outlineAll(pagoda, 0.08);
    // 拝殿
    const hall = new THREE.Group(); hall.position.set(HALL.x, 0, HALL.z); hall.rotation.y = Math.PI / 2; scene.add(hall);
    const hb = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 11), wood); hb.position.y = 4; hall.add(hb);
    const hbase = new THREE.Mesh(new THREE.BoxGeometry(18, 1, 13), stone); hbase.position.y = 0.5; hall.add(hbase);
    const hr = new THREE.Mesh(new THREE.CylinderGeometry(4, 13, 5, 4, 1).rotateY(Math.PI / 4), roofC); hr.scale.set(1.3, 1, 0.95); hr.position.y = 9.5; hall.add(hr);
    outlineAll(hall, 0.08);
    // 城の松
    const pine = merge([col(cyl(0.25, 0.4, 5, 7, 0, 2.5, 0), 0x5a4030), col(blob(2.2, 0.6, 5.5, 0), 0x2f6a3a), col(blob(1.8, -1.2, 4.6, 0.6), 0x3a7a42), col(blob(1.5, 0.4, 7.0, -0.4), 0x2f6a3a)]);
    const pines = []; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; pines.push({ x: CASTLE.x + Math.cos(a) * rr(23, 27), z: CASTLE.z + Math.sin(a) * rr(23, 27), rot: R() * 6, s: rr(0.9, 1.3) }); }
    inst(pine, vc, pines, (d, p) => { d.position.set(p.x, 0, p.z); d.rotation.y = p.rot; d.scale.setScalar(p.s); }, { outline: 0.05 });
  } else {
    const at = (o, p, ry = 0) => { o.position.set(p.x, 0, p.z); o.rotation.y = ry; scene.add(o); return o; };
    const [t0] = course.prof.torii, G = sampleS(course, t0, {});
    if (TH === 'paris') {
      at(ST.eiffel(), CASTLE, 0.3);
      W.carousel = at(ST.carousel(), PAGODA);
      at(ST.louvrePyramid(), HALL, 0.2);
      // 凱旋門: 参道の入口で道がまん中をくぐる。坂に埋めて据える
      const arc = ST.arcDeTriomphe((WALL + 2.4) * 2);
      arc.position.set(G.x, Math.min(heightS(course, t0 - 12), heightS(course, t0 + 12)) - 0.6, G.z); arc.rotation.y = Math.atan2(G.tx, G.tz); scene.add(arc);
    } else if (TH === 'venice') {
      at(ST.campanile(), CASTLE, 0.2);
      at(ST.basilica(), PAGODA, Math.PI / 2);
      at(ST.campanile(), HALL, 0.6).scale.setScalar(0.7);
      // 水に浮かぶゴンドラ（道と家並みから離れた所）
      const gs = [], segD = (x, z) => Math.min(...course.segs.map(sg => { const dx = sg.b.x - sg.a.x, dz = sg.b.z - sg.a.z, l2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - sg.a.x) * dx + (z - sg.a.z) * dz) / l2)); return Math.hypot(x - sg.a.x - dx * t, z - sg.a.z - dz * t); }));
      for (let k = 0; k < 400 && gs.length < 34; k++) { const x = rr(-160, 320), z = rr(-90, 350); if (segD(x, z) > 30 && Math.hypot(x - CASTLE.x, z - CASTLE.z) > 16 && Math.hypot(x - PAGODA.x, z - PAGODA.z) > 30) gs.push({ x, z, rot: R() * 6 }); }
      inst(ST.gondolaGeo(), toon({ vertexColors: true }), gs, (d, g) => { d.position.set(g.x, -0.35, g.z); d.rotation.y = g.rot; }, { outline: 0.03 });
      // 河口: ラグーンに並ぶ杭の束、沖の島、行き交う舟
      const brs = [];
      for (const [x0, z0, x1, z1] of [[-80, -45, 260, -45], [-60, 300, 240, 300], [-120, -20, -120, 280]]) for (let k = 0; k <= 16; k++) { const f = k / 16; brs.push({ x: x0 + (x1 - x0) * f, z: z0 + (z1 - z0) * f, rot: R() * 6 }); }
      inst(ST.bricolaGeo(), toon({ vertexColors: true }), brs, (d, b) => { d.position.set(b.x, -1, b.z); d.rotation.y = b.rot; }, { outline: 0.02 });
      at(ST.islandChurch(), { x: 70, z: -230 }, 0.1);
      at(ST.islandChurch(), { x: 40, z: 500 }, Math.PI + 0.3).scale.setScalar(0.8);
      const fleet = [];
      for (let k = 0; k < 16; k++) fleet.push({ kind: k % 4 === 0 ? 2 : k % 2, cx: 80 + rr(-60, 60), cz: k % 2 ? -110 : 380, r: rr(60, 140), ph: R() * 6, sp: rr(0.02, 0.05) * (R() < 0.5 ? -1 : 1) });
      const geos = [ST.gondolaGeo(), ST.canoeGeo(0xf2c11c), ST.vaporettoGeo()];
      W.fleet = [0, 1, 2].map(k => { const list = fleet.filter(f => f.kind === k); const m = inst(geos[k], toon({ vertexColors: true }), list, () => {}, { outline: 0.03 }); if (m) m.frustumCulled = false; return { m, list }; });
    } else if (TH === 'ny') {
      at(ST.decoTower(NIGHT), CASTLE, 0.4);
      // 自由の女神: スタートの直線の先、海に浮かぶ島に大きく。ビル街の上から見える
      const LIB = { x: 560, z: 0 };
      const isle = new THREE.Mesh(new THREE.CylinderGeometry(150, 156, 1.2, 48), toon({ map: waterTex(), color: 0x6aa8c8 })); isle.material.map.repeat.set(8, 8); isle.position.set(LIB.x, -0.4, LIB.z); scene.add(isle); W.water2 = isle.material.map;
      const land = new THREE.Mesh(new THREE.CylinderGeometry(44, 50, 3, 24), toon({ color: 0x6a8a5a, fog: false })); land.position.set(LIB.x, 0.8, LIB.z); scene.add(land);
      at(ST.libertyStatue(NIGHT), LIB, -Math.PI / 2).scale.setScalar(3.0);
      at(ST.redSteps(), { x: PAGODA.x + 6, z: PAGODA.z }, -Math.PI / 2);
      W.libAngle = Math.atan2(LIB.z - 130, LIB.x - 80);
      const bt = ST.billboardAtlas();
      const bm = atlasify(toon({ map: bt, emissiveMap: bt, emissive: 0xffffff, emissiveIntensity: 1.0 }), 4, 2);
      at(ST.billboardTower({ mat: bm, attr: atlasAttr }), HALL, Math.PI / 2);
    } else {
      at(ST.pyramid(92, 60), CASTLE, 0.15);
      at(ST.pyramid(56, 38), { x: PAGODA.x - 16, z: PAGODA.z - 20 }, 0.3);
      at(ST.bigSphinx(), HALL, Math.PI / 2);
      for (const [x, z] of [[-78, 175], [-78, 250], [-82, 40], [-82, 100]]) at(ST.obelisk(), { x, z });
      // 地平線のピラミッド
      for (const [x, z, b, h] of [[-420, 300, 240, 150], [-520, 0, 200, 130], [600, 420, 260, 160]]) at(ST.pyramid(b, h), { x, z }, 0.4);
    }
  }
  // ---------- スタート・ゴールの門 ----------
  {
    const P = sampleS(course, course.prof && 40, {}), h = heightS(course, 40);
    const gate = new THREE.Group(); gate.position.set(P.x, h, P.z); gate.rotation.y = Math.atan2(P.tx, P.tz); scene.add(gate);
    const red = toon({ color: 0xd13a1f }), blk = toon({ color: 0x1e1a18 });
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 11.5, 12), red); p.position.set(sx * (WALL + 0.75), 5.75, 0); p.castShadow = true; gate.add(p); withOutline(p, 0.04); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(WALL * 2 + 4, 0.6, 0.7), blk); beam.position.y = 11.3; gate.add(beam); withOutline(beam, 0.04);
    const tex = canvasTex(1024, 192, (g, w, hh) => {
      g.fillStyle = '#fff4dd'; g.fillRect(0, 0, w, hh); g.fillStyle = '#c71f17'; g.fillRect(0, 0, w, 16); g.fillRect(0, hh - 16, w, 16);
      g.fillStyle = '#1b1020'; g.textAlign = 'center'; g.textBaseline = 'middle';
      // その土地の言葉で書く（幅に収まるように字の大きさを合わせる）
      const text = ST.GATE_TEXT[TH] || ST.GATE_TEXT.jp; let fs = 104;
      do { g.font = `${fs}px 'Dela Gothic One', 'Noto Sans Arabic', 'Arial', sans-serif`; fs -= 4; } while (g.measureText(text).width > w - 60 && fs > 30);
      g.fillText(text, w / 2, hh / 2 + 6);
    });
    for (const ry of [0, Math.PI]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(13, 2.4), toon({ map: tex })); b.position.set(0, 9.8, ry ? 0.03 : -0.03); b.rotation.y = ry; gate.add(b); }
    const chk = canvasTex(256, 32, (g) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4'; g.fillRect(x * 16, y * 16, 16, 16); } });
    ribbon(39.2, 40.8, -WALL, WALL, toon({ map: chk }), { step: 0.8, yOff: 0.02, vScale: 1.6 });
    for (const [mat, list] of strips) add(new THREE.Mesh(merge(list), mat), false, true);
    strips.clear();
  }

  // ---------- 遠くの山・雲 ----------
  {
    const parts = [];
    for (let k = 0; k < 34; k++) {
      const a = k / 34 * Math.PI * 2 + rr(-0.05, 0.05), r = rr(470, 640), h = rr(50, 130);
      const g = new THREE.IcosahedronGeometry(1, 2); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const yy = p.getY(i); p.setXYZ(i, p.getX(i) * (1 + Math.sin(i) * 0.06), Math.max(-0.2, yy), p.getZ(i) * (1 + Math.cos(i * 1.3) * 0.06)); }
      g.scale(rr(90, 160), h, rr(70, 120)); g.rotateY(-a); g.translate(80 + Math.cos(a) * r, -10, 130 + Math.sin(a) * r);
      parts.push(col(g, TH === 'giza' ? rpick([0xd8b884, 0xe2c48e, 0xcfa874, 0xe8d0a0]) : rpick([0x5f9a58, 0x4f8a4c, 0x6aa660, 0x58935a])));
    }
    const m = new THREE.Mesh(merge(parts), toon({ vertexColors: true, fog: true }));
    if (TH === 'giza') m.scale.y = 0.45;   // 砂丘
    if (TH === 'ny') scene.add(ST.skyline(80, 130, 300, 650, 160, NIGHT, W.libAngle ?? null)); else if (TH !== 'venice') scene.add(m);
    const cloud = [];
    for (let k = 0; k < 28; k++) {
      const a = R() * Math.PI * 2, r = rr(260, 560), y = rr(90, 170), cx = 80 + Math.cos(a) * r, cz = 130 + Math.sin(a) * r;
      const n = 4 + Math.floor(R() * 4), s = rr(10, 22);
      for (let i = 0; i < n; i++) cloud.push(blob(s * rr(0.6, 1.1), cx + (i - n / 2) * s * 0.9, y + Math.sin(i) * s * 0.3, cz + rr(-s, s) * 0.4, 1));
    }
    const cm = new THREE.Mesh(merge(cloud), toon({ color: 0xffffff, emissive: 0x8a96a8, fog: false }));
    if (TH !== 'ny') { scene.add(cm); W.clouds = cm; W.dayOnly.push(cm); if (TH === 'giza') cm.scale.y = 0.5; }
  }

  // ---------- 見物客 ----------
  {
    const P = {};
    course.straights.forEach((st, j) => {
      const style = straightStyle(j);
      const dens = style === 'shrine' ? 0.35 : 0.85;
      for (let s = st.a + 8; s < st.b - 8; s += 0.85) {
        if (j === 0 && s > bridge[0] - 4 && s < bridge[1] + 4) continue;
        for (const sd of [-1, 1]) {
          if (R() > dens) continue;
          const lat = sd * rr(7.55 + O, (style === 'old' || style === 'shrine' ? 8.3 : 8.5) + O);
          sampleS(course, s + rr(-0.3, 0.3), P);
          const x = P.x - P.tz * lat, z = P.z + P.tx * lat;
          if (sidewalkPts.some(q => Math.hypot(q.x - x, q.z - z) < q.r)) continue;
          const sp = { x, y: heightS(course, s) + 0.16, z, ox: x, oz: z, yaw: Math.atan2(P.tz * sd, -P.tx * sd) + rr(-0.5, 0.5), ph: R() * 6, f: R() * 3, s: R() < 0.12 ? rr(0.65, 0.75) : rr(0.92, 1.06), up: R() < 0.4, cs: s, sd };
          sp.pc = piece('spec', x, sp.y, z, 0, 0, { sp, name: '観客', kg: 60 });
          W.specs.push(sp);
        }
      }
    });
    const pal = [0xe8e2d0, 0x2b3d6b, 0xb23a3a, 0xd98b2b, 0x3a6b4a, 0x6b4a8b, 0xf0f0f0, 0x26262a, 0xc45a7a, 0x4a7fb5, 0xe0c060, 0x1d2f6b, 0x8a1f1a];
    const mats = toon({ vertexColors: true });
    const up = W.specs.filter(s => s.up), down = W.specs.filter(s => !s.up);
    W.specMeshes = [[spectatorGeo(true), up], [spectatorGeo(false), down]].map(([g, list]) => {
      const m = new THREE.InstancedMesh(g, mats, list.length); m.castShadow = false;
      const d0 = new THREE.Object3D();
      list.forEach((s, i) => {
        m.setColorAt(i, new THREE.Color(pal[Math.floor(R() * pal.length)])); s.mi = i;
        d0.position.set(s.x, s.y, s.z); d0.rotation.set(0, s.yaw, 0); d0.scale.setScalar(s.s); d0.updateMatrix(); m.setMatrixAt(i, d0.matrix);
      });
      scene.add(m); const o = withOutline(m, 0.02); scene.add(o);
      return { m, list };
    });
  }

  // ---------- 壊せる小物 ----------
  {
    const P = {};
    const place = (type, s, lat, yaw) => { sampleS(course, s, P); W.props.push({ type, x: P.x - P.tz * lat, z: P.z + P.tx * lat, y: heightS(course, s), yaw: yaw ?? R() * 6, s }); };
    course.straights.forEach((st, j) => {
      const style = straightStyle(j);
      for (let s = st.a + 25; s < st.b - 20; s += rr(26, 44)) {
        if (j === 0 && s > bridge[0] - 4 && s < bridge[1] + 4) continue;
        if (Math.abs(s - course.prof.jumpS) < 30 || course.prof.kick.some(q => Math.abs(s - q.s) < 8)) continue;
        const sd = R() < 0.5 ? -1 : 1;
        const PS = ST.THEME_PROP_SETS[TH].side, kind = style === 'old' || style === 'shrine' ? rpick(PS.old) : rpick(PS.mod);
        const n = kind === 'cone' ? 3 : kind === 'taxi' || kind === 'police' || kind === 'jpolice' || kind === 'camel' || kind === 'gondola' ? 1 : 1 + Math.floor(R() * 2);
        for (let k = 0; k < n; k++) place(kind, s + k * (kind === 'cafe' ? 2.4 : 1.3), sd * rr(5.4 + O, 6.2 + O), kind === 'taxi' || kind === 'police' || kind === 'jpolice' || kind === 'gondola' || kind === 'canoe' ? Math.atan2(P.tx, P.tz) + rr(-0.2, 0.2) : undefined);
      }
    });
    // 工事中（コーンとバリケードの列）
    if (ST.THEME_PROP_SETS[TH].works) { const st = course.straights[1]; for (let k = 0; k < 6; k++) place('cone', st.a + 30 + k * 2.2, -5.6 + k * 0.3); place('barricade', st.a + 32, -8.2, Math.atan2(1, 0)); }
    // 角の外側には俵と木箱の山（ぶつかるとはじけ飛ぶ）
    course.corners.forEach(c => {
      const outer = c.turn === 'L' ? 1 : -1;
      const pile = ST.THEME_PROP_SETS[TH].pile;
      for (let k = 0; k < 12; k++) place(k % 3 ? pile[0] : pile[(k / 3 | 0) % pile.length], c.s + 2 + k * (c.e - c.s - 4) / 11, outer * (WALL - 0.9 - (k % 2) * 0.9));
    });
    // ハプニング: 道を横切るもの（近づくと動き出す。ぶつかれば飛ぶ・くっつく）
    {
      const MOV = {   // 町ごとに、現実にいそうな人・車・舟
        jp: [['bike', '自転車のおばちゃん', 3.5, 1], ['jpolice', 'パトカー', 11, 1], ['kids', '登校中の小学生', 1.6, 1], ['kei', '軽トラ', 8, 1], ['dogwalk', '犬の散歩', 1.8, 1], ['takuhai', '宅配トラック', 7, 1], ['yaki', '焼き芋屋のリヤカー', 2.0, 1], ['mikoshi', '神輿', 2.2, 1]],
        paris: [['bike', 'パン屋の自転車', 4.5, 1], ['petite', 'フランスの小型車', 8, 1], ['velib', 'シェア自転車', 4.5, 1], ['poodle', 'プードルとマダム', 2.0, 1], ['scooter', 'スクーター', 9, 2], ['van', '配達のバン', 7, 1]],
        ny: [['taxi', 'タクシー', 10, 1], ['police', 'パトカー', 12, 1], ['courier', '自転車の配達員', 6, 1], ['schoolbus', 'スクールバス', 7, 1], ['hotdog', 'ホットドッグ屋台', 3, 1], ['firetruck', '消防車', 9, 1], ['limo', 'リムジン', 8, 1]],
        giza: [['camel', 'らくだの隊列', 2.4, 3], ['tuktuk', 'トゥクトゥク', 7, 1], ['donkey', 'ロバの荷車', 2.6, 1], ['microbus', '乗り合いバス', 7, 1], ['tourbus', '観光バス', 7, 1]],
        venice: [['gondola', 'ゴンドラ', 3.2, 1], ['canoe', 'カヌー', 4.5, 2], ['vaporetto', '水上バス', 4, 1], ['watertaxi', '水上タクシー', 9, 1], ['cargoboat', '荷物運びの船', 3.5, 1], ['policeboat', '警察の船', 8, 1]],
      }[TH];
      let k = 0;
      course.straights.forEach((st, j) => {
        const len = st.b - st.a; if (len < 60) return;
        const nPos = len > 120 ? 2 : 1;   // ハプニングなので控えめに
        for (let q = 0; q < nPos; q++) { const f = (q + 0.5) / nPos;
          const s = st.a + len * f;
          if ((j === 0 && s > bridge[0] - 14 && s < bridge[1] + 14) || Math.abs(s - 40) < 14 || course.prof.kick.some(q => Math.abs(s - q.s) < 16) || Math.abs(s - course.prof.jumpS) < 26) continue;
          const [type, name, speed, n] = MOV[k++ % MOV.length], dir = R() < 0.5 ? 1 : -1;
          sampleS(course, s, P);
          for (let i = 0; i < n; i++) {
            const lat = -dir * (WALL + 7 + i * (n > 2 ? 2.2 : 3.4));
            W.props.push({ type, x: P.x - P.tz * lat, z: P.z + P.tx * lat, y: heightS(course, s), yaw: Math.atan2(-P.tz * dir, P.tx * dir), s, mover: { s, lat, dir, speed: speed * rr(0.85, 1.15), on: false, name, px: P.x, pz: P.z, tx: P.tx, tz: P.tz } });
          }
        }
      });
    }
    W.propMeshes = {};
    for (const [type, def] of Object.entries({ ...PROP_TYPES, ...ST.THEME_PROPS })) {
      const list = W.props.filter(p => p.type === type);
      if (!list.length) continue;
      const m = new THREE.InstancedMesh(def.geo(), toon({ vertexColors: true }), list.length);
      m.castShadow = true; m.frustumCulled = false;
      list.forEach((p, i) => { p.mi = i; p.mesh = m; p.r = def.r; p.mass = def.mass; });
      scene.add(m); scene.add(withOutline(m, 0.02));
      W.propMeshes[type] = m;
    }
    for (const p of W.props) {
      const d = new THREE.Object3D(); d.position.set(p.x, p.y, p.z); d.rotation.set(0, p.yaw, 0); d.updateMatrix();
      p.pc = { kind: 'prop', name: (PROP_NAMES[p.type] || ST.THEME_PROP_NAMES[p.type])[0], kg: (PROP_NAMES[p.type] || ST.THEME_PROP_NAMES[p.type])[1], px: p.x, py: p.y, pz: p.z, parts: [{ m: p.mesh, i: p.mi, base: d.matrix.clone() }], st: 0, stick: 1 };
    }
  }

  // くっついた時の名前と重さ（結果の「ひっつけたもの」用）
  const nameAll = (list, name, kg) => list.forEach(it => { if (it.pc) { it.pc.name = name; it.pc.kg = kg; } });
  const NM = {
    jp: [['電柱', 1500], ['街路樹', 900], ['自販機', 600], ['のぼり', 3], ['石灯籠', 800], ['玉垣', 1200], ['竹', 20], ['ビル', 400000]],
    paris: [['街灯', 300], ['プラタナス', 1200], ['広告塔', 2000], ['旗', 3], ['街灯', 300], ['生け垣', 200], ['プラタナス', 1200], ['アパルトマン', 900000]],
    ny: [['街灯', 400], ['街路樹', 900], ['消火栓', 90], ['旗', 3], ['街灯', 400], ['塀', 500], ['街路樹', 900], ['摩天楼', 5000000]],
    venice: [['街灯', 300], ['広場の木', 1000], ['ゴンドラの杭', 150], ['旗', 3], ['街灯', 300], ['塀', 500], ['広場の木', 1000], ['パラッツォ', 700000]],
    giza: [['ヤシの木', 600], ['ヤシの木', 600], ['つぼ', 15], ['旗', 3], ['スフィンクス像', 3000], ['石の塀', 1500], ['ヤシの木', 600], ['日干しれんがの家', 80000]],
  }[TH];
  nameAll(poles, ...NM[0]); nameAll(trees, ...NM[1]); nameAll(vend, ...NM[2]); nameAll(plants, '植木鉢', 30); nameAll(nobori, ...NM[3]);
  nameAll(stoneLan, ...NM[4]); nameAll(walls2, ...NM[5]); nameAll(bamboo, ...NM[6]); nameAll(modern, ...NM[7]); nameAll(machiya, '町家', 60000);
  // パトカーの回転灯（赤と青が交互に光る。車と一緒に飛ぶ・くっつく）
  {
    const cops = W.props.filter(p => p.type === 'police' || p.type === 'jpolice');
    if (cops.length) {
      // NY は赤と青、日本は赤が交互に光る
      W.beacon = [new THREE.MeshBasicMaterial({ color: 0xff2020 }), new THREE.MeshBasicMaterial({ color: JP ? 0xff2020 : 0x2050ff })]; W.beaconJP = JP;
      const g = new THREE.BoxGeometry(0.42, 0.2, 0.3);
      const ms = W.beacon.map(mat => { const m = new THREE.InstancedMesh(g, mat, cops.length); m.frustumCulled = false; scene.add(m); return m; });
      const L = new THREE.Matrix4(), B = new THREE.Matrix4();
      cops.forEach((p, i) => { [-0.26, 0.26].forEach((x, k) => { B.copy(p.pc.parts[0].base).multiply(L.makeTranslation(x, 1.72, -0.2)); ms[k].setMatrixAt(i, B); p.pc.parts.push({ m: ms[k], i, base: B.clone() }); }); });
    }
    W.steamSpots = W.props.filter(p => p.type === 'steam');
    W.movers = W.props.filter(p => p.mover);
    const inv = new THREE.Matrix4();
    for (const p of W.movers) { inv.copy(p.pc.parts[0].base).invert(); for (const q of p.pc.parts) q.local = inv.clone().multiply(q.base); p.mover.lat0 = p.mover.lat; p.mover.dir0 = p.mover.dir; }
  }
  // ハプニング: 道のトラップ（町ごとに 2 種類）
  W.traps = [];
  {
    const KINDS = { jp: ['puddle', 'plate'], paris: ['pigeons', 'bump'], ny: ['manhole', 'spray'], giza: ['quicksand', 'sandstorm'], venice: ['wave', 'pigeons'] }[TH], P = {};
    const ACROSS = { wave: 1, bump: 1 };   // 道幅いっぱいのもの
    const RAD = { spray: 2.6, puddle: 2.4, plate: 2.2, banana: 1.0, pigeons: 6, bump: WALL, manhole: 1.3, pothole: 1.5, quicksand: 3.2, sandstorm: 5, wave: WALL };
    let k = 0;
    course.straights.forEach((st, j) => {
      for (let s = st.a + 30; s < st.b - 14; s += rr(60, 90)) {
        if ((j === 0 && s > bridge[0] - 6 && s < bridge[1] + 6) || course.prof.kick.some(q => Math.abs(s - q.s) < 10) || Math.abs(s - course.prof.jumpS) < 24 || W.movers.some(p => Math.abs(p.mover.s - s) < 5)) continue;
        const kind = KINDS[k++ % KINDS.length], lat = ACROSS[kind] ? 0 : rr(-WALL + 3, WALL - 3); sampleS(course, s, P);
        W.traps.push({ kind, s, lat, x: P.x - P.tz * lat, z: P.z + P.tx * lat, y: heightS(course, s), rot: Math.atan2(P.tx, P.tz), r: RAD[kind], across: !!ACROSS[kind], cool: 0 });
      }
    });
    const disc = (r, c, op = 1) => [new THREE.CircleGeometry(r, 24).rotateX(-Math.PI / 2), toon({ color: c, transparent: op < 1, opacity: op })];
    const look = kind => {
      if (kind === 'puddle') return disc(2.4, 0x7ab0d0, 0.7);
      if (kind === 'manhole') return [merge([col(new THREE.CircleGeometry(0.95, 20).rotateX(-Math.PI / 2), 0x3a3a3e), col(new THREE.RingGeometry(0.6, 0.7, 20).rotateX(-Math.PI / 2).translate(0, 0.005, 0), 0x6a6a70)]), toon({ vertexColors: true })];
      if (kind === 'pothole') return [merge([col(new THREE.CircleGeometry(1.5, 14).rotateX(-Math.PI / 2), 0x1a1a1c), col(new THREE.RingGeometry(1.4, 1.75, 14).rotateX(-Math.PI / 2).translate(0, 0.01, 0), 0x5a5a5e)]), toon({ vertexColors: true })];
      if (kind === 'quicksand') { const t = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#c9a46a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8a6a3a'; g.lineWidth = 5; g.beginPath(); for (let a = 0; a < 26; a += 0.2) { const r = a * 2.3; g.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); } g.stroke(); }); return [new THREE.CircleGeometry(3.2, 28).rotateX(-Math.PI / 2), toon({ map: t })]; }
      if (kind === 'sandstorm') { const g = []; for (let i = 0; i < 8; i++) g.push(col(T(new THREE.TorusGeometry(0.6 + i * 0.35, 0.12, 4, 14).rotateX(Math.PI / 2), Math.sin(i) * 0.3, 0.4 + i * 0.7, Math.cos(i) * 0.3), i % 2 ? 0xd8b884 : 0xc9a46a)); return [merge(g), toon({ vertexColors: true, transparent: true, opacity: 0.75 })]; }
      if (kind === 'wave') return [merge([col(box(WALL * 2, 0.5, 1.6, 0, 0.1, 0), 0xe8f6ff), col(box(WALL * 2, 0.3, 1.0, 0, 0.45, 0.4), 0xffffff)]), toon({ vertexColors: true, transparent: true, opacity: 0.85 })];
      if (kind === 'bump') { const g = []; for (let x = -WALL; x < WALL; x += 0.9) g.push(col(T(new THREE.BoxGeometry(0.8, 0.35, 0.8), x + 0.45, 0.17, 0), (x * 7 | 0) % 2 ? 0x9a968e : 0x86827a)); return [merge(g), toon({ vertexColors: true })]; }
      if (kind === 'spray') { const g = [col(cyl(0.18, 0.22, 0.7, 10, 0, 0.35, 0), 0xd8261c), col(T(new THREE.SphereGeometry(0.16, 10, 8), 0, 0.78, 0), 0xf2c14e)]; for (let k = 0; k < 7; k++) { const t = k / 6; g.push(col(T(new THREE.SphereGeometry(0.22 + t * 0.35, 10, 8), 0, 0.6 + Math.sin(t * Math.PI) * 1.4, 0.4 + t * 3.2), 0xbfe6ff)); } g.push(col(new THREE.CircleGeometry(2.4, 20).rotateX(-Math.PI / 2).translate(0, 0.02, 2.6), 0x8ac0e0)); return [merge(g), toon({ vertexColors: true, transparent: true, opacity: 0.85 })]; }
      if (kind === 'plate') { const g = [col(box(4.2, 0.12, 3.2, 0, 0.06, 0), 0x5a5a60)]; for (let k = 0; k < 3; k++) g.push(col(box(4.2, 0.02, 0.06, 0, 0.13, -1.0 + k), 0x7a7a80)); for (const [x, z] of [[-2.6, 1.6], [2.6, 1.6], [-2.6, -1.6], [2.6, -1.6]]) g.push(col(cyl(0.05, 0.3, 0.7, 10, x, 0.35, z), 0xff6a1a), col(cyl(0.16, 0.22, 0.12, 10, x, 0.36, z), 0xf8f8f8)); return [merge(g), toon({ vertexColors: true })]; }
      if (kind === 'banana') { const g = []; for (let i = 0; i < 3; i++) { const p = new THREE.TorusGeometry(0.3, 0.07, 6, 10, 2.2); p.rotateX(Math.PI / 2); p.rotateY(i * 2.1); p.translate(0, 0.06, 0); g.push(col(p, 0xf2d21c)); } g.push(col(T(new THREE.SphereGeometry(0.06, 6, 5), 0, 0.08, 0), 0x5a4a1a)); return [merge(g), toon({ vertexColors: true })]; }
      // ハト（1 つの群れ = 14 羽）
      const bird = merge([col(T(new THREE.SphereGeometry(0.16, 8, 6).scale(1, 0.8, 1.5), 0, 0.2, 0), 0x8a8e9a), col(T(new THREE.SphereGeometry(0.09, 8, 6), 0, 0.36, 0.17), 0x6a7a8a), col(box(0.04, 0.02, 0.08, 0, 0.34, 0.27), 0xe8a040)]);
      const flock = []; for (let i = 0; i < 14; i++) { const a = R() * 6.28, r = R() * 4; flock.push(T(bird.clone().rotateY(R() * 6.28), Math.cos(a) * r, 0, Math.sin(a) * r)); }
      return [merge(flock), toon({ vertexColors: true })];
    };
    W.trapMeshes = [];
    for (const kind of new Set(W.traps.map(t => t.kind))) {
      const list = W.traps.filter(t => t.kind === kind), [geo, mat] = look(kind);
      const m = inst(geo, mat, list, (d, t, i) => { d.position.set(t.x, t.y + (t.across ? 0 : 0.03), t.z); d.rotation.y = t.rot; t.mesh = null; t.mi = i; }, { shadow: false, outline: kind === 'pigeons' || kind === 'wave' || kind === 'banana' || kind === 'sandstorm' ? 0.02 : 0 });
      if (m) { list.forEach(t => (t.mesh = m)); W.trapMeshes.push({ kind, m }); }
    }
    W.hideTrap = (t, hide) => { if (!t.mesh) return; const dd = new THREE.Object3D(); dd.position.set(t.x, t.y + 0.03, t.z); dd.rotation.set(0, t.rot, 0); dd.scale.setScalar(hide ? 0 : 1); dd.updateMatrix(); t.mesh.setMatrixAt(t.mi, dd.matrix); t.mesh.instanceMatrix.needsUpdate = true; };
  }
  // ---------- 壊れる・崩れる・くっつく ----------
  const rubble = (() => {
    const parts = [];
    const cs = [0x8a8378, 0x6b5a48, 0xa59c8c, 0x5a4a3a, 0xb3a58e];
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; parts.push(col(blob(0.42 + (k % 3) * 0.12, Math.cos(a) * 0.62, 0.12, Math.sin(a) * 0.62, 0), cs[k % 5])); }
    parts.push(col(blob(0.6, 0, 0.25, 0, 0), cs[2]));
    for (let k = 0; k < 6; k++) parts.push(col(T(new THREE.BoxGeometry(0.9, 0.08, 0.14).rotateY(k * 1.1).rotateZ(0.3), Math.cos(k) * 0.5, 0.3, Math.sin(k * 1.7) * 0.5), 0x7a5128));
    const m = new THREE.InstancedMesh(merge(parts), toon({ vertexColors: true }), 60);
    m.count = 0; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); scene.add(withOutline(m, 0.02));
    return m;
  })();
  const M1 = new THREE.Matrix4(), M2 = new THREE.Matrix4(), M3 = new THREE.Matrix4(), MS = new THREE.Matrix4(), Q1 = new THREE.Quaternion(), E1 = new THREE.Euler(), V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), AX = new THREE.Vector3();
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const active = new Set(), dirtyM = new Set();
  // pre × (pivot を原点へ) × 元の行列
  const setParts = (pc, pre) => {
    M2.makeTranslation(-pc.px, -pc.py, -pc.pz); M3.multiplyMatrices(pre, M2);
    for (const p of pc.parts) { M1.multiplyMatrices(M3, p.base); p.m.setMatrixAt(p.i, M1); dirtyM.add(p.m); }
  };
  const hideParts = pc => { for (const p of pc.parts) { p.m.setMatrixAt(p.i, ZERO); dirtyM.add(p.m); } };
  const restore = pc => { for (const p of pc.parts) { p.m.setMatrixAt(p.i, p.base); dirtyM.add(p.m); } };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const fly = (pc, vx, vz, power, from) => {
    pc.st = 1; pc.t = 0;
    pc.f = { x: from ? from.x - pc.px : 0, y: from ? from.y - pc.py : 0, z: from ? from.z - pc.pz : 0, vx: vx * 1.1 + rnd(-3, 3), vy: 4 + power * 0.3 + rnd(0, 4), vz: vz * 1.1 + rnd(-3, 3), rx: 0, ry: 0, rz: 0, wx: rnd(-7, 7), wy: rnd(-4, 4), wz: rnd(-7, 7) };
    active.add(pc);
  };
  const topple = (pc, vx, vz) => {
    const l = Math.hypot(vx, vz) || 1;
    pc.st = 2; pc.t = 0; pc.dx = vx / l; pc.dz = vz / l; pc.slide = Math.min(6, l * 0.15);
    active.add(pc);
  };
  const collapse = (pc, vx, vz) => {
    const l = Math.hypot(vx, vz) || 1;
    pc.st = 3; pc.t = 0; pc.dx = vx / l; pc.dz = vz / l;
    active.add(pc);
  };
  const flee = (pc, car) => {
    const sp = pc.sp; if (sp.fl) return;
    pc.st = 6;
    const P = sampleS(course, sp.cs, {});
    const along = (car.vx || 0) * P.tx + (car.vz || 0) * P.tz;
    const ds = (along >= 0 ? -1 : 1) * rnd(3, 7) * (Math.random() < 0.75 ? 1 : -1), lat = sp.sd * (WALL + course.ext[pc.side][binOf(course, sp.cs + ds)] + rnd(2.5, 5));
    const Q = sampleS(course, sp.cs + ds, {});
    sp.fl = { t: 0, x0: sp.x, z0: sp.z, x1: Q.x - Q.tz * lat, z1: Q.z + Q.tx * lat, spin: rnd(-6, 6) };
  };
  // 観客がだんじりにしがみつく（高欄の上に乗って手を振る）
  const cling = (pc, who) => {
    const sp = pc.sp; if (sp.stk) return;
    const sx = Math.random() < 0.5 ? -1 : 1, top = Math.random() < 0.25;
    V2.set(top ? rnd(-0.7, 0.7) : sx * rnd(1.12, 1.3), top ? rnd(5.0, 5.2) : 2.2, top ? rnd(-1.4, 0.2) : rnd(-1.6, 1.6));
    E1.set(rnd(-0.15, 0.15), top ? rnd(0, 6) : sx * Math.PI / 2 + rnd(-0.6, 0.6), sx * rnd(0.05, 0.3));
    sp.stk = { who, L: new THREE.Matrix4().compose(V2, Q1.setFromEuler(E1), V1.set(sp.s, sp.s, sp.s)), ph: rnd(0, 6) };
    (who.specs ||= []).push(sp); pc.st = 6; (who.log ||= new Set()).add(pc);
  };
  const shedSpecs = who => {
    for (const sp of who.specs || []) {
      M1.multiplyMatrices(who.body.matrixWorld, sp.stk.L); V1.setFromMatrixPosition(M1);
      sp.stk = null;
      project(course, V1.x, V1.z, -1, PQ);
      const sd = PQ.lat >= 0 ? 1 : -1, lat = sd * (WALL + course.ext[sideOf(PQ.lat)][binOf(course, PQ.s)] + rnd(1, 3));
      const Q = sampleS(course, PQ.s + rnd(-4, 4), {});
      sp.x = V1.x; sp.z = V1.z; sp.sd = sd; sp.cs = PQ.s;
      sp.fl = { t: 0, x0: V1.x, z0: V1.z, x1: Q.x - Q.tz * lat, z1: Q.z + Q.tx * lat, spin: rnd(-6, 6) };
    }
    who.specs = [];
  };
  // くっつく（塊魂のように）: だんじりの面に貼りつけ、だんじりと一緒に動かす
  const MAX_STICK = 36;
  W.stick = (pc, who, hx, hz, opt = {}) => {
    (who.log ||= new Set()).add(pc);
    for (const p of pc.parts) { p.m.frustumCulled = false; if (p.m.userData.twin) p.m.userData.twin.frustumCulled = false; }
    if (who.list.length >= MAX_STICK) unstick(who.list.shift(), 0, 0);
    if (opt.where === 'cord') { // 紐ごと絡まった提灯: 置き場所は呼び出し側（紐の動き）が posePiece で決める
      pc.L = null; pc.swing = 0; pc.st = 5; pc.who = who; who.list.push(pc);
      return;
    }
    who.body.updateWorldMatrix(true, false);
    M1.copy(who.body.matrixWorld).invert();
    V1.set(hx, pc.py + 1, hz).applyMatrix4(M1);
    const roll = Math.random() * Math.PI * 2, sc = opt.sc || rnd(0.6, 0.85);
    const r = Math.random();
    if (opt.where === 'top') { // 鳥居: 屋根の上に乗っかる
      V2.set(rnd(-0.3, 0.3), rnd(5.1, 5.35), rnd(-1.2, 0.4)); E1.set(rnd(-0.35, 0.35), rnd(-0.4, 0.4), rnd(-0.3, 0.3), 'YXZ');
    } else if (opt.where === 'hang') { // 提灯: 屋根のまわりにぶら下がる
      const sx = Math.random() < 0.5 ? -1 : 1;
      V2.set(sx * rnd(1.45, 1.65), rnd(3.3, 3.75), rnd(-1.9, 1.3)); E1.set(0, rnd(0, 6), 0);
    } else if (r < 0.2) { // 屋根の上
      V2.set(rnd(-0.8, 0.8), rnd(4.6, 5.3), rnd(-1.2, 1.2)); E1.set(rnd(-0.5, 0.5), roll, rnd(-0.5, 0.5));
    } else if (Math.abs(V1.x) > Math.abs(V1.z) * 0.55) { // 横
      const sx = Math.sign(V1.x) || 1;
      const hi = Math.random() < 0.4; V2.set(sx * (hi ? 1.38 : 1.08), hi ? rnd(2.4, 3.3) : rnd(1.3, 2.0), Math.max(-1.5, Math.min(1.5, V1.z + rnd(-0.6, 0.6)))); E1.set(roll, 0, -sx * Math.PI / 2 + rnd(-0.4, 0.4), 'XZY');
    } else { // 前・後ろ
      const sz = Math.sign(V1.z) || 1;
      V2.set(Math.max(-0.95, Math.min(0.95, V1.x + rnd(-0.4, 0.4))), rnd(1.25, 3.2), sz * 1.62); E1.set(sz * Math.PI / 2 + rnd(-0.4, 0.4), roll, 0, 'YXZ');
    }
    pc.L = new THREE.Matrix4().compose(V2, Q1.setFromEuler(E1), V1.set(sc, sc, sc));
    pc.swing = opt.where === 'hang' ? rnd(0, 6) : opt.where === 'top' ? -1 - rnd(0, 6) : 0;
    pc.st = 5; pc.who = who; who.list.push(pc); active.add(pc);
  };
  const unstick = (pc, vx, vz) => {
    if (pc.obj) { homeObj(pc); return; }
    const who = pc.who; pc.who = null;
    if (pc.L) { M1.multiplyMatrices(who.body.matrixWorld, pc.L); V1.setFromMatrixPosition(M1); }
    else V1.copy(pc.wpos || V1.set(pc.px, pc.py, pc.pz));
    fly(pc, vx + rnd(-4, 4), vz + rnd(-4, 4), 6, V1);
  };
  // ---------- 届く範囲（ひっつけた物が多いほど高く・広く届く。塊魂のように） ----------
  W.reach = who => {
    const list = who.list || [], n = list.length + (who.specs || []).length;
    const big = list.filter(q => q.kind === 'torii' || q.kind === 'bld' || q.tall || q.kind === 'gateobj').length;
    return { h: 5.6 + Math.min(9, n * 0.28 + big * 1.0), w: Math.min(3.5, n * 0.12 + big * 0.3) };
  };
  // 普通の Object3D（雷門など）をだんじりに付ける・元に戻す
  const stickObj = (pc, who) => {
    const o = pc.obj;
    if (!pc.home) pc.home = { parent: o.parent, p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() };
    who.body.updateWorldMatrix(true, false); who.body.attach(o);
    o.position.set(rnd(-0.3, 0.3), pc.name === '雷門' ? 5.2 : 4.6, rnd(-1.0, 0.3)); o.rotation.set(rnd(-0.25, 0.25), rnd(-0.4, 0.4), rnd(-0.25, 0.25)); o.scale.setScalar(pc.sc);
    o.traverse(q => { q.frustumCulled = false; });
    pc.st = 5; pc.who = who; who.list.push(pc); (who.log ||= new Set()).add(pc);
  };
  const homeObj = pc => { const o = pc.obj, h = pc.home; if (!h) return; h.parent.add(o); o.position.copy(h.p); o.quaternion.copy(h.q); o.scale.copy(h.s); pc.st = 0; pc.who = null; };
  // 届く範囲に入った道ばたの物・観客を巻き込む（ぶつからなくても、くっついた物が触れたら絡める）
  W.grabNear = (who, car, s, u) => {
    const out = [], R = W.reach(who);
    if (R.w < 0.4 || s === undefined) return out;
    const b0 = binOf(course, s);
    for (let k = -1; k <= 1; k++) for (const side of [0, 1]) {
      const edge = (side ? u : -u) + 1.7 + R.w;
      for (const pc of byBin[side][(b0 + k + nb) % nb]) {
        if (pc.st || pc.lat > edge) continue;
        if (pc.kind === 'bld' && R.w < 3.5) continue;
        if (pc.kind === 'spec') { if ((who.specs || []).length < 10) { cling(pc, who); out.push(pc); } continue; }
        W.stick(pc, who, pc.px, pc.pz, { sc: pc.kind === 'bld' ? rnd(0.11, 0.15) : pc.tall ? rnd(0.22, 0.35) : undefined });
        out.push(pc);
      }
    }
    return out;
  };
  // ---------- 積んだものの書き出し・読み込み（ランキングの「だんじり表示」で同じ姿を組み直す） ----------
  const r3 = v => Math.round(v * 1000) / 1000;
  W.exportStuck = who => {
    const out = [], propPcs = W.props.map(p => p.pc);
    for (const pc of who.list || []) {
      if (pc.obj) { const o = pc.obj, i = (W.bigObjs || []).indexOf(pc); if (i >= 0) out.push({ k: 'g', i, L: new THREE.Matrix4().compose(o.position, o.quaternion, o.scale).toArray().map(r3) }); continue; }
      if (!pc.L) continue;   // 紐に絡まった提灯は形が決まらないので入れない
      let k = 'p', i = W.pieces.indexOf(pc);
      if (i < 0) { k = 's'; i = W.spans.indexOf(pc); }
      if (i < 0) { k = 'r'; i = propPcs.indexOf(pc); }
      if (i >= 0) out.push({ k, i, L: pc.L.toArray().map(r3) });
    }
    for (const sp of who.specs || []) { const i = W.pieces.indexOf(sp.pc); if (i >= 0 && sp.stk) out.push({ k: 'p', i, L: sp.stk.L.toArray().map(r3) }); }
    return out;
  };
  W.importStuck = (who, arr) => {
    const propPcs = W.props.map(p => p.pc);
    for (const e of arr || []) {
      const L = new THREE.Matrix4().fromArray(e.L);
      if (e.k === 'g') { const pc = (W.bigObjs || [])[e.i]; if (!pc || pc.st) continue; stickObj(pc, who); L.decompose(pc.obj.position, pc.obj.quaternion, pc.obj.scale); continue; }
      const pc = (e.k === 'p' ? W.pieces : e.k === 's' ? W.spans : propPcs)[e.i];
      if (!pc || pc.st) continue;
      (who.log ||= new Set()).add(pc);
      if (pc.kind === 'spec') { const sp = pc.sp; sp.stk = { who, L, ph: rnd(0, 6) }; (who.specs ||= []).push(sp); pc.st = 6; continue; }
      for (const q of pc.parts) { q.m.frustumCulled = false; if (q.m.userData.twin) q.m.userData.twin.frustumCulled = false; }
      pc.L = L; pc.swing = 0; pc.st = 5; pc.who = who; who.list.push(pc); active.add(pc);
      const pr = W.props.find(p => p.pc === pc); if (pr) pr.alive = false;
    }
  };
  W.posePiece = (pc, M) => { setParts(pc, M); (pc.wpos ||= new THREE.Vector3()).setFromMatrixPosition(M); };
  W.shed = (who, vx = 0, vz = 0) => { while (who.list.length) unstick(who.list.pop(), vx, vz); shedSpecs(who); };
  // 道をまたぐ物の下をくぐった（s0 → s1）: 提灯は引っかかってぶら下がり、鳥居はときどき屋根に乗っかる
  W.snag = (who, car, s0, s1, u) => {
    const out = [];
    if (s1 < s0 - course.L / 2) s1 += course.L;
    if (s1 <= s0 || s1 - s0 > 20) return out;
    const sp = Math.hypot(car.vx || 0, car.vz || 0);
    // 雷門など: 届く高さが足りれば、大提灯や門ごと持っていく
    for (const pc of W.bigObjs || []) {
      let ps = pc.s; if (ps < s0 - 1) ps += course.L;
      if (ps <= s0 || ps > s1 || pc.st || Math.abs(u) > WALL) continue;
      if (W.reach(who).h >= pc.need && !(pc.name === '雷門の大提灯' && W.bigObjs[0].st)) { stickObj(pc, who); out.push(pc); break; }
    }
    for (const pc of W.spans) {
      let ps = pc.s; if (ps < s0 - 1) ps += course.L;
      if (ps <= s0 || ps > s1 || pc.st) continue;
      if (pc.kind === 'wire' && sp > 4 && Math.random() < 0.5) {
        // 提灯の紐が屋根に引っかかった: 近くの提灯は紐ごと絡まり、残りは落ちる
        const lans = pc.lans.filter(l => !l.st).sort((a, b) => Math.abs(a.off - u) - Math.abs(b.off - u));
        const n = 2 + Math.floor(Math.random() * 3);
        lans.forEach((l, k) => { if (k < n && Math.abs(l.off - u) < 5) { W.stick(l, who, l.px, l.pz, { where: 'cord' }); out.push(l); } else fly(l, (car.vx || 0) * 0.3, (car.vz || 0) * 0.3, -6); });
        fly(pc, (car.vx || 0) * 0.25, (car.vz || 0) * 0.25, -8); out.push(pc);   // 紐はブチンと切れて落ちる
      }
      else if (pc.kind === 'torii' && sp > 10 && who.list.filter(q => q.kind === 'torii').length < 3 && Math.random() < 0.3) { W.stick(pc, who, pc.px, pc.pz, { where: 'top', sc: 0.24 }); out.push(pc); }
    }
    return out;
  };
  // 幅が広がった区切りの物を壊す。壊した物を返す（演出は呼び出し側）
  W.breakBins = (codes, who, car) => {
    const out = [];
    for (const code of codes) {
      const b = code >> 1, side = code & 1, lim = WALL + course.ext[side][b];
      for (const pc of byBin[side][b]) {
        if (pc.st || pc.lat > lim + (pc.kind === 'spec' ? 3 : 0.6)) continue;
        if (pc.kind === 'spec') { if (who && (who.specs || []).length < 10 && Math.random() < 0.3) cling(pc, who); else flee(pc, car); continue; }
        // 壊れた物はけっこうな確率でくっつく（家はミニチュアになって乗る）
        if (who && Math.random() < (pc.kind === 'bld' ? 0.2 : 0.42)) W.stick(pc, who, pc.px, pc.pz, { sc: pc.kind === 'bld' ? rnd(0.11, 0.15) : pc.tall ? rnd(0.22, 0.35) : undefined });
        else if (pc.kind === 'bld') collapse(pc, car.vx || 0, car.vz || 0);
        else if (pc.tall) topple(pc, (car.vx || 0) + (pc.px - car.x) * 2, (car.vz || 0) + (pc.pz - car.z) * 2);
        else fly(pc, car.vx || 0, car.vz || 0, Math.hypot(car.vx || 0, car.vz || 0));
        out.push(pc);
      }
    }
    return out;
  };
  // 道の小物にぶつかった: はじけ飛ぶか、くっつく
  W.smash = (p, vx, vz, power, who) => {
    p.alive = false;
    if (who && Math.random() < (p.mover ? 0.8 : 0.45)) W.stick(p.pc, who, p.x, p.z);   // 横切ってきた物はよくくっつく
    else fly(p.pc, vx, vz, power);
    return power;
  };
  const placeMover = (p, bob) => {
    const mv = p.mover, x = mv.px - mv.tz * mv.lat, z = mv.pz + mv.tx * mv.lat;
    p.x = x; p.z = z; p.pc.px = x; p.pc.pz = z;
    M1.compose(V1.set(x, p.y + bob, z), Q1.setFromAxisAngle(V2.set(0, 1, 0), Math.atan2(-mv.tz * mv.dir, mv.tx * mv.dir)), V2.set(1, 1, 1));
    for (const q of p.pc.parts) { q.base.multiplyMatrices(M1, q.local); q.m.setMatrixAt(q.i, q.base); dirtyM.add(q.m); }
  };
  W.resetProps = () => {
    for (const p of W.props) p.alive = true;
    for (const pc of W.pieces.concat(W.spans, W.props.map(p => p.pc))) {
      if (pc.st) { restore(pc); pc.st = 0; pc.who = null; }
      if (pc.sp) { pc.sp.x = pc.sp.ox; pc.sp.z = pc.sp.oz; pc.sp.fl = null; pc.sp.stk = null; }
    }
    for (const p of W.props) restore(p.pc);
    for (const pc of [...(W.bigObjs || [])].reverse()) if (pc.st) homeObj(pc);
    active.clear(); rubble.count = 0;
    for (const p of W.movers || []) { const mv = p.mover; mv.on = false; mv.pass = null; mv.lat = mv.lat0; mv.dir = mv.dir0; placeMover(p, 0); }
    for (const t of W.traps || []) { t.cool = 0; t.gone = 0; if (W.hideTrap) W.hideTrap(t, false); }
    flushM();
  };
  const flushM = () => { for (const m of dirtyM) m.instanceMatrix.needsUpdate = true; dirtyM.clear(); };
  const stepPieces = dt => {
    for (const pc of active) {
      pc.t += dt;
      if (pc.st === 1) { // 飛んでいく
        const f = pc.f;
        f.vy -= 20 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
        const fl = (pc.gy ?? pc.py) - pc.py;
        if (f.y < fl) { f.y = fl; f.vy = Math.abs(f.vy) * 0.3; f.vx *= 0.6; f.vz *= 0.6; f.wx *= 0.6; f.wz *= 0.6; }
        f.rx += f.wx * dt; f.ry += f.wy * dt; f.rz += f.wz * dt;
        const sc = pc.t > 5 ? Math.max(0, 1 - (pc.t - 5)) : 1;
        M1.compose(V1.set(pc.px + f.x, pc.py + f.y, pc.pz + f.z), Q1.setFromEuler(E1.set(f.rx, f.ry, f.rz)), V2.set(sc, sc, sc));
        if (sc <= 0) { hideParts(pc); pc.st = 9; active.delete(pc); } else setParts(pc, M1);
      } else if (pc.st === 2) { // 倒れる（電柱・木・竹）
        const k = Math.min(1, pc.t * pc.t * 2.2), ang = k * Math.PI / 2 * 0.97, sl = Math.min(1, pc.t * 1.5) * pc.slide;
        AX.set(pc.dz, 0, -pc.dx);
        M1.makeRotationAxis(AX, ang); M1.setPosition(pc.px + pc.dx * sl, pc.py + (k >= 1 ? Math.max(0, Math.sin((pc.t - 0.67) * 12) * 0.2 * Math.exp(-(pc.t - 0.67) * 4)) : 0), pc.pz + pc.dz * sl);
        setParts(pc, M1);
        if (pc.t > 2) active.delete(pc);
      } else if (pc.st === 3) { // 崩れる（家）
        const T1 = 1.3, u = Math.min(1, pc.t / T1), k = 1 - u * u * 0.97, sh = u < 1 ? Math.sin(pc.t * 55) * 0.18 * (1 - u) : 0;
        AX.set(pc.dz, 0, -pc.dx);
        M1.makeRotationAxis(AX, u * 0.14);
        MS.makeScale(1, k, 1); M1.multiply(MS);
        M1.setPosition(pc.px + sh, pc.py, pc.pz + sh * 0.6);
        setParts(pc, M1);
        if (pc.t > T1 + 0.05) {
          hideParts(pc); pc.st = 9; active.delete(pc);
          if (rubble.count < 60) {
            M1.compose(V1.set(pc.px + pc.dx * 1.5, pc.py, pc.pz + pc.dz * 1.5), Q1.setFromAxisAngle(V2.set(0, 1, 0), pc.rot || 0), V2.set(pc.w * 0.42, 1.3, pc.d * 0.4));
            rubble.setMatrixAt(rubble.count++, M1); rubble.instanceMatrix.needsUpdate = true;
          }
        }
      } else if (pc.st === 5) { // くっついている（提灯は揺れる、鳥居はぐらつく）
        if (!pc.L) continue;
        M1.multiplyMatrices(pc.who.body.matrixWorld, pc.L);
        if (pc.swing > 0) { MS.makeRotationX(Math.sin(pc.t * 5 + pc.swing) * 0.35); MS.multiply(M2.makeRotationZ(Math.sin(pc.t * 3.7 + pc.swing) * 0.25)); M1.multiply(MS); }
        else if (pc.swing < 0) { MS.makeRotationZ(Math.sin(pc.t * 4 - pc.swing) * 0.08); M1.multiply(MS); }
        setParts(pc, M1);
      }
    }
    flushM();
  };

  // ---------- 毎フレームの動き ----------
  const dd = new THREE.Object3D();
  W.update = (dt, t, cam, cars) => {
    if (W.water) W.water.offset.y -= dt * 0.08;
    if (W.clouds) W.clouds.rotation.y += dt * 0.002;
    if (W.carousel) W.carousel.rotation.y += dt * 0.4;
    if (W.water2) W.water2.offset.y -= dt * 0.02;
    // 横切るものを動かす
    for (const p of W.movers || []) {
      const mv = p.mover; if (!mv.on || !p.alive || p.pc.st) continue;
      mv.lat += mv.dir * mv.speed * dt;
      placeMover(p, p.type === 'camel' ? Math.abs(Math.sin(t * 6 + mv.lat)) * 0.12 : 0);
      if (Math.abs(mv.lat) > WALL + 8 && Math.sign(mv.lat) === mv.dir) { mv.on = false; mv.dir = -mv.dir; }
    }
    flushM();
    for (const { kind, m } of W.trapMeshes || []) { if (kind === 'wave') m.position.y = Math.sin(t * 2.2) * 0.15; else if (kind === 'sandstorm') m.rotation.y = 0; }
    if (W.beacon) { const f = Math.floor(t * 4) % 2; W.beacon[0].color.setRGB(f ? 1 : 0.25, 0.05, 0.05); if (W.beaconJP) W.beacon[1].color.setRGB(f ? 0.25 : 1, 0.05, 0.05); else W.beacon[1].color.setRGB(0.05, 0.12, f ? 0.25 : 1); }
    if (W.fleet) for (const { m, list } of W.fleet) if (m) { list.forEach((f, i) => { const a = f.ph + t * f.sp; dd.position.set(f.cx + Math.cos(a) * f.r, -0.3 + Math.sin(t * 1.3 + i) * 0.08, f.cz + Math.sin(a) * f.r * 0.5); dd.rotation.set(0, Math.atan2(-Math.sin(a) * Math.sign(f.sp), Math.cos(a) * 0.5 * Math.sign(f.sp)), Math.sin(t + i) * 0.04); dd.scale.setScalar(1); dd.updateMatrix(); m.setMatrixAt(i, dd.matrix); }); m.instanceMatrix.needsUpdate = true; }
    if (W.canal) { W.canal.offset.y -= dt * 0.05; W.canal.offset.x += dt * 0.01; }
    if (W.lagoon) { W.lagoon.offset.x += dt * 0.004; W.lagoon.offset.y += dt * 0.006; }
    // 見物客: 近いだんじりに沸く。突っ込んでくれば跳んで逃げる
    for (const { m, list } of W.specMeshes) {
      let dirty = false;
      for (const s of list) {
        const dc = Math.abs(s.x - cam.x) + Math.abs(s.z - cam.z);
        if (s.stk) { // しがみついている: だんじりと一緒に。跳ねて手を振る
          M1.multiplyMatrices(s.stk.who.body.matrixWorld, s.stk.L);
          MS.makeTranslation(0, Math.max(0, Math.sin(t * 9 + s.stk.ph)) * 0.18, 0); M1.multiply(MS);
          MS.makeRotationZ(Math.sin(t * 6 + s.stk.ph) * 0.15); M1.multiply(MS);
          m.setMatrixAt(s.mi, M1); dirty = true; continue;
        }
        if (dc > 120 && !s.fl) continue;
        let near = 99;
        for (const c of cars) { const dn = Math.abs(s.x - c.x) + Math.abs(s.z - c.z); if (dn < near) near = dn; }
        const ex = near < 22 ? 1 : 0.18;
        if (s.fl) {
          const f = s.fl; f.t += dt; const u = Math.min(1, f.t / 0.75);
          const x = f.x0 + (f.x1 - f.x0) * u, z = f.z0 + (f.z1 - f.z0) * u;
          dd.position.set(x, s.y + Math.sin(Math.PI * u) * 1.6, z); dd.rotation.set(0, s.yaw + f.spin * u, Math.sin(u * Math.PI) * 0.5); dd.scale.setScalar(s.s);
          if (u >= 1) { s.x = f.x1; s.z = f.z1; s.fl = null; }
        } else {
          const y = s.y + Math.max(0, Math.sin(t * (6 + s.f) + s.ph)) * 0.28 * ex;
          dd.position.set(s.x, y, s.z); dd.rotation.set(0, s.yaw + (near < 22 ? Math.sin(t * 3 + s.ph) * 0.3 : 0), Math.sin(t * 5 + s.ph) * 0.06 * ex); dd.scale.setScalar(s.s);
        }
        dd.updateMatrix(); m.setMatrixAt(s.mi, dd.matrix); dirty = true;
      }
      if (dirty) m.instanceMatrix.needsUpdate = true;
    }
    stepPieces(dt);
  };
  W.setNight = night => {
    for (const [m, v] of W.nightMats) m.emissiveIntensity = night ? v : (m === W.lanMat ? 0.1 : 0);
    for (const m of W.dayOnly) m.visible = !night;
    if (W.stoneLanMat) W.stoneLanMat.emissive.setHex(night ? 0x332200 : 0x000000);
  };
  W.resetProps();
  return W;
}
