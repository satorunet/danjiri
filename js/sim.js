// だんじり疾走 共通シミュレーション
// クライアント（js/game.js）とオンラインサーバ（server/race.mjs）の両方がこのファイルを読む。
// three.js には依存しない。座標は x/z が地面、y が高さ。yaw=0 で +z を向き、yaw が増えると左へ回る。

export const HALF_W = 15.5;     // 道路（歩道込み）の半幅（8 台で走れるよう広め）
export const WALL = 14.0;       // 走れる範囲（人垣・ガードレールの線）。町を壊すとここから広がる
export const SIDE = 16.2;       // 家の正面までの距離
export const CORNER_R = 24;
export const BIN = 3;           // 壊れた幅を覚えておく区切り（m）
export const EXT_MAX = 11;      // 町を壊して広げられる最大の幅
export const START_S = 40;
export const CAR_R = 1.5;       // 当たり判定の円の半径（前後 2 つ）
export const CAR_OFF = 1.35;    // 円の中心の前後オフセット
export const LANES = [-8.4, -2.8, 2.8, 8.4];
export const WP = [[200, 0], [200, 90], [120, 90], [120, 180], [210, 180], [210, 260], [-50, 260], [-50, 0]];
// segs[i] は WP[i] → WP[i+1] の通り。町並みの種類
export const SEG_STYLE = ['modern', 'old', 'old', 'modern', 'hill', 'high', 'shrine', 'start'];

export const CAR = {
  ACC: 13, VMAX: 28, BOOST_ACC: 24, BOOST_VMAX: 38, BRAKE: 26, REV_MAX: 6,
  ROLL_FRIC: 0.4, AIR_DRAG: 0.0012,
  STEER_A: 22, STEER_V: 0.6, U_DAMP: 2.6, FLING: 0.6, HALF: 1.7, ROLL_K: 0.013,
  G: 22, TIP: 0.8, CRASH_V: 24, BREAK_V: 3.5, LAND_CRASH: 20, BOOST_USE: 0.3,
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const hash = n => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

// ---------------- コース ----------------
export function buildCourse() {
  const n = WP.length, P = WP.map(([x, z]) => ({ x, z }));
  const dir = (a, b) => { const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz); return { x: dx / l, z: dz / l }; };
  const px = [], pz = [], corners = [];
  const last = P[n - 1], d0 = dir(last, P[0]);
  let prev = { x: last.x + d0.x * CORNER_R, z: last.z + d0.z * CORNER_R };
  px.push(prev.x); pz.push(prev.z);
  for (let i = 0; i < n; i++) {
    const c = P[i], a = P[(i - 1 + n) % n], b = P[(i + 1) % n];
    const dIn = dir(a, c), dOut = dir(c, b);
    const s0 = { x: c.x - dIn.x * CORNER_R, z: c.z - dIn.z * CORNER_R };
    const e0 = { x: c.x + dOut.x * CORNER_R, z: c.z + dOut.z * CORNER_R };
    const len = Math.hypot(s0.x - prev.x, s0.z - prev.z), steps = Math.max(1, Math.ceil(len / 2));
    for (let k = 1; k <= steps; k++) { px.push(prev.x + (s0.x - prev.x) * k / steps); pz.push(prev.z + (s0.z - prev.z) * k / steps); }
    const idx = px.length - 1;
    const turn = (dOut.x * -dIn.z + dOut.z * dIn.x) > 0 ? 'R' : 'L';
    for (let k = 1; k <= 14; k++) {
      const t = k / 14, u = 1 - t;
      px.push(u * u * s0.x + 2 * u * t * c.x + t * t * e0.x);
      pz.push(u * u * s0.z + 2 * u * t * c.z + t * t * e0.z);
    }
    corners.push({ idx, turn, c, dIn, dOut, seg: i });
    prev = e0;
  }
  px.pop(); pz.pop();
  const N = px.length, cum = new Float64Array(N);
  for (let i = 1; i < N; i++) cum[i] = cum[i - 1] + Math.hypot(px[i] - px[i - 1], pz[i] - pz[i - 1]);
  const L = cum[N - 1] + Math.hypot(px[0] - px[N - 1], pz[0] - pz[N - 1]);
  const tx = new Float64Array(N), tz = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const a = (i - 1 + N) % N, b = (i + 1) % N;
    const dx = px[b] - px[a], dz = pz[b] - pz[a], l = Math.hypot(dx, dz);
    tx[i] = dx / l; tz[i] = dz / l;
  }
  // 曲がり具合（左へ曲がると正）
  const kap = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const a = (i - 1 + N) % N, b = (i + 1) % N;
    const da = wrapA(Math.atan2(tx[b], tz[b]) - Math.atan2(tx[a], tz[a]));
    kap[i] = da / Math.max(0.5, Math.hypot(px[b] - px[a], pz[b] - pz[a]));
  }
  corners.forEach(c => { c.s = cum[c.idx]; const e = c.idx + 14; c.e = e >= N ? L : cum[e]; });
  const segs = P.map((a, i) => ({ a, b: P[(i + 1) % n], style: SEG_STYLE[i] }));
  // 直線区間 j は 角 j-1 の出口 〜 角 j の入口。直線 0 がスタートの通り（segs[7]）
  const straights = corners.map((c, j) => ({ a: j === 0 ? 0 : corners[j - 1].e, b: c.s, seg: (j + n - 1) % n }));

  const course = { px, pz, tx, tz, kap, cum, N, L, corners, segs, straights, P };
  course.prof = buildProfile(course);
  course.grid = buildGrid(course);
  // 壊れて広がった幅（左右 × 区切り）。橋の上は欄干の外が川なので広がらない
  const nb = Math.ceil(L / BIN);
  course.nb = nb;
  course.ext = [new Float32Array(nb), new Float32Array(nb)];
  course.extMax = [new Float32Array(nb).fill(EXT_MAX), new Float32Array(nb).fill(EXT_MAX)];
  const [b0, b1] = course.prof.bridge;
  for (let b = Math.floor((b0 - 6) / BIN); b <= Math.ceil((b1 + 6) / BIN); b++) course.extMax[0][b] = course.extMax[1][b] = 0;
  // 角の内側は広げない（内側へ切り込みすぎると道のりの計算が壊れる）
  for (const c of corners) {
    const inner = c.turn === 'L' ? 0 : 1;
    for (let b = Math.floor((c.s - 8) / BIN); b <= Math.ceil((c.e + 8) / BIN); b++) course.extMax[inner][(b + nb) % nb] = 0;
  }
  return course;
}

// ---------------- 壊れる町 ----------------
export const binOf = (course, s) => Math.floor((((s % course.L) + course.L) % course.L) / BIN) % course.nb;
export const sideOf = lat => (lat > 0 ? 1 : 0);
// s・横ずれ lat の所で走れる幅（道の中心からの距離）
export function wallAt(course, s, lat) { return WALL + course.ext[sideOf(lat)][binOf(course, s)]; }
// 町を壊して幅を depth まで広げる。変わった区切りを out に積む
export function breach(course, s, side, depth, out) {
  const b0 = binOf(course, s), E = course.ext[side], M = course.extMax[side];
  for (let k = -1; k <= 1; k++) {
    const b = (b0 + k + course.nb) % course.nb;
    const d = Math.min(M[b], k ? depth - 1.2 : depth);
    if (d > E[b] + 0.05) { E[b] = d; if (out) out.push(b * 2 + side); }
  }
}
export function resetBreach(course) { course.ext[0].fill(0); course.ext[1].fill(0); }

// 高低差（走行距離 s → 路面の高さ）。角はすべて平ら
function buildProfile(course) {
  const { corners: C, straights: S, L } = course;
  const k = [[0, 0]];
  // スタートの通り: 運河にかかる太鼓橋
  k.push([100, 0], [124, 2.8], [134, 2.8], [158, 0]);
  k.push([C[4].e, 0]);
  // 坂道を上って高台へ（直線 5）
  k.push([C[5].s, 6.0]);
  // 高台の通り（直線 6）: 中ほどにジャンプ台。崖を飛び降りて坂に着地
  const a6 = S[6].a, l6 = S[6].b - S[6].a, j = a6 + l6 * 0.32;
  k.push([j, 6.0], [j + 11, 7.7], [j + 12, 7.7, 'l'], [j + 13.2, 3.0, 'l'], [j + 52, 0.0], [C[6].s, 0]);
  // 参道（直線 7）: 千本鳥居の丘
  const a7 = S[7].a, l7 = S[7].b - S[7].a;
  k.push([a7 + l7 * 0.3, 0], [a7 + l7 * 0.47, 3.4], [a7 + l7 * 0.62, 3.4], [a7 + l7 * 0.8, 0], [L, 0]);
  // ジャンプ台（板張りの小さな踏み切り）と石畳のガタガタ。角を飛び越えないよう、角の手前には置かない
  const kick = [[70, 1.1], [245, 0.9], [396, 0.9], [477, 1.0], [655, 1.3], [765, 1.2], [898, 1.0]]
    .map(([f, h]) => ({ s: f, h, len: 5.5 }));
  const rough = [[S[2].a + 6, S[2].b - 6]];
  return { k, kick, rough, jumpS: j + 12, torii: [a7 + l7 * 0.36, a7 + l7 * 0.72], bridge: [100, 158] };
}
export function heightS(course, s) {
  const L = course.L; s = ((s % L) + L) % L;
  return baseH(course, s) + extraH(course.prof, s);
}
function extraH(prof, s) {
  for (const q of prof.kick) {
    const d = s - q.s;
    if (d < 0 || d > q.len + 0.5) continue;
    return d <= q.len ? q.h * Math.pow(d / q.len, 1.6) : q.h * (1 - (d - q.len) / 0.5);
  }
  for (const [a, b] of prof.rough) if (s > a && s < b) { const w = Math.sin((s - a) / 5 * Math.PI); return 0.24 * w * w; }
  return 0;
}
// 板張りのジャンプ台の上か（見た目用）
export function kickAt(course, s) { for (const q of course.prof.kick) if (s > q.s - 1 && s < q.s + q.len + 1.5) return q; return null; }
function baseH(course, s) {
  const k = course.prof.k;
  for (let i = 1; i < k.length; i++) {
    if (s <= k[i][0]) {
      const [s0, h0] = k[i - 1], [s1, h1, mode] = k[i];
      const t = s1 > s0 ? (s - s0) / (s1 - s0) : 1;
      return lerp(h0, h1, mode === 'l' ? t : smooth(clamp(t, 0, 1)));
    }
  }
  return k[k.length - 1][1];
}

function buildGrid(course) {
  const { px, pz, N } = course;
  const g = { minX: -100, minZ: -60, cs: 2, nx: 180, nz: 195 };
  g.near = new Int16Array(g.nx * g.nz);
  for (let iz = 0; iz < g.nz; iz++) for (let ix = 0; ix < g.nx; ix++) {
    const x = g.minX + (ix + 0.5) * g.cs, z = g.minZ + (iz + 0.5) * g.cs;
    let best = 1e18, bi = 0;
    for (let i = 0; i < N; i++) { const dx = px[i] - x, dz = pz[i] - z, d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } }
    g.near[iz * g.nx + ix] = bi;
  }
  return g;
}

// 位置 → コース上の最寄り（s, 横ずれ, 接線）
export function project(course, x, z, hint = -1, out = {}) {
  const { px, pz, cum, N, L, grid: g } = course;
  let i;
  if (hint >= 0) {
    let best = 1e18; i = hint;
    for (let k = -14; k <= 14; k++) {
      const j = (hint + k + N) % N, dx = px[j] - x, dz = pz[j] - z, d = dx * dx + dz * dz;
      if (d < best) { best = d; i = j; }
    }
  } else {
    const ix = clamp(Math.floor((x - g.minX) / g.cs), 0, g.nx - 1), iz = clamp(Math.floor((z - g.minZ) / g.cs), 0, g.nz - 1);
    i = g.near[iz * g.nx + ix];
  }
  let bestD = 1e18;
  for (const a of [(i - 1 + N) % N, i]) {
    const b = (a + 1) % N;
    const ax = px[a], az = pz[a], dx = px[b] - ax, dz = pz[b] - az, l2 = dx * dx + dz * dz, len = Math.sqrt(l2);
    const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1);
    const qx = ax + dx * t, qz = az + dz * t, d = (x - qx) ** 2 + (z - qz) ** 2;
    if (d < bestD) {
      bestD = d;
      out.i = t > 0.5 ? b : a;
      out.s = (cum[a] + len * t) % L;
      out.tx = dx / len; out.tz = dz / len;
      out.lat = (x - qx) * -out.tz + (z - qz) * out.tx;
    }
  }
  return out;
}

export function sampleS(course, s, o = {}) {
  const { L, N, cum, px, pz, tx, tz } = course;
  s = ((s % L) + L) % L;
  let lo = 0, hi = N - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (cum[m] <= s) lo = m; else hi = m - 1; }
  const j = (lo + 1) % N, sl = (j === 0 ? L : cum[j]) - cum[lo], t = sl > 0 ? (s - cum[lo]) / sl : 0;
  o.x = px[lo] + (px[j] - px[lo]) * t;
  o.z = pz[lo] + (pz[j] - pz[lo]) * t;
  const ax = tx[lo] + (tx[j] - tx[lo]) * t, az = tz[lo] + (tz[j] - tz[lo]) * t, l = Math.hypot(ax, az) || 1;
  o.tx = ax / l; o.tz = az / l; o.i = lo; o.k = course.kap[lo] + (course.kap[j] - course.kap[lo]) * t;
  return o;
}

// 走れる範囲: 各通り（線分）からの距離が WALL 以内の和集合。外に出ていれば押し戻す向きを返す
export function wallQuery(course, x, z, out = {}) {
  let best = 1e18;
  for (const s of course.segs) {
    const ax = s.a.x, az = s.a.z, dx = s.b.x - ax, dz = s.b.z - az, l2 = dx * dx + dz * dz;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1);
    const qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(x - qx, z - qz);
    if (d < best) { best = d; out.d = d; out.nx = d > 1e-6 ? (x - qx) / d : 0; out.nz = d > 1e-6 ? (z - qz) / d : 0; }
  }
  return out;
}

export function nextCorner(course, s) {
  const L = course.L, r = ((s % L) + L) % L;
  for (const c of course.corners) {
    if (r < c.e) return { c, dist: c.s - r, inside: r >= c.s };
  }
  const c = course.corners[0];
  return { c, dist: c.s + L - r, inside: false };
}

// ---------------- だんじり（車両） ----------------
export function newCar(course, s, lane) {
  const c = {
    x: 0, z: 0, y: 0, yaw: 0, vx: 0, vz: 0, vy: 0, w: 0,
    roll: 0, rollV: 0, pitch: 0, pitchV: 0,
    air: false, airT: 0, gVy: 0, slope: 0,
    si: 0, s: 0, u: 0, v: 0, vu: 0, lapBase: 0, prog: 0,
    crashT: 0, crashWhy: '', tipped: false, tipDir: 1,
    boost: 0.35, boosting: false, drift: false, driftT: 0, slip: 0, vF: 0, speed: 0,
    stuckT: 0, wrongT: 0, steerIn: 0, lane,
  };
  placeCar(c, course, s, lane);
  c.lapBase = 0; c.prog = s;
  return c;
}
// スタートの並び: 0〜3 は前列、4〜7 は 12 m 後ろの 2 列目
export const gridS = slot => START_S - (slot >= 4 ? 12 : 0);
export const gridCar = (course, slot) => newCar(course, gridS(slot), LANES[slot % 4]);
export function placeCar(c, course, s, lane = 0) {
  const p = sampleS(course, s);
  c.x = p.x - p.tz * lane; c.z = p.z + p.tx * lane;
  c.yaw = Math.atan2(p.tx, p.tz);
  c.y = heightS(course, s);
  c.vx = c.vz = c.vy = c.w = 0; c.u = lane; c.v = 0; c.vu = 0; c.dirty = false;
  c.roll = c.rollV = c.pitch = c.pitchV = 0;
  c.air = false; c.airT = 0; c.gVy = 0;
  c.crashT = 0; c.tipped = false; c.drift = false; c.driftT = 0;
  c.si = p.i;
  c.s = ((s % course.L) + course.L) % course.L;
  c.prog = c.lapBase + c.s;
  c.respawned = true;
}
export function respawn(c, course) { placeCar(c, course, c.s, clamp(c.u || 0, -(WALL - 3), WALL - 3)); }

function crash(c, why, ev) {
  if (c.crashT > 0) return;
  c.crashWhy = why;
  c.tipped = why === 'tip';
  c.tipDir = c.roll >= 0 ? 1 : -1;
  c.crashT = c.tipped ? 2.0 : 1.2;
  c.boosting = false; c.drift = false;
  c.vx *= 0.35; c.vz *= 0.35; c.vu *= 0.35;
  ev.crash = why;
}

// 道に沿った座標（s: 道のり, u: 横ずれ）で動かす。向きは道が決め、操縦は横の動きと速さ。
// 角では速さの 2 乗に比例して外へ振られる（慣性）。振られて家並みに突っ込めば、だんじりのほうが強いので町が壊れて道が広がる。
const PR = {}, SP = {};
// 跳ね上げる（地面にいる時だけ）。傾きもあおる
function hop(c, vy, ev) {
  if (c.air || c.crashT > 0) return;
  c.air = true; c.airT = 0; c.vy = vy; c.y += 0.02; ev.launch = true; c.hopped = true;
  c.rollV += (Math.random() - 0.5) * vy * 0.5; c.pitchV -= vy * 0.25;
}
export function fromWorld(c, course) {
  project(course, c.x, c.z, c.si, PR);
  const ds = PR.s - c.s;
  if (ds < -course.L / 2) c.lapBase += course.L; else if (ds > course.L / 2) c.lapBase -= course.L;
  c.s = PR.s; c.si = PR.i; c.u = PR.lat; c.prog = c.lapBase + c.s;
  c.v = c.vx * PR.tx + c.vz * PR.tz; c.vu = c.vx * -PR.tz + c.vz * PR.tx;
  c.dirty = false;
}
export function stepCar(c, inp, dt, course) {
  const ev = { wall: 0, smash: 0, breaks: [], land: 0, airT: 0, launch: false, crash: null, driftEnd: 0, wallX: 0, wallZ: 0 };
  if (c.dirty) fromWorld(c, course);
  if (c.hopReq) { hop(c, c.hopReq, ev); c.hopReq = 0; }
  let thr = clamp(inp.throttle || 0, 0, 1), brk = clamp(inp.brake || 0, 0, 1), st = clamp(inp.steer || 0, -1, 1);
  c.steerIn = st;
  if (c.crashT > 0) {
    c.crashT -= dt; thr = brk = 0; st = 0;
    if (c.crashT <= 0) { c.crashT = 0; if (c.tipped) respawn(c, course); }
  }
  sampleS(course, c.s, SP);
  const kap = SP.k;
  // 気合（ブースト）とやりまわし
  c.boosting = !!inp.boost && c.boost > 0.01 && c.crashT <= 0;
  if (c.boosting) { c.boost = Math.max(0, c.boost - CAR.BOOST_USE * dt); thr = 1; }
  // やりまわしは角で勝手に始まる（逆に切っている時と遅い時は除く）
  let wantDrift = !!inp.drift;
  if (inp.autoDrift && !c.air && c.v > 9) {
    sampleS(course, c.s + 4 + c.v * 0.15, SP);
    if (Math.abs(SP.k) > 0.02 && st * Math.sign(SP.k) > -0.35) { wantDrift = true; c.driftK = SP.k; }
  }
  const drifting = wantDrift && !c.air && c.v > 7 && c.crashT <= 0;
  // 跳ねて宙に浮いている間はやりまわしが続いている扱い（着地して角を抜けたら成功）
  if (!c.air || c.crashT > 0) {
    if (c.drift && !drifting) { if (c.driftT > 0.5 && c.crashT <= 0) ev.driftEnd = c.driftT; c.driftT = 0; }
    c.drift = drifting;
  } else if (c.drift) c.driftT += dt;
  // 前後
  const vmax = c.boosting ? CAR.BOOST_VMAX : CAR.VMAX, acc = c.boosting ? CAR.BOOST_ACC : CAR.ACC;
  let v = c.v;
  if (!c.air) {
    if (thr > 0 && v < vmax) v = Math.min(vmax, v + thr * acc * (1 - Math.max(0, v) / vmax * 0.6) * dt);
    if (v > vmax) v -= (v - vmax) * 1.0 * dt;
    if (brk > 0) {
      if (v > 0.3) v = Math.max(0, v - CAR.BRAKE * brk * dt);
      else v = Math.max(-CAR.REV_MAX, v - acc * 0.5 * brk * dt);
    }
    const res = CAR.ROLL_FRIC + CAR.AIR_DRAG * v * v + (thr || brk ? 0 : 4.5);   // 何も押さなければ引き手が足を止めて止まる
    if (v > 0) v = Math.max(0, v - res * dt); else if (v < 0) v = Math.min(0, v + res * dt);
    if (drifting) v -= v * 0.06 * dt;
    v -= c.slope * 9.8 * dt;
  }
  // 横: 操縦で横へ寄せる力と、角で外へ振られる力
  const geo = Math.max(0.55, 1 + kap * c.u);           // 外側ほど回り道（道のりの進みが遅い）
  const fling = c.air ? 0 : kap * v * Math.abs(v) / geo * CAR.FLING * (drifting ? 0.42 : 1) * (c.crashT > 0 ? 0.3 : 1);
  const steerA = (c.air ? 0.25 : 1) * (CAR.STEER_A + Math.min(Math.abs(v), 30) * CAR.STEER_V) * Math.min(1, Math.abs(v) / 4 + 0.15);
  const aU = -st * steerA * (v < -0.5 ? -1 : 1) + fling;
  c.vu += aU * dt;
  c.vu *= Math.exp(-dt * (c.air ? 0.3 : drifting ? 1.6 : CAR.U_DAMP));
  // やりまわし中は車輪が浮いてポンポン跳ねる
  if (drifting && v > 15 && Math.floor((c.driftT + dt) / 0.6) > Math.floor(c.driftT / 0.6)) hop(c, 2.2 + v * 0.07, ev);
  if (drifting) { c.driftT += dt; c.boost = Math.min(1, c.boost + (0.05 + Math.min(0.35, Math.abs(kap) * v * 0.25)) * dt); }
  // 進める
  c.u += c.vu * dt;
  const s0 = c.s, lb0 = c.lapBase;
  c.s = c.s + v / geo * dt;
  if (c.s >= course.L) { c.s -= course.L; c.lapBase += course.L; } else if (c.s < 0) { c.s += course.L; c.lapBase -= course.L; }
  c.prog = c.lapBase + c.s;
  // 壁（人垣・家並み）。勢いがあれば壊して突き進む
  const side = sideOf(c.u), au = Math.abs(c.u), b = binOf(course, c.s);
  const lim = WALL + course.ext[side][b] - CAR.HALF;
  if (au > lim) {
    const out = c.vu * Math.sign(c.u), pen = au - lim;
    const power = Math.max(0, out) + Math.max(0, v) * 0.4;
    if (power > CAR.BREAK_V && course.ext[side][b] < course.extMax[side][b] - 0.05) {
      breach(course, c.s, side, au + CAR.HALF - WALL + 1.6 + Math.max(0, out) * 0.12, ev.breaks);
      if (out > 0) c.vu *= 0.75;
      v *= 1 - Math.min(0.1, 0.035 + Math.max(0, out) * 0.004);
      ev.smash = Math.max(ev.smash, power);
      if (power > 7 && Math.random() < 0.12) hop(c, 3.5 + Math.random() * 4, ev);   // 家を突き破って跳ねる
    } else if (pen > 1.2 && (WALL + course.ext[side][binOf(course, s0)] - CAR.HALF) > au - 0.3) {
      // 壊せない所（角の内側の家・橋の欄干）に前から突っ込んだ: 止まる
      c.s = s0; c.lapBase = lb0; c.prog = c.lapBase + c.s;
      if (Math.abs(v) > ev.wall) ev.wall = Math.abs(v);
      v = -v * 0.15; c.vu *= 0.5;
    } else {
      c.u -= Math.sign(c.u) * Math.min(pen, Math.max(0.6, pen * 0.5));
      if (out > 0) {
        c.vu = -Math.sign(c.u) * out * 0.3;
        if (out > ev.wall) ev.wall = out;
      }
      if (pen > 0.05 || out > 0.5) { v *= 1 - dt * 0.8; ev.wall = Math.max(ev.wall, 1 + Math.abs(v) * 0.12); }
    }
    if (ev.wall || ev.smash) {
      sampleS(course, c.s, SP); const eu = Math.sign(c.u) * (au + CAR.HALF);
      ev.wallX = SP.x - SP.tz * eu; ev.wallZ = SP.z + SP.tx * eu;
    }
  }
  if (ev.wall > CAR.CRASH_V) crash(c, 'wall', ev);
  if (c.crashT > 0 && ev.crash) v *= 0.35;
  c.v = v;
  // 世界座標へ
  sampleS(course, c.s, SP);
  c.si = SP.i;
  c.x = SP.x - SP.tz * c.u; c.z = SP.z + SP.tx * c.u;
  const tYaw = Math.atan2(SP.tx, SP.tz);
  c.vx = SP.tx * v - SP.tz * c.vu; c.vz = SP.tz * v + SP.tx * c.vu;
  // 見た目の向き: 道の向き + 横へ流れる分 + やりまわしの振り出し
  // やりまわし: 角がきついほど・速いほど後ろを大きく振り出す（頭が内を向く）
  const kd = Math.abs(kap) > 0.01 ? kap : (c.driftK || 0);
  const swing = drifting ? (Math.abs(kd) > 0.01 ? Math.sign(kd) * clamp(Math.abs(kd) * Math.abs(v) * 0.62, 0.35, 1.0) : st * 0.3) : 0;
  const yawT = tYaw - Math.atan2(c.vu, Math.max(8, Math.abs(v))) * 0.85 + swing + st * 0.08 * (c.air ? 0 : 1);
  const prevYaw = c.yaw;
  c.yaw = wrapA(c.yaw + wrapA(yawT - c.yaw) * Math.min(1, dt * (drifting ? 5 : 9)));
  c.w = wrapA(c.yaw - prevYaw) / dt;

  // 高さ・ジャンプ
  const gh = heightS(course, c.s);
  const dh = (heightS(course, c.s + 1) - heightS(course, c.s - 1)) / 2;
  c.slope = dh;
  if (!c.air) {
    const gVy = (gh - c.y) / dt;
    if (c.gVy - gVy > CAR.G * dt * 1.15 && !c.respawned) {
      c.air = true; c.airT = 0; c.vy = c.gVy; c.y += c.vy * dt; ev.launch = true;
    } else { c.y = gh; c.gVy = clamp(gVy, -40, 40); }
    c.respawned = false;
  } else {
    c.vy -= CAR.G * dt; c.y += c.vy * dt; c.airT += dt;
    if (c.airT > 0.25) c.boost = Math.min(1, c.boost + 0.3 * dt);
    if (c.y <= gh) {
      const groundVy = dh * v;
      const imp = Math.max(0, groundVy - c.vy);
      c.y = gh; c.air = false; c.gVy = groundVy;
      ev.land = imp; ev.airT = c.airT;
      c.pitchV += imp * 0.12; c.rollV += (Math.random() - 0.5) * imp * 0.25;
      if (imp > CAR.LAND_CRASH) crash(c, 'land', ev);
      else {
        if (c.airT > 0.6) c.boost = Math.min(1, c.boost + 0.1);
        // 強く着地したら弾む（2〜3 回）
        if (imp > 5) { c.air = true; c.airT = 0; c.vy = groundVy + imp * 0.36; c.y = gh + 0.01; }
      }
    }
  }

  // 傾き（ロール・ピッチ）: 左へ曲がる加速度で右の車輪が浮く
  c.vF = v; c.speed = Math.hypot(v, c.vu); c.slip = Math.abs(c.vu) + (drifting ? 3 : 0);
  const aLeft = c.air ? 0 : kap * v * v * 0.75 + st * steerA * 0.35;
  let rollT = 0;
  if (c.crashT > 0 && c.tipped) rollT = c.tipDir * 1.5;
  else if (!c.air) rollT = clamp(aLeft * CAR.ROLL_K * (drifting ? 0.62 : 1), -1.0, 1.0);
  c.rollV += (38 * (rollT - c.roll) - 5 * c.rollV) * dt * (c.air ? 0.3 : 1);
  c.roll += c.rollV * dt;
  if (Math.abs(c.roll) > CAR.TIP && c.crashT <= 0) crash(c, 'tip', ev);
  const pitchT = c.air ? -Math.atan2(c.vy, Math.max(4, Math.abs(v))) * 0.5 : -Math.atan(c.slope) + clamp((thr - brk) * 0.03, -0.05, 0.05);
  c.pitchV += (30 * (pitchT - c.pitch) - 6 * c.pitchV) * dt;
  c.pitch += c.pitchV * dt;

  // 立ち往生
  if (!c.air && c.crashT <= 0 && c.speed < 1 && thr > 0.5) { c.stuckT += dt; if (c.stuckT > 2.5) { c.stuckT = 0; respawn(c, course); } } else c.stuckT = 0;
  c.wrongT = 0;
  return ev;
}

// 車どうしの当たり（2 円 × 2 円）。moveB=false なら a だけ動かす
export function collideCars(a, b, moveB = true) {
  if (Math.abs(a.y - b.y) > 2.2) return 0;
  let imp = 0;
  const af = [Math.sin(a.yaw), Math.cos(a.yaw)], bf = [Math.sin(b.yaw), Math.cos(b.yaw)];
  for (const oa of [CAR_OFF, -CAR_OFF]) for (const ob of [CAR_OFF, -CAR_OFF]) {
    const ax = a.x + af[0] * oa, az = a.z + af[1] * oa, bx = b.x + bf[0] * ob, bz = b.z + bf[1] * ob;
    const dx = ax - bx, dz = az - bz, d = Math.hypot(dx, dz), min = CAR_R * 1.9;
    if (d >= min || d < 1e-5) continue;
    const nx = dx / d, nz = dz / d, pen = min - d;
    if (moveB) { a.x += nx * pen / 2; a.z += nz * pen / 2; b.x -= nx * pen / 2; b.z -= nz * pen / 2; }
    else { a.x += nx * pen; a.z += nz * pen; }
    a.dirty = true; if (moveB) b.dirty = true;
    const vrel = (a.vx - (b.vx || 0)) * nx + (a.vz - (b.vz || 0)) * nz;
    if (vrel < 0) {
      const j = -vrel * 0.75;
      if (moveB) { a.vx += nx * j / 2; a.vz += nz * j / 2; b.vx -= nx * j / 2; b.vz -= nz * j / 2; }
      else { a.vx += nx * j; a.vz += nz * j; }
      imp = Math.max(imp, -vrel);
      if (-vrel > 5) { const k = Math.min(6, -vrel * 0.45); a.hopReq = Math.max(a.hopReq || 0, k); if (moveB) b.hopReq = Math.max(b.hopReq || 0, k * 0.8); }
    }
  }
  return imp;
}

// ---------------- CPU の操縦 ----------------
export function makeAI(k) {
  const presets = [
    { top: 1.0, cornerV: 30, drift: 1.0, boost: 0.8 },
    { top: 0.98, cornerV: 27, drift: 0.75, boost: 0.6 },
    { top: 0.96, cornerV: 25, drift: 0.5, boost: 0.5 },
  ];
  return { ...presets[k % 3], laneBias: (k % 2 ? 1 : -1) * 3, seed: Math.random() * 100, t: 0 };
}
const AS = {};
export function aiInput(c, course, ai, dt = 1 / 60) {
  ai.t += dt;
  const v = c.v || 0;
  const nc = nextCorner(course, c.s);
  // 狙う横位置: ふだんは自分の筋、角の手前は外、角の中は内へ
  let uT = ai.laneBias + Math.sin(ai.t * 0.3 + ai.seed) * 2;
  const inSign = nc.c.turn === 'L' ? -1 : 1;
  if (!nc.inside && nc.dist < 50) uT = lerp(uT, -inSign * 5, 1 - Math.max(0, nc.dist) / 50);
  if (nc.inside) uT = inSign * 4.5;
  sampleS(course, c.s + 4 + v * 0.35, AS);
  const fling = AS.k * v * v * CAR.FLING * (c.drift ? 0.42 : 1);
  const steerA = CAR.STEER_A + Math.min(v, 30) * CAR.STEER_V;
  const steer = clamp((fling - ((uT - c.u) * 2.2 - c.vu * 1.6)) / steerA, -1, 1);
  let vT = CAR.VMAX * ai.top;
  if (nc.dist < 70) vT = Math.min(vT, Math.sqrt(ai.cornerV ** 2 + 2 * 18 * Math.max(0, nc.dist - 4)));
  if (nc.inside) vT = Math.min(vT, ai.cornerV);
  const throttle = v < vT ? 1 : 0;
  const brake = v > vT + 2 ? clamp((v - vT) / 6, 0, 1) : 0;
  const drift = (nc.inside || nc.dist < 6) && v > 14 && hash(ai.seed + Math.floor(c.prog / 150)) < ai.drift;
  const boost = c.boost > 0.55 && nc.dist > 90 && hash(ai.seed * 3 + Math.floor(c.prog / 200)) < ai.boost;
  return { throttle, brake, steer, drift, boost, autoDrift: true };
}
