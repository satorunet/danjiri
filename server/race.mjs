// だんじり疾走 オンラインレース（danjiri-race.service, 127.0.0.1:3340）
// nginx: /danjiri/ws -> ws://127.0.0.1:3340
// Rooms of up to 4 danjiri. Each client drives its own danjiri with js/sim.js and sends its pose ~15x/s;
// the server relays poses, runs the empty slots as CPU danjiri with the very same sim.js, and times the finish.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import crypto from 'crypto';
import { WebSocketServer } from 'ws';
import * as SIM from '../js/sim.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3340;
const ROOM_MAX = 8;
const SLOTS = [1, 2, 0, 3, 5, 6, 4, 7];   // 人が入る順のスタート位置（0〜3 前列・4〜7 後列）
const MIN_CARS = 4;                       // 4 台に満たない分は CPU
const LAPS = 2;
const T_WAIT = 15000, T_JOIN = 6000, T_FULL = 2500, T_COUNT = 4500, T_AFTER = 15000,   /* 1 位のゴールから 15 秒で決着 */ T_RACE = 420000, T_RESULT = 20000;
const VMAX = 48;                     // m/s: どのだんじりもこれより速くは進めない
const NAME_MAX = 12;
const BEST_FILE = process.env.BEST_FILE || path.join(__dirname, 'data', 'best2.json');

const course = SIM.buildCourse();
const GOAL = SIM.START_S + LAPS * course.L;

let best = [];
try { best = JSON.parse(fs.readFileSync(BEST_FILE, 'utf8')); } catch { best = []; }
function saveBest() {
  try { fs.mkdirSync(path.dirname(BEST_FILE), { recursive: true }); fs.writeFileSync(BEST_FILE + '.tmp', JSON.stringify(best)); fs.renameSync(BEST_FILE + '.tmp', BEST_FILE); } catch (e) { console.error(e); }
}
// オンライン最速番付は当日杯と同じく直近 12 時間: ゴールのたびに記録を足し、見せる時に 12 時間より前を外して 1 人 1 つに
const BEST_MS = 12 * 3600e3;
function addBest(p, time) {
  best.push({ name: p.name, team: p.team, time: Math.round(time * 100) / 100, ts: Math.floor(Date.now() / 1000) });
  const t = (Date.now() - BEST_MS) / 1000;
  best = best.filter(b => b.ts >= t).slice(-3000);
  saveBest();
}
const topBest = () => {
  const t = (Date.now() - BEST_MS) / 1000, seen = new Set();
  return best.filter(b => b.ts >= t).sort((a, b) => a.time - b.time || a.ts - b.ts).filter(b => !seen.has(b.name) && seen.add(b.name)).slice(0, 10);
};

// ================= 町ごとのランキング（いろいろな部門） =================
// 部門: lap=1 周あたりのタイム(秒, 小さいほど上), speed=最高速度(km/h), drift=最長やりまわし(秒), stuck=ひっつけた総量(kg), smash=壊した数, air=最長ジャンプ(秒)
const RANK_FILE = process.env.RANK_FILE || path.join(path.dirname(BEST_FILE), 'rank3.json');
const IMG_DIR = path.join(path.dirname(RANK_FILE), 'img');
const REP_DIR = path.join(path.dirname(RANK_FILE), 'rep');
const DJ_DIR = path.join(path.dirname(RANK_FILE), 'dj');
const PLACES = ['jp', 'paris', 'ny', 'giza', 'venice'];
const CATS = { lap: { asc: true, lo: 22, hi: 600 }, speed: { lo: 1, hi: 160 }, drift: { lo: 0.3, hi: 15 }, stuck: { lo: 1, hi: 2e7 }, smash: { lo: 1, hi: 3000 }, air: { lo: 0.2, hi: 5 } };
const RANK_MAX = 100;
// 1P（solo）とオンライン（online）は別のランキング。それぞれに歴代と当日杯がある
const MODES = ['solo', 'online'];
const modeFile = (f, mode) => mode === 'solo' ? f : f.replace(/\.json$/, '-online.json');
const RANKS = {};
for (const md of MODES) { try { RANKS[md] = JSON.parse(fs.readFileSync(modeFile(RANK_FILE, md), 'utf8')); } catch { RANKS[md] = {}; } }
// 同じ名前は 1 つだけ（並び順で上のもの = いちばん良い記録を残す）。全角半角・大文字小文字の違いは同じ名前とみなす
const nameKey = n => String(n || '').normalize('NFKC').trim().toLowerCase();
// ただし名前を付けていない記録（名無し）は自動で登録されるので、名無しどうしはまとめない
const ANON = new Set(['名無し', 'anonymous']);
const uniqNames = list => { const seen = new Set(); return list.filter(e => { const k = nameKey(e.name); if (ANON.has(k)) return true; if (seen.has(k)) return false; seen.add(k); return true; }); };
// 不正対策は非公開の server/guard/（無い時は素通し）。ランキング登録の最終チェック・締め出し・切断の判断はすべてそちら
let G = { checkRun: () => '', bannedIp: () => false, bannedName: () => false, badTalk: () => false, shut: () => { }, onReject: () => { }, onlineHold: () => 0 };
try { G = { ...G, ...(await import('./guard/index.mjs')).default({ SIM, course, nameKey, dataDir: path.dirname(RANK_FILE) }) }; }
catch (err) { if (err.code !== 'ERR_MODULE_NOT_FOUND') console.error(err); console.log('guard: none'); }
const cheatOf = (...a) => G.checkRun(...a);
const banned = (ip, name, comment = '') => G.bannedIp(ip) || G.bannedName(name, comment);
// 締め出した人も遊べる（切断・よそへ飛ばすことはしない）。そのランキング登録は改造へ回す
function mark(p, why, said = []) {
  console.log('conn: mark', why, JSON.stringify(said.filter(Boolean)), p.ip);
  G.shut(p.ip);
}
const repCheat = {};   // 起動時: 載っている記録を走りの記録で確かめ直す
const recTime = {}, recVals = {};   // 1 周タイム × 周回 = ゴールタイム / 申告された 1 周タイム・最高速度・最長ジャンプと周回数（歴代と当日杯の両方から）
const RECENT_RAW = {}; for (const md of MODES) { try { RECENT_RAW[md] = JSON.parse(fs.readFileSync(modeFile(path.join(path.dirname(RANK_FILE), 'recent.json'), md), 'utf8')); } catch { RECENT_RAW[md] = null; } }
for (const md of MODES) for (const R of [RANKS[md], RECENT_RAW[md]]) for (const pl of PLACES) {
  if (md === 'solo') for (const e of R?.[pl]?.lap || []) recTime[e.id] = [e.val * (e.laps || 2), e.laps || 2];   // オンラインのタイムはサーバーの計測
  for (const c of ['lap', 'speed', 'air']) for (const e of R?.[pl]?.[c] || []) { (recVals[e.id] ||= {})[c] = e.val; recVals[e.id].laps = e.laps || 2; }
}
// 改造: 弾いた記録（走りの記録・写真・だんじりは残して見られるようにする）。弾いた理由（why）は配らない
const CHEAT_FILE = path.join(path.dirname(RANK_FILE), 'cheat.json'), CHEAT_MAX = 500;
let CHEATS = {}; try { CHEATS = JSON.parse(fs.readFileSync(CHEAT_FILE, 'utf8')); } catch { }
for (const pl of PLACES) CHEATS[pl] ||= [];
function addCheat(pl, e, vals, why) {
  let x = CHEATS[pl].find(y => y.id === e.id);
  if (!x) { const { val, ...rest } = e; x = { ...rest, vals: {}, why }; CHEATS[pl].push(x); if (CHEATS[pl].length > CHEAT_MAX) CHEATS[pl].splice(0, CHEATS[pl].length - CHEAT_MAX); }
  Object.assign(x.vals, vals);
}
const cheatView = (pl, day) => {
  const t = day ? (Date.now() - RECENT_MS) / 1000 : 0, list = CHEATS[pl].filter(e => e.at >= t);
  const strip = ({ vals, why, ip, key, ...e }) => e;
  const bare = list.filter(e => !Object.keys(e.vals).length).sort((a, b) => b.at - a.at).map(e => ({ ...strip(e), val: null }));   // 値の残っていない記録（登録の時点で弾いて走りを残していなかった分）は 1 周タイムの末尾に
  return Object.fromEntries(Object.entries(CATS).map(([c, def]) => [c, [...list.filter(e => e.vals[c] > 0).map(e => ({ ...strip(e), val: Math.round(e.vals[c] * 100) / 100 })).sort((a, b) => (def.asc ? a.val - b.val : b.val - a.val) || a.at - b.at), ...(c === 'lap' ? bare : [])].slice(0, RANK_MAX)]));
};
const cleanRanks = (R, uniq = true) => { for (const pl of PLACES) { R[pl] ||= {}; for (const c of Object.keys(CATS)) R[pl][c] = (uniq ? uniqNames : x => x)((R[pl][c] || []).filter(e => { repCheat[e.id] ??= cheatOf(e.rep ? readRep(e.id)?.f : null, recTime[e.id]?.[0] || 0, recVals[e.id]?.laps || 2, recVals[e.id]); if (repCheat[e.id]) { console.log('rank: drop', pl, c, e.name, e.id, repCheat[e.id]); addCheat(pl, e, { [c]: e.val }, repCheat[e.id]); } if (!repCheat[e.id] && banned(e.ip, e.name, e.comment)) { console.log('rank: ban', pl, c, e.name, e.id); addCheat(pl, e, { [c]: e.val }, 'ban'); return false; } return !repCheat[e.id]; })); } return R; };
for (const md of MODES) cleanRanks(RANKS[md]);
// ================= 当日杯: 直近 12 時間の記録だけのランキング（歴代は RANKS） =================
// 12 時間ぶんの記録はそのまま（同じ名前の重なりも含めて）持っておき、見せる時に古いものを外して並べ直す
const RECENT_FILE = path.join(path.dirname(RANK_FILE), 'recent.json'), RECENT_MS = 12 * 3600e3;
const RECENT = {};
for (const md of MODES) {
  let R = RECENT_RAW[md];
  if (!R) { R = {}; for (const pl of PLACES) { R[pl] = {}; for (const c of Object.keys(CATS)) R[pl][c] = [...(RANKS[md][pl]?.[c] || [])]; } }   // 初回: 歴代の中の新しい記録から
  RECENT[md] = cleanRanks(R, false);
}
const pruneRecent = md => { const t = (Date.now() - RECENT_MS) / 1000, R = RECENT[md]; for (const pl of PLACES) for (const c of Object.keys(CATS)) R[pl][c] = (R[pl][c] || []).filter(e => e.at >= t).slice(-3000); };
// 待機室に出す番付: ランキングのオンラインの部・当日杯（直近 12 時間）の 1 周タイム、上位 10 人
const onlineBoard = st => {
  const pl = String(st || '').split('-')[0];
  if (!PLACES.includes(pl)) return { place: '', list: [] };
  return { place: pl, list: recentView('online', pl).lap.slice(0, 10).map(e => ({ name: e.name, country: e.country, time: e.val })) };
};
function recentView(md, pl) {
  pruneRecent(md);
  return Object.fromEntries(Object.entries(CATS).map(([c, def]) => [c, uniqNames([...RECENT[md][pl][c]].sort((a, b) => (def.asc ? a.val - b.val : b.val - a.val) || a.at - b.at)).slice(0, RANK_MAX)]));
}
for (const md of MODES) pruneRecent(md);
let rankSaveT = 0;
function saveRanks() {
  clearTimeout(rankSaveT);
  rankSaveT = setTimeout(() => { try { for (const [f, d] of [...MODES.flatMap(md => [[modeFile(RANK_FILE, md), RANKS[md]], [modeFile(RECENT_FILE, md), RECENT[md]]]), [CHEAT_FILE, CHEATS]]) { fs.writeFileSync(f + '.tmp', JSON.stringify(d)); fs.renameSync(f + '.tmp', f); } } catch (e) { console.error(e); } }, 500);
}
const cleanText = (s, n) => [...String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim()].slice(0, n).join('');
const cleanLink = s => { s = String(s || '').trim(); if (!s) return ''; if (s.length > 200 || /\s/.test(s) || !/^https?:\/\/[^/\s]+\.[^\s]+/i.test(s)) return ''; try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
const lastSubmit = new Map();   // IP → 最後に登録した時刻
const onlineRun = new Map();   // IP → 最後に走ったオンラインレース { at, place, fin（サーバーが計ったゴールタイム） }
let nextRankId = Date.now() % 1e9;
function submitRank(p, m) {
  const now = Date.now(), ip = p.ip || '?';
  if (now - (lastSubmit.get(ip) || 0) < 20000) return { ok: false, err: 'wait' };
  const place = PLACES.includes(m.place) ? m.place : null;
  if (!place) return { ok: false, err: 'place' };
  let laps = num(m.laps, 1, 3, 2) | 0;
  // オンラインの記録は、この送り元がさっきその町のオンラインレースを走っていた時だけ。ゴールタイムはサーバーが計ったものを使う
  const ol = onlineRun.get(ip), mode = m.mode === 'online' && ol && now - ol.at < 15 * 60e3 && ol.place === place ? 'online' : 'solo';
  const time = mode === 'online' ? (ol.fin || 0) : num(m.time, 0, 9999, 0);
  if (m.mode === 'online') console.log('rank: online?', mode, place, ip, ol ? `${ol.place} ${Math.round((now - ol.at) / 1000)}s fin=${ol.fin}` : 'no-race');
  if (mode === 'online') laps = LAPS;
  const vals = {
    lap: time > 0 ? time / laps : 0, speed: num(m.speed, 0, 999), drift: num(m.drift, 0, 99), stuck: num(m.stuck, 0, 1e9), smash: num(m.smash, 0, 1e5), air: num(m.air, 0, 99),
  };
  const bad = banned(ip, cleanName(m.name), cleanText(m.comment, 60)) ? 'ban' : cheatOf(m.rec && m.rec.f, mode === 'online' ? 0 : time, laps, vals);
  const id = (nextRankId++).toString(36);
  const e = { id, name: cleanName(m.name), comment: cleanText(m.comment, 60), country: /^[A-Z]{2}$/.test(m.country) ? m.country : 'ZZ', link: '' /* リンクは受け付けない（コメントのみ） */, tod: m.tod === 'night' ? 'night' : 'day', laps, mode, at: Math.floor(now / 1000), img: false, ip, key: Math.random().toString(36).slice(2, 12) };   // key: あとから名前・ひとことを付ける時の合言葉（配らない）   // ip は配らない（ranks を送る時に外す）
  // ゴールの瞬間の写真（JPEG、80 KB まで）
  if (typeof m.img === 'string' && m.img.startsWith('data:image/jpeg;base64,')) {
    const buf = Buffer.from(m.img.slice(23), 'base64');
    if (buf.length > 1000 && buf.length < 82000 && buf[0] === 0xff && buf[1] === 0xd8) { try { fs.mkdirSync(IMG_DIR, { recursive: true }); fs.writeFileSync(path.join(IMG_DIR, id + '.jpg'), buf); e.img = true; } catch (err) { console.error(err); } }
  }
  // 走りの記録（データで再生するプレビュー）: 0.1 秒ごとに 7 個の整数
  const rec = m.rec;
  if (rec && Array.isArray(rec.f) && rec.f.length >= 70 && rec.f.length <= 7 * 4000 && rec.f.length % 7 === 0 && rec.f.every(v => Number.isInteger(v) && Math.abs(v) < 1e6)) {
    try { fs.mkdirSync(REP_DIR, { recursive: true }); fs.writeFileSync(path.join(REP_DIR, id + '.json'), JSON.stringify({ v: 1, team: num(rec.team, 0, 7, 0) | 0, f: rec.f })); e.rep = true; } catch (err) { console.error(err); }
  }
  // 積んだもの（だんじり表示用）: どの物を、だんじりのどこに付けていたか
  const dj = m.dj;
  if (dj && Array.isArray(dj.stuck) && dj.stuck.length <= 80 && Array.isArray(dj.items) && dj.items.length <= 60) {
    const okS = dj.stuck.every(e => e && ['p', 's', 'r', 'g'].includes(e.k) && Number.isInteger(e.i) && e.i >= 0 && e.i < 100000 && Array.isArray(e.L) && e.L.length === 16 && e.L.every(v => Number.isFinite(v) && Math.abs(v) < 1e4));
    const okI = dj.items.every(it => Array.isArray(it) && typeof it[0] === 'string' && it[0].length <= 24 && Number.isInteger(it[1]) && it[1] > 0 && it[1] < 1000);
    if (okS && okI) {
      try { fs.mkdirSync(DJ_DIR, { recursive: true }); fs.writeFileSync(path.join(DJ_DIR, id + '.json'), JSON.stringify({ team: num(dj.team, 0, 7, 0) | 0, stuck: dj.stuck.map(e => ({ k: e.k, i: e.i, L: e.L })), items: dj.items.map(it => [cleanText(it[0], 24), it[1]]) })); e.dj = true; } catch (err) { console.error(err); }
    }
  }
  if (bad) {   // 弾いた記録は改造へ（本人には理由を言わない）
    console.log('rank: cheat', bad, place, e.name, ip, id);
    addCheat(place, e, Object.fromEntries(Object.entries(vals).filter(([, v]) => v > 0).map(([c, v]) => [c, v])), bad);
    G.onReject({ ip, name: e.name, mode, why: bad });
    holdOut(ip);
    lastSubmit.set(ip, now); saveRanks();
    return { ok: false, err: 'ng' };
  }
  const got = {}, gotAll = {};   // got: 当日杯（直近 12 時間）の順位 / gotAll: 歴代の順位
  const put = (R, c, def, row) => {
    const all = [...(R[place][c] || []), row];
    all.sort((a, b) => (def.asc ? a.val - b.val : b.val - a.val) || a.at - b.at);
    const list = R[place][c] = uniqNames(all).slice(0, RANK_MAX);
    return list.findIndex(x => x.id === id) + 1;
  };
  for (const [c, def] of Object.entries(CATS)) {
    const v = vals[c];
    if (!(v >= def.lo && v <= def.hi)) continue;   // ありえない値・記録なしは載せない
    const row = { ...e, val: Math.round(v * 100) / 100 };
    const a = put(RANKS[mode], c, def, row);
    if (a) gotAll[c] = a;
    RECENT[mode][place][c].push(row);
  }
  const RV = recentView(mode, place);
  for (const c of Object.keys(CATS)) { const d = RV[c].findIndex(x => x.id === id) + 1; if (d) got[c] = d; }
  lastSubmit.set(ip, now);
  saveRanks();
  return { ok: true, id, key: e.key, mode, got, gotAll };
}
// 自動で載った記録に、あとから名前・ひとこと・国を付ける（登録した本人だけ: key を知っている・1 時間以内）
const lastEdit = new Map();
function editRank(p, m) {
  const now = Date.now(), id = String(m.id || ''), key = String(m.key || '');
  if (now - (lastEdit.get(p.ip) || 0) < 2000) return { ok: false, err: 'wait' };
  lastEdit.set(p.ip, now);
  const name = cleanName(m.name), comment = cleanText(m.comment, 60), country = /^[A-Z]{2}$/.test(m.country) ? m.country : 'ZZ';
  if (banned(p.ip, name, comment)) return { ok: false, err: 'ng' };
  const hit = [];
  for (const md of MODES) for (const R of [RANKS[md], RECENT[md]]) for (const pl of PLACES) for (const list of Object.values(R[pl] || {})) for (const e of list) if (e.id === id) hit.push([md, pl, e]);
  if (!hit.length) return { ok: false, err: 'gone' };
  if (hit.some(([, , e]) => !e.key || e.key !== key || now / 1000 - e.at > 3600)) return { ok: false, err: 'key' };
  for (const [, , e] of hit) Object.assign(e, { name, comment, country });
  // 名前が変わったので、同じ名前の重なりをもう一度まとめる（歴代。当日杯は見せる時にまとめる）
  for (const k of new Set(hit.map(([md, pl]) => md + ' ' + pl))) { const [md, pl] = k.split(' '); for (const c of Object.keys(CATS)) RANKS[md][pl][c] = uniqNames(RANKS[md][pl][c] || []); }
  saveRanks();
  return { ok: true };
}
function readRep(id) {
  if (!/^[0-9a-z]{1,12}$/.test(String(id))) return null;
  try { return JSON.parse(fs.readFileSync(path.join(REP_DIR, id + '.json'), 'utf8')); } catch { return null; }
}
function readDj(id) {
  if (!/^[0-9a-z]{1,12}$/.test(String(id))) return null;
  try { return JSON.parse(fs.readFileSync(path.join(DJ_DIR, id + '.json'), 'utf8')); } catch { return null; }
}
function readImg(id) {
  if (!/^[0-9a-z]{1,12}$/.test(String(id))) return null;
  try { return 'data:image/jpeg;base64,' + fs.readFileSync(path.join(IMG_DIR, id + '.jpg')).toString('base64'); } catch { return null; }
}
const cleanName = s => [...String(s || '').replace(/[\u0000-\u001f\u007f<>&"']/g, '').trim()].slice(0, NAME_MAX).join('') || '名無し';
const send = (p, msg) => { if (p.ws.readyState === 1) p.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg)); };
const r2 = v => Math.round(v * 100) / 100;
const num = (v, lo, hi, d = 0) => { v = Number(v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
const GHOST_SLOT = 1;
const flagsOf = c => (c.air ? 1 : 0) | (c.crashT > 0 ? 2 : 0) | (c.boosting ? 4 : 0) | (c.drift ? 8 : 0) | (c.tipped ? 16 : 0);

// 次のステージ: 前と違う町（昼夜もくじ引き）
const pickStage = prev => { const pl = String(prev || '').split('-')[0], list = PLACES.filter(p => p !== pl); return list[Math.floor(Math.random() * list.length)] + (Math.random() < 0.5 ? '-day' : '-night'); };
const rooms = new Set();
let nextId = 1, nextRoom = 1;

class Room {
  // legacy: 古い画面（v2: 4 台・4 チームまで）の人だけの部屋。ページを読み直すまではこちらで遊べる
  constructor(legacy = false) { this.legacy = legacy; this.max = legacy ? 4 : ROOM_MAX; this.id = freeRoomId(); this.players = new Map(); this.cpus = []; this.phase = 'wait'; this.phaseEnd = 0; this.startAt = 0; this.firstFin = 0; this.nextStage = legacy ? '' : pickStage('');   /* 最初のレースの町も先に決めておく（待機室の番付に使う） */ rooms.add(this); }
  broadcast(msg) { const d = JSON.stringify(msg); for (const p of this.players.values()) send(p, d); }
  info() {
    return {
      t: 'room', room: this.id, phase: this.phase, phaseEnd: this.phaseEnd, startAt: this.startAt, endAt: this.firstFin ? this.firstFin + T_AFTER : 0, next: this.nextStage || '', nextAt: this.phase === 'result' ? this.phaseEnd + T_JOIN + 2000 : this.phase === 'wait' ? this.phaseEnd : 0, now: Date.now(), laps: LAPS, stage: this.stage, hold: !!this.hold,
      board: onlineBoard(this.phase === 'race' ? this.stage : (this.nextStage || this.stage)),   // 待機室の番付 = ランキング（オンラインの部・当日杯・1 周タイム）のその町
      players: [...this.players.values()].map(p => ({ id: p.id, name: p.name, team: p.team, slot: p.slot, racing: p.racing, fin: p.fin, ghost: p.ghost ? { start: p.ghost.start, fin: p.ghost.fin } : null })),
      cpus: this.cpus.map(c => ({ id: c.id, name: 'CPU', team: c.team, slot: c.slot, fin: c.fin, cpu: true })),
    };
  }
  sync() { this.broadcast(this.info()); }
  add(p, wantTeam, ghost) {
    p.room = this; p.racing = false; p.slot = -1; p.fin = null; p.ghost = null;
    // レース中の部屋にゴーストで参加: 今からスタートラインを走る（当たり判定なし・順位には入らない）
    if (ghost && this.phase === 'race') {
      const now = Date.now(), c = SIM.gridCar(course, GHOST_SLOT);
      p.ghost = { start: now + T_COUNT, fin: null }; p.lastSt = 0;
      p.car = { x: c.x, z: c.z, y: c.y, yaw: c.yaw, roll: 0, pitch: 0, vx: 0, vz: 0, f: 0, prog: SIM.START_S };
    }
    const used = new Set([...this.players.values()].map(q => q.team));
    p.team = !used.has(wantTeam) && wantTeam >= 0 && wantTeam < this.max ? wantTeam : [0, 1, 2, 3, 4, 5, 6, 7].find(t => !used.has(t));
    this.players.set(p.id, p);
    // アイコン旗: 新しく来た人には部屋のみんなの分を、みんなには新しい人の分を
    for (const q of this.players.values()) if (q !== p && q.icon) send(p, q.icon);
    if (p.icon) for (const q of this.players.values()) if (q !== p) send(q, p.icon);
    this.updateHold(false);
    if (this.phase === 'wait') {
      const now = Date.now();
      this.phaseEnd = Math.max(this.phaseEnd || 0, now + (this.players.size === 1 ? T_WAIT : T_JOIN));
      if (this.players.size >= this.max) this.phaseEnd = Math.min(this.phaseEnd, now + T_FULL);
    }
    this.sync();
  }
  // 1 人で「だれか来るまで待つ」にしている間はカウントダウンを止める。解けたら 6 秒後に出発
  updateHold(sync = true) {
    if (this.phase !== 'wait') return;
    const ps = [...this.players.values()], hold = ps.length < 2 && ps.some(p => p.hold);
    if (hold === !!this.hold) return;
    this.hold = hold;
    if (!hold) this.phaseEnd = Date.now() + T_JOIN;
    if (sync) this.sync();
  }
  remove(p) {
    this.players.delete(p.id); p.room = null;
    if (!this.players.size) { rooms.delete(this); this.cpus = []; return; }
    this.updateHold(false);
    this.sync();
  }
  start(now) {
    const humans = [...this.players.values()].filter(p => !p.ghost);   // ゴースト走行中の人は次から
    // 人がいなければ（全員やめた）CPU だけで始めずに部屋を閉じる
    if (!this.players.size) { rooms.delete(this); return; }
    if (!humans.length) { this.phaseEnd = now + T_JOIN; return; }
    humans.forEach((p, i) => {
      p.racing = true; p.slot = SLOTS[i]; p.fin = null; p.lastSt = 0;
      const c = SIM.gridCar(course, p.slot);
      p.car = { x: c.x, z: c.z, y: c.y, yaw: c.yaw, roll: 0, pitch: 0, vx: 0, vz: 0, f: 0, prog: c.prog };
    });
    const freeTeams = [0, 1, 2, 3, 4, 5, 6, 7].filter(t => !humans.some(p => p.team === t));
    const freeSlots = SLOTS.slice(humans.length, Math.max(MIN_CARS, humans.length));
    this.cpus = freeSlots.map((slot, k) => {
      const car = SIM.gridCar(course, slot);
      return { id: `c${this.id}_${slot}`, team: freeTeams[k], slot, car, ai: SIM.makeAI(k), fin: null };
    });
    // ステージ（昼 / 夜）は部屋ごとにくじ引き（結果発表の時に決めておく）。みんな同じ町を走る
    this.stage = this.nextStage || pickStage(this.stage); this.nextStage = '';
    for (const p of humans) if (p.ip) onlineRun.set(p.ip, { at: Date.now(), place: String(this.stage || '').split('-')[0], fin: 0 });   // ランキング登録で「オンラインの記録」と認める（町が決まってから）
    // 町の壊れ具合は部屋ごと
    this.course = { ...course, ext: [new Float32Array(course.nb), new Float32Array(course.nb)] };
    this.phase = 'race'; this.startAt = now + T_COUNT; this.phaseEnd = this.startAt + T_RACE; this.firstFin = 0; this.allDoneAt = 0;
    this.sync();
  }
  finish(now) {
    const raceT = (now - this.startAt) / 1000;
    const all = [
      ...[...this.players.values()].filter(p => p.racing).map(p => ({ id: p.id, name: p.name, team: p.team, cpu: false, time: p.fin, prog: p.car.prog })),
      ...this.cpus.map(c => ({ id: c.id, name: 'CPU', team: c.team, cpu: true, time: c.fin, prog: c.car.prog })),
    ];
    all.forEach(e => { e.est = e.time == null; if (e.est) e.time = raceT + Math.max(0, GOAL - e.prog) / 18; });
    all.sort((a, b) => (a.est - b.est) || a.time - b.time);
    const list = all.map((e, i) => ({ rank: i + 1, id: e.id, name: e.name, team: e.team, cpu: e.cpu, time: r2(e.time), est: e.est }));
    for (const p of this.players.values()) { p.racing = false; p.slot = -1; }
    this.cpus = [];
    this.phase = 'result'; this.phaseEnd = now + T_RESULT;
    this.nextStage = pickStage(this.stage);   // 次は必ず前と違う町
    this.broadcast({ t: 'result', room: this.id, list });
    this.sync();
  }
  simulate(now, steps, dt) {
    const raceT = (now - this.startAt) / 1000;
    const humans = [...this.players.values()].filter(p => p.racing);
    let changed = false;
    for (let k = 0; k < steps; k++) {
      for (const c of this.cpus) {
        const inp = SIM.aiInput(c.car, this.course, c.ai, dt);
        if (c.fin != null) SIM.afterGoal(c.car, c.ai, inp, c.car.prog - GOAL, ((all, i) => all.filter((o, j) => o !== c && o.fin != null && (o.fin < c.fin || (o.fin === c.fin && j < i))).length)([...humans, ...this.cpus], humans.length + this.cpus.indexOf(c)));   // ゴール後は着順ごとに間をあけて止まる
        // 人間の先頭から離れすぎないように少しだけ手加減・追い上げ
        const lead = humans.length ? Math.max(...humans.map(p => p.car.prog)) : c.car.prog;
        if (c.fin == null && c.car.prog - lead > 90) inp.throttle *= 0.7;
        if (c.fin == null && lead - c.car.prog > 90) inp.boost = c.car.boost > 0.2;
        SIM.stepCar(c.car, inp, dt, this.course);
        if (c.fin == null && c.car.prog >= GOAL) { c.fin = r2(raceT); changed = true; }
      }
      for (let i = 0; i < this.cpus.length; i++) {
        if (this.cpus[i].fin != null) continue;   // ゴールした CPU はすり抜け
        for (let j = i + 1; j < this.cpus.length; j++) if (this.cpus[j].fin == null) SIM.collideCars(this.cpus[i].car, this.cpus[j].car, true);
        for (const p of humans) if (p.fin == null) SIM.collideCars(this.cpus[i].car, p.car, false);
      }
    }
    if (changed) this.sync();
  }
  tick(now, steps, dt) {
    for (const p of this.players.values()) if (p.ghost && now > p.ghost.start + T_RACE) { p.ghost = null; this.sync(); }
    if (this.phase === 'wait') {
      if (!this.hold && now >= this.phaseEnd) this.start(now);
    } else if (this.phase === 'race') {
      const racing = [...this.players.values()].filter(p => p.racing);
      if (!racing.length) { this.phase = 'wait'; this.cpus = []; this.phaseEnd = now + T_JOIN; this.hold = false; this.updateHold(false); this.sync(); return; }
      if (now >= this.startAt) this.simulate(now, steps, dt);
      // 全員ゴールしても 4 秒は走り抜ける様子を見せてから結果へ
      const done = racing.every(p => p.fin != null);
      if (done && !this.allDoneAt) this.allDoneAt = now;
      if ((done && now >= this.allDoneAt + 4000) || now >= this.phaseEnd || (this.firstFin && now >= this.firstFin + T_AFTER)) this.finish(now);
    } else if (this.phase === 'result') {
      if (now >= this.phaseEnd) { this.phase = 'wait'; this.phaseEnd = now + T_JOIN + 2000; this.hold = false; this.updateHold(false); this.sync(); }
    }
  }
  sendPositions() {
    const ghosts = [...this.players.values()].filter(q => q.ghost && q.ghost.fin == null);
    if (this.phase !== 'race' && !ghosts.length) return;
    const p = [];
    for (const q of this.players.values()) if (q.racing) { const c = q.car; p.push([q.id, c.x, c.z, c.y, c.yaw, c.roll, c.pitch, c.vx, c.vz, c.f, c.prog]); }
    for (const q of ghosts) { const c = q.car; p.push([q.id, c.x, c.z, c.y, c.yaw, c.roll, c.pitch, c.vx, c.vz, c.f | 32, c.prog]); }
    if (this.phase !== 'race') { this.broadcast({ t: 'pos', p }); return; }
    for (const k of this.cpus) { const c = k.car; p.push([k.id, r2(c.x), r2(c.z), r2(c.y), r2(c.yaw * 100) / 100, r2(c.roll), r2(c.pitch), r2(c.vx), r2(c.vz), flagsOf(c), r2(c.prog)]); }
    this.broadcast({ t: 'pos', p });
  }
}

// 部屋えらび: 待っている（結果発表中を含む）部屋のうち人の多い所へ。レース中の部屋には入れず、なければ新しい部屋
// 部屋番号は使い回す（空いている一番小さい番号）
function freeRoomId() { const used = new Set([...rooms].map(r => r.id)); let i = 1; while (used.has(i)) i++; return i; }
// レース中の部屋（観戦・ゴースト参加・その部屋で待つ の候補）
function racingRooms() {
  return [...rooms].filter(r => !r.legacy && r.phase === 'race' && r.players.size < r.max && [...r.players.values()].some(q => q.racing))
    .sort((a, b) => b.players.size - a.players.size)
    .map(r => ({ room: r.id, stage: r.stage, startAt: r.startAt, n: [...r.players.values()].filter(q => q.racing).length, names: [...r.players.values()].filter(q => q.racing).map(q => q.name).slice(0, 4) }));
}
function findRoom(legacy = false) {
  const open = [...rooms].filter(r => r.legacy === legacy && r.players.size < r.max && (r.phase === 'wait' || r.phase === 'result'));
  return open.sort((a, b) => b.players.size - a.players.size)[0] || new Room(legacy);
}

// ================= 試合後のシェア（/p/ID: X などに貼ると、その人のだんじりの写真と名前がカードに出る） =================
const SHARE_DIR = path.join(path.dirname(RANK_FILE), 'share');
const SHARE_KEEP = 5000;   // 古いものから消す
const SITE = 'https://danjiri.satoru.net';
const lastShare = new Map();   // IP → 最後に作った時刻
let shareMade = 0;
const okDj = dj => dj && Array.isArray(dj.stuck) && dj.stuck.length <= 80 && Array.isArray(dj.items) && dj.items.length <= 60
  && dj.stuck.every(e => e && ['p', 's', 'r', 'g'].includes(e.k) && Number.isInteger(e.i) && e.i >= 0 && e.i < 100000 && Array.isArray(e.L) && e.L.length === 16 && e.L.every(v => Number.isFinite(v) && Math.abs(v) < 1e4))
  && dj.items.every(it => Array.isArray(it) && typeof it[0] === 'string' && it[0].length <= 24 && Number.isInteger(it[1]) && it[1] > 0 && it[1] < 1000);
function makeShare(p, m) {
  const now = Date.now(), ip = p.ip || '?';
  if (now - (lastShare.get(ip) || 0) < 8000) return { ok: false, err: 'wait' };
  if (banned(ip, cleanName(m.name))) return { ok: false, err: 'ng' };
  const place = PLACES.includes(m.place) ? m.place : null;
  if (!place || typeof m.img !== 'string' || !m.img.startsWith('data:image/jpeg;base64,') || !okDj(m.dj)) return { ok: false, err: 'bad' };
  const buf = Buffer.from(m.img.slice(23), 'base64');
  if (buf.length < 3000 || buf.length > 400000 || buf[0] !== 0xff || buf[1] !== 0xd8) return { ok: false, err: 'img' };
  const st = m.st || {};
  const sh = {
    v: 1, name: cleanName(m.name), place, tod: m.tod === 'night' ? 'night' : 'day', laps: num(m.laps, 1, 3, 2) | 0, at: Math.floor(now / 1000),
    st: { rank: num(st.rank, 0, 8, 0) | 0, n: num(st.n, 0, 8, 0) | 0, time: r2(num(st.time, 0, 9999, 0)), kg: Math.round(num(st.kg, 0, 1e9, 0)), items: num(st.items, 0, 1e5, 0) | 0, smash: num(st.smash, 0, 1e5, 0) | 0, speed: Math.round(num(st.speed, 0, 999, 0)), drift: r2(num(st.drift, 0, 99, 0)), air: r2(num(st.air, 0, 99, 0)) },
    dj: { team: num(m.dj.team, 0, 7, 0) | 0, stuck: m.dj.stuck.map(e => ({ k: e.k, i: e.i, L: e.L })), items: m.dj.items.map(it => [cleanText(it[0], 24), it[1]]) },
  };
  const rec = m.rec;
  if (rec && Array.isArray(rec.f) && rec.f.length >= 70 && rec.f.length <= 7 * 4000 && rec.f.length % 7 === 0 && rec.f.every(v => Number.isInteger(v) && Math.abs(v) < 1e6)) sh.rec = { team: num(rec.team, 0, 7, 0) | 0, f: rec.f };
  const id = crypto.randomBytes(6).toString('base64url').replace(/[-_]/g, 'x').toLowerCase().slice(0, 8);
  try {
    fs.mkdirSync(SHARE_DIR, { recursive: true });
    fs.writeFileSync(path.join(SHARE_DIR, id + '.jpg'), buf);
    fs.writeFileSync(path.join(SHARE_DIR, id + '.json'), JSON.stringify(sh));
  } catch (e) { console.error(e); return { ok: false, err: 'save' }; }
  lastShare.set(ip, now);
  if (++shareMade % 50 === 0) pruneShares();
  return { ok: true, id };
}
function pruneShares() {
  try {
    const list = fs.readdirSync(SHARE_DIR).filter(f => f.endsWith('.json')).map(f => ({ f, t: fs.statSync(path.join(SHARE_DIR, f)).mtimeMs })).sort((a, b) => b.t - a.t);
    for (const { f } of list.slice(SHARE_KEEP)) { const id = f.slice(0, -5); for (const x of [id + '.json', id + '.jpg']) try { fs.unlinkSync(path.join(SHARE_DIR, x)); } catch { } }
  } catch { }
}
const shareId = id => (/^[0-9a-z]{6,12}$/.test(String(id)) ? String(id) : null);
function readShare(id) {
  id = shareId(id); if (!id) return null;
  try { return JSON.parse(fs.readFileSync(path.join(SHARE_DIR, id + '.json'), 'utf8')); } catch { return null; }
}
const PLACE_JA = { jp: '日本の町', paris: 'パリ', ny: 'ニューヨーク', giza: 'ギザ', venice: 'ベネチア' };
const kgText = kg => (kg >= 1000 ? `${(kg / 1000).toFixed(kg >= 1e4 ? 0 : 1)}トン` : `${kg}kg`);
const escH = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// ゲームの index.html をそのまま返し、カード用の meta だけ差し替える（<base> で js などは / から読む）
const INDEX = path.join(__dirname, '..', 'index.html');
function sharePage(id, sh) {
  let html = fs.readFileSync(INDEX, 'utf8');
  const s = sh.st, title = `${sh.name} のだんじり ― だんじり疾走`;
  const desc = [s.rank ? `${PLACE_JA[sh.place]}で${s.n ? s.n + '台中 ' : ''}${s.rank}位` : PLACE_JA[sh.place], s.items ? `ひっつけた物 ${s.items}個（${kgText(s.kg)}）` : '', s.smash ? `壊した数 ${s.smash}` : '', s.speed ? `最高 ${s.speed}km/h` : ''].filter(Boolean).join('・') + '。くっつけた物ごと 3D で見られます。';
  const img = `${SITE}/p/${id}.jpg`, url = `${SITE}/p/${id}`;
  const set = (attr, key, val) => { html = html.replace(new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`), `$1${escH(val)}$2`); };
  set('property', 'og:title', title); set('property', 'og:description', desc); set('property', 'og:url', url); set('property', 'og:image', img);
  set('name', 'twitter:title', title); set('name', 'twitter:description', desc); set('name', 'twitter:image', img); set('name', 'description', desc);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escH(title)}</title>`).replace('<head>', '<head>\n<base href="/">');
  return html;
}
const httpServer = http.createServer((req, res) => {
  const u = (req.url || '').split('?')[0];
  let m = u.match(/^\/p\/([0-9a-z]{6,12})\.jpg$/);
  if (m) {
    fs.readFile(path.join(SHARE_DIR, m[1] + '.jpg'), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' }); res.end(buf);
    });
    return;
  }
  m = u.match(/^\/p\/([0-9a-z]{6,12})$/);
  const sh = m && readShare(m[1]);
  if (!sh) { res.writeHead(302, { Location: '/' }); res.end(); return; }
  try { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }); res.end(sharePage(m[1], sh)); }
  catch (e) { console.error(e); res.writeHead(500); res.end(); }
});
httpServer.listen(PORT, '127.0.0.1');
const wss = new WebSocketServer({ server: httpServer, maxPayload: 480000 });
const ipConns = new Map(), tooManyLog = new Map();   // 送り元 → つないでいる本数 / 断ったログ（1 分に 1 回だけ）
// 1 人 1 台: 同じ送り元（IP）で部屋に入れるのは 1 人だけ。後から入った方を残し、前の人には知らせて部屋から出す
// オンラインに入れない送り元（不正対策が決める）: 部屋から出して、残り時間を知らせる
function holdOut(ip, p = null) {
  const ms = G.onlineHold(ip); if (!ms) return false;
  const msg = { t: 'hold', min: Math.ceil(ms / 60e3) };
  for (const r of rooms) for (const q of [...r.players.values()]) if (q.ip === ip) { send(q, msg); r.remove(q); }
  if (p) send(p, msg);
  return true;
}
function kickSameIp(p) {
  if (!p.ip) return;
  for (const r of rooms) for (const q of [...r.players.values()]) if (q !== p && q.ip === p.ip) { console.log('join: dup ip', p.ip, q.name, '->', p.name); send(q, { t: 'dup' }); r.remove(q); }
}
wss.on('connection', (ws, req) => {
  if (wss.clients.size > 400) { ws.close(1013, 'busy'); return; }
  const p = { id: nextId++, ws, name: '名無し', room: null, msgs: 0, msgT: Date.now(), ip: String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim() };   // Cloudflare 越しでも本当の送り元
  // 同じ送り元からのつなぎっぱなしは 8 本まで（ランキングを見るなどで一時的に増える分は許す）
  ipConns.set(p.ip, (ipConns.get(p.ip) || 0) + 1);
  ws.on('close', () => { const n = (ipConns.get(p.ip) || 1) - 1; if (n > 0) ipConns.set(p.ip, n); else ipConns.delete(p.ip); });
  if (p.ip && ipConns.get(p.ip) > 8) { const t = Date.now(); if (t - (tooManyLog.get(p.ip) || 0) > 60000) { tooManyLog.set(p.ip, t); console.log('conn: too many from', p.ip); } ws.close(1008, 'too many'); return; }
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  send(p, { t: 'hello', id: p.id, now: Date.now(), best: [], v: 2, chat: 1 });
  ws.on('message', raw => {
    const now = Date.now();
    if (now - p.msgT > 1000) { p.msgT = now; p.msgs = 0; }
    if (++p.msgs > 60) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    const room = p.room;
    if (['join', 'chat', 'rank', 'rankedit', 'share'].includes(m.t) && G.badTalk(m.name, m.comment, m.text)) { mark(p, m.t, [m.name, m.comment, m.text].map(t => cleanText(t, 60))); if (m.t === 'chat') return; }   // そのチャットは流さない
    switch (m.t) {
      case 'ping': send(p, { t: 'pong', c: Number(m.c) || 0, s: now }); break;
      case 'join':
        if (m.v !== 2 && m.v !== 3) { send(p, { t: 'old' }); break; }
        if (holdOut(p.ip, p)) break;
        const legacy = m.v === 2;
        if (room) room.remove(p);
        p.name = cleanName(m.name);
        kickSameIp(p);
        p.watch = m.how === 'watch';
        { // how: wait / watch / ghost は指定のレース中の部屋へ（いっぱい・終わっていたら普通の部屋えらび）
          // 部屋えらび画面から: 指定の部屋（空きがあれば）/ 新しい部屋
          if (!legacy && m.how === 'new') { new Room().add(p, Number(m.team)); break; }
          if (!legacy && m.how === 'room') { const r = [...rooms].find(r => r.id === Number(m.room) && !r.legacy && r.players.size < r.max); (r || findRoom()).add(p, Number(m.team)); break; }
          const want = !legacy && ['wait', 'watch', 'ghost'].includes(m.how) ? [...rooms].find(r => r.id === Number(m.room) && !r.legacy && r.phase === 'race' && r.players.size < r.max) : null;
          (want || findRoom(legacy)).add(p, Number(m.team), want && m.how === 'ghost');
        }
        break;
      case 'rooms': { // 部屋えらび画面: 部屋番号・状況・人数
        const list = [...rooms].filter(r => !r.legacy).sort((a, b) => a.id - b.id).map(r => ({ room: r.id, phase: r.phase, stage: r.stage || '', n: r.players.size, max: r.max, hold: !!r.hold, phaseEnd: r.phaseEnd, startAt: r.startAt, names: [...r.players.values()].map(q => q.name).slice(0, 8) }));
        send(p, { t: 'rooms', list, now, me: room ? room.id : 0 });
        break;
      }
      case 'peek': { // みんなで を押した時: レース中の部屋があれば、どうするか選んでもらう
        if (holdOut(p.ip, p)) break;
        const waiting = [...rooms].some(r => !r.legacy && r.phase !== 'race' && r.players.size > 0 && r.players.size < r.max);
        send(p, { t: 'peek', races: waiting ? [] : racingRooms(), now });
        break;
      }
      case 'leave': if (room) room.remove(p); break;
      case 'rank': { const res = submitRank(p, m); send(p, { t: 'rankres', ...res }); break; }
      case 'rankedit': { const res = editRank(p, m); send(p, { t: 'rankeditres', ...res }); break; }
      case 'share': { const res = makeShare(p, m); send(p, { t: 'shareres', ...res }); break; }
      case 'shareget': { const sh = readShare(m.id); send(p, { t: 'shareget', id: shareId(m.id), sh }); break; }
      case 'ranks': { // scope: day = 当日杯（直近 12 時間） / それ以外 = 歴代。mode: online = オンライン / cheat = 改造 / それ以外 = 1P
        const pl = PLACES.includes(m.place) ? m.place : 'jp', day = m.scope === 'day', md = ['online', 'cheat'].includes(m.mode) ? m.mode : 'solo', R = md === 'cheat' ? cheatView(pl, day) : day ? recentView(md, pl) : RANKS[md][pl];
        send(p, { t: 'ranks', place: pl, scope: day ? 'day' : 'all', mode: md, hours: RECENT_MS / 3600e3, cats: Object.fromEntries(Object.entries(R).map(([c, l]) => [c, l.map(({ ip, key, ...e }) => e)])) }); break; }
      case 'rankfind': { // 記録ごとの URL (?r=ID): その記録の町と、載っている部門・順位
        const id = String(m.id || ''); let place = null, scope = 'all', mode = 'solo'; const at = {};
        for (const md of MODES) if (!place) for (const pl of PLACES) for (const [c, list] of Object.entries(RANKS[md][pl] || {})) { const i = list.findIndex(x => x.id === id); if (i >= 0) { place = pl; mode = md; at[c] = i + 1; } }
        for (const md of MODES) if (!place) for (const pl of PLACES) for (const [c, list] of Object.entries(recentView(md, pl))) { const i = list.findIndex(x => x.id === id); if (i >= 0) { place = pl; mode = md; scope = 'day'; at[c] = i + 1; } }   // 歴代に入らなかった直近の記録
        if (!place) for (const pl of PLACES) if (CHEATS[pl].some(x => x.id === id)) { place = pl; mode = 'cheat'; for (const [c, list] of Object.entries(cheatView(pl, false))) { const i = list.findIndex(x => x.id === id); if (i >= 0) at[c] = i + 1; } }   // 改造
        send(p, { t: 'rankfind', id, place, scope, mode, at }); break;
      }
      case 'rankimg': send(p, { t: 'rankimg', id: String(m.id || ''), data: readImg(m.id) }); break;
      case 'rankdj': send(p, { t: 'rankdj', id: String(m.id || ''), dj: readDj(m.id) }); break;
      case 'rankrep': send(p, { t: 'rankrep', id: String(m.id || ''), rec: readRep(m.id) }); break;
      case 'chat': { // 試合後・待合室のひとこと（40 字・1.5 秒に 1 回まで）
        const text = cleanText(m.text, 40);
        if (!room || !text || now - (p.lastChat || 0) < 1500) break;
        p.lastChat = now;
        room.broadcast({ t: 'chat', id: p.id, name: p.name, team: p.team, text });
        break;
      }
      case 'like': { // 表彰のいいね!（まとめて送られてくる。部屋のほかの人へ）
        if (!room || now - (p.lastLike || 0) < 250) break;
        p.lastLike = now;
        const to = String(m.to || '').slice(0, 16), n = num(m.n, 1, 30, 1) | 0;
        if (!/^[0-9a-z_]+$/i.test(to)) break;
        for (const q of room.players.values()) if (q !== p) send(q, { t: 'like', id: p.id, to, n });
        break;
      }
      case 'icon': { // だんじりカスタム: 旗のアイコン（128px の JPEG、20 KB まで）・幟の文字（4 文字）・仕上げ
        let d = typeof m.data === 'string' ? m.data : '';
        if (d && (!d.startsWith('data:image/jpeg;base64,') || d.length > 28000)) d = '';
        if (d) { const buf = Buffer.from(d.slice(23), 'base64'); if (buf.length < 200 || buf[0] !== 0xff || buf[1] !== 0xd8) d = ''; }
        const txt = [...cleanText(m.txt, 8).replace(/[\s&"']/g, '')].slice(0, 4).join(''), dj = num(m.dj, 0, 4, 0) | 0, fm = num(m.fm, 0, 4, 0) | 0;
        const c = m.cw && typeof m.cw === 'object' ? m.cw : {};
        const cw = { face: !!c.face, hair: num(c.hair, 0, 4, 0) | 0, outfit: num(c.outfit, 0, 4, 0) | 0, mark: ['def', 'txt', 'img'].includes(c.mark) ? c.mark : 'def', mtext: [...cleanText(c.mtext, 4).replace(/[\s&"']/g, '')].slice(0, 2).join('') };
        p.icon = { t: 'icon', id: p.id, data: d, txt, dj, fm, cw, ty: num(m.ty, 0, 4, 0) | 0, fl: ['both', 'back', 'front', 'single'].includes(m.fl) ? m.fl : 'both' };
        if (room && p.icon) for (const q of room.players.values()) if (q !== p) send(q, p.icon);
        break;
      }
      case 'hold': p.hold = !!m.on; if (room) room.updateHold(); break;
      case 'stats': { // トップ画面の人数表示: 待っている人・レース中の人
        let wait = 0, play = 0;
        for (const r of rooms) for (const q of r.players.values()) { if (r.phase === 'race' && q.racing) play++; else wait++; }
        send(p, { t: 'stats', wait, play });
        break;
      }
      case 'st': {
        const g = p.ghost;
        if (!room || (g ? g.fin != null || now < g.start : room.phase !== 'race' || !p.racing || now < room.startAt)) break;   // ゴール後も位置は受け取る
        const dtS = p.lastSt ? (now - p.lastSt) / 1000 : (now - (g ? g.start : room.startAt)) / 1000;
        p.lastSt = now;
        const c = p.car;
        const prog = num(m.p, -1e6, 1e6, c.prog);
        c.prog = Math.min(prog, c.prog + VMAX * dtS + 5);
        c.x = num(m.x, -500, 700, c.x); c.z = num(m.z, -500, 800, c.z); c.y = num(m.y, -20, 60, c.y);
        c.yaw = num(m.yaw, -4, 4); c.roll = num(m.roll, -2, 2); c.pitch = num(m.pitch, -2, 2);
        c.vx = num(m.vx, -VMAX, VMAX); c.vz = num(m.vz, -VMAX, VMAX); c.f = m.f & 31;
        break;
      }
      case 'fin': {
        if (room && p.ghost && p.ghost.fin == null) { // ゴーストのゴール（順位・番付には入れない）
          const t = (now - p.ghost.start) / 1000;
          if (p.car.prog < GOAL - 15 || t < (GOAL - SIM.START_S) / VMAX) break;
          p.ghost = null; room.sync();
          break;
        }
        if (!room || room.phase !== 'race' || !p.racing || p.fin != null) break;
        if (p.car.prog < GOAL - 15) break;
        const t = (now - room.startAt) / 1000;
        if (t < (GOAL - SIM.START_S) / VMAX) break;
        p.fin = r2(t);
        { const ol = onlineRun.get(p.ip); if (ol) { ol.fin = p.fin; ol.at = now; } }
        if (!room.firstFin) room.firstFin = now;
        addBest(p, p.fin);
        room.sync();
        break;
      }
    }
  });
  ws.on('close', () => { if (p.room) p.room.remove(p); });
  ws.on('error', () => {});
});

// 物理は 60Hz（30Hz の刻みで 2 歩ずつ）、位置の配信は 15Hz
let last = Date.now(), n = 0, accum = 0;
setInterval(() => {
  const now = Date.now();
  accum += Math.min(0.2, (now - last) / 1000); last = now; n++;
  let steps = 0; while (accum >= 1 / 60 && steps < 8) { accum -= 1 / 60; steps++; }
  for (const r of [...rooms]) { r.tick(now, steps, 1 / 60); if (n % 2 === 0) r.sendPositions(); }
}, 1000 / 30);
setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; ws.ping(); } }, 30000);

saveRanks();   // 起動時に弾いた記録（改造へ移したもの）を書き残す
console.log(`danjiri race server v2 on 127.0.0.1:${PORT} (L=${course.L.toFixed(1)}m, goal=${GOAL.toFixed(1)}m)`);
