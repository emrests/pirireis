// client/js/three/projectiles.js
// Cannonballs (sphere + smoke trail, splash when gone), arrows (thin shafts),
// and fire areas (flickering emissive flames + glow). Meshes cached by id;
// vanished cannonballs leave a splash ring on the water.
import * as THREE from '/vendor/three.module.js';
import { waveHeight } from './waves.js';

const BALL_GEO = new THREE.SphereGeometry(7, 10, 10);
const BALL_MAT = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.5 });
const ARROW_GEO = new THREE.CylinderGeometry(1.2, 1.2, 34, 5);
ARROW_GEO.rotateZ(Math.PI / 2);
const ARROW_MAT = new THREE.MeshStandardMaterial({ color: 0x7a5a2a, roughness: 0.8 });
const SPLASH_GEO = new THREE.RingGeometry(4, 9, 20);
SPLASH_GEO.rotateX(-Math.PI / 2);
const FLAME_GEO = new THREE.ConeGeometry(1, 2.4, 7);

export class ProjectileManager {
  constructor(scene) {
    this.scene = scene;
    this.proj = new Map();   // id -> {mesh, kind, lastX, lastY}
    this.fires = new Map();  // id -> {group, flames[], born}
    this.splashes = [];      // {mesh, born}
  }

  update(projList, fireList, tSec, now) {
    // --- projectiles ---
    const seen = new Set();
    for (const p of projList) {
      seen.add(p.id);
      let e = this.proj.get(p.id);
      if (!e) {
        const mesh = p.kind === 'arrow'
          ? new THREE.Mesh(ARROW_GEO, ARROW_MAT)
          : new THREE.Mesh(BALL_GEO, BALL_MAT);
        mesh.castShadow = true;
        this.scene.add(mesh);
        e = { mesh, kind: p.kind, lastX: p.x, lastY: p.y };
        this.proj.set(p.id, e);
      }
      const h = waveHeight(p.x, p.y, tSec) + 30;
      if (p.kind === 'arrow') {
        const dx = p.x - e.lastX, dz = p.y - e.lastY;
        if (Math.hypot(dx, dz) > 0.01) e.mesh.rotation.y = Math.atan2(-dz, dx);
      }
      e.mesh.position.set(p.x, h, p.y);
      e.lastX = p.x; e.lastY = p.y;
    }
    for (const [id, e] of this.proj) {
      if (!seen.has(id)) {
        if (e.kind !== 'arrow') this._splash(e.lastX, e.lastY, tSec, now);
        this.scene.remove(e.mesh); this.proj.delete(id);
      }
    }

    // --- fire areas ---
    const fseen = new Set();
    for (const f of fireList) {
      fseen.add(f.id);
      let e = this.fires.get(f.id);
      if (!e) e = this._makeFire(f, now);
      e.group.position.set(f.x, waveHeight(f.x, f.y, tSec) + 2, f.y);
      const flick = 0.7 + 0.3 * Math.sin(now * 0.02);
      for (const fl of e.flames) {
        fl.scale.y = (0.7 + Math.random() * 0.7);
        fl.material.emissiveIntensity = 1.4 * flick;
        fl.rotation.y += 0.08;
      }
      e.glow.material.opacity = 0.25 + 0.12 * Math.sin(now * 0.015);
    }
    for (const [id, e] of this.fires) {
      if (!fseen.has(id)) { this.scene.remove(e.group); this.fires.delete(id); }
    }

    // --- splashes ---
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const s = this.splashes[i];
      const k = (now - s.born) / 650;
      if (k >= 1) { this.scene.remove(s.mesh); s.mesh.material.dispose(); this.splashes.splice(i, 1); continue; }
      s.mesh.scale.setScalar(1 + k * 3);
      s.mesh.material.opacity = 0.6 * (1 - k);
    }
  }

  _makeFire(f, now) {
    const group = new THREE.Group();
    const flames = [];
    const R = f.radius;
    const n = Math.max(6, Math.round(R / 22));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283;
      const rr = R * (0.2 + Math.random() * 0.7);
      const mat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff4400, emissiveIntensity: 1.4, transparent: true, opacity: 0.92 });
      const fl = new THREE.Mesh(FLAME_GEO, mat);
      fl.scale.setScalar(R / 10);
      fl.position.set(Math.cos(a) * rr, R / 12, Math.sin(a) * rr);
      group.add(fl); flames.push(fl);
    }
    const glowGeo = new THREE.CircleGeometry(R * 1.1, 32).rotateX(-Math.PI / 2);
    const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.3, depthWrite: false }));
    glow.position.y = 1; group.add(glow);
    group.glow = glow;
    this.scene.add(group);
    const e = { group, flames, glow, born: now };
    this.fires.set(f.id, e);
    return e;
  }

  _splash(x, y, tSec, now) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xeaf7fa, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(SPLASH_GEO, mat);
    m.position.set(x, waveHeight(x, y, tSec) + 1, y);
    this.scene.add(m);
    this.splashes.push({ mesh: m, born: now });
  }
}
