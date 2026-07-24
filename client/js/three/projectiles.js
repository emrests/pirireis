// client/js/three/projectiles.js
// Cannonballs and arrows fly in a visible BALLISTIC ARC (up then down onto the
// target) with a fading trail; molotovs are lobbed in from the throwing ship
// before the fire ignites. Server sends spawn (sx,sy) + intended travel (dist)
// so the client can shape the parabola exactly. Meshes cached by id.
import * as THREE from '/vendor/three.module.js';
import { waveHeight } from './waves.js';
import { audio } from './audio.js';

const BALL_GEO = new THREE.SphereGeometry(16, 14, 14);
// glowing hot iron so the shot is clearly visible arcing over the dark sea
const BALL_MAT = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.45, metalness: 0.4, emissive: 0xff5316, emissiveIntensity: 1.1 });
const HALO_GEO = new THREE.SphereGeometry(1, 10, 10);
const SHADOW_GEO = new THREE.CircleGeometry(1, 16);
SHADOW_GEO.rotateX(-Math.PI / 2);
const ARROW_GEO = new THREE.CylinderGeometry(1.9, 1.9, 50, 6);
ARROW_GEO.rotateZ(Math.PI / 2);
const ARROW_MAT = new THREE.MeshStandardMaterial({ color: 0x8a6a34, roughness: 0.8 });
const FLAME_GEO = new THREE.ConeGeometry(1, 2.4, 7);
const TRAIL_GEO = new THREE.SphereGeometry(1, 6, 6);

const HIT_DIST = 95;   // world units: vanishing this close to an enemy = a hit
const THROW_MS = 480;  // molotov lob time
const TRAIL_MS = 420;

function makeHalo() {
  return new THREE.Mesh(HALO_GEO, new THREE.MeshBasicMaterial({ color: 0xff8a30, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
}
function makeShadow(kind) {
  const m = new THREE.Mesh(SHADOW_GEO, new THREE.MeshBasicMaterial({ color: 0x000008, transparent: true, opacity: 0.3, depthWrite: false }));
  m.scale.setScalar(kind === 'arrow' ? 8 : 17);
  return m;
}

const lerp = (a, b, t) => a + (b - a) * t;
const arcApex = (dist, kind) => Math.min((dist || 300) * (kind === 'arrow' ? 0.16 : 0.24), kind === 'arrow' ? 190 : 320);

const _fwd = new THREE.Vector3();
const _xax = new THREE.Vector3(1, 0, 0);

export class ProjectileManager {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    this.proj = new Map();
    this.fires = new Map();
    this.throws = new Map(); // fireId -> {sx,sy,ex,ey,t0,bottle}
    this.trails = [];
  }

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
    // --- flying projectiles (arc + trail) ---
    const seen = new Set();
    for (const p of projList) {
      seen.add(p.id);
      let e = this.proj.get(p.id);
      if (!e) {
        const mesh = p.kind === 'arrow' ? new THREE.Mesh(ARROW_GEO, ARROW_MAT) : new THREE.Mesh(BALL_GEO, BALL_MAT);
        mesh.castShadow = true;
        if (p.kind !== 'arrow') { const halo = makeHalo(); halo.scale.setScalar(2.4); mesh.add(halo); }
        this.scene.add(mesh);
        const shadow = makeShadow(p.kind); this.scene.add(shadow);
        e = { mesh, shadow, kind: p.kind, faction: p.faction, lastX: p.x, lastY: p.y, spawnX: p.x, spawnY: p.y, muzzled: false, apex: arcApex(p.dist, p.kind), lastY3: null };
        this.proj.set(p.id, e);
      }
      const wh = waveHeight(p.x, p.y, tSec);
      const d = Math.hypot(p.x - (p.sx ?? e.spawnX), p.y - (p.sy ?? e.spawnY));
      const f = p.dist > 1 ? Math.min(1, d / p.dist) : 0;
      const y3 = wh + 26 + e.apex * 4 * f * (1 - f);

      if (!e.muzzled) {
        const sd = Math.hypot(p.x - e.spawnX, p.y - e.spawnY);
        if (sd > 2) { this.fx.spawnMuzzle(e.spawnX, e.spawnY, { x: p.x - e.spawnX, y: p.y - e.spawnY }, e.kind); e.muzzled = true; }
      }
      // arrows nose along their arc (pitch down as they fall)
      if (p.kind === 'arrow') {
        const vy = e.lastY3 == null ? 0 : (y3 - e.lastY3);
        _fwd.set(p.x - e.lastX, vy, p.y - e.lastY);
        if (_fwd.lengthSq() > 1e-6) { _fwd.normalize(); e.mesh.quaternion.setFromUnitVectors(_xax, _fwd); }
      }
      e.mesh.position.set(p.x, y3, p.y);
      e.shadow.position.set(p.x, wh + 1.6, p.y); // ground marker = where it will land
      this._trail(p.x, y3, p.y, p.kind, now);
      e.lastX = p.x; e.lastY = p.y; e.lastY3 = y3;
    }
    for (const [id, e] of this.proj) {
      if (!seen.has(id)) {
        const hit = this._enemyHitAt(e.lastX, e.lastY, e.faction, ships);
        if (hit) this.fx.spawnImpact(hit.x, hit.y, e.kind === 'arrow' ? 'arrow' : 'cannon');
        else if (e.kind !== 'arrow') this.fx.spawnSplash(e.lastX, e.lastY);
        this.scene.remove(e.mesh);
        this.scene.remove(e.shadow); e.shadow.material.dispose();
        this.proj.delete(id);
      }
    }

    // --- fire areas: lobbed in first, then ignite ---
    const fseen = new Set();
    for (const f of fireList) {
      fseen.add(f.id);
      let e = this.fires.get(f.id);
      if (!e) { e = this._makeFire(f, now); e.group.visible = false; this._startThrow(f, now); }
      e.group.position.set(f.x, waveHeight(f.x, f.y, tSec) + 2, f.y);
      const flick = 0.7 + 0.3 * Math.sin(now * 0.02);
      for (const fl of e.flames) {
        fl.scale.y = 0.7 + Math.random() * 0.7;
        fl.material.emissiveIntensity = 1.4 * flick;
        fl.rotation.y += 0.08;
      }
      e.glow.material.opacity = 0.25 + 0.12 * Math.sin(now * 0.015);
    }
    this._updateThrows(now, tSec);
    for (const [id, e] of this.fires) {
      if (!fseen.has(id)) {
        this.scene.remove(e.group);
        const t = this.throws.get(id);
        if (t) { this.scene.remove(t.bottle); t.bottle.material.dispose(); this.throws.delete(id); }
        this.fires.delete(id);
      }
    }

    this._ageTrails(now);
  }

  _startThrow(f, now) {
    const bottle = new THREE.Mesh(new THREE.SphereGeometry(7, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a2a18, emissive: 0xff5a00, emissiveIntensity: 0.5 }));
    bottle.castShadow = true;
    this.scene.add(bottle);
    audio.molotovThrow();
    this.throws.set(f.id, { sx: f.sx ?? f.x, sy: f.sy ?? f.y, ex: f.x, ey: f.y, t0: now, bottle });
  }

  _updateThrows(now, tSec) {
    for (const [id, t] of this.throws) {
      const f = (now - t.t0) / THROW_MS;
      if (f >= 1) {
        const fire = this.fires.get(id);
        if (fire) fire.group.visible = true;
        this.fx.spawnImpact(t.ex, t.ey, 'molotov');
        this.scene.remove(t.bottle); t.bottle.material.dispose();
        this.throws.delete(id);
        continue;
      }
      const x = lerp(t.sx, t.ex, f), y = lerp(t.sy, t.ey, f);
      const d = Math.hypot(t.ex - t.sx, t.ey - t.sy);
      const apex = Math.min(Math.max(d * 0.28, 90), 260);
      t.bottle.position.set(x, waveHeight(x, y, tSec) + 28 + apex * 4 * f * (1 - f), y);
      t.bottle.rotation.x += 0.3; t.bottle.rotation.z += 0.2;
    }
  }

  _trail(x, y3, z, kind, now) {
    const mat = new THREE.MeshBasicMaterial({ color: kind === 'arrow' ? 0xdccba0 : 0xffb070, transparent: true, opacity: 0.55, depthWrite: false });
    const m = new THREE.Mesh(TRAIL_GEO, mat);
    m.position.set(x, y3, z); m.scale.setScalar(kind === 'arrow' ? 2.8 : 9);
    this.scene.add(m);
    this.trails.push({ m, born: now });
    if (this.trails.length > 200) { const o = this.trails.shift(); this.scene.remove(o.m); o.m.material.dispose(); }
  }
  _ageTrails(now) {
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const t = this.trails[i];
      const k = (now - t.born) / TRAIL_MS;
      if (k >= 1) { this.scene.remove(t.m); t.m.material.dispose(); this.trails.splice(i, 1); continue; }
      t.m.material.opacity = 0.5 * (1 - k);
      t.m.scale.multiplyScalar(0.985);
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
