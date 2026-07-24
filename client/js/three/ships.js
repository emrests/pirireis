// client/js/three/ships.js
// Procedural 3D ships (Age-of-Empires-ish), one Group per class built from
// Three primitives. Ships ride the real Gerstner surface (sampled on the CPU),
// yaw to their heading (derived from movement), leave a foam wake and sink when
// destroyed. Meshes are cached per ship id and disposed when the ship leaves.
import * as THREE from '/vendor/three.module.js';
import { waveHeight, waveNormal } from './waves.js';

const SINK_MS = 2600;
const MOVE_EPS = 1.2;         // world units between frames to update heading
const MOVING_SPEED = 12;      // world units/sec => "moving"
const WAKE_MS = 220;         // ms between wake puffs (higher = subtler trail)

// length,width,height, mast count, scale — bigger classes are larger.
const CLASS = {
  sloop:      { s: 20, masts: 1 }, cutter:     { s: 21, masts: 1 },
  brig:       { s: 25, masts: 2 }, corvette:   { s: 25, masts: 2 },
  frigate:    { s: 29, masts: 2 }, frigate_n:  { s: 29, masts: 2 },
  galleon:    { s: 40, masts: 3 }, shipofline: { s: 42, masts: 3 },
  fireship:   { s: 28, masts: 2, brazier: true },
  bombketch:  { s: 30, masts: 1, mortar: true },
  boat:       { s: 11, masts: 0, soldier: true }, // NPC rowboat
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
  // flag in player colour at tallest mast (low for the mastless NPC boat)
  const flagMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(flagColor || '#ffffff'), roughness: 0.8, side: THREE.DoubleSide, emissive: new THREE.Color(flagColor || '#ffffff'), emissiveIntensity: 0.12 });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.2), flagMat);
  flag.position.set(0.55, nm > 0 ? 1.78 : 0.7, 0); g.add(flag);

  // NPC soldier standing in the rowboat, musket in hand
  if (spec.soldier) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.5, 7), new THREE.MeshStandardMaterial({ color: 0x39485a, roughness: 0.85 }));
    body.position.set(0, 0.78, 0); body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshStandardMaterial({ color: 0xc98c5a, roughness: 0.8 }));
    head.position.set(0, 1.08, 0); head.castShadow = true; g.add(head);
    const musket = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 5), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5 }));
    musket.rotation.z = Math.PI / 2; musket.position.set(0.4, 0.82, 0.06); g.add(musket);
  }

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

  const scale = spec.s * 1.7; // prominent at the AoE zoom (small 6-8p arena)
  g.scale.setScalar(scale);
  return { group: g, sails, flag, brazier, flagMat, sailMat, scale };
}

const _up = new THREE.Vector3(0, 1, 0);
const _n = new THREE.Vector3();
const _qTilt = new THREE.Quaternion();
const _qYaw = new THREE.Quaternion();

export class ShipManager {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
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
        e = { parts, heading: s.faction === 'pirate' ? 0 : Math.PI, lastX: s.x, lastY: s.y, vx: 0, vz: 0, deadSince: null, wake: [], lastWake: 0, phase: Math.random() * 6.28 };
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
    // derive heading from a SMOOTHED velocity, not the raw per-frame delta —
    // otherwise interpolation noise makes big/slow hulls wobble as they sail.
    e.vx = e.vx * 0.82 + dx * 0.18; e.vz = e.vz * 0.82 + dz * 0.18;
    const sp = Math.hypot(e.vx, e.vz);
    const moving = s.alive && sp > MOVE_EPS;
    if (moving) {
      const target = Math.atan2(-e.vz, e.vx);
      e.heading = lerpAngle(e.heading, target, 0.14);
    }
    e.lastX = s.x; e.lastY = s.y;

    if (!s.alive && e.deadSince == null) { e.deadSince = now; if (this.fx) this.fx.spawnDeath(s.x, s.y); }
    if (s.alive) e.deadSince = null;

    const h = waveHeight(s.x, s.y, tSec);
    if (e.deadSince != null) {
      const k = Math.min(1, (now - e.deadSince) / SINK_MS);
      const sink = k * k * (0.6 * e.parts.scale + 90); // accelerate under, scale with hull
      g.position.set(s.x, h - sink, s.y);
      _qYaw.setFromAxisAngle(_up, e.heading);
      _qTilt.setFromAxisAngle(new THREE.Vector3(1, 0, 0.45).normalize(), k * 1.7);
      g.quaternion.copy(_qTilt).multiply(_qYaw);
      return;
    }

    // float on the surface but only PARTLY follow the waves — ships are heavy,
    // so damp both the vertical bob and the tilt for a calmer ride.
    const n = waveNormal(s.x, s.y, tSec);
    _n.set(n.x * 0.35, 1, n.z * 0.35).normalize(); // pull the tilt toward upright
    const bowLift = moving ? 0.05 : 0;
    g.position.set(s.x, h * 0.4 - 0.28 * e.parts.scale, s.y); // only 40% of wave height
    _qTilt.setFromUnitVectors(_up, _n);
    _qYaw.setFromAxisAngle(_up, e.heading);
    g.quaternion.copy(_qTilt).multiply(_qYaw);
    g.rotateZ(bowLift + Math.sin(tSec * 1.4 + e.phase) * 0.01); // gentle roll

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
      const sc = e.parts.scale;
      this._spawnWake(s.x - ux * sc * 1.1, s.y - uz * sc * 1.1, h, sc, e, now);
    }
    this._agewake(e, tSec, now);
  }

  _spawnWake(x, y, h, sc, e, now) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xdff2f7, transparent: true, opacity: 0.28, depthWrite: false });
    const m = new THREE.Mesh(RING_GEO, mat);
    m.position.set(x, h + 1.5, y);
    const base = sc * 0.32;
    m.scale.setScalar(base);
    this.scene.add(m);
    e.wake.push({ m, born: now, base });
    if (e.wake.length > 12) { const old = e.wake.shift(); this._free(old.m); }
  }
  _agewake(e, tSec, now) {
    for (let i = e.wake.length - 1; i >= 0; i--) {
      const w = e.wake[i];
      const k = (now - w.born) / 800;
      if (k >= 1) { this._free(w.m); e.wake.splice(i, 1); continue; }
      w.m.material.opacity = 0.28 * (1 - k);
      w.m.scale.setScalar(w.base * (1 + k * 1.8));
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
