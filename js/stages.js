// ステージ: 日本の町（昼・夜）と、だんじりが絶対に来なさそうな場所（パリ・NY タイムズスクエア・ギザ）
// ここには見た目の材料（空の色・壁の模様・看板・名所・小物の形）だけを置く。コースの形と物理はどのステージも同じ。
import * as THREE from 'three';
import { toon, withOutline, canvasTex, col, FONT, pick } from './gfx.js?v=104';
import { merge } from './models.js?v=104';

// ステージ（場所）と時間（昼・夜）は別々に選ぶ。ステージ ID は「場所-時間」（例: paris-night）
export const PLACES = { jp: '日本：岸和田', paris: 'パリ：凱旋門', ny: 'NY：タイムズスクエア', giza: 'ギザ：ピラミッド', venice: 'ベネチア：大運河' };
export const PLACE_IDS = Object.keys(PLACES);
// スタート・ゴールの門の文字（その土地の言葉）
export const GATE_TEXT = { jp: '出発・ゴール', paris: 'DÉPART · ARRIVÉE', ny: 'START · FINISH', giza: 'البداية · النهاية', venice: 'PARTENZA · ARRIVO' };
export const stageName = (place, night) => `${PLACES[place] || PLACES.jp}（${night ? '夜' : '昼'}）`;

// 空・霧・光（game.js の applyTimeOfDay が使う）
export const SKIES = {
  'jp-day': { top: 0x2a78d6, mid: 0xbfe4ff, bot: 0xdcefff, sun: 0xfff4d8, sunDir: [-0.5, 0.55, 0.4], sunSize: 900, hemi: [0xdcefff, 0x8a7a60, 1.25], light: [0xfff1dc, 2.6], off: [-110, 120, 90], fog: [0xcfe6f5, 160, 750], bloom: [0.3, 0.93], stars: false, lantern: 0.15, carLight: 0 },
  'jp-night': { top: 0x03061a, mid: 0x1a2456, bot: 0x0a0d22, sun: 0xfff6dc, sunDir: [0.4, 0.35, -0.6], sunSize: 1400, hemi: [0x4a5ca8, 0x241a30, 0.55], light: [0x9fb6ff, 0.7], off: [80, 110, -120], fog: [0x161c3e, 70, 420], bloom: [0.55, 0.82], stars: true, lantern: 0.85, carLight: 26 },
  'paris-day': { top: 0x3f7fd0, mid: 0xd8e6f2, bot: 0xeef2f4, sun: 0xffe6c0, sunDir: [-0.6, 0.38, 0.35], sunSize: 800, hemi: [0xe6eef8, 0x8a8070, 1.3], light: [0xffe8c8, 2.5], off: [-120, 100, 80], fog: [0xdfe7ef, 180, 820], bloom: [0.32, 0.92], stars: false, lantern: 0.3, carLight: 0 },
  'ny-night': { top: 0x0a0820, mid: 0x3a2350, bot: 0x2a1a30, sun: 0xffe0c0, sunDir: [0.4, 0.3, -0.6], sunSize: 1500, hemi: [0x6a5aa8, 0x3a2030, 0.75], light: [0xb0b8ff, 0.8], off: [80, 110, -120], fog: [0x2a1c3c, 90, 520], bloom: [0.7, 0.75], stars: false, lantern: 0.9, carLight: 26 },
  'venice-day': { top: 0x4a86cc, mid: 0xf4dcb8, bot: 0xf6e6cc, sun: 0xffe2b0, sunDir: [-0.7, 0.3, 0.3], sunSize: 800, hemi: [0xfff0dc, 0x6a8a9a, 1.3], light: [0xffdcb0, 2.6], off: [-130, 90, 70], fog: [0xf0e0c8, 170, 800], bloom: [0.35, 0.9], stars: false, lantern: 0.3, carLight: 0 },
  'giza-day': { top: 0x3a86d0, mid: 0xf2dcae, bot: 0xf4e2bc, sun: 0xfff2c8, sunDir: [-0.3, 0.75, 0.3], sunSize: 700, hemi: [0xfff0d8, 0xb08850, 1.35], light: [0xfff0d0, 2.9], off: [-70, 160, 60], fog: [0xead6ae, 150, 760], bloom: [0.32, 0.9], stars: false, lantern: 0.4, carLight: 0 },
  'ny-day': { top: 0x3a7ac8, mid: 0xc8d8e6, bot: 0xd8e0e6, sun: 0xfff2dc, sunDir: [-0.4, 0.6, 0.4], sunSize: 900, hemi: [0xdce6f0, 0x7a7a80, 1.25], light: [0xfff0e0, 2.5], off: [-100, 130, 90], fog: [0xc8d4de, 150, 700], bloom: [0.35, 0.9], stars: false, lantern: 0.3, carLight: 0 },
  'paris-night': { top: 0x050a24, mid: 0x2a2a5a, bot: 0x14142a, sun: 0xfff6dc, sunDir: [0.4, 0.35, -0.6], sunSize: 1400, hemi: [0x5a64a8, 0x2a2030, 0.6], light: [0xa8b8ff, 0.7], off: [80, 110, -120], fog: [0x1c2044, 80, 460], bloom: [0.6, 0.8], stars: true, lantern: 0.9, carLight: 26 },
  'giza-night': { top: 0x020618, mid: 0x1a2a5a, bot: 0x2a2440, sun: 0xfff6dc, sunDir: [0.3, 0.45, -0.6], sunSize: 1300, hemi: [0x6070b8, 0x3a2a30, 0.7], light: [0xb8c8ff, 0.9], off: [80, 120, -120], fog: [0x1e2448, 90, 520], bloom: [0.55, 0.82], stars: true, lantern: 0.9, carLight: 26 },
  'venice-night': { top: 0x040a20, mid: 0x1a3a5a, bot: 0x0e2030, sun: 0xfff6dc, sunDir: [0.4, 0.35, -0.6], sunSize: 1400, hemi: [0x5068a8, 0x1a2a30, 0.6], light: [0xa8c0ff, 0.7], off: [80, 110, -120], fog: [0x12243c, 80, 460], bloom: [0.6, 0.8], stars: true, lantern: 0.9, carLight: 26 },
};

const T = (g, x = 0, y = 0, z = 0) => g.translate(x, y, z);
const box = (w, h, d, x = 0, y = 0, z = 0) => T(new THREE.BoxGeometry(w, h, d), x, y, z);
const cyl = (rt, rb, h, seg = 10, x = 0, y = 0, z = 0) => T(new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z);
const sph = (r, x = 0, y = 0, z = 0, ws = 12, hs = 9) => T(new THREE.SphereGeometry(r, ws, hs), x, y, z);
const blob = (r, x, y, z) => {
  const g = new THREE.IcosahedronGeometry(r, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1 + Math.sin(p.getX(i) * 5.1 + p.getY(i) * 3.7) * 0.08; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.85, p.getZ(i) * k); }
  g.computeVertexNormals(); return T(g, x, y, z);
};
// a から b へ伸びる棒（角柱・円柱）
function strut(a, b, r0, r1, seg = 4) {
  const d = new THREE.Vector3().subVectors(b, a), l = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, l, seg, 1);
  if (seg === 4) g.rotateY(Math.PI / 4);
  g.translate(0, l / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  return g.translate(a.x, a.y, a.z);
}
function noise(g, w, h, n, a, cols) { g.globalAlpha = a; for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } g.globalAlpha = 1; }
const LATIN = "'Dela Gothic One', 'Zen Kaku Gothic New', sans-serif";
const SERIFL = "Georgia, 'Times New Roman', 'Zen Old Mincho', serif";

// ================= 壁の模様（4 列 × 2 段。0〜5 が上の階、6・7 が 1 階の店先） =================
function atlas4x2(night, tiles) {
  const S = 256;
  return canvasTex(S * 4, S * 2, (g) => {
    tiles.forEach((draw, i) => { const x = (i % 4) * S, y = Math.floor(i / 4) * S; g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, S, S); g.clip(); draw(g, S, night); g.restore(); });
  }, { nomip: true });
}
// パリ: 石灰岩の壁・背の高い窓・鉄の手すり
function parisWindow(g, S, night, x, y, w, h, balcony) {
  g.fillStyle = night ? '#000' : '#f4efe4'; g.fillRect(x - 8, y - 8, w + 16, h + 12);
  if (night) { g.fillStyle = Math.random() < 0.55 ? '#ffd890' : '#000'; g.fillRect(x, y, w, h); }
  else {
    const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, '#8fb4cf'); gr.addColorStop(1, '#4d6f8c'); g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = '#f4efe4'; g.fillRect(x + w / 2 - 3, y, 6, h); g.fillRect(x, y + h * 0.33, w, 4); g.fillRect(x, y + h * 0.66, w, 4);
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x + 4, y + 4, w * 0.18, h - 8);
  }
  if (balcony && !night) {
    g.fillStyle = '#1c1c22'; g.fillRect(x - 16, y + h - 34, w + 32, 5); g.fillRect(x - 16, y + h - 2, w + 32, 6);
    for (let k = x - 14; k < x + w + 16; k += 8) g.fillRect(k, y + h - 32, 3, 32);
    g.strokeStyle = '#1c1c22'; g.lineWidth = 2; for (let k = x - 10; k < x + w + 10; k += 16) { g.beginPath(); g.arc(k + 4, y + h - 16, 6, 0, 7); g.stroke(); }
  }
}
export function parisFacade(night) {
  const stone = (c) => (g, S) => { g.fillStyle = c; g.fillRect(0, 0, S, S); noise(g, S, S, 2200, 0.12, ['#000', '#fff']); g.fillStyle = 'rgba(120,100,70,0.18)'; for (let y = 0; y < S; y += 32) g.fillRect(0, y, S, 2); };
  const up = (c, balcony, ped) => (g, S, n) => {
    if (n) { g.fillStyle = '#000'; g.fillRect(0, 0, S, S); } else stone(c)(g, S);
    if (ped && !n) { g.fillStyle = '#d9cdb0'; g.beginPath(); g.moveTo(70, 44); g.lineTo(128, 18); g.lineTo(186, 44); g.fill(); }
    parisWindow(g, S, n, 84, 50, 88, 168, balcony);
  };
  const shop = (bg, name, fg) => (g, S, n) => {
    g.fillStyle = n ? '#000' : '#e9dcc0'; g.fillRect(0, 0, S, S);
    if (n) { g.fillStyle = '#ffcf80'; g.fillRect(24, 70, S - 48, S - 74); return; }
    g.fillStyle = bg; g.fillRect(14, 34, S - 28, S - 34);
    const gr = g.createLinearGradient(0, 80, 0, S); gr.addColorStop(0, '#e6eef0'); gr.addColorStop(1, '#93aab4'); g.fillStyle = gr; g.fillRect(28, 82, S - 56, S - 90);
    g.fillStyle = bg; g.fillRect(S / 2 - 4, 82, 8, S - 82);
    for (let i = 0; i < 3; i++) { g.fillStyle = pick(['#d7b26a', '#f2e2c0', '#b0583c', '#6b8a5a']); g.beginPath(); g.arc(60 + i * 68, S - 28, 16, 0, 7); g.fill(); }
    g.fillStyle = fg; g.font = `bold 34px ${SERIFL}`; g.textAlign = 'center'; g.fillText(name, S / 2, 70);
  };
  return atlas4x2(night, [up('#eadfc6', true), up('#e2d4b6', false, true), up('#efe6d2', true, true), up('#ddcfae', false), up('#e8dcc2', true), up('#e4d8bc', false, true),
    shop('#1f4a3a', pick(['CAFÉ', 'BISTROT', 'BRASSERIE']), '#f2d27a'), shop('#5a1f2a', pick(['BOULANGERIE', 'PÂTISSERIE', 'FROMAGERIE', 'LIBRAIRIE']), '#f4e6c8')]);
}
// NY: ガラスの壁・レンガ・アールデコ
export function nyFacade(night) {
  const lit = () => Math.random() < 0.7;
  const glass = (c1, c2) => (g, S, n) => {
    g.fillStyle = n ? '#05060c' : c1; g.fillRect(0, 0, S, S);
    for (let x = 0; x < 4; x++) for (let y = 0; y < 2; y++) {
      const X = 8 + x * 62, Y = 10 + y * 124;
      if (n) { g.fillStyle = lit() ? pick(['#ffe2a0', '#cfe6ff', '#fff0c8']) : '#0a0c18'; g.fillRect(X, Y, 54, 112); continue; }
      const gr = g.createLinearGradient(X, Y, X + 54, Y + 112); gr.addColorStop(0, c2); gr.addColorStop(1, '#2a3a52'); g.fillStyle = gr; g.fillRect(X, Y, 54, 112);
    }
  };
  const brick = (c) => (g, S, n) => {
    g.fillStyle = n ? '#050505' : c; g.fillRect(0, 0, S, S);
    if (!n) for (let y = 0; y < S; y += 12) for (let x = (y / 12) % 2 * 12 - 12; x < S; x += 24) { g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.12})`; g.fillRect(x, y, 22, 10); }
    for (const X of [36, 140]) { g.fillStyle = n ? (lit() ? '#ffd890' : '#111') : '#26303c'; g.fillRect(X, 50, 80, 150); if (!n) { g.fillStyle = '#ddd'; g.fillRect(X - 6, 200, 92, 8); g.fillRect(X - 6, 44, 92, 6); } }
  };
  const deco = (g, S, n) => {
    g.fillStyle = n ? '#060606' : '#d8ccb0'; g.fillRect(0, 0, S, S);
    for (const X of [20, 100, 180]) { g.fillStyle = n ? (lit() ? '#ffe0a0' : '#111') : '#3a4656'; g.fillRect(X, 20, 56, 216); if (!n) { g.fillStyle = '#b8aa88'; g.fillRect(X - 6, 0, 4, S); } }
  };
  const store = (g, S, n) => {
    g.fillStyle = '#111'; g.fillRect(0, 0, S, S);
    g.fillStyle = n ? '#ffe9b0' : '#9fb8c8'; g.fillRect(20, 70, S - 40, S - 74);
    g.fillStyle = pick(['#ff3a6a', '#29d6ff', '#ffd23a', '#7aff5a']); g.fillRect(14, 20, S - 28, 40);
    g.fillStyle = '#111'; g.font = `30px ${LATIN}`; g.textAlign = 'center'; g.fillText(pick(['PIZZA', 'DELI', 'GIFTS', 'DINER', 'BAGELS']), S / 2, 52);
  };
  const marquee = (g, S, n) => {
    g.fillStyle = '#1a0a10'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#c0182c'; g.fillRect(10, 20, S - 20, 90);
    g.fillStyle = '#ffe9a8'; for (let x = 16; x < S - 10; x += 14) { g.beginPath(); g.arc(x, 26, 4, 0, 7); g.fill(); g.beginPath(); g.arc(x, 104, 4, 0, 7); g.fill(); }
    g.fillStyle = '#fff6d8'; g.font = `28px ${LATIN}`; g.textAlign = 'center'; g.fillText(pick(['BROADWAY', 'THEATER', 'TONIGHT']), S / 2, 76);
    g.fillStyle = n ? '#ffd890' : '#7a8a96'; g.fillRect(30, 130, S - 60, S - 134);
  };
  return atlas4x2(night, [glass('#5a7a96', '#8fb4d0'), brick('#8a4a38'), deco, glass('#38485c', '#6a8aa8'), brick('#a86a4a'), glass('#4a5a6a', '#9ab8c8'), store, marquee]);
}
// ギザ: 日干しれんがの家
export function gizaFacade(night) {
  const mud = (c, blue) => (g, S, n) => {
    g.fillStyle = n ? '#000' : c; g.fillRect(0, 0, S, S);
    if (!n) { noise(g, S, S, 3000, 0.2, ['#7a5a32', '#fff']); g.fillStyle = 'rgba(90,60,30,0.15)'; for (let y = 0; y < S; y += 22) g.fillRect(0, y, S, 2); }
    const X = 76, Y = 66;
    g.fillStyle = n ? (Math.random() < 0.6 ? '#ffc070' : '#000') : '#2a1e14'; g.fillRect(X, Y, 104, 104);
    if (!n) {
      g.fillStyle = blue ? '#3a8ab0' : '#7a4a22'; for (let k = X + 6; k < X + 104; k += 14) g.fillRect(k, Y, 6, 104); for (let k = Y + 6; k < Y + 104; k += 14) g.fillRect(X, k, 104, 4);
      g.fillStyle = '#e8d8b4'; g.fillRect(X - 10, Y + 104, 124, 10);
    }
  };
  const bazaar = (g, S, n) => {
    g.fillStyle = n ? '#000' : '#cfa874'; g.fillRect(0, 0, S, S);
    g.fillStyle = n ? '#ffb860' : '#3a2414'; g.fillRect(16, 40, S - 32, S - 40);
    if (n) return;
    for (let i = 0; i < 4; i++) { g.fillStyle = pick(['#b8282a', '#2a5ab0', '#e8b42a', '#2a8a5a', '#8a2a8a']); g.fillRect(24 + i * 56, 60, 46, 120); g.fillStyle = 'rgba(255,255,255,0.5)'; for (let y = 70; y < 180; y += 16) g.fillRect(28 + i * 56, y, 38, 3); }
    for (let i = 0; i < 5; i++) { g.fillStyle = pick(['#f2c14e', '#e86a3a', '#4ab8a0']); g.beginPath(); g.arc(36 + i * 46, 210, 12, 0, 7); g.fill(); }
  };
  const shut = (g, S, n) => {
    g.fillStyle = n ? '#000' : '#d8b888'; g.fillRect(0, 0, S, S);
    g.fillStyle = n ? '#000' : '#4a8ab0'; g.fillRect(20, 40, S - 40, S - 40);
    if (!n) { g.fillStyle = '#3a7a9a'; for (let y = 44; y < S; y += 10) g.fillRect(20, y, S - 40, 3); g.fillStyle = '#f2c14e'; g.font = `26px ${LATIN}`; g.textAlign = 'center'; g.fillText(pick(['بازار', 'بردي', 'توابل', 'شاي']), S / 2, 110); }
  };
  return atlas4x2(night, [mud('#d8b884'), mud('#c99e68', true), mud('#e2c89a'), mud('#b88a5a'), mud('#ead2a6', true), mud('#cfa070'), bazaar, shut]);
}

// 看板（横 16 種・縦 16 種）
const SIGNS = {
  paris: { h: [['CAFÉ', '#1f4a3a', '#f2d27a'], ['BOULANGERIE', '#5a1f2a', '#f4e6c8'], ['PÂTISSERIE', '#f2c0c8', '#5a1f2a'], ['FROMAGERIE', '#f4ead0', '#3a2a14'], ['LIBRAIRIE', '#1e2f5c', '#f4efe2'], ['BISTROT', '#7a1a12', '#f2d27a'], ['TABAC', '#c62828', '#fff'], ['PHARMACIE', '#2a8a4a', '#fff'],
    ['HÔTEL', '#111', '#f2d27a'], ['FLEURS', '#e86a8a', '#fff'], ['CRÊPERIE', '#f2a63a', '#3a1a08'], ['BRASSERIE', '#3a2a14', '#f4e6c8'], ['CHOCOLATIER', '#4a2a14', '#f2d27a'], ['PARFUMERIE', '#8a2a6a', '#fff'], ['GALERIE', '#f4efe2', '#111'], ['MODE', '#111', '#fff']],
    v: [['HÔTEL', '#111', '#f2d27a'], ['CAFÉ', '#1f4a3a', '#fff'], ['BAR', '#7a1a12', '#fff'], ['OPÉRA', '#3a2a5a', '#f2d27a']] },
  ny: { h: [['PIZZA', '#d23c1f', '#fff7d0'], ['DELI', '#111', '#ffd23a'], ['BAGELS', '#f2a63a', '#3a1a08'], ['DINER', '#29d6ff', '#111'], ['GIFTS', '#ff3a6a', '#fff'], ['PHARMACY', '#2a8a4a', '#fff'], ['HOTEL', '#111', '#fff'], ['THEATER', '#c0182c', '#ffe9a8'],
    ['NOODLES', '#ffd23a', '#c0182c'], ['SUSHI', '#111', '#f0d070'], ['BURGERS', '#7a1a12', '#ffd890'], ['DONUTS', '#ff8ac8', '#3a1a28'], ['CAMERAS', '#111', '#ff5a3a'], ['SHOES', '#3a5a8a', '#fff'], ['TOYS', '#ffd23a', '#2a5ab0'], ['COFFEE', '#4a2a14', '#f4e6c8']],
    v: [['HOTEL', '#c0182c', '#fff'], ['BAR', '#29d6ff', '#111'], ['JAZZ', '#7a2aff', '#fff'], ['LIVE', '#ff3a6a', '#fff'], ['OPEN 24', '#111', '#7aff5a'], ['PIZZA', '#ffd23a', '#c0182c'], ['DINER', '#29d6ff', '#fff'], ['SHOW', '#ff8a1a', '#111']] },
  giza: { h: [['بازار', '#b8282a', '#f2d27a'], ['بردي', '#e8d8a8', '#3a2a14'], ['عطور', '#8a2a8a', '#fff'], ['توابل', '#e86a1a', '#fff'], ['شاي', '#2a8a5a', '#fff'], ['كشري', '#f2c14e', '#7a1a12'], ['فلافل', '#6a8a2a', '#fff'], ['هدايا', '#2a5ab0', '#fff'],
    ['ذهب', '#111', '#f2c14e'], ['سجاد', '#7a1a12', '#f2d27a'], ['فوانيس', '#f2a63a', '#3a1a08'], ['عصير', '#ff8a1a', '#fff'], ['فندق', '#1e2f5c', '#f4efe2'], ['قهوة', '#4a2a14', '#f4e6c8'], ['جمال', '#d8b884', '#3a2a14'], ['متحف', '#f4efe2', '#7a1a12']], v: [] },
  venice: { h: [['GELATERIA', '#f2c0c8', '#5a1f2a'], ['PIZZERIA', '#c62828', '#fff'], ['OSTERIA', '#3a2a14', '#f4e6c8'], ['TRATTORIA', '#1f4a3a', '#f2d27a'], ['MASCHERE', '#5a1f6a', '#f2d27a'], ['VETRO', '#1e5a8a', '#fff'], ['FARMACIA', '#2a8a4a', '#fff'], ['ALBERGO', '#111', '#f2d27a'],
    ['CAFFÈ', '#4a2a14', '#f4e6c8'], ['BACARO', '#7a1a12', '#f2d27a'], ['PASTICCERIA', '#f4ead0', '#7a1a12'], ['LIBRERIA', '#1e2f5c', '#f4efe2'], ['GONDOLE', '#111', '#fff'], ['TABACCHI', '#1e2f5c', '#fff'], ['PANIFICIO', '#f2a63a', '#3a1a08'], ['VINI', '#5a1f2a', '#f4e6c8']],
    v: [['ALBERGO', '#111', '#f2d27a'], ['HOTEL', '#7a1a12', '#fff'], ['BAR', '#1f4a3a', '#fff'], ['VINI', '#5a1f2a', '#f2d27a']] },
};
export function themeSignAtlas(theme, vertical) {
  const list = vertical ? SIGNS[theme].v : SIGNS[theme].h;
  const tw = vertical ? 128 : 256, th = vertical ? 384 : 96, cols = vertical ? 8 : 4, rows = vertical ? 2 : 4;
  return {
    cols, rows, count: list.length,
    tex: canvasTex(tw * cols, th * rows, (g) => {
      for (let i = 0; i < cols * rows; i++) {
        const [text, bg, fg] = list[i % Math.max(1, list.length)] || ['', '#000', '#000'];
        const x = (i % cols) * tw, y = Math.floor(i / cols) * th;
        g.fillStyle = bg; g.fillRect(x, y, tw, th);
        g.strokeStyle = fg; g.globalAlpha = 0.6; g.lineWidth = 4; g.strokeRect(x + 6, y + 6, tw - 12, th - 12); g.globalAlpha = 1;
        g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
        if (vertical) { const ch = [...text]; const step = Math.min(64, (th - 30) / ch.length); g.font = `${Math.min(56, step * 0.9)}px ${LATIN}`; ch.forEach((c, k) => g.fillText(c, x + tw / 2, y + 20 + step * (k + 0.5) + (th - 40 - step * ch.length) / 2)); }
        else { g.font = `${Math.min(56, (tw - 30) / [...text].length * 1.5)}px ${theme === 'paris' || theme === 'venice' ? SERIFL : LATIN}`; g.fillText(text, x + tw / 2, y + th / 2 + 3); }
      }
    }, { nomip: true }),
  };
}
// のぼり（縦長の旗 4 種）
export function themeBannerAtlas(theme) {
  return canvasTex(128 * 4, 512, (g) => {
    for (let i = 0; i < 4; i++) {
      const x = i * 128;
      g.save(); g.translate(x, 0); g.beginPath(); g.rect(0, 0, 128, 512); g.clip();
      if (theme === 'paris') {
        if (i === 0) { ['#1f3c8a', '#f4f4f4', '#d22a2a'].forEach((c, k) => { g.fillStyle = c; g.fillRect(k * 43, 0, 43, 512); }); }
        else { g.fillStyle = ['#1f3c8a', '#5a1f2a', '#1f4a3a'][i - 1]; g.fillRect(0, 0, 128, 512); g.fillStyle = '#f2d27a'; g.font = `bold 40px ${SERIFL}`; g.textAlign = 'center'; [...['PARIS', 'TOUR', 'ÉTÉ'][i - 1]].forEach((c, k) => g.fillText(c, 64, 90 + k * 56)); }
      } else if (theme === 'ny') {
        if (i === 0) { for (let k = 0; k < 13; k++) { g.fillStyle = k % 2 ? '#f4f4f4' : '#c0182c'; g.fillRect(0, k * 40, 128, 40); } g.fillStyle = '#1e2f6c'; g.fillRect(0, 0, 128, 200); g.fillStyle = '#fff'; for (let k = 0; k < 12; k++) { g.beginPath(); g.arc(20 + (k % 3) * 44, 24 + Math.floor(k / 3) * 46, 6, 0, 7); g.fill(); } }
        else { g.fillStyle = ['#111', '#c0182c', '#29a0d6'][i - 1]; g.fillRect(0, 0, 128, 512); g.fillStyle = ['#ffd23a', '#fff', '#fff'][i - 1]; g.font = `40px ${LATIN}`; g.textAlign = 'center'; [...['NYC', 'SHOW', 'TIMES'][i - 1]].forEach((c, k) => g.fillText(c, 64, 90 + k * 60)); }
      } else if (theme === 'venice') {
        g.fillStyle = ['#a8201a', '#1e3c7a', '#a8201a', '#2a6a4a'][i]; g.fillRect(0, 0, 128, 512);
        g.fillStyle = '#f2c14e'; g.fillRect(0, 0, 128, 12); for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(k * 32, 440); g.lineTo(k * 32 + 16, 512); g.lineTo(k * 32 + 32, 440); g.fill(); }
        if (i % 2 === 0) { g.beginPath(); g.ellipse(64, 180, 34, 46, 0, 0, 7); g.fill(); g.fillStyle = ['#a8201a', '#1e3c7a', '#a8201a', '#2a6a4a'][i]; g.beginPath(); g.ellipse(64, 180, 22, 32, 0, 0, 7); g.fill(); g.fillStyle = '#f2c14e'; g.fillRect(40, 240, 48, 120); }
        else { g.font = `bold 40px ${SERIFL}`; g.textAlign = 'center'; [...'VENEZIA'].forEach((c, k) => g.fillText(c, 64, 80 + k * 52)); }
      } else {
        const cs = [['#b8282a', '#f2c14e'], ['#2a5ab0', '#f4efe2'], ['#e8b42a', '#2a8a5a'], ['#7a1a12', '#f2c14e']][i];
        g.fillStyle = cs[0]; g.fillRect(0, 0, 128, 512);
        g.fillStyle = cs[1]; for (let y = 30; y < 512; y += 70) { g.beginPath(); g.moveTo(64, y); g.lineTo(104, y + 30); g.lineTo(64, y + 60); g.lineTo(24, y + 30); g.fill(); }
        g.fillRect(0, 0, 128, 14); g.fillRect(0, 498, 128, 14);
      }
      g.restore();
    }
  }, { nomip: true });
}
// NY の巨大広告（架空のもの）。4 列 × 2 段
export function billboardAtlas() {
  const W = 256, H = 160;
  const ads = [
    (g) => { g.fillStyle = '#c0182c'; g.fillRect(0, 0, W, H); g.fillStyle = '#ffd23a'; g.font = `30px ${LATIN}`; g.textAlign = 'center'; g.fillText('DANJIRI', W / 2, 52); g.fillStyle = '#fff'; g.font = `18px ${LATIN}`; g.fillText('THE MUSICAL', W / 2, 80); g.fillStyle = '#ffd23a'; g.fillRect(90, 96, 76, 40); g.fillStyle = '#7a3a12'; g.fillRect(100, 104, 56, 28); g.beginPath(); g.moveTo(84, 98); g.lineTo(128, 84); g.lineTo(172, 98); g.fill(); },
    (g) => { g.fillStyle = '#111'; g.fillRect(0, 0, W, H); g.fillStyle = '#29d6ff'; g.font = `44px ${LATIN}`; g.textAlign = 'center'; g.fillText('SUSHI', W / 2, 70); g.fillStyle = '#ff3a6a'; g.font = `24px ${LATIN}`; g.fillText('OPEN 24H', W / 2, 112); },
    (g) => { g.fillStyle = '#ffd23a'; g.fillRect(0, 0, W, H); g.fillStyle = '#c0182c'; g.font = `54px ${LATIN}`; g.textAlign = 'center'; g.fillText('SALE', W / 2, 74); g.fillStyle = '#111'; g.font = `28px ${LATIN}`; g.fillText('70% OFF', W / 2, 118); },
    (g) => { const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#7a2aff'); gr.addColorStop(1, '#ff3a9a'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = `40px ${LATIN}`; g.textAlign = 'center'; g.fillText('DANCE!', W / 2, 92); },
    (g) => { g.fillStyle = '#e8261c'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = `32px ${LATIN}`; g.textAlign = 'center'; g.fillText('CHERRY', W / 2, 60); g.fillText('SODA', W / 2, 100); g.fillStyle = '#ffe0e0'; g.beginPath(); g.arc(210, 120, 22, 0, 7); g.fill(); },
    (g) => { g.fillStyle = '#0a2a5a'; g.fillRect(0, 0, W, H); g.fillStyle = '#ffd23a'; g.font = `34px ${LATIN}`; g.textAlign = 'center'; g.fillText('SUPER', W / 2, 60); g.fillText('BURGER', W / 2, 102); },
    (g) => { g.fillStyle = '#111'; g.fillRect(0, 0, W, H); g.fillStyle = '#7aff5a'; g.font = `30px ${LATIN}`; g.textAlign = 'center'; g.fillText('BREAKING', W / 2, 60); g.fillStyle = '#fff'; g.font = `20px ${LATIN}`; g.fillText('DANJIRI IN TOWN!', W / 2, 100); },
    (g) => { g.fillStyle = '#ff8a1a'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = `38px ${LATIN}`; g.textAlign = 'center'; g.fillText('NOODLE', W / 2, 70); g.fillText('BAR', W / 2, 114); },
  ];
  return canvasTex(W * 4, H * 2, (g) => { ads.forEach((d, i) => { g.save(); g.translate((i % 4) * W, Math.floor(i / 4) * H); g.beginPath(); g.rect(0, 0, W, H); g.clip(); d(g); g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,0.35)'; g.strokeRect(3, 3, W - 6, H - 6); g.restore(); }); }, { nomip: true });
}
// ベネチア: パステルの漆喰・尖ったアーチの窓・緑の鎧戸・花の窓辺
export function veniceFacade(night) {
  const arch = (g, x, y, w, h, n) => { g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + w * 0.6); g.quadraticCurveTo(x, y, x + w / 2, y - w * 0.15); g.quadraticCurveTo(x + w, y, x + w, y + w * 0.6); g.lineTo(x + w, y + h); g.closePath(); };
  const up = (c, flowers) => (g, S, n) => {
    g.fillStyle = n ? '#000' : c; g.fillRect(0, 0, S, S);
    if (!n) { noise(g, S, S, 2600, 0.16, ['#000', '#fff']); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, S, 16); }
    for (const X of [42, 142]) {
      g.fillStyle = n ? '#000' : '#f2ece0'; arch(g, X - 7, 50, 86, 158, n); g.fill();
      g.fillStyle = n ? (Math.random() < 0.55 ? '#ffd890' : '#0a0a0a') : '#2a3a48'; arch(g, X, 58, 72, 144, n); g.fill();
      if (!n) { g.fillStyle = '#2f6a3a'; g.fillRect(X - 22, 66, 18, 136); g.fillRect(X + 76, 66, 18, 136); g.fillStyle = '#245030'; for (let y = 70; y < 200; y += 10) { g.fillRect(X - 22, y, 18, 3); g.fillRect(X + 76, y, 18, 3); } }
      if (flowers && !n) { g.fillStyle = '#7a4a22'; g.fillRect(X - 6, 204, 84, 12); for (let k = 0; k < 7; k++) { g.fillStyle = pick(['#e8261c', '#ff6a9a', '#f2c14e', '#ffffff']); g.beginPath(); g.arc(X + k * 12, 200, 7, 0, 7); g.fill(); } g.fillStyle = '#3a8a2a'; g.fillRect(X - 4, 206, 80, 4); }
    }
  };
  const shop = (bg, name) => (g, S, n) => {
    g.fillStyle = n ? '#000' : '#e2b46a'; g.fillRect(0, 0, S, S);
    g.fillStyle = n ? '#000' : '#f2ece0'; arch(g, 22, 40, S - 44, S - 30, n); g.fill();
    g.fillStyle = n ? '#ffcf80' : bg; arch(g, 34, 52, S - 68, S - 40, n); g.fill();
    if (n) return;
    g.fillStyle = 'rgba(255,255,255,0.75)'; arch(g, 46, 100, S - 92, S - 96, n); g.fill();
    for (let i = 0; i < 4; i++) { g.fillStyle = pick(['#f2c0c8', '#f2e2a0', '#a8d8f0', '#c8f0b0']); g.beginPath(); g.arc(70 + i * 38, 190, 13, 0, 7); g.fill(); }
    g.fillStyle = '#f2ece0'; g.font = `bold 26px ${SERIFL}`; g.textAlign = 'center'; g.fillText(name, S / 2, 90);
  };
  return atlas4x2(night, [up('#e8a89a', true), up('#e2b46a'), up('#c8664a', true), up('#efe0c0'), up('#f0d890', true), up('#b84a3a'),
    shop('#5a1f6a', pick(['MASCHERE', 'VETRO', 'GELATERIA'])), shop('#1f4a3a', pick(['OSTERIA', 'BACARO', 'CAFFÈ']))]);
}
// ベネチア: 洗濯物（吊り物）・縞の杭・ゴンドラ・鐘楼・聖堂
export function laundryGeo() { return merge([col(box(0.75, 0.85, 0.03, 0, -0.42, 0), 0xffffff), col(box(0.28, 0.32, 0.03, -0.48, -0.18, 0), 0xffffff), col(box(0.28, 0.32, 0.03, 0.48, -0.18, 0), 0xffffff), col(box(0.06, 0.12, 0.05, -0.25, 0.04, 0), 0x8a6a42), col(box(0.06, 0.12, 0.05, 0.25, 0.04, 0), 0x8a6a42)]); }
export function palinaGeo() {
  const parts = [];
  for (let k = 0; k < 8; k++) parts.push(col(cyl(0.16, 0.16, 0.5, 10, 0, 0.25 + k * 0.5, 0), k % 2 ? 0xffffff : 0xc0282a));
  parts.push(col(sph(0.2, 0, 4.1, 0), 0xf2c14e));
  return merge(parts);
}
export function gondolaGeo() {
  const parts = [];
  for (let k = -5; k <= 5; k++) { const t = k / 5, y = 0.35 + t * t * 0.9, w = 0.75 * (1 - t * t * 0.85); parts.push(col(box(w * 2, 0.32, 1.0, 0, y, k * 1.0), 0x111114)); }
  parts.push(col(box(0.12, 0.7, 0.08, 0, 1.7, 5.4), 0xd8d8d8), col(box(0.5, 0.06, 0.08, 0, 1.9, 5.4), 0xd8d8d8));
  parts.push(col(box(1.0, 0.3, 1.4, 0, 0.6, 0.6), 0xa8201a), col(box(1.0, 0.5, 0.2, 0, 0.8, 0.0), 0xa8201a));
  return merge(parts);
}
// カヌー（漕ぎ手つき）・水上バス・杭の束（ブリコラ）・沖の島（教会と鐘楼）
export function canoeGeo(c = 0xe8261c) {
  const hull = new THREE.SphereGeometry(1, 12, 6); hull.scale(0.45, 0.28, 2.3); hull.translate(0, 0.15, 0);
  return merge([col(hull, c), col(box(0.5, 0.05, 1.2, 0, 0.42, 0), 0x2a2a2a), col(cyl(0.2, 0.22, 0.5, 8, 0, 0.7, 0), 0xf2c14e), col(sph(0.16, 0, 1.05, 0), 0xe8b890),
    col(T(new THREE.BoxGeometry(2.6, 0.05, 0.08).rotateZ(0.35), 0, 0.8, 0.1), 0x8a6a42), ...[-1.3, 1.3].map(x => col(box(0.08, 0.3, 0.2, x, 0.8 + x * 0.35, 0.1), 0x8a6a42))]);
}
export function vaporettoGeo() {
  return merge([col(box(3.2, 1.0, 12, 0, 0.5, 0), 0xf4f4f4), col(box(3.25, 0.25, 12.05, 0, 0.2, 0), 0x1e3c7a), col(box(2.8, 1.6, 7, 0, 1.8, -0.5), 0xe8e8e8), col(box(2.82, 0.6, 6.8, 0, 2.0, -0.5), 0x3a5a7a), col(box(3.0, 0.15, 7.4, 0, 2.7, -0.5), 0xf2c11c), col(T(new THREE.CylinderGeometry(0, 1.6, 2, 3).rotateX(Math.PI / 2), 0, 0.5, 7), 0xf4f4f4)]);
}
export function bricolaGeo() { return merge([[-0.25, 0], [0.25, 0], [0, 0.35]].map(([x, z], k) => col(cyl(0.16, 0.2, 6, 8, x, 2.4, z).rotateZ((x) * 0.08), 0x6a5038)).concat([col(cyl(0.4, 0.4, 0.3, 10, 0, 4.2, 0.1), 0x3a2a1a), col(box(0.3, 0.4, 0.05, 0, 4.9, 0.3), 0xf4f0e6)])); }
export function islandChurch() {
  const grp = new THREE.Group();
  const isle = new THREE.Mesh(new THREE.CylinderGeometry(70, 80, 2, 32), toon({ color: 0xc8b898 })); isle.position.y = 0.6; grp.add(isle);
  const st = stoneMat('#f2ece0', '#d8d0c0');
  const nave = new THREE.Mesh(new THREE.BoxGeometry(30, 18, 50), st); nave.position.y = 10; grp.add(nave);
  const front = new THREE.Mesh(new THREE.BoxGeometry(34, 26, 3), st); front.position.set(0, 13, 26); grp.add(front);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0, 19, 7, 3, 1).rotateX(Math.PI / 2).rotateZ(Math.PI), st); ped.scale.set(1, 0.6, 0.15); ped.position.set(0, 28, 26); grp.add(ped);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 16), st); drum.position.set(0, 22, -5); grp.add(drum);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(8.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon({ color: 0x8a9aa4 })); dome.scale.y = 1.3; dome.position.set(0, 25, -5); grp.add(dome);
  const cam = campanile(); cam.scale.setScalar(0.75); cam.position.set(24, 0, -10); grp.add(cam);
  grp.traverse(o => { if (o.material) for (const m of [].concat(o.material)) m.fog = false; });
  return grp;
}
export function campanile() {
  const grp = new THREE.Group();
  const brick = toon({ map: canvasTex(128, 256, (g, w, h) => { g.fillStyle = '#b05a3a'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 * 8 - 8; x < w; x += 16) { g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.12})`; g.fillRect(x, y, 14, 6); } g.fillStyle = '#9a4a2e'; for (const x of [0, 40, 80, 120]) g.fillRect(x, 0, 8, h); }, { repeat: true }) });
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(12, 60, 12), brick); shaft.position.y = 30; grp.add(shaft);
  const white = toon({ color: 0xf2ece0 });
  const belfry = new THREE.Mesh(new THREE.BoxGeometry(13, 10, 13), white); belfry.position.y = 65; grp.add(belfry);
  for (const r of [0, 1, 2, 3]) for (const k of [-1, 0, 1]) { const o = new THREE.Mesh(new THREE.BoxGeometry(2.4, 7, 0.4), toon({ color: 0x2a2a30 })); const a = r * Math.PI / 2; o.position.set(Math.sin(a) * 6.6 + Math.cos(a) * k * 3.8, 65, Math.cos(a) * 6.6 - Math.sin(a) * k * 3.8); o.rotation.y = a; grp.add(o); }
  const attic = new THREE.Mesh(new THREE.BoxGeometry(12.5, 8, 12.5), brick); attic.position.y = 74; grp.add(attic);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(8.6, 20, 4).rotateY(Math.PI / 4), toon({ color: 0x5aa88a })); spire.position.y = 88; grp.add(spire);
  const angel = new THREE.Mesh(new THREE.ConeGeometry(0.8, 3, 6), toon({ color: 0xf2c14e, emissive: 0x4a3000 })); angel.position.y = 99.5; grp.add(angel);
  outlineAll(grp, 0.12);
  return grp;
}
export function basilica() {
  const grp = new THREE.Group();
  const st = stoneMat('#efe4cc', '#d8c8a8');
  const body = new THREE.Mesh(new THREE.BoxGeometry(44, 18, 34), st); body.position.y = 9; grp.add(body);
  const arches = toon({ map: canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#efe4cc'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 51) { g.fillStyle = '#3a2a24'; g.beginPath(); g.moveTo(x + 8, h); g.lineTo(x + 8, 26); g.arc(x + 25.5, 26, 17.5, Math.PI, 0); g.lineTo(x + 43, h); g.fill(); g.fillStyle = '#c8a040'; g.fillRect(x + 12, 14, 27, 4); } }) });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(44, 11), arches); front.position.set(0, 5.5, 17.05); grp.add(front);
  const dome = toon({ color: 0x6a7a86 });
  for (const [x, z, r] of [[0, 0, 7.5], [-14, 0, 5.5], [14, 0, 5.5], [0, -11, 5.5], [0, 11, 5.5]]) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r * 0.85, 3, 16), st); drum.position.set(x, 19.5, z); grp.add(drum);
    const d = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), dome); d.scale.y = 1.25; d.position.set(x, 21, z); grp.add(d);
    const lan = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 2.2, 8), toon({ color: 0xf2c14e })); lan.position.set(x, 21 + r * 1.25 + 1, z); grp.add(lan);
  }
  outlineAll(grp, 0.1);
  return grp;
}
// 地面
export function groundTex(theme) {
  if (theme === 'venice') return canvasTex(256, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#3f8a8a'); gr.addColorStop(1, '#2f7480'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 2; for (let i = 0; i < 40; i++) { const x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y - 3, x + 16, y); g.stroke(); } }, { repeat: true });
  if (theme === 'giza') return canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#e2c48e'; g.fillRect(0, 0, w, h); noise(g, w, h, 9000, 0.35, ['#c9a46a', '#f2dcae', '#b88e56']); g.strokeStyle = 'rgba(160,120,70,0.25)'; g.lineWidth = 3; for (let y = 10; y < h; y += 26) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 5); g.stroke(); } }, { repeat: true });
  if (theme === 'ny') return canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#8a8a8e'; g.fillRect(0, 0, w, h); noise(g, w, h, 7000, 0.3, ['#6a6a70', '#a8a8ac']); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; for (let x = 0; x < w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); g.beginPath(); g.moveTo(0, x); g.lineTo(w, x); g.stroke(); } }, { repeat: true });
  return null;
}
// 吊り物（道を横切る紐にぶら下がる物）の模様
export function hangTex(theme) {
  if (theme === 'giza') return canvasTex(128, 128, (g, w, h) => { const cs = ['#e8261c', '#2a8ad8', '#f2c14e', '#2ab86a']; for (let x = 0; x < 4; x++) { g.fillStyle = cs[x]; g.fillRect(x * 32, 0, 32, h); } g.fillStyle = '#c8a040'; for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 4); for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 4, h); });
  if (theme === 'paris') return canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#fff6d8'; g.fillRect(0, 0, w, h); });
  return null;
}

// ================= 形 =================
// パリ: マンサード屋根（1×1×1 の台形。幅と奥行きは建物に合わせて伸ばす）
export function mansardGeo() {
  const g = new THREE.CylinderGeometry(0.5 * 0.72, 0.5 * Math.SQRT2 * 0.71, 1, 4, 1); g.rotateY(Math.PI / 4); g.translate(0, 0.5, 0);
  return g;
}
export function chimneyGeo() { return merge([col(box(0.9, 1.6, 0.6, 0, 0.8, 0), 0xc9b48e), ...[-0.25, 0, 0.25].map(x => col(cyl(0.08, 0.1, 0.4, 6, x, 1.8, 0), 0xc8582a))]); }
export function dormerGeo() { return merge([col(box(1.1, 1.3, 0.9, 0, 0.65, 0), 0xe8dcc0), col(box(0.7, 0.8, 0.05, 0, 0.6, 0.46), 0x4d6f8c), col(T(new THREE.CylinderGeometry(0, 0.85, 0.6, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.75), 0, 1.6, 0), 0x5a6876)]); }
export function parisLampGeo() {
  return merge([col(cyl(0.12, 0.2, 0.6, 10, 0, 0.3, 0), 0x1c1c22), col(cyl(0.06, 0.09, 3.6, 8, 0, 2.3, 0), 0x1c1c22), col(cyl(0.2, 0.05, 0.3, 8, 0, 4.2, 0), 0x1c1c22),
    col(cyl(0.24, 0.16, 0.6, 6, 0, 4.6, 0), 0xffe8a8), col(cyl(0.04, 0.3, 0.3, 6, 0, 5.05, 0), 0x1c1c22), col(sph(0.07, 0, 5.25, 0), 0xb8963a)]);
}
export function morrisGeo() {
  const tex = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#f4ead0'; g.fillRect(0, 0, w, h); const cs = ['#d22a2a', '#1f3c8a', '#f2c14e', '#2a8a4a']; for (let i = 0; i < 4; i++) { g.fillStyle = cs[i]; g.fillRect(i * 64 + 6, 8, 52, 112); g.fillStyle = '#fff'; g.font = `14px ${SERIFL}`; g.textAlign = 'center'; g.fillText(['OPÉRA', 'CIRQUE', 'JAZZ', 'CINÉMA'][i], i * 64 + 32, 40); } });
  return { geo: merge([col(cyl(0.75, 0.75, 0.25, 16, 0, 0.12, 0), 0x2a4a3a), col(cyl(0.8, 0.8, 0.2, 16, 0, 3.2, 0), 0x2a4a3a), col(T(new THREE.SphereGeometry(0.75, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 3.3, 0), 0x2a4a3a), col(sph(0.1, 0, 4.1, 0), 0x2a4a3a)]), body: new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.9, 16, 1, true).translate(0, 1.7, 0), toon({ map: tex })) };
}
export function platanGeo(k) {
  const parts = [col(cyl(0.22, 0.32, 4.6, 8, 0, 2.3, 0), 0x9a8a6a), col(cyl(0.225, 0.3, 1.2, 8, 0, 3.0, 0), 0xc8b88e)];
  const greens = [0x6a9a3a, 0x7aac46, 0x5a8a32];
  for (let i = 0; i < 6 + k; i++) { const a = i / (6 + k) * Math.PI * 2; parts.push(col(blob(1.7, Math.cos(a) * 1.5, 6.0 + (i % 2) * 0.6, Math.sin(a) * 1.5), greens[i % 3])); }
  parts.push(col(blob(2.1, 0, 7.0, 0), greens[(k + 1) % 3]));
  return merge(parts);
}
export function palmGeo(k) {
  const parts = []; let x = 0, y = 0, lean = 0.08 + k * 0.05;
  for (let i = 0; i < 7; i++) { const a = new THREE.Vector3(x, y, 0); x += Math.sin(lean * i) * 1.0; y += 1.1; parts.push(col(strut(a, new THREE.Vector3(x, y, 0), 0.26 - i * 0.015, 0.24 - i * 0.015, 8), i % 2 ? 0x8a6a42 : 0x7a5a36)); }
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2, f = new THREE.ConeGeometry(0.5, 4.2, 4, 1); f.scale(1, 1, 0.12); f.translate(0, 2.1, 0); f.rotateZ(-1.15); f.rotateY(a);
    parts.push(col(f.translate(x, y, 0), i % 2 ? 0x3e8a32 : 0x52a03e));
  }
  parts.push(col(sph(0.45, x, y - 0.2, 0), 0x6a4a22));
  return merge(parts);
}
export function nyLightGeo() { return merge([col(cyl(0.12, 0.18, 7.5, 8, 0, 3.75, 0), 0x5a5e66), col(T(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6).rotateZ(Math.PI / 2), 1.1, 7.4, 0), 0x5a5e66), col(box(0.8, 0.18, 0.4, 2.3, 7.35, 0), 0x3a3e46), col(box(0.6, 0.06, 0.3, 2.3, 7.24, 0), 0xfff0c8)]); }
export function hydrantGeo() { return merge([col(cyl(0.18, 0.22, 0.7, 10, 0, 0.35, 0), 0xd8261c), col(cyl(0.22, 0.22, 0.08, 10, 0, 0.72, 0), 0xd8261c), col(sph(0.16, 0, 0.78, 0), 0xf2c14e), ...[-1, 1].map(s => col(T(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 8).rotateZ(Math.PI / 2), s * 0.24, 0.45, 0), 0xf2c14e))]); }
export function waterTowerGeo() {
  return merge([col(cyl(1.1, 1.1, 2.2, 14, 0, 2.6, 0), 0x8a6a48), ...[1.8, 2.6, 3.4].map(y => col(cyl(1.13, 1.13, 0.08, 14, 0, y, 0), 0x3a3a3a)), col(T(new THREE.ConeGeometry(1.25, 1.0, 14), 0, 4.2, 0), 0x5a4a3a),
    ...[[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].map(([x, z]) => col(box(0.1, 1.5, 0.1, x, 0.75, z), 0x3a3a3a))]);
}
export function dishGeo() { const d = new THREE.SphereGeometry(0.6, 12, 6, 0, Math.PI * 2, 0, 0.9); d.rotateX(-1.1); return merge([col(T(d, 0, 0.9, 0), 0xe8e8e8), col(cyl(0.04, 0.04, 0.9, 6, 0, 0.45, 0), 0x777777)]); }
export function sphinxSmallGeo() {
  const s = 0xd8b884, d = 0xb8945a;
  return merge([col(box(1.2, 0.5, 2.6, 0, 0.25, 0), 0xc9a46a), col(box(0.9, 0.7, 2.0, 0, 0.85, -0.2), s), col(box(0.95, 1.1, 0.9, 0, 1.2, 0.8), s),
    col(box(0.75, 0.75, 0.6, 0, 1.75, 1.0), d), ...[-0.3, 0.3].map(x => col(box(0.25, 0.25, 1.0, x, 0.62, 1.3), s)), col(box(1.0, 0.9, 0.3, 0, 1.75, 0.75), 0x3a6ab0)]);
}
// 道をまたぐ門: 千本鳥居の代わり。TP は柱の位置（道の中心からの距離）
export function spanGateGeo(theme, TP) {
  if (theme === 'venice') { // 水路をまたぐ白い石のアーチ橋（下をくぐる）。下側はれんが
    const st = 0xece6d8, br = 0xb05a3a, parts = [], X = TP + 1.2, N = 14;
    for (const sx of [-1, 1]) parts.push(col(box(3.2, 6.2, 4.2, sx * (X + 1.4), 3.1, 0), st), col(box(3.4, 0.3, 4.4, sx * (X + 1.4), 6.3, 0), 0xd8d0c0));
    for (let k = 0; k < N; k++) {
      const x0 = -X + (2 * X) * k / N, x1 = -X + (2 * X) * (k + 1) / N, xm = (x0 + x1) / 2;
      const y = 6.0 + 2.6 * Math.cos(xm / X * Math.PI / 2);
      parts.push(col(box(x1 - x0 + 0.05, 1.1, 3.8, xm, y, 0), st), col(box(x1 - x0 + 0.05, 0.25, 3.6, xm, y - 0.65, 0), br));
      for (const sz of [-1.75, 1.75]) parts.push(col(box(0.18, 0.9, 0.18, xm, y + 1.0, sz), 0xf4f0e6));
      for (const sz of [-1.75, 1.75]) parts.push(col(box(x1 - x0 + 0.05, 0.16, 0.3, xm, y + 1.5, sz), st));
    }
    // 両岸へ下りる階段
    for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) parts.push(col(box(1.0, 6.0 - k * 1.0, 3.8, sx * (X + 3.4 + k * 0.9), (6.0 - k * 1.0) / 2, 0), st));
    return merge(parts);
  }
  if (theme === 'giza') { // 神殿の門（パピルス柱と楣石）
    const sand = 0xd8b884, paint = [0x2a6ab0, 0xc0382a, 0xf2c14e];
    const parts = [];
    for (const sx of [-1, 1]) {
      parts.push(col(cyl(0.7, 0.8, 6.4, 12, sx * TP, 3.2, 0), sand), col(cyl(1.25, 0.7, 1.2, 12, sx * TP, 7.0, 0), 0xc9a46a), col(box(2.0, 0.6, 2.0, sx * TP, 0.3, 0), 0xc9a46a));
      paint.forEach((c, k) => parts.push(col(cyl(0.72, 0.72, 0.2, 12, sx * TP, 1.2 + k * 0.35, 0), c)));
    }
    parts.push(col(box(TP * 2 + 3.4, 1.4, 2.2, 0, 8.3, 0), sand), col(box(TP * 2 + 4.0, 0.5, 2.6, 0, 9.2, 0), 0xc9a46a));
    paint.forEach((c, k) => parts.push(col(box(TP * 2 + 3.42, 0.22, 2.22, 0, 7.8 + k * 0.3, 0), c)));
    parts.push(col(T(new THREE.SphereGeometry(0.9, 12, 6).scale(1.8, 0.45, 0.2), 0, 8.4, 1.15), 0xf2c14e));
    return merge(parts);
  }
  // NY: 鉄骨の門（昔の高架鉄道のような）
  const steel = 0x4a5a6a;
  const parts = [];
  for (const sx of [-1, 1]) { parts.push(col(box(0.6, 7.6, 0.6, sx * TP, 3.8, 0), steel), col(box(1.2, 0.3, 1.2, sx * TP, 0.15, 0), 0x3a3a3a)); for (let y = 1; y < 7; y += 1.2) parts.push(col(box(0.66, 0.08, 0.66, sx * TP, y, 0), 0x2a3440)); }
  parts.push(col(box(TP * 2 + 1.6, 1.0, 0.8, 0, 7.8, 0), steel), col(box(TP * 2 + 1.6, 0.12, 1.2, 0, 7.3, 0), 0x2a3440), col(box(TP * 2 + 1.6, 0.12, 1.2, 0, 8.3, 0), 0x2a3440));
  for (let x = -TP + 1.5; x < TP; x += 3) parts.push(col(T(new THREE.BoxGeometry(0.15, 2.6, 0.15).rotateZ(0.7), x, 6.6, 0), steel));
  return merge(parts);
}
// 吊り物の形（提灯の代わり）
export function hangGeo(theme) {
  if (theme === 'paris') return merge([col(sph(0.18, 0, 0, 0, 10, 8), 0xffffff), col(cyl(0.06, 0.06, 0.12, 6, 0, 0.2, 0), 0x333333)]);
  if (theme === 'venice') return laundryGeo();
  if (theme === 'ny') return merge([col(box(0.45, 1.25, 0.4), 0xe8b81c), ...[0.38, 0, -0.38].map((y, k) => col(T(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 12).rotateX(Math.PI / 2), 0, y, 0.21), [0xff2a1a, 0xffc21a, 0x2aff6a][k])), col(cyl(0.03, 0.03, 0.3, 6, 0, 0.75, 0), 0x333333)]);
  return null;
}

// ================= 小物（ぶつかると飛ぶ・くっつく） =================
// 人の形（乱入してくる人たち）: 体・頭・手足の色を変えて使う
function personGeo({ body = 0x3a5a8a, legs = 0x2a2a30, skin = 0xe8b890, head = null, hat = null, wide = 1, h = 1 }) {
  const g = [];
  for (const sx of [-0.13, 0.13]) g.push(col(box(0.16, 0.8 * h, 0.18, sx * wide, 0.4 * h, 0), legs));
  g.push(col(box(0.5 * wide, 0.7 * h, 0.3 * wide, 0, 1.15 * h, 0), body));
  for (const sx of [-1, 1]) g.push(col(T(new THREE.BoxGeometry(0.13, 0.62 * h, 0.13).rotateZ(sx * 0.35), sx * (0.33 * wide + 0.08), 1.18 * h, 0), body));
  g.push(col(sph(0.17, 0, 1.68 * h, 0), head ?? skin));
  if (hat) g.push(col(cyl(0.12, 0.18, 0.22, 10, 0, 1.86 * h, 0), hat));
  return g;
}
export const THEME_PROPS = {
  // ---- 現実にいそうな人・車 ----
  kids: { r: 0.9, mass: 0.2, geo: () => { const g = []; for (let i = 0; i < 4; i++) { const p = personGeo({ body: [0xf4f4f4, 0x8ab0d8, 0xf2a0b0, 0xa8d8a0][i], legs: 0x2a3a5a, hat: 0xf2d21c, h: 0.62 }); p.push(col(box(0.34, 0.36, 0.2, 0, 0.8, -0.2), i % 2 ? 0xc82a2a : 0x1a1a1a)); for (const q of p) q.translate(0, 0, (i - 1.5) * 0.75); g.push(...p); } return merge(g); } },
  dogwalk: { r: 0.8, mass: 0.2, geo: () => merge([...personGeo({ body: 0x8a6a4a, legs: 0x3a3a4a }), col(T(new THREE.SphereGeometry(0.22, 8, 6).scale(1, 0.8, 1.6), 0.7, 0.35, 0.3), 0xc89a5a), col(sph(0.14, 0.7, 0.5, 0.65), 0xc89a5a), ...[[0.6, 0.15], [0.8, 0.15], [0.6, 0.45], [0.8, 0.45]].map(([x, z]) => col(cyl(0.03, 0.03, 0.22, 5, x, 0.11, z), 0xc89a5a)), col(box(0.02, 0.02, 0.8, 0.45, 0.8, 0.35), 0xd8261c)]) },
  takuhai: { r: 1.6, mass: 0.8, geo: () => { const g = [col(box(1.7, 1.6, 1.3, 0, 1.1, 1.9), 0xf4f4f4), col(box(1.72, 0.6, 1.0, 0, 1.4, 2.05), 0x2a3a4a), col(box(1.9, 2.1, 3.6, 0, 1.4, -0.6), 0xf4f4f4), col(box(1.92, 0.5, 3.62, 0, 1.4, -0.6), pick([0x2a8a4a, 0x2a5ab0, 0xd8a01c]))]; for (const [x, z] of [[-0.85, 1.8], [0.85, 1.8], [-0.85, -1.5], [0.85, -1.5]]) g.push(col(T(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 12).rotateZ(Math.PI / 2), x, 0.36, z), 0x222222)); return merge(g); } },
  velib: { r: 1.0, mass: 0.3, geo: () => { const g = []; for (let i = 0; i < 2; i++) { const z = i * 2.2 - 1.1; g.push(...[-0.5, 0.5].map(dz => col(T(new THREE.TorusGeometry(0.33, 0.04, 6, 16).rotateY(Math.PI / 2), 0, 0.35, z + dz), 0x333333)), col(box(0.06, 0.06, 1.0, 0, 0.62, z), 0x9a9aa0), col(box(0.4, 0.2, 0.3, 0, 0.75, z + 0.5), 0x8ac8d8)); g.push(...personGeo({ body: [0xc84a4a, 0x2a4a8a][i], legs: 0x2a2a30 }).map(q => q.translate(0, 0.45, z - 0.1))); } return merge(g); } },
  van: { r: 1.6, mass: 0.8, geo: () => { const c = pick([0xf4f4f4, 0xe8e8e0]); const g = [col(box(1.8, 1.9, 4.6, 0, 1.25, 0), c), col(box(1.82, 0.6, 1.0, 0, 1.6, 1.9), 0x2a3a4a), col(box(1.84, 0.3, 3.0, 0, 1.2, -0.6), pick([0x2a5ab0, 0xd8261c, 0x2a8a4a]))]; for (const [x, z] of [[-0.85, 1.5], [0.85, 1.5], [-0.85, -1.5], [0.85, -1.5]]) g.push(col(T(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12).rotateZ(Math.PI / 2), x, 0.34, z), 0x222222)); return merge(g); } },
  courier: { r: 0.9, mass: 0.3, geo: () => merge([...[-0.5, 0.5].map(dz => col(T(new THREE.TorusGeometry(0.33, 0.05, 6, 16).rotateY(Math.PI / 2), 0, 0.35, dz), 0x222222)), col(box(0.06, 0.06, 1.0, 0, 0.62, 0), 0x2a2a30), ...personGeo({ body: 0x2a2a30, legs: 0x2a2a30, hat: 0x2a2a30 }).map(q => q.translate(0, 0.45, -0.1)), col(box(0.5, 0.5, 0.4, 0, 1.5, -0.45), pick([0x2ab86a, 0xf28a1c, 0xd8261c]))]) },
  microbus: { r: 1.7, mass: 0.8, geo: () => { const g = [col(box(2.0, 2.0, 5.2, 0, 1.3, 0), 0xf4f4f4), col(box(2.02, 0.6, 4.6, 0, 1.75, -0.2), 0x2a3a4a), col(box(2.04, 0.35, 5.2, 0, 0.75, 0), 0x2a6ab0), col(box(1.6, 0.5, 2.0, 0, 2.55, -0.8), 0x8a6a42)]; for (const [x, z] of [[-0.95, 1.7], [0.95, 1.7], [-0.95, -1.7], [0.95, -1.7]]) g.push(col(T(new THREE.CylinderGeometry(0.38, 0.38, 0.26, 12).rotateZ(Math.PI / 2), x, 0.38, z), 0x222222)); return merge(g); } },
  cargoboat: { r: 1.8, mass: 0.8, geo: () => merge([col(box(2.2, 0.8, 7, 0, 0.3, 0), 0x3a4a3a), col(box(2.25, 0.15, 7.05, 0, 0.72, 0), 0xa8a8a0), ...[-1.5, 0, 1.5].map((z, k) => col(box(1.2, 0.8, 1.1, (k - 1) * 0.3, 1.2, z), [0x8a6a42, 0xc8a070, 0x6a8ab0][k])), col(box(0.8, 1.0, 0.8, 0, 1.3, -3.0), 0xf4f4f4)]) },
  policeboat: { r: 1.6, mass: 0.7, geo: () => merge([col(T(new THREE.SphereGeometry(1, 14, 8).scale(1.1, 0.5, 3.2), 0, 0.3, 0), 0xf4f4f4), col(box(2.2, 0.12, 4.6, 0, 0.6, -0.2), 0x1e3c8a), col(box(1.4, 0.9, 1.6, 0, 1.1, 0), 0xf4f4f4), col(box(1.42, 0.4, 1.4, 0, 1.25, 0.05), 0x2a3a4a), col(box(0.6, 0.15, 0.25, 0, 1.65, 0), 0x2050ff)]) },
  // ---- 日本 ----
  sumo: { r: 0.9, mass: 0.9, geo: () => { const sk = 0xe8b890; return merge([col(T(new THREE.SphereGeometry(0.75, 14, 10).scale(1, 1.1, 0.9), 0, 1.15, 0), sk), col(cyl(0.72, 0.74, 0.32, 14, 0, 0.72, 0), 0x2a2a6a), ...[-0.3, 0.3].map(x => col(cyl(0.2, 0.22, 0.6, 8, x, 0.3, 0), sk)), ...[-1, 1].map(s => col(T(new THREE.CylinderGeometry(0.15, 0.17, 0.7, 8).rotateZ(s * 0.8), s * 0.8, 1.35, 0), sk)), col(sph(0.26, 0, 2.0, 0), sk), col(sph(0.12, 0, 2.22, -0.18), 0x1a1a1a)]); } },
  kei: { r: 1.4, mass: 0.7, geo: () => { const w = 0xf4f4f4, d = 0x222222; const g = [col(box(1.45, 1.2, 1.3, 0, 1.0, 1.0), w), col(box(1.46, 0.5, 1.2, 0, 1.3, 1.05), 0x2a3a4a), col(box(1.45, 0.45, 2.0, 0, 0.6, -0.6), w), col(box(1.45, 0.4, 0.06, 0, 1.0, -1.6), w), ...[-0.72, 0.72].map(x => col(box(0.06, 0.4, 2.0, x, 1.0, -0.6), w))]; for (const [x, z] of [[-0.65, 1.0], [0.65, 1.0], [-0.65, -1.0], [0.65, -1.0]]) g.push(col(T(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 12).rotateZ(Math.PI / 2), x, 0.28, z), d)); g.push(col(box(0.8, 0.5, 0.8, 0, 1.05, -0.6), 0x8a6a42), col(box(0.6, 0.4, 0.6, 0.3, 1.45, -0.9), 0xd8a050)); return merge(g); } },
  yaki: { r: 1.0, mass: 0.4, geo: () => merge([col(box(1.2, 0.8, 1.6, 0, 0.9, 0), 0x6a4a2a), col(T(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 12).rotateX(Math.PI / 2), 0, 1.5, 0), 0x2a2a2a), col(cyl(0.06, 0.06, 1.0, 6, 0, 2.2, 0.3), 0x2a2a2a), col(box(1.0, 0.5, 0.05, 0, 1.6, 0.82), 0xd8261c), ...[-0.6, 0.6].map(x => col(T(new THREE.CylinderGeometry(0.35, 0.35, 0.1, 12).rotateZ(Math.PI / 2), x, 0.35, 0), 0x3a3a3a)), col(box(0.06, 0.06, 1.2, -0.4, 0.9, 1.3), 0x8a6a42), col(box(0.06, 0.06, 1.2, 0.4, 0.9, 1.3), 0x8a6a42), ...personGeo({ body: 0x3a3a5a, hat: 0xd8c08a }).map(g => g.translate(0, 0, 2.1))]) },
  deer: { r: 0.8, mass: 0.3, geo: () => { const c = 0xb07a48; return merge([col(T(new THREE.SphereGeometry(0.4, 10, 8).scale(1, 0.9, 1.6), 0, 1.0, 0), c), ...[[-0.18, 0.45], [0.18, 0.45], [-0.18, -0.45], [0.18, -0.45]].map(([x, z]) => col(cyl(0.05, 0.04, 0.9, 6, x, 0.45, z), c)), col(strut(new THREE.Vector3(0, 1.1, 0.55), new THREE.Vector3(0, 1.6, 0.8), 0.1, 0.08, 6), c), col(T(new THREE.SphereGeometry(0.16, 8, 6).scale(1, 0.9, 1.4), 0, 1.65, 0.92), c), col(cyl(0.02, 0.03, 0.4, 5, -0.1, 1.95, 0.85), 0xe8dcc0), col(cyl(0.02, 0.03, 0.4, 5, 0.1, 1.95, 0.85), 0xe8dcc0), ...[0, 1, 2].map(k => col(sph(0.06, (k - 1) * 0.14, 1.15, 0.2 - k * 0.2), 0xf4ead0))]); } },
  // ---- パリ ----
  mime: { r: 0.6, mass: 0.2, geo: () => { const g = personGeo({ body: 0xf4f4f4, legs: 0x1a1a1a, head: 0xf4f4f4, hat: 0x1a1a1a }); for (let k = 0; k < 4; k++) g.push(col(box(0.52, 0.06, 0.32, 0, 0.9 + k * 0.16, 0), 0x1a1a1a)); g.push(col(box(0.22, 0.02, 0.02, 0, 1.62, 0.17), 0xd8261c)); return merge(g); } },
  poodle: { r: 0.7, mass: 0.2, geo: () => merge([...personGeo({ body: 0xc84a7a, legs: 0x1a1a1a, hat: 0xf2d0e0 }), col(sph(0.28, 0.9, 0.5, 0.2), 0xf4f0f0), col(sph(0.2, 0.9, 0.85, 0.5), 0xf4f0f0), col(sph(0.14, 0.9, 0.4, -0.15), 0xf4f0f0), ...[[0.8, 0.3], [1.0, 0.3], [0.8, 0], [1.0, 0]].map(([x, z]) => col(cyl(0.04, 0.04, 0.35, 5, x, 0.18, z), 0xf4f0f0)), col(box(0.02, 0.02, 0.9, 0.5, 0.9, 0.3), 0xd8261c)]) },
  scooter: { r: 0.9, mass: 0.3, geo: () => { const c = pick([0x8ad8c8, 0xf2c14e, 0xd84a4a]); return merge([col(T(new THREE.SphereGeometry(0.4, 10, 8).scale(0.8, 0.9, 1.4), 0, 0.6, -0.3), c), col(box(0.3, 0.12, 0.9, 0, 0.42, 0.2), c), col(box(0.25, 0.8, 0.2, 0, 0.8, 0.65), c), col(box(0.6, 0.05, 0.05, 0, 1.2, 0.7), 0x333333), ...[-0.6, 0.75].map(z => col(T(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 12).rotateZ(Math.PI / 2), 0, 0.22, z), 0x222222)), ...personGeo({ body: 0x2a4a8a, legs: 0x3a3a3a, hat: 0xf4f4f4 }).map(g => g.translate(0, 0.3, -0.2))]); } },
  // ---- NY ----
  schoolbus: { r: 2.0, mass: 1.0, geo: () => { const y = 0xf2b41c, g = [col(box(2.4, 2.2, 9, 0, 1.5, 0), y), col(box(2.2, 1.2, 1.4, 0, 1.0, 5.1), y), col(box(2.42, 0.18, 9, 0, 1.3, 0), 0x1a1a1a), col(box(2.42, 0.18, 9, 0, 0.8, 0), 0x1a1a1a)]; for (let k = 0; k < 6; k++) for (const sx of [-1, 1]) g.push(col(box(0.04, 0.6, 1.0, sx * 1.21, 2.0, -3.5 + k * 1.3), 0x2a3a4a)); for (const [x, z] of [[-1.1, 3.5], [1.1, 3.5], [-1.1, -3.0], [1.1, -3.0]]) g.push(col(T(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12).rotateZ(Math.PI / 2), x, 0.5, z), 0x222222)); g.push(col(box(1.2, 0.3, 0.05, 0, 2.4, 4.52), 0x1a1a1a)); return merge(g); } },
  limo: { r: 1.8, mass: 0.9, geo: () => { const k = 0x111114, g = [col(box(1.9, 0.7, 7.6, 0, 0.6, 0), k), col(box(1.7, 0.5, 4.8, 0, 1.2, -0.4), k), col(box(1.72, 0.32, 4.6, 0, 1.22, -0.4), 0x3a4a5a), col(box(1.92, 0.06, 7.62, 0, 0.75, 0), 0xc0c0c8)]; for (const [x, z] of [[-0.9, 2.8], [0.9, 2.8], [-0.9, -2.8], [0.9, -2.8]]) g.push(col(T(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12).rotateZ(Math.PI / 2), x, 0.34, z), 0x222222)); return merge(g); } },
  // ---- ギザ ----
  donkey: { r: 1.2, mass: 0.5, geo: () => { const c = 0x8a7a6a; return merge([col(T(new THREE.SphereGeometry(0.45, 10, 8).scale(1, 0.9, 1.5), 0, 1.0, 1.2), c), ...[[-0.18, 1.6], [0.18, 1.6], [-0.18, 0.8], [0.18, 0.8]].map(([x, z]) => col(cyl(0.06, 0.05, 0.9, 6, x, 0.45, z), c)), col(strut(new THREE.Vector3(0, 1.15, 1.75), new THREE.Vector3(0, 1.5, 2.1), 0.13, 0.1, 6), c), col(T(new THREE.BoxGeometry(0.25, 0.25, 0.55), 0, 1.5, 2.3), c), ...[-0.08, 0.08].map(x => col(box(0.05, 0.35, 0.08, x, 1.78, 2.15), c)), col(box(1.4, 0.15, 1.6, 0, 0.75, -0.6), 0x8a6a42), ...[-0.75, 0.75].map(x => col(T(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 10).rotateZ(Math.PI / 2), x, 0.45, -0.6), 0x6a4a2a)), col(box(1.0, 0.6, 1.0, 0, 1.1, -0.6), 0x4a8a3a), col(box(0.05, 0.05, 1.4, -0.4, 0.85, 0.5), 0x6a4a2a), col(box(0.05, 0.05, 1.4, 0.4, 0.85, 0.5), 0x6a4a2a)]); } },
  mummy: { r: 0.6, mass: 0.2, geo: () => { const g = personGeo({ body: 0xe8dcc0, legs: 0xe8dcc0, head: 0xe8dcc0 }); for (let k = 0; k < 10; k++) g.push(col(T(new THREE.TorusGeometry(0.27, 0.03, 4, 12).rotateX(Math.PI / 2 + 0.2), 0, 0.3 + k * 0.17, 0), 0xc8b898)); for (const sx of [-1, 1]) g.push(col(box(0.13, 0.13, 0.6, sx * 0.2, 1.4, 0.35), 0xe8dcc0)); g.push(col(box(0.2, 0.04, 0.02, 0, 1.72, 0.17), 0x1a1a1a)); return merge(g); } },
  tourbus: { r: 2.0, mass: 1.0, geo: () => { const w = 0xf4f0e8, g = [col(box(2.5, 2.6, 10, 0, 1.7, 0), w), col(box(2.52, 0.7, 9.6, 0, 2.2, 0), 0x2a3a4a), col(box(2.53, 0.25, 10, 0, 0.9, 0), 0xc8902a), col(box(2.53, 0.12, 10, 0, 1.2, 0), 0x2a6ab0)]; for (const [x, z] of [[-1.15, 3.6], [1.15, 3.6], [-1.15, -3.6], [1.15, -3.6]]) g.push(col(T(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12).rotateZ(Math.PI / 2), x, 0.5, z), 0x222222)); return merge(g); } },
  // ---- ベネチア ----
  watertaxi: { r: 1.6, mass: 0.6, geo: () => merge([col(T(new THREE.SphereGeometry(1, 14, 8).scale(1.1, 0.5, 3.4), 0, 0.3, 0), 0x8a4a22), col(box(1.6, 0.06, 5, 0, 0.62, -0.2), 0xe8d8b8), col(box(1.4, 0.8, 1.8, 0, 1.0, 0.2), 0xa86a3a), col(box(1.42, 0.4, 1.6, 0, 1.15, 0.25), 0x2a3a4a), col(box(0.05, 0.6, 0.05, 0, 1.6, -1.6), 0xf4f4f4), col(box(0.4, 0.25, 0.02, 0.2, 1.8, -1.6), 0xd8261c)]) },
  carnival: { r: 0.7, mass: 0.2, geo: () => { const g = personGeo({ body: 0x6a1a8a, legs: 0x1a1a1a, head: 0xf2d27a }); g.push(col(T(new THREE.ConeGeometry(0.5, 0.25, 12), 0, 1.98, 0), 0x1a1a1a), col(T(new THREE.ConeGeometry(0.75, 1.6, 12, 1, true), 0, 0.85, 0), 0xa82a6a), col(box(0.3, 0.06, 0.02, 0, 1.7, 0.17), 0xf2c14e)); for (let k = 0; k < 3; k++) g.push(col(T(new THREE.ConeGeometry(0.05, 0.6, 5).rotateZ((k - 1) * 0.4), (k - 1) * 0.15, 2.3, 0), [0xf2c14e, 0x2ab86a, 0xd8261c][k])); return merge(g); } },
  swan: { r: 1.3, mass: 0.4, geo: () => merge([col(T(new THREE.SphereGeometry(0.9, 12, 8).scale(1, 0.55, 1.5), 0, 0.4, 0), 0xf8f8f8), col(strut(new THREE.Vector3(0, 0.6, 1.0), new THREE.Vector3(0, 1.6, 1.3), 0.14, 0.1, 8), 0xf8f8f8), col(T(new THREE.SphereGeometry(0.18, 8, 6).scale(1, 0.9, 1.4), 0, 1.7, 1.45), 0xf8f8f8), col(T(new THREE.ConeGeometry(0.06, 0.25, 6).rotateX(Math.PI / 2), 0, 1.68, 1.68), 0xf28a1c), ...[-1, 1].map(s => col(T(new THREE.SphereGeometry(0.6, 8, 6).scale(0.3, 0.5, 1.1), s * 0.75, 0.75, -0.1), 0xf0f0f0))]) },
  cafe: { r: 0.9, mass: 0.3, geo: () => {
    const g = []; g.push(col(cyl(0.45, 0.45, 0.05, 14, 0, 0.75, 0), 0xf4f4f4), col(cyl(0.04, 0.04, 0.72, 6, 0, 0.37, 0), 0x333333), col(cyl(0.2, 0.25, 0.04, 10, 0, 0.02, 0), 0x333333));
    g.push(col(cyl(0.025, 0.025, 2.2, 6, 0, 1.1, 0), 0x333333));
    const um = new THREE.ConeGeometry(1.3, 0.5, 8, 1, true); um.translate(0, 2.3, 0); g.push(col(um, 0xc62828));
    for (const sx of [-1, 1]) g.push(col(box(0.42, 0.05, 0.42, sx * 0.75, 0.45, 0), 0x6a3a1c), col(box(0.42, 0.5, 0.05, sx * 0.75, 0.7, sx * 0.0 - 0.2), 0x6a3a1c), ...[-0.18, 0.18].map(z => col(box(0.04, 0.45, 0.04, sx * 0.75, 0.22, z), 0x333333)));
    return merge(g);
  } },
  barrel: { r: 0.5, mass: 0.6, geo: () => { const p = []; for (let i = 0; i <= 8; i++) { const t = i / 8; p.push(new THREE.Vector2(0.38 + Math.sin(t * Math.PI) * 0.08, t * 1.0)); } const g = new THREE.LatheGeometry(p, 14); return merge([col(g, 0x8a5a2e), ...[0.12, 0.88].map(y => col(cyl(0.43, 0.43, 0.06, 14, 0, y, 0), 0x3a3a3a)), col(cyl(0.37, 0.37, 0.02, 14, 0, 1.0, 0), 0x6a4422)]); } },
  taxi: { r: 1.5, mass: 0.9, geo: () => {
    const y = 0xf2c11c, d = 0x222222;
    const g = [col(box(1.8, 0.7, 4.6, 0, 0.6, 0), y), col(box(1.6, 0.55, 2.4, 0, 1.22, -0.2), y), col(box(1.62, 0.42, 2.1, 0, 1.24, -0.2), 0x2a3a4a), col(box(0.6, 0.22, 0.25, 0, 1.6, -0.2), 0xf4f4f4),
      col(box(1.82, 0.1, 4.62, 0, 0.62, 0), d), col(box(1.4, 0.1, 0.05, 0, 0.62, 2.31), 0xffffd0), col(box(1.4, 0.1, 0.05, 0, 0.62, -2.31), 0xd8261c)];
    for (const [x, z] of [[-0.85, 1.5], [0.85, 1.5], [-0.85, -1.5], [0.85, -1.5]]) g.push(col(T(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12).rotateZ(Math.PI / 2), x, 0.34, z), d));
    for (let k = 0; k < 6; k++) g.push(col(box(0.06, 0.12, 0.12, 0.92, 0.75, -1.2 + k * 0.24), k % 2 ? d : 0xf4f4f4));
    return merge(g);
  } },
  police: { r: 1.5, mass: 0.9, geo: () => {
    const w = 0xf4f4f4, b = 0x1e3c8a, d = 0x222222;
    const g = [col(box(1.8, 0.7, 4.7, 0, 0.6, 0), w), col(box(1.6, 0.55, 2.4, 0, 1.22, -0.2), w), col(box(1.62, 0.42, 2.1, 0, 1.24, -0.2), 0x2a3a4a), col(box(1.82, 0.22, 4.72, 0, 0.62, 0), b),
      col(box(1.84, 0.12, 1.4, 0, 0.82, 0.2), b), col(box(1.0, 0.16, 0.36, 0, 1.56, -0.2), 0x333333), col(box(1.4, 0.1, 0.05, 0, 0.62, 2.36), 0xffffd0), col(box(1.82, 0.1, 4.72, 0, 0.36, 0), d)];
    for (const [x, z] of [[-0.85, 1.5], [0.85, 1.5], [-0.85, -1.5], [0.85, -1.5]]) g.push(col(T(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12).rotateZ(Math.PI / 2), x, 0.34, z), d));
    return merge(g);
  } },
  jpolice: { r: 1.5, mass: 0.9, geo: () => {   // 日本のパトカー（白黒）
    const w = 0xf4f4f4, k = 0x161618, d = 0x222222;
    const g = [col(box(1.75, 0.42, 4.6, 0, 0.52, 0), k), col(box(1.76, 0.3, 4.62, 0, 0.88, 0), w), col(box(1.58, 0.55, 2.3, 0, 1.3, -0.2), w), col(box(1.6, 0.42, 2.0, 0, 1.32, -0.2), 0x2a3a4a),
      col(box(1.1, 0.16, 0.36, 0, 1.64, -0.2), 0x333333), col(box(1.3, 0.1, 0.05, 0, 0.62, 2.31), 0xffffd0), col(box(0.9, 0.18, 0.02, 0, 0.88, 2.32), 0xd8261c)];
    for (const [x, z] of [[-0.85, 1.5], [0.85, 1.5], [-0.85, -1.5], [0.85, -1.5]]) g.push(col(T(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 12).rotateZ(Math.PI / 2), x, 0.33, z), d));
    return merge(g);
  } },
  mikoshi: { r: 1.4, mass: 0.6, geo: () => {   // 神輿（担ぎ手つき）
    const g = [col(box(1.2, 0.9, 1.2, 0, 1.9, 0), 0x1a1a1a), col(box(1.3, 0.12, 1.3, 0, 2.4, 0), 0xc8a040), col(T(new THREE.ConeGeometry(1.1, 0.8, 4).rotateY(Math.PI / 4), 0, 2.85, 0), 0x2a2a2a), col(sph(0.18, 0, 3.35, 0), 0xf2c14e),
      col(box(0.1, 0.1, 4.2, -0.45, 1.4, 0), 0xe8dcc0), col(box(0.1, 0.1, 4.2, 0.45, 1.4, 0), 0xe8dcc0), col(box(1.0, 0.7, 1.0, 0, 1.9, 0.01), 0xd8a030)];
    for (const [x, z] of [[-0.75, 1.5], [0.75, 1.5], [-0.75, -1.5], [0.75, -1.5], [-0.75, 0], [0.75, 0]]) g.push(col(cyl(0.2, 0.2, 1.0, 8, x, 0.5, z), 0xf4f4f4), col(sph(0.17, x, 1.15, z), 0xe8b890), col(box(0.42, 0.1, 0.42, x, 1.32, z), 0xf4f4f4));
    return merge(g);
  } },
  petite: { r: 1.3, mass: 0.6, geo: () => {   // フランスの小型車
    const c = pick([0x8ab8d8, 0xd8c88a, 0xc84a3a, 0x9ab89a]);
    const g = [col(T(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.85, 0.75, 1.9), 0, 0.45, 0), c), col(box(1.5, 0.45, 3.4, 0, 0.45, 0), c), col(box(1.3, 0.4, 1.0, 0, 1.0, -0.2), 0x2a3a4a)];
    for (const [x, z] of [[-0.7, 1.1], [0.7, 1.1], [-0.7, -1.1], [0.7, -1.1]]) g.push(col(T(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12).rotateZ(Math.PI / 2), x, 0.3, z), 0x222222));
    g.push(col(sph(0.13, -0.5, 0.65, 1.68), 0xffffd0), col(sph(0.13, 0.5, 0.65, 1.68), 0xffffd0));
    return merge(g);
  } },
  firetruck: { r: 1.8, mass: 1.0, geo: () => {   // 消防車
    const r = 0xd8201c, g = [col(box(2.2, 1.4, 7.5, 0, 1.0, 0), r), col(box(2.2, 1.0, 2.0, 0, 2.2, 2.6), r), col(box(2.22, 0.6, 1.6, 0, 2.3, 2.7), 0x2a3a4a), col(box(2.24, 0.2, 7.5, 0, 0.5, 0), 0xe8e8e8),
      col(box(0.5, 0.2, 6.0, 0.3, 2.0, -0.9), 0xd8d8d8), col(box(0.5, 0.2, 6.0, -0.3, 2.0, -0.9), 0xd8d8d8), col(box(1.4, 0.18, 0.3, 0, 2.8, 3.5), 0xff2020)];
    for (let k = 0; k < 10; k++) g.push(col(box(0.7, 0.06, 0.08, 0, 2.05, -3.6 + k * 0.6), 0xd8d8d8));
    for (const [x, z] of [[-1.0, 2.6], [1.0, 2.6], [-1.0, -1.8], [1.0, -1.8], [-1.0, -2.9], [1.0, -2.9]]) g.push(col(T(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12).rotateZ(Math.PI / 2), x, 0.45, z), 0x222222));
    return merge(g);
  } },
  tuktuk: { r: 1.1, mass: 0.5, geo: () => {   // トゥクトゥク
    const c = pick([0xd8261c, 0x2a8a4a, 0x2a5ab0]);
    const g = [col(box(1.3, 0.5, 2.2, 0, 0.6, 0), c), col(box(1.35, 0.08, 2.3, 0, 1.9, -0.1), 0x1a1a1a), ...[[-0.6, -1.0], [0.6, -1.0], [-0.6, 0.8], [0.6, 0.8]].map(([x, z]) => col(box(0.06, 1.1, 0.06, x, 1.35, z), 0x333333)),
      col(box(0.8, 0.6, 0.4, 0, 1.1, 0.9), 0xf2c14e), col(box(1.0, 0.5, 0.6, 0, 1.1, -0.6), 0x6a4a2a), col(T(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 12).rotateZ(Math.PI / 2), 0, 0.28, 1.1), 0x222222)];
    for (const x of [-0.65, 0.65]) g.push(col(T(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 12).rotateZ(Math.PI / 2), x, 0.28, -0.8), 0x222222));
    return merge(g);
  } },
  vaporetto: { r: 2.4, mass: 1.0, geo: () => vaporettoGeo().scale(0.75, 0.75, 0.75) },
  steam: { r: 0.5, mass: 0.3, geo: () => { const p = []; for (let k = 0; k < 5; k++) p.push(col(cyl(0.42, 0.45, 0.44, 12, 0, 0.22 + k * 0.44, 0), k % 2 ? 0xffffff : 0xf27a1c)); p.push(col(cyl(0.3, 0.42, 0.25, 12, 0, 2.32, 0), 0xf27a1c)); return merge(p); } },
  hotdog: { r: 1.0, mass: 0.5, geo: () => merge([col(box(1.6, 0.9, 0.9, 0, 0.75, 0), 0xc8ccd0), col(box(1.62, 0.12, 0.92, 0, 1.25, 0), 0x8a8e94), ...[-0.6, 0.6].map(x => col(T(new THREE.CylinderGeometry(0.25, 0.25, 0.1, 12).rotateX(Math.PI / 2), x, 0.3, 0.5), 0x222222)),
    col(cyl(0.03, 0.03, 1.6, 6, 0, 2.0, 0), 0x666666), col(T(new THREE.ConeGeometry(1.1, 0.45, 8, 1, true), 0, 2.8, 0), 0x2a6ad8), col(T(new THREE.ConeGeometry(1.12, 0.2, 8, 1, true), 0, 2.62, 0), 0xf2c11c), col(box(1.0, 0.25, 0.04, 0, 0.9, 0.46), 0xd8261c)]) },
  hydrant: { r: 0.35, mass: 0.4, geo: () => hydrantGeo() },
  camel: { r: 1.2, mass: 0.8, geo: () => {
    const c = 0xc9955a, d = 0xa8763e;
    const g = [col(T(new THREE.SphereGeometry(0.75, 12, 9).scale(1, 0.75, 1.5), 0, 1.75, 0), c), col(T(new THREE.SphereGeometry(0.45, 10, 8).scale(1, 1.1, 1.2), 0, 2.35, -0.1), d)];
    for (const [x, z] of [[-0.35, 0.75], [0.35, 0.75], [-0.35, -0.75], [0.35, -0.75]]) g.push(col(cyl(0.11, 0.08, 1.5, 6, x, 0.75, z), c));
    g.push(col(strut(new THREE.Vector3(0, 1.9, 1.0), new THREE.Vector3(0, 2.8, 1.6), 0.2, 0.14, 8), c), col(T(new THREE.BoxGeometry(0.32, 0.3, 0.7), 0, 2.85, 1.85), c));
    g.push(col(box(0.9, 0.12, 0.9, 0, 2.05, 0.4), 0xb8282a), col(box(0.92, 0.1, 0.92, 0, 2.0, 0.4), 0xf2c14e));
    return merge(g);
  } },
  pot: { r: 0.45, mass: 0.3, geo: () => { const p = [[0.12, 0], [0.32, 0.12], [0.42, 0.45], [0.36, 0.78], [0.18, 0.95], [0.2, 1.08], [0.24, 1.12]].map(([r, y]) => new THREE.Vector2(r, y)); return merge([col(new THREE.LatheGeometry(p, 14), 0xb8603a), col(cyl(0.43, 0.43, 0.08, 14, 0, 0.45, 0), 0x3a2a8a)]); } },
  gondola: { r: 1.7, mass: 0.7, geo: () => gondolaGeo().scale(0.62, 0.62, 0.62) },
  canoe: { r: 1.2, mass: 0.3, geo: () => canoeGeo(pick([0xe8261c, 0xf2c11c, 0x2a8ad8, 0x2ab86a])) },
  stall: { r: 1.1, mass: 0.5, geo: () => { const c = pick([0xb8282a, 0x2a5ab0, 0xe8b42a, 0x2a8a5a]); return merge([col(box(1.8, 0.8, 0.9, 0, 0.4, 0), 0x8a6a42), ...[[-0.85, -0.4], [0.85, -0.4], [-0.85, 0.4], [0.85, 0.4]].map(([x, z]) => col(box(0.06, 2.2, 0.06, x, 1.1, z), 0x6a4a2a)), col(T(new THREE.BoxGeometry(2.1, 0.08, 1.4).rotateX(0.2), 0, 2.25, 0.1), c), ...[-0.5, 0, 0.5].map((x, k) => col(sph(0.18, x, 0.95, 0.1), [0xf2c14e, 0xe86a3a, 0x6a8a2a][k]))]); } },
};
// ステージごとの小物の並び（道ばた用・角の山積み用）
export const THEME_PROP_SETS = {
  jp: { side: { mod: ['cone', 'bin', 'sign', 'bike', 'crate', 'jpolice'], old: ['tawara', 'crate', 'tawara', 'sign'] }, pile: ['tawara', 'crate'], works: true },
  paris: { side: { mod: ['cafe', 'cafe', 'bike', 'barrel', 'sign'], old: ['cafe', 'barrel', 'bike'] }, pile: ['barrel', 'crate'], works: false },
  ny: { side: { mod: ['taxi', 'police', 'taxi', 'steam', 'hotdog', 'hydrant'], old: ['taxi', 'steam', 'police', 'hotdog'] }, pile: ['cone', 'police', 'barricade'], works: true },
  venice: { side: { mod: ['gondola', 'canoe', 'canoe', 'gondola', 'barrel'], old: ['gondola', 'canoe', 'canoe'] }, pile: ['barrel', 'crate'], works: false },
  giza: { side: { mod: ['camel', 'pot', 'stall', 'crate'], old: ['camel', 'pot', 'stall'] }, pile: ['pot', 'crate'], works: false },
};
export const THEME_PROP_NAMES = { kids: ['登校中の小学生', 100], dogwalk: ['犬の散歩', 80], takuhai: ['宅配トラック', 3000], velib: ['シェア自転車', 150], van: ['配達のバン', 2200], courier: ['自転車の配達員', 90], microbus: ['乗り合いバス', 2600], cargoboat: ['荷物運びの船', 3000], policeboat: ['警察の船', 2000], sumo: ['お相撲さん', 180], kei: ['軽トラ', 700], yaki: ['焼き芋屋のリヤカー', 120], deer: ['鹿', 60], mime: ['パントマイム芸人', 60], poodle: ['プードルとマダム', 70], scooter: ['スクーター', 130],
  schoolbus: ['スクールバス', 11000], limo: ['リムジン', 4000], donkey: ['ロバの荷車', 300], mummy: ['ミイラ', 40], tourbus: ['観光バス', 13000], watertaxi: ['水上タクシー', 2500], carnival: ['仮面の踊り手', 65], swan: ['白鳥', 10], mikoshi: ['神輿', 1000], petite: ['フランスの小型車', 600], firetruck: ['消防車', 12000], tuktuk: ['トゥクトゥク', 350], vaporetto: ['水上バス', 30000], jpolice: ['パトカー', 1400], police: ['パトカー', 1500], steam: ['蒸気の煙突', 60], gondola: ['ゴンドラ', 600], canoe: ['カヌー', 30], cafe: ['カフェのテーブル', 25], barrel: ['ワイン樽', 120], taxi: ['イエローキャブ', 1400], hotdog: ['ホットドッグ屋台', 200], hydrant: ['消火栓', 90], camel: ['らくだ', 500], pot: ['つぼ', 15], stall: ['屋台', 80] };

// ================= 名所 =================
const stoneMat = (c = '#e8dcbc', c2 = '#cbbd98') => toon({ map: canvasTex(256, 256, (g, w, h) => { g.fillStyle = c; g.fillRect(0, 0, w, h); noise(g, w, h, 5000, 0.18, ['#000', '#fff']); g.fillStyle = c2; for (let y = 0; y < h; y += 32) { g.fillRect(0, y, w, 3); for (let x = (y / 32) % 2 * 32; x < w; x += 64) g.fillRect(x, y, 3, 32); } }, { repeat: true }) });
function outlineAll(grp, th) { const ms = []; grp.traverse(o => { if (o.isMesh && !o.userData.noOutline) ms.push(o); }); ms.forEach(o => { o.castShadow = true; o.receiveShadow = true; withOutline(o, th); }); }
const latticeTex = () => { const t = canvasTex(128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 7; g.strokeRect(3, 3, w - 6, h - 6); g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke(); g.lineWidth = 3; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke(); }, { repeat: true }); return t; };

// エッフェル塔（高さ約 120 m）
export function eiffel() {
  const grp = new THREE.Group();
  const lat = latticeTex(); lat.repeat.set(3, 6);
  const iron = toon({ color: 0x7a5a3e, map: lat, alphaTest: 0.5, side: THREE.DoubleSide });
  const solid = toon({ color: 0x6a4e36 });
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const legs = [];
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    legs.push(strut(V(sx * 22, 0, sz * 22), V(sx * 12, 22, sz * 12), 4.2, 3.0), strut(V(sx * 12, 22, sz * 12), V(sx * 6.5, 46, sz * 6.5), 3.0, 2.0));
  }
  const lm = new THREE.Mesh(merge(legs), iron); lm.userData.noOutline = true; grp.add(lm);
  const shaft = new THREE.Mesh(strut(V(0, 46, 0), V(0, 112, 0), 7.5, 1.6), iron); shaft.userData.noOutline = true; grp.add(shaft);
  // 足元のアーチ
  for (let k = 0; k < 4; k++) { const a = new THREE.Mesh(new THREE.TorusGeometry(15, 1.0, 6, 24, Math.PI), solid); a.position.set(0, 0, 0); a.rotation.y = k * Math.PI / 2; a.position.set(Math.sin(k * Math.PI / 2) * 17, 1, Math.cos(k * Math.PI / 2) * 17); grp.add(a); }
  for (const [y, s, h] of [[22, 30, 2.4], [46, 16, 1.8], [100, 5, 1.2]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(s, h, s), solid); p.position.y = y; grp.add(p); }
  const top = new THREE.Mesh(merge([col(box(3.2, 3.2, 3.2, 0, 114, 0), 0x6a4e36), col(cyl(0.3, 0.5, 9, 6, 0, 120, 0), 0x8a8a8a), col(cyl(0.12, 0.12, 4, 6, 0, 126, 0), 0xd8261c)]), toon({ vertexColors: true })); grp.add(top);
  outlineAll(grp, 0.15);
  return grp;
}
// 凱旋門（道がまん中をくぐる）。幅 54・高さ 50・奥行き 22
export function arcDeTriomphe(open) {
  const grp = new THREE.Group();
  const W = 27, H = 50, D = 22, R = open / 2, spring = 20;
  // 輪郭をひと筆でなぞる（左の脚 → アーチの上 → 右の脚）。穴にすると下が閉じて壁になってしまう
  const sh = new THREE.Shape(); sh.moveTo(-W, 0); sh.lineTo(-R, 0); sh.lineTo(-R, spring); sh.absarc(0, spring, R, Math.PI, 0, true); sh.lineTo(R, 0); sh.lineTo(W, 0); sh.lineTo(W, H); sh.lineTo(-W, H); sh.lineTo(-W, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: D, bevelEnabled: false, curveSegments: 24 }); g.translate(0, 0, -D / 2);
  const st = stoneMat('#ece2c8', '#d4c6a2');
  const body = new THREE.Mesh(g, st); grp.add(body);
  // 胴の帯・軒・浮き彫り
  const dark = toon({ color: 0xc8b88e }), relief = toon({ map: canvasTex(128, 256, (gg, w, h) => { gg.fillStyle = '#ddd0b0'; gg.fillRect(0, 0, w, h); gg.fillStyle = '#b8a880'; for (let i = 0; i < 6; i++) { gg.beginPath(); gg.arc(30 + (i % 2) * 60, 40 + i * 36, 16, 0, 7); gg.fill(); gg.fillRect(20 + (i % 2) * 60, 50 + i * 36, 20, 30); } gg.strokeStyle = '#a89870'; gg.lineWidth = 6; gg.strokeRect(6, 6, w - 12, h - 12); }) });
  for (const [y, h, e] of [[H - 2, 4, 1.2], [36, 2.2, 0.8], [spring + R + 1.5, 1.6, 0.5]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + e * 2, h, D + e * 2), dark); b.position.y = y; grp.add(b); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(7, 16, 0.8), relief); p.position.set(sx * (R + (W - R) / 2), 12, sz * (D / 2 + 0.4)); grp.add(p); }
  outlineAll(grp, 0.12);
  return grp;
}
export function louvrePyramid() {
  const grp = new THREE.Group();
  const glass = toon({ color: 0x9cc8dc, transparent: true, opacity: 0.75 });
  const p = new THREE.Mesh(new THREE.ConeGeometry(17, 21, 4, 1), glass); p.rotation.y = Math.PI / 4; p.position.y = 10.5; grp.add(p);
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.ConeGeometry(17.05, 21.05, 4, 6)), new THREE.LineBasicMaterial({ color: 0x3a4a56 })); frame.rotation.y = Math.PI / 4; frame.position.y = 10.5; grp.add(frame);
  const pool = new THREE.Mesh(new THREE.BoxGeometry(40, 0.4, 40), toon({ color: 0xd8d0c0 })); pool.position.y = 0.2; grp.add(pool);
  for (const [x, z] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) { const w = new THREE.Mesh(new THREE.BoxGeometry(9, 0.3, 9), toon({ color: 0x3a6a8a })); w.position.set(x, 0.45, z); grp.add(w); }
  return grp;
}
export function carousel() {
  const grp = new THREE.Group();
  const stripe = canvasTex(256, 64, (g, w, h) => { for (let x = 0; x < w; x += 32) { g.fillStyle = (x / 32) % 2 ? '#f4efe2' : '#c62828'; g.fillRect(x, 0, 32, h); } g.fillStyle = '#f2c14e'; g.fillRect(0, h - 10, w, 10); }, { repeat: true }); stripe.repeat.set(3, 1);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(10, 5, 16, 1), toon({ map: stripe })); roof.position.y = 9.5; grp.add(roof);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 1.4, 16, 1, true), toon({ color: 0xf2c14e, side: THREE.DoubleSide })); band.position.y = 6.8; grp.add(band);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 1, 16), toon({ color: 0x8a2a3a })); base.position.y = 0.5; grp.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 7, 12), toon({ color: 0xf4efe2 })); pole.position.y = 4; grp.add(pole);
  const horse = merge([col(T(new THREE.SphereGeometry(0.6, 10, 8).scale(1, 0.8, 1.6), 0, 0, 0), 0xf4f4f4), col(strut(new THREE.Vector3(0, 0.2, 0.7), new THREE.Vector3(0, 1.0, 1.1), 0.22, 0.16, 8), 0xf4f4f4), col(box(0.3, 0.35, 0.6, 0, 1.1, 1.35), 0xf4f4f4), ...[[-0.3, 0.5], [0.3, 0.5], [-0.3, -0.5], [0.3, -0.5]].map(([x, z]) => col(cyl(0.08, 0.06, 0.9, 6, x, -0.6, z), 0xf4f4f4)), col(box(0.5, 0.15, 0.6, 0, 0.5, 0), 0xc62828), col(cyl(0.05, 0.05, 6, 6, 0, 1.5, 0), 0xf2c14e)]);
  const hm = toon({ vertexColors: true });
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, h = new THREE.Mesh(horse, hm); h.position.set(Math.cos(a) * 7, 2.5 + (k % 2) * 0.6, Math.sin(a) * 7); h.rotation.y = -a; grp.add(h); }
  grp.userData.spin = true;
  outlineAll(grp, 0.06);
  return grp;
}
// NY: アールデコの摩天楼（尖塔つき）
export function decoTower(night) {
  const grp = new THREE.Group();
  const win = canvasTex(128, 256, (g, w, h) => { g.fillStyle = night ? '#0a0a12' : '#d8ccb0'; g.fillRect(0, 0, w, h); for (let y = 6; y < h; y += 16) for (let x = 8; x < w; x += 20) { g.fillStyle = night ? (Math.random() < 0.7 ? '#ffe2a0' : '#1a1a24') : '#3a4656'; g.fillRect(x, y, 10, 10); } }, { repeat: true });
  const steps = [[34, 60], [26, 40], [20, 30], [14, 22], [9, 14]];
  let y = 0;
  for (const [s, h] of steps) { const t = win.clone(); t.needsUpdate = true; t.repeat.set(s / 6, h / 12); const m = new THREE.Mesh(new THREE.BoxGeometry(s, h, s), toon({ map: t, emissiveMap: night ? t : null, emissive: night ? 0xffffff : 0x000000, emissiveIntensity: night ? 0.6 : 0 })); m.position.y = y + h / 2; grp.add(m); y += h; }
  const spire = new THREE.Mesh(merge([col(cyl(3, 4.5, 10, 8, 0, y + 5, 0), 0xc8c8d0), col(cyl(0.6, 2.5, 14, 8, 0, y + 17, 0), 0xd8d8e0), col(cyl(0.15, 0.4, 12, 6, 0, y + 30, 0), 0xe8e8f0)]), toon({ vertexColors: true, emissive: night ? 0x4a4a6a : 0 }));
  grp.add(spire);
  if (night) { const tip = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3a3a })); tip.position.y = y + 36; grp.add(tip); }
  outlineAll(grp, 0.15);
  return grp;
}
// NY: 光る赤い大階段（広場の名物）
export function redSteps() {
  const grp = new THREE.Group();
  const red = toon({ color: 0xd8202a, emissive: 0xa0101a, emissiveIntensity: 0.8 }), glass = toon({ color: 0xffe8e8, emissive: 0xff4050, emissiveIntensity: 0.5 });
  for (let k = 0; k < 12; k++) { const st = new THREE.Mesh(new THREE.BoxGeometry(18, 0.12, 1.3), glass); st.position.set(0, 0.45 * k + 0.4, -k * 1.3); grp.add(st); const rs = new THREE.Mesh(new THREE.BoxGeometry(18, 0.45, 0.1), red); rs.position.set(0, 0.45 * k + 0.2, -k * 1.3 + 0.65); grp.add(rs); }
  const back = new THREE.Mesh(new THREE.BoxGeometry(18.4, 5.6, 16), toon({ color: 0x8a1a20 })); back.position.set(0, 2.6, -7.8); back.scale.y = 0.98; grp.add(back);
  outlineAll(grp, 0.06);
  return grp;
}
// NY: 自由の女神のような像（台座つき）
export function libertyStatue(night) {
  const grp = new THREE.Group();
  const cu = toon({ color: 0x6ab89a, emissive: night ? 0x2f6a58 : 0x000000 }), ped = stoneMat('#c8bca0', '#a89c80');
  const base = new THREE.Mesh(new THREE.CylinderGeometry(14, 16, 6, 8), ped); base.position.y = 3; grp.add(base);
  const p2 = new THREE.Mesh(new THREE.BoxGeometry(12, 22, 12), ped); p2.position.y = 17; grp.add(p2);
  const p3 = new THREE.Mesh(new THREE.BoxGeometry(14, 2, 14), ped); p3.position.y = 29; grp.add(p3);
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 5, 22, 12), cu); robe.position.y = 41; grp.add(robe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(2.4, 14, 10), cu); head.position.y = 54.5; grp.add(head);
  const crown = new THREE.Mesh(merge([...Array.from({ length: 7 }, (_, k) => { const a = (k - 3) * 0.32; return col(T(new THREE.ConeGeometry(0.35, 3, 5).rotateX(-Math.PI / 2 + 0.35).rotateY(a), Math.sin(a) * 2.3, 56, Math.cos(a) * 2.3 * 0 + 1.2), 0x6ab89a); })]), toon({ vertexColors: true })); grp.add(crown);
  const arm = new THREE.Mesh(strut(new THREE.Vector3(2.2, 48, 0), new THREE.Vector3(3.6, 62, 0), 1.0, 0.8, 8), cu); grp.add(arm);
  const torch = new THREE.Mesh(merge([col(cyl(1.0, 0.5, 2.4, 10, 3.7, 63.5, 0), 0x6ab89a), col(T(new THREE.ConeGeometry(1.0, 2.4, 10), 3.7, 66, 0), 0xffc21a)]), toon({ vertexColors: true, emissive: 0x8a5a00 })); grp.add(torch);
  const tab = new THREE.Mesh(new THREE.BoxGeometry(1, 5, 3.2), cu); tab.position.set(-3.6, 44, 0.8); tab.rotation.z = 0.3; grp.add(tab);
  outlineAll(grp, 0.12);
  grp.traverse(o => { if (o.material) for (const m of [].concat(o.material)) m.fog = false; });   // 霧の向こうでも見える
  return grp;
}
// NY: 遠くの摩天楼の並び（山の代わり）
export function skyline(cx, cz, rIn, rOut, n, night, avoid = null) {
  const tex = canvasTex(64, 256, (g, w, h) => { g.fillStyle = night ? '#0a0a14' : '#7a8696'; g.fillRect(0, 0, w, h); for (let y = 4; y < h; y += 8) for (let x = 4; x < w; x += 8) if (Math.random() < (night ? 0.45 : 1)) { g.fillStyle = night ? pick(['#ffe2a0', '#cfe6ff', '#fff6d8']) : '#5a6676'; g.fillRect(x, y, 4, 4); } }, { repeat: true });
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), toon({ map: tex, emissiveMap: night ? tex : null, emissive: night ? 0xffffff : 0, emissiveIntensity: night ? 0.8 : 0, fog: true }), n);
  const d = new THREE.Object3D();
  for (let i = 0; i < n; i++) { let a = Math.random() * Math.PI * 2; if (avoid !== null && Math.abs(Math.atan2(Math.sin(a - avoid), Math.cos(a - avoid))) < 0.22) a += 0.5; const r = rIn + Math.random() * (rOut - rIn), h = 40 + Math.random() * 160, w = 20 + Math.random() * 30; d.position.set(cx + Math.cos(a) * r, -1, cz + Math.sin(a) * r); d.rotation.y = Math.random() * 3; d.scale.set(w, h, w); d.updateMatrix(); m.setMatrixAt(i, d.matrix); }
  return m;
}
// NY: 大きな広告で覆われた細いビル（ワン・タイムズスクエアのような）
export function billboardTower(adMat) {
  const grp = new THREE.Group();
  const core = new THREE.Mesh(new THREE.BoxGeometry(18, 70, 14), toon({ color: 0x2a2a34 })); core.position.y = 35; grp.add(core);
  const d = new THREE.Object3D();
  const geo = new THREE.PlaneGeometry(1, 1);
  const n = 10, m = new THREE.InstancedMesh(geo, adMat.mat, n), at = adMat.attr(m, n);
  for (let i = 0; i < n; i++) { const face = i % 2, y = 14 + Math.floor(i / 2) * 11; d.position.set(0, y, face ? 7.1 : -7.1); d.rotation.set(0, face ? 0 : Math.PI, 0); d.scale.set(17, 10, 1); d.updateMatrix(); m.setMatrixAt(i, d.matrix); at.setXYZW(i, i % 4, Math.floor(i / 4) % 2, 1, 1); }
  grp.add(m);
  return grp;
}
// ギザ: ピラミッド（石積みの段）
export function pyramid(base, h) {
  const tex = canvasTex(256, 256, (g, w, hh) => { g.fillStyle = '#d8b884'; g.fillRect(0, 0, w, hh); noise(g, w, hh, 6000, 0.25, ['#a8844e', '#f2dcae']); g.fillStyle = 'rgba(120,85,40,0.45)'; for (let y = 0; y < hh; y += 16) { g.fillRect(0, y, w, 3); for (let x = (y / 16) % 2 * 20; x < w; x += 40) g.fillRect(x, y, 2, 16); } }, { repeat: true });
  tex.repeat.set(base / 10, h / 6);
  const g = new THREE.ConeGeometry(base / Math.SQRT2, h, 4, 1); g.rotateY(Math.PI / 4); g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, toon({ map: tex })); m.castShadow = true; m.receiveShadow = true;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(base / Math.SQRT2 * 0.06, h * 0.06, 4, 1).rotateY(Math.PI / 4), toon({ color: 0xf2e2b8 })); cap.position.y = h * 0.97; m.add(cap);
  withOutline(m, 0.2);
  return m;
}
export function bigSphinx() {
  const grp = new THREE.Group();
  const st = stoneMat('#d8b884', '#b89460');
  const add = (g, x, y, z, m = st) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); grp.add(o); return o; };
  add(new THREE.BoxGeometry(14, 3, 34), 0, 1.5, 0);
  add(new THREE.BoxGeometry(11, 8, 24), 0, 7, -3);
  add(new THREE.BoxGeometry(10, 12, 9), 0, 9, 10);
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(3, 2.6, 14), sx * 3.6, 4.3, 17);
  const nemes = toon({ map: canvasTex(64, 64, (g, w, h) => { for (let y = 0; y < h; y += 8) { g.fillStyle = (y / 8) % 2 ? '#2a5ab0' : '#e8c86a'; g.fillRect(0, y, w, 8); } }, { repeat: true }) });
  add(new THREE.BoxGeometry(9, 9, 7), 0, 18, 11, nemes);
  add(new THREE.BoxGeometry(6, 7, 5), 0, 17.5, 13.5);
  add(new THREE.BoxGeometry(1.4, 2.4, 1.4), 0, 14, 16.2);
  outlineAll(grp, 0.15);
  return grp;
}
export function obelisk(h = 22) {
  const m = new THREE.Mesh(merge([col(cyl(1.0, 1.6, h, 4, 0, h / 2, 0).rotateY(Math.PI / 4), 0xc9a46a), col(T(new THREE.ConeGeometry(1.4, 2.4, 4).rotateY(Math.PI / 4), 0, h + 1.2, 0), 0xf2c14e), col(box(4, 1.2, 4, 0, 0.6, 0), 0xb8945a)]), toon({ vertexColors: true }));
  m.castShadow = true; withOutline(m, 0.08);
  return m;
}

// ================= 日本の名所 =================
// 富士山（遠景。雪をかぶった山頂）
export function fuji() {
  const g = new THREE.ConeGeometry(420, 260, 48, 6, true), p = g.attributes.position, cols = [];
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = 1 + Math.sin(Math.atan2(p.getZ(i), p.getX(i)) * 7) * 0.03; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); const snow = y > 30 + Math.sin(Math.atan2(p.getZ(i), p.getX(i)) * 9) * 18; const c = new THREE.Color(snow ? 0xf4f8ff : 0x5a7aa0); cols.push(c.r, c.g, c.b); }
  // 山頂を平らに切る
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 115) { const f = 30 / Math.max(1, Math.hypot(p.getX(i), p.getZ(i))); p.setY(i, 115); p.setX(i, p.getX(i) * Math.min(1, f * 6)); p.setZ(i, p.getZ(i) * Math.min(1, f * 6)); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals(); g.translate(0, 130, 0);
  const m = new THREE.Mesh(g, toon({ vertexColors: true, fog: false })); return m;
}
// 通天閣のようなタワー（鉄骨・八角の展望台・ネオン）
export function tower(night) {
  const grp = new THREE.Group();
  const lat = latticeTex(); lat.repeat.set(2, 5);
  const steel = toon({ color: 0xc8c8cc, map: lat, alphaTest: 0.5, side: THREE.DoubleSide });
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const legs = []; for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) legs.push(strut(V(sx * 9, 0, sz * 9), V(sx * 4, 30, sz * 4), 1.6, 1.2));
  const lm = new THREE.Mesh(merge(legs), steel); lm.userData.noOutline = true; grp.add(lm);
  const shaft = new THREE.Mesh(strut(V(0, 30, 0), V(0, 62, 0), 5.0, 3.5), steel); shaft.userData.noOutline = true; grp.add(shaft);
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(8, 7, 8, 8), toon({ color: 0xe8e8e8, emissive: night ? 0x3a3a50 : 0 })); deck.position.y = 66; grp.add(deck);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(8.1, 8.1, 2, 8, 1, true), new THREE.MeshBasicMaterial({ color: night ? 0x40ffb0 : 0x2a8a6a })); band.position.y = 63; grp.add(band);
  const top = new THREE.Mesh(merge([col(cyl(3, 5, 6, 8, 0, 73, 0), 0xd8d8dc), col(cyl(0.3, 0.6, 12, 6, 0, 82, 0), 0xc8c8cc)]), toon({ vertexColors: true })); grp.add(top);
  const arch = new THREE.Mesh(merge([0, 1, 2, 3].map(k => { const a = new THREE.TorusGeometry(7, 0.9, 6, 16, Math.PI); a.rotateY(k * Math.PI / 2); a.translate(Math.sin(k * Math.PI / 2) * 9, 0, Math.cos(k * Math.PI / 2) * 9); return col(a, 0xb8b8bc); })), toon({ vertexColors: true })); grp.add(arch);
  outlineAll(grp, 0.12);
  return grp;
}
// 大仏（お堂の前に座る）
export function daibutsu() {
  const grp = new THREE.Group();
  const bronze = toon({ color: 0x5a6a5a }), stone = stoneMat('#b8b0a0', '#988e7e');
  const base = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 2.4, 8), stone); base.position.y = 1.2; grp.add(base);
  const lotus = new THREE.Mesh(new THREE.CylinderGeometry(8, 6, 2.2, 16), toon({ color: 0x6a7a5a })); lotus.position.y = 3.5; grp.add(lotus);
  const legs = new THREE.Mesh(new THREE.SphereGeometry(6.5, 16, 10).scale(1.2, 0.45, 0.9), bronze); legs.position.y = 5.8; grp.add(legs);
  const body = new THREE.Mesh(new THREE.SphereGeometry(4.6, 16, 12).scale(1, 1.45, 0.85), bronze); body.position.y = 10.5; grp.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 12).scale(1, 1.15, 1), bronze); head.position.y = 17.6; grp.add(head);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 8), bronze); bun.position.y = 20.1; grp.add(bun);
  for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.6, 0.8), bronze); ear.position.set(sx * 2.6, 16.8, 0); grp.add(ear); }
  const hands = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8).scale(1.4, 0.6, 1), bronze); hands.position.set(0, 7.6, 3.2); grp.add(hands);
  const hall = new THREE.Mesh(new THREE.BoxGeometry(34, 14, 18), toon({ color: 0x6a4a2e })); hall.position.set(0, 7, -20); grp.add(hall);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(10, 24, 7, 4, 1).rotateY(Math.PI / 4), toon({ color: 0x3a3e46, side: THREE.DoubleSide })); roof.scale.set(1.35, 1, 0.75); roof.position.set(0, 17.5, -20); grp.add(roof);
  outlineAll(grp, 0.1);
  return grp;
}
// 金閣のような金色の楼閣と池
export function kinkaku() {
  const grp = new THREE.Group();
  const gold = toon({ color: 0xe8b830, emissive: 0x4a3000 }), roofM = toon({ color: 0x3a2a1e, side: THREE.DoubleSide });
  const pond = new THREE.Mesh(new THREE.CircleGeometry(30, 32).rotateX(-Math.PI / 2), toon({ color: 0x4a8aa0 })); pond.position.y = 0.05; grp.add(pond);
  const isle = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 1, 16), toon({ color: 0x6a8a4a })); isle.position.y = 0.5; grp.add(isle);
  let y = 1;
  for (const [w, h, m] of [[12, 4, toon({ color: 0xf0e8d8 })], [11, 3.6, gold], [8, 3.2, gold]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.75), m); b.position.y = y + h / 2; grp.add(b);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.45, w * 0.82, 1.4, 4, 1).rotateY(Math.PI / 4), roofM); r.scale.set(1, 1, 0.8); r.position.y = y + h + 0.7; grp.add(r);
    y += h + 1.4;
  }
  const phoenix = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 6), gold); phoenix.position.y = y + 0.8; grp.add(phoenix);
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; const pine = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 6).scale(1, 0.6, 1), toon({ color: 0x2f6a3a })); pine.position.set(Math.cos(a) * 34, 4, Math.sin(a) * 34); grp.add(pine); }
  outlineAll(grp, 0.08);
  return grp;
}
// 雷門のような大提灯の門（道をまたぐ）
export function kaminarimon(TP, lanTex) {
  const grp = new THREE.Group();
  const red = toon({ color: 0xc8281e }), blk = toon({ color: 0x2a2a2e }), wood = toon({ color: 0x8a2a1e });
  for (const sx of [-1, 1]) for (const sz of [-1.4, 1.4]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 12, 12), red); p.position.set(sx * (TP + 1), 6, sz); grp.add(p); }
  for (const sx of [-1, 1]) { const wall = new THREE.Mesh(new THREE.BoxGeometry(5, 11, 3.4), wood); wall.position.set(sx * (TP + 3.6), 5.5, 0); grp.add(wall); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(TP * 2 + 9, 1.4, 4), red); beam.position.y = 12.4; grp.add(beam);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(4, 9, 4, 4, 1).rotateY(Math.PI / 4), blk); roof.scale.set((TP * 2 + 12) / 12.7, 1, 0.75); roof.position.y = 15; grp.add(roof);
  const lg = new THREE.CylinderGeometry(2.6, 2.6, 4.6, 20, 6), pp = lg.attributes.position;
  for (let i = 0; i < pp.count; i++) { const yy = pp.getY(i) / 2.3, k = 1 + 0.18 * (1 - yy * yy); pp.setX(i, pp.getX(i) * k); pp.setZ(i, pp.getZ(i) * k); }
  lg.computeVertexNormals();
  const lan = new THREE.Mesh(lg, toon({ map: lanTex, emissiveMap: lanTex, emissive: 0xffffff, emissiveIntensity: 0.15 })); lan.position.y = 9.1; grp.add(lan);
  for (const yy of [6.75, 11.45]) { const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.4, 20), blk); ring.position.y = yy; grp.add(ring); }
  grp.userData.lantern = lan;
  outlineAll(grp, 0.08);
  return grp;
}
// 桜の木
export function sakuraGeo(k) {
  const parts = [col(cyl(0.2, 0.32, 3.6, 8, 0, 1.8, 0), 0x5a3a2a), col(T(new THREE.CylinderGeometry(0.1, 0.15, 2.4, 6).rotateZ(0.8), -0.8, 3.8, 0), 0x5a3a2a), col(T(new THREE.CylinderGeometry(0.1, 0.15, 2.4, 6).rotateZ(-0.7), 0.8, 4.0, 0.2), 0x5a3a2a)];
  const pinks = [0xf6c6d6, 0xf2b0c8, 0xfadce6, 0xeea0bc];
  for (let i = 0; i < 8 + k; i++) { const a = i / (8 + k) * Math.PI * 2; parts.push(col(blob(1.6, Math.cos(a) * 1.7, 5.0 + (i % 3) * 0.5, Math.sin(a) * 1.5), pinks[i % 4])); }
  parts.push(col(blob(2.1, 0, 6.2, 0), pinks[k % 4]));
  return merge(parts);
}

