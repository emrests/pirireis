import { SHIPS, FULLSAILS_RESIST } from './balance.js';
import { sub, len, norm } from './vec.js';
import { resolveShipCollision } from './map.js';

const RADIUS_BY_SIZE = { small:16, smallmed:20, medium:24, large:34, special:24 };

export class Ship {
  constructor({ id, name, faction, cls, flagColor, pos }) {
    const stat = SHIPS[cls];
    if (!stat) throw new Error('unknown ship class ' + cls);
    this.id = id;
    this.name = name;
    this.faction = faction;
    this.cls = cls;
    this.flagColor = flagColor;
    this.stat = stat;
    this.pos = { x: pos.x, y: pos.y };
    this.target = null;
    this.hp = stat.hp;
    this.maxHp = stat.hp;
    this.alive = true;
    this.radius = RADIUS_BY_SIZE[stat.size] || 22;
    this.buffs = [];               // [{type, until}]
    this.streak = 0;
    this.kills = 0;                // total kills this match (persists across deaths)
    this.archerKills = 0;
    this.lastCannonAt = -999999;
    this.lastArcherAt = -999999;
    this.lastMolotovAt = -999999;
    this.gunBurst = null;          // {remaining, nextAt, dir} active rifle burst
    this.healingSince = null;      // ts when entered heal zone (set by base logic)
    this.safe = false;             // true while healing in own base zone
  }

  hasBuff(type) { return this.buffs.some((b) => b.type === type); }

  speedNow() {
    let mult = 1;
    if (this.hasBuff('fullsails')) mult *= 1.5;
    return this.stat.speed * mult;
  }

  setTarget(x, y) { this.target = { x, y }; }

  step(dtMs) {
    if (!this.alive || !this.target) return;
    const dt = dtMs / 1000;
    const d = sub(this.target, this.pos);
    const dl = len(d);
    if (dl < 4) { this.target = null; return; }
    const dir = norm(d);
    const stepLen = Math.min(dl, this.speedNow() * dt);
    const next = { x: this.pos.x + dir.x * stepLen, y: this.pos.y + dir.y * stepLen };
    this.pos = resolveShipCollision(next, this.radius);
  }

  damage(amount) {
    if (!this.alive) return false;
    if (this.hasBuff('fullsails')) amount *= (1 - FULLSAILS_RESIST);
    this.hp -= amount;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; return true; }
    return false;
  }

  serialize() {
    return {
      id: this.id, name: this.name, faction: this.faction, cls: this.cls,
      flagColor: this.flagColor, x: Math.round(this.pos.x), y: Math.round(this.pos.y),
      hp: Math.round(this.hp), maxHp: this.maxHp, alive: this.alive,
      streak: this.streak, kills: this.kills, buffs: this.buffs.map((b) => b.type),
    };
  }
}
