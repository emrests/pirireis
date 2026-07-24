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

const HIT_DIST = 95; // world units: projectile vanishing this close to an enemy = a hit

export class ProjectileManager {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    this.proj = new Map();   // id -> {mesh, kind, faction, lastX, lastY, spawnX, spawnY, muzzled}
    this.fires = new Map();  // id -> {group, flames[], born}
  }

  // nearest enemy ship to (x,y); returns it if within HIT_DIST, else null
  _enemyHitAt(x, y, faction, ships) {
    let best = HIT_DIST, hit = null;
    for (const s of ships) {
      if (!s.alive || s.faction === faction) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < best) { best = d; hit = s; }
    }
    return hit;
  }

  update(projList, fireList, ships, tSec, now) {
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
        e = { mesh, kind: p.kind, faction: p.faction, lastX: p.x, lastY: p.y, spawnX: p.x, spawnY: p.y, muzzled: false };
        this.proj.set(p.id, e);
      }
      const h = waveHeight(p.x, p.y, tSec) + 30;
      const dx = p.x - e.lastX, dz = p.y - e.lastY;
      if (p.kind === 'arrow' && Math.hypot(dx, dz) > 0.01) e.mesh.rotation.y = Math.atan2(-dz, dx);
      // muzzle flash on the firing ship, once we know the shot's direction
      if (!e.muzzled) {
        const sd = Math.hypot(p.x - e.spawnX, p.y - e.spawnY);
        if (sd > 2) { this.fx.spawnMuzzle(e.spawnX, e.spawnY, { x: p.x - e.spawnX, y: p.y - e.spawnY }, e.kind); e.muzzled = true; }
      }
      e.mesh.position.set(p.x, h, p.y);
      e.lastX = p.x; e.lastY = p.y;
    }
    for (const [id, e] of this.proj) {
      if (!seen.has(id)) {
        const hit = this._enemyHitAt(e.lastX, e.lastY, e.faction, ships);
        if (hit) this.fx.spawnImpact(hit.x, hit.y, e.kind === 'arrow' ? 'arrow' : 'cannon');
        else if (e.kind !== 'arrow') this.fx.spawnSplash(e.lastX, e.lastY);
        this.scene.remove(e.mesh); this.proj.delete(id);
      }
    }

    // --- fire areas ---
    const fseen = new Set();
    for (const f of fireList) {
      fseen.add(f.id);
      let e = this.fires.get(f.id);
      if (!e) { e = this._makeFire(f, now); this.fx.spawnImpact(f.x, f.y, 'molotov'); }
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
}
