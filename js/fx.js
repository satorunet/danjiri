// エフェクト: 火花・砂ぼこり・破片・紙吹雪・タイヤ痕・金の軌跡・集中線
import * as THREE from 'three';
import { toon } from './gfx.js?v=72';

const VS = `
attribute float size; attribute float alpha; attribute vec3 pcolor;
uniform float uScale;
varying float vA; varying vec3 vC;
void main() {
  vA = alpha; vC = pcolor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * uScale / max(0.5, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FS_SOFT = `
varying float vA; varying vec3 vC;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.1, d) * vA;
  gl_FragColor = vec4(vC, a);
}`;
const FS_PUFF = `
varying float vA; varying vec3 vC;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p);
  if (d > 0.5) discard;
  float band = step(0.36, d);   // トゥーンっぽい縁取り
  vec3 c = mix(vC, vC * 0.8, band);
  gl_FragColor = vec4(c, 0.7 * vA * (1.0 - smoothstep(0.45, 0.5, d)));
}`;

class PointSystem {
  constructor(scene, n, { additive = false, puff = false } = {}) {
    this.n = n; this.i = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n); this.alpha = new Float32Array(n); this.life = new Float32Array(n); this.max = new Float32Array(n);
    this.grow = new Float32Array(n); this.grav = new Float32Array(n); this.drag = new Float32Array(n); this.size0 = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 } }, vertexShader: VS, fragmentShader: puff ? FS_PUFF : FS_SOFT,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false;
    scene.add(this.points); this.g = g;
  }
  emit(x, y, z, vx, vy, vz, life, size, r, gg, b, { grow = 0, grav = 0, drag = 0 } = {}) {
    const i = this.i = (this.i + 1) % this.n;
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3); this.col.set([r, gg, b], i * 3);
    this.life[i] = this.max[i] = life; this.size[i] = this.size0[i] = size; this.alpha[i] = 1;
    this.grow[i] = grow; this.grav[i] = grav; this.drag[i] = drag;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const k = i * 3, dr = Math.exp(-this.drag[i] * dt);
      this.vel[k + 1] -= this.grav[i] * dt;
      this.vel[k] *= dr; this.vel[k + 1] *= dr; this.vel[k + 2] *= dr;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      const t = Math.max(0, this.life[i] / this.max[i]);
      this.alpha[i] = Math.min(1, t * 2.5);
      this.size[i] = this.size0[i] * (1 + this.grow[i] * (1 - t));
    }
    for (const a of ['position', 'pcolor', 'size', 'alpha']) this.g.attributes[a].needsUpdate = true;
  }
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.sparks = new PointSystem(scene, 700, { additive: true });
    this.dust = new PointSystem(scene, 500, { puff: true });
    this.glow = new PointSystem(scene, 300, { additive: true });
    // 破片・紙吹雪
    this.DN = 360; this.di = 0;
    this.deb = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.2, 0.05), toon({ color: 0xffffff, side: THREE.DoubleSide }), this.DN);
    this.deb.frustumCulled = false; this.deb.castShadow = true;
    this.db = Array.from({ length: this.DN }, () => ({ life: 0 }));
    const c = new THREE.Color(1, 1, 1), d = new THREE.Object3D(); d.scale.setScalar(0); d.updateMatrix();
    for (let i = 0; i < this.DN; i++) { this.deb.setMatrixAt(i, d.matrix); this.deb.setColorAt(i, c); }
    scene.add(this.deb);
    // タイヤ痕
    this.SN = 900; this.si = 0;
    const sg = new THREE.PlaneGeometry(0.34, 1).rotateX(-Math.PI / 2);
    this.skid = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ color: 0x1a1612, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), this.SN);
    this.skid.frustumCulled = false;
    for (let i = 0; i < this.SN; i++) this.skid.setMatrixAt(i, d.matrix);
    scene.add(this.skid);
    this.d = new THREE.Object3D();
    this.trails = new Map();
  }
  burst(kind, x, y, z, n, opt = {}) {
    const R = Math.random;
    if (kind === 'sparks') for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, sp = 3 + R() * 7;
      this.sparks.emit(x, y, z, Math.cos(a) * sp + (opt.vx || 0), 2 + R() * 6, Math.sin(a) * sp + (opt.vz || 0), 0.25 + R() * 0.4, 0.22 + R() * 0.2, 4, 2.6, 0.9, { grav: 18, drag: 1 });
    }
    else if (kind === 'dust') for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, sp = (opt.spread || 2) * R();
      const c = opt.color || [0.86, 0.8, 0.7];
      this.dust.emit(x + Math.cos(a) * 0.5, y + R() * 0.3, z + Math.sin(a) * 0.5, Math.cos(a) * sp + (opt.vx || 0) * 0.3, 0.4 + R() * 1.0, Math.sin(a) * sp + (opt.vz || 0) * 0.3, 0.5 + R() * 0.6, (opt.size || 1.0) * 0.55 * (0.7 + R() * 0.6), c[0], c[1], c[2], { grow: 1.4, drag: 2.6, grav: -0.3 });
    }
    else if (kind === 'glow') for (let i = 0; i < n; i++) {
      this.glow.emit(x + (R() - 0.5) * 2, y + R() * 2, z + (R() - 0.5) * 2, (R() - 0.5) * 2, 1 + R() * 2, (R() - 0.5) * 2, 0.6 + R() * 0.5, 0.5 + R() * 0.6, 3.5, 2.4, 0.6, { drag: 1.5 });
    }
    else if (kind === 'debris' || kind === 'confetti') {
      const colors = opt.colors || (kind === 'confetti' ? [0xff4d4d, 0xffd23f, 0xffffff, 0x5ec8ff, 0xff8bd0, 0x6ee06e] : [0x8a5a30, 0x6a4020, 0xc9a25a, 0x4a2e14]);
      const c = new THREE.Color();
      for (let k = 0; k < n; k++) {
        const i = this.di = (this.di + 1) % this.DN, p = this.db[i];
        const a = R() * Math.PI * 2, sp = (opt.speed || 6) * (0.3 + R() * 0.7);
        Object.assign(p, { x, y, z, vx: Math.cos(a) * sp + (opt.vx || 0) * 0.6, vy: (opt.up || 6) * (0.5 + R()), vz: Math.sin(a) * sp + (opt.vz || 0) * 0.6, rx: R() * 6, ry: R() * 6, w: (R() - 0.5) * 20, life: (opt.life || 2.2) * (0.6 + R() * 0.4), conf: kind === 'confetti', s: kind === 'confetti' ? 0.7 : 0.6 + R() * 1.4 });
        c.setHex(colors[k % colors.length]); this.deb.setColorAt(i, c);
      }
      this.deb.instanceColor.needsUpdate = true;
    }
  }
  skidMark(x, y, z, yaw, len) {
    const i = this.si = (this.si + 1) % this.SN, d = this.d;
    d.position.set(x, y + 0.03, z); d.rotation.set(0, yaw, 0); d.scale.set(1, 1, len); d.updateMatrix();
    this.skid.setMatrixAt(i, d.matrix); this.skid.instanceMatrix.needsUpdate = true;
  }
  clearSkids() { const d = this.d; d.scale.setScalar(0); d.updateMatrix(); for (let i = 0; i < this.SN; i++) this.skid.setMatrixAt(i, d.matrix); this.skid.instanceMatrix.needsUpdate = true; }
  // 金色の軌跡（ブースト・大ジャンプ中）
  trail(key, x, y, z, on, dt) {
    let t = this.trails.get(key);
    if (!t) {
      const N = 36, g = new THREE.BufferGeometry();
      const pos = new Float32Array(N * 2 * 3), al = new Float32Array(N * 2);
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('alpha', new THREE.BufferAttribute(al, 1));
      const idx = []; for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
        vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(vec3(3.2, 2.1, 0.7) * vA, vA); }',
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }));
      m.frustumCulled = false; this.scene.add(m);
      t = { N, pts: [], m, g, fade: 0 };
      this.trails.set(key, t);
    }
    t.fade = Math.max(0, Math.min(1, t.fade + (on ? dt * 4 : -dt * 2)));
    t.pts.unshift([x, y, z]); if (t.pts.length > t.N) t.pts.pop();
    const pos = t.g.attributes.position.array, al = t.g.attributes.alpha.array;
    for (let i = 0; i < t.N; i++) {
      const p = t.pts[Math.min(i, t.pts.length - 1)], k = 1 - i / t.N, w = 0.9 * k;
      pos.set([p[0], p[1] + w, p[2], p[0], p[1] - w * 0.4, p[2]], i * 6);
      al[i * 2] = al[i * 2 + 1] = k * k * t.fade * 0.7;
    }
    t.g.attributes.position.needsUpdate = true; t.g.attributes.alpha.needsUpdate = true;
    t.m.visible = t.fade > 0.01;
  }
  update(dt, scale) {
    this.sparks.mat.uniforms.uScale.value = this.dust.mat.uniforms.uScale.value = this.glow.mat.uniforms.uScale.value = scale;
    this.sparks.update(dt); this.dust.update(dt); this.glow.update(dt);
    const d = this.d; let dirty = false;
    for (let i = 0; i < this.DN; i++) {
      const p = this.db[i]; if (p.life <= 0) continue;
      p.life -= dt; dirty = true;
      p.vy -= (p.conf ? 4 : 18) * dt;
      if (p.conf) { p.vx *= Math.exp(-dt * 1.5); p.vz *= Math.exp(-dt * 1.5); p.vy = Math.max(p.vy, -2.2); }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rx += p.w * dt; p.ry += p.w * 0.6 * dt;
      const s = p.life > 0 ? Math.min(1, p.life * 2) * p.s : 0;
      d.position.set(p.x, p.y, p.z); d.rotation.set(p.rx, p.ry, 0); d.scale.setScalar(s); d.updateMatrix();
      this.deb.setMatrixAt(i, d.matrix);
    }
    if (dirty) this.deb.instanceMatrix.needsUpdate = true;
  }
}

// 集中線 + 放射ブラー（速さに応じて）
export const SpeedShader = {
  uniforms: { tDiffuse: { value: null }, uAmt: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uAmt; uniform float uTime; uniform float uAspect; varying vec2 vUv;
    float h(float n){ return fract(sin(n) * 43758.5453); }
    void main(){
      vec2 p = vUv - 0.5; vec2 q = p; q.x *= uAspect;
      float r = length(q);
      vec4 c = texture2D(tDiffuse, vUv);
      if (uAmt > 0.01) {
        vec4 acc = c;
        for (int i = 1; i <= 4; i++) acc += texture2D(tDiffuse, vUv - p * float(i) * 0.012 * uAmt * smoothstep(0.1, 0.6, r));
        c = acc / 5.0;
        float a = atan(q.y, q.x);
        float seg = floor(a * 60.0 / 3.14159);
        float n = h(seg * 7.13 + floor(uTime * 18.0) * 3.7);
        float line = step(0.78, n) * smoothstep(0.32, 0.75, r) * smoothstep(0.0, 1.0, uAmt);
        float thin = 1.0 - smoothstep(0.0, 0.5, abs(fract(a * 60.0 / 3.14159) - 0.5) * 2.0 - 0.2);
        c.rgb = mix(c.rgb, vec3(1.0, 0.98, 0.92), line * thin * 0.55);
      }
      gl_FragColor = c;
    }`,
};
