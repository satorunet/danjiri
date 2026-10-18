// 描画の下ごしらえ: トゥーン材質・輪郭線・アトラス・手描きのキャンバステクスチャ
import * as THREE from 'three';

export const FONT = "'Dela Gothic One', 'Zen Kaku Gothic New', 'Hiragino Sans', sans-serif";
export const SERIF = "'Yuji Syuku', 'Zen Old Mincho', 'Hiragino Mincho ProN', serif";
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[Math.floor(Math.random() * a.length)];

// ---------------- トゥーン ----------------
export const gradient = (() => {
  const d = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
})();
export function toon(p = {}) {
  return new THREE.MeshToonMaterial({ gradientMap: gradient, ...p });
}

// 裏面を法線方向へ膨らませた輪郭線（InstancedMesh でも動く）
const outlineCache = new Map();
export function outlineMat(thick = 0.03, color = 0x15101a) {
  const key = thick + ':' + color;
  if (outlineCache.has(key)) return outlineCache.get(key);
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normalize(normal) * ${thick.toFixed(4)};`);
  };
  m.customProgramCacheKey = () => 'outline' + key;
  outlineCache.set(key, m);
  return m;
}
// 画質「軽い」では輪郭線を全部消す
export function setOutlines(on) { for (const m of outlineCache.values()) m.visible = on; }
// 通常の Mesh は子として付ける。InstancedMesh は行列を共有した双子を返すので、呼び出し側が同じ親へ add する
export function withOutline(mesh, thick = 0.03) {
  let o;
  if (mesh.isInstancedMesh) {
    o = new THREE.InstancedMesh(mesh.geometry, outlineMat(thick), mesh.instanceMatrix.count);
    o.instanceMatrix = mesh.instanceMatrix; o.count = mesh.count; o.frustumCulled = mesh.frustumCulled;
  } else {
    o = new THREE.Mesh(mesh.geometry, outlineMat(thick));
    mesh.add(o);
  }
  o.castShadow = false; o.receiveShadow = false;
  mesh.userData.outline = o;
  return o;
}

// アトラス: インスタンスごとに タイル位置(xy) と 繰り返し回数(zw) を持つ
export function atlasify(mat, cols, rows) {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute vec4 aAtlas;\nvarying vec4 vAtlas;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvAtlas = aAtlas;');
    // キャンバスの行は上から数えるので、UV では上下を反転する
    const samp = n => `vec2 ${n} = (vec2(vAtlas.x, ${(rows - 1).toFixed(1)} - vAtlas.y) + 0.015 + fract(vMapUv * vAtlas.zw) * 0.97) / vec2(${cols.toFixed(1)}, ${rows.toFixed(1)});`;
    sh.fragmentShader = 'varying vec4 vAtlas;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `#ifdef USE_MAP\n${samp('auv')}\nvec4 sampledDiffuseColor = texture2D(map, auv);\ndiffuseColor *= sampledDiffuseColor;\n#endif`)
      .replace('#include <emissivemap_fragment>', `#ifdef USE_EMISSIVEMAP\n${samp('auvE')}\ntotalEmissiveRadiance *= texture2D(emissiveMap, auvE).rgb;\n#endif`);
  };
  mat.customProgramCacheKey = () => `atlas${cols}x${rows}`;
  return mat;
}
export function atlasAttr(mesh, n) {
  const a = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
  mesh.geometry = mesh.geometry.clone();
  mesh.geometry.setAttribute('aAtlas', a);
  return a;
}

export function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (opts.nomip) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
  return t;
}
export function colored(geo, r, g, b) {
  geo = geo.index ? geo : geo;
  const n = geo.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = r; c[i * 3 + 1] = g; c[i * 3 + 2] = b; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return geo;
}
export const hex = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
export const col = (geo, h) => colored(geo, ...hex(h));

// ---------------- 文字・模様の小道具 ----------------
function noise(g, w, h, n, a, cols) {
  for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.globalAlpha = a * Math.random(); g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  g.globalAlpha = 1;
}
function vtext(g, text, x, y, size, step, fill, stroke, sw) {
  g.font = `${size}px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  [...text].forEach((ch, i) => {
    if (stroke) { g.lineWidth = sw; g.strokeStyle = stroke; g.strokeText(ch, x, y + i * step); }
    g.fillStyle = fill; g.fillText(ch, x, y + i * step);
  });
}
function kiri(g, x, y, r, c) { // 桐紋っぽい花の紋
  g.fillStyle = c;
  g.beginPath(); g.arc(x, y + r * 0.35, r * 0.28, 0, Math.PI * 2); g.fill();
  for (let i = -1; i <= 1; i++) {
    g.beginPath(); g.ellipse(x + i * r * 0.45, y - r * 0.25 - (i ? 0 : r * 0.12), r * 0.18, r * 0.34, i * 0.35, 0, Math.PI * 2); g.fill();
  }
  g.beginPath(); g.moveTo(x - r * 0.9, y + r * 0.2); g.quadraticCurveTo(x, y + r * 1.1, x + r * 0.9, y + r * 0.2); g.quadraticCurveTo(x, y + r * 0.7, x - r * 0.9, y + r * 0.2); g.fill();
}

// ---------------- だんじり・人のテクスチャ ----------------
export function lanternTex(kanji = '祭', band = '#d0261c') {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#fbf5e6'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 4; i++) { gr.addColorStop(i / 4, 'rgba(0,0,0,0.0)'); if (i < 4) gr.addColorStop(i / 4 + 0.125, 'rgba(120,90,40,0.10)'); }
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(140,110,70,0.22)'; for (let y = 8; y < h; y += 13) g.fillRect(0, y, w, 2);
    g.fillStyle = band; g.fillRect(0, 0, w, h * 0.17); g.fillRect(0, h * 0.83, w, h * 0.17);
    g.fillStyle = '#fbf5e6'; g.fillRect(0, h * 0.17, w, 5); g.fillRect(0, h * 0.83 - 5, w, 5);
    for (const x of [w * 0.25, w * 0.75]) {
      g.font = `bold ${h * 0.5}px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 6; g.strokeStyle = '#2a0c08'; g.strokeText(kanji, x, h * 0.52);
      g.fillStyle = band; g.fillText(kanji, x, h * 0.52);
    }
  });
}
export function bannerTex(team, text = '御祭禮') {
  return canvasTex(256, 768, (g, w, h) => {
    const sq = 16;
    for (let y = 0; y < h; y += sq) for (let x = 0; x < w; x += sq) {
      const edge = x < sq * 2 || x >= w - sq * 2 || y < sq * 2 || y >= h - sq * 2;
      if (edge) { g.fillStyle = ((x + y) / sq) % 2 ? '#111' : '#f6f2ea'; g.fillRect(x, y, sq, sq); }
    }
    g.fillStyle = '#c71f17'; g.fillRect(sq * 2, sq * 2, w - sq * 4, h - sq * 4);
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = sq * 2; y < h - sq * 2; y += 6) g.fillRect(sq * 2, y, w - sq * 4, 1);
    g.strokeStyle = '#f2c14e'; g.lineWidth = 4; g.strokeRect(sq * 2 + 8, sq * 2 + 8, w - sq * 4 - 16, h - sq * 4 - 16);
    kiri(g, w / 2, 120, 52, '#f2c14e');
    // 幟の文字（カスタムで 1〜4 文字）。文字数に合わせて大きさと間隔を変える
    const ch = [...(text || '御祭禮')].slice(0, 4), n = ch.length, size = [0, 170, 150, 120, 100][n], step = [0, 0, 190, 150, 118][n];
    vtext(g, ch.join(''), w / 2, 420 - (n - 1) * step / 2, size, step, '#f6d36a', '#3a0a06', 10);
    g.fillStyle = team.css; g.beginPath(); g.arc(w / 2, h - 88, 34, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#f6d36a'; g.lineWidth = 4; g.stroke();
    g.font = `52px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(team.kanji, w / 2, h - 86);
  });
}
export function happiTex(team) {
  // 左半分が前、右半分が背中
  return canvasTex(512, 256, (g, w, h) => {
    const base = team.happi || team.css;
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    noise(g, w, h, 3000, 0.25, ['#000', '#fff']);
    // 前: 白い襟と町名
    for (const x of [w * 0.25 - 26, w * 0.25 + 10]) { g.fillStyle = '#f4efe2'; g.fillRect(x, 0, 16, h); }
    g.font = `22px ${SERIF}`; g.fillStyle = '#1a1a1a'; g.textAlign = 'center';
    [...team.name].forEach((ch, i) => g.fillText(ch, w * 0.25 - 18, 40 + i * 26));
    // 裾の模様（角つなぎ）
    for (const ox of [0, w / 2]) {
      g.fillStyle = '#f4efe2'; g.fillRect(ox, h - 46, w / 2, 6);
      for (let x = ox; x < ox + w / 2; x += 20) { g.save(); g.translate(x + 10, h - 22); g.rotate(Math.PI / 4); g.strokeStyle = '#f4efe2'; g.lineWidth = 3; g.strokeRect(-6, -6, 12, 12); g.restore(); }
    }
    // 背中: 大紋
    const cx = w * 0.75, cy = h * 0.42;
    g.fillStyle = '#f4efe2'; g.beginPath(); g.arc(cx, cy, 70, 0, Math.PI * 2); g.fill();
    g.fillStyle = base; g.beginPath(); g.arc(cx, cy, 60, 0, Math.PI * 2); g.fill();
    g.font = `bold 92px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 8; g.strokeStyle = '#f4efe2'; g.strokeText('祭', cx, cy + 4);
    g.fillStyle = '#d42a1e'; g.fillText('祭', cx, cy + 4);
    g.font = `26px ${FONT}`; g.fillStyle = '#f4efe2'; g.fillText(team.name, cx, h - 70);
  });
}
export function carveTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#6e4423'; g.fillRect(0, 0, w, h);
    const panel = (x, y, pw, ph) => {
      g.fillStyle = '#5a361b'; g.fillRect(x, y, pw, ph);
      for (let i = 0; i < 26; i++) {
        const cx = x + Math.random() * pw, cy = y + Math.random() * ph, r = rand(10, 34), a0 = Math.random() * 6;
        for (const [ox, oy, c, lw] of [[3, 3, 'rgba(20,8,0,0.8)', 7], [-1.5, -1.5, 'rgba(230,170,100,0.55)', 4], [0, 0, '#8a5730', 4]]) {
          g.strokeStyle = c; g.lineWidth = lw; g.beginPath();
          for (let t = 0; t < 2.6; t += 0.08) { const rr = r * (1 - t / 3.2); const px = cx + ox + Math.cos(a0 + t * 3) * rr, py = cy + oy + Math.sin(a0 + t * 3) * rr; t ? g.lineTo(px, py) : g.moveTo(px, py); }
          g.stroke();
        }
      }
      // 波
      for (let yy = y + ph - 30; yy < y + ph - 6; yy += 10) {
        g.strokeStyle = 'rgba(230,170,100,0.5)'; g.lineWidth = 3; g.beginPath();
        for (let xx = x; xx < x + pw; xx += 4) g.lineTo(xx, yy + Math.sin(xx * 0.12) * 4);
        g.stroke();
      }
      g.strokeStyle = '#e8b445'; g.lineWidth = 6; g.strokeRect(x + 3, y + 3, pw - 6, ph - 6);
      g.strokeStyle = '#2a1406'; g.lineWidth = 3; g.strokeRect(x + 10, y + 10, pw - 20, ph - 20);
    };
    panel(8, 8, w / 2 - 12, h / 2 - 12); panel(w / 2 + 4, 8, w / 2 - 12, h / 2 - 12);
    panel(8, h / 2 + 4, w / 2 - 12, h / 2 - 12); panel(w / 2 + 4, h / 2 + 4, w / 2 - 12, h / 2 - 12);
  });
}
export function woodTex(base = '#7a4a26', dark = '#4f2e15') {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = Math.random() < 0.6 ? dark : 'rgba(255,220,170,0.25)'; g.globalAlpha = rand(0.2, 0.6); g.lineWidth = rand(1, 3);
      g.beginPath(); const y = Math.random() * h; g.moveTo(0, y);
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 3);
      g.stroke();
    }
    g.globalAlpha = 1;
  }, { repeat: true });
}
export function stripeTex(a = '#d42a1e', b = '#f7f2e8', diag = true) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = b; g.fillRect(0, 0, w, h);
    g.fillStyle = a;
    for (let k = -2; k < 4; k++) {
      g.beginPath();
      if (diag) { g.moveTo(k * 64, 0); g.lineTo(k * 64 + 32, 0); g.lineTo(k * 64 + 32 + 128, h); g.lineTo(k * 64 + 128, h); }
      else { g.rect(k * 64, 0, 32, h); }
      g.fill();
    }
  }, { repeat: true });
}
export function ropeTex() {
  return canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#c9a25a'; g.fillRect(0, 0, w, h);
    for (let x = -h; x < w + h; x += 22) {
      const gr = g.createLinearGradient(x, 0, x + 22, 0);
      gr.addColorStop(0, '#7a5a26'); gr.addColorStop(0.45, '#f0d08a'); gr.addColorStop(1, '#8a6a30');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x, h); g.lineTo(x + 22, h); g.lineTo(x + 22 + h * 0.8, 0); g.lineTo(x + h * 0.8, 0); g.fill();
    }
  }, { repeat: true });
}
export function shideGeo(size = 1) {
  // 紙垂（ジグザグの白い紙）
  const s = new THREE.Shape(), k = size, wv = 0.16 * k;
  const pts = [[0, 0], [wv, 0], [wv, -0.25 * k], [wv * 2.2, -0.25 * k], [wv * 2.2, -0.5 * k], [wv * 3.4, -0.5 * k], [wv * 3.4, -0.78 * k], [wv * 2.4, -0.78 * k], [wv * 2.4, -0.58 * k], [wv * 1.2, -0.58 * k], [wv * 1.2, -0.33 * k], [0, -0.33 * k]];
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false });
  g.translate(-wv * 1.7, 0, 0);
  return g;
}

// ---------------- 町のテクスチャ ----------------
export function asphaltTex(lines = true) {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#6d6f73'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 16000, 0.35, ['#4b4d52', '#8a8c90', '#5c5e63']);
    for (let i = 0; i < 6; i++) { g.strokeStyle = 'rgba(40,40,44,0.35)'; g.lineWidth = rand(1, 3); g.beginPath(); let x = Math.random() * w, y = 0; g.moveTo(x, y); while (y < h) { x += rand(-20, 20); y += rand(20, 60); g.lineTo(x, y); } g.stroke(); }
    if (lines) {
      g.fillStyle = '#f2f2ee';
      const u = x => x / 14 * w;
      g.fillRect(u(0.45), 0, 9, h); g.fillRect(u(13.55) - 9, 0, 9, h);
      g.fillRect(w / 2 - 5, 0, 10, h * 0.5);
    }
  }, { repeat: true });
}
export function stoneTex(c1 = '#b7aea0', c2 = '#8f877b') {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = c2; g.fillRect(0, 0, w, h);
    const rows = 8;
    for (let r = 0; r < rows; r++) {
      let x = (r % 2) * -40;
      while (x < w) {
        const sw = rand(60, 120), y = r * h / rows;
        const l = rand(-12, 12) | 0;
        g.fillStyle = `rgb(${parseInt(c1.slice(1, 3), 16) + l},${parseInt(c1.slice(3, 5), 16) + l},${parseInt(c1.slice(5, 7), 16) + l})`;
        g.fillRect(x + 3, y + 3, sw - 6, h / rows - 6);
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 3, y + 3, sw - 6, 3);
        x += sw;
      }
    }
    noise(g, w, h, 9000, 0.25, ['#000', '#fff']);
  }, { repeat: true });
}
export function tileWalkTex() {
  return canvasTex(256, 256, (g, w, h) => {
    const cs = ['#9b8e86', '#a89a8f', '#8c7f78', '#b0786a'];
    for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) { g.fillStyle = cs[((x / 32) * 7 + (y / 32) * 3) % 4]; g.fillRect(x + 1, y + 1, 30, 30); }
    noise(g, w, h, 4000, 0.2, ['#000', '#fff']);
  }, { repeat: true });
}
export function gravelTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c9c1b2'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 12000, 0.6, ['#9d9484', '#e4ddcf', '#b3aa98', '#7f776a']);
  }, { repeat: true });
}
export function grassTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#6fa04a'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 9000, 0.5, ['#5b8c3a', '#86b85a', '#4f7d32']);
  }, { repeat: true });
}
export function waterTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#3f86a6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { g.strokeStyle = 'rgba(220,245,255,0.45)'; g.lineWidth = 2; g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - 4, x + 22, y); g.stroke(); }
  }, { repeat: true });
}
export function plankTex() {
  return canvasTex(256, 256, (g, w, h) => {
    for (let y = 0; y < h; y += 32) { g.fillStyle = ['#a4743f', '#8f6233', '#b07f48'][(y / 32) % 3]; g.fillRect(0, y, w, 30); g.fillStyle = '#4a2e14'; g.fillRect(0, y + 30, w, 2); }
    noise(g, w, h, 3000, 0.25, ['#000', '#fff']);
  }, { repeat: true });
}

// 近代の町並み: 1 タイル = 1 間 × 1 階。4 列 × 2 段
export function facadeAtlas(night = false) {
  const T = 256;
  return canvasTex(T * 4, T * 2, (g) => {
    const win = (x, y, ww, hh, frame, lit) => {
      g.fillStyle = frame; g.fillRect(x - 6, y - 6, ww + 12, hh + 12);
      if (night) { g.fillStyle = lit ? (Math.random() < 0.5 ? '#ffd27a' : '#ffe6a8') : '#000'; g.fillRect(x, y, ww, hh); return; }
      const gr = g.createLinearGradient(x, y, x + ww, y + hh); gr.addColorStop(0, '#9fd2ee'); gr.addColorStop(0.5, '#5b93b8'); gr.addColorStop(1, '#3c6c92');
      g.fillStyle = gr; g.fillRect(x, y, ww, hh);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(x + ww * 0.15, y); g.lineTo(x + ww * 0.35, y); g.lineTo(x + ww * 0.05, y + hh); g.lineTo(x - 0, y + hh); g.fill();
      g.fillStyle = frame; g.fillRect(x + ww / 2 - 3, y, 6, hh);
    };
    const tile = (i, draw) => { const x = (i % 4) * T, y = Math.floor(i / 4) * T; g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, T, T); g.clip(); draw(); g.restore(); };
    const wall = (c, nz = true) => { g.fillStyle = night ? '#000' : c; g.fillRect(0, 0, T, T); if (nz && !night) noise(g, T, T, 2500, 0.18, ['#000', '#fff']); };
    // 0: ベージュのタイル張り
    tile(0, () => { wall('#d9c7a5'); if (!night) { g.strokeStyle = 'rgba(0,0,0,0.08)'; for (let y = 0; y < T; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(T, y); g.stroke(); } } win(50, 60, 156, 120, '#c9ccd0', Math.random() < 0.6); if (!night) { g.fillStyle = '#b9a785'; g.fillRect(0, T - 18, T, 18); } });
    // 1: 打ち放しコンクリ + ベランダ
    tile(1, () => { wall('#a9adb0'); if (!night) { g.fillStyle = 'rgba(0,0,0,0.12)'; for (const [x, y] of [[40, 30], [200, 30], [40, 220], [200, 220]]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); } } win(36, 40, 184, 130, '#888c90', Math.random() < 0.5); if (!night) { g.fillStyle = '#d8dadc'; g.fillRect(10, 176, T - 20, 60); g.fillStyle = '#7f8487'; for (let x = 14; x < T - 10; x += 14) g.fillRect(x, 180, 4, 52); g.fillRect(10, 176, T - 20, 6); } });
    // 2: レンガ
    tile(2, () => { wall('#9a4a35', false); if (!night) { for (let y = 0; y < T; y += 16) for (let x = (y / 16) % 2 * 16 - 16; x < T; x += 32) { g.fillStyle = ['#a8543c', '#8f4130', '#b2614a'][(((x / 32) | 0) + y / 16 + 30) % 3]; g.fillRect(x + 1, y + 1, 30, 14); } } win(60, 56, 136, 130, '#e8e2d6', Math.random() < 0.6); });
    // 3: 白モルタル + 室外機
    tile(3, () => { wall('#ece8df'); win(40, 50, 120, 120, '#b8bcc0', Math.random() < 0.5); if (!night) { g.fillStyle = '#e4e4e0'; g.fillRect(172, 120, 64, 52); g.strokeStyle = '#888'; g.lineWidth = 3; g.beginPath(); g.arc(196, 146, 18, 0, 7); g.stroke(); g.fillStyle = '#777'; g.fillRect(172, 170, 64, 4); } });
    // 4: 薄緑のパネル（事務所）
    tile(4, () => { wall('#a9c2b4'); win(10, 70, T - 20, 100, '#5f6f68', Math.random() < 0.7); if (!night) { g.fillStyle = '#88a395'; g.fillRect(0, 0, T, 26); g.fillRect(0, T - 40, T, 40); } });
    // 5: クリーム + 洗濯物の手すり
    tile(5, () => { wall('#efe0b8'); win(48, 40, 160, 136, '#a0a4a8', Math.random() < 0.5); if (!night) { g.fillStyle = '#6a6e72'; g.fillRect(20, 190, T - 40, 6); for (let x = 30; x < T - 30; x += 22) { g.fillStyle = pick(['#f4f4f4', '#7aa6d8', '#e88c8c', '#f0d070']); g.fillRect(x, 196, 16, 26); } } });
    // 6: 店先（ガラス戸 + のれん）
    tile(6, () => {
      wall('#5a4a3c', false);
      if (night) { g.fillStyle = '#ffcf7a'; g.fillRect(20, 60, T - 40, T - 70); return; }
      g.fillStyle = '#2b2a2c'; g.fillRect(16, 50, T - 32, T - 50);
      const gr = g.createLinearGradient(0, 60, 0, T); gr.addColorStop(0, '#d6e8ee'); gr.addColorStop(1, '#8fb0bd'); g.fillStyle = gr; g.fillRect(24, 60, T - 48, T - 64);
      g.fillStyle = '#2b2a2c'; g.fillRect(T / 2 - 3, 60, 6, T - 60);
      for (let i = 0; i < 4; i++) { g.fillStyle = pick(['#d7b26a', '#cc6a4e', '#6c9a6a', '#e6d6b0']); g.fillRect(36 + i * 48, T - 70, 30, 40); }
      g.fillStyle = '#1f3a7a'; g.fillRect(40, 50, T - 80, 50); g.fillStyle = '#f4efe2'; g.font = `30px ${SERIF}`; g.textAlign = 'center'; g.fillText('営業中', T / 2, 86);
      g.fillStyle = '#1f3a7a'; for (let x = 40; x < T - 40; x += 44) g.fillRect(x + 40, 50, 3, 50);
    });
    // 7: シャッター
    tile(7, () => {
      wall('#6b6560', false);
      if (night) { g.fillStyle = '#000'; g.fillRect(0, 0, T, T); return; }
      g.fillStyle = '#b8bcbf'; g.fillRect(16, 30, T - 32, T - 30);
      for (let y = 34; y < T; y += 9) { g.fillStyle = '#9aa0a4'; g.fillRect(16, y, T - 32, 3); }
      g.fillStyle = '#c94a3a'; g.font = `24px ${FONT}`; g.textAlign = 'center'; g.fillText(pick(['定休日', '貸店舗', 'だんじり祭']), T / 2, 140);
    });
  }, { nomip: true });
}
export function machiyaAtlas(night = false) {
  const T = 256;
  return canvasTex(T * 2, T, (g) => {
    for (let k = 0; k < 2; k++) {
      g.save(); g.translate(k * T, 0);
      if (night) {
        g.fillStyle = '#000'; g.fillRect(0, 0, T, T);
        g.fillStyle = '#ffb860'; for (let x = 8; x < T - 8; x += 10) g.fillRect(x, T * 0.6, 5, T * 0.32);
        g.fillStyle = '#ffd890'; g.fillRect(48, 40, T - 96, 46);
        g.restore(); continue;
      }
      g.fillStyle = '#efe7d3'; g.fillRect(0, 0, T, T);
      noise(g, T, T, 2000, 0.15, ['#000']);
      g.fillStyle = '#3a2416'; g.fillRect(0, 0, T, 12); g.fillRect(0, T * 0.5 - 8, T, 14); g.fillRect(0, 0, 10, T); g.fillRect(T - 10, 0, 10, T);
      // 虫籠窓
      g.fillStyle = '#d8ccb2'; g.fillRect(44, 36, T - 88, 56);
      g.fillStyle = '#3d2a1c'; for (let x = 50; x < T - 44; x += 12) g.fillRect(x, 36, 6, 56);
      // 下階の格子
      g.fillStyle = '#2a1a0e'; g.fillRect(10, T * 0.5 + 6, T - 20, T * 0.5 - 6);
      g.fillStyle = '#7a5130';
      for (let x = 14; x < T - 12; x += 8) g.fillRect(x, T * 0.5 + 12, 4, T * 0.5 - 20);
      if (k === 1) {
        g.fillStyle = '#1e2f5c'; g.fillRect(T * 0.3, T * 0.5 + 10, T * 0.4, 60);
        g.fillStyle = '#f4efe2'; g.font = `34px ${SERIF}`; g.textAlign = 'center'; g.fillText(pick(['酒', '茶', '米', '油']), T / 2, T * 0.5 + 54);
        g.fillStyle = '#1e2f5c'; for (let x = T * 0.3 + 30; x < T * 0.7; x += 30) g.fillRect(x, T * 0.5 + 10, 2, 60);
      }
      g.restore();
    }
  });
}
export function roofTileTex() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#4a515c'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      const gr = g.createLinearGradient(x, 0, x + 16, 0);
      gr.addColorStop(0, '#2f343c'); gr.addColorStop(0.5, '#6a7380'); gr.addColorStop(1, '#2f343c');
      g.fillStyle = gr; g.fillRect(x, 0, 16, h);
    }
    for (let y = 0; y < h; y += 16) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y, w, 3); }
  }, { repeat: true });
}
export function awningTex() {
  return canvasTex(128, 64, (g, w, h) => {
    for (let x = 0; x < w; x += 16) { g.fillStyle = (x / 16) % 2 ? '#ffffff' : '#d8d8d8'; g.fillRect(x, 0, 16, h); }
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, h - 10, w, 10);
  }, { repeat: true });
}
const H_SIGNS = [['喫茶ほたる', '#6b3b1f', '#f4e6c8'], ['酒 だんじり', '#1e2f5c', '#f4efe2'], ['米穀店', '#f4efe2', '#2a2a2a'], ['くすり', '#2a8a4a', '#fff'], ['たばこ', '#c62828', '#fff'], ['理容 さかい', '#f4efe2', '#1e3f8a'], ['寿司 浜', '#111', '#f0d070'], ['ラーメン', '#d23c1f', '#fff7d0'],
  ['ゆ', '#2f5ea8', '#fff'], ['呉服 京屋', '#4a2a5a', '#f4e6c8'], ['金物', '#f2c14e', '#222'], ['電器', '#1d6fb8', '#fff'], ['質', '#111', '#fff'], ['本屋', '#2a6a5a', '#fff'], ['豆腐', '#f4efe2', '#1e2f5c'], ['焼肉', '#7a1a12', '#ffd890']];
const V_SIGNS = [['カラオケ', '#e0367a', '#fff'], ['居酒屋', '#c62828', '#fff'], ['整骨院', '#2f8a5a', '#fff'], ['歯科', '#fff', '#1d6fb8'], ['不動産', '#1e3f8a', '#fff'], ['パン', '#f2a63a', '#3a1a08'], ['珈琲', '#4a2a14', '#f4e6c8'], ['うどん', '#f4efe2', '#7a1a12'],
  ['学習塾', '#f2c14e', '#1e2f5c'], ['銀行', '#0d6b5a', '#fff'], ['洋品店', '#8a2a6a', '#fff'], ['時計', '#2a2a2a', '#f2c14e'], ['花', '#e86a8a', '#fff'], ['靴', '#3a5a8a', '#fff'], ['カメラ', '#111', '#ff5a3a'], ['だんじり会館', '#c71f17', '#f6d36a']];
export function signAtlas(vertical = false) {
  const list = vertical ? V_SIGNS : H_SIGNS;
  const tw = vertical ? 128 : 256, th = vertical ? 384 : 96, cols = vertical ? 8 : 4, rows = vertical ? 2 : 4;
  return {
    cols, rows, count: list.length,
    tex: canvasTex(tw * cols, th * rows, (g) => {
      list.forEach(([text, bg, fg], i) => {
        const x = (i % cols) * tw, y = Math.floor(i / cols) * th;
        g.fillStyle = bg; g.fillRect(x, y, tw, th);
        g.strokeStyle = fg; g.globalAlpha = 0.6; g.lineWidth = 4; g.strokeRect(x + 6, y + 6, tw - 12, th - 12); g.globalAlpha = 1;
        g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
        if (vertical) { const n = [...text].length, step = Math.min(70, (th - 30) / n); g.font = `${Math.min(64, step * 0.95)}px ${FONT}`; [...text].forEach((ch, k) => g.fillText(ch, x + tw / 2, y + 20 + step * (k + 0.5) + (th - 40 - step * n) / 2)); }
        else { g.font = `${Math.min(62, (tw - 30) / [...text].length * 1.05)}px ${FONT}`; g.fillText(text, x + tw / 2, y + th / 2 + 3); }
      });
    }, { nomip: true }),
  };
}
const NOBORI = [['だんじり祭', '#c71f17', '#fff'], ['奉納', '#1e2f5c', '#fff'], ['御祭禮', '#f4efe2', '#c71f17'], ['商店街', '#2a8a4a', '#fff']];
export function noboriAtlas() {
  return canvasTex(128 * 4, 512, (g) => {
    NOBORI.forEach(([text, bg, fg], i) => {
      const x = i * 128;
      g.fillStyle = bg; g.fillRect(x, 0, 128, 512);
      g.fillStyle = fg; g.fillRect(x, 0, 128, 18); for (let k = 0; k < 5; k++) g.fillRect(x + 6 + k * 26, 0, 10, 28);
      vtext(g, text, x + 64, 90, 74, 84, fg, null, 0);
    });
  }, { nomip: true });
}
// テクスチャに使う文字（Web フォントを先に読み込ませる）
export const GLYPHS = '祭御禮東西浜本町営業中定休日貸店舗だんじり喫茶ほたる酒米穀店くすりたばこ理容さかい寿司ラーメンゆ呉服京屋金物電器質本屋豆腐焼肉カラオケ居酒屋整骨院歯科不動産パン珈琲うどん学習塾銀行洋品時計花靴メ会館奉納商街茶油疾走出発ゴール飛べ!雷ABCDEFGHIJKLMNOPQRSTUVWXYZÉÔÊÂabcdefghijklmnopqrstuvwxyz0123456789%';
