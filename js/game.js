// だんじり疾走 本体: ループ・操作・カメラ・引き手・演出・HUD・オンライン
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as SIM from './sim.js?v=133';
import { GLYPHS, FONT, setOutlines, bannerTex } from './gfx.js?v=133';
import { buildWorld } from './world.js?v=133';
import { PLACES, PLACE_IDS, SKIES, stageName } from './stages.js?v=133';
import { makeDanjiri, animateDanjiri, CrowdRig, crewPose, newPose, HIP_Y, setLanternGlow, FINISHES, setFinish, HAIRS, OUTFITS, DJ_TYPES } from './models.js?v=133';
import { FX, SpeedShader } from './fx.js?v=133';
import * as AU from './audio.js?v=133';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const TEAMS = [
  { name: '東町', en: 'East Town', kanji: '東', color: 0x2a4fb0, css: '#2f53c4', happi: '#1d2f6b' },
  { name: '西町', en: 'West Town', kanji: '西', color: 0xb3221a, css: '#d2382c', happi: '#8a1a14' },
  { name: '浜町', en: 'Beach Town', kanji: '浜', color: 0x0e7a6c, css: '#139a88', happi: '#0d5a50' },
  { name: '本町', en: 'Main Town', kanji: '本', color: 0x6a2aa6, css: '#8a45cc', happi: '#4a1f78' },
  { name: '北町', en: 'North Town', kanji: '北', color: 0xd9741a, css: '#ee8a2a', happi: '#9a4f10' },
  { name: '南町', en: 'South Town', kanji: '南', color: 0xc9a01a, css: '#e0b52a', happi: '#8a6c0e' },
  { name: '中町', en: 'Middle Town', kanji: '中', color: 0xc23a7a, css: '#e0559a', happi: '#7a1f4c' },
  { name: '新町', en: 'New Town', kanji: '新', color: 0x3a3f48, css: '#6b7280', happi: '#22252b' },
];
const DT = 1 / 60;
const teamName = t => (LANG === 'en' ? t.en : t.name);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
const store = { get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { } } };
// オンラインの接続先: ページのある場所の ws（satoru.net/danjiri/ws でも danjiri.satoru.net/ws でも動く）
const BASE = location.pathname.replace(/\/p\/[^/]*$/, '/').replace(/[^/]*$/, '');   // シェアの URL（/p/ID）から開いた時もゲームの置き場所を指す
const wsURL = () => (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + BASE + 'ws';
// ================= 言語（日本語 / 英語）。日本語以外のブラウザは最初から英語 =================
let LANG = store.get('danjiri-lang', /^ja\b/i.test(navigator.language || '') ? 'ja' : 'en');
const L = (ja, en) => (LANG === 'en' ? en : ja);
const NAME_EN = { '提灯': 'Lantern', '電球': 'Light bulb', '信号機': 'Traffic light', 'ランタン': 'Lantern', '洗濯物': 'Laundry', '鳥居': 'Torii gate', '鉄骨の門': 'Steel arch', '神殿の門': 'Temple gate', '石の橋': 'Stone bridge',
  '電柱': 'Utility pole', '街路樹': 'Street tree', '自販機': 'Vending machine', 'のぼり': 'Banner', '石灯籠': 'Stone lantern', '玉垣': 'Stone fence', '竹': 'Bamboo', 'ビル': 'Building', '町家': 'Townhouse',
  '街灯': 'Street lamp', 'プラタナス': 'Plane tree', '広告塔': 'Ad column', '旗': 'Flag', '生け垣': 'Hedge', 'アパルトマン': 'Apartment', '消火栓': 'Fire hydrant', '塀': 'Wall', '摩天楼': 'Skyscraper',
  'ヤシの木': 'Palm tree', 'つぼ': 'Pot', 'スフィンクス像': 'Sphinx statue', '石の塀': 'Stone wall', '日干しれんがの家': 'Mud-brick house', '広場の木': 'Plaza tree', 'ゴンドラの杭': 'Mooring pole', 'パラッツォ': 'Palazzo',
  '植木鉢': 'Flower pot', '観客': 'Spectator', 'ガードレール': 'Guardrail', '欄干': 'Railing', 'コーン': 'Traffic cone', 'バリケード': 'Barricade', '木箱': 'Crate', '俵': 'Rice bale', '立て看板': 'Sign board',
  'ゴミ箱': 'Trash bin', '自転車': 'Bicycle', 'カフェのテーブル': 'Café table', 'ワイン樽': 'Wine barrel', 'イエローキャブ': 'Yellow cab', 'ホットドッグ屋台': 'Hot dog cart', 'らくだ': 'Camel', '屋台': 'Market stall',
  'ゴンドラ': 'Gondola', 'カヌー': 'Canoe', 'パトカー': 'Police car', '蒸気の煙突': 'Steam stack', '自転車のおばちゃん': 'Auntie on a bike', 'パン屋の自転車': "Baker's bike", 'タクシー': 'Taxi', 'らくだの隊列': 'Camel caravan', '神輿': 'Mikoshi shrine', '雷門': 'Kaminarimon Gate', '雷門の大提灯': 'Giant lantern', '登校中の小学生': 'Schoolkids', '犬の散歩': 'Dog walker', '宅配トラック': 'Delivery truck', 'シェア自転車': 'Bike-share riders', '配達のバン': 'Delivery van', '自転車の配達員': 'Bike courier', '乗り合いバス': 'Microbus', '荷物運びの船': 'Cargo boat', '警察の船': 'Police boat', 'お相撲さん': 'Sumo wrestler', '軽トラ': 'Kei truck', '焼き芋屋のリヤカー': 'Sweet potato cart', '鹿': 'Deer', '鹿の群れ': 'Herd of deer', 'パントマイム芸人': 'Mime', 'プードルとマダム': 'Madame & poodle', 'スクーター': 'Scooter', 'スクールバス': 'School bus', 'リムジン': 'Limousine', 'ロバの荷車': 'Donkey cart', 'ミイラ': 'Mummy', '観光バス': 'Tour bus', '水上タクシー': 'Water taxi', '仮面の踊り手': 'Masked dancer', '白鳥': 'Swan', 'フランスの小型車': 'Little French car', '消防車': 'Fire truck', 'トゥクトゥク': 'Tuk-tuk', '水上バス': 'Water bus', '何か': 'Something' };
const tn = n => (LANG === 'en' ? NAME_EN[n] || n : n);
const PLACE_EN = { jp: "Japan: Kishiwada", paris: "Paris: Arc de Triomphe", ny: "NY: Times Square", giza: "Giza: Pyramids", venice: "Venice: Grand Canal" };
const placeName = (p, n) => (LANG === 'en' ? `${PLACE_EN[p] || p} (${n ? 'Night' : 'Day'})` : stageName(p, n));
function applyLang() {
  document.documentElement.lang = LANG;
  for (const el of document.querySelectorAll('[data-en]')) { if (el.dataset.ja === undefined) el.dataset.ja = el.innerHTML; el.innerHTML = LANG === 'en' ? el.dataset.en : el.dataset.ja; }
  for (const el of document.querySelectorAll('[data-en-ph]')) { if (el.dataset.jaPh === undefined) el.dataset.jaPh = el.placeholder; el.placeholder = LANG === 'en' ? el.dataset.enPh : el.dataset.jaPh; }
  const lb = document.getElementById('langBtn'); if (lb) { lb.textContent = LANG === 'en' ? 'JP' : 'EN'; lb.title = LANG === 'en' ? '日本語にする' : 'Switch to English'; }
  if (typeof showHold === 'function') showHold();
  if (typeof showBest === 'function' && document.getElementById('bestT')) try { showBest(); } catch { }
  if (racers && racers.length) for (const r of racers) if (r.kind === 'me') r.name = L('あなた', 'You');
}

// ================= レンダラ =================
let quality = store.get('danjiri-q', isTouch ? 'low' : 'high');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.domElement.className = 'gl';
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 2000);
const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.5, 0.92);
composer.addPass(bloom);
const speedPass = new ShaderPass(SpeedShader);
composer.addPass(speedPass);
composer.addPass(new OutputPass());
function applyQuality() {
  const pr = quality === 'high' ? Math.min(devicePixelRatio, 1.6) : Math.min(devicePixelRatio, 1);
  renderer.setPixelRatio(pr); composer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  sun.shadow.mapSize.set(2048, 2048);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  sun.castShadow = quality === 'high';
  setOutlines(quality === 'high');
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); applyQuality(); });

// ================= 空・光 =================
const skyMat = new THREE.ShaderMaterial({
  uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(-0.5, 0.45, 0.4).normalize() }, sunCol: { value: new THREE.Color() }, sunSize: { value: 600 } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
  fragmentShader: `uniform vec3 top, mid, bot, sunCol; uniform vec3 sunDir; uniform float sunSize; varying vec3 vDir;
    void main(){ vec3 d = normalize(vDir); float h = d.y;
      vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(mid, bot, pow(clamp(-h, 0.0, 1.0), 0.4));
      float s = max(dot(d, normalize(sunDir)), 0.0);
      c += sunCol * (step(1.0 - 1.0 / sunSize, s) * 1.6 + pow(s, 16.0) * 0.25);
      gl_FragColor = vec4(c, 1.0); }`,
  side: THREE.BackSide, depthWrite: false, fog: false,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), skyMat); sky.renderOrder = -10; scene.add(sky);
const stars = (() => {
  const p = []; for (let i = 0; i < 1400; i++) { const a = Math.random() * Math.PI * 2, y = Math.random() * 0.9 + 0.08, r = Math.sqrt(1 - y * y); p.push(Math.cos(a) * r * 1400, y * 1400, Math.sin(a) * r * 1400); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false }));
})();
scene.add(stars);
const hemi = new THREE.HemisphereLight(0xdcefff, 0x8a7a60, 1.25); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);
const SUN_OFF = new THREE.Vector3(-110, 120, 90);
const carLight = new THREE.PointLight(0xffb060, 0, 34, 1.4); scene.add(carLight);
scene.fog = new THREE.Fog(0xcfe6f5, 140, 700);
// ステージ（町並み・空・昼夜）。昔の「時間帯」の記録も引き継ぐ
// ステージ（場所）と時間（昼・夜）。ひとりでの時は自分で選んだもの、みんなでの時はサーバのくじ引き
const savedPlace = () => { const v = store.get('danjiri-place', 'jp'); return PLACES[v] ? v : 'jp'; };
const savedNight = () => store.get('danjiri-tod', 'day') === 'night';
let place = savedPlace(), worldKey = null;
let night = savedNight();
let world = null;
function applyTimeOfDay() {
  const U = skyMat.uniforms, K = SKIES[`${place}-${night ? 'night' : 'day'}`] || SKIES['jp-day'];
  U.top.value.set(K.top); U.mid.value.set(K.mid); U.bot.value.set(K.bot); U.sunCol.value.set(K.sun); U.sunDir.value.set(...K.sunDir).normalize(); U.sunSize.value = K.sunSize;
  hemi.color.set(K.hemi[0]); hemi.groundColor.set(K.hemi[1]); hemi.intensity = K.hemi[2];
  sun.color.set(K.light[0]); sun.intensity = K.light[1]; SUN_OFF.set(...K.off);
  scene.fog.color.set(K.fog[0]); scene.fog.near = K.fog[1]; scene.fog.far = K.fog[2];
  bloom.strength = K.bloom[0]; bloom.threshold = K.bloom[1]; bloom.radius = night ? 0.4 : 0.45;
  carLight.intensity = K.carLight; stars.visible = K.stars; renderer.toneMappingExposure = 1.0;
  setLanternGlow(K.lantern);
  if (world) world.setNight(night);
}
// 町を作り直す（ステージの町並みが変わった時だけ）
const worldRoot = { g: null };
function loadStage(pl, nt = night) {
  if (!PLACES[pl]) pl = 'jp';
  place = pl; night = !!nt;
  const theme = pl, key = pl === 'ny' ? `ny-${night}` : pl;   // NY は昼夜で摩天楼の窓が変わるので作り直す
  if (key !== worldKey) {
    if (worldRoot.g) {
      scene.remove(worldRoot.g);
      const seen = new Set();
      worldRoot.g.traverse(o => { if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); } const ms = o.material ? [].concat(o.material) : []; for (const m of ms) if (!seen.has(m)) { seen.add(m); for (const k of ['map', 'emissiveMap']) if (m[k] && !seen.has(m[k])) { seen.add(m[k]); m[k].dispose(); } m.dispose(); } });
    }
    worldRoot.g = new THREE.Group(); scene.add(worldRoot.g);
    world = buildWorld(worldRoot.g, course, { theme, night });
    worldKey = key;
    propGrid = new Map();
    for (const p of world.props) { const k = Math.floor(p.x / 10) + ',' + Math.floor(p.z / 10); if (!propGrid.has(k)) propGrid.set(k, []); propGrid.get(k).push(p); }
    SIM.resetBreach(course);
    // 壊れない物（ギザのピラミッド）の前は道が広がらない
    if (!course.extMax0) course.extMax0 = [course.extMax[0].slice(), course.extMax[1].slice()];
    course.extMax[0].set(course.extMax0[0]); course.extMax[1].set(course.extMax0[1]);
    for (const q of world.solid || []) for (let sv = q.s0; sv <= q.s1; sv += SIM.BIN) { const b = SIM.binOf(course, sv); course.extMax[q.side][b] = Math.min(course.extMax[q.side][b], 1.0); }
    applyQuality();
  }
  applyTimeOfDay();
}

// ================= コースと町 =================
let course;
const fx = new FX(scene);
const crowd = new CrowdRig(scene, 8 * 24, 8);
const ropeMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.07, 1), new THREE.MeshToonMaterial({ color: 0xd8c08a }), 4 * 2 * 7);
ropeMesh.frustumCulled = false; ropeMesh.castShadow = true; scene.add(ropeMesh);
// 絡まった提灯の紐
const cordMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.045, 0.045, 1), new THREE.MeshToonMaterial({ color: 0x1b1410 }), 4 * 48);
cordMesh.frustumCulled = false; cordMesh.count = 0; scene.add(cordMesh);

// ================= 状態 =================
let state = 'loading', prevState = null, mode = 'solo';
let racers = [], player = null;
let LAPS = +store.get('danjiri-laps', 2), selTeam = +store.get('danjiri-team', 0);
let raceStart = 0, raceT = 0, resultTimer = 0, timeScale = 1, shake = 0, camMode = 0;
let stats = {};
let propGrid = new Map();
const goalS = () => SIM.START_S + LAPS * course.L;

// ================= だんじり（レーサー） =================
// 頭上の名札: チーム色の太い縁＋大きな文字。屋根より上に出して、遠くでも読める大きさを保つ（updateTags）
function nameTag(text, css) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 120; const g = c.getContext('2d');
  g.fillStyle = 'rgba(12,8,26,0.88)'; g.strokeStyle = css; g.lineWidth = 10;
  g.beginPath(); g.roundRect ? g.roundRect(8, 8, 496, 92, 28) : g.rect(8, 8, 496, 92); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(236, 100); g.lineTo(256, 118); g.lineTo(276, 100); g.closePath(); g.fillStyle = css; g.fill();   // 下向きの矢印
  g.fillStyle = '#fff'; g.font = `900 56px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.strokeText(text, 256, 56, 450); g.fillText(text, 256, 56, 450);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  sp.scale.set(4.6, 1.08, 1); sp.position.set(0, 10.6, 0); sp.renderOrder = 20;
  sp.userData.tag = true;
  return sp;
}
function makeRacer(teamIdx, slot, kind, extra = {}) {
  const team = TEAMS[teamIdx];
  const car = SIM.gridCar(course, slot);
  const djType = kind === 'me' ? myType : extra.id != null ? NET.types?.[extra.id] || 0 : 0;
  const D = makeDanjiri(team, djType);
  scene.add(D.group);
  const r = { team, teamIdx, slot, kind, car, D, vis: car, ai: kind === 'cpu' ? SIM.makeAI(slot) : null, phase: Math.random() * 6, finished: false, finishTime: 0, prevAir: false, prevCrash: 0, ...extra };
  r.stick = { body: D.body, list: [] };
  r.ropes = [-1, 1].map(sd => ({ sd, nodes: Array.from({ length: 7 }, () => ({ x: 0, y: 0, z: 0, i: -1 })), init: false }));
  if (r.name && kind !== 'me') D.group.add(r.tag = nameTag(r.name, team.css));
  const ic = kind === 'me' ? myIcon : extra.id != null ? NET.icons?.[extra.id] : null;
  r.flagMode = kind === 'me' ? myFlag : extra.id != null ? NET.flagModes?.[extra.id] || 'both' : 'both';
  if (ic) setFlagIcon(r, ic);
  const tx = kind === 'me' ? myText : extra.id != null ? NET.texts?.[extra.id] : '';
  if (tx) setBannerText(r, tx);
  const fn = kind === 'me' ? myFinish : extra.id != null ? NET.finishes?.[extra.id] : 0;
  if (fn) setFinish(D, fn);
  r.form = kind === 'me' ? myForm : extra.id != null ? NET.forms?.[extra.id] || 0 : 0;
  r.crew = kind === 'me' ? myCrew : extra.id != null ? NET.crews?.[extra.id] || null : null;
  if (kind === 'me') car.mod = SIM.carMod(myForm, myType);
  return r;
}
// ================= アイコン旗（タイトルで設定した画像を、だんじり後ろの大きな旗に） =================
let myIcon = store.get('danjiri-icon', '') || '';
// 旗の付け方: 前後に交差旗・前だけ・後ろだけ・後ろに 1 本旗
const FLAG_MODES = [['both', '交差旗（前後）', 'Crossed, front & back'], ['back', '交差旗（後ろ）', 'Crossed, back'], ['front', '交差旗（前）', 'Crossed, front'], ['single', '1本旗', 'Single flag']];
let myFlag = store.get('danjiri-flag', 'both'); if (!FLAG_MODES.some(f => f[0] === myFlag)) myFlag = 'both';
let myText = store.get('danjiri-text', '') || '';
let myFinish = +store.get('danjiri-finish', 0) || 0;
let myForm = +store.get('danjiri-form', 0) || 0;
let myType = clamp(+store.get('danjiri-type', 0) || 0, 0, DJ_TYPES.length - 1);
// 引き手のカスタム: 髪型・服装・法被のマーク（def=祭 / txt=文字 / img=写真）
const cleanCrew = c => ({ face: !!c?.face, hair: clamp(c?.hair | 0, 0, HAIRS.length - 1), outfit: clamp(c?.outfit | 0, 0, OUTFITS.length - 1), mark: ['def', 'txt', 'img'].includes(c?.mark) ? c.mark : 'def', mtext: [...String(c?.mtext || '').replace(/[\s<>&"']/g, '')].slice(0, 2).join('') });
let myCrew = cleanCrew((() => { try { return JSON.parse(store.get('danjiri-crew', '') || 'null') || { mark: 'img' }; } catch { return { mark: 'img' }; } })());
const saveCrew = () => store.set('danjiri-crew', JSON.stringify(myCrew));
// 法被のテクスチャ（このだんじりの引き手の分）
function crewTex(r) {
  if (r.slotIdx == null || r.slotIdx >= 8 || racers[r.slotIdx] !== r) return;
  const c = r.crew || {}, img = c.mark === 'img' && r.iconUrl ? iconImgs.get(r.iconUrl) : null;
  crowd.setTeamTexture(r.slotIdx, r.team, img || null, c.mark === 'txt' ? c.mtext : '');
  crowd.setFace(r.slotIdx, c.face && r.iconUrl ? iconImgs.get(r.iconUrl) || null : null);   // 顔に写真
}
const cleanBanner = s => [...String(s || '').replace(/[\s\u0000-\u001f<>&"']/g, '')].slice(0, 4).join('');
// 幟の文字を差し替え（2 本の幟は同じ材質）
function setBannerText(r, text) {
  const b = r.D.banners[0]; if (!b) return;
  const m = b.cloth.material, old = m.map;
  m.map = bannerTex(r.team, cleanBanner(text) || '御祭禮'); m.needsUpdate = true;
  if (old) old.dispose();
}
const iconImgs = new Map();   // dataURL → 読み込んだ画像
function setFlagIcon(r, url) {
  const D = r.D;
  r.iconUrl = url || null;
  if (D.iconFlag) { D.body.remove(D.iconFlag); D.iconFlag = null; }
  const mode = FLAG_MODES.some(f => f[0] === r.flagMode) ? r.flagMode : 'both';
  if (D.rearLan) D.rearLan.visible = !url || mode === 'front';   // 後ろに交差旗・1 本旗を付ける時は、旗とかぶる後ろの提灯 2 つを外す
  if (!url) return;
  const apply = img => {
    if (D.iconFlag) D.body.remove(D.iconFlag);
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    g.fillStyle = r.team.css; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#f2c14e'; g.fillRect(14, 14, 228, 228);
    g.drawImage(img, 20, 20, 216, 216);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    // 交差旗: だんじりの後ろと前に 1 組ずつ。竿 2 本が手すりの内側から立って × に交差し、竿の先（剣先）に大きな旗
    const clothMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true }), flags = [];
    const poleMat = new THREE.MeshBasicMaterial({ color: 0x2a1a0e }), knobMat = new THREE.MeshBasicMaterial({ color: 0xf0bc3c }), bladeMat = new THREE.MeshBasicMaterial({ color: 0xe4e9ef });
    const flag = new THREE.Group();
    const single = mode === 'single';
    for (const fz of mode === 'front' ? [1] : mode === 'both' ? [-1, 1] : [-1]) {   // -1 = 後ろ（追いかける側から見える）、1 = 前
      const set = new THREE.Group(); set.position.set(0, 2.3, fz * 1.72); set.rotation.x = fz * 0.3; set.scale.setScalar(0.72);   // 外へ少し倒す
      for (const sx of single ? [1] : [-1, 1]) {
        const lean = single ? 0.12 : 0.78;   // 竿ごと外へ倒す（旗も一緒に外向き）。1 本旗はほぼまっすぐ
        const arm = new THREE.Group(); arm.position.set(single ? -0.3 : -sx * 0.8, 0, sx * 0.06); arm.rotation.z = -sx * lean;   // 根元を広げて × に交差
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 4.7, 6).translate(0, 2.35, 0), poleMat);   // 大きい旗が手すり・提灯に当たらない長さ
        // 竿の先は剣先: 平たい両刃の刃（銀）＋鍔＋根元の金具（金）
        const knob = new THREE.Group(); knob.position.y = 4.7;
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.85, 4).scale(1, 1, 0.25).translate(0, 0.56, 0), bladeMat);
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.08).translate(0, 0.12, 0), knobMat);
        const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.16, 8).translate(0, 0.02, 0), knobMat);
        knob.add(blade, guard, ferrule);
        // 大きめの旗。竿側を固定して、外へ行くほどはためく（frame のはためき）
        const W = 2.0, H = 1.65, geo = new THREE.PlaneGeometry(W, H, 12, 5);
        const cloth = new THREE.Mesh(geo, clothMat);
        cloth.position.set(sx * W / 2, 4.7 - H / 2, 0);   // 旗の上端を竿の先（剣先の根元）にそろえる
        cloth.rotation.set(0, fz < 0 ? Math.PI : 0, 0);   // 写真の表を外（後ろの旗は後ろ、前の旗は前）へ向ける
        cloth.userData.base = geo.attributes.position.array.slice(); cloth.userData.sx = fz < 0 ? sx : -sx; cloth.userData.W = W;
        arm.add(pole, knob, cloth); set.add(arm); flags.push(cloth);
      }
      flag.add(set);
    }
    flag.userData.cloth = { material: clothMat }; flag.userData.cloths = flags;
    D.body.add(flag); D.iconFlag = flag;
    crewTex(r);   // 法被の背中（マークが「写真」の時）
  };
  const have = iconImgs.get(url);
  if (have) apply(have); else { const img = new Image(); img.onload = () => { iconImgs.set(url, img); if (racers.includes(r) || r.D.group.parent) apply(img); }; img.src = url; }
}
// 画像の切り抜き: 正方形の枠の中で、ドラッグで移動・ホイール / 2 本指 / スライダーで拡大。決めたら 128px の JPEG に
function iconFromFile(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); cropOpen(img, res, () => rej(new Error('cancel'))); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')); };
    img.src = url;
  });
}
const CR = { img: null, x: 0, y: 0, z: 1, min: 1, ok: null, ng: null };
function cropOpen(img, ok, ng) {
  Object.assign(CR, { img, ok, ng });
  const V = 260;   // 枠の大きさ (px)
  CR.min = V / Math.min(img.width, img.height); CR.z = CR.min;
  CR.x = (V - img.width * CR.z) / 2; CR.y = (V - img.height * CR.z) / 2;
  $('crZoom').value = 0;
  $('crop').classList.remove('hidden'); cropDraw();
}
function cropClamp() {
  const V = 260, w = CR.img.width * CR.z, h = CR.img.height * CR.z;
  CR.x = clamp(CR.x, V - w, 0); CR.y = clamp(CR.y, V - h, 0);
}
function cropZoom(z, cx = 130, cy = 130) {
  z = clamp(z, CR.min, CR.min * 6);
  CR.x = cx - (cx - CR.x) * z / CR.z; CR.y = cy - (cy - CR.y) * z / CR.z; CR.z = z;
  $('crZoom').value = Math.round(Math.log(CR.z / CR.min) / Math.log(6) * 100);
  cropDraw();
}
function cropDraw() {
  cropClamp();
  const g = $('crCanvas').getContext('2d');
  g.fillStyle = '#222'; g.fillRect(0, 0, 260, 260);
  g.drawImage(CR.img, CR.x, CR.y, CR.img.width * CR.z, CR.img.height * CR.z);
}
function cropDone(use) {
  $('crop').classList.add('hidden');
  if (!use) { CR.ng && CR.ng(); return; }
  // できるだけ軽く: 96px・画質 0.55 の JPEG（だいたい 2〜3 KB）。それでも大きければさらに落とす
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const k = 96 / 260, g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 96, 96);
  g.drawImage(CR.img, CR.x * k, CR.y * k, CR.img.width * CR.z * k, CR.img.height * CR.z * k);
  let q = 0.55, d = c.toDataURL('image/jpeg', q); while (d.length > 5000 && q > 0.25) { q -= 0.1; d = c.toDataURL('image/jpeg', q); }
  CR.ok && CR.ok(d);
}
{
  const cv = () => $('crCanvas'), ptr = new Map();
  const pos = e => { const r = cv().getBoundingClientRect(); return [(e.clientX - r.left) * 260 / r.width, (e.clientY - r.top) * 260 / r.height]; };
  addEventListener('pointerdown', e => { if (e.target !== cv()) return; e.preventDefault(); cv().setPointerCapture(e.pointerId); ptr.set(e.pointerId, pos(e)); });
  addEventListener('pointermove', e => {
    if (!ptr.has(e.pointerId)) return;
    const p = pos(e), o = ptr.get(e.pointerId);
    if (ptr.size === 1) { CR.x += p[0] - o[0]; CR.y += p[1] - o[1]; cropDraw(); }
    else { const [a, b] = [...ptr.values()], d0 = Math.hypot(a[0] - b[0], a[1] - b[1]); ptr.set(e.pointerId, p); const [c, d] = [...ptr.values()], d1 = Math.hypot(c[0] - d[0], c[1] - d[1]); cropZoom(CR.z * d1 / Math.max(1, d0), (c[0] + d[0]) / 2, (c[1] + d[1]) / 2); return; }
    ptr.set(e.pointerId, p);
  });
  const up = e => ptr.delete(e.pointerId);
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
  addEventListener('wheel', e => { if (e.target !== cv()) return; e.preventDefault(); const p = pos(e); cropZoom(CR.z * (e.deltaY < 0 ? 1.1 : 1 / 1.1), p[0], p[1]); }, { passive: false });
}
function showIconUI() {
  cuSummary();
  $('cuFlagBox')?.classList.toggle('hidden', !myIcon);   // 旗の付け方は画像をえらんでから
  $('iconImg').classList.toggle('hidden', !myIcon); if (myIcon) $('iconImg').src = myIcon;
  $('iconDel').classList.toggle('hidden', !myIcon);
  $('customThumb').classList.toggle('hidden', !myIcon); if (myIcon) $('customThumb').src = myIcon;
  $('customSw').style.background = TEAMS[selTeam].css;
}
// だんじりカスタム: 3D でくるくる回る自分のだんじりを見ながら、町（色）と旗のアイコンを選ぶ
// カスタム中は自分のだんじりだけ（CPU は隠す）
function soloOnlyMe() { for (const r of racers) if (r !== player) { r.hidden = true; r.D.group.visible = false; } }
// じゃばらの見出しに今の設定を出す
function cuSummary() {
  if (!$('cuValFin')) return;
  setT($('cuValFin'), `${L(DJ_TYPES[myType].ja, DJ_TYPES[myType].en)}・${L(FINISHES[myFinish].ja, FINISHES[myFinish].en)}`);
  setT($('cuValForm'), L(SIM.FORMS[myForm].ja, SIM.FORMS[myForm].en));
  $('cuValTeam').innerHTML = `<span class="sw" style="background:${TEAMS[selTeam].css}"></span>${esc(teamName(TEAMS[selTeam]))}`;
  setT($('cuValText'), myText || L('御祭禮（標準）', 'Default'));
  setT($('cuValCrew'), `${myCrew.face ? L('顔写真・', 'Face photo · ') : ''}${L(HAIRS[myCrew.hair].ja, HAIRS[myCrew.hair].en)}・${L(OUTFITS[myCrew.outfit].ja, OUTFITS[myCrew.outfit].en)}・${myCrew.mark === 'img' ? L('写真', 'Photo') : myCrew.mark === 'txt' ? (myCrew.mtext || '祭') : '祭'}`);
  $('cuValIcon').innerHTML = myIcon ? `<img src="${myIcon}" alt="">${esc(L(FLAG_MODES.find(f => f[0] === myFlag)[1], FLAG_MODES.find(f => f[0] === myFlag)[2]))}` : esc(L('なし', 'None'));
}
// 引き手を変えた時は、後ろの押し手の背中が見える向きに
function crewView() { SC.auto = false; SC.yaw = Math.PI; SC.pitch = 0.32; SC.dist = 11; }
function customOpen(on) {
  if (on && state !== 'title') return;
  SC.preview = on;
  if (on) {
    buildSolo(); soloOnlyMe(); $('title').classList.add('hidden');
    showcaseOpen(true); $('result').classList.add('hidden'); SC.i = 0; SC.yaw = Math.PI * 0.85; SC.pitch = 0.5; SC.dist = 21;
    document.querySelector('#showcase .sc-bar').classList.add('hidden');
    $('cuTeams').innerHTML = TEAMS.map((t, i) => `<button data-t="${i}" class="${i === selTeam ? 'sel' : ''}"><span class="sw" style="background:${t.css}"></span>${esc(teamName(t))}</button>`).join('');
    $('cuType').innerHTML = DJ_TYPES.map((f, i) => `<button data-f="${i}" class="${i === myType ? 'sel' : ''}">${esc(L(f.ja, f.en))}</button>`).join('');
    $('cuType').querySelectorAll('button').forEach(b => b.onclick = () => { myType = +b.dataset.f; store.set('danjiri-type', myType); $('cuType').querySelectorAll('button').forEach(c => c.classList.toggle('sel', c === b)); buildSolo(); soloOnlyMe(); cuSummary(); typeDesc(); SC.auto = true; SC.dist = Math.max(SC.dist, 18); SC.pitch = 0.4; });
    const typeDesc = () => setT($('cuTypeD'), L(SIM.TYPE_MODS[myType].dja, SIM.TYPE_MODS[myType].den));
    typeDesc();
    $('cuFin').innerHTML = FINISHES.map((f, i) => `<button data-f="${i}" class="${i === myFinish ? 'sel' : ''}">${esc(L(f.ja, f.en))}</button>`).join('');
    $('cuFin').querySelectorAll('button').forEach(b => b.onclick = () => { myFinish = +b.dataset.f; store.set('danjiri-finish', myFinish); $('cuFin').querySelectorAll('button').forEach(c => c.classList.toggle('sel', c === b)); setFinish(player.D, myFinish); cuSummary(); });
    const formDesc = () => setT($('cuFormD'), L(SIM.FORMS[myForm].dja, SIM.FORMS[myForm].den));
    $('cuForm').innerHTML = SIM.FORMS.map((f, i) => `<button data-f="${i}" class="${i === myForm ? 'sel' : ''}">${esc(L(f.ja, f.en))}</button>`).join('');
    $('cuForm').querySelectorAll('button').forEach(b => b.onclick = () => { myForm = +b.dataset.f; store.set('danjiri-form', myForm); $('cuForm').querySelectorAll('button').forEach(c => c.classList.toggle('sel', c === b)); player.form = myForm; player.car.mod = SIM.carMod(myForm, myType); formDesc(); cuSummary(); SC.dist = Math.max(SC.dist, 21); });
    formDesc();
    // 引き手: 髪型・服装・法被のマーク
    const pick = (id, list, key) => {
      $(id).innerHTML = list.map((h, i) => `<button data-v="${i}" class="${i === myCrew[key] ? 'sel' : ''}">${esc(L(h.ja, h.en))}</button>`).join('');
      $(id).querySelectorAll('button').forEach(b => b.onclick = () => { myCrew[key] = +b.dataset.v; saveCrew(); $(id).querySelectorAll('button').forEach(c => c.classList.toggle('sel', c === b)); cuSummary(); crewView(); });
    };
    pick('cuHair', HAIRS, 'hair'); pick('cuOutfit', OUTFITS, 'outfit');
    const faceUI = () => $('cuFace').querySelectorAll('button').forEach(b => b.classList.toggle('sel', (b.dataset.v === '1') === myCrew.face));
    $('cuFace').querySelectorAll('button').forEach(b => b.onclick = () => { myCrew.face = b.dataset.v === '1'; saveCrew(); faceUI(); crewTex(player); cuSummary(); SC.auto = false; SC.yaw = 0.25; SC.pitch = 0.22; SC.dist = 16; setT($('cuMarkNote'), myCrew.face && !myIcon ? L('顔の写真は「旗アイコン（画像）」で選んだ画像を使います', 'Uses the image from "Flag icon (image)"') : ''); });
    faceUI();
    const MARKS = [['def', '祭（標準）', 'Default'], ['txt', '文字', 'Text'], ['img', '写真', 'Photo']];
    const markUI = () => { $('cuMark').querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.v === myCrew.mark)); $('cuMarkTx').classList.toggle('hidden', myCrew.mark !== 'txt'); };
    $('cuMark').innerHTML = MARKS.map(([v, ja, en]) => `<button data-v="${v}">${esc(L(ja, en))}</button>`).join('');
    $('cuMark').querySelectorAll('button').forEach(b => b.onclick = () => { myCrew.mark = b.dataset.v; saveCrew(); markUI(); crewTex(player); cuSummary(); crewView(); if (myCrew.mark === 'img' && !myIcon) setT($('cuMarkNote'), L('写真は「旗アイコン（画像）」で選んだ画像を使います', 'Uses the image from "Flag icon (image)"')); else setT($('cuMarkNote'), ''); });
    $('cuMarkIn').value = myCrew.mtext;
    $('cuMarkIn').oninput = () => { myCrew.mtext = cleanCrew({ mtext: $('cuMarkIn').value }).mtext; saveCrew(); crewTex(player); cuSummary(); };
    markUI();
    $('cuTeams').querySelectorAll('button').forEach(b => b.onclick = () => { selTeam = +b.dataset.t; store.set('danjiri-team', selTeam); $('cuTeams').querySelectorAll('button').forEach(c => c.classList.toggle('sel', c === b)); buildSolo(); soloOnlyMe(); showIconUI(); });
    showIconUI();
  } else {
    showcaseOpen(false); $('result').classList.add('hidden');
    document.querySelector('#showcase .sc-bar').classList.remove('hidden');
    $('title').classList.remove('hidden'); buildSolo();
  }
  $('custom').classList.toggle('hidden', !on);
  document.querySelectorAll('#custom .cu-sec').forEach(d => (d.open = false));   // 最初は全部たたんだ状態
  $('cuCard').classList.remove('hidden'); $('cuShow').classList.add('hidden'); SC.lift = 1;
}
function clearRacers() {
  for (const r of racers) { scene.remove(r.D.group); r.D.group.traverse(o => { if (o.isMesh && o.geometry && o.geometry !== undefined) o.geometry.dispose?.(); }); }
  racers = []; player = null;
}
function finishRoster() {
  racers.forEach((r, i) => { r.slotIdx = Math.min(i, 7); if (i < 8) crewTex(r); });
  const n = rankOrder().length;
  $('rankOf').textContent = L(`位 / ${n}`, ` / ${n}`);
  for (const r of racers) updateVisual(r, 0, 0);
}
function buildSolo() {
  clearRacers();
  const order = [selTeam, ...[0, 1, 2, 3, 4, 5, 6, 7].filter(i => i !== selTeam).slice(0, 3)];
  const slots = [1, 0, 2, 3];
  order.forEach((ti, k) => racers.push(makeRacer(ti, slots[k], k === 0 ? 'me' : 'cpu', { name: k ? `CPU ${teamName(TEAMS[ti])}` : L('あなた', 'You') })));
  player = racers[0];
  finishRoster();
}

// ================= 引き手（綱・梃子・後押し） =================
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpP = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1), YAX = new THREE.Vector3(0, 1, 0);
const pose = newPose(), PR = {}, WQ = {};
const ROPE_L = 10.5, ROPE_N = 7;
function l2w(c, lx, lz) { const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw); return [c.x + fz * lx + fx * lz, c.z - fx * lx + fz * lz]; }
function groundAt(x, z, hint) { SIM.project(course, x, z, hint, PR); return SIM.heightS(course, PR.s); }
function personRoot(x, y, z, yaw) { return tmpM.compose(tmpP.set(x, y, z), tmpQ.setFromAxisAngle(YAX, yaw), ONE); }
// 引き手の配置ごとの並び（梃子 beam・後押し push）と綱の長さ
const BASE_CREW = [['beam', 0.98, 2.75], ['beam', -0.98, 2.75], ['beam', 0.98, 3.75], ['beam', -0.98, 3.75], ['push', 0.6, -3.55], ['push', 0, -3.65], ['push', -0.6, -3.55]];
const CREW_LAYOUT = [
  BASE_CREW,
  [['beam', 0.98, 3.25], ['beam', -0.98, 3.25], ['push', 0.6, -3.55], ['push', -0.6, -3.55]],                                   // 前曳き: 綱に人を回す
  [...BASE_CREW, ['beam', 1.3, -2.9], ['beam', -1.3, -2.9], ['beam', 1.3, -1.9], ['beam', -1.3, -1.9]],                         // 後梃子
  [...BASE_CREW, ['push', 1.2, -3.4], ['push', -1.2, -3.4], ['push', 0.3, -4.45], ['push', -0.3, -4.45]],                       // 後押し
  [...BASE_CREW, ['beam', 1.55, 1.0], ['beam', -1.55, 1.0]],                                                                   // やりまわし: 横に走り手
];
const ROPE_F = [1, 1.4, 0.8, 0.9, 1];
function updateCrew(r, dt, t) {
  const c = r.vis, sp = c.speed || 0, air = !!c.air, crash = c.crashT > 0;
  r.phase += dt * (2.2 + sp * 0.62);
  const flyY = air ? c.y : null;
  let seed = r.slotIdx * 31;
  // 梃子と後ろの押し手（だんじりと一緒に動く）
  const fixed = CREW_LAYOUT[r.form || 0];
  for (const [kind, lx, lz] of fixed) {
    const [x, z] = l2w(c, lx, lz);
    const gy = air ? flyY + 0.2 : groundAt(x, z, c.si ?? -1);
    crewPose(pose, kind, r.phase + seed, sp, air, crash, t, seed);
    const bob = air ? 0 : Math.abs(Math.sin(r.phase + seed)) * 0.1 * Math.min(1, sp / 6);
    crowd.add(personRoot(x, gy + HIP_Y + bob - (kind === 'push' ? 0.08 : 0), z, c.yaw), pose, r.slotIdx, r.team.color, false, r.crew);
    seed += 7;
  }
  // 綱
  const yawLead = c.yaw + (c.steerIn || 0) * 0.45 + (c.w || 0) * 0.12;
  for (const rope of r.ropes) {
    const N = rope.nodes, [ax, az] = l2w(c, rope.sd * 0.55, 4.45);
    const ay = c.y + 0.98;
    const seg = ROPE_L * (ROPE_F[r.form || 0] || 1) / (ROPE_N - 1) * 0.97;
    const RL = ROPE_L * (ROPE_F[r.form || 0] || 1);
    const lx = ax + Math.sin(yawLead) * RL + Math.cos(yawLead) * rope.sd * 0.5, lz = az + Math.cos(yawLead) * RL - Math.sin(yawLead) * rope.sd * 0.5;
    if (!rope.init || Math.hypot(N[0].x - ax, N[0].z - az) > 8) {
      for (let k = 0; k < ROPE_N; k++) { const f = k / (ROPE_N - 1); N[k].x = lerp(ax, lx, f); N[k].z = lerp(az, lz, f); N[k].y = ay; }
      rope.init = true;
    }
    N[0].x = ax; N[0].z = az;
    const L = N[ROPE_N - 1], k = Math.min(1, dt * (air ? 2 : 4.5));
    L.x += (lx - L.x) * k; L.z += (lz - L.z) * k;
    for (let it = 0; it < 2; it++) {
      for (let i = ROPE_N - 2; i >= 0; i--) { const a = N[i], b = N[i + 1]; const dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz) || 1; a.x = b.x + dx / d * seg; a.z = b.z + dz / d * seg; }
      N[0].x = ax; N[0].z = az;
      for (let i = 1; i < ROPE_N; i++) { const a = N[i], b = N[i - 1]; const dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz) || 1; a.x = b.x + dx / d * seg; a.z = b.z + dz / d * seg; }
    }
    for (let i = 1; i < ROPE_N; i++) {
      const n = N[i];
      SIM.project(course, n.x, n.z, n.i, PR); n.i = PR.i;
      const lim = SIM.wallAt(course, PR.s, PR.lat) - 0.5;
      if (Math.abs(PR.lat) > lim) { const p = (Math.abs(PR.lat) - lim) * Math.sign(PR.lat); n.x += PR.tz * p; n.z -= PR.tx * p; }
      if (air) n.y += ((c.y + 0.6 - i * 0.12) - n.y) * Math.min(1, dt * 6);
      else n.y = SIM.heightS(course, PR.s) + 0.98;
    }
    N[0].y = ay;
    for (let i = 0; i < ROPE_N - 1; i++) {
      const a = N[i], b = N[i + 1];
      setRope(ropeIdx++, a.x, a.y, a.z, b.x, b.y, b.z);
    }
    for (let i = 1; i < ROPE_N - 1; i++) {
      const a = N[i], b = N[i + 1], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1;
      const ox = dz / d * rope.sd * 0.42, oz = -dx / d * rope.sd * 0.42;
      const yaw = Math.atan2(dx, dz);
      crewPose(pose, 'rope', r.phase + seed, sp, air, crash, t, seed);
      const bob = air ? 0 : Math.abs(Math.sin(r.phase + seed)) * 0.12 * Math.min(1, sp / 6);
      crowd.add(personRoot(a.x + ox, a.y - 0.98 + HIP_Y + bob, a.z + oz, yaw), pose, r.slotIdx, r.team.color, false, r.crew);
      seed += 5;
    }
  }
}
// 提灯の紐が屋根に巻きつき、両端は後ろへ垂れて地面を引きずる。絡まった提灯はその紐にぶら下がる
const LOOP_N = 14, TAIL_N = 8, TAIL_SEG = 0.85;
const tV = new THREE.Vector3(), tQ = new THREE.Quaternion(), tE = new THREE.Euler(), tM = new THREE.Matrix4();
function addTangle(r, lans) {
  let T = r.tangle;
  if (!T) {
    const ph = Math.random() * 6, tilt = (Math.random() - 0.5) * 0.5;
    // 大屋根の軒のまわりを斜めにひと巻き（だんじりの中での位置）
    const loop = [];
    for (let k = 0; k < LOOP_N; k++) {
      const a = k / LOOP_N * Math.PI * 2;
      loop.push(new THREE.Vector3(Math.cos(a) * 1.85, 4.0 + Math.sin(a + ph) * 0.3 + Math.cos(a) * tilt, -0.35 + Math.sin(a) * 2.05));
    }
    T = r.tangle = { loop, lw: loop.map(() => new THREE.Vector3()), tails: [], lans: [], t: 0 };
    r.D.body.updateWorldMatrix(true, false);
    for (const k of [Math.floor(LOOP_N * 0.62), Math.floor(LOOP_N * 0.88)]) { // 後ろ寄りの 2 か所から垂れる
      const a = loop[k].clone().applyMatrix4(r.D.body.matrixWorld), bx = -Math.sin(r.vis.yaw), bz = -Math.cos(r.vis.yaw);
      T.tails.push({ k, n: Array.from({ length: TAIL_N }, (_, i) => { const p = { x: a.x + bx * i * TAIL_SEG, y: a.y - i * 0.3, z: a.z + bz * i * TAIL_SEG }; p.px = p.x; p.py = p.y; p.pz = p.z; return p; }) });
    }
  }
  // 元の場所から引きはがされて飛んでくる（約 0.55 秒）
  for (const pc of lans) { pc.swingPh = Math.random() * 6; pc.from = new THREE.Vector3(pc.px, pc.py, pc.pz); pc.tAdd = T.t; T.lans.push(pc); }
}
function updateTangle(r, dt) {
  const T = r.tangle; if (!T) return;
  T.lans = T.lans.filter(pc => pc.st === 5 && pc.who === r.stick);
  if (!T.lans.length) { r.tangle = null; return; }
  T.t += dt;
  const M = r.D.body.matrixWorld;
  T.loop.forEach((v, k) => T.lw[k].copy(v).applyMatrix4(M));
  for (let k = 0; k < LOOP_N; k++) { const a = T.lw[k], b = T.lw[(k + 1) % LOOP_N]; setCord(cordIdx++, a, b); }
  // 垂れた紐（ベルレ法）
  const step = Math.min(dt, 1 / 30);
  for (const tl of T.tails) {
    const N = tl.n, a = T.lw[tl.k];
    for (let i = 1; i < TAIL_N; i++) {
      const p = N[i], vx = (p.x - p.px) * 0.96, vy = (p.y - p.py) * 0.96, vz = (p.z - p.pz) * 0.96;
      p.px = p.x; p.py = p.y; p.pz = p.z;
      p.x += vx; p.y += vy - 14 * step * step; p.z += vz;
    }
    N[0].x = a.x; N[0].y = a.y; N[0].z = a.z;
    for (let it = 0; it < 3; it++) {
      for (let i = 1; i < TAIL_N; i++) {
        const p = N[i], q = N[i - 1], dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z, d = Math.hypot(dx, dy, dz) || 1, f = (d - TAIL_SEG) / d;
        if (i === 1) { p.x -= dx * f; p.y -= dy * f; p.z -= dz * f; }
        else { p.x -= dx * f * 0.5; p.y -= dy * f * 0.5; p.z -= dz * f * 0.5; q.x += dx * f * 0.5; q.y += dy * f * 0.5; q.z += dz * f * 0.5; }
      }
      for (let i = 1; i < TAIL_N; i++) { const p = N[i], g = groundAt(p.x, p.z, r.vis.si ?? -1) + 0.05; if (p.y < g) { p.y = g; p.px += (p.x - p.px) * 0.3; p.pz += (p.z - p.pz) * 0.3; } }
    }
    for (let i = 0; i < TAIL_N - 1; i++) setCord(cordIdx++, N[i], N[i + 1]);
  }
  // 提灯: 巻いた紐と垂れた紐にぶら下げる
  T.lans.forEach((pc, k) => {
    let p, drop = 0.42;
    if (k % 3 === 2 && T.tails.length) { const tl = T.tails[(k / 3 | 0) % T.tails.length]; p = tl.n[Math.min(TAIL_N - 1, 2 + ((k / 6) | 0) * 2)]; drop = 0.3; }
    else p = T.lw[(k * 5 + 1) % LOOP_N];
    let sw = Math.sin(T.t * 5 + pc.swingPh) * 0.35;
    tV.set(p.x, p.y - drop, p.z);
    const u = pc.from ? (T.t - pc.tAdd) / 0.55 : 1;
    if (u < 1) {
      // 引っぱられて飛んでくる間は、だんじりとの間に紐がピンと張る
      const e = u * u * (3 - 2 * u);
      const fx0 = pc.from.x, fy0 = pc.from.y, fz0 = pc.from.z;
      tV.set(fx0 + (tV.x - fx0) * e, fy0 + (tV.y - fy0) * e + Math.sin(u * Math.PI) * 1.4, fz0 + (tV.z - fz0) * e);
      setCord(cordIdx++, tV, p);
      sw = (1 - u) * 2.5 * Math.sin(u * 20);
    }
    tE.set(sw, r.vis.yaw + pc.swingPh, Math.cos(T.t * 4 + pc.swingPh) * 0.25);
    tM.compose(tV, tQ.setFromEuler(tE), ONE);
    world.posePiece(pc, tM);
  });
}
let cordIdx = 0;
function setCord(i, a, b) {
  rd.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  rd.scale.set(1, 1, Math.max(0.01, Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)));
  rd.lookAt(b.x, b.y, b.z); rd.updateMatrix();
  cordMesh.setMatrixAt(i, rd.matrix);
}
let ropeIdx = 0;
const rd = new THREE.Object3D();
function setRope(i, ax, ay, az, bx, by, bz) {
  rd.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  rd.scale.set(1, 1, Math.max(0.01, Math.hypot(bx - ax, by - ay, bz - az)));
  rd.lookAt(bx, by, bz); rd.updateMatrix();
  ropeMesh.setMatrixAt(i, rd.matrix);
}

// ================= 見た目・演出 =================
function updateVisual(r, dt, t) {
  const c = r.vis;
  if (r.tag === undefined) r.tag = r.D.group.children.find(o => o.userData.tag) || null;
  if (r.tag) r.tag.visible = Math.hypot(c.x - camera.position.x, c.z - camera.position.z) > 16;
  r.D.group.position.set(c.x, c.y, c.z);
  // バナナでくるっと 1 回転
  let spin = 0; if (r.spinT > 0) { r.spinT -= dt; spin = (1 - Math.max(0, r.spinT) / 0.9) * Math.PI * 2; }
  r.D.group.rotation.y = c.yaw + spin;
  animateDanjiri(r.D, c, dt, t, AU.musicBeat());
  r.D.group.updateMatrixWorld(true);
}
// 大工方（屋根の上で舞う 2 人）
const dkM = new THREE.Matrix4(), dkL = new THREE.Matrix4();
function addDaiku(r) {
  r.D.daiku.forEach((d, i) => {
    dkL.compose(tmpP.set(d.x, d.y + HIP_Y * d.s, d.z), tmpQ.identity(), new THREE.Vector3(d.s, d.s, d.s));
    dkM.multiplyMatrices(r.D.body.matrixWorld, dkL);
    crowd.add(dkM, r.D.daikuPose[i], r.slotIdx, r.team.color, true, r.crew);
  });
}
function carEffects(r, dt, camPos) {
  const c = r.vis;
  const dist = Math.hypot(c.x - camPos.x, c.z - camPos.z);
  if (dist > 140) return;
  const sp = c.speed || 0;
  if (!c.air && sp > 4 && (c.drift || c.slip > 7) && place !== 'venice') {
    for (const lx of [-0.98, 0.98]) {
      const [x, z] = l2w(c, lx, -1.45);
      fx.skidMark(x, c.y, z, Math.atan2(c.vx || 0, c.vz || 0), sp * dt + 0.08);
      if (Math.random() < 0.18) fx.burst('dust', x, c.y + 0.1, z, 1, { vx: -(c.vx || 0), vz: -(c.vz || 0), size: 1.4, color: night ? [0.45, 0.45, 0.55] : [0.88, 0.84, 0.76] });
    }
  }
  if (!c.air && sp > 6 && (Math.abs(c.roll) > 0.16 || (c.drift && sp > 13))) {
    const side = Math.abs(c.roll) > 0.16 ? -Math.sign(c.roll) * 0.98 : (Math.random() < 0.5 ? -0.98 : 0.98);
    for (const lz of [-1.45, 1.45]) { const [x, z] = l2w(c, side, lz); if (Math.random() < 0.8) fx.burst('sparks', x, c.y + 0.1, z, 2, { vx: (c.vx || 0) * 0.3, vz: (c.vz || 0) * 0.3 }); }
  }
  // ベネチア: 水路を進む水しぶき
  if (place === 'venice' && !c.air && sp > 2) {
    for (const lx of [-1.1, 1.1]) if (Math.random() < Math.min(0.9, sp / 18)) { const [x, z] = l2w(c, lx, Math.random() * 3 - 1.5); fx.burst('debris', x, c.y + 0.2, z, 2, { colors: [0xe8f6ff, 0xa8dcf0, 0xffffff], vx: c.vx * 0.2, vz: c.vz * 0.2, speed: 2 + sp * 0.1, up: 3 + sp * 0.12 }); }
    if (Math.random() < 0.3) { const [x, z] = l2w(c, 0, 2.6); fx.burst('dust', x, c.y + 0.1, z, 1, { size: 2.2, color: [0.9, 0.97, 1] }); }
  }
  const [tx, tz] = l2w(c, 0, -0.4);
  fx.trail(r, tx, c.y + 5.4, tz, !!c.boosting || (c.air && (c.airT || 0.5) > 0.25), dt);
  if (c.boosting && Math.random() < 0.7) { const [bx, bz] = l2w(c, 0, -3.8); fx.burst('glow', bx, c.y + 1.5, bz, 1); }
}
function message(text, cls = '', big = false, sub = '') {
  const d = document.createElement('div');
  d.className = 'msg ' + cls + (big ? ' big' : '');
  d.textContent = text;
  if (sub) { const s = document.createElement('small'); s.textContent = sub; d.appendChild(s); }
  const box = $('msgs'); while (box.children.length > 2) box.firstChild.remove();
  box.appendChild(d); setTimeout(() => d.remove(), 1400);
}
function handleEvents(r, ev) {
  const c = r.car, me = r === player;
  const near = me || Math.hypot(c.x - player.vis.x, c.z - player.vis.z) < 45;
  if (ev.wall > 3) {
    if (near) fx.burst('sparks', ev.wallX, c.y + 1, ev.wallZ, Math.min(30, ev.wall * 2));
    if (me) { shake = Math.max(shake, Math.min(0.8, ev.wall * 0.05)); AU.sfx('wall', ev.wall); }
  }
  if (ev.breaks.length) breakFx(r, ev.breaks);
  if (ev.smash > 2 && me) shake = Math.max(shake, Math.min(0.9, 0.2 + ev.smash * 0.03));
  if (ev.launch && me) AU.sfx('launch');
  if (ev.land) {
    if (near) fx.burst('dust', c.x, c.y + 0.2, c.z, Math.min(26, 6 + ev.land * 1.2), { spread: 6, size: 1.8, color: night ? [0.45, 0.45, 0.55] : [0.9, 0.86, 0.78] });
    if (me) {
      shake = Math.max(shake, Math.min(1.2, ev.land * 0.06)); AU.sfx('land', ev.land);
      if (ev.airT > 0.6) { message(L('大ジャンプ!!', 'BIG AIR!!'), 'gold', true, `${ev.airT.toFixed(2)} ${L('秒', 's')}`); AU.cheer(0.5, 2); stats.maxAir = Math.max(stats.maxAir, ev.airT); }
    }
  }
  if (ev.driftEnd && me) {
    stats.bestDrift = Math.max(stats.bestDrift, ev.driftEnd);
    message(L('やりまわし成功!', 'YARIMAWASHI!'), 'gold', true, `${ev.driftEnd.toFixed(1)} ${L('秒', 's')}`); AU.sfx('drift');
    if (ev.driftEnd > 2) AU.cheer(0.35, 1.2);
  }
  if (ev.crash) {
    world.shed(r.stick, c.vx, c.vz);
    if (near) { fx.burst('debris', c.x, c.y + 2, c.z, me ? 40 : 20, { vx: c.vx, vz: c.vz, speed: 7, up: 7 }); fx.burst('dust', c.x, c.y + 0.5, c.z, 16, { spread: 5, size: 2 }); }
    if (me) {
      stats.crashes++; shake = 1.6; timeScale = 0.4; AU.sfx('crash');
      message(ev.crash === 'tip' ? L('横転!!', 'ROLLED OVER!!') : ev.crash === 'land' ? L('着地失敗!!', 'BAD LANDING!!') : L('激突!!', 'CRASH!!'), 'bad', true);
    }
  }
}
// 町が壊れた: 壊れた物ごとの演出
function breakFx(r, codes) {
  const c = r.vis, me = r === player;
  const hit = world.breakBins(codes, r.stick, c);
  if (!hit.length) return;
  const near = me || Math.hypot(c.x - player.vis.x, c.z - player.vis.z) < 60;
  let big = 0;
  for (const pc of hit) {
    if (pc.kind === 'bld') big++;
    if (!near) continue;
    if (pc.kind === 'bld') {
      fx.burst('debris', pc.px, pc.py + 3, pc.pz, 26, { colors: pc.col, vx: c.vx * 0.6, vz: c.vz * 0.6, speed: 7, up: 8 });
      fx.burst('dust', pc.px, pc.py + 1, pc.pz, 18, { spread: Math.max(pc.w, pc.d) * 0.6, size: 3.2, color: night ? [0.4, 0.4, 0.48] : [0.86, 0.82, 0.74] });
    } else fx.burst('debris', pc.px, pc.py + 1, pc.pz, 8, { colors: pc.col, vx: c.vx, vz: c.vz, speed: 4, up: 5 });
  }
  const tn = performance.now();
  if (near && tn - (r.sndT || 0) > 90) { r.sndT = tn; AU.sfx(big ? 'crash' : 'smash'); }
  if (me) {
    stats.smash += hit.length; r.car.boost = Math.min(1, r.car.boost + 0.02 * hit.length + 0.06 * big);
    if (big) { shake = Math.max(shake, 1.0); if (tn - (r.msgT || 0) > 2500) { r.msgT = tn; message(big > 1 ? L('町ごと粉砕!!', 'BLOCK DEMOLISHED!!') : L('家ごと粉砕!!', 'HOUSE DEMOLISHED!!'), 'gold', true); AU.cheer(0.45, 1.6); } }
  }
}
// 他のプレイヤーのだんじりが道の外へ出ていたら、こちらの町もそこを壊す
function netBreach(r) {
  const v = r.vis;
  SIM.project(course, v.x, v.z, v.si ?? -1, PR); v.si = PR.i; v.s = PR.s; v.u = PR.lat;
  const au = Math.abs(PR.lat);
  if (au + SIM.CAR.HALF <= SIM.wallAt(course, PR.s, PR.lat)) return;
  const out = [];
  SIM.breach(course, PR.s, SIM.sideOf(PR.lat), au + SIM.CAR.HALF - SIM.WALL + 1.6, out);
  if (out.length) breakFx(r, out);
}
// 提灯の列・鳥居の下をくぐった: 絡まってついてくることがある
function snagSpans(r) {
  const c = r.kind === 'net' ? r.vis : r.car, s = c.s ?? 0, u = c.u ?? 0;
  if (r.prevS === undefined || c.air && c.y - SIM.heightS(course, s) > 3) { r.prevS = s; return; }
  const got = world.snag(r.stick, r.vis, r.prevS, s, u);
  r.prevS = s;
  if (!got.length) return;
  const cord = got.filter(pc => pc.kind === 'lan' && pc.st === 5);
  if (cord.length) addTangle(r, cord);
  const near = r === player || Math.hypot(r.vis.x - player.vis.x, r.vis.z - player.vis.z) < 60;
  if (near) { AU.sfx(cord.length ? 'snap' : 'smash'); for (const pc of got) fx.burst('debris', pc.px, pc.py, pc.pz, 6, { colors: pc.kind === 'torii' ? [0xd8401f, 0x1e1a18] : [0xf4efe2, 0xd8231b], vx: r.vis.vx, vz: r.vis.vz, speed: 3, up: 3 }); }
  if (r === player) {
    const big = got.find(pc => pc.kind === 'gateobj');
    const gate = got.find(pc => pc.kind === 'torii');
    if (big) { message(big.name === '雷門' ? L('雷門ごと持ってった!!', 'TOOK THE WHOLE GATE!!') : L('大提灯を引っかけた!!', 'SNAGGED THE GIANT LANTERN!!'), 'gold', true); AU.cheer(0.7, 2.5); shake = Math.max(shake, 1.0); }
    else if (gate) { message(L(`${gate.name}をお持ち帰り!!`, `Took the ${tn(gate.name)} home!!`), 'gold', true); AU.cheer(0.5, 1.8); shake = Math.max(shake, 0.6); }
    else if (cord.length) { message(L('ブチッ!', 'SNAP!'), 'gold', true, L(`${cord[0].name}が絡まった!`, `${tn(cord[0].name)} tangled!`)); shake = Math.max(shake, 0.35); if (mode === 'solo') timeScale = 0.45; }
  }
}
// ハプニング: 横切るものを動かし始める・道のトラップ
let happenMsgT = 0, sandT = 0;
// 砂嵐: しばらく霧を砂色に濃くする
function updateSand(dt) {
  if (sandT <= 0) return;
  sandT -= dt;
  const k = Math.min(1, sandT / 1.5, (6 - sandT) / 0.8);
  if (sandT <= 0) { applyTimeOfDay(); return; }
  const K = SKIES[`${place}-${night ? 'night' : 'day'}`] || SKIES['jp-day'];
  scene.fog.color.set(K.fog[0]).lerp(new THREE.Color(0xc8a060), k); scene.fog.near = K.fog[1] * (1 - k) + 8 * k; scene.fog.far = K.fog[2] * (1 - k) + 70 * k;
  if (Math.random() < 0.6) { const c = player.vis; fx.burst('dust', c.x + (Math.random() - 0.5) * 30, c.y + 1 + Math.random() * 4, c.z + (Math.random() - 0.5) * 30, 1, { size: 4, color: [0.85, 0.7, 0.45] }); }
}
function updateHappenings(dt) {
  if (state !== 'race' || !player) return;
  const c = player.car, CL = course.L, now = performance.now();
  for (const p of world.movers || []) {
    const mv = p.mover; if (mv.on || !p.alive || p.pc.st) continue;
    const ds = ((mv.s - c.s) % CL + CL) % CL;
    if (ds > 22 && ds < 62) {
      // 近づくたびに半分の確率で出てくる（毎回は出ない）
      const pass = Math.floor(c.prog / CL) + ':' + Math.round(mv.s);
      if (mv.pass === pass) continue;
      mv.pass = pass; if (Math.random() < 0.5) continue;
      mv.on = true; if (now - happenMsgT > 1500) { happenMsgT = now; message(L(`${mv.name}が横切る!`, `${tn(mv.name)} crossing!`), 'bad', true); if (p.type === 'police' || p.type === 'jpolice') AU.sfx('siren'); } }
  }
  for (const t of world.traps || []) {
    t.cool -= dt;
    if (t.gone > 0) { t.gone -= dt; if (t.gone <= 0) world.hideTrap(t, false); continue; }
    if (t.kind === 'manhole' && Math.random() < 0.03 && Math.abs(t.x - camera.position.x) + Math.abs(t.z - camera.position.z) < 90) fx.burst('dust', t.x, t.y + 0.3, t.z, 1, { size: 1.8, color: [0.93, 0.93, 0.95] });
    const d = Math.hypot(c.x - t.x, c.z - t.z);
    if (t.across) { const ds = Math.abs((((c.s - t.s) % CL) + CL + CL / 2) % CL - CL / 2); if (ds > 1.5 || c.air || t.cool > 0) continue; }
    else if (d > t.r + (t.kind === 'pigeons' ? 6 : 1.4) || t.cool > 0) continue;
    t.cool = 2.5;
    if (t.kind === 'puddle') { c.vu += (Math.random() < 0.5 ? -1 : 1) * 5; fx.burst('debris', c.x, c.y + 0.3, c.z, 18, { colors: [0xe8f6ff, 0x9fd0f0], speed: 4, up: 5 }); message(L('つるっ!', 'SLIP!'), 'bad'); AU.sfx('smash'); }
    else if (t.kind === 'manhole') { c.hopReq = 9; fx.burst('dust', t.x, t.y + 0.5, t.z, 30, { spread: 3, size: 3.5, color: [0.95, 0.95, 0.97] }); message(L('マンホールの蒸気で吹っ飛んだ!', 'STEAM BLAST!'), 'gold', true); AU.sfx('launch'); shake = Math.max(shake, 0.6); }
    else if (t.kind === 'quicksand') { c.v *= 0.55; fx.burst('dust', c.x, c.y + 0.3, c.z, 20, { spread: 3, size: 2.5, color: [0.85, 0.72, 0.5] }); message(L('砂だまりに突っ込んだ!', 'SAND DRIFT!'), 'bad', true); AU.sfx('land', 6); t.cool = 4; }
    else if (t.kind === 'wave') { c.vu += (Math.random() < 0.5 ? -1 : 1) * 8; for (let k = 0; k < 3; k++) fx.burst('debris', c.x + (Math.random() - 0.5) * 6, c.y + 0.5, c.z + (Math.random() - 0.5) * 6, 14, { colors: [0xffffff, 0xbfe6f6], speed: 5, up: 7 }); message(L('高潮の波だ!', 'BIG WAVE!'), 'bad', true); AU.sfx('wall', 6); shake = Math.max(shake, 0.4); }
    else if (t.kind === 'plate') { c.hopReq = 4.5; shake = Math.max(shake, 0.5); fx.burst('sparks', c.x, c.y + 0.3, c.z, 14); message(L('工事中の鉄板でガタン!', 'ROAD WORKS!'), 'bad', true); AU.sfx('wall', 6); }
    else if (t.kind === 'banana') { c.vu += (Math.random() < 0.5 ? -1 : 1) * 6; c.v *= 0.8; player.spinT = 0.9; world.hideTrap(t, true); t.gone = 30; message(L('バナナの皮ですべった!', 'BANANA PEEL!'), 'bad', true); AU.sfx('drift'); }
    else if (t.kind === 'bump') { c.hopReq = 5; shake = Math.max(shake, 0.5); fx.burst('dust', c.x, c.y + 0.2, c.z, 10, { spread: 4, size: 1.6 }); message(L('石畳でガタン!', 'BUMP!'), 'gold'); AU.sfx('land', 6); }
    else if (t.kind === 'spray') { c.vu += (Math.random() < 0.5 ? -1 : 1) * 6; for (let k = 0; k < 3; k++) fx.burst('debris', c.x + (Math.random() - 0.5) * 3, c.y + 1.5, c.z + (Math.random() - 0.5) * 3, 14, { colors: [0xffffff, 0xbfe6ff], speed: 4, up: 6 }); message(L('消火栓の放水を浴びた!', 'HYDRANT SPRAY!'), 'bad', true); AU.sfx('wall', 5); }
    else if (t.kind === 'pothole') { c.hopReq = 6; c.v *= 0.9; shake = Math.max(shake, 0.8); fx.burst('debris', t.x, t.y + 0.3, t.z, 14, { colors: [0x3a3a3e, 0x6a6a70], speed: 4, up: 6 }); message(L('道の穴でドスン!', 'POTHOLE!'), 'bad', true); AU.sfx('land', 10); }
    else if (t.kind === 'sandstorm') { sandT = 6; t.cool = 10; message(L('砂嵐だ!', 'SANDSTORM!'), 'bad', true); AU.sfx('launch'); }
    else if (t.kind === 'pigeons') { world.hideTrap(t, true); t.gone = 25; fx.burst('debris', t.x, t.y + 0.5, t.z, 40, { colors: [0x8a8e9a, 0xf4f4f4, 0x6a7a8a], speed: 5, up: 9 }); message(L('ハトが一斉に飛び立った!', 'PIGEONS SCATTER!'), 'gold'); AU.cheer(0.25, 1); }
  }
}
// 届く範囲（ひっつけた物の分だけ広い）に入った道ばたの物・観客を巻き込む
function grabReach(r) {
  if (!world.grabNear) return;
  const v = r.kind === 'net' ? r.vis : r.car;
  const got = world.grabNear(r.stick, r.vis, v.s, v.u);
  if (!got.length) return;
  const near = r === player || Math.hypot(r.vis.x - player.vis.x, r.vis.z - player.vis.z) < 60;
  if (near) { AU.sfx('smash'); for (const pc of got) fx.burst('debris', pc.px, pc.py + 1, pc.pz, 6, { colors: pc.col || [0xf4efe2, 0x8a6a42], speed: 3, up: 4 }); }
  if (r === player) { stats.smash += got.length; const tn0 = performance.now(); if (tn0 - (r.grabMsgT || 0) > 2500) { r.grabMsgT = tn0; message(L('巻き込んだ!', 'ROLLED IT UP!'), 'gold'); } }
}
function hitProps(r) {
  const c = r.vis; if (c.y === undefined) return;
  const reachW = world.reach ? world.reach(r.stick).w : 0;   // くっついた物が触れても巻き込む
  const cx = Math.floor(c.x / 10), cz = Math.floor(c.z / 10);
  const fxv = Math.sin(c.yaw), fzv = Math.cos(c.yaw);
  const lists = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const l = propGrid.get((cx + i) + ',' + (cz + j)); if (l) lists.push(l); }
  if (world.movers && world.movers.length) lists.push(world.movers);   // 横切って動いているもの
  for (const list of lists) {
    for (const p of list) {
      if (!p.alive || Math.abs(p.y - c.y) > 2.5) continue;
      for (const off of [SIM.CAR_OFF, -SIM.CAR_OFF]) {
        const d = Math.hypot(c.x + fxv * off - p.x, c.z + fzv * off - p.z);
        if (d < SIM.CAR_R + p.r + reachW) {
          const sp = c.speed || 0;
          world.smash(p, c.vx || 0, c.vz || 0, sp, r.stick);
          const near = r === player || Math.hypot(c.x - player.vis.x, c.z - player.vis.z) < 50;
          if (near) {
            const cols = { cone: [0xff6a1a, 0xf8f8f8], barricade: [0xf2c400, 0x111111], crate: [0xb3803f, 0x7a5128], tawara: [0xd6b768, 0x8a6a2a], sign: [0xf4efe2, 0x1e3f8a], bin: [0x2f7a4a], bike: [0xc62828, 0x222222] }[p.type];
            fx.burst('debris', p.x, p.y + 0.6, p.z, 10, { colors: cols, vx: c.vx, vz: c.vz, speed: 4, up: 5 });
            if (sp > 8) fx.burst('dust', p.x, p.y + 0.3, p.z, 4, { spread: 2 });
            AU.sfx('smash');
          }
          if (r.kind !== 'net') { r.car.vx *= 1 - p.mass * 0.12; r.car.vz *= 1 - p.mass * 0.12; }
          if (r === player) { stats.smash++; r.car.boost = Math.min(1, r.car.boost + 0.035); shake = Math.max(shake, 0.25); }
          break;
        }
      }
    }
  }
}

// ================= カメラ =================
// カメラを家の中に入れない（壊れて広がった所は入ってよい）
function clampCam(v, extra) {
  SIM.project(course, v.x, v.z, -1, PR);
  const lim = SIM.wallAt(course, PR.s, PR.lat) + extra;
  if (Math.abs(PR.lat) > lim) { const p = (Math.abs(PR.lat) - lim) * Math.sign(PR.lat); v.x += PR.tz * p; v.z -= PR.tx * p; }
}
const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), yaw: 0, ready: false, orbit: 0 };
// ゲーム終了後: 各プレイヤーのだんじりを 3D で回して見る
const SC = { on: false, i: 0, yaw: 0.6, pitch: 0.42, dist: 16, drag: null, auto: true };
function showcaseOpen(on) {
  SC.on = on; SC.auto = true; SC.focus = null; SC.dist = 16;
  $('showcase').classList.toggle('hidden', !on); $('result').classList.toggle('hidden', on);
  if (on) { SC.i = Math.max(0, racers.indexOf(player)); showcaseName(); }
  for (const id of ['scPrev', 'scNext']) $(id).classList.toggle('hidden', racers.length < 2);   // ◀▶ はほかの町のだんじりへ切り替え（1 台だけの時は出さない）
}
function showcaseName() {
  const r = racers[SC.i]; if (!r) return;
  const n = r.stick.log ? r.stick.log.size : 0;
  $('scName').innerHTML = `${swatch(r.team)}${esc(r.name)}<small>${L('ひっつけたもの', 'Stuck')} ${n}${L('個', '')} · ${fmtKg(stuckKg(r))}</small>`;
}
{
  const cv = renderer.domElement, ptrs = new Map();
  cv.addEventListener('pointerdown', e => { if (!SC.on) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); SC.auto = false; });
  addEventListener('pointermove', e => {
    if (!SC.on || !ptrs.has(e.pointerId)) return;
    const p0 = ptrs.get(e.pointerId);
    if (ptrs.size === 1) { SC.yaw -= (e.clientX - p0.x) * 0.008; SC.pitch = clamp(SC.pitch + (e.clientY - p0.y) * 0.006, -0.1, 1.3); }
    else { const [a, b] = [...ptrs.values()], d0 = Math.hypot(a.x - b.x, a.y - b.y); p0.x = e.clientX; p0.y = e.clientY; const [c2, d2] = [...ptrs.values()], d1 = Math.hypot(c2.x - d2.x, c2.y - d2.y); SC.dist = clamp(SC.dist * d0 / Math.max(1, d1), 3, 34); return; }
    p0.x = e.clientX; p0.y = e.clientY;
  });
  const up = e => ptrs.delete(e.pointerId);
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { if (!SC.on) return; e.preventDefault(); SC.dist = clamp(SC.dist * (1 + Math.sign(e.deltaY) * 0.1), 3, 34); }, { passive: false });
}
function updateCamera(dt, t) {
  if (SC.on && racers[SC.i]) {
    const v = racers[SC.i].vis;
    if (SC.auto) SC.yaw += dt * 0.35;
    // 見る中心: ふつうはだんじり全体、ひっつけたものを押した時はその物がくっついている所
    let tx = v.x, ty = v.y + 2.6 - (SC.preview ? 3 * (SC.lift ?? 1) : 0), tz = v.z;   // カスタム中は下のパネルに隠れないよう、だんじりを画面の上寄りに
    const f = SC.focus;
    if (f && f.st === 5 && f.who) {
      if (f.obj) { f.obj.getWorldPosition(tmpP); tx = tmpP.x; ty = tmpP.y + 1; tz = tmpP.z; }
      else if (f.L) { tmpM.multiplyMatrices(f.who.body.matrixWorld, f.L); tmpP.setFromMatrixPosition(tmpM); tx = tmpP.x; ty = tmpP.y; tz = tmpP.z; }
      else if (f.wpos) { tx = f.wpos.x; ty = f.wpos.y; tz = f.wpos.z; }
    } else if (f && f.sp && f.sp.stk) { tmpM.multiplyMatrices(f.sp.stk.who.body.matrixWorld, f.sp.stk.L); tmpP.setFromMatrixPosition(tmpM); tx = tmpP.x; ty = tmpP.y + 1; tz = tmpP.z; }
    const a = SC.yaw + v.yaw, cy = Math.cos(SC.pitch);
    camera.position.set(tx + Math.sin(a) * SC.dist * cy, ty - 0.2 + Math.sin(SC.pitch) * SC.dist, tz + Math.cos(a) * SC.dist * cy);
    if (SC.preview) clampCam(camera.position, 0);   // カスタム中: 家の壁の中に入らない
    camera.lookAt(tx, ty, tz);
    if (Math.abs(camera.fov - 45) > 0.1) { camera.fov = 45; camera.updateProjectionMatrix(); }
    cam.ready = false;
    return;
  }
  const c = player.vis;
  if (state === 'title' || state === 'lobby' || state === 'loading') {
    cam.orbit += dt * 0.1;
    const a = cam.orbit;
    const want = tmpP.set(c.x + Math.sin(a) * 15, c.y + 5.5 + Math.sin(t * 0.3) * 1.2, c.z + Math.cos(a) * 15);
    clampCam(want, 0);
    camera.position.copy(want);
    camera.lookAt(c.x, c.y + 3.2, c.z);
    camera.fov = 50; camera.updateProjectionMatrix(); cam.ready = false; return;
  }
  const sp = c.speed || 0;
  // ドリフト中はだんじりの向きでなく進む向きを追う（横を向いて滑っていくのが見える）
  const slide = sp > 4 && (c.drift || (c.slip || 0) > 4);
  const headYaw = slide ? Math.atan2(c.vx || 0, c.vz || 0) : c.yaw;
  let dy = wrapA(headYaw - cam.yaw);
  if (!cam.ready) { cam.yaw = c.yaw; dy = 0; }
  cam.yaw += dy * Math.min(1, dt * (slide ? 3.0 : 3.6));
  const fx0 = Math.sin(cam.yaw), fz0 = Math.cos(cam.yaw), rx = -fz0, rz = fx0;
  let want;
  if (camMode === 0) {
    // すぐ前に別のだんじりがいて前が見えない時（スタートの団子など）は、カメラを引いて少し上から見下ろす
    let block = 0;
    for (const r of racers) {
      if (r === player || r.ghost || r.hidden) continue;
      const v = r.vis, dx = v.x - c.x, dz = v.z - c.z, f = dx * fx0 + dz * fz0, l = Math.abs(dx * rx + dz * rz);
      if (f > 2 && f < 16 && l < 3.2) block = Math.max(block, (1 - (f - 2) / 14) * (1 - l / 3.2 * 0.5));
    }
    cam.lift = (cam.lift || 0) + (clamp(block * 1.6, 0, 1) - (cam.lift || 0)) * Math.min(1, dt * (block > (cam.lift || 0) ? 2.5 : 0.8));
    const lf = cam.lift;
    const dist = 10.5 + sp * 0.12 + (c.air ? 3 : 0) + lf * 5, h = 4.3 + sp * 0.04 + (c.air ? 1.5 : 0) + lf * 7;
    want = tmpP.set(c.x - fx0 * dist, c.y + h, c.z - fz0 * dist);
    cam.look.set(c.x + fx0 * (6 + lf * 8), c.y + 2.6, c.z + fz0 * (6 + lf * 8));
  } else if (camMode === 1) {
    want = tmpP.set(c.x - fx0 * 14, c.y + 10, c.z - fz0 * 14);
    cam.look.set(c.x + fx0 * 8, c.y + 1.5, c.z + fz0 * 8);
  } else {
    const a = t * 0.25;
    want = tmpP.set(c.x + rx * 6.5 * Math.cos(a) - fx0 * 3, c.y + 1.3, c.z + rz * 6.5 * Math.cos(a) - fz0 * 3);
    cam.look.set(c.x + fx0 * 2, c.y + 3, c.z + fz0 * 2);
  }
  // 家の中に入らないように道へ寄せる
  clampCam(want, 1.6);
  if (!cam.ready) cam.pos.copy(want); else cam.pos.lerp(want, 1 - Math.exp(-dt * (camMode === 2 ? 3 : 7)));
  const gy = groundAt(cam.pos.x, cam.pos.z, -1) + 1.2;
  if (cam.pos.y < gy) cam.pos.y = gy;
  cam.ready = true;
  camera.position.copy(cam.pos);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake * 0.6; camera.position.y += (Math.random() - 0.5) * shake * 0.6;
    shake = Math.max(0, shake - dt * 2.2);
  }
  camera.lookAt(cam.look);
  if (camMode === 0) camera.rotateZ(-c.roll * 0.18);
  const fov = clamp(60 + sp * 0.45 + (c.boosting ? 10 : 0), 55, 92);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
}

// ================= 入力 =================
const keys = new Set();
const input = { throttle: 0, brake: 0, steer: 0, drift: false, boost: false };
const touch = { steer: 0, thr: 0, brake: false, drift: false, boost: false, active: false };
let steerKey = 0;
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') { if (e.code === 'Enter' && !e.target.closest('.chat-row')) e.target.blur(); return; }   // チャット欄は Enter で送信
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  if (state === 'title' && e.code === 'Enter') { if ($('step2').classList.contains('hidden')) titleStep(2); else startSolo(); return; }
  if (state === 'result' && mode === 'solo' && (e.code === 'Enter' || e.code === 'KeyR')) { startSolo(); return; }
  if (e.code === 'KeyC') camMode = (camMode + 1) % 3;
  else if (e.code === 'KeyM') { AU.setMuted(!AU.audio.muted); message(AU.audio.muted ? L('音 OFF', 'Sound OFF') : L('音 ON', 'Sound ON')); }
  else if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  else if (e.code === 'KeyR' && state === 'race' && !player.car.air) backToCourse();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
// 曲がりの補助: 'soft' = 自分が曲がる操作をした時だけ補助（何もしなければまっすぐ・角で外へふくらむ）
//               'full' = 元の動き（前を押しているだけで道なりに曲がり、角で勝手にやりまわし）。戻す時はここを 'full' に
const STEER_ASSIST = 'soft';
function readInput(dt) {
  const k = c => keys.has(c);
  let thr = k('ArrowUp') || k('KeyW') ? 1 : 0, brk = k('ArrowDown') || k('KeyS') ? 1 : 0;
  const tgt = (k('ArrowLeft') || k('KeyA') ? 1 : 0) - (k('ArrowRight') || k('KeyD') ? 1 : 0);
  steerKey += clamp(tgt - steerKey, -dt * (tgt ? 5 : 8), dt * (tgt ? 5 : 8));
  let steer = steerKey, drift = k('Space'), boost = k('ShiftLeft') || k('ShiftRight') || k('KeyJ') || k('KeyK');
  // ゲームパッド
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g && g.connected) : null;
  if (gp) {
    const ax = gp.axes[0] || 0;
    if (Math.abs(ax) > 0.12) steer = -ax;
    thr = Math.max(thr, gp.buttons[7]?.value || 0, (gp.axes[1] || 0) < -0.5 ? 1 : 0);
    brk = Math.max(brk, gp.buttons[6]?.value || 0);
    drift = drift || gp.buttons[2]?.pressed || gp.buttons[1]?.pressed || gp.buttons[5]?.pressed;
    boost = boost || gp.buttons[0]?.pressed || gp.buttons[4]?.pressed;
    if (gp.buttons[3]?.pressed && state === 'race' && !player.car.air && !readInput.yHeld) backToCourse();
    readInput.yHeld = gp.buttons[3]?.pressed;
  }
  // タッチ（スティックを触っている間だけ進む。下に倒すとブレーキ）
  if (isTouch) {
    if (touch.active) steer = touch.steer;
    thr = Math.max(thr, touch.active && !touch.brake && touch.thr >= -0.45 ? 1 : 0);
    brk = Math.max(brk, touch.brake || touch.thr < -0.45 ? 1 : 0);
    drift = drift || touch.drift; boost = boost || touch.boost;
  }
  input.throttle = thr; input.brake = brk; input.steer = clamp(steer, -1, 1); input.drift = drift; input.autoDrift = true; input.boost = boost; input.soft = STEER_ASSIST === 'soft';
  return input;
}
// スマホ: ボタンの連打やつまむ操作で画面が拡大しないようにする（iOS は user-scalable=no を無視するため）
{
  const inPad = e => e.target && e.target.closest && e.target.closest('#touch, .tbtn, #stickZone, #backBtn');
  document.addEventListener('touchstart', e => { if (inPad(e)) e.preventDefault(); }, { passive: false });
  let lastEnd = 0;
  document.addEventListener('touchend', e => { const n = Date.now(); if (inPad(e) || n - lastEnd < 300) e.preventDefault(); lastEnd = n; }, { passive: false });
  for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
}
// バーチャルスティック
{
  const zone = $('stickZone'), stick = $('stick'), knob = $('knob');
  let id = null, ox = 0, oy = 0;
  const R = 58;
  zone.addEventListener('pointerdown', e => {
    e.preventDefault(); id = e.pointerId; zone.setPointerCapture(id);
    ox = e.clientX; oy = e.clientY; stick.style.left = ox + 'px'; stick.style.top = (oy - zone.getBoundingClientRect().top) + 'px';
    stick.classList.remove('hidden'); knob.style.transform = ''; touch.active = true;
  });
  zone.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    let dx = e.clientX - ox, dy = e.clientY - oy; const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    touch.steer = -clamp(dx / R * 1.15, -1, 1); touch.thr = -dy / R;
  });
  const end = e => { if (e.pointerId !== id) return; id = null; stick.classList.add('hidden'); touch.steer = 0; touch.thr = 0; touch.active = false; };
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  const hold = (el, key) => {
    el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); touch[key] = true; el.classList.add('on'); });
    const off = () => { touch[key] = false; el.classList.remove('on'); };
    el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off);
  };
  hold($('tBoost'), 'boost'); hold($('tBrake'), 'brake');
  $('backBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); backToCourse(); });
}

// ================= HUD =================
const mini = $('mini'), mctx = mini.getContext('2d');
let miniBase = null, MB = null;
function prepMini() {
  const xs = SIM.WP.map(p => p[0]), zs = SIM.WP.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const sc = (220 - 40) / Math.max(maxX - minX, maxZ - minZ);
  MB = { minX, minZ, sc, ox: (220 - (maxX - minX) * sc) / 2, oz: (220 - (maxZ - minZ) * sc) / 2 };
  miniBase = document.createElement('canvas'); miniBase.width = miniBase.height = 220;
  const g = miniBase.getContext('2d');
  g.fillStyle = 'rgba(16,12,32,0.7)'; g.beginPath(); g.roundRect ? g.roundRect(0, 0, 220, 220, 18) : g.rect(0, 0, 220, 220); g.fill();
  g.lineJoin = 'round';
  for (const [w, cl] of [[11, 'rgba(0,0,0,0.5)'], [7, 'rgba(255,240,220,0.9)']]) {
    g.strokeStyle = cl; g.lineWidth = w; g.beginPath();
    for (let i = 0; i < course.N; i += 2) { const [x, y] = mm(course.px[i], course.pz[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.closePath(); g.stroke();
  }
  const s0 = SIM.sampleS(course, SIM.START_S), [sx, sy] = mm(s0.x, s0.z);
  g.fillStyle = '#e2402f'; g.fillRect(sx - 2, sy - 8, 4, 16);
  const j = SIM.sampleS(course, course.prof.jumpS), [jx, jy] = mm(j.x, j.z);
  g.fillStyle = '#ffd23f'; g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText('▲', jx, jy - 6);
  g.fillStyle = 'rgba(255,255,255,0.5)'; const [cx, cy] = mm(30, 160); g.fillText('城', cx, cy + 5);
}
const mm = (x, z) => [MB.ox + (x - MB.minX) * MB.sc, MB.oz + (z - MB.minZ) * MB.sc];
function drawMini() {
  const g = mctx; g.clearRect(0, 0, 220, 220); g.drawImage(miniBase, 0, 0);
  if (CU.on && CU.obj) { const [x, y] = mm(CU.obj.position.x, CU.obj.position.z); g.fillStyle = '#ffd34d'; g.strokeStyle = '#c4161c'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); g.stroke(); }
  for (const r of [...racers].reverse()) {
    const [x, y] = mm(r.vis.x, r.vis.z);
    // 向き: 進行方向に 1 歩進めた点をミニマップに写して、そっちへ ▲ の先を向ける
    const [x2, y2] = mm(r.vis.x + Math.sin(r.vis.yaw) * 5, r.vis.z + Math.cos(r.vis.yaw) * 5);
    g.save(); g.translate(x, y); g.rotate(Math.atan2(y2 - y, x2 - x) - Math.PI / 2);
    g.fillStyle = r.team.css; g.strokeStyle = '#fff'; g.lineWidth = r === player ? 2.5 : 1.5;
    const s = r === player ? 9 : 6.5;
    g.beginPath(); g.moveTo(0, s); g.lineTo(s * 0.75, -s * 0.7); g.lineTo(-s * 0.75, -s * 0.7); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
}
const fmt = t => { t = Math.max(0, t); const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(2).padStart(5, '0')}`; };
const setT = (el, v) => { v = String(v); if (el.textContent !== v) el.textContent = v; };
function rankOrder() {
  return racers.filter(r => !r.ghost || r === player).sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1; if (b.finished) return 1;
    return (b.vis.prog || 0) - (a.vis.prog || 0);
  });
}
function updateHUD() {
  const c = player.car;
  setT($('rankN'), rankOrder().indexOf(player) + 1);
  setT($('lapT'), `${clamp(Math.floor((c.prog - SIM.START_S) / course.L) + 1, 1, LAPS)}/${LAPS}`);
  setT($('timeT'), fmt(state === 'countdown' ? 0 : player.finished ? player.finishTime : raceT));
  setT($('spdN'), Math.round(c.speed * 3.6));
  const bb = $('boostBar'); bb.style.width = (c.boost * 100).toFixed(1) + '%'; bb.classList.toggle('full', c.boost > 0.98);
  setT($('boostT'), c.boosting ? L('ソーリャ!', 'SORYA!') : c.boost > 0.25 ? (isTouch ? L('ボタンで加速', 'Tap to boost') : L('Shift で加速', 'Shift to boost')) : '');
  const tilt = Math.min(1, Math.abs(c.roll) / SIM.CAR.TIP);
  $('tiltBar').style.width = (tilt * 100).toFixed(1) + '%';
  setT($('tiltT'), tilt > 0.75 ? L('危ない!', 'Careful!') : '');
  updateTurnCall(c);
  updateBackBtn(c);
  const warn = $('warn');
  const w = c.wrongT > 1.2 ? L('逆走!', 'WRONG WAY!') : (c.crashT > 0 && c.tipped ? L('立て直し中…', 'Recovering…') : '');
  warn.classList.toggle('hidden', !w); setT(warn, w);
}

// コースから外れすぎた・止まってしまった時の「コースに戻る」ボタン
let offT = 0, backShown = false;
function updateBackBtn(c) {
  // コースから外れた時だけ（止まっているだけでは出さない）
  const off = Math.abs(c.u || 0) > SIM.WALL + 1.5;
  offT = state === 'race' && !player.finished && c.crashT <= 0 && off ? offT + 1 / 60 : 0;
  const show = offT > 1.2;
  if (show !== backShown) { backShown = show; $('backBtn').classList.toggle('hidden', !show); }
}
function backToCourse() {
  if (state !== 'race' || !player || player.car.air) return;
  SIM.respawn(player.car, course);
  player.car.v = 8;
  for (const o of player.ropes) o.init = false;
  player.prevS = undefined; cam.ready = false; offT = 0;
  message(L('コースに戻った!', 'Back on course!'), 'good');
}
// 次の角の案内（次は右! / 左!）
const turnUI = { el: null, key: '', said: -1 };
function updateTurnCall(c) {
  const el = turnUI.el || (turnUI.el = $('turn'));
  const nc = SIM.nextCorner(course, c.s);
  const show = state === 'race' && !player.finished && !nc.inside && nc.dist < 85 && nc.dist > -2;
  let key = '';
  if (show) {
    const Lt = nc.c.turn === 'L', now = nc.dist < 28, fast = c.speed > 24;
    key = (Lt ? 'L' : 'R') + (now ? 1 : 0) + (fast ? 1 : 0) + LANG;
    if (key !== turnUI.key) {
      el.className = (Lt ? 'L' : 'R') + (now ? ' now' : '');
      $('turnEdge').className = now ? (Lt ? 'L' : 'R') : '';
      if (now && turnUI.key && turnUI.key[1] === '0') AU.sfx('turnNow');
      setT(el.querySelector('.tx'), now ? (Lt ? L('左へ!!', 'LEFT!!') : L('右へ!!', 'RIGHT!!')) : '');   // 手前の予告は矢印と »»» だけ（文字は出さない）
    }
    setT(el.querySelector('small'), now && fast ? L('勢いのまま突っ込め!', 'Charge in!') : `${Math.max(0, Math.round(nc.dist))} m`);
    const id = nc.c.idx + Math.floor(c.prog / course.L) * 100;
    if (nc.dist < 60 && turnUI.said !== id) { turnUI.said = id; AU.sfx('turnNext'); AU.shout(Lt ? L('ひだりー', 'left!') : L('みぎー', 'right!')); }
  } else { el.className = 'hidden'; $('turnEdge').className = ''; }
  turnUI.key = key;
}

// ================= 進行 =================
function resetStats() { stats = { maxAir: 0, bestDrift: 0, smash: 0, crashes: 0, topSpeed: 0 }; }
// 町の組み立て中の表示（重い処理の前に一度描かせる）
function withLoading(fn) {
  const el = $('loading'); el.classList.remove('hidden');
  requestAnimationFrame(() => setTimeout(() => { try { fn(); } finally { el.classList.add('hidden'); } }, 20));
}
// ひとりでの時は自分で選んだステージに戻す
function soloStage() { const p = savedPlace(), n = savedNight(); if (p !== place || n !== night) loadStage(p, n); }
function startSolo() {
  document.activeElement?.blur?.();
  if (mode === 'online') netLeave();
  mode = 'solo'; soloStage();
  AU.initAudio();
  buildSolo();
  beginRace(AU.now() + 3.2);
}
// ================= 追い上げアイテム「お神酒」 =================
// 2 位以下で先頭から離されると、少し先の道に光る樽酒が出る。取ると気合満タン＋しばらくソーリャ全開
const CU = { obj: null, on: false, s: 0, lane: 0, cd: 8 };
function cuObj() {
  if (CU.obj) return CU.obj;
  const g = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.3, 16), new THREE.MeshBasicMaterial({ color: 0xc8a06a }));
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.5, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#c4161c'; x.font = "900 46px 'Zen Old Mincho', serif"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('御神酒', 64, 34);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  band.material = [new THREE.MeshBasicMaterial({ map: tex }), new THREE.MeshBasicMaterial({ color: 0xffffff }), new THREE.MeshBasicMaterial({ color: 0xffffff })];
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.06, 16), new THREE.MeshBasicMaterial({ color: 0x8a5a2b })); lid.position.y = 0.68;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.12, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.85 }));
  halo.rotation.x = Math.PI / 2; halo.position.y = -0.4;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 9, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 3.8;
  g.add(barrel, band, lid, halo, beam);
  g.userData.halo = halo; g.visible = false;
  scene.add(g);
  return (CU.obj = g);
}
function catchupReset() { CU.on = false; CU.cd = 8; if (CU.obj) CU.obj.visible = false; if (player) player.rushT = 0; }
function updateCatchup(dt, t) {
  if (state !== 'race' || !player || player.kind !== 'me') { if (CU.on) catchupReset(); return; }
  const me = player.car;
  if (CU.on) {
    const o = CU.obj; o.rotation.y += dt * 2.2;
    const p = SIM.sampleS(course, ((CU.s % course.L) + course.L) % course.L);
    o.position.set(p.x - p.tz * CU.lane, SIM.heightS(course, CU.s % course.L) + 1.5 + Math.sin(t * 3) * 0.25, p.z + p.tx * CU.lane);
    o.userData.halo.scale.setScalar(1 + Math.sin(t * 6) * 0.12);
    const d = CU.s - me.prog;
    if (d < -6 || player.finished) { catchupReset(); CU.cd = 5; return; }
    if (Math.abs(d) < 4 && Math.abs((me.u ?? 0) - CU.lane) < 3.6) {
      // 取った: 離されているほど長く
      const lead = rankOrder()[0], gap = lead && lead !== player ? (lead.vis.prog ?? lead.car.prog) - me.prog : 0;
      player.rushT = clamp(2.5 + gap / 60, 2.5, 4.5); me.boost = 1;
      CU.on = false; o.visible = false; CU.cd = 10;
      message(L('御神酒で気合全開!! ソーリャ!!', 'Sacred sake! FULL SORYA!!'), 'gold', true);
      AU.sfx('boost'); AU.shout(); AU.cheer(0.6, 2);
      fx.burst('confetti', me.x, me.y + 6, me.z, 80, { speed: 7, up: 6, life: 2.5 });
    }
    return;
  }
  if (player.finished || (CU.cd -= dt) > 0) return;
  CU.cd = 1.5;
  const lead = rankOrder()[0];
  if (!lead || lead === player) return;
  const gap = (lead.vis.prog ?? lead.car.prog) - me.prog;
  if (gap < 35) return;
  // 自分の進むあたりに置く（少し左右にずらす）
  CU.s = me.prog + 70 + Math.random() * 25;
  CU.lane = clamp((me.u ?? 0) + (Math.random() - 0.5) * 5, -7, 7);
  CU.on = true; cuObj().visible = true;
}
function beginRace(start) {
  catchupReset();
  if (SC.on) showcaseOpen(false);
  rec = { team: selTeam, f: [] }; recT = 0; match = null;
  resetStats(); lastPreview = null; sandT = 0; $('rankForm').classList.add('hidden');
  world.resetProps(); SIM.resetBreach(course); fx.clearSkids();
  ['title', 'result', 'lobby', 'pause'].forEach(id => $(id).classList.add('hidden'));
  $('hud').classList.remove('hidden');
  $('touch').classList.toggle('hidden', !isTouch);
  raceStart = start; raceT = 0; shake = 0; timeScale = 1; acc = 0; cam.ready = false;
  AU.startMusic(start, 0, 'race', place === 'jp' ? (Math.random() < 0.5 ? 'jp' : 'jp2') : place);   // 町ごとの曲（日本の町は 2 曲から）
  state = 'countdown'; lastCount = 99;
}
// タイトル: 1 段目は名前と「ひとりで / みんなで」、ひとりでを選ぶと 2 段目（町・周回数・ステージ・画質）
function titleStep(n) {
  if (n === 2) { const v = $('nameIn').value.trim().slice(0, 12); if (v) { myName = v; store.set('danjiri-name', v); } }
  $('step1').classList.toggle('hidden', n !== 1); $('step2').classList.toggle('hidden', n !== 2);
}
function toTitle() {
  titleStep(1); if (SC.on) showcaseOpen(false);
  roomsOpen(false);
  if (mode === 'online') netLeave();
  mode = 'solo'; soloStage();
  state = 'title'; AU.stopMusic();
  ['hud', 'touch', 'result', 'pause', 'count', 'lobby', 'watchBar'].forEach(id => $(id).classList.add('hidden'));
  $('title').classList.remove('hidden');
  if (AU.audio.ctx && AU.audio.ctx.state === 'suspended') AU.audio.ctx.resume();
  showBest();
  world.resetProps(); SIM.resetBreach(course);
  buildSolo();
}
function togglePause() {
  if (mode === 'online') return;
  if (state === 'paused') { state = prevState; $('pause').classList.add('hidden'); AU.audio.ctx?.resume(); }
  else if (['race', 'countdown', 'finish'].includes(state)) { prevState = state; state = 'paused'; $('pause').classList.remove('hidden'); AU.audio.ctx?.suspend(); }
}
const bestKey = () => 'danjiri2-best-' + LAPS;
function showBest() { const b = +store.get(bestKey(), 0); $('bestT').textContent = b ? L(`${LAPS}周のベストタイム ${fmt(b)}`, `Best (${LAPS} lap${LAPS > 1 ? 's' : ''}): ${fmt(b)}`) : ''; }
function statsHTML() {
  return `<div>${L('最長やりまわし', 'Longest drift')} <b>${stats.bestDrift.toFixed(1)}${L('秒', 's')}</b></div><div>${L('最高ジャンプ', 'Longest air')} <b>${stats.maxAir.toFixed(2)}${L('秒', 's')}</b></div>
    <div>${L('壊したもの', 'Smashed')} <b>${stats.smash}</b></div><div>${L('激突・横転', 'Crashes')} <b>${stats.crashes}</b></div><div>${L('最高速度', 'Top speed')} <b>${Math.round(stats.topSpeed * 3.6)}km/h</b></div>`;
}
// 「ひっつけたもの」: 種類ごとの数と絵（3D の形をその場で小さく描く）と総量
const thumbCache = new Map();
let thumbRT = null, thumbScene = null, thumbCam = null;
// くっついた物 1 つ分の形を、原点に置いたグループとして組み立てる（絵と 3D 表示の両方で使う）
function pieceGroup(pc) {
  if (pc.obj) { // 雷門などの普通の 3D の物
    const c = pc.obj.clone(true); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1);
    const grp = new THREE.Group(); grp.add(c); grp.updateMatrixWorld(true);
    return { grp, box: new THREE.Box3().setFromObject(grp) };
  }
  let parts = pc.parts, px = pc.px, py = pc.py, pz = pc.pz;
  if (pc.sp) { // 観客
    const sm = world.specMeshes[pc.sp.up ? 0 : 1].m;
    parts = [{ m: sm, i: pc.sp.mi, base: new THREE.Matrix4() }]; px = py = pz = 0;
  }
  const grp = new THREE.Group(), box = new THREE.Box3(), b2 = new THREE.Box3(), col = new THREE.Color();
  const piv = new THREE.Matrix4().makeTranslation(-px, -py, -pz);
  for (const p of parts) {
    const im = new THREE.InstancedMesh(p.m.geometry, p.m.material, 1), M = piv.clone().multiply(p.base);
    im.setMatrixAt(0, M); im.frustumCulled = false;
    if (p.m.instanceColor) { p.m.getColorAt(p.i, col); im.setColorAt(0, col); }
    if (!p.m.geometry.boundingBox) p.m.geometry.computeBoundingBox();
    b2.copy(p.m.geometry.boundingBox).applyMatrix4(M); box.union(b2);
    grp.add(im);
  }
  return { grp, box };
}
let collGroups = [];
// ひっつけたもの: 押すと、だんじりにくっついている様子をその場所を中心に 3D で回して見る
function bindCollected() { $('resColl').querySelectorAll('.ci').forEach((el, i) => el.onclick = () => { const g = collGroups[i]; if (g) { showcaseOpen(true); SC.focus = g.pc; SC.dist = 7; } }); }
function thumbOf(pc) {
  const key = pc.name || '?';
  if (thumbCache.has(key)) return thumbCache.get(key);
  const S = 128;
  if (!thumbRT) {
    thumbRT = new THREE.WebGLRenderTarget(S, S, { samples: 4 }); thumbRT.texture.colorSpace = THREE.SRGBColorSpace;
    thumbScene = new THREE.Scene();
    thumbScene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a6a, 2.4));
    const dl = new THREE.DirectionalLight(0xffffff, 2.4); dl.position.set(3, 5, 4); thumbScene.add(dl);
    thumbCam = new THREE.PerspectiveCamera(28, 1, 0.05, 2000);
  }
  const { grp, box } = pieceGroup(pc);
  thumbScene.add(grp);
  const c = box.getCenter(new THREE.Vector3()), r = Math.max(0.2, box.getSize(new THREE.Vector3()).length() / 2);
  thumbCam.position.set(c.x + r * 1.7, c.y + r * 1.15, c.z + r * 2.6); thumbCam.lookAt(c);
  thumbCam.near = r * 0.05; thumbCam.far = r * 30; thumbCam.updateProjectionMatrix();
  const prev = renderer.getRenderTarget(), cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
  renderer.setRenderTarget(thumbRT); renderer.setClearColor(0x000000, 0); renderer.clear();
  renderer.render(thumbScene, thumbCam);
  const px8 = new Uint8Array(S * S * 4);
  renderer.readRenderTargetPixels(thumbRT, 0, 0, S, S, px8);
  renderer.setRenderTarget(prev); renderer.setClearColor(cc, ca);
  thumbScene.remove(grp); grp.children.forEach(o => o.dispose());
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) img.data.set(px8.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);
  g.putImageData(img, 0, 0);
  const url = cv.toDataURL();
  thumbCache.set(key, url);
  return url;
}
const fmtKg = kg => kg >= 1000 ? `${(kg / 1000).toFixed(kg >= 100000 ? 0 : 1)}${L('トン', ' t')}` : `${Math.round(kg)}kg`;
function collectedHTML(r) {
  const log = r && r.stick.log;
  if (!log || !log.size) return `<div class="collHead">${L('ひっつけたもの', 'Stuck to your danjiri')}</div><div class="collNone">${L('なし（町に突っ込むと、いろいろくっつく）', 'Nothing yet (crash into the town and things stick!)')}</div>`;
  const groups = new Map(); let n = 0, kg = 0;
  for (const pc of log) {
    const k = pc.name || '何か';
    if (!groups.has(k)) groups.set(k, { pc, n: 0, kg: 0 });
    const g = groups.get(k); g.n++; g.kg += pc.kg || 10; n++; kg += pc.kg || 10;
  }
  const list = [...groups.entries()].sort((a, b) => b[1].kg - a[1].kg);
  let cards = '';
  collGroups = list.map(([name, g]) => ({ name, ...g }));
  for (const [name, g] of list) { let src = ''; try { src = thumbOf(g.pc); } catch (e) { } cards += `<div class="ci" title="${esc(L('押すと、だんじりにくっついている様子を3Dで見られます', 'Tap to see it stuck on the danjiri in 3D'))}">${src ? `<img src="${src}" alt="">` : ''}${esc(tn(name))}<b>×${g.n}</b></div>`; }
  return `<div class="collHead">${L('ひっつけたもの', 'Stuck to your danjiri')}<br>${L('総量', 'Total')} <b>${n}</b>${L('個', ' items')}・<b>${fmtKg(kg)}</b></div><div class="collGrid">${cards}</div>`;
}
const swatch = team => `<span class="sw" style="background:${team.css}"></span>`;
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// ================= 表彰: 1 位のだんじりを 3D でくるくる（紙吹雪・歓声）→ 結果 =================
let podiumT = 0;
// order: 1 位から順の配列（3 位 → 2 位 → 1 位の順に見せる）
function podium(order) {
  const list = (Array.isArray(order) ? order : [order]).filter(r => r && racers.includes(r)).slice(0, 3);
  let w = list[0];
  const done = () => {
    clearTimeout(podiumT); podiumT = 0;
    $('podium').classList.add('hidden'); document.querySelector('#showcase .sc-bar').classList.remove('hidden'); document.querySelector('#showcase .sc-hint').classList.remove('hidden');
    if (SC.podium) { SC.podium = false; if (SC.on) showcaseOpen(false); }
    if (state !== 'result') { $('result').classList.add('hidden'); return; }   // 表彰中に次のレースが始まった
    $('result').classList.remove('hidden'); $('result').scrollTop = 0;
  };
  if (!w) { done(); return; }
  $('result').classList.add('hidden');
  SC.podium = true; showcaseOpen(true); $('result').classList.add('hidden');
  document.querySelector('#showcase .sc-bar').classList.add('hidden'); document.querySelector('#showcase .sc-hint').classList.add('hidden');
  $('podium').classList.remove('hidden');
  $('podium').onclick = done;
  // 3 位 → 2 位 → 1 位
  const seq = [...list].reverse();
  const show = k => {
    if (!SC.podium) return;
    const r = seq[k], rank = list.indexOf(r) + 1, last = k === seq.length - 1;
    SC.i = racers.indexOf(r); SC.yaw = Math.PI * (0.8 + k * 0.4); SC.pitch = 0.24; SC.dist = 19; SC.auto = true; SC.focus = null;
    $('pdCup').textContent = ['🏆', '🥈', '🥉'][rank - 1];
    setT($('pdTitle'), rank === 1 ? L('優 勝', 'WINNER!') : L(`${rank} 位`, `#${rank}`));
    $('pdName').innerHTML = `${swatch(r.team)}${esc(r === player && mode === 'online' ? myName : r.name)}`;
    const box = document.querySelector('#podium .pd-box'); box.classList.remove('pd-go'); void box.offsetWidth; box.classList.add('pd-go');
    const v = r.vis, n = rank === 1 ? 4 : 1;
    for (let j = 0; j < n; j++) setTimeout(() => { if (SC.podium) fx.burst('confetti', v.x + (Math.random() - 0.5) * 6, v.y + 8, v.z + (Math.random() - 0.5) * 6, rank === 1 ? 90 : 40, { speed: 7, up: 7, life: 3.5 }); }, j * 900);
    AU.cheer(rank === 1 ? 0.9 : 0.4, rank === 1 ? 4 : 1.5);
    podiumT = setTimeout(() => (last ? done() : show(k + 1)), last ? 4800 : 2300);
  };
  show(0);
}
function showSoloResult() {
  state = 'result'; AU.stopMusic();
  $('hud').classList.add('hidden'); $('touch').classList.add('hidden');
  const order = rankOrder(), gs = goalS();
  $('resTable').innerHTML = order.map((r, i) => {
    const time = r.finished ? r.finishTime : raceT + (gs - r.car.prog) / 18;
    return `<tr class="${r === player ? 'me' : ''}"><td>${L(`${i + 1}位`, `#${i + 1}`)}</td><td>${swatch(r.team)}${esc(r.name)}</td><td>${r.finished ? '' : L('約 ', '~')}${fmt(time)}</td></tr>`;
  }).join('');
  const rank = order.indexOf(player) + 1; resInfo = { rank, n: order.length }; shareReset(true);
  $('resTitle').textContent = rank === 1 ? L('優勝! 町の誇りや!', 'VICTORY! Pride of the town!') : L(`${rank}位 ゴール`, `Finished #${rank}`);
  const best = +store.get(bestKey(), 0);
  if (player.finished && (!best || player.finishTime < best)) { store.set(bestKey(), player.finishTime); $('resNew').textContent = best ? L('ベストタイム更新!', 'New best time!') : L('ベストタイム記録!', 'Best time set!'); }
  else $('resNew').textContent = L(`ベスト ${fmt(best)}`, `Best ${fmt(best)}`);
  $('resStats').innerHTML = statsHTML(); $('resColl').innerHTML = collectedHTML(player); bindCollected(); showRankForm(); updateMyBest();
  $('retryBtn').classList.remove('hidden'); setNext($('nextInfo'), '', ''); showChat(false);
  podium(order);   // 3 位 → 2 位 → 1 位を表彰してから結果
}

// プルダウン: 選んでいる項目だけ 1 行で見せ、押すと一覧が開く（各ボタンの onclick を包む）
function ddify(el) {
  el.classList.add('dd');
  el.querySelectorAll('button').forEach(b => { const pick = b.onclick; b.onclick = e => { e.stopPropagation(); if (!el.classList.contains('open')) { el.classList.add('open'); return; } el.classList.remove('open'); if (!b.classList.contains('sel') && pick) pick(e); }; });
}
document.addEventListener('click', () => document.querySelectorAll('.choices.dd.open').forEach(el => el.classList.remove('open')));
// ================= ランキング（町ごと・いろいろな部門） =================
// [部門, 名前, 英語, 値の書き方, 称号, 英語の称号, 絵]
const RK_CATS = [
  ['lap', '1周タイム', 'Lap time', v => fmt(v), '韋駄天', 'Lightning Legs', '⚡'],
  ['speed', '最高速度', 'Top speed', v => `${Math.round(v)} km/h`, '爆走番長', 'Speed Boss', '🔥'],
  ['drift', 'やりまわし', 'Drift', v => `${(+v).toFixed(1)} ${L('秒', 's')}`, 'やりまわし名人', 'Drift Master', '🌀'],
  ['stuck', 'ひっつけた量', 'Stuck haul', v => fmtKg(v), 'ひっつけ大魔王', 'Lord of the Haul', '🧲'],
  ['smash', '壊した数', 'Smashed', v => `${v}`, '破壊王', 'Demolition King', '💥'],
  ['air', '大ジャンプ', 'Big air', v => `${(+v).toFixed(2)} ${L('秒', 's')}`, '空飛ぶだんじり', 'Flying Danjiri', '🪽'],
];
const catTitle = k => { const c = RK_CATS.find(x => x[0] === k); return c ? `${c[6]} ${L(c[4], c[5])}` : k; };
const COUNTRIES = [['JP', '日本', 'Japan'], ['US', 'アメリカ', 'USA'], ['GB', 'イギリス', 'UK'], ['FR', 'フランス', 'France'], ['IT', 'イタリア', 'Italy'], ['EG', 'エジプト', 'Egypt'], ['DE', 'ドイツ', 'Germany'], ['ES', 'スペイン', 'Spain'],
  ['KR', '韓国', 'Korea'], ['CN', '中国', 'China'], ['TW', '台湾', 'Taiwan'], ['HK', '香港', 'Hong Kong'], ['TH', 'タイ', 'Thailand'], ['VN', 'ベトナム', 'Vietnam'], ['PH', 'フィリピン', 'Philippines'], ['ID', 'インドネシア', 'Indonesia'],
  ['MY', 'マレーシア', 'Malaysia'], ['SG', 'シンガポール', 'Singapore'], ['IN', 'インド', 'India'], ['AU', 'オーストラリア', 'Australia'], ['NZ', 'ニュージーランド', 'New Zealand'], ['CA', 'カナダ', 'Canada'], ['MX', 'メキシコ', 'Mexico'],
  ['BR', 'ブラジル', 'Brazil'], ['AR', 'アルゼンチン', 'Argentina'], ['RU', 'ロシア', 'Russia'], ['TR', 'トルコ', 'Türkiye'], ['SA', 'サウジアラビア', 'Saudi Arabia'], ['AE', 'アラブ首長国連邦', 'UAE'], ['NL', 'オランダ', 'Netherlands'],
  ['SE', 'スウェーデン', 'Sweden'], ['NO', 'ノルウェー', 'Norway'], ['FI', 'フィンランド', 'Finland'], ['PL', 'ポーランド', 'Poland'], ['PT', 'ポルトガル', 'Portugal'], ['CH', 'スイス', 'Switzerland'], ['AT', 'オーストリア', 'Austria'],
  ['BE', 'ベルギー', 'Belgium'], ['ZA', '南アフリカ', 'South Africa'], ['ZZ', 'その他', 'Other']];
const cName = cc => { const c = COUNTRIES.find(x => x[0] === cc) || COUNTRIES[COUNTRIES.length - 1]; return L(c[1], c[2]); };
const cFlag = cc => (cc && cc !== 'ZZ' ? `<img class="cf" src="https://flagcdn.com/w20/${cc.toLowerCase()}.png" width="20" height="15" alt="${esc(cc)}" loading="lazy">` : '<span class="cf">🌐</span>');
const guessCountry = () => { const n = (navigator.language || '').split('-'); if (n[1] && /^[A-Za-z]{2}$/.test(n[1]) && COUNTRIES.some(c => c[0] === n[1].toUpperCase())) return n[1].toUpperCase(); return ({ ja: 'JP', fr: 'FR', it: 'IT', de: 'DE', es: 'ES', ko: 'KR', zh: 'CN', ar: 'EG', pt: 'BR', ru: 'RU', th: 'TH', vi: 'VN', id: 'ID', tr: 'TR', nl: 'NL', pl: 'PL', sv: 'SE', en: 'US' })[n[0]] || 'ZZ'; };
let myCountry = store.get('danjiri-country', '') || guessCountry();

// 問い合わせ 1 回ごとにつなぐ
function rankAsk(msg, want) {
  return new Promise((res, rej) => {
    let ws; try { ws = new WebSocket(wsURL()); } catch (e) { rej(e); return; }
    const to = setTimeout(() => { try { ws.close(); } catch { } rej(new Error('timeout')); }, 9000);
    ws.onopen = () => ws.send(JSON.stringify(msg));
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } if (m.t === want) { clearTimeout(to); res(m); try { ws.close(); } catch { } } };
    ws.onerror = () => { clearTimeout(to); rej(new Error('ws')); };
  });
}
// ================= マイベスト（このブラウザに町ごとの自己ベストを残す） =================
const loadMB = () => { try { return JSON.parse(store.get('danjiri-mybest', '{}')) || {}; } catch { return {}; } };
function canvasShot(w, h, q = 0.72) {
  const src = renderer.domElement, c = document.createElement('canvas'); c.width = w; c.height = h;
  const sw = src.width, sh = src.height, k = Math.max(w / sw, h / sh), cw = w / k, ch = h / k;
  c.getContext('2d').drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, w, h);
  return c.toDataURL('image/jpeg', q);
}
// 自分のだんじりを近くから 1 枚撮る（くっつけた物ごと）
function danjiriShot(r) {
  try {
    const v = r.vis, sp = camera.position.clone(), sq = camera.quaternion.clone(), sf = camera.fov, a = v.yaw + 0.9;
    camera.fov = 40; camera.updateProjectionMatrix();
    camera.position.set(v.x + Math.sin(a) * 12.5, v.y + 5.2, v.z + Math.cos(a) * 12.5); camera.lookAt(v.x, v.y + 2.6, v.z);
    renderer.render(scene, camera);
    const url = canvasShot(320, 240, 0.7);
    camera.position.copy(sp); camera.quaternion.copy(sq); camera.fov = sf; camera.updateProjectionMatrix();
    return url;
  } catch { return null; }
}
function updateMyBest() {
  $('resBadge').classList.add('hidden');
  const mb = loadMB(), P = (mb[place] ||= {}), now = Date.now(), tod = night ? 'night' : 'day';
  const vals = { lap: player.finished ? player.finishTime / LAPS : 0, speed: stats.topSpeed * 3.6, drift: stats.bestDrift, stuck: stuckKg(player), smash: stats.smash, air: stats.maxAir };
  const up = [], gain = {}, prev = {};
  for (const [k] of RK_CATS) {
    const v = vals[k]; if (!(v > 0) || (k === 'lap' && v < 20)) continue;
    const cur = P[k], better = !cur || (k === 'lap' ? v < cur.val : v > cur.val);
    if (better) { gain[k] = cur ? (k === 'lap' ? cur.val / v - 1 : v / Math.max(0.01, cur.val) - 1) : null; prev[k] = cur ? cur.val : null; P[k] = { val: Math.round(v * 100) / 100, at: now, tod }; up.push(k); }
  }
  // 更新した部門ごとに、その時のだんじり（くっつけた物ごと）を写真と内訳で残す
  if (up.length) {
    const g = new Map(); for (const pc of player.stick.log || []) { const n = pc.name || '何か'; g.set(n, (g.get(n) || 0) + 1); }
    const items = [...g.entries()].sort((a, b) => b[1] - a[1]), n = player.stick.log ? player.stick.log.size : 0, kg = stuckKg(player), img = danjiriShot(player);
    for (const k of up) Object.assign(P[k], { img, items, n, kg });
  }
  try { store.set('danjiri-mybest', JSON.stringify(mb)); } catch { for (const k of up) delete P[k].img; try { store.set('danjiri-mybest', JSON.stringify(mb)); } catch { } }
  // 称号はいちばん優秀なものを 1 つだけ: 前より大きく伸びた部門を優先。初記録だけなら決まった順
  if (up.length) {
    const PRI = ['stuck', 'smash', 'lap', 'speed', 'drift', 'air'];
    const top = [...up].sort((a, b) => ((gain[b] ?? -1) - (gain[a] ?? -1)) || PRI.indexOf(a) - PRI.indexOf(b))[0];
    const pct = gain[top] != null ? `${L('自己ベスト', 'Personal best')} +${Math.round(gain[top] * 100)}%` : L('はじめての記録', 'First record');
    // 更新した部門ごとに、前の記録 → 今回（差）
    const diff = k => {
      const a = prev[k], b = P[k].val, f = RK_CATS.find(c => c[0] === k)[3];
      if (a == null) return `${L('はじめての記録', 'First record')} <b>${f(b)}</b>`;
      const d = k === 'lap' ? a - b : b - a;
      const ds = k === 'lap' ? `−${d.toFixed(2)}${L('秒', 's')}` : k === 'speed' ? `+${Math.round(d)} km/h` : k === 'stuck' ? `+${fmtKg(d)}` : k === 'smash' ? `+${Math.round(d)}` : `+${d.toFixed(k === 'air' ? 2 : 1)}${L('秒', 's')}`;
      return `${f(a)} → <b>${f(b)}</b> <span class="mb-up">（${ds}）</span>`;
    };
    const lines = up.map(k => `<div class="mb-line">${esc(catTitle(k))}　${diff(k)}</div>`).join('');
    $('resBadge').innerHTML = `<small>${L('称号獲得!', 'Title earned!')}</small><br><span class="rb-title">「${esc(catTitle(top))}」</span><br><small>${pct}</small><div class="mb-lines"><div class="mb-head">${L('マイベスト更新', 'Personal bests')}</div>${lines}</div>`;
    $('resBadge').classList.remove('hidden');
  }
}
let mbPlace = 'jp', mbCat = 'stuck';
function openMyBest(pl) { mbPlace = PLACES[pl] ? pl : 'jp'; $('mybest').classList.remove('hidden'); renderMyBest(); }
function renderMyBest() {
  $('mbPlace').innerHTML = PLACE_IDS.map(p => `<button data-p="${p}" class="${p === mbPlace ? 'sel' : ''}">${flagSvg(p)}${esc(pName(p))}</button>`).join('');
  $('mbPlace').querySelectorAll('button').forEach(b => b.onclick = () => { mbPlace = b.dataset.p; renderMyBest(); });
  ddify($('mbPlace'));
  const P = loadMB()[mbPlace] || {};
  const day = t => new Date(t).toLocaleDateString(LANG === 'en' ? 'en-US' : 'ja-JP');
  // 称号ごとのマス（押すとその時のだんじりを大きく）
  let h = '<div class="mb-grid">' + RK_CATS.map(([k, ja, en, f, tj, te, ic]) => `<div class="mb-cell${k === mbCat ? ' sel' : ''}" data-c="${k}">${P[k] && P[k].img ? `<img class="mb-th" src="${P[k].img}" alt="">` : ''}<small>${ic} ${L(tj, te)}</small><b>${P[k] ? f(P[k].val) : '—'}</b><small>${P[k] ? L(ja, en) + ' · ' + day(P[k].at) : L('まだ記録なし', 'No record')}</small></div>`).join('') + '</div>';
  const B = P[mbCat], cat = RK_CATS.find(c => c[0] === mbCat);
  h += `<div class="mb-dj"><div class="collHead">${L('ベストだんじり', 'Best danjiri')}: ${catTitle(mbCat)}</div>`;
  if (B) h += `${B.img ? `<img src="${B.img}" alt="">` : ''}<div><b style="color:var(--gold)">${cat[3](B.val)}</b>　${L('ひっつけたもの', 'Stuck')} <b>${B.n || 0}</b>${L('個', ' items')}・<b>${fmtKg(B.kg || 0)}</b></div><div class="mb-chips">${(B.items || []).map(([n, c]) => `<span>${esc(tn(n))} ×${c}</span>`).join('')}</div>`;
  else h += `<div class="collNone">${L('まだありません。この部門の記録を出そう!', 'Nothing yet. Set a record in this category!')}</div>`;
  $('mbBody').innerHTML = h + '</div>';
  $('mbBody').querySelectorAll('.mb-cell').forEach(c => c.onclick = () => { mbCat = c.dataset.c; renderMyBest(); });
}
// ================= 走りの記録（データ）と再生 =================
// 0.1 秒ごとに x, z, y(×10), 向き・傾き・前後の傾き(×100), 状態フラグ
const REC_DT = 0.1;
let rec = null, recT = 0;
function recordTick(dt) {
  if (!rec || !player || player.kind !== 'me') return;
  recT += dt;
  if (recT < REC_DT) return;
  recT -= REC_DT;
  if (rec.f.length >= 7 * 4000) return;
  const c = player.car;
  rec.f.push(Math.round(c.x * 10), Math.round(c.z * 10), Math.round(c.y * 10), Math.round(c.yaw * 100), Math.round(c.roll * 100), Math.round(c.pitch * 100), (c.air ? 1 : 0) | (c.crashT > 0 ? 2 : 0) | (c.boosting ? 4 : 0) | (c.drift ? 8 : 0) | (c.tipped ? 16 : 0));
}
// 試合リプレイ用: レース中の全員の動き（7 個の整数 × 0.1 秒ごと）
let match = null, matchT = 0;
const poseInts = c => [Math.round(c.x * 10), Math.round(c.z * 10), Math.round((c.y || 0) * 10), Math.round((c.yaw || 0) * 100), Math.round((c.roll || 0) * 100), Math.round((c.pitch || 0) * 100), (c.air ? 1 : 0) | (c.crashT > 0 ? 2 : 0) | (c.boosting ? 4 : 0) | (c.drift ? 8 : 0) | (c.tipped ? 16 : 0)];
function matchStart() {
  match = { place, night, tracks: racers.filter(r => !r.ghost && !r.hidden).map(r => ({ r, team: r.teamIdx, slot: r.slot, kind: r.kind, id: r.id, cpu: !!r.cpu, name: r.kind === 'me' ? (mode === 'online' ? myName : L('あなた', 'You')) : r.name, f: [] })) };
  matchT = 0;
}
function matchTick(dt) {
  if (!match) return;
  matchT += dt; if (matchT < REC_DT) return; matchT -= REC_DT;
  for (const tr of match.tracks) { if (tr.f.length >= 7 * 4000 || !racers.includes(tr.r)) continue; tr.f.push(...poseInts(tr.r.kind === 'net' ? tr.r.vis : tr.r.car)); }
}
const RP = { on: false, f: null, t: 0, r: null, name: '', list: [], match: false };
// 試合リプレイ: 全員のだんじりを記録どおりに動かす。◀ ▶ で追いかける相手を切り替え
function playMatch() {
  if (!match || !match.tracks.some(t => t.f.length > 14)) return;
  const M = match;
  if (SC.on) showcaseOpen(false);
  ['result', 'hud', 'touch', 'count', 'podium'].forEach(id => $(id).classList.add('hidden'));
  withLoading(() => {
    world.resetProps(); SIM.resetBreach(course); fx.clearSkids();
    clearRacers();
    RP.list = [];
    for (const tr of M.tracks) {
      if (tr.f.length < 14) continue;
      const r = makeRacer(tr.team, tr.slot ?? 1, tr.kind === 'me' ? 'me' : 'net', { id: tr.kind === 'me' ? undefined : tr.id, cpu: tr.cpu, name: tr.name });
      r.kind = 'net'; r.vis = netVis(); r.buf = []; r.replay = true; r.wasMe = tr.kind === 'me';
      racers.push(r); RP.list.push({ r, f: tr.f });
    }
    if (!RP.list.length) return;
    const me = RP.list.find(x => x.r.wasMe) || RP.list[0];
    player = me.r; RP.r = me.r; RP.f = me.f; finishRoster();
    RP.on = true; RP.match = true; RP.t = 0;
    replayPose(0);
    state = 'replay'; cam.ready = false;
    $('replayBar').classList.remove('hidden'); $('rpPrev').classList.remove('hidden'); $('rpNext').classList.remove('hidden'); rpLabel();
    AU.initAudio(); AU.startMusic(AU.now() + 0.2, 0, 'race', place === 'jp' ? 'jp' : place);
  });
}
function rpLabel() { setT($('rpName'), `${L('試合リプレイ', 'Match replay')}: ${RP.r.name}`); }
function rpPick(d) {
  if (!RP.match || !RP.list.length) return;
  const i = RP.list.findIndex(x => x.r === RP.r), n = RP.list[(i + d + RP.list.length) % RP.list.length];
  RP.r = n.r; RP.f = n.f; player = n.r; cam.ready = false; rpLabel();
}
async function playReplay(e, pl, tod, rec0) {
  let m; if (rec0) m = { rec: rec0 }; else try { m = await rankAsk({ t: 'rankrep', id: e.id }, 'rankrep'); } catch { return; }
  if (!m.rec || !m.rec.f) return;
  ['ranking', 'title', 'result', 'hud', 'touch', 'count'].forEach(id => $(id).classList.add('hidden'));
  withLoading(() => {
    loadStage(pl, tod === 'night');
    world.resetProps(); SIM.resetBreach(course); fx.clearSkids();
    clearRacers();
    const r = makeRacer(m.rec.team | 0, 1, 'net', { name: e.name });
    r.vis = netVis(); r.buf = []; r.replay = true;
    racers.push(r); player = r; finishRoster();
    RP.on = true; RP.f = m.rec.f; RP.t = 0; RP.r = r; RP.name = e.name;
    replayPose(0);
    state = 'replay'; cam.ready = false;
    $('replayBar').classList.remove('hidden'); setT($('rpName'), `${L('再生中', 'Replay')}: ${e.name}`);
    AU.initAudio(); AU.startMusic(AU.now() + 0.2, 0, 'race', pl === 'jp' ? 'jp' : pl);
  });
}
function replayPose(t) {
  if (RP.match) { let end = true; for (const x of RP.list) end = posePlay(x.f, x.r.vis, t) && end; return end; }
  return posePlay(RP.f, RP.r.vis, t);
}
function posePlay(f, v, t) {
  const n = f.length / 7, k = Math.min(n - 1.001, t / REC_DT), i = Math.floor(k), a = k - i;
  const g = (j, o) => f[(Math.min(n - 1, j)) * 7 + o];
  const lp = (o, s) => (g(i, o) + (g(i + 1, o) - g(i, o)) * a) / s;
  v.x = lp(0, 10); v.z = lp(1, 10); v.y = lp(2, 10);
  const y0 = g(i, 3) / 100, y1 = g(i + 1, 3) / 100; v.yaw = y0 + wrapA(y1 - y0) * a;
  v.roll = lp(4, 100); v.pitch = lp(5, 100);
  const dx = (g(i + 1, 0) - g(i, 0)) / 10 / REC_DT, dz = (g(i + 1, 1) - g(i, 1)) / 10 / REC_DT;
  v.vx = dx; v.vz = dz; v.speed = Math.hypot(dx, dz); v.vF = v.speed;
  const fl = g(i, 6); v.air = !!(fl & 1); v.crashT = fl & 2 ? 1 : 0; v.boosting = !!(fl & 4); v.drift = !!(fl & 8); v.tipped = !!(fl & 16);
  v.slip = v.drift ? 8 : 0;
  return k >= n - 1.01;
}
function replayTick(dt) {
  RP.t += dt;
  const end = replayPose(RP.t);
  for (const r of RP.match ? RP.list.map(x => x.r) : [RP.r]) { netBreach(r); hitProps(r); grabReach(r); snagSpans(r); carEffects(r, dt, camera.position); }
  const len = Math.max(...(RP.match ? RP.list.map(x => x.f.length) : [RP.f.length])) / 7;
  if (end && RP.t > len * REC_DT + 1.5) replayStop();
}
function replayStop() {
  if (!RP.on) return;
  RP.on = false; $('replayBar').classList.add('hidden'); AU.stopMusic();
  if (RP.match) {   // 試合リプレイは結果画面へ戻る
    RP.match = false; $('rpPrev').classList.add('hidden'); $('rpNext').classList.add('hidden');
    state = 'result'; $('result').classList.remove('hidden'); $('result').scrollTop = 0;
    return;
  }
  if (shareView) { const v = shareView; openShare(v.id); return; }
  toTitle(); openRanking(rkPlace);
}
// ゴールの瞬間の写真（320×180 の JPEG）
let lastPreview = null, wantPreview = false;
function grabPreview() {
  try {
    const src = renderer.domElement, c = document.createElement('canvas'); c.width = 320; c.height = 180;
    const sw = src.width, sh = src.height, k = Math.max(320 / sw, 180 / sh), w = 320 / k, h = 180 / k;
    c.getContext('2d').drawImage(src, (sw - w) / 2, (sh - h) / 2, w, h, 0, 0, 320, 180);
    lastPreview = c.toDataURL('image/jpeg', 0.72);   // （canvasShot と同じ切り抜き）
  } catch { lastPreview = null; }
}
function stuckKg(r) { let kg = 0; for (const pc of r.stick.log || []) kg += pc.kg || 10; return kg; }
// 積んだもの（だんじり表示用のデータ）
function djData() {
  const g = new Map(); for (const pc of player.stick.log || []) { const n = pc.name || '何か'; g.set(n, (g.get(n) || 0) + 1); }
  return { team: player.teamIdx, stuck: world.exportStuck(player.stick).slice(0, 80), items: [...g.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60) };
}
// ランキングの「だんじり表示」: その記録のだんじりだけを、積んだ物ごと組み直して 3D で回す
async function showRankDanjiri(e, pl) {
  let m; try { m = await rankAsk({ t: 'rankdj', id: e.id }, 'rankdj'); } catch { return; }
  if (m.dj) displayDj(m.dj, e, pl);
}
function displayDj(dj, e, pl) {
  ['ranking', 'title', 'result', 'hud', 'touch', 'count'].forEach(id => $(id).classList.add('hidden'));
  withLoading(() => {
    loadStage(pl, e.tod === 'night');
    world.resetProps(); SIM.resetBreach(course); fx.clearSkids();
    clearRacers();
    const r = makeRacer(dj.team | 0, 1, 'net', { name: e.name });
    r.vis = netVis(); Object.assign(r.vis, { x: r.car.x, y: r.car.y, z: r.car.z, yaw: r.car.yaw }); r.buf = [];
    racers.push(r); player = r; finishRoster(); updateVisual(r, 0, 0);
    world.importStuck(r.stick, dj.stuck);
    state = 'display'; AU.stopMusic();
    showcaseOpen(true); shareScName();
  });
}
// ================= 試合後のシェア: だんじりの写真（カード用）と積んだ物・走りを預けて URL をもらう =================
let resInfo = { rank: 0, n: 0 }, shareMade = null;
function shareReset(on) { shareMade = null; $('shareBox').classList.toggle('hidden', !on); $('shareOut').innerHTML = ''; $('shareBtn').disabled = false; $('shareBtn').classList.remove('hidden'); }
const shareName = () => (mode === 'online' ? myName : ($('nameIn')?.value.trim() || store.get('danjiri-name', '') || L('名無し', 'Anonymous'))).slice(0, 12);
// カード用 1200×630: 自分のだんじりを斜め前から撮って、名前と成績を重ねる
function shareCard(r, name) {
  const W = 1200, H = 630, v = r.vis, a = v.yaw + 0.75;
  const sp = camera.position.clone(), sq = camera.quaternion.clone(), sf = camera.fov, sa = camera.aspect, pr = renderer.getPixelRatio();
  let url = null;
  try {
    renderer.setPixelRatio(1); renderer.setSize(W, H, false);
    camera.fov = 34; camera.aspect = W / H; camera.updateProjectionMatrix();
    camera.position.set(v.x + Math.sin(a) * 15, v.y + 5.6, v.z + Math.cos(a) * 15); camera.lookAt(v.x - Math.cos(a) * 1.6, v.y + 3.2, v.z + Math.sin(a) * 1.6);
    const tag = r.tag; if (tag) tag.visible = false;
    const others = racers.filter(o => o !== r && o.D.group.visible); others.forEach(o => { o.D.group.visible = false; });   // カードは自分のだんじりだけ
    renderer.render(scene, camera);
    if (tag) tag.visible = true; others.forEach(o => { o.D.group.visible = true; });
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.drawImage(renderer.domElement, 0, 0, W, H);
    const gr = g.createLinearGradient(0, H * 0.55, 0, H); gr.addColorStop(0, 'rgba(10,6,24,0)'); gr.addColorStop(1, 'rgba(10,6,24,0.88)'); g.fillStyle = gr; g.fillRect(0, H * 0.55, W, H * 0.45);
    // ロゴ
    g.font = `900 34px ${FONT}`; const lw = g.measureText('だんじり疾走').width;
    g.fillStyle = 'rgba(18,12,36,0.85)'; g.beginPath(); g.roundRect(28, 26, lw + 44, 58, 29); g.fill();
    g.fillStyle = '#f2c14e'; g.textBaseline = 'middle'; g.fillText('だんじり疾走', 50, 56);
    // 名前と成績
    g.fillStyle = r.team.css; g.fillRect(40, H - 168, 12, 128);
    g.textBaseline = 'alphabetic'; g.fillStyle = '#fff'; g.font = `900 64px ${FONT}`; g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,0.5)';
    const nm = `${name} のだんじり`; g.strokeText(nm, 72, H - 104, W - 110); g.fillText(nm, 72, H - 104, W - 110);
    const n = r.stick.log ? r.stick.log.size : 0;
    const bits = [resInfo.rank ? `${pName(place)} ${resInfo.rank}位` : pName(place), n ? `ひっつけ ${n}個・${fmtKg(stuckKg(r))}` : '', stats.smash ? `破壊 ${stats.smash}` : '', `最高 ${Math.round(stats.topSpeed * 3.6)}km/h`].filter(Boolean);
    g.font = `700 32px 'Zen Kaku Gothic New', sans-serif`; g.fillStyle = '#ffe9a8'; g.fillText(bits.join('　'), 74, H - 50, W - 110);
    for (const q of [0.82, 0.7, 0.58, 0.46]) { url = c.toDataURL('image/jpeg', q); if (url.length < 380000) break; }
  } catch (e) { url = null; }
  renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight);
  camera.position.copy(sp); camera.quaternion.copy(sq); camera.fov = sf; camera.aspect = sa; camera.updateProjectionMatrix();
  return url;
}
async function makeShare() {
  if (shareMade) return;
  const btn = $('shareBtn'); btn.disabled = true; setT(btn, L('つくっています…', 'Creating…'));
  const name = shareName(), img = shareCard(player, name);
  const fail = t => { btn.disabled = false; setT(btn, L('📣 だんじりをシェア', '📣 Share my danjiri')); $('shareOut').textContent = t; };
  if (!img) { fail(L('写真が撮れませんでした', 'Could not take the picture')); return; }
  const kg = stuckKg(player), items = player.stick.log ? player.stick.log.size : 0;
  let m;
  try {
    m = await rankAsk({ t: 'share', name, place, tod: night ? 'night' : 'day', laps: LAPS, img, dj: djData(), rec: rec && rec.f.length >= 70 ? { team: player.teamIdx, f: rec.f } : null,
      st: { rank: resInfo.rank, n: resInfo.n, time: player.finished ? player.finishTime : 0, kg, items, smash: stats.smash, speed: stats.topSpeed * 3.6, drift: stats.bestDrift, air: stats.maxAir } }, 'shareres');
  } catch { fail(L('つながりませんでした。もう一度どうぞ', 'Could not connect. Try again')); return; }
  if (!m.ok) { fail(m.err === 'wait' ? L('少し待ってからもう一度どうぞ', 'Wait a moment and try again') : L('作れませんでした', 'Could not create it')); return; }
  const url = `${location.origin}${BASE}p/${m.id}`;
  shareMade = url; btn.classList.add('hidden');
  const text = L(`だんじり疾走「${pName(place)}」${resInfo.rank ? resInfo.rank + '位! ' : ''}${items ? `ひっつけた物 ${items}個（${fmtKg(kg)}）` : ''} #だんじり疾走`, `Danjiri Dash — ${pName(place)}${resInfo.rank ? ' #' + resInfo.rank : ''}${items ? `, stuck ${items} things` : ''} #DanjiriDash`);
  $('shareOut').innerHTML = `<img src="${img}" alt=""><input readonly value="${esc(url)}">${shareButtons(url, text)}`;
  $('shareOut').querySelector('input').onclick = e => e.target.select();
}
// シェアの URL（/p/ID）から来た時: そのだんじりを積んだ物ごと 3D で見せる
let shareView = null;
async function openShare(id) {
  let m; try { m = await rankAsk({ t: 'shareget', id }, 'shareget'); } catch { return; }
  const sh = m.sh; if (!sh) { setURL(homeURL()); return; }
  shareView = { id, sh };
  displayDj(sh.dj, { name: sh.name, tod: sh.tod }, sh.place);
  const s = sh.st, bits = [s.rank ? L(`${pName(sh.place)} ${s.rank}位`, `${pName(sh.place)} #${s.rank}`) : pName(sh.place), s.items ? L(`ひっつけた物 ${s.items}個（${fmtKg(s.kg)}）`, `Stuck ${s.items} (${fmtKg(s.kg)})`) : '', s.smash ? L(`壊した数 ${s.smash}`, `Smashed ${s.smash}`) : '', s.speed ? L(`最高 ${s.speed}km/h`, `Top ${s.speed} km/h`) : ''].filter(Boolean);
  $('scShareInfo').innerHTML = `<b>${esc(sh.name)}${L(' のだんじり', "'s danjiri")}</b><small>${esc(bits.join(' ・ '))}</small>`;
  $('scSharePlay').classList.toggle('hidden', !sh.rec);
  const it = sh.dj?.items || [];
  $('scShareItems').classList.toggle('hidden', !it.length);
  shareScName();
  $('scMenu').classList.add('hidden'); $('scShare').classList.remove('hidden'); scBackIcon(true);
  { const b = $('scShareInfo').querySelector('b'), w = Math.min(innerWidth - 32 - 112, 460), n = [...b.textContent].length; b.style.fontSize = Math.max(10, Math.min(18, Math.floor(w / (n * 1.02)))) + 'px'; }   // 名前が長い時は文字を小さく（1 文字ほぼ 1em）   // 名前が長い時は文字を小さく
  document.querySelector('#showcase .sc-hint').classList.add('hidden');   // 上の札とかぶるので操作の説明は出さない
  document.querySelector('#showcase .sc-bar').classList.add('hidden');   // 下の欄も出さない（トップへは ☰ から）
}
// 下の名前の欄は、預けた時の数を出す（組み直しただんじりには数の記録がないので）
function shareScName() { const v = shareView; if (!v) return; const s = v.sh.st; $('scName').innerHTML = `${swatch(TEAMS[v.sh.dj.team | 0])}${esc(v.sh.name)}<small>${L('ひっつけたもの', 'Stuck')} ${s.items}${L('個', '')} · ${fmtKg(s.kg)}</small>`; }
// ひっついたもの（別ウィンドウ）: 部品ごとの絵と個数。押すとその部品に寄って 3D で見せる
function openItemsWin() {
  const v = shareView; if (!v || !player) return;
  const s = v.sh.st, items = v.sh.dj?.items || [];
  setT($('itemsTitle'), L(`🧲 ${v.sh.name} のひっついたもの`, `🧲 ${v.sh.name}'s haul`));
  let html = player.stick.log?.size ? collectedHTML(player) : '';
  // 3D に組み直せなかった分（だんじりに載せたのは 80 個まで）は名前と数だけ
  const shown = new Map(); for (const g of player.stick.log?.size ? collGroups : []) shown.set(g.name, g.n);
  const rest = items.map(([n, c]) => [n, c - (shown.get(n) || 0)]).filter(x => x[1] > 0);
  if (rest.length) html += `<div class="collNone" style="margin-top:6px">${L('ほかにも', 'Also')}</div><div class="mb-chips">${rest.map(([n, c]) => `<span>${esc(tn(n))} ×${c}</span>`).join('')}</div>`;
  if (!html) html = `<div class="collNone">${L('なし', 'None')}</div>`;
  $('itemsBody').innerHTML = `<div class="collNone">${L('合計', 'Total')} <b>${s.items}</b>${L('個', '')}・<b>${fmtKg(s.kg)}</b></div>` + html;
  $('itemsBody').querySelectorAll('.collHead').forEach(e => e.remove());
  $('itemsBody').querySelectorAll('.ci').forEach((el, i) => el.onclick = () => { const g = collGroups[i]; if (!g) return; $('itemsWin').classList.add('hidden'); SC.focus = g.pc; SC.dist = 7; SC.auto = true; });
  $('itemsNote').classList.toggle('hidden', !player.stick.log?.size);
  $('itemsWin').classList.remove('hidden'); $('itemsWin').scrollTop = 0;
}
// その試合の記録のまとめ（別ウィンドウ）
function openSummaryWin() {
  const v = shareView; if (!v) return;
  const sh = v.sh, s = sh.st, date = new Date(sh.at * 1000).toLocaleString(LANG === 'en' ? 'en-US' : 'ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  setT($('itemsTitle'), L(`📊 ${sh.name} の記録`, `📊 ${sh.name}'s record`));
  const cell = (k, v) => `<div>${k}<b>${v}</b></div>`;
  $('itemsBody').innerHTML = `<div class="collNone">${esc(pName(sh.place))} · ${sh.tod === 'night' ? L('夜', 'Night') : L('昼', 'Day')} · ${sh.laps}${L('周', ' laps')} · ${esc(date)}</div><div class="stats">`
    + cell(L('順位', 'Place'), s.rank ? (s.n ? L(`${s.n}台中 ${s.rank}位`, `#${s.rank} of ${s.n}`) : L(`${s.rank}位`, `#${s.rank}`)) : '—')
    + cell(L('タイム', 'Time'), s.time ? fmt(s.time) : L('ゴールならず', 'DNF'))
    + cell(L('最高速度', 'Top speed'), `${s.speed}km/h`)
    + cell(L('最長やりまわし', 'Longest drift'), `${(+s.drift).toFixed(1)}${L('秒', 's')}`)
    + cell(L('最高ジャンプ', 'Longest air'), `${(+s.air).toFixed(2)}${L('秒', 's')}`)
    + cell(L('壊したもの', 'Smashed'), s.smash)
    + cell(L('ひっつけたもの', 'Stuck'), `${s.items}${L('個', '')}・${fmtKg(s.kg)}`)
    + `</div>`;
  $('itemsNote').classList.add('hidden');
  $('itemsWin').classList.remove('hidden'); $('itemsWin').scrollTop = 0;
}
// 下の戻るボタンはアイコンだけ（🏠 タイトルへ / ↩ 戻る）
function scBackIcon(home) { const b = $('scBack'), t = home ? L('タイトルへ', 'Title') : L('戻る', 'Back'); b.textContent = home ? '🏠' : '↩'; b.title = t; b.setAttribute('aria-label', t); }
function shareClose() { if (!shareView) return; shareView = null; $('itemsWin').classList.add('hidden'); $('scShare').classList.add('hidden'); document.querySelector('#showcase .sc-hint').classList.remove('hidden'); document.querySelector('#showcase .sc-bar').classList.remove('hidden'); scBackIcon(false); setURL(homeURL()); }
// 結果画面の登録フォーム
// ランクインできそうな時だけ登録フォームを出す（今のランキングと比べる。30 位以内か、表がまだ埋まっていない部門があれば）
const RK_LIMITS = { lap: [22, 600, true], speed: [1, 160], drift: [0.3, 15], stuck: [1, 2e7], smash: [1, 3000], air: [0.2, 5] };
async function showRankForm() {
  const f = $('rankForm'); f.classList.add('hidden');
  const st = { place, tod: night ? 'night' : 'day', laps: LAPS, time: player.finished ? player.finishTime : 0, speed: stats.topSpeed * 3.6, drift: stats.bestDrift, stuck: stuckKg(player), smash: stats.smash, air: stats.maxAir };
  const vals = { lap: st.time > 0 ? st.time / st.laps : 0, speed: st.speed, drift: st.drift, stuck: st.stuck, smash: st.smash, air: st.air };
  const shownFor = state;
  let m; try { m = await rankAsk({ t: 'ranks', place: st.place }, 'ranks'); } catch { return; }
  if (state !== shownFor || $('result').classList.contains('hidden') && $('podium').classList.contains('hidden')) return;
  const would = [];
  for (const [k, [lo, hi, asc]] of Object.entries(RK_LIMITS)) {
    const v = vals[k]; if (!(v >= lo && v <= hi)) continue;
    const list = m.cats?.[k] || [], n = list.filter(e => (asc ? e.val <= v : e.val >= v)).length + 1;
    if (n <= 30) would.push([k, n]);
  }
  if (!would.length) return;   // ランク外: フォームは出さない
  would.sort((a, b) => a[1] - b[1]);
  f.innerHTML = `<div class="rf-title">🏆 ${L('ランキングに登録', 'Submit to the rankings')}　<small>${esc(pName(place))}</small></div>
    <div class="rf-would">${L('ランクイン見込み', 'You can rank')}: ${would.slice(0, 3).map(([k, n]) => `${esc(catTitle(k))} ${L(`${n}位`, `#${n}`)}`).join('・')}</div>
    <img src="${lastPreview || ''}" alt="">
    <div class="rf-row"><input id="rfName" maxlength="12" value="${esc(myName || '')}" placeholder="${L('名前', 'Name')}"><select id="rfCountry">${COUNTRIES.map(c => `<option value="${c[0]}"${c[0] === myCountry ? ' selected' : ''}>${esc(L(c[1], c[2]))}</option>`).join('')}</select></div>
    <input id="rfComment" maxlength="60" placeholder="${L('ひとこと（60字まで）', 'Comment (up to 60 chars)')}">
    <button class="go" id="rfSend">${L('登録する', 'Submit')}</button><div class="rf-msg" id="rfMsg"></div>`;
  f.classList.remove('hidden');
  $('rfSend').onclick = async () => {
    const btn = $('rfSend'), msg = $('rfMsg');
    const name = $('rfName').value.trim().slice(0, 12) || L('名無し', 'Anonymous');
    myName = name; myCountry = $('rfCountry').value; store.set('danjiri-name', name); store.set('danjiri-country', myCountry);
    btn.disabled = true; msg.textContent = L('送信中…', 'Sending…');
    try {
      const r = await rankAsk({ t: 'rank', ...st, name, country: myCountry, comment: $('rfComment').value.trim().slice(0, 60), img: lastPreview, rec: rec && rec.f.length >= 70 ? { team: player.teamIdx, f: rec.f } : null, dj: djData() }, 'rankres');
      if (!r.ok) { msg.textContent = r.err === 'wait' ? L('少し待ってからもう一度どうぞ', 'Please wait a moment and try again') : L('登録できませんでした', 'Could not submit'); btn.disabled = false; return; }
      const got = Object.entries(r.got || {}).sort((a, b) => a[1] - b[1]).map(([k, n]) => `${esc(catTitle(k))} ${L(`${n}位`, `#${n}`)}`);
      msg.innerHTML = got.length ? `${L('ランクイン!', 'Ranked!')}<br>` + got.join('<br>') : L('登録しました（今回はランク外）', 'Submitted (not in the top 30 this time)');
      // 自分の記録を共有（いちばん良い順位の部門）
      const bestCat = Object.entries(r.got || {}).sort((a, b) => a[1] - b[1])[0];
      if (bestCat) { const sh = document.createElement('div'); sh.className = 'rk-share'; sh.style.gridColumn = '1 / -1'; sh.innerHTML = shareButtons(recURL(r.id), L(`だんじり疾走「${pName(st.place)}」${catName(bestCat[0])}ランキングで ${bestCat[1]}位になった!`, `I placed #${bestCat[1]} in ${catName(bestCat[0])} at ${pName(st.place)} in Danjiri Dash!`)); $('rankForm').appendChild(sh); }
      btn.textContent = L('登録済み', 'Done');
    } catch { msg.textContent = L('通信できませんでした', 'Network error'); btn.disabled = false; }
  };
}
// 共有: その記録（またはその町・部門の表）を開く URL
const rankURL = (pl, cat, id) => `${location.origin}${BASE}?rank=${pl}&cat=${cat}${id ? '&id=' + id : ''}`;
// 見ているランキング/記録をアドレスバーにも反映（そのままコピーで共有できる）
const setURL = u => { try { history.replaceState(null, '', u); } catch { } };
const homeURL = () => BASE + (location.search.includes('debug') ? '?debug' : '');
const recURL = id => `${location.origin}${BASE}?r=${id}`;   // プレイ記録ごとの URL
const catName = k => { const c = RK_CATS.find(x => x[0] === k); return c ? L(c[1], c[2]) : k; };
const pName = p => (LANG === 'en' ? PLACE_EN[p] : PLACES[p]);
function shareButtons(url, text) {
  const id = 'sh' + Math.random().toString(36).slice(2, 8);
  setTimeout(() => {
    const b = document.getElementById(id); if (!b) return;
    b.onclick = async () => {
      const m = document.getElementById(id + 'm');
      if (navigator.share) { try { await navigator.share({ title: L('だんじり疾走', 'Danjiri Dash'), text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
      try { await navigator.clipboard.writeText(`${text} ${url}`); m.textContent = L('URL をコピーしました', 'Link copied'); }
      catch { window.prompt(L('この URL をコピーしてね', 'Copy this link'), url); }
    };
  });
  const x = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  return `<button class="share-btn" id="${id}">🔗 ${L('共有', 'Share')}</button><a class="share-btn x" href="${x}" target="_blank" rel="noopener noreferrer">𝕏 ${L('ポスト', 'Post')}</a><div class="share-msg" id="${id}m"></div>`;
}
// ランキングを見る画面
let rkPlace = 'jp', rkCat = 'lap', rkData = null, rkOpenId = null;
const flagSvg = p => { const b = document.querySelector(`#placeSel button[data-p="${p}"] svg`); return b ? b.outerHTML : ''; };
function openRanking(pl) { rkPlace = PLACES[pl] ? pl : 'jp'; $('rkDetail').classList.add('hidden'); $('ranking').classList.remove('hidden'); renderRkTabs(); loadRk(); }
function renderRkTabs() {
  $('rkPlace').innerHTML = PLACE_IDS.map(p => `<button data-p="${p}" class="${p === rkPlace ? 'sel' : ''}">${flagSvg(p)}${esc(LANG === 'en' ? PLACE_EN[p] : PLACES[p])}</button>`).join('');
  $('rkCat').innerHTML = RK_CATS.map(([k, ja, en, , tj, te, ic]) => `<button data-c="${k}" class="${k === rkCat ? 'sel' : ''}">${ic} ${L(tj, te)}<small style="display:block;font-size:10px;opacity:.75">${L(ja, en)}</small></button>`).join('');
  $('rkPlace').querySelectorAll('button').forEach(b => b.onclick = () => { rkPlace = b.dataset.p; renderRkTabs(); loadRk(); });
  ddify($('rkPlace'));
  $('rkCat').querySelectorAll('button').forEach(b => b.onclick = () => { rkCat = b.dataset.c; renderRkTabs(); renderRkList(); });
  const selTab = $('rkCat').querySelector('.sel'); if (selTab) selTab.scrollIntoView({ block: 'nearest', inline: 'center' });
  if (!rkOpenId) setURL(rankURL(rkPlace, rkCat));
  $('rkShareBar').innerHTML = shareButtons(rankURL(rkPlace, rkCat), L(`だんじり疾走「${pName(rkPlace)}」${catName(rkCat)}ランキング`, `Danjiri Dash — ${pName(rkPlace)} ${catName(rkCat)} ranking`));
}
async function loadRk() {
  rkData = null; $('rkList').textContent = L('読み込み中…', 'Loading…');
  const want = rkPlace;
  try { const m = await rankAsk({ t: 'ranks', place: want }, 'ranks'); if (want === rkPlace) { rkData = m; renderRkList(); } }
  catch { $('rkList').textContent = L('読み込めませんでした', 'Could not load the rankings'); }
}
function renderRkList() {
  if (!rkData) return;
  const list = rkData.cats?.[rkCat] || [], cat = RK_CATS.find(c => c[0] === rkCat);
  if (!list.length) { $('rkList').innerHTML = `<div class="collNone" style="text-align:center;padding:30px 0">${L('まだ記録がありません。一番乗りを狙おう!', 'No records yet. Be the first!')}</div>`; return; }
  $('rkList').innerHTML = list.map((e, i) => `<div class="rk-row" data-i="${i}"><span class="rk-n">${i + 1}</span>${cFlag(e.country)}<div><b>${esc(e.name)}</b>${e.img ? ' 📷' : ''}<small>${esc(e.comment || '')}</small></div><span class="rk-v">${cat[3](e.val)}</span></div>`).join('');
  $('rkList').querySelectorAll('.rk-row').forEach(row => row.onclick = () => showRkDetail(list[+row.dataset.i], cat, +row.dataset.i + 1));
  // 共有 URL から開いた時は、その記録を見せる
  if (rkOpenId) { const i = list.findIndex(e => e.id === rkOpenId); rkOpenId = null; if (i >= 0) showRkDetail(list[i], cat, i + 1); }
}
// この記録が載っている部門と順位（タップでその部門に切り替え）
function recRanks(id) {
  const out = [];
  for (const c of RK_CATS) { const list = rkData?.cats?.[c[0]] || [], i = list.findIndex(x => x.id === id); if (i >= 0) out.push(`<button data-c="${c[0]}" class="${c[0] === rkCat ? 'sel' : ''}">${c[6]} ${esc(L(c[4], c[5]))} <b>${i + 1}${L('位', '')}</b> <small>${c[3](list[i].val)}</small></button>`); }
  return out.join('');
}
function showRkDetail(e, cat, n) {
  const d = $('rkDetail');
  const date = new Date(e.at * 1000).toLocaleDateString(LANG === 'en' ? 'en-US' : 'ja-JP');
  d.innerHTML = `<img class="pv" id="rkImg" alt="">
    ${n === 1 ? `<div style="font-family:'Dela Gothic One',sans-serif;color:var(--gold);font-size:18px">👑 ${catTitle(rkCat)}</div>` : ''}
    <div class="rk-dn">${n}. ${esc(e.name)}</div>
    <div>${cFlag(e.country)} ${esc(cName(e.country))}　<b style="color:var(--gold)">${L(cat[1], cat[2])}: ${cat[3](e.val)}</b></div>
    <div class="collNone">${esc(LANG === 'en' ? PLACE_EN[rkPlace] : PLACES[rkPlace])} · ${e.tod === 'night' ? L('夜', 'Night') : L('昼', 'Day')} · ${e.laps}${L('周', ' laps')} · ${date}</div>
    ${e.comment ? `<div class="rk-dc">「${esc(e.comment)}」</div>` : ''}
    <div class="rk-actions">${e.rep ? `<button class="go" id="rkPlay">▶ ${L('走りを再生', 'Play the run')}</button>` : ''}${e.dj ? `<button class="go ghost" id="rkItems">🧲 ${L('積んだもの', 'Haul')}</button><button class="go online" id="rkDj">🏮 ${L('だんじり表示', 'View danjiri')}</button>` : ''}</div>
    <div class="rk-recs">${recRanks(e.id)}</div>
    <div class="mb-chips" id="rkItemList"></div>
    <div class="rk-share">${shareButtons(recURL(e.id), L(`だんじり疾走「${pName(rkPlace)}」${catName(rkCat)} ${n}位 ${e.name}（${cat[3](e.val)}）`, `Danjiri Dash — ${pName(rkPlace)} ${catName(rkCat)} #${n} ${e.name} (${cat[3](e.val)})`))}</div>
    <button class="go ghost" id="rkBack">${L('もどる', 'Back')}</button>`;
  d.classList.remove('hidden');
  setURL(recURL(e.id));
  d.querySelectorAll('.rk-recs button').forEach(b => b.onclick = () => { const c = RK_CATS.find(x => x[0] === b.dataset.c), list = rkData?.cats?.[c[0]] || [], i = list.findIndex(x => x.id === e.id); if (i < 0) return; rkCat = c[0]; renderRkTabs(); renderRkList(); showRkDetail(list[i], c, i + 1); });
  $('rkBack').onclick = () => { d.classList.add('hidden'); setURL(rankURL(rkPlace, rkCat)); };
  if (e.rep) $('rkPlay').onclick = () => { d.classList.add('hidden'); playReplay(e, rkPlace, e.tod); };
  if (e.dj) {
    $('rkDj').onclick = () => { d.classList.add('hidden'); showRankDanjiri(e, rkPlace); };
    $('rkItems').onclick = async () => { const el = $('rkItemList'); el.textContent = L('読み込み中…', 'Loading…'); try { const m = await rankAsk({ t: 'rankdj', id: e.id }, 'rankdj'); const it = m.dj?.items || []; el.innerHTML = it.length ? it.map(([n, c]) => `<span>${esc(tn(n))} ×${c}</span>`).join('') : L('なし', 'None'); } catch { el.textContent = L('読み込めませんでした', 'Could not load'); } };
  }
  if (e.img) rankAsk({ t: 'rankimg', id: e.id }, 'rankimg').then(m => { const im = $('rkImg'); if (m.data && im) im.src = m.data; }).catch(() => { });
  else $('rkImg').style.display = 'none';
}

// ================= オンライン =================
const NET = { ws: null, id: 0, room: null, offset: 0, bestRtt: 1e9, raceKey: null, lastSend: 0, best: [], pingTimer: 0, failed: false };
let myName = store.get('danjiri-name', '');
const serverNow = () => Date.now() + NET.offset;
// トップ画面: オンラインの人数（待っている人・レース中の人）を数秒ごとに聞く
const OC = { ws: null, timer: 0 };
function onlineCountTick() {
  const el = $('onlineNow');
  if (state !== 'title') { if (OC.ws) { try { OC.ws.close(); } catch { } OC.ws = null; } return; }
  if (OC.ws && OC.ws.readyState === 1) { OC.ws.send(JSON.stringify({ t: 'stats' })); return; }
  if (OC.ws) return;
  try {
    const ws = new WebSocket(wsURL());
    OC.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ t: 'stats' }));
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } if (m.t === 'stats') el.innerHTML = `<span class="dot"></span>${L('待ち', 'waiting')} ${m.wait}・${L('レース中', 'racing')} ${m.play}`; };
    ws.onclose = () => { if (OC.ws === ws) OC.ws = null; };
    ws.onerror = () => { el.textContent = ''; };
  } catch { }
}
setInterval(onlineCountTick, 5000);
function netConnect() {
  NET.failed = false; NET.bestRtt = 1e9;
  let ws;
  try { ws = new WebSocket(wsURL()); }
  catch { NET.failed = true; renderLobby(); return; }
  NET.ws = ws;
  ws.onopen = () => {
    NET.retry = 0; netPing(); NET.pingTimer = setInterval(netPing, 4000);
    // 最初の 1 回はレース中の部屋があるか聞く（あれば ゴースト / 観戦 / 待つ を選んでもらう）
    if (NET.how) netJoin(['pick', 'ghost', 'new'].includes(NET.how) ? 'auto' : NET.how, NET.joinRoom); else { NET.how = 'pick'; netSend({ t: 'peek' }); setTimeout(() => { if (NET.ws === ws && NET.how === 'pick' && !NET.choice) netJoin('auto'); }, 2500); }   // 返事がなければふつうに参加
  };
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } onNet(m); };
  ws.onclose = () => {
    clearInterval(NET.pingTimer);
    if (NET.ws !== ws) return;
    NET.ws = null;
    if (mode !== 'online') return;
    // 切れたら待合室へ戻って自動でつなぎ直す（サーバーの入れ替え・電波の途切れ）
    NET.retry = (NET.retry || 0) + 1;
    NET.room = null; NET.raceKey = null; NET.ghost = false; $('watchBar').classList.add('hidden');
    if (state !== 'lobby') {
      AU.stopMusic(); clearRacers(); buildSolo();
      ['hud', 'touch', 'result', 'pause', 'count'].forEach(id => $(id).classList.add('hidden'));
      $('lobby').classList.remove('hidden'); state = 'lobby';
    }
    if (NET.retry > 6) { NET.failed = true; renderLobby(); return; }
    setT($('lobbyStatus'), L('接続が切れました。つなぎ直しています…', 'Disconnected. Reconnecting…'));
    setTimeout(() => { if (mode === 'online' && !NET.ws) netConnect(); }, 1200 * NET.retry);
  };
}
// ひとことチャット（試合後・待合室）
NET.chat = []; NET.chatRoom = null;
function onChat(m) {
  if (mode !== 'online') return;
  NET.chat.push(m); if (NET.chat.length > 30) NET.chat.shift();
  renderChat();
  if (m.id !== NET.id && (state === 'result' || state === 'lobby')) AU.sfx('join');
}
function renderChat() {
  // 発言者のアイコン（カスタムで設定した画像）を名前の前に小さく
  const ic = c => { const u = c.id === NET.id ? myIcon : NET.icons?.[c.id]; return u && u.startsWith('data:image/') ? `<img class="cm-ic" src="${u}" alt="">` : `<span class="cm-ic cm-none" style="background:${TEAMS[c.team]?.css || '#888'}"></span>`; };
  const html = NET.chat.length ? NET.chat.map(c => `<div class="cm ${c.id === NET.id ? 'me' : ''}">${ic(c)}<b style="color:${TEAMS[c.team]?.css || '#fff'}">${esc(c.name)}</b>${esc(c.text)}</div>`).join('') : `<div class="none">${L('ひとこと送ってみよう', 'Say hi!')}</div>`;
  for (const k of ['res', 'lobby']) { const el = $(k + 'ChatLog'); if (el) { el.innerHTML = html; el.scrollTop = el.scrollHeight; } }
}
function showChat(on) { on = on && NET.hasChat; for (const k of ['res', 'lobby']) $(k + 'Chat').classList.toggle('hidden', !on); if (on) renderChat(); }
const STAMP_EN = { 'おつかれ!': 'GG, well run!', 'ナイス!': 'Nice!', 'もう一回!': 'One more!', 'やりまわし最高!': 'Sweet drift!' };
function sendChat(text) { text = String(text || '').trim().slice(0, 40); if (text) netSend({ t: 'chat', text }); }
function netJoin(how, room) {
  NET.how = how; NET.joinRoom = room; NET.choice = null; $('lobbyChoice').classList.add('hidden');
  netSend({ t: 'join', name: myName, team: selTeam, v: 3, how, room }); netSend({ t: 'hold', on: holdWait });
  netSend({ t: 'icon', data: myIcon, txt: myText, dj: myFinish, fm: myForm, cw: myCrew, ty: myType, fl: myFlag });
  renderLobby();
}
// 部屋えらび: 部屋番号・状況・人数を見て入る
let roomPoll = 0;
function roomsOpen(on) {
  $('roomPick').classList.toggle('hidden', !on);
  clearInterval(roomPoll);
  if (on) { netSend({ t: 'rooms' }); roomPoll = setInterval(() => { if (state === 'lobby' && !$('roomPick').classList.contains('hidden')) netSend({ t: 'rooms' }); else clearInterval(roomPoll); }, 3000); }
}
function renderRooms(m) {
  const now = m.now, el = $('roomList');
  if (!m.list.length) { el.innerHTML = `<div class="collNone" style="text-align:center;padding:8px">${L('いま部屋はありません', 'No rooms right now')}</div>`; return; }
  el.innerHTML = m.list.map(r => {
    const [mp, mt] = r.stage.split('-'), town = PLACES[mp] ? placeName(mp, mt === 'night') : '';
    const st = r.phase === 'race' ? `🏁 ${L('レース中', 'Racing')} ${Math.max(0, Math.round((now - r.startAt) / 1000))}${L('秒', 's')}${town ? ' · ' + town : ''}`
      : r.phase === 'result' ? `🏆 ${L('結果発表中', 'Results')}` : r.hold ? `⏸ ${L('だれか待ち', 'Waiting for players')}` : `⏳ ${L('出発まで', 'Starts in')} ${Math.max(0, Math.ceil((r.phaseEnd - now) / 1000))}${L('秒', 's')}`;
    const full = r.n >= r.max, cur = r.room === m.me;
    const btns = cur ? `<small style="color:var(--gold)">${L('ここにいます', 'You are here')}</small>` : full ? `<small>${L('満員', 'Full')}</small>`
      : r.phase === 'race' ? `<button data-h="watch" data-r="${r.room}">👀</button><button data-h="ghost" data-r="${r.room}">👻</button><button data-h="room" data-r="${r.room}">${L('待つ', 'Wait')}</button>`
      : `<button data-h="room" data-r="${r.room}">${L('入る', 'Join')}</button>`;
    return `<div class="rp-row ${cur ? 'cur' : ''}"><span class="rp-no">${L(`部屋${r.room}`, `#${r.room}`)}</span><span class="rp-st">${st}<br><small>${r.n}/${r.max}${L('人', '')} ${esc(r.names.join('・'))}</small></span>${btns}</div>`;
  }).join('');
  el.querySelectorAll('button[data-h]').forEach(b => b.onclick = () => { roomsOpen(false); NET.raceKey = null; netJoin(b.dataset.h, +b.dataset.r); });
}
function onPeek(m) {
  if (mode !== 'online' || NET.how !== 'pick') return;
  const r = m.races && m.races[0];
  if (!r) { netJoin('auto'); return; }
  NET.choice = r;
  const [mp, mt] = String(r.stage || '').split('-');
  const sec = Math.max(0, Math.round((m.now - r.startAt) / 1000));
  setT($('lobbyStatus'), L(`部屋 ${r.room} はレース中です（${r.n}人・${PLACES[mp] ? placeName(mp, mt === 'night') : ''}・${sec}秒経過）`, `Room ${r.room} is racing (${r.n} player${r.n > 1 ? 's' : ''}, ${PLACES[mp] ? placeName(mp, mt === 'night') : ''}, ${sec}s in)`));
  $('lobbyChoice').classList.remove('hidden'); $('lobbyList').innerHTML = ''; setT($('lobbyCount'), '');
  $('lcGhost').onclick = () => netJoin('ghost', r.room);
  $('lcWatch').onclick = () => netJoin('watch', r.room);
  $('lcWait').onclick = () => netJoin('wait', r.room);
}
function netSend(o) { if (NET.ws && NET.ws.readyState === 1) NET.ws.send(JSON.stringify(o)); }
function netPing() { netSend({ t: 'ping', c: Date.now() }); }
function netLeave() { clearInterval(NET.pingTimer); if (NET.ws) { const w = NET.ws; NET.ws = null; try { w.close(); } catch { } } NET.room = null; NET.raceKey = null; }
function onNet(m) {
  if (m.t === 'hello') { NET.hasChat = !!m.chat; NET.id = m.id; NET.offset = m.now - Date.now(); NET.best = m.best || []; }
  else if (m.t === 'pong') { const n = Date.now(), rtt = n - m.c; if (rtt <= NET.bestRtt + 15) { NET.bestRtt = Math.min(NET.bestRtt, rtt); NET.offset = m.s - (m.c + rtt / 2); } }
  else if (m.t === 'room') onRoom(m);
  else if (m.t === 'peek') onPeek(m);
  else if (m.t === 'rooms') renderRooms(m);
  else if (m.t === 'icon') {
    (NET.icons ||= {})[m.id] = m.data; if (NET.chat?.some(c => c.id === m.id)) renderChat(); if (state === 'lobby') renderLobby(); (NET.texts ||= {})[m.id] = m.txt || ''; (NET.finishes ||= {})[m.id] = m.dj | 0; (NET.forms ||= {})[m.id] = m.fm | 0; (NET.crews ||= {})[m.id] = m.cw ? cleanCrew(m.cw) : null; (NET.types ||= {})[m.id] = clamp(m.ty | 0, 0, DJ_TYPES.length - 1);
    (NET.flagModes ||= {})[m.id] = FLAG_MODES.some(f => f[0] === m.fl) ? m.fl : 'both';
    const r = racers.find(x => x.id === m.id && x.kind !== 'me'); if (r) { r.flagMode = NET.flagModes[m.id]; if (m.data) setFlagIcon(r, m.data); if (m.txt) setBannerText(r, m.txt); if (m.dj) setFinish(r.D, m.dj); r.form = m.fm | 0; r.crew = NET.crews[m.id]; crewTex(r); }
  }
  else if (m.t === 'chat') onChat(m);
  else if (m.t === 'pos') onPos(m);
  else if (m.t === 'result') showOnlineResult(m);
}
function onRoom(m) {
  if (mode !== 'online') return;
  // 待合室: ほかの人が入ってきたら「ピロン」
  const ids = new Set(m.players.map(p => p.id));
  if (NET.seen && NET.seenRoom === m.room && state === 'lobby' && [...ids].some(id => id !== NET.id && !NET.seen.has(id))) AU.sfx('join');
  NET.seen = ids; NET.seenRoom = m.room;
  if (NET.chatRoom !== m.room) { NET.chatRoom = m.room; NET.chat = []; renderChat(); }
  showChat(true);
  NET.room = m; LAPS = m.laps;
  const me = m.players.find(p => p.id === NET.id);
  const key = m.room + ':' + m.startAt;
  if (m.phase === 'race' && me && me.racing && NET.raceKey !== key && ['lobby', 'result', 'finish', 'watch', 'replay'].includes(state)) { if (state === 'replay') { RP.on = false; RP.match = false; $('replayBar').classList.add('hidden'); } watchEnd(); NET.raceKey = key; NET.ghost = false; startOnlineRace(m); return; }
  // ゴーストで参加: 自分だけ今からスタート
  if (me && me.ghost && me.ghost.fin == null && !NET.ghost && state === 'lobby') { NET.ghost = true; NET.raceKey = key; startGhostRace(m, me.ghost.start); return; }
  // 観戦: レース中の部屋をそのまま見る（次のレースから参加）
  if (m.phase === 'race' && me && !me.racing && !me.ghost && NET.how === 'watch' && state === 'lobby' && NET.raceKey !== key) { NET.raceKey = key; startWatch(m); return; }
  if (state === 'watch' && m.phase === 'wait') { watchEnd(); toLobby(); return; }   // みんな抜けて終わった
  if (NET.raceKey && (NET.ghost || (NET.raceKey === key && m.phase === 'race'))) syncRoster(m);
  if (state === 'lobby') renderLobby();
}
// レース中の顔ぶれの変化（ゴール・抜けた・ゴーストが来た）
function syncRoster(m) {
  for (const e of [...m.players, ...m.cpus]) { const r = racers.find(x => x.id === e.id); if (r && r.kind === 'net' && e.fin != null && !r.finished) { r.finished = true; r.finishTime = e.fin; } }
  for (const p of m.players) if (p.ghost && p.ghost.fin == null && p.id !== NET.id && !racers.some(r => r.id === p.id)) addNetRacer(p, true);
  // 自分がゴーストの時は、本戦が終わっても部屋にいる人はそのまま走らせておく
  const here = p => NET.ghost || p.racing || (p.ghost && p.ghost.fin == null);
  const gone = racers.filter(r => r.kind === 'net' && !r.cpu && r !== player && !m.players.some(p => p.id === r.id && here(p)));
  if (gone.length) { gone.forEach(r => { scene.remove(r.D.group); if (!r.ghost || NET.ghost) message(L(`${r.name} が抜けました`, `${r.name} left`)); }); racers = racers.filter(r => !gone.includes(r)); finishRoster(); }
  if (state === 'watch' && !racers.includes(player) && racers.length) { player = racers[0]; cam.ready = false; }
}
function addNetRacer(e, ghost) {
  const r = makeRacer(e.team, ghost ? 1 : e.slot, 'net', { id: e.id, cpu: !!e.cpu, ghostVisitor: !!e.ghost, name: e.cpu ? `CPU ${teamName(TEAMS[e.team])}` : (e.ghost ? '👻 ' : '') + e.name });
  r.vis = netVis(); Object.assign(r.vis, { x: r.car.x, z: r.car.z, y: r.car.y, yaw: r.car.yaw }); r.buf = [];
  r.slotIdx = 0;
  if (ghost) ghostify(r);
  racers.push(r); updateVisual(r, 0, 0);
  return r;
}
// ゴースト: 半透明（ぶつからない・町も壊さない）
function ghostify(r) {
  r.ghost = true;
  r.D.group.traverse(o => {
    if (!o.isMesh || !o.material || o.userData.tag) return;
    o.material = (Array.isArray(o.material) ? o.material : [o.material]).map(mt => { const c = mt.clone(); c.transparent = true; c.opacity = 0.35 * (mt.opacity ?? 1); c.depthWrite = false; return c; });
    if (o.material.length === 1) o.material = o.material[0];
    o.castShadow = false;
  });
}
function toLobby() {
  AU.stopMusic(); clearRacers(); buildSolo();
  ['hud', 'touch', 'result', 'count', 'watchBar'].forEach(id => $(id).classList.add('hidden'));
  $('lobby').classList.remove('hidden'); state = 'lobby'; renderLobby();
}
function startGhostRace(m, gStart) {
  chatClear();
  const [mp, mt] = String(m.stage || '').split('-');
  if (PLACES[mp] && (mp !== place || (mt === 'night') !== night)) loadStage(mp, mt === 'night');
  clearRacers();
  const me = makeRacer(selTeam, 1, 'me', { id: NET.id, name: L('あなた', 'You') });
  racers.push(me); player = me;
  for (const e of [...m.players.filter(p => p.racing || (p.ghost && p.ghost.fin == null && p.id !== NET.id)), ...m.cpus]) addNetRacer(e, true);
  finishRoster();
  setTimeout(() => message(L('👻 ゴースト走行（すり抜け・順位外）', '👻 Ghost run (no bumping, unranked)'), 'gold', true), 600);
  NET.lastSend = 0;
  beginRace(AU.now() + Math.max(0.5, (gStart - serverNow()) / 1000));
}
// 観戦
function startWatch(m) {
  chatClear();
  const [mp, mt] = String(m.stage || '').split('-');
  if (PLACES[mp] && (mp !== place || (mt === 'night') !== night)) loadStage(mp, mt === 'night');
  clearRacers();
  for (const e of [...m.players.filter(p => p.racing), ...m.cpus]) addNetRacer(e, false);
  for (const p of m.players) if (p.ghost && p.ghost.fin == null && p.id !== NET.id) addNetRacer(p, true);
  if (!racers.length) { toLobby(); return; }
  player = racers.find(r => !r.cpu && !r.ghost) || racers[0];
  finishRoster();
  for (const e of [...m.players, ...m.cpus]) { const r = racers.find(x => x.id === e.id); if (r && e.fin != null) { r.finished = true; r.finishTime = e.fin; } }
  resetStats(); world.resetProps(); SIM.resetBreach(course); fx.clearSkids();
  ['title', 'result', 'lobby', 'pause', 'hud', 'touch'].forEach(id => $(id).classList.add('hidden'));
  raceStart = AU.now() - Math.max(0, (serverNow() - m.startAt) / 1000); cam.ready = false;
  AU.startMusic(AU.now() + 0.2, 0, 'race', mp === 'jp' ? 'jp' : mp);
  state = 'watch';
  $('watchBar').classList.remove('hidden'); updateWatchBar();
  message(L('👀 観戦中（次のレースから参加します）', '👀 Watching (you join the next race)'), 'gold', true);
}
function watchPick(d) {
  const list = racers.filter(r => !r.ghost); if (!list.length) return;
  player = list[(list.indexOf(player) + d + list.length) % list.length]; cam.ready = false; updateWatchBar();
}
function updateWatchBar() {
  if (!player) return;
  const ord = racers.filter(r => !r.ghost).sort((a, b) => (a.finished && b.finished) ? a.finishTime - b.finishTime : a.finished ? -1 : b.finished ? 1 : (b.vis.prog || 0) - (a.vis.prog || 0));
  const i = ord.indexOf(player);
  setT($('wbName'), `👀 ${player.name}${i >= 0 ? L(`（${i + 1}位）`, ` (#${i + 1})`) : ''}`);
}
function watchEnd() { $('watchBar').classList.add('hidden'); }
// ゴースト走行のゴール: 本戦の記録と並べて「本戦なら何位」
function showGhostResult() {
  NET.ghost = false; NET.raceKey = null;
  state = 'result'; AU.stopMusic();
  ['hud', 'touch', 'count'].forEach(id => $(id).classList.add('hidden'));
  const rows = racers.filter(r => r === player || !r.ghostVisitor).map(r => ({ r, t: r === player ? player.finishTime : r.finished ? r.finishTime : null }))
    .sort((a, b) => (a.t == null) - (b.t == null) || a.t - b.t);
  $('resTable').innerHTML = rows.map((e, i) => `<tr class="${e.r === player ? 'me' : ''}"><td>${e.t == null ? '—' : L(`${i + 1}位`, `#${i + 1}`)}</td><td>${swatch(e.r.team)}${e.r === player ? '👻 ' + esc(myName) + L('（あなた）', ' (you)') : esc(e.r.name)}</td><td>${e.t == null ? L('記録なし', 'DNF') : fmt(e.t)}</td></tr>`).join('');
  const rank = rows.findIndex(e => e.r === player) + 1; resInfo = { rank: 0, n: 0 }; shareReset(true);
  $('resTitle').textContent = L(`👻 ゴースト ${rank}位相当`, `👻 Ghost: would be #${rank}`);
  $('resNew').textContent = L('本戦の記録とくらべた順位です（ゴーストは順位外）', 'Compared with the race times (ghost runs are unranked)');
  $('resStats').innerHTML = statsHTML(); $('resColl').innerHTML = collectedHTML(player); bindCollected(); showRankForm(); updateMyBest();
  $('retryBtn').classList.add('hidden');
  updateNextInfo();
  podium(rows.filter(e => e.t != null).map(e => e.r));
}
function netVis() { return { x: 0, y: 0, z: 0, yaw: 0, roll: 0, pitch: 0, vx: 0, vz: 0, speed: 0, vF: 0, air: false, crashT: 0, tipped: false, boosting: false, drift: false, slip: 0, steerIn: 0, w: 0, prog: SIM.START_S, si: -1 }; }
function chatClear() { NET.chat = []; renderChat(); roomsOpen(false); }   // 試合ごとにチャットはまっさら
function startOnlineRace(m) {
  chatClear();
  const [mp, mt] = String(m.stage || '').split('-');
  if (PLACES[mp] && (mp !== place || (mt === 'night') !== night)) loadStage(mp, mt === 'night');
  clearRacers();
  const roster = [...m.players.filter(p => p.racing), ...m.cpus].sort((a, b) => (b.id === NET.id) - (a.id === NET.id) || a.slot - b.slot);
  for (const e of roster) {
    const me = e.id === NET.id;
    const r = makeRacer(e.team, e.slot, me ? 'me' : 'net', { id: e.id, cpu: !!e.cpu, name: me ? L('あなた', 'You') : e.cpu ? `CPU ${teamName(TEAMS[e.team])}` : e.name });
    if (!me) { r.vis = netVis(); Object.assign(r.vis, { x: r.car.x, z: r.car.z, y: r.car.y, yaw: r.car.yaw }); r.buf = []; }
    racers.push(r);
  }
  player = racers[0];
  finishRoster();
  // ステージはサーバのくじ引き（部屋のみんなが同じ）
  if (PLACES[mp]) setTimeout(() => message(L(`今回の町: ${placeName(mp, mt === 'night')}`, `Town: ${placeName(mp, mt === 'night')}`), 'gold', true), 600);
  NET.lastSend = 0;
  beginRace(AU.now() + Math.max(0.5, (m.startAt - serverNow()) / 1000));
}
function onPos(m) {
  if (mode !== 'online' || !NET.raceKey) return;
  const n = performance.now();
  for (const a of m.p) {
    const r = racers.find(x => x.id === a[0]);
    if (!r || r.kind !== 'net') continue;
    r.buf.push({ t: n, x: a[1], z: a[2], y: a[3], yaw: a[4], roll: a[5], pitch: a[6], vx: a[7], vz: a[8], f: a[9], p: a[10] });
    if (r.buf.length > 30) r.buf.shift();
  }
}
function netInterp(r, dt) {
  const v = r.vis, b = r.buf; if (!b.length) return;
  const rt = performance.now() - 130;
  let a = b[0], c = b[b.length - 1], k = 0;
  if (rt <= b[0].t) { a = c = b[0]; }
  else if (rt >= c.t) { a = c; k = 0; }
  else for (let i = 0; i < b.length - 1; i++) if (b[i].t <= rt && b[i + 1].t >= rt) { a = b[i]; c = b[i + 1]; k = (rt - a.t) / Math.max(1, c.t - a.t); break; }
  const ext = rt > b[b.length - 1].t ? Math.min(0.25, (rt - b[b.length - 1].t) / 1000) : 0;
  const prevAir = v.air, prevCrash = v.crashT;
  v.x = lerp(a.x, c.x, k) + a.vx * ext; v.z = lerp(a.z, c.z, k) + a.vz * ext; v.y = lerp(a.y, c.y, k);
  v.yaw = a.yaw + wrapA(c.yaw - a.yaw) * k; v.roll = lerp(a.roll, c.roll, k); v.pitch = lerp(a.pitch, c.pitch, k);
  v.vx = lerp(a.vx, c.vx, k); v.vz = lerp(a.vz, c.vz, k);
  v.speed = Math.hypot(v.vx, v.vz); v.vF = v.vx * Math.sin(v.yaw) + v.vz * Math.cos(v.yaw);
  const f = c.f; v.air = !!(f & 1); v.crashT = f & 2 ? 1 : 0; v.boosting = !!(f & 4); v.drift = !!(f & 8); v.tipped = !!(f & 16);
  v.slip = Math.abs(v.vx * -Math.cos(v.yaw) + v.vz * Math.sin(v.yaw));
  v.prog = lerp(a.p, c.p, k);
  if (prevAir && !v.air && Math.hypot(v.x - player.vis.x, v.z - player.vis.z) < 45) fx.burst('dust', v.x, v.y + 0.2, v.z, 12, { spread: 5, size: 1.6 });
  if (!prevCrash && v.crashT && Math.hypot(v.x - player.vis.x, v.z - player.vis.z) < 60) { fx.burst('debris', v.x, v.y + 2, v.z, 20, { vx: v.vx, vz: v.vz }); AU.sfx('wall', 8); }
}
function netTick(force) {
  const n = performance.now();
  if (!force && n - NET.lastSend < 66) return;
  NET.lastSend = n;
  const c = player.car, r2 = v => Math.round(v * 100) / 100;
  const f = (c.air ? 1 : 0) | (c.crashT > 0 ? 2 : 0) | (c.boosting ? 4 : 0) | (c.drift ? 8 : 0) | (c.tipped ? 16 : 0);
  netSend({ t: 'st', x: r2(c.x), z: r2(c.z), y: r2(c.y), yaw: r2(c.yaw * 100) / 100, roll: r2(c.roll), pitch: r2(c.pitch), vx: r2(c.vx), vz: r2(c.vz), p: r2(c.prog), f });
}
function rankingHTML() { return NET.best.length ? `<b>${L('オンライン最速番付', 'Online fastest')}</b><ol>` + NET.best.map(b => `<li>${esc(b.name)}（${(TEAMS[b.team] ? teamName(TEAMS[b.team]) : '')}）<b>${fmt(b.time)}</b></li>`).join('') + '</ol>' : ''; }
function renderLobby() {
  const m = NET.room;
  $('lobbyRank').innerHTML = rankingHTML();
  if (!m && NET.choice) return;
  if (!m) { setT($('lobbyStatus'), NET.failed ? L('接続できませんでした。時間をおいてもう一度どうぞ。', 'Could not connect. Please try again later.') : L('サーバーに接続中…', 'Connecting…')); $('lobbyList').innerHTML = ''; setT($('lobbyCount'), ''); return; }
  setT($('lobbyStatus'), m.phase === 'wait' ? L(`部屋 ${m.room}：ほかの人を待っています`, `Room ${m.room}: waiting for players`) : m.phase === 'race' ? L(`部屋 ${m.room}：レース中。次のレースから参加します`, `Room ${m.room}: race in progress, you join the next one`) : L(`部屋 ${m.room}：結果発表中…`, `Room ${m.room}: results…`));
  // 入った時点から各プレイヤーのアイコン（カスタムの画像）を名前の前に
  const pic = id => { const u = id === NET.id ? myIcon : NET.icons?.[id]; return u && u.startsWith('data:image/') ? `<img class="lb-ic" src="${u}" alt="">` : ''; };
  let html = m.players.map(p => `<li class="${p.id === NET.id ? 'me' : ''}">${swatch(TEAMS[p.team])}${pic(p.id)}${esc(p.name)}${p.id === NET.id ? L('（あなた）', ' (you)') : ''}<span style="margin-left:auto;color:var(--muted)">${teamName(TEAMS[p.team])}</span></li>`).join('');
  const used = new Set(m.players.map(p => p.team));
  [0, 1, 2, 3, 4, 5, 6, 7].filter(t => !used.has(t)).slice(0, Math.max(0, 4 - m.players.length)).forEach(t => { html += `<li class="cpu">${swatch(TEAMS[t])}${L('CPU（空き枠）', 'CPU (open slot)')}<span style="margin-left:auto">${teamName(TEAMS[t])}</span></li>`; });
  $('lobbyList').innerHTML = html;
  updateLobbyCount();
}
function updateLobbyCount() { const m = NET.room; if (!m) return; const sec = Math.max(0, Math.ceil((m.phaseEnd - serverNow()) / 1000)); setT($('lobbyCount'), m.phase === 'wait' ? (m.hold || (holdWait && m.players.length < 2) ? L('だれか来るまで待っています…', 'Waiting for someone to join…') : L(`出発まで ${sec} 秒`, `Starting in ${sec}s`)) : ''); }
// 「だれか来るまで待つ」（1 人の時は CPU だけで始めない）
let holdWait = store.get('danjiri-hold', '0') === '1';
function showHold() { const b = $('lobbyHold'); if (b) { b.textContent = `${L('だれか来るまで待つ', 'Wait for players')}：${holdWait ? 'ON' : 'OFF'}`; b.classList.toggle('on', holdWait); } }
function updateNextInfo() {
  const m = NET.room;
  if (!m) { setNext($('nextInfo'), 'x' + NET.failed, NET.failed ? `<small>${L('接続が切れました', 'Disconnected')}</small>` : ''); return; }
  const el = $('nextInfo');
  if (m.phase === 'race') { setNext(el, 'race', `<small>${L('部屋はレース中。次のレースから参加します', 'The room is racing. You join the next race')}</small>`); return; }
  if (m.phase !== 'wait' && m.phase !== 'result') { setNext(el, '', ''); return; }
  // 次の試合までの秒数を大きく。次の舞台（前とは違う町）も出す
  const sec = Math.max(0, Math.ceil(((m.nextAt || m.phaseEnd) - serverNow()) / 1000));
  const [np, nt] = String(m.next || (m.phase === 'wait' ? '' : '')).split('-');
  const stage = np && PLACES[np] ? placeName(np, nt === 'night') : '';
  const held = m.phase === 'wait' && m.hold;
  setNext(el, `${sec}|${held}|${stage}|${LANG}`, held ? `<div class="nx-t">${L('だれか来るまで待っています…', 'Waiting for someone to join…')}</div>`
    : `<div class="nx-t">${L('次の試合まで', 'Next race in')}</div><div class="nx-n"><b>${sec}</b>${L('秒', 's')}</div>${stage ? `<div class="nx-s">${L('次の舞台', 'Next stage')}：<b>${esc(stage)}</b></div>` : ''}<small>${L('そのまま待てば自動で参加します', 'Stay here and you join automatically')}</small>`);
}
function setNext(el, key, html) { if (el.dataset.k === key) return; el.dataset.k = key; el.innerHTML = html; el.classList.toggle('nx-on', !!html && key !== 'race'); }
function showOnlineResult(m) {
  if (mode !== 'online' || !NET.raceKey || !['countdown', 'race', 'finish', 'watch'].includes(state)) return;
  NET.best = m.best || NET.best;
  if (NET.ghost) { message(L('本戦のレースが終わりました', 'The main race has finished'), 'gold'); return; }   // ゴーストは自分のゴールまで走る
  const watching = state === 'watch'; watchEnd();
  state = 'result'; AU.stopMusic();
  ['hud', 'touch', 'count'].forEach(id => $(id).classList.add('hidden'));
  $('resTable').innerHTML = m.list.map(e => `<tr class="${e.id === NET.id ? 'me' : ''}"><td>${L(`${e.rank}位`, `#${e.rank}`)}</td><td>${swatch(TEAMS[e.team])}${esc(e.cpu ? 'CPU ' + teamName(TEAMS[e.team]) : e.name)}${e.id === NET.id ? L('（あなた）', ' (you)') : ''}</td><td>${e.est ? '約 ' : ''}${fmt(e.time)}</td></tr>`).join('');
  const mine = m.list.find(e => e.id === NET.id); resInfo = { rank: mine ? mine.rank : 0, n: m.list.length }; shareReset(!watching);
  $('resTitle').textContent = !mine ? L('結果', 'Results') : mine.rank === 1 ? L('優勝! 町の誇りや!', 'VICTORY! Pride of the town!') : L(`${mine.rank}位`, `#${mine.rank}`);
  const bi = mine && !mine.est ? NET.best.findIndex(b => b.name === myName && b.time === mine.time) : -1;
  $('resNew').textContent = bi >= 0 ? L(`オンライン番付 ${bi + 1}位 に入りました!`, `Online ranking #${bi + 1}!`) : '';
  if (watching) { $('resNew').textContent = L('観戦したレースの結果。次のレースから参加します', 'Results of the race you watched. You join the next one'); $('resStats').innerHTML = ''; $('resColl').innerHTML = ''; $('rankForm').classList.add('hidden'); $('resBadge').classList.add('hidden'); }
  else { $('resStats').innerHTML = statsHTML(); $('resColl').innerHTML = collectedHTML(player); bindCollected(); showRankForm(); updateMyBest(); }
  $('retryBtn').classList.add('hidden');
  updateNextInfo();
  podium(m.list.map(e => racers.find(r => r.id === e.id)));
}
function startOnline() {
  document.activeElement?.blur?.();
  myName = $('nameIn').value.trim().slice(0, 12) || L('名無し', 'Anonymous');
  store.set('danjiri-name', myName);
  AU.initAudio(); netLeave();
  NET.how = null; NET.ghost = false; NET.choice = null; $('lobbyChoice').classList.add('hidden');
  mode = 'online'; state = 'lobby';
  $('title').classList.add('hidden'); $('lobby').classList.remove('hidden');
  renderLobby(); netConnect();
}

// ================= タイトル画面 =================
function setupTitle() {
  const ts = $('teamSel');
  if (ts) TEAMS.forEach((t, i) => {
    const b = document.createElement('button');
    b.innerHTML = `<span class="sw" style="background:${t.css}"></span>${t.name}`;
    if (i === selTeam) b.classList.add('sel');
    b.onclick = () => { selTeam = i; store.set('danjiri-team', i); [...ts.children].forEach((c, j) => c.classList.toggle('sel', j === i)); buildSolo(); };
    ts.appendChild(b);
  });
  const group = (id, attr, cur, fn) => $(id).querySelectorAll('button').forEach(b => {
    b.classList.toggle('sel', b.dataset[attr] === String(cur));
    b.onclick = () => { $(id).querySelectorAll('button').forEach(c => c.classList.toggle('sel', c === b)); fn(b.dataset[attr]); };
  });
  group('lapSel', 'l', LAPS, v => { LAPS = +v; store.set('danjiri-laps', v); showBest(); });
  group('placeSel', 'p', place, v => { store.set('danjiri-place', v); withLoading(() => { loadStage(v, night); buildSolo(); }); });
  // 町えらびはプルダウン: 今の町だけ 1 行で見せ、押すと一覧が開く
  ddify($('placeSel'));
  group('todSel', 't', night ? 'night' : 'day', v => { store.set('danjiri-tod', v); withLoading(() => { loadStage(place, v === 'night'); buildSolo(); }); });
  group('qSel', 'q', quality, v => { quality = v; store.set('danjiri-q', v); applyQuality(); });
  $('startBtn').onclick = startSolo; $('onlineBtn').onclick = startOnline;
  $('soloBtn').onclick = () => titleStep(2); $('stepBack').onclick = () => titleStep(1);
  $('lobbyQuit').onclick = toTitle;
  $('lobbyRooms').onclick = () => roomsOpen($('roomPick').classList.contains('hidden'));
  $('lcRooms').onclick = () => { $('lobbyChoice').classList.add('hidden'); NET.choice = null; netJoin('auto'); roomsOpen(true); };
  $('rpNew').onclick = () => { roomsOpen(false); NET.raceKey = null; netJoin('new'); };
  for (const k of ['res', 'lobby']) {
    $(k + 'ChatForm').onsubmit = e => { e.preventDefault(); const i = $(k + 'ChatIn'); sendChat(i.value); i.value = ''; };
    // 定型文はプルダウン: 選んだらすぐ送って「定型文 ▼」に戻す
    const st = $(k + 'Stamp');
    st.querySelectorAll('option[value]').forEach(o => { if (STAMP_EN[o.value]) o.dataset.en = STAMP_EN[o.value]; });
    st.onchange = () => { const v = st.value; st.value = ''; if (v) sendChat(LANG === 'en' ? (STAMP_EN[v] || v) : v); };
  }
  $('wbPrev').onclick = () => watchPick(-1); $('wbNext').onclick = () => watchPick(1); $('wbQuit').onclick = toTitle;
  showHold(); $('lobbyHold').onclick = () => { holdWait = !holdWait; store.set('danjiri-hold', holdWait ? '1' : '0'); showHold(); netSend({ t: 'hold', on: holdWait }); }; $('retryBtn').onclick = startSolo; $('titleBtn').onclick = toTitle;
  $('resumeBtn').onclick = togglePause; $('quitBtn').onclick = () => { AU.audio.ctx?.resume(); toTitle(); };
  $('nameIn').value = myName;
  showIconUI();
  $('iconBtn').onclick = () => $('iconFile').click();
  $('iconFile').onchange = async () => {
    const f = $('iconFile').files[0]; $('iconFile').value = ''; if (!f) return;
    try { myIcon = await iconFromFile(f); store.set('danjiri-icon', myIcon); showIconUI(); buildSolo(); if (SC.preview) soloOnlyMe(); SC.yaw = Math.PI * 0.85; SC.auto = true; }
    catch (e) { if (e.message !== 'cancel') alert(L('画像を読み込めませんでした', 'Could not read that image')); }
  };
  $('cuFlag').innerHTML = FLAG_MODES.map(([v, ja, en]) => `<button data-v="${v}" class="${v === myFlag ? 'sel' : ''}">${esc(L(ja, en))}</button>`).join('');
  $('cuFlag').querySelectorAll('button').forEach(b => b.onclick = () => {
    myFlag = b.dataset.v; store.set('danjiri-flag', myFlag); $('cuFlag').querySelectorAll('button').forEach(c => c.classList.toggle('sel', c === b));
    if (player) { player.flagMode = myFlag; if (myIcon) setFlagIcon(player, myIcon); }
    cuSummary(); SC.auto = true; SC.dist = Math.max(SC.dist, 18);
  });
  $('iconDel').onclick = () => { myIcon = ''; store.set('danjiri-icon', ''); showIconUI(); buildSolo(); if (SC.preview) soloOnlyMe(); };
  $('cuText').value = myText;
  const setText = () => { myText = cleanBanner($('cuText').value); $('cuText').value = myText; store.set('danjiri-text', myText); if (player) setBannerText(player, myText); cuSummary(); SC.yaw = Math.PI * 0.6; };
  $('cuTextSet').onclick = setText; $('cuText').onchange = setText;
  $('cuText').oninput = () => { const t = cleanBanner($('cuText').value); if (player) setBannerText(player, t); };   // 打った端からその場で変わる
  $('crZoom').oninput = () => cropZoom(CR.min * Math.pow(6, $('crZoom').value / 100));
  $('crOk').onclick = () => cropDone(true); $('crCancel').onclick = () => cropDone(false);
  $('customBtn').onclick = () => customOpen(true); $('cuDone').onclick = () => customOpen(false);
  // 設定パネルはたたんで丸いボタンにできる（だんじりを大きく見たい時）
  const cuFold = f => { $('cuCard').classList.toggle('hidden', f); $('cuShow').classList.toggle('hidden', !f); SC.lift = f ? 0 : 1; };
  $('cuHide').onclick = () => cuFold(true);
  // ひとつ開いたら他は閉じる（name 属性に対応していないブラウザ向け）
  document.querySelectorAll('#custom .cu-sec').forEach(d => d.addEventListener('toggle', () => { if (d.open) d.querySelectorAll('.cu-fin .sel').forEach(b => b.scrollIntoView({ block: 'nearest', inline: 'center' })); if (d.open) document.querySelectorAll('#custom .cu-sec').forEach(o => { if (o !== d) o.open = false; }); })); $('cuShow').onclick = () => cuFold(false);
  $('rankBtn').onclick = () => openRanking(place); $('resRankBtn').onclick = () => openRanking(place);
  $('rkClose').onclick = () => { $('ranking').classList.add('hidden'); setURL(homeURL()); };
  $('mbBtn').onclick = () => openMyBest(place); $('resMbBtn').onclick = () => openMyBest(place); $('mbClose').onclick = () => $('mybest').classList.add('hidden');
  $('showBtn').onclick = playMatch; $('rpStop').onclick = replayStop;
  $('rpPrev').onclick = () => rpPick(-1); $('rpNext').onclick = () => rpPick(1);
  $('scBack').onclick = () => { if (state === 'display') { const sv = !!shareView; shareClose(); showcaseOpen(false); $('result').classList.add('hidden'); toTitle(); if (!sv) openRanking(rkPlace); } else showcaseOpen(false); };
  $('shareBtn').onclick = makeShare;
  // ☰: 記録・ひっついたもの をまとめる（走りを再生はそのまま出す）
  $('scMenuBtn').onclick = () => $('scMenu').classList.toggle('hidden');
  $('scShareItems').onclick = () => { $('scMenu').classList.add('hidden'); openItemsWin(); }; $('scShareSum').onclick = () => { $('scMenu').classList.add('hidden'); openSummaryWin(); };
  $('itemsClose').onclick = () => $('itemsWin').classList.add('hidden');
  $('scShareTop').onclick = () => { $('scMenu').classList.add('hidden'); shareClose(); showcaseOpen(false); toTitle(); };
  $('scShareGo').onclick = () => { shareClose(); showcaseOpen(false); toTitle(); };
  $('scSharePlay').onclick = () => { const v = shareView; if (!v) return; $('scMenu').classList.add('hidden'); $('scShare').classList.add('hidden'); showcaseOpen(false); playReplay({ name: v.sh.name }, v.sh.place, v.sh.tod, v.sh.rec); };
  $('scPrev').onclick = () => { SC.i = (SC.i + racers.length - 1) % racers.length; SC.focus = null; SC.dist = 16; showcaseName(); };
  $('scNext').onclick = () => { SC.i = (SC.i + 1) % racers.length; SC.focus = null; SC.dist = 16; showcaseName(); };
  $('langBtn').onclick = () => { LANG = LANG === 'en' ? 'ja' : 'en'; store.set('danjiri-lang', LANG); applyLang(); if (state === 'title') buildSolo(); };
  applyLang();
  showBest();
}

// ================= メインループ =================
let acc = 0, last = performance.now(), gameTime = 0, lastCount = 99, debugAuto = false, debugInp = null;
// ゴール後: 線の先（スタートラインより先）まで走り抜けてから、100 m あたりで止まる
function afterGoal(r, inp) {
  const past = r.car.prog - goalS();
  inp.boost = false;
  if (past < 60) inp.throttle = Math.min(inp.throttle, 0.8);
  else if (past < 100) inp.throttle *= 0.3;
  else { inp.throttle = 0; inp.brake = 1; }
}
const END_AFTER = 20;   // 1 位のゴールから決着までの秒数
function step(dt) {
  const racing = state === 'race' || state === 'finish' || state === 'result';
  if (!racing) return;
  for (const r of racers) {
    if (r.kind === 'net') continue;
    let inp;
    if (r.kind === 'me' && debugInp) inp = { ...debugInp };
    else if (r.kind === 'me' && state === 'race' && !r.finished && !debugAuto) { inp = readInput(dt); if (r.rushT > 0) inp.boost = true; }   // お神酒: しばらく自動でソーリャ
    else if (r.kind === 'me') { inp = SIM.aiInput(r.car, course, r.autoAI || (r.autoAI = SIM.makeAI(2)), dt); if (r.finished) afterGoal(r, inp); }
    else inp = SIM.aiInput(r.car, course, r.ai, dt);
    // ゴール後の CPU: 線の先（スタートラインより先）まではそのまま進んでから、ゆっくりに
    if (r.finished && r.kind === 'cpu') afterGoal(r, inp);
    const wasBoost = r.car.boosting;
    const ev = SIM.stepCar(r.car, inp, dt, course);
    handleEvents(r, ev);
    if (r === player && r.rushT > 0) { r.rushT -= dt; r.car.boost = Math.max(r.car.boost, 0.4); }
    if (r === player && r.car.boosting && !wasBoost) { message(L('ソーリャ!!', 'SORYA!!'), 'gold', true); AU.sfx('boost'); AU.shout(); }
  }
  // だんじりどうしの押し合い
  for (let i = 0; i < racers.length; i++) for (let j = i + 1; j < racers.length; j++) {
    const a = racers[i], b = racers[j];
    let imp = 0;
    if (a.ghost || b.ghost) continue;   // ゴーストはすり抜け
    if (a.finished || b.finished) continue;   // ゴールした車はすり抜け（ゴール前に列ができてふさがないように）
    if (a.kind !== 'net' && b.kind !== 'net') imp = SIM.collideCars(a.car, b.car, true);
    else if (a.kind !== 'net') imp = SIM.collideCars(a.car, b.vis, false);
    else if (b.kind !== 'net') imp = SIM.collideCars(b.car, a.vis, false);
    if (imp > 2 && (a === player || b === player)) { AU.sfx('bump', imp); shake = Math.max(shake, Math.min(0.6, imp * 0.06)); const o = a === player ? b.vis : a.vis; fx.burst('sparks', (player.vis.x + o.x) / 2, player.vis.y + 1.2, (player.vis.z + o.z) / 2, 8); }
  }
  // ゴール判定
  const gs = goalS();
  for (const r of racers) {
    if (r.kind === 'net' || r.finished || r.car.prog < gs) continue;
    if (r === player && state !== 'race') continue;   // 強制決着の後に線を越えても、もうゴール扱いにしない（結果画面のまま止まらないように）
    r.finished = true; r.finishTime = raceT;
    if (r === player) wantPreview = true;
    if (r === player) {
      const rank = rankOrder().indexOf(player) + 1;
      message(rank === 1 ? L('一番乗り!!', 'FIRST PLACE!!') : L(`${rank}位 ゴール!`, `Finished #${rank}!`), 'gold', true); AU.cheer(0.7, 3);
      fx.burst('confetti', r.car.x, r.car.y + 7, r.car.z, 120, { speed: 8, up: 8, life: 4 });
      state = 'finish'; resultTimer = mode === 'solo' || NET.ghost ? 3.5 : Infinity;
      if (mode === 'online' && NET.ghost) { netTick(true); netSend({ t: 'fin' }); }
      else if (mode === 'online') { netTick(true); netSend({ t: 'fin' }); setTimeout(() => { if (state === 'finish') message(L('ほかの町の到着待ち…', 'Waiting for the others…')); }, 1600); }
    }
  }
  const lap = Math.floor((player.car.prog - SIM.START_S) / course.L) + 1;
  if (state === 'race' && lap > (player.lastLap || 1) && lap <= LAPS) { player.lastLap = lap; message(lap === LAPS ? L('ファイナルラップ!', 'FINAL LAP!') : L(`${lap}周目`, `Lap ${lap}`), 'gold', true); AU.cheer(0.4, 1.5); }
}
function frame(nowMs) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (nowMs - last) / 1000); last = nowMs;
  if (state === 'paused' || !player) return;
  gameTime += dt;
  const t = gameTime;
  // 間（スロー）は一人用だけ
  // 大ジャンプ中と激突の瞬間はスロー（一人用だけ。激突は handleEvents で timeScale を下げる）
  const ts = mode === 'solo' && state === 'race' && player.car.air && player.car.airT > 0.35 && player.car.vy > -6 ? 0.6 : 1;
  timeScale += (ts - timeScale) * Math.min(1, dt * 3);
  const sdt = dt * clamp(timeScale, 0.3, 1);
  if (state === 'countdown') {
    const rem = raceStart - AU.now();
    const cnt = $('count');
    if (rem > 0) {
      const n = Math.ceil(rem);
      if (n <= 3) { cnt.classList.remove('hidden'); setT(cnt, n); if (n !== lastCount) { lastCount = n; AU.sfx('count'); } }
    } else { cnt.classList.add('hidden'); state = 'race'; message(L('ソーリャ!!', 'SORYA!!'), 'gold', true); AU.sfx('go'); }
  }
  // 1 位がゴールしてから 20 秒で決着（ひとりで: ここで決める / みんなで: サーバーが決める。残り時間を出す）
  if (state === 'race' || state === 'finish') {
    let left = null;
    if (mode === 'solo') {
      const first = racers.filter(r => r.finished).sort((a, b) => a.finishTime - b.finishTime)[0];
      if (first && !player.finished) { left = first.finishTime + END_AFTER - raceT; if (left <= 0) { showSoloResult(); left = null; } }
    } else if (NET.room?.endAt && !player.finished && !NET.ghost) left = (NET.room.endAt - serverNow()) / 1000;
    const ec = $('endCount');
    if (left != null && left > 0 && left < END_AFTER) { ec.classList.remove('hidden'); setT(ec, L(`決着まであと ${Math.ceil(left)} 秒!`, `${Math.ceil(left)}s left!`)); }
    else ec.classList.add('hidden');
  } else $('endCount').classList.add('hidden');
  if (state === 'race' || state === 'finish' || state === 'result') {
    if (state !== 'result') raceT = AU.now() - raceStart;
    acc += sdt;
    let n = 0;
    while (acc >= DT && n < 5) { step(DT); acc -= DT; n++; }
    if (n >= 5) acc = 0;
    if (mode === 'online' && (state === 'race' || state === 'finish')) netTick(false);   // ゴール後も位置を送る（走り抜ける様子が見える）
    if (state === 'finish') { resultTimer -= dt; if (resultTimer <= 0 && mode === 'solo') showSoloResult(); else if (resultTimer <= 0 && NET.ghost) showGhostResult(); }
    stats.topSpeed = Math.max(stats.topSpeed || 0, player.car.speed);
  }
  if (state === 'replay') replayTick(sdt);
  else for (const r of racers) if (r.kind === 'net') { netInterp(r, dt); if ((state === 'race' || state === 'finish' || state === 'watch') && !r.ghost) netBreach(r); }
  if (state === 'race' || (state === 'finish' && player.finishTime && raceT - player.finishTime < 2)) recordTick(sdt);
  if (state === 'race' || state === 'finish') { if (!match) matchStart(); matchTick(sdt); }
  if (state === 'race' || state === 'finish' || state === 'watch') for (const r of racers) if (!r.ghost) snagSpans(r);
  // 見た目
  crowd.begin(); ropeIdx = 0; cordIdx = 0;
  for (const r of racers) { if (r.hidden) continue; updateVisual(r, sdt, t); if (r.ghost) continue; updateCrew(r, sdt, t); addDaiku(r); updateTangle(r, sdt); }
  crowd.end();
  cordMesh.count = cordIdx; cordMesh.instanceMatrix.needsUpdate = true;
  ropeMesh.count = ropeIdx; ropeMesh.instanceMatrix.needsUpdate = true;
  if (state === 'race' || state === 'finish' || state === 'watch') { for (const r of racers) { if (r.ghost) continue; hitProps(r); grabReach(r); carEffects(r, sdt, camera.position); } }
  if (state === 'watch') updateWatchBar();
  updateCamera(dt, t);
  // 交差旗のはためき（竿から離れるほど大きく波打つ。速いほど激しく）
  for (const r of racers) {
    const cl = r.D.iconFlag?.userData.cloths; if (!cl || r.hidden) continue;
    const sp = Math.min(1.6, 0.5 + (r.vis.speed || 0) / 20), ph = (r.slotIdx || 0) * 1.7;
    for (const c of cl) {
      const pos = c.geometry.attributes.position, b = c.userData.base, W = c.userData.W;
      for (let i = 0; i < pos.count; i++) {
        const x = b[i * 3], y = b[i * 3 + 1], d = (x * (c.userData.sx < 0 ? 1 : -1) + W / 2) / W;   // 0 = 竿側, 1 = 先
        pos.setZ(i, Math.sin(t * 7 * sp + d * 5 + ph + y * 1.2) * 0.16 * d * sp);
      }
      pos.needsUpdate = true;
    }
  }
  // 自分の旗はスタートの時だけ半透明（並んで出る時に前が見えるように）。走り出して 5 秒たったら元に戻す
  if (player && player.D.iconFlag) { const m = player.D.iconFlag.userData.cloth.material, want = (state === 'countdown' || (state === 'race' && raceT < 5)) && player.kind === 'me' && !SC.on ? 0.28 : 1; m.opacity += (want - m.opacity) * Math.min(1, dt * 6); m.depthWrite = m.opacity > 0.9; }
  // 名札は遠いほど少し大きく（画面上で小さくなりすぎない）
  for (const r of racers) if (r.tag) { const k = clamp(camera.position.distanceTo(r.D.group.position) / 26, 1, 3.2); r.tag.scale.set(4.6 * k, 1.08 * k, 1); r.tag.position.y = 10.6 + (k - 1) * 0.8; }
  const p = player.vis;
  if (state === 'race') updateHappenings(sdt);
  updateCatchup(sdt, t);
  updateSand(dt);
  // NY: 道ばたの煙突から蒸気
  if (world.steamSpots) for (const sp of world.steamSpots) if (sp.alive && Math.random() < 0.25 && Math.abs(sp.x - camera.position.x) + Math.abs(sp.z - camera.position.z) < 110) fx.burst('dust', sp.x + (Math.random() - 0.5) * 0.3, sp.y + 2.5, sp.z + (Math.random() - 0.5) * 0.3, 1, { size: 2.6, color: [0.93, 0.93, 0.95] });
  world.update(sdt, t, camera.position, racers.map(r => r.vis));
  fx.update(sdt, renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360)) * 0.9);
  sun.position.set(p.x + SUN_OFF.x, p.y + SUN_OFF.y, p.z + SUN_OFF.z); sun.target.position.set(p.x, p.y, p.z);
  carLight.position.set(p.x, p.y + 9.5, p.z);
  sky.position.copy(camera.position);
  // 音
  const racing = state === 'race' || state === 'finish' || state === 'watch';
  const crowdNear = racing ? 1 : 0.3;
  AU.engine(state === 'watch' ? player.vis.speed || 0 : player.car.speed, player.car.drift ? player.car.slip + 3 : player.car.slip, player.car.air, crowdNear, racing);
  AU.footsteps((player.vis.speed ?? player.car.speed) || 0, player.vis.air, racing || state === 'replay', place === 'venice');
  // 待合室・次のレース待ちはお囃子を流す
  if (mode === 'online' && (state === 'lobby' || state === 'result') && AU.audio.ctx && (!AU.audio.mus.on || AU.audio.mus.mode !== 'lobby')) AU.startMusic(AU.now() + 0.2, 0, 'lobby');
  AU.scheduleMusic(Math.min(1, player.car.speed / 25));
  if (racing || state === 'countdown') updateHUD();
  if (state !== 'title' && state !== 'lobby') drawMini();
  if (mode === 'online') { if (state === 'lobby') updateLobbyCount(); else if (state === 'result') updateNextInfo(); }
  // 集中線
  const sp = player.car.speed;
  speedPass.uniforms.uAmt.value = racing ? clamp((sp - 17) / 12, 0, 1) + (player.car.boosting ? 0.35 : 0) : 0;
  speedPass.uniforms.uTime.value = t; speedPass.uniforms.uAspect.value = innerWidth / innerHeight;
  if (quality === 'high') composer.render(); else { renderer.render(scene, camera); }
  if (wantPreview) { wantPreview = false; grabPreview(); }
}

// ================= 起動 =================
async function boot() {
  try {
    await Promise.race([
      Promise.all([document.fonts.load(`700 40px 'Zen Old Mincho'`, GLYPHS), document.fonts.load(`40px 'Dela Gothic One'`, GLYPHS), document.fonts.load(`700 20px 'Zen Kaku Gothic New'`, GLYPHS)]),
      new Promise(r => setTimeout(r, 5000)),
    ]);
  } catch { }
  course = SIM.buildCourse();
  loadStage(place, night);
  prepMini();
  applyQuality(); applyTimeOfDay();
  setupTitle();
  buildSolo();
  state = 'title';
  $('loading').classList.add('hidden'); $('title').classList.remove('hidden');
  requestAnimationFrame(frame);
  onlineCountTick();
  // 共有 URL（?rank=町&cat=部門&id=記録）から来た時はランキングを開く
  { const pm = location.pathname.match(/\/p\/([0-9a-z]{6,12})$/) || [0, new URLSearchParams(location.search).get('p')]; if (pm[1] && /^[0-9a-z]{6,12}$/.test(pm[1])) openShare(pm[1]); }
  { const r = new URLSearchParams(location.search).get('r');
    if (r && /^[0-9a-z]{1,12}$/.test(r)) rankAsk({ t: 'rankfind', id: r }, 'rankfind').then(m => {
      if (!m.place) { openRanking('jp'); return; }   // 圏外に落ちた記録
      const cs = Object.keys(m.at).sort((a, b) => m.at[a] - m.at[b]); rkCat = cs[0] || 'lap'; rkOpenId = r; openRanking(m.place);
    }).catch(() => { }); }
  { const q = new URLSearchParams(location.search), rp = q.get('rank'); if (rp && PLACES[rp]) { const c = q.get('cat'); if (RK_CATS.some(x => x[0] === c)) rkCat = c; rkOpenId = q.get('id') || null; openRanking(rp); } }
  if (new URLSearchParams(location.search).has('debug')) {
    window.__dj = {
      placeAt(s, lane = 0, mode = 0) { SIM.placeCar(player.car, course, s, lane); player.car.prog = s; camMode = mode; cam.ready = false; for (const r of racers) r.ropes.forEach(o => (o.init = false)); },
      breakdown() { const out = {}; const tally = (o, k) => o.traverse(x => { if ((x.isMesh || x.isPoints || x.isLine) && x.visible && x.material && x.material.visible !== false) out[k] = (out[k] || 0) + 1; }); racers.forEach(r => tally(r.D.group, 'danjiri')); scene.children.forEach(c => { if (!racers.some(r => r.D.group === c)) tally(c, c.isInstancedMesh ? 'instanced' : c.type); }); return out; },
      SIM, course, get world() { return world; },
      run(n, inp) { debugInp = inp; for (let i = 0; i < n; i++) { step(DT); gameTime += DT; cordIdx = 0; for (const r of racers) { updateVisual(r, DT, gameTime); hitProps(r); snagSpans(r); updateTangle(r, DT); } cordMesh.count = cordIdx; cordMesh.instanceMatrix.needsUpdate = true; world.update(DT, gameTime, camera.position, racers.map(r => r.vis)); } debugInp = null; const c = player.car; return { s: c.s | 0, u: +c.u.toFixed(1), v: +c.v.toFixed(1), roll: +c.roll.toFixed(2), stuck: player.stick.list.length, smash: stats.smash, crash: c.crashT > 0 }; }, auto(v) { debugAuto = v; }, info() { renderer.info.autoReset = true; return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r({ ...renderer.info.render, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures })))); }, get state() { return state; }, get player() { return player; }, get racers() { return racers; }, get stats() { return stats; }, get night() { return night; }, startSolo, showSoloResult, input, keys, setCam: m => { camMode = m; }, setNight: v => { night = v; applyTimeOfDay(); }, loadStage, get place() { return place; }, displayDj, djData, get cu() { return CU; } };
  }
}
boot();
