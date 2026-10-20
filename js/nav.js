// 曲がり角のナビ: 角の手前から、道の上に「この線をなぞれば速く曲がれる」光る筋を出す（アウト → イン → アウト）
import * as THREE from 'three';
import * as SIM from './sim.js?v=218';

const OUT = 7, IN = 7.5, EXIT = 6.5;   // 道の中心からの横ずれ（m）: 入口は外側・角の頂点は内側・出口はまた外側
const STEP = 1;                        // 筋の細かさ（m ごと）
const WIDTH = 1.7;                     // 筋の太さ（m）
const AHEAD = 120;                     // 何 m 先まで見せるか

// 走りの線（道のりごとの横ずれ）を、角ごとの目印をつないで作る
function racingLine(course) {
  const { L, corners } = course, o = {};
  const keys = [];
  for (const c of corners) {
    const a = (c.s + c.e) / 2;
    SIM.sampleS(course, a, o);
    const out = Math.sign((c.c.x - o.x) * -o.tz + (c.c.z - o.z) * o.tx) || 1;   // 角の頂点（町の角）がある側 = 外側
    keys.push({ s: c.s - 70, v: 0, p: 1 }, { s: c.s - 12, v: OUT * out, p: 2 }, { s: a, v: -IN * out, p: 3 }, { s: c.e + 18, v: EXIT * out, p: 2 }, { s: c.e + 65, v: 0, p: 1 });
  }
  // 1 周をまたいでもつながるよう前後の周にも並べ、近すぎる目印を整理する
  let K = [-L, 0, L].flatMap(d => keys.map(k => ({ ...k, s: k.s + d }))).sort((a, b) => a.s - b.s);
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i + 1 < K.length; i++) {
      const a = K[i], b = K[i + 1];
      if (b.s - a.s >= 22) continue;
      if (a.p !== b.p) K.splice(a.p < b.p ? i : i + 1, 1);
      else if (a.p === 2 && Math.sign(a.v) === Math.sign(b.v)) K.splice(i, 2, { s: (a.s + b.s) / 2, v: (a.v + b.v) / 2, p: 2 });   // 同じ向きに続く角: 外側のまま
      else if (a.p === 2) K.splice(i, 2);   // 逆向きに続く角（S 字）: 頂点から頂点へまっすぐ
      else K.splice(i + 1, 1);
      changed = true; break;
    }
  }
  const lat = s => {
    let i = 0; while (i + 1 < K.length && K[i + 1].s <= s) i++;
    const a = K[i], b = K[i + 1] || a, t = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
    return a.v + (b.v - a.v) * (0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t))));
  };
  // 見せるのは角のまわりだけ（入口の少し前 〜 出口の少し後）
  const mask = s => {
    let m = 0;
    for (const c of corners) for (const d of [-L, 0, L]) {
      const s0 = c.s + d - 60, s1 = c.e + d + 40;
      if (s > s0 - 12 && s < s1 + 12) m = Math.max(m, Math.min(1, (s - (s0 - 12)) / 12, ((s1 + 12) - s) / 12));
    }
    return m;
  };
  return { lat, mask };
}

export function makeNavLine(course) {
  const { lat, mask } = racingLine(course);
  const n = Math.ceil(course.L / STEP) + 1, o = {};
  const pos = new Float32Array(n * 2 * 3), aS = new Float32Array(n * 2), aU = new Float32Array(n * 2), aM = new Float32Array(n * 2), idx = [];
  for (let i = 0; i < n; i++) {
    const s = Math.min(i * STEP, course.L);
    SIM.sampleS(course, s, o);
    const v = lat(s), nx = -o.tz, nz = o.tx, y = SIM.heightS(course, s) + 0.14;
    for (let k = 0; k < 2; k++) {
      const w = (k ? 0.5 : -0.5) * WIDTH, j = i * 2 + k;
      pos.set([o.x + nx * (v + w), y, o.z + nz * (v + w)], j * 3);
      aS[j] = s; aU[j] = k; aM[j] = mask(s);
    }
    if (i + 1 < n) { const j = i * 2; idx.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
  g.setAttribute('aU', new THREE.BufferAttribute(aU, 1));
  g.setAttribute('aM', new THREE.BufferAttribute(aM, 1));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uS: { value: 0 }, uL: { value: course.L }, uT: { value: 0 }, uOn: { value: 0 }, uCol: { value: new THREE.Color(0x14d8ff) } },
    vertexShader: `attribute float aS, aU, aM; varying float vS, vU, vM; void main() { vS = aS; vU = aU; vM = aM; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uS, uL, uT, uOn; uniform vec3 uCol; varying float vS, vU, vM;
      void main() {
        float d = mod(vS - uS + uL, uL);
        float win = smoothstep(2.0, 10.0, d) * (1.0 - smoothstep(${AHEAD - 30}.0, ${AHEAD}.0, d));
        float x = abs(vU * 2.0 - 1.0), edge = 1.0 - smoothstep(0.75, 1.0, x), core = 1.0 - smoothstep(0.0, 0.35, x);
        float flow = smoothstep(0.45, 0.9, fract((vS - uT * 22.0) / 7.0));   // 進む向きへ流れる光
        float a = win * vM * edge * (0.7 + 0.3 * flow) * uOn;
        if (a < 0.01) discard;
        gl_FragColor = vec4(mix(uCol, vec3(1.0), core * 0.6 + flow * 0.3), a * 0.9);
      }`,
    transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 3;
  return {
    mesh,
    // s: 自分のだんじりの道のり / on: 出すか（レース中だけ）。出し入れはふわっと
    update(s, t, on, dt) {
      const u = mat.uniforms;
      u.uS.value = ((s % course.L) + course.L) % course.L; u.uT.value = t;
      u.uOn.value += ((on ? 1 : 0) - u.uOn.value) * Math.min(1, dt * 4);
      mesh.visible = u.uOn.value > 0.01;
    },
  };
}
