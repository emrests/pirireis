// client/js/three/fx.js
// Transient combat VFX: muzzle flashes on the firing ship, per-weapon impact
// bursts on the ship that gets hit, and a big explosion when a ship is
// destroyed. A tiny CPU particle pool (spheres/boxes/rings) animated each frame.
import * as THREE from '/vendor/three.module.js';
import { waveHeight } from './waves.js';

const SPH = new THREE.SphereGeometry(1, 8, 8);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const RING = new THREE.RingGeometry(0.62, 1, 22);
RING.rotateX(-Math.PI / 2);

const rnd = (a, b) => a + Math.random() * (b - a);

export class FxManager {
  constructor(scene) { this.scene = scene; this.p = []; }

  _t() { return performance.now() / 1000; }
  _h(x, y) { return waveHeight(x, y, this._t()); }

  _mat(color, emissive, opacity) {
    return new THREE.MeshStandardMaterial({
      color, emissive: emissive || 0x000000, emissiveIntensity: emissive ? 1.5 : 0,
      roughness: 0.7, transparent: true, opacity: opacity == null ? 1 : opacity, depthWrite: false,
    });
  }
  _push(mesh, o) { this.scene.add(mesh); this.p.push(Object.assign({ mesh, age: 0, vx: 0, vy: 0, vz: 0, grow: 0, grav: 0, spin: 0 }, o)); }

  // sizes are in WORLD units, tuned so a blast reads ~ship-sized (~130u ships)
  _flash(x, y3, z, size, color, life = 0.15) {
    const m = new THREE.Mesh(SPH, this._mat(color, color, 0.96));
    m.position.set(x, y3, z); m.scale.setScalar(size);
    this._push(m, { life, grow: size * 8 });
  }
  _smoke(x, y3, z, n, spread, up, life = 0.8, col = 0x808080, sz = 24) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(SPH, this._mat(col, 0, 0.42));
      m.position.set(x + rnd(-sz, sz) * 0.5, y3, z + rnd(-sz, sz) * 0.5); m.scale.setScalar(sz * rnd(0.6, 1.1));
      this._push(m, { life: life * rnd(0.8, 1.2), vx: rnd(-spread, spread), vy: up * rnd(0.6, 1), vz: rnd(-spread, spread), grow: sz * 1.6 });
    }
  }
  _fireballs(x, y3, z, n, sz, life = 0.32) {
    for (let i = 0; i < n; i++) {
      const c = Math.random() < 0.5 ? 0xff7a1a : 0xffd24a;
      const m = new THREE.Mesh(SPH, this._mat(c, c, 0.95));
      m.position.set(x, y3, z); m.scale.setScalar(sz * rnd(0.5, 1));
      this._push(m, { life: life * rnd(0.7, 1.2), vx: rnd(-1, 1) * sz * 3, vy: rnd(0.3, 1) * sz * 3, vz: rnd(-1, 1) * sz * 3, grow: sz * 2 });
    }
  }
  _debris(x, y3, z, n, color, power) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(BOX, this._mat(color, 0, 1));
      m.position.set(x, y3, z); m.scale.setScalar(rnd(6, 16));
      const a = Math.random() * 6.283;
      this._push(m, { life: rnd(0.8, 1.2), vx: Math.cos(a) * power * rnd(0.4, 1), vy: rnd(0.6, 1.4) * power, vz: Math.sin(a) * power * rnd(0.4, 1), grav: 800, spin: rnd(-8, 8) });
    }
  }
  _ring(x, y, color, maxScale, life = 0.55) {
    const m = new THREE.Mesh(RING, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x, this._h(x, y) + 2, y); m.scale.setScalar(14);
    this._push(m, { life, grow: maxScale / life, flat: true });
  }

  // --- public emitters (x,y are WORLD coords; y3 is 3D height) ---
  spawnMuzzle(x, y, dir, kind) {
    const h = this._h(x, y);
    const dx = dir?.x || 0, dz = dir?.y || 0;
    const l = Math.hypot(dx, dz) || 1; const ux = dx / l, uz = dz / l;
    const mx = x + ux * 55, mz = y + uz * 55;
    if (kind === 'arrow') { this._smoke(mx, h + 35, mz, 2, 14, 90, 0.4, 0x9a9a8a, 9); return; }
    // cannon: flash forward + recoil smoke back + sparks
    this._flash(mx, h + 40, mz, 16, 0xffe08a, 0.13);
    this._smoke(mx - ux * 24, h + 40, mz - uz * 24, 3, 26, 130, 0.6, 0x777777, 20);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(SPH, this._mat(0xffd36b, 0xffd36b, 1));
      m.position.set(mx, h + 40, mz); m.scale.setScalar(6);
      this._push(m, { life: 0.26, vx: ux * 360 + rnd(-90, 90), vy: rnd(60, 160), vz: uz * 360 + rnd(-90, 90), grav: 650 });
    }
  }

  spawnImpact(x, y, kind) {
    const h = this._h(x, y);
    if (kind === 'arrow') {
      this._flash(x, h + 50, y, 8, 0xffffff, 0.1);
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(SPH, this._mat(0xffe08a, 0xffe08a, 1));
        m.position.set(x, h + 50, y); m.scale.setScalar(4.5);
        const a = Math.random() * 6.283;
        this._push(m, { life: 0.3, vx: Math.cos(a) * 210, vy: rnd(60, 150), vz: Math.sin(a) * 210, grav: 750 });
      }
      this._smoke(x, h + 50, y, 2, 18, 70, 0.35, 0x8a8a8a, 11);
      return;
    }
    if (kind === 'molotov') {
      this._flash(x, h + 34, y, 28, 0xff9a3a, 0.15);
      this._fireballs(x, h + 34, y, 9, 26, 0.42);
      this._smoke(x, h + 48, y, 4, 36, 150, 0.9, 0x4a3a2e, 26);
      this._ring(x, y, 0xff7a1a, 200, 0.55);
      return;
    }
    // cannon impact — explosion
    this._flash(x, h + 48, y, 30, 0xffe6a0, 0.14);
    this._fireballs(x, h + 48, y, 8, 27, 0.34);
    this._smoke(x, h + 58, y, 5, 40, 170, 0.9, 0x6b6b6b, 27);
    this._debris(x, h + 40, y, 8, 0x3a2a1a, 430);
    this._ring(x, y, 0xffd0a0, 210, 0.55);
  }

  spawnDeath(x, y) {
    const h = this._h(x, y);
    this._flash(x, h + 60, y, 55, 0xfff0c0, 0.17);
    this._fireballs(x, h + 60, y, 13, 42, 0.5);
    this._smoke(x, h + 72, y, 8, 60, 200, 1.3, 0x3a3a3a, 46);
    this._debris(x, h + 50, y, 14, 0x4a3123, 620);
    this._ring(x, y, 0xffcaa0, 420, 0.75);
  }

  spawnSplash(x, y) {
    const h = this._h(x, y);
    this._ring(x, y, 0xeaf7fa, 90, 0.5);
    this._smoke(x, h + 16, y, 2, 20, 70, 0.4, 0xdfeef2, 12);
  }

  update(dt, now) {
    const g = Math.min(dt, 0.05);
    for (let i = this.p.length - 1; i >= 0; i--) {
      const p = this.p[i];
      p.age += g;
      const k = p.age / p.life;
      if (k >= 1) { this.scene.remove(p.mesh); p.mesh.material.dispose(); this.p.splice(i, 1); continue; }
      const m = p.mesh;
      p.vy -= p.grav * g;
      m.position.x += p.vx * g; m.position.y += p.vy * g; m.position.z += p.vz * g;
      if (p.grow) { const s = m.scale.x + p.grow * g; m.scale.setScalar(Math.max(0.01, s)); }
      if (p.spin) m.rotation.set(m.rotation.x + p.spin * g, m.rotation.y + p.spin * g, 0);
      m.material.opacity = (1 - k) * (p.flat ? 0.7 : 0.95);
    }
  }
}
