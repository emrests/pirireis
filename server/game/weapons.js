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
  constructor({ id, kind, owner, faction, pos, vel, dmg, life, pierce }) {
    this.id = id; this.kind = kind; this.owner = owner; this.faction = faction;
    this.pos = { x: pos.x, y: pos.y }; this.vel = { x: vel.x, y: vel.y };
    this.dmg = dmg; this.life = life; this.pierce = !!pierce; this.hitRadius = CANNON.hitRadius;
    if (kind === 'arrow') this.hitRadius = ARCHER.hitRadius;
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
    return { id:this.id, kind:this.kind, x:Math.round(this.pos.x), y:Math.round(this.pos.y), faction:this.faction };
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
    dmg, life, pierce: ship.hasBuff('chainshot'),
  });
}
