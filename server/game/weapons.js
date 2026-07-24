import { CANNON, ARCHER, MOLOTOV, MORTAR, SHIPS } from './balance.js';
import { lerp, clamp, norm, scale } from './vec.js';
import { segmentHitsIsland } from './map.js';

let _pid = 0;
const nextId = () => 'proj' + (++_pid);

export function cannonDamage(baseDmg, travelled, maxRange) {
  const t = clamp(travelled / maxRange, 0, 1);
  return baseDmg * lerp(1, CANNON.minDmgFactor, t);
}

export class Projectile {
  constructor({ id, kind, owner, faction, pos, vel, dmg, life, pierce, dist }) {
    this.id = id; this.kind = kind; this.owner = owner; this.faction = faction;
    this.pos = { x: pos.x, y: pos.y }; this.vel = { x: vel.x, y: vel.y };
    this.dmg = dmg; this.life = life; this.pierce = !!pierce; this.hitRadius = CANNON.hitRadius;
    if (kind === 'arrow') this.hitRadius = ARCHER.hitRadius;
    // spawn + intended travel distance, so the client can draw a ballistic arc
    this.sx = pos.x; this.sy = pos.y; this.dist = dist || 0;
  }
  step(dtMs) {
    const dt = dtMs / 1000;
    const prev = { x: this.pos.x, y: this.pos.y };
    this.pos = { x: this.pos.x + this.vel.x * dt, y: this.pos.y + this.vel.y * dt };
    this.life -= dtMs;
    if (segmentHitsIsland(prev, this.pos)) return 'hit-island';
    if (this.life <= 0) return 'expired';
    return null;
  }
  serialize() {
    return { id:this.id, kind:this.kind, x:Math.round(this.pos.x), y:Math.round(this.pos.y), faction:this.faction,
      sx:Math.round(this.sx), sy:Math.round(this.sy), dist:Math.round(this.dist) };
  }
}

// dir = direction {x,y} (not necessarily unit); power in [0,1] chooses intended travel distance.
export function makeCannon(ship, dir, power) {
  const range = SHIPS[ship.cls].range;
  const p = clamp(power, 0.05, 1);
  const travel = range * p;
  const dmgMult = ship.hasBuff('broadside') ? 2 : 1;
  const dmg = cannonDamage(SHIPS[ship.cls].cannonDmg, travel, range) * dmgMult;
  const d = norm(dir);
  const life = (travel / CANNON.speed) * 1000;
  return new Projectile({
    id: nextId(), kind:'cannon', owner:ship.id, faction:ship.faction,
    pos:{ x:ship.pos.x, y:ship.pos.y }, vel: scale(d, CANNON.speed),
    dmg, life, pierce: ship.hasBuff('chainshot'), dist: travel,
  });
}

export function makeArcherVolley(ship, dir) {
  const marks = ship.hasBuff('marksman');
  const count = ARCHER.arrows + (marks ? 2 : 0);
  const range = ARCHER.range * (marks ? 1.4 : 1);
  const life = (range / ARCHER.speed) * 1000;
  const baseAng = Math.atan2(dir.y, dir.x);
  const out = [];
  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * (ARCHER.spread / Math.max(1, count - 1)) * 2;
    const ang = baseAng + offset;
    out.push(new Projectile({
      id: nextId(), kind:'arrow', owner:ship.id, faction:ship.faction,
      pos:{ x:ship.pos.x, y:ship.pos.y },
      vel:{ x:Math.cos(ang) * ARCHER.speed, y:Math.sin(ang) * ARCHER.speed },
      dmg: ARCHER.dmg, life, pierce:false, dist: range,
    }));
  }
  return out;
}

export class FireArea {
  constructor({ id, owner, faction, pos, radius, life, dotPerSec, burst, from }) {
    this.id = id; this.owner = owner; this.faction = faction;
    this.pos = { x: pos.x, y: pos.y }; this.radius = radius;
    this.life = life; this.dotPerSec = dotPerSec; this.burst = burst || 0;
    this._burst = false;
    // where it was thrown from, so the client can arc the projectile in
    this.sx = from ? from.x : pos.x; this.sy = from ? from.y : pos.y;
  }
  step(dtMs) { this.life -= dtMs; return this.life <= 0 ? 'expired' : null; }
  contains(p) { return Math.hypot(p.x - this.pos.x, p.y - this.pos.y) <= this.radius; }
  serialize() {
    return { id:this.id, x:Math.round(this.pos.x), y:Math.round(this.pos.y), radius:this.radius, faction:this.faction,
      sx:Math.round(this.sx), sy:Math.round(this.sy) };
  }
}

export function makeMolotov(ship, aimPos) {
  const from = { x: ship.pos.x, y: ship.pos.y };
  if (ship.cls === 'bombketch') {
    return new FireArea({
      id: nextId(), owner:ship.id, faction:ship.faction, pos:aimPos, from,
      radius: MORTAR.radius, life: MORTAR.durationMs, dotPerSec: MORTAR.dotPerSec, burst: MORTAR.burst,
    });
  }
  const big = ship.cls === 'fireship' || ship.hasBuff('inferno');
  return new FireArea({
    id: nextId(), owner:ship.id, faction:ship.faction, pos:aimPos, from,
    radius: MOLOTOV.radius * (big ? 2 : 1),
    life: MOLOTOV.durationMs * (big ? 2 : 1),
    dotPerSec: MOLOTOV.dotPerSec * (ship.hasBuff('inferno') ? 2 : 1),
    burst: 0,
  });
}
