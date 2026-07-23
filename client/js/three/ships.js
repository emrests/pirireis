// client/js/three/ships.js
// Procedural 3D ships (Age-of-Empires-ish), one Group per class built from
// Three primitives. Ships ride the real Gerstner surface (sampled on the CPU),
// yaw to their heading (derived from movement), leave a foam wake and sink when
// destroyed. Meshes are cached per ship id and disposed when the ship leaves.
import * as THREE from '/vendor/three.module.js';
import { waveHeight, waveNormal } from './waves.js';

const SINK_MS = 2600;
const MOVE_EPS = 0.5;         // world units between frames to update heading
const MOVING_SPEED = 12;      // world units/sec => "moving"
const WAKE_MS = 90;

// length,width,height, mast count, scale — bigger classes are larger.
const CLASS = {
  sloop:      { s: 20, masts: 1 }, cutter:     { s: 21, masts: 1 },
  brig:       { s: 25, masts: 2 }, corvette:   { s: 25, masts: 2 },
  frigate:    { s: 29, masts: 2 }, frigate_n:  { s: 29, masts: 2 },
  galleon:    { s: 40, masts: 3 }, shipofline: { s: 42, masts: 3 },
  fireship:   { s: 28, masts: 2, brazier: true },
  bombketch:  { s: 30, masts: 1, mortar: true },
};

const PIRATE = { hull: 0x4a3123, deck: 0x6b4a2f, trim: 0x8a2b22, sail: 0xd7d0bd };
const NAVY   = { hull: 0x37485f, deck: 0x6b7688, trim: 0xc9a24b, sail: 0xf3f2ec };

function hullGeometry() {
  // Top-plan boat outline (bow at +X), extruded downward for the hull body.
  const sh = new THREE.Shape();
  sh.moveTo(1.15, 0);
  sh.bezierCurveTo(0.9, 0.34, 0.2, 0.5, -0.5, 0.48);
  sh.lineTo(-1.0, 0.3);
  sh.lineTo(-1.02, 0);
  sh.lineTo(-1.0, -0.3);
  sh.lineTo(-0.5, -0.48);
  sh.bezierCurveTo(0.2, -0.5, 0.9, -0.34, 1.15, 0);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, steps: 1 });
  geo.rotateX(-Math.PI / 2);   // extrude(Z) -> up(Y); shape XY -> XZ
  geo.translate(0, 0.25, 0);
  return geo;
}
const HULL_GEO = hullGeometry();
const MAST_GEO = new THREE.CylinderGeometry(0.028, 0.04, 1.4, 7);
const SAIL_GEO = (() => {
  const g = new THREE.PlaneGeometry(0.62, 0.7, 6, 6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.cos(p.getX(i) * 2.4) * 0.09); // belly the sail
  g.computeVertexNormals();
  return g;
})();
const CANNON_GEO = new THREE.CylinderGeometry(0.03, 0.035, 0.22, 6);
const RING_GEO = new THREE.RingGeometry(0.4, 1, 24);
RING_GEO.rotateX(-Math.PI / 2);

function buildShip(cls, faction, flagColor) {
  const spec = CLASS[cls] || CLASS.frigate;
  const P = faction === 'pirate' ? PIRATE : NAVY;
  const g = new THREE.Group();

  const hull = new THREE.Mesh(HULL_GEO, new THREE.MeshStandardMaterial({ color: P.hull, roughness: 0.75, metalness: 0.05 }));
  hull.castShadow = true; hull.receiveShadow = true;
  g.add(hull);

  // deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.72), new THREE.MeshStandardMaterial({ color: P.deck, roughness: 0.85 }));
  deck.position.y = 0.5; deck.castShadow = true; g.add(deck);
  // gunwale trim rim
  const rim = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.16), new THREE.MeshStandardMaterial({ color: P.trim, roughness: 0.6 }));
  rim.position.set(0, 0.5, 0.4); g.add(rim);
  const rim2 = rim.clone(); rim2.position.z = -0.4; g.add(rim2);

  // masts + sails
  const sailMat = new THREE.MeshStandardMaterial({ color: P.sail, roughness: 0.9, side: THREE.DoubleSide });
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x3b2a18, roughness: 0.7 });
  const sails = [];
  const nm = spec.masts;
  for (let i = 0; i < nm; i++) {
    const mx = nm === 1 ? 0 : THREE.MathUtils.lerp(0.55, -0.7, i / (nm - 1));
    const mast = new THREE.Mesh(MAST_GEO, mastMat);
    mast.position.set(mx, 1.15, 0); mast.castShadow = true; g.add(mast);
    const sail = new THREE.Mesh(SAIL_GEO, sailMat);
    sail.position.set(mx, 1.2, 0); sail.rotation.y = Math.PI / 2; sail.castShadow = true;
    g.add(sail); sails.push(sail);
  }
  // flag in player colour at tallest mast
  const flagMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(flagColor || '#ffffff'), roughness: 0.8, side: THREE.DoubleSide, emissive: new THREE.Color(flagColor || '#ffffff'), emissiveIntensity: 0.12 });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.2), flagMat);
  flag.position.set(0.55, 1.78, 0); g.add(flag);

  // cannons on larger ships
  if (spec.s >= 29) {
    const cmat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.4, metalness: 0.6 });
    for (const side of [0.42, -0.42]) for (const cx of [0.4, 0, -0.4]) {
      const c = new THREE.Mesh(CANNON_GEO, cmat);
      c.rotation.z = Math.PI / 2; c.position.set(cx, 0.52, side); g.add(c);
    }
  }
  let brazier = null;
  if (spec.brazier) {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0x222, roughness: 0.6 }));
    bowl.position.set(-0.2, 0.62, 0); g.add(bowl);
    brazier = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshStandardMaterial({ color: 0xff7b1a, emissive: 0xff5500, emissiveIntensity: 1.4 }));
    brazier.position.set(-0.2, 0.74, 0); g.add(brazier);
  }
  if (spec.mortar) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.4, 10), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.5 }));
    m.rotation.z = 0.5; m.position.set(0.1, 0.62, 0); g.add(m);
  }

  const scale = spec.s / 10;
  g.scale.setScalar(scale);
  return { group: g, sails, flag, brazier, flagMat, sailMat, scale };
}

const _up = new THREE.Vector3(0, 1, 0);
const _n = new THREE.Vector3();
const _qTilt = new THREE.Quaternion();
const _qYaw = new THREE.Quaternion();

export class ShipManager {
  constructor(scene) {
    this.scene = scene;
    this.ships = new Map(); // id -> {parts, heading, lastX, lastY, deadSince, wake:[], lastWake, phase}
  }

  update(list, tSec, now) {
    const seen = new Set();
    for (const s of list) {
      seen.add(s.id);
      let e = this.ships.get(s.id);
      if (!e) {
        const parts = buildShip(s.cls, s.faction, s.flagColor);
        this.scene.add(parts.group);
        e = { parts, heading: s.faction === 'pirate' ? 0 : Math.PI, lastX: s.x, lastY: s.y, deadSince: null, wake: [], lastWake: 0, phase: Math.random() * 6.28 };
        this.ships.set(s.id, e);
      }
      this._updateOne(e, s, tSec, now);
    }
    for (const [id, e] of this.ships) {
      if (!seen.has(id)) { this._dispose(e); this.ships.delete(id); }
    }
  }

  _updateOne(e, s, tSec, now) {
    const g = e.parts.group;
    const dx = s.x - e.lastX, dz = s.y - e.lastY;
    const dist = Math.hypot(dx, dz);
    const speed = dist / (1 / 60);
    const moving = s.alive && dist > MOVE_EPS;
    if (moving) {
      const target = Math.atan2(-dz, dx);
      e.heading = lerpAngle(e.heading, target, 0.16);
    }
    e.lastX = s.x; e.lastY = s.y;

    if (!s.alive && e.deadSince == null) e.deadSince = now;
    if (s.alive) e.deadSince = null;

    const h = waveHeight(s.x, s.y, tSec);
    if (e.deadSince != null) {
      const k = Math.min(1, (now - e.deadSince) / SINK_MS);
      g.position.set(s.x, h - k * 55, s.y);
      _qYaw.setFromAxisAngle(_up, e.heading);
      _qTilt.setFromAxisAngle(new THREE.Vector3(1, 0, 0.4).normalize(), k * 1.1);
      g.quaternion.copy(_qTilt).multiply(_qYaw);
      return;
    }

    // float on the real surface, tilt with the wave normal, yaw to heading
    const n = waveNormal(s.x, s.y, tSec);
    _n.set(n.x, n.y, n.z);
    const bowLift = moving ? 0.06 : 0;
    // sit the hull into the water (waterline ~mid-hull), scaled per class
    g.position.set(s.x, h - 0.35 * e.parts.scale, s.y);
    _qTilt.setFromUnitVectors(_up, _n);
    _qYaw.setFromAxisAngle(_up, e.heading);
    g.quaternion.copy(_qTilt).multiply(_qYaw);
    g.rotateZ(bowLift + Math.sin(tSec * 1.6 + e.phase) * 0.02); // subtle roll

    // sail / flag flutter
    const t = tSec * 6 + e.phase;
    e.parts.flag.rotation.y = Math.sin(t) * 0.5;
    e.parts.flag.rotation.z = Math.sin(t * 1.3) * 0.12;
    if (e.parts.brazier) e.parts.brazier.scale.setScalar(1 + Math.sin(tSec * 12 + e.phase) * 0.18);

    // wake trail
    if (moving && now - e.lastWake > WAKE_MS) {
      e.lastWake = now;
      const ux = dist > 0.01 ? dx / dist : Math.cos(e.heading);
      const uz = dist > 0.01 ? dz / dist : -Math.sin(e.heading);
      this._spawnWake(s.x - ux * e.parts.scale * 11, s.y - uz * e.parts.scale * 11, h, e, now);
    }
    this._agewake(e, tSec, now);
  }

  _spawnWake(x, y, h, e, now) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xdff2f7, transparent: true, opacity: 0.5, depthWrite: false });
    const m = new THREE.Mesh(RING_GEO, mat);
    m.position.set(x, h + 0.6, y);
    m.scale.setScalar(6);
    this.scene.add(m);
    e.wake.push({ m, born: now });
    if (e.wake.length > 26) { const old = e.wake.shift(); this._free(old.m); }
  }
  _agewake(e, tSec, now) {
    for (let i = e.wake.length - 1; i >= 0; i--) {
      const w = e.wake[i];
      const k = (now - w.born) / 900;
      if (k >= 1) { this._free(w.m); e.wake.splice(i, 1); continue; }
      w.m.material.opacity = 0.5 * (1 - k);
      w.m.scale.setScalar(6 + k * 16);
    }
  }
  _free(m) { this.scene.remove(m); m.material.dispose(); }
  _dispose(e) {
    this.scene.remove(e.parts.group);
    e.parts.group.traverse((o) => { if (o.isMesh && o.material && (o.material === e.parts.flagMat)) o.material.dispose(); });
    for (const w of e.wake) this._free(w.m);
  }
}

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}
