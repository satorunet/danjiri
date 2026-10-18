// 音: 鳴物（太鼓・鉦・笛）と走り・ぶつかり・歓声の効果音。すべて Web Audio で合成
const A = { ctx: null, master: null, noise: null, muted: false, loops: {}, mus: { on: false, step: 0, time: 0, start: 0 } };
export const audio = A;
const STEP = 60 / 160 / 4; // 160 BPM の 16 分音符

export function initAudio() {
  if (A.ctx) { A.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = new AC(); A.ctx = ctx;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.connect(ctx.destination);
  A.master = ctx.createGain(); A.master.gain.value = A.muted ? 0 : 0.8; A.master.connect(comp);
  A.musBus = ctx.createGain(); A.musBus.gain.value = 0.7; A.musBus.connect(A.master);
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  A.noise = b;
  const loop = (type, f, q) => {
    const s = ctx.createBufferSource(); s.buffer = b; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(fl).connect(g).connect(A.master); s.start(); return { g, fl };
  };
  A.loops.crowd = loop('bandpass', 950, 0.5);
  A.loops.rumble = loop('lowpass', 120, 0.9);
  A.loops.skid = loop('bandpass', 1500, 3);
  A.loops.wind = loop('highpass', 2500, 0.5);
}
export const now = () => (A.ctx ? A.ctx.currentTime : performance.now() / 1000);
export function setMuted(m) { A.muted = m; if (A.master) A.master.gain.value = m ? 0 : 0.8; }

function noiseHit(t, vol, type, freq, dur, q = 1, bus = A.master) {
  const c = A.ctx, s = c.createBufferSource(); s.buffer = A.noise;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(bus); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
}
function tone(t, type, f0, f1, vol, dur, bus = A.master) {
  const c = A.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.05);
}
function taiko(t, vol = 1, pitch = 1) { tone(t, 'sine', 150 * pitch, 52 * pitch, vol, 0.45, A.musBus); noiseHit(t, 0.22 * vol, 'lowpass', 1400, 0.07, 1, A.musBus); }
function kane(t, vol) {
  const c = A.ctx, g = c.createGain(), hp = c.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 900;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  hp.connect(g).connect(A.musBus);
  for (const f of [1630, 2470, 3710]) { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f; const og = c.createGain(); og.gain.value = 0.25; o.connect(og).connect(hp); o.start(t); o.stop(t + 0.18); }
}
function fue(t, freq, dur, vol) {
  const c = A.ctx, o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  lfo.frequency.value = 5.8; lg.gain.value = freq * 0.012; lfo.connect(lg).connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.03);
  g.gain.setValueAtTime(vol, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(A.musBus); o.start(t); o.stop(t + dur + 0.02); lfo.start(t); lfo.stop(t + dur + 0.02);
  noiseHit(t, vol * 0.4, 'bandpass', freq, dur, 8, A.musBus);
}
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// 音名 → 周波数（C4, F#4, Bb3 のような書き方）
const noteF = n => { const m = /^([A-G])([#b]?)(\d)$/.exec(n); const k = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); return 440 * Math.pow(2, (12 * (+m[3] + 1) + k - 69) / 12); };
const FUE = ['D5', 'F5', 'G5', 'A5', 'A5', null, 'C6', 'A5', 'G5', null, 'A5', 'G5', 'F5', 'D5', 'F5', null,
  'G5', 'A5', 'C6', 'D6', 'C6', null, 'A5', 'G5', 'A5', null, 'G5', 'F5', 'D5', null, null, null];

// 鳴物。start は最初の拍の時刻、countIn 拍ぶんは太鼓だけ
export function startMusic(start, countIn = 4, mode = 'race', track = 'jp') { if (!A.ctx) return; A.mus = { on: true, step: 0, time: start - countIn * STEP * 4, start, mode, track: TRACKS[track] ? track : 'jp' }; }

// ================= レース中の曲（町ごと）。どの曲も頭拍に太鼓を入れて、だんじりらしさを残す =================
const MB = () => A.musBus;
// 楽器
function osc(t, type, f, vol, dur, { a = 0.008, lp = 0, q = 0.7, vib = 0, detune = 0 } = {}) {
  const c = A.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = f; o.detune.value = detune;
  if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.5; lg.gain.value = f * vib; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.setValueAtTime(vol, t + Math.max(a, dur * 0.7)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let out = o;
  if (lp) { const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp; f2.Q.value = q; o.connect(f2); out = f2; }
  out.connect(g).connect(MB()); o.start(t); o.stop(t + dur + 0.05);
}
const accordion = (t, n, dur, vol = 0.05) => { const f = noteF(n); osc(t, 'sawtooth', f, vol, dur, { lp: 2400, vib: 0.004, a: 0.02 }); osc(t, 'square', f, vol * 0.6, dur, { lp: 1800, detune: 9, a: 0.02 }); };
const bass = (t, n, dur, vol = 0.22) => { const f = noteF(n); osc(t, 'triangle', f, vol, dur, { a: 0.004 }); osc(t, 'sine', f / 2, vol * 0.6, dur * 0.8, { a: 0.004 }); };
const pluck = (t, n, vol = 0.07) => { const c = A.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = noteF(n); f.type = 'lowpass'; f.frequency.setValueAtTime(4000, t); f.frequency.exponentialRampToValueAtTime(600, t + 0.15); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); o.connect(f).connect(g).connect(MB()); o.start(t); o.stop(t + 0.2); };
const brass = (t, ns, dur, vol = 0.05) => { for (const n of ns) { const c = A.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = noteF(n); f.type = 'lowpass'; f.frequency.setValueAtTime(600, t); f.frequency.linearRampToValueAtTime(3200, t + 0.04); f.frequency.exponentialRampToValueAtTime(900, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(f).connect(g).connect(MB()); o.start(t); o.stop(t + dur + 0.05); } };
const hat = (t, vol = 0.07, open = false) => noiseHit(t, vol, 'highpass', 7500, open ? 0.18 : 0.04, 1, MB());
const snare = (t, vol = 0.3) => { noiseHit(t, vol, 'bandpass', 1900, 0.16, 0.8, MB()); tone(t, 'triangle', 220, 140, vol * 0.5, 0.1, MB()); };
const kick = (t, vol = 0.6) => tone(t, 'sine', 120, 45, vol, 0.25, MB());
const dum = (t, vol = 0.5) => { tone(t, 'sine', 170, 80, vol, 0.3, MB()); noiseHit(t, vol * 0.2, 'lowpass', 500, 0.08, 1, MB()); };
const tek = (t, vol = 0.25) => { noiseHit(t, vol, 'highpass', 3500, 0.05, 1, MB()); tone(t, 'triangle', 900, 700, vol * 0.4, 0.04, MB()); };
const mizmar = (t, n, dur, vol = 0.05) => { const f = noteF(n); osc(t, 'square', f, vol, dur, { lp: 2200, q: 3, vib: 0.012, a: 0.03 }); osc(t, 'sawtooth', f * 2, vol * 0.25, dur, { lp: 3000, a: 0.03 }); };
const tamb = (t, vol = 0.08) => { noiseHit(t, vol, 'highpass', 6000, 0.09, 1, MB()); noiseHit(t + 0.02, vol * 0.6, 'bandpass', 9000, 0.06, 4, MB()); };
// 旋律を 8 分音符（2 ステップ）ごとに鳴らす。null は前の音を伸ばす
function melody(seq, st, t, play, stepLen = 2) {
  if (st % stepLen) return;
  const ei = (st / stepLen) % seq.length, nt = seq[ei];
  if (!nt || nt === '-') return;
  let len = 1; while (len < 6 && seq[(ei + len) % seq.length] === null) len++;
  play(t, nt, len * STEP * stepLen * 0.92);
}
const taikoPulse = (st, t, k = 1) => { if (st % 16 === 0) taiko(t, 0.8 * k); else if (st % 16 === 8) taiko(t, 0.5 * k, 1.1); };
// 日本の町 1: いつもの地車囃子
function trackJp(st, t, it) {
  if (st % 8 === 0) taiko(t, 1.0);
  else if (st % 4 === 0) taiko(t, 0.5, 1.15);
  if (st % 16 === 14 || (it > 0.6 && st % 16 === 15)) taiko(t, 0.38, 1.1);
  const k8 = st % 8;
  if (k8 !== 1 && k8 !== 5) kane(t, k8 === 0 || k8 === 4 ? 0.12 : 0.06);
  melody(FUE, st, t, (t, n, d) => fue(t, noteF(n), d, 0.055));
}
// 日本の町 2: きざみ（太鼓が細かく刻む勇ましい節）
const FUE3 = ['A5', 'C6', 'D6', null, 'C6', 'A5', 'G5', null, 'A5', null, 'C6', 'D6', 'E6', null, 'D6', null,
  'C6', 'A5', 'C6', null, 'G5', 'A5', 'E5', null, 'G5', 'A5', 'G5', 'E5', 'D5', null, null, null];
function trackJp2(st, t, it) {
  const b = st % 16;
  if (b === 0 || b === 6 || b === 10) taiko(t, 0.95, b ? 1.08 : 1);
  else if (b % 2 === 0) taiko(t, 0.32, 1.25);
  else if (it > 0.5 && (b === 13 || b === 15)) taiko(t, 0.26, 1.3);
  if (st % 4 === 0) kane(t, 0.12); else if (st % 2 === 0) kane(t, 0.05);
  melody(FUE3, st, t, (t, n, d) => fue(t, noteF(n), d, 0.055));
}
// パリ: ミュゼット（アコーディオンの旋律と、ベース・和音の伴奏）
const PARIS_M = ['E5', 'F5', 'G5', null, 'C6', null, 'B5', 'A5', 'G5', null, 'E5', null, 'F5', 'E5', 'D5', null,
  'D5', 'E5', 'F5', null, 'B5', null, 'A5', 'G5', 'F5', null, 'D5', null, 'E5', 'D5', 'C5', null,
  'C5', 'E5', 'G5', 'C6', 'E6', null, 'D6', 'C6', 'B5', 'A5', 'G5', null, 'A5', 'B5', 'C6', null,
  'A5', 'G5', 'F5', 'E5', 'D5', null, 'G5', null, 'C5', null, null, null, '-', null, null, null];
const PARIS_C = [['C3', ['E4', 'G4', 'C5']], ['G2', ['D4', 'F4', 'B4']], ['C3', ['E4', 'G4', 'C5']], ['F2', ['F4', 'A4', 'C5']]];
function trackParis(st, t, it) {
  taikoPulse(st, t, 0.8);
  const bar = Math.floor(st / 16) % 4, [bn, ch] = PARIS_C[bar], b = st % 16;
  if (b === 0 || b === 8) bass(t, bn, STEP * 3, 0.2);
  if (b === 4 || b === 12) ch.forEach(n => accordion(t, n, STEP * 2.5, 0.022));
  if (b === 6 || b === 14) ch.forEach(n => accordion(t, n, STEP * 1.5, 0.016));
  if (st % 4 === 2) hat(t, 0.03);
  melody(PARIS_M, st, t, (t, n, d) => accordion(t, n, d, 0.05));
}
// NY: 祭り囃子 × ファンク（太鼓・鉦・笛のきざみに、うねるベースと金管の合いの手）
const NY_F = ['E5', 'G5', 'A5', null, 'B5', 'A5', 'G5', null, 'E5', null, 'D5', 'E5', 'G5', null, null, null,
  'A5', 'B5', 'D6', null, 'B5', 'A5', 'G5', 'A5', 'E5', null, 'D5', null, 'E5', null, null, null];
function trackNy(st, t, it) {
  const b = st % 16, bar = Math.floor(st / 16) % 4;
  if (b === 0 || b === 6 || b === 10) taiko(t, 0.9, b ? 1.08 : 1);
  else if (b % 2 === 0) taiko(t, 0.3, 1.25);
  if (st % 4 === 0) kane(t, 0.11); else if (st % 2 === 0) kane(t, 0.045);
  melody(NY_F, st, t, (t, n, d) => fue(t, noteF(n), d, 0.05));
  if (st % 4 === 0) bass(t, NY_B[(st / 4) % NY_B.length], STEP * 3.2, 0.2);
  if (b === 4 || b === 12) snare(t, 0.16);
  if ((b === 14) && bar !== 3) brass(t, ['E4', 'G4', 'B4', 'D5'], STEP * 1.6, 0.025);
  if (bar === 3 && (b === 0 || b === 3 || b === 6)) brass(t, ['A4', 'C5', 'E5'], STEP * 2.4, 0.03);
}
const NY_B = ['E2', 'E2', 'G2', 'A2', 'E2', 'E2', 'D3', 'B2', 'A2', 'A2', 'C3', 'D3', 'E2', 'G2', 'A2', 'B2'];
// ギザ: ダルブッカ（マクスーム）と、ミズマールのヒジャーズ音階
const GIZA_M = ['D5', 'Eb5', 'F#5', null, 'G5', null, 'A5', 'Bb5', 'A5', null, 'G5', 'F#5', 'Eb5', null, 'D5', null,
  'G5', 'A5', 'Bb5', null, 'C6', 'Bb5', 'A5', null, 'G5', 'F#5', 'G5', 'A5', 'F#5', 'Eb5', 'D5', null,
  'D6', null, 'C6', 'Bb5', 'A5', null, 'G5', 'A5', 'Bb5', 'A5', 'G5', 'F#5', 'G5', null, null, null,
  'F#5', 'G5', 'A5', 'G5', 'F#5', 'Eb5', 'F#5', null, 'Eb5', 'D5', null, null, '-', null, null, null];
function trackGiza(st, t, it) {
  const b = st % 16;
  if (b === 0) taiko(t, 0.7);
  // マクスーム: ドゥム・テク・・テク・ドゥム・・テク・
  if (b === 0 || b === 6) dum(t, 0.5); if (b === 2 || b === 8 || b === 12) tek(t, 0.22); if (b === 10) dum(t, 0.4);
  if (it > 0.5 && (b === 14 || b === 15)) tek(t, 0.14);
  if (b === 0 || b === 8) bass(t, b ? 'A2' : 'D2', STEP * 6, 0.14);
  melody(GIZA_M, st, t, (t, n, d) => mizmar(t, n, d, 0.045));
}
// ベネチア: タランテラ（マンドリンのトレモロ・アコーディオン・タンバリン）
const VEN_M = ['A5', null, 'C6', 'B5', 'A5', null, 'E5', null, 'A5', null, 'C6', 'E6', 'D6', null, 'C6', null,
  'B5', null, 'D6', 'C6', 'B5', null, 'E5', null, 'G#5', 'A5', 'B5', 'C6', 'B5', null, 'A5', null,
  'E6', null, 'D6', 'C6', 'B5', 'C6', 'D6', null, 'C6', null, 'B5', 'A5', 'G#5', null, 'E5', null,
  'A5', 'B5', 'C6', 'B5', 'A5', null, 'G#5', null, 'A5', null, null, null, '-', null, null, null];
const VEN_C = [['A2', ['A4', 'C5', 'E5']], ['E2', ['G#4', 'B4', 'E5']], ['A2', ['A4', 'C5', 'E5']], ['E2', ['G#4', 'B4', 'D5']]];
function trackVenice(st, t, it) {
  taikoPulse(st, t, 0.75);
  const bar = Math.floor(st / 16) % 4, [bn, ch] = VEN_C[bar], b = st % 16;
  if (b % 6 === 0 && b < 13) bass(t, bn, STEP * 2, 0.18);
  if (b % 6 === 3) ch.forEach(n => accordion(t, n, STEP * 1.6, 0.018));
  if (b % 3 === 0) tamb(t, b % 6 === 0 ? 0.09 : 0.05);
  // マンドリンのトレモロ: 旋律の音を 16 分で刻む
  const ei = Math.floor(st / 2) % VEN_M.length;
  let k = ei; while (VEN_M[k] === null && k > 0) k--;
  const nt = VEN_M[k];
  if (nt && nt !== '-') pluck(t, nt, 0.06);
}
const TRACKS = { jp: trackJp, jp2: trackJp2, paris: trackParis, ny: trackNy, giza: trackGiza, venice: trackVenice };
// 待合室のお囃子: ゆったりした地車囃子（太鼓・鉦・笛）。レースの曲より少し静か
const FUE2 = ['A5', null, 'G5', 'A5', 'C6', null, 'A5', null, 'G5', 'E5', 'G5', null, 'A5', null, null, null,
  'C6', null, 'D6', 'C6', 'A5', null, 'G5', null, 'A5', 'G5', 'E5', null, 'D5', null, null, null];
function lobbyStep(st, t) {
  const b = st % 16;
  if (b === 0) taiko(t, 0.75); else if (b === 8) taiko(t, 0.6, 1.05); else if (b === 12 || b === 14) taiko(t, 0.35, 1.2); else if (b === 15) taiko(t, 0.25, 1.25);
  if (st % 4 === 2) kane(t, 0.05); else if (st % 4 === 0) kane(t, 0.08);
  if (st % 2 === 0) {
    const ei = (st / 2) % FUE2.length, nt = FUE2[ei];
    if (nt) { let len = 1; while (len < 4 && FUE2[(ei + len) % FUE2.length] === null) len++; fue(t, noteF(nt), len * STEP * 2 * 1.25 * 0.95, 0.045); }
  }
}
export function stopMusic() { A.mus.on = false; }
export function musicBeat() { return A.ctx && A.mus.on ? (A.ctx.currentTime - A.mus.start) / (STEP * 4) : performance.now() / 1000 / (STEP * 4); }
export function scheduleMusic(intensity = 1) {
  const m = A.mus;
  if (!A.ctx || !m.on) return;
  while (m.time < A.ctx.currentTime - 0.05) { m.step++; m.time += STEP * (m.mode === 'lobby' ? 1.25 : 1); }
  while (m.time < A.ctx.currentTime + 0.15) {
    const st = m.step, t = m.time;
    if (m.mode === 'lobby') { lobbyStep(st, t); m.step++; m.time += STEP * 1.25; continue; }
    if (t < m.start - 0.01) { if (st % 4 === 0) taiko(t, 0.9, st % 16 === 12 ? 1.3 : 1); }
    else (TRACKS[m.track] || trackJp)(st, t, intensity);
    m.step++; m.time += STEP;
  }
}

// 走りの音（毎フレーム）
export function engine(speed, slip, air, crowdNear, racing) {
  if (!A.ctx) return;
  const t = A.ctx.currentTime, L = A.loops;
  L.rumble.g.gain.setTargetAtTime(racing && !air ? Math.min(0.45, speed * 0.018) : 0, t, 0.08);
  L.rumble.fl.frequency.setTargetAtTime(80 + speed * 5, t, 0.1);
  L.skid.g.gain.setTargetAtTime(racing && !air ? Math.min(0.08, Math.max(0, slip - 7) * 0.012) : 0, t, 0.05);
  L.wind.g.gain.setTargetAtTime(racing ? Math.min(0.08, Math.max(0, speed - 15) * 0.006 + (air ? 0.05 : 0)) : 0, t, 0.2);
  // 人垣のざわめき: ずっと鳴る雑音にならないよう小さく、ゆっくり波打たせる（歓声は cheer で別に鳴る）
  L.crowd.g.gain.setTargetAtTime((0.004 + crowdNear * 0.012) * (0.6 + 0.4 * Math.sin(t * 0.7)), t, 0.4);
}
// 引き手の駆け足（ザッザッザッ）。速いほどテンポが上がり、大勢なので少しずつずれて重なる。水の上はバシャバシャ
let stepNext = 0, stepK = 0;
export function footsteps(speed, air, racing, water = false) {
  if (!A.ctx || !racing || air || speed < 1.5) { stepNext = 0; return; }
  const t = A.ctx.currentTime;
  if (stepNext < t - 0.5) stepNext = t;
  while (stepNext < t + 0.08) {
    const iv = Math.max(0.15, 0.38 - speed * 0.009), vol = Math.min(0.32, 0.08 + speed * 0.009);
    for (let k = 0; k < 4; k++) {
      const tt = stepNext + Math.random() * 0.06, v = vol * (0.6 + Math.random() * 0.5) * (k === 0 ? 1.2 : 0.75);
      if (water) { noiseHit(tt, v * 1.1, 'bandpass', 1200 + Math.random() * 900, 0.12, 1.2); noiseHit(tt + 0.02, v * 0.5, 'highpass', 3000, 0.08); }
      else { noiseHit(tt, v, 'bandpass', 500 + Math.random() * 400 + (stepK % 2) * 120, 0.06, 1.4); noiseHit(tt, v * 0.5, 'lowpass', 220, 0.05); }
    }
    stepK++; stepNext += iv;
  }
}
export function sfx(kind, power = 1) {
  if (!A.ctx) return;
  const t = A.ctx.currentTime;
  if (kind === 'crash') { tone(t, 'sine', 90, 40, 1.2, 0.6); noiseHit(t, 1.0, 'lowpass', 900, 0.6); noiseHit(t + 0.02, 0.6, 'bandpass', 2400, 0.3, 2); noiseHit(t + 0.1, 0.4, 'bandpass', 1400, 0.4, 3); }
  else if (kind === 'wall') { tone(t, 'sine', 120, 60, Math.min(0.7, power * 0.08), 0.25); noiseHit(t, Math.min(0.5, power * 0.06), 'bandpass', 1800, 0.18, 2); }
  else if (kind === 'smash') { noiseHit(t, 0.5, 'bandpass', 2200 + Math.random() * 800, 0.15, 4); noiseHit(t + 0.03, 0.35, 'highpass', 3000, 0.12); tone(t, 'triangle', 300, 120, 0.15, 0.12); }
  else if (kind === 'land') { tone(t, 'sine', 70, 35, Math.min(1.2, 0.3 + power * 0.06), 0.4); noiseHit(t, Math.min(0.8, power * 0.05), 'lowpass', 600, 0.35); }
  else if (kind === 'launch') { noiseHit(t, 0.25, 'highpass', 1800, 0.5); }
  else if (kind === 'boost') {
    const c = A.ctx, s = c.createBufferSource(); s.buffer = A.noise;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3000, t + 0.5);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    s.connect(f).connect(g).connect(A.master); s.start(t); s.stop(t + 0.9);
    taiko(t, 1.1, 0.9); taiko(t + 0.12, 1.1, 0.9);
  }
  else if (kind === 'turnNext') { taiko(t, 1.0, 1.1); tone(t + 0.02, 'sine', 2200, 2400, 0.22, 0.45); }   // 次は右/左: 笛「ピーッ」と太鼓
  else if (kind === 'turnNow') { for (let k = 0; k < 3; k++) tone(t + k * 0.13, 'square', 2600, 2800, 0.12, 0.1); taiko(t, 1.2, 0.9); }   // 右へ!!: 笛「ピピピッ」
  else if (kind === 'siren') { for (let k = 0; k < 4; k++) tone(t + k * 0.3, 'square', k % 2 ? 960 : 720, 0, 0.06, 0.28); }
  else if (kind === 'join') { tone(t, 'sine', 988, 0, 0.35, 0.22); tone(t + 0.13, 'sine', 1319, 0, 0.35, 0.4); }   // ピロン
  else if (kind === 'snap') { noiseHit(t, 0.7, 'highpass', 2500, 0.08); tone(t, 'square', 900, 200, 0.18, 0.12); noiseHit(t + 0.05, 0.3, 'bandpass', 700, 0.2, 2); }
  else if (kind === 'drift') kane(t, 0.2);
  else if (kind === 'count') { taiko(t, 1.2, 1.2); }
  else if (kind === 'go') { taiko(t, 1.4, 0.9); kane(t, 0.4); kane(t + 0.08, 0.3); cheer(0.5, 1.8); }
  else if (kind === 'bump') { tone(t, 'sine', 110, 50, Math.min(0.8, power * 0.1), 0.3); noiseHit(t, Math.min(0.4, power * 0.05), 'bandpass', 900, 0.2, 2); }
}
export function cheer(vol = 0.5, dur = 1.8) {
  if (!A.ctx) return;
  const t = A.ctx.currentTime;
  for (const f of [900, 1700]) {
    const s = A.ctx.createBufferSource(); s.buffer = A.noise; s.loop = true;
    const fl = A.ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = 0.8;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(A.master); s.start(t); s.stop(t + dur + 0.1);
  }
}
let lastShout = 0;
export function shout(text = 'そーりゃ') {
  if (A.muted || !window.speechSynthesis) return;
  const n = performance.now(); if (n - lastShout < 2500) return; lastShout = n;
  try { const u = new SpeechSynthesisUtterance(text); u.lang = 'ja-JP'; u.rate = 1.35; u.pitch = 0.7; u.volume = 0.9; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch { }
}
