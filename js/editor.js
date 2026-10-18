// だんじりエディター（テスト版）: 部品を組み合わせてオリジナルのだんじりを作る
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { makeDanjiri, DJ_TYPES, DJ_PARTS, TYPE_PARTS, normParts, FINISHES, setFinish, CUSTOM_SHAPES, CUSTOM_MATS, CUSTOM_MAX, customMesh, normCustom, PIC_MAX } from './models.js?v=126';

const $ = id => document.getElementById(id);
const TEAMS = [
  { name: '東町', kanji: '東', color: 0x2a4fb0, css: '#2f53c4', happi: '#1d2f6b' },
  { name: '西町', kanji: '西', color: 0xb3221a, css: '#d2382c', happi: '#8a1a14' },
  { name: '浜町', kanji: '浜', color: 0x0e7a6c, css: '#139a88', happi: '#0d5a50' },
  { name: '本町', kanji: '本', color: 0x6a2aa6, css: '#8a45cc', happi: '#4a1f78' },
  { name: '北町', kanji: '北', color: 0xd9741a, css: '#ee8a2a', happi: '#9a4f10' },
  { name: '南町', kanji: '南', color: 0xc9a01a, css: '#e0b52a', happi: '#8a6c0e' },
  { name: '中町', kanji: '中', color: 0xc23a7a, css: '#e0559a', happi: '#7a1f4c' },
  { name: '新町', kanji: '新', color: 0x3a3f48, css: '#6b7280', happi: '#22252b' },
];
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { } } };

// ---------------- 設計図（部品 + 仕上げ + 町） ----------------
const clampI = (v, n, d) => (Number.isInteger(+v) && +v >= 0 && +v < n ? +v : d);
function normDesign(d) {
  return { ...normParts(d), finish: clampI(d?.finish, FINISHES.length, 0), team: clampI(d?.team, TEAMS.length, clampI(store.get('danjiri-team', 0), TEAMS.length, 0)) };
}
const enc = d => btoa(unescape(encodeURIComponent(JSON.stringify(d)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const dec = s => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))));
function loadDesign() {
  const q = new URLSearchParams(location.search).get('d');
  if (q) { try { return normDesign(dec(q)); } catch { } }
  for (const k of ['danjiri-design-draft', 'danjiri-design']) { try { const s = store.get(k, ''); if (s) return normDesign(JSON.parse(s)); } catch { } }
  return normDesign(TYPE_PARTS[0]);
}
let design = loadDesign();

// ---------------- 3D ----------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.domElement.className = 'gl';
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfe6f5);
scene.fog = new THREE.Fog(0xcfe6f5, 40, 90);
scene.add(new THREE.HemisphereLight(0xdcefff, 0x8a7a60, 1.4));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.position.set(-8, 14, 9); sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 10, bottom: -6, near: 1, far: 40 });
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
scene.add(sun);
const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshLambertMaterial({ color: 0xb9ad98 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const ring = new THREE.Mesh(new THREE.RingGeometry(5.4, 5.7, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; scene.add(ring);
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 200);

let D = null;
function rebuild() {
  if (D) {
    scene.remove(D.group);
    D.group.traverse(o => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
  }
  D = makeDanjiri(TEAMS[design.team], 0, { ...design, custom: [] });   // 自作パーツは別に置いて、選んで動かせるようにする
  if (design.finish) setFinish(D, design.finish);
  scene.add(D.group);
  saveURL();
}
let urlT = 0;
// 作りかけはいつもこのブラウザに残す。URL にも載せるが、絵が入ると長すぎるので URL には載せない
const hasPic = () => design.custom.some(q => q.s === 'pic');
const saveURL = () => { clearTimeout(urlT); urlT = setTimeout(() => { try { localStorage.setItem('danjiri-design-draft', JSON.stringify(design)); } catch { } history.replaceState(null, '', hasPic() ? location.pathname : '?d=' + enc(design)); }, 150); };

// ---------------- 自作パーツ: 形を作ってハメる・矢印で動かす ----------------
const partsG = new THREE.Group(); scene.add(partsG);
let sel = -1, placing = null;
const tc = new TransformControls(camera, renderer.domElement);
tc.setSize(innerWidth <= 700 ? 1.15 : 0.9); tc.setSpace('local');
scene.add(tc);
const r2 = v => Math.round(v * 100) / 100;
function buildParts() {
  tc.detach();
  for (const m of [...partsG.children]) partsG.remove(m);
  design.custom.forEach((q, i) => {
    const m = customMesh(q); m.userData.idx = i; partsG.add(m);
    if (q.mx) { const w = customMesh(q, true); w.userData.mirrorOf = i; partsG.add(w); m.userData.twin = w; }
  });
  const m = partMesh(sel); if (m) tc.attach(m); else sel = -1;
  renderParts(); saveURL();
}
const partMesh = i => partsG.children.find(o => o.userData.idx === i && i >= 0);
// 矢印で動かした結果を設計図へ（左右対称の片割れも追従）
tc.addEventListener('objectChange', () => {
  const m = tc.object; if (!m) return; const q = design.custom[m.userData.idx]; if (!q) return;
  q.p = [r2(m.position.x), r2(m.position.y), r2(m.position.z)]; q.r = [r2(m.rotation.x), r2(m.rotation.y), r2(m.rotation.z)];
  q.k = [m.scale.x, m.scale.y, m.scale.z].map(v => r2(Math.min(6, Math.max(0.05, v))));
  const w = m.userData.twin; if (w) { w.position.set(-m.position.x, m.position.y, m.position.z); w.rotation.set(m.rotation.x, -m.rotation.y, -m.rotation.z); w.scale.copy(m.scale); }
  saveURL();
});
function select(i) { sel = i; const m = partMesh(i); if (m) tc.attach(m); else { tc.detach(); sel = -1; } renderParts(); }
function addPart(s, at, normal) {
  if (design.custom.length >= CUSTOM_MAX) { note(`パーツは ${CUSTOM_MAX} 個までです`); return; }
  const base = { box: [0.6, 0.6, 0.6], cyl: [0.4, 0.8, 0.4], sph: [0.6, 0.6, 0.6], cone: [0.5, 0.8, 0.5], pyr: [0.8, 0.6, 0.8], torus: [0.8, 0.8, 0.8], lan: [0.4, 0.5, 0.4], flame: [0.4, 0.7, 0.4], star: [0.7, 0.7, 0.7] }[s] || [0.6, 0.6, 0.6];
  const p = at ? at.clone().addScaledVector(normal, base[1] * 0.45) : new THREE.Vector3(0, 5.6, 0);
  const q = { s, p: [p.x, p.y, p.z], r: [0, 0, 0], k: base, c: s === 'lan' ? '#ffffff' : '#d42a1e', m: s === 'lan' ? 'paint' : s === 'flame' ? 'glow' : s === 'star' ? 'gold' : 'paint', mx: 0 };
  if (s === 'flame') q.c = '#ff8a1e';
  if (s === 'pic') {   // 絵は当たった面に貼る（面の向きにそろえる）
    q.img = pendingImg; q.k = [1.2, 1.2, 1];
    const n = normal || new THREE.Vector3(0, 0, 1), e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n));
    q.r = [e.x, e.y, e.z]; const pp = at ? at.clone().addScaledVector(n, 0.03) : new THREE.Vector3(0, 4.6, 2.4); q.p = [pp.x, pp.y, pp.z];
  }
  design.custom = normCustom([...design.custom, q]); sel = design.custom.length - 1; buildParts();
}
function renderParts() {
  $('pedit').classList.toggle('hidden', !design.custom.length);
  const pl = $('plist'); pl.innerHTML = '';
  design.custom.forEach((q, i) => { const b = document.createElement('button'); b.innerHTML = `${q.s === 'pic' ? '🖼 ' : `<span class="sw" style="background:${q.c}"></span>`}${i + 1}. ${(CUSTOM_SHAPES.find(x => x[0] === q.s) || [])[1]}`; b.classList.toggle('sel', i === sel); b.onclick = () => select(i === sel ? -1 : i); pl.appendChild(b); });
  const q = design.custom[sel];
  for (const id of ['tmode', 'pmat']) $(id).style.display = q ? '' : 'none';
  $('pcol').parentElement.style.display = q ? '' : 'none';
  if (!q) return;
  $('tmode').querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.m === tc.mode));
  $('pmat').querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.m === q.m));
  $('pcol').value = q.c; $('pmx').classList.toggle('sel', !!q.mx);
  $('pdraw').classList.toggle('hidden', q.s !== 'pic'); $('pcol').style.display = $('pmat').style.display = q.s === 'pic' ? 'none' : '';
}
CUSTOM_SHAPES.forEach(([k, ja]) => { const b = document.createElement('button'); b.textContent = '＋' + ja; b.onclick = () => { if (k === 'pic') { paintOpen(null, img => { pendingImg = img; placing = 'pic'; hint('だんじりをタップすると絵を貼ります（空をタップで前に）'); }); return; } placing = placing === k ? null : k; hint(placing ? `だんじりをタップすると「${ja}」をハメます（空をタップで屋根の上）` : ''); $('shapes').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b && !!placing)); }; $('shapes').appendChild(b); });
[['translate', '移動'], ['rotate', '回転'], ['scale', '大きさ']].forEach(([m, ja]) => { const b = document.createElement('button'); b.textContent = ja; b.dataset.m = m; b.onclick = () => { tc.setMode(m); renderParts(); }; $('tmode').appendChild(b); });
CUSTOM_MATS.forEach(([m, ja]) => { const b = document.createElement('button'); b.textContent = ja; b.dataset.m = m; b.onclick = () => { const q = design.custom[sel]; if (q) { q.m = m; buildParts(); } }; $('pmat').appendChild(b); });
$('pcol').oninput = e => { const q = design.custom[sel]; if (q) { q.c = e.target.value; if (q.m !== 'paint' && q.m !== 'glow') q.m = 'paint'; buildParts(); } };
$('pmx').onclick = () => { const q = design.custom[sel]; if (q) { q.mx = q.mx ? 0 : 1; if (q.mx && Math.abs(q.p[0]) < 0.3) q.p[0] = 1; buildParts(); } };
$('pdup').onclick = () => { const q = design.custom[sel]; if (!q || design.custom.length >= CUSTOM_MAX) return; const c = JSON.parse(JSON.stringify(q)); c.p[0] = r2(c.p[0] + 0.5); design.custom.push(c); sel = design.custom.length - 1; buildParts(); };
const delPart = () => { if (sel < 0) return; design.custom.splice(sel, 1); sel = -1; buildParts(); };
$('pdel').onclick = delPart;
$('pdraw').onclick = () => { const q = design.custom[sel]; if (q?.s === 'pic') paintOpen(q.img, img => { q.img = img; buildParts(); }); };

// ---------------- お絵かき（256 マス・透明つき） ----------------
let pendingImg = '', paintDone = null;
const pc = $('pc'), pg = pc.getContext('2d', { willReadFrequently: true });
const P = { tool: 'pen', color: '#d42a1e', size: 8, undo: [], last: null };
const PAL = ['#1b1020', '#ffffff', '#d42a1e', '#f08a1e', '#f2c14e', '#1f8a4c', '#2456b8', '#8a45cc', '#e0559a', '#8a5a30'];
PAL.forEach(c => { const b = document.createElement('button'); b.style.background = c; b.onclick = () => { P.color = c; $('pColor').value = c; if (P.tool === 'eraser') setTool('pen'); }; $('ppal').appendChild(b); });
const setTool = t => { P.tool = t; $('ptool').querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.t === t)); };
$('ptool').querySelectorAll('button').forEach(b => { b.onclick = () => setTool(b.dataset.t); });
$('pColor').oninput = e => { P.color = e.target.value; if (P.tool === 'eraser') setTool('pen'); };
$('pSize').oninput = e => { P.size = +e.target.value; $('pSizeV').textContent = P.size; };
const snap = () => { P.undo.push(pg.getImageData(0, 0, 256, 256)); if (P.undo.length > 25) P.undo.shift(); };
$('pUndo').onclick = () => { const d = P.undo.pop(); if (d) pg.putImageData(d, 0, 0); };
$('pClear').onclick = () => { snap(); pg.clearRect(0, 0, 256, 256); };
$('pWhite').onclick = () => { snap(); pg.globalCompositeOperation = 'destination-over'; pg.fillStyle = '#fff'; pg.fillRect(0, 0, 256, 256); pg.globalCompositeOperation = 'source-over'; };
$('pLoad').onclick = () => $('pFile').click();
$('pFile').onchange = e => {
  const f = e.target.files[0]; if (!f) return; const url = URL.createObjectURL(f), im = new Image();
  im.onload = () => { snap(); const k = Math.min(256 / im.width, 256 / im.height), w = im.width * k, h = im.height * k; pg.drawImage(im, (256 - w) / 2, (256 - h) / 2, w, h); URL.revokeObjectURL(url); };
  im.src = url; e.target.value = '';
};
const cpos = e => { const r = pc.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 256, (e.clientY - r.top) / r.height * 256]; };
function stroke(a, b) {
  pg.globalCompositeOperation = P.tool === 'eraser' ? 'destination-out' : 'source-over';
  pg.strokeStyle = pg.fillStyle = P.color; pg.lineWidth = P.size; pg.lineCap = pg.lineJoin = 'round';
  pg.beginPath(); pg.moveTo(a[0], a[1]); pg.lineTo(b[0], b[1]); pg.stroke();
  pg.globalCompositeOperation = 'source-over';
}
// 塗りつぶし: 押した所と同じ色（透明も含む）の続きの範囲を塗る
function fill(x, y) {
  x |= 0; y |= 0; if (x < 0 || y < 0 || x > 255 || y > 255) return;
  const im = pg.getImageData(0, 0, 256, 256), d = im.data, i0 = (y * 256 + x) * 4, t = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
  const c = new THREE.Color(P.color), f = [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), 255];
  if (t.every((v, k) => Math.abs(v - f[k]) < 4)) return;
  const near = i => (t[3] < 20 && d[i + 3] < 20) || (Math.abs(d[i] - t[0]) + Math.abs(d[i + 1] - t[1]) + Math.abs(d[i + 2] - t[2]) + Math.abs(d[i + 3] - t[3]) < 60);
  const st = [x + y * 256], seen = new Uint8Array(256 * 256);
  while (st.length) {
    const q = st.pop(); if (seen[q]) continue; seen[q] = 1; const i = q * 4; if (!near(i)) continue;
    d[i] = f[0]; d[i + 1] = f[1]; d[i + 2] = f[2]; d[i + 3] = 255;
    const qx = q & 255, qy = q >> 8;
    if (qx > 0) st.push(q - 1); if (qx < 255) st.push(q + 1); if (qy > 0) st.push(q - 256); if (qy < 255) st.push(q + 256);
  }
  pg.putImageData(im, 0, 0);
}
pc.addEventListener('pointerdown', e => {
  e.preventDefault(); pc.setPointerCapture(e.pointerId); snap(); const p = cpos(e);
  if (P.tool === 'fill') { fill(p[0], p[1]); return; }
  P.last = p; stroke(p, [p[0] + 0.01, p[1]]);
});
pc.addEventListener('pointermove', e => { if (!P.last) return; const p = cpos(e); stroke(P.last, p); P.last = p; });
const pEnd = () => { P.last = null; };
pc.addEventListener('pointerup', pEnd); pc.addEventListener('pointercancel', pEnd);
function paintOpen(img, done) {
  paintDone = done; P.undo = []; pg.clearRect(0, 0, 256, 256);
  if (img) { const im = new Image(); im.onload = () => pg.drawImage(im, 0, 0, 256, 256); im.src = img; }
  $('paint').classList.remove('hidden');
}
// 何も描いていなければ null。大きすぎる時は小さくして入れる
function paintExport() {
  const d = pg.getImageData(0, 0, 256, 256).data; let any = false; for (let i = 3; i < d.length; i += 4) if (d[i] > 20) { any = true; break; }
  if (!any) return null;
  let url = pc.toDataURL('image/png');
  for (const n of [192, 128, 96]) {
    if (url.length < PIC_MAX) break;
    const c = document.createElement('canvas'); c.width = c.height = n; c.getContext('2d').drawImage(pc, 0, 0, n, n); url = c.toDataURL('image/png');
  }
  return url.length < PIC_MAX ? url : null;
}
$('pCancel').onclick = () => { $('paint').classList.add('hidden'); paintDone = null; };
$('pOk').onclick = () => { const url = paintExport(); if (!url) { note('何か描いてから「できた」を押してね'); return; } $('paint').classList.add('hidden'); const f = paintDone; paintDone = null; if (f) f(url); };
$('pnone').onclick = () => select(-1);
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'Delete' || e.key === 'Backspace') delPart();
  else if (e.key === 'Escape') { placing = null; hint(''); select(-1); }
  else if (sel >= 0 && ({ w: 'translate', e: 'rotate', r: 'scale' })[e.key]) { tc.setMode(({ w: 'translate', e: 'rotate', r: 'scale' })[e.key]); renderParts(); }
});
const hint = t => { $('hint').textContent = t; $('hint').classList.toggle('hidden', !t); };
// タップ: ハメる / パーツを選ぶ
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function tap(x, y) {
  const r = renderer.domElement.getBoundingClientRect(); ndc.set((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const own = o => { while (o && o.userData.idx === undefined && o.userData.mirrorOf === undefined) o = o.parent; return o; };
  if (placing) {
    const hit = ray.intersectObjects([D.body, partsG], true).find(h => h.face);
    const k = placing; placing = null; hint(''); $('shapes').querySelectorAll('button').forEach(x => x.classList.remove('on'));
    if (hit) { const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld); addPart(k, hit.point, n); } else addPart(k);
    return;
  }
  const hit = ray.intersectObjects(partsG.children, true)[0];
  const o = hit && own(hit.object);
  select(o ? (o.userData.idx ?? o.userData.mirrorOf) : -1);
}

// まわして見る（ドラッグで回す・ピンチ / ホイールで寄る）
const view = { yaw: 2.4, pitch: 0.32, dist: 17, spin: true };
const ptrs = new Map(); let pinch0 = 0, dist0 = 0;
const cv = renderer.domElement;
let down = null;
cv.addEventListener('pointerdown', e => { if (tc.dragging || tc.axis) { down = null; return; } down = { x: e.clientX, y: e.clientY, n: ptrs.size }; cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); view.spin = false; spinBtn(); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = view.dist; } });
cv.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p || tc.dragging) return;
  if (ptrs.size === 1) { view.yaw -= (e.clientX - p.x) * 0.008; view.pitch = Math.min(1.35, Math.max(-0.05, view.pitch + (e.clientY - p.y) * 0.006)); }
  p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0) view.dist = Math.min(40, Math.max(7, dist0 * pinch0 / d)); }
});
const up = e => { if (down && !down.n && ptrs.size === 1 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8) tap(e.clientX, e.clientY); down = null; ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0; };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('wheel', e => { e.preventDefault(); view.dist = Math.min(40, Math.max(7, view.dist * Math.exp(e.deltaY * 0.001))); }, { passive: false });

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (view.spin && sel < 0 && !placing) view.yaw += dt * 0.35;
  // スマホは下にパネルがあるので、だんじりを少し上に見せる
  const mobile = innerWidth <= 700, side = innerWidth > 700 ? 1 : 0;
  const ty = mobile ? 2.2 : 3.4, d = view.dist * (mobile ? 1.25 : 1);
  camera.position.set(Math.sin(view.yaw) * Math.cos(view.pitch) * d, ty + Math.sin(view.pitch) * d, Math.cos(view.yaw) * Math.cos(view.pitch) * d);
  camera.lookAt(0, ty, 0);
  // PC は右にパネルがあるので、だんじりを左寄せに見せる
  if (side) { camera.aspect = (innerWidth + 340) / innerHeight; camera.setViewOffset(innerWidth + 340, innerHeight, 340, 0, innerWidth, innerHeight); } else if (camera.view?.enabled) { camera.clearViewOffset(); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
  if (D) for (const b of D.banners) { const t = now / 1000, pos = b.cloth.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { const y = b.base[i * 3 + 1]; pos.setZ(i, Math.sin(t * 3 + y * 2) * 0.05 * (1.05 - y / 2.1)); } pos.needsUpdate = true; }
  renderer.render(scene, camera);
}

// ---------------- パネル ----------------
function buttons(id, list, isSel, onPick) {
  const el = $(id); el.innerHTML = '';
  list.forEach((it, i) => {
    const b = document.createElement('button'); b.innerHTML = it.html; b.onclick = () => { onPick(it, i); render(); rebuild(); };
    b._sel = () => isSel(it, i); el.appendChild(b);
  });
}
function render() {
  for (const id of ['presets', 'roof', 'deco', 'dragonC', 'flags', 'finish', 'team']) $(id).querySelectorAll('button').forEach(b => b.classList.toggle('sel', !!b._sel()));
  $('decoY').value = design.decoY; $('decoYv').textContent = (design.decoY > 0 ? '+' : '') + design.decoY.toFixed(2);
  $('decoS').value = design.decoS; $('decoSv').textContent = '×' + design.decoS.toFixed(2);
  $('dragonC').parentElement && ($('dragonC').style.opacity = design.deco.includes('dragon') ? 1 : 0.4);
}
const same = (a, b) => JSON.stringify({ ...normParts(a), custom: 0 }) === JSON.stringify({ ...normParts(b), custom: 0 });
buttons('presets', DJ_TYPES.map((t, i) => ({ html: t.ja, p: TYPE_PARTS[i] })), it => same(design, it.p), it => { design = normDesign({ ...normParts(it.p), custom: design.custom, finish: design.finish, team: design.team }); });
buttons('roof', DJ_PARTS.roof.map(r => ({ html: r[1], k: r[0] })), it => design.roof === it.k, it => { design.roof = it.k; });
buttons('deco', DJ_PARTS.deco.map(r => ({ html: r[1], k: r[0] })), it => design.deco.includes(it.k), it => { design.deco = design.deco.includes(it.k) ? design.deco.filter(k => k !== it.k) : [...design.deco, it.k]; });
const DC = { green: '#1f8a4c', gold: '#d8a830', red: '#c0241a', blue: '#2456b8', black: '#2a2a30', white: '#eeeee6' };
buttons('dragonC', DJ_PARTS.dragonC.map(r => ({ html: `<span class="sw" style="background:${DC[r[0]]}"></span>${r[1]}`, k: r[0] })), it => design.dragonC === it.k, it => { design.dragonC = it.k; if (!design.deco.includes('dragon')) design.deco = [...design.deco, 'dragon']; });
buttons('flags', DJ_PARTS.flags.map(r => ({ html: r[1], k: r[0] })), it => !!design[it.k], it => { design[it.k] = design[it.k] ? 0 : 1; });
buttons('finish', FINISHES.map((f, i) => ({ html: f.ja, i })), it => design.finish === it.i, it => { design.finish = it.i; });
buttons('team', TEAMS.map((t, i) => ({ html: `<span class="sw" style="background:${t.css}"></span>${t.name}`, i })), it => design.team === it.i, it => { design.team = it.i; });
let slT = 0;
for (const k of ['decoY', 'decoS']) $(k).oninput = e => { design[k] = +e.target.value; render(); clearTimeout(slT); slT = setTimeout(rebuild, 60); };

const note = t => { $('note').textContent = t; };
$('save').onclick = () => { try { localStorage.setItem('danjiri-design', JSON.stringify(design)); } catch { note('保存できませんでした（容量オーバー）'); return; } note('このブラウザに保存しました（ゲームで使えるようになるのはこれからです）'); };
$('rand').onclick = () => {
  const r = a => a[Math.floor(Math.random() * a.length)];
  const p = { roof: r(DJ_PARTS.roof)[0], deco: DJ_PARTS.deco.map(x => x[0]).filter(() => Math.random() < 0.45), dragonC: r(DJ_PARTS.dragonC)[0], decoY: 0, decoS: +(0.8 + Math.random() * 0.5).toFixed(2) };
  for (const [k] of DJ_PARTS.flags) p[k] = Math.random() < (k === 'poles' || k === 'koyane' ? 0.4 : 0.85) ? 1 : 0;
  design = normDesign({ ...p, custom: design.custom, finish: Math.floor(Math.random() * FINISHES.length), team: Math.floor(Math.random() * TEAMS.length) });
  render(); rebuild();
};
$('share').onclick = async () => {
  if (hasPic()) { note('絵が入っていると URL では共有できません（このブラウザには残っています）'); return; } try { await navigator.clipboard.writeText(location.href); note('URLをコピーしました。開くと同じだんじりが出ます'); } catch { note(location.href); } };
const spinBtn = () => { $('spin').textContent = view.spin ? '回転 OFF' : '回転 ON'; };
$('spin').onclick = () => { view.spin = !view.spin; spinBtn(); };
$('fold').onclick = () => { const m = $('panel').classList.toggle('min'); $('fold').textContent = m ? 'ひらく' : 'たたむ'; };

render(); spinBtn(); resize(); rebuild(); buildParts(); requestAnimationFrame(frame);
window.__ed = { get design() { return design; }, set(d) { design = normDesign(d); render(); rebuild(); buildParts(); }, tap, addPart, select, tc, get D() { return D; } };
