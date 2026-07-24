// server/game/base.js
import { BASE } from './balance.js';
import { BASES } from './map.js';
import { dist } from './vec.js';

export class Base {
  constructor(faction) {
    this.faction = faction;
    this.pos = { ...BASES[faction] };
    this.hp = BASE.hp;
    this.maxHp = BASE.hp;
    this.alive = true;
    this.lastTurretAt = 0;
    this.lastHitAt = -999999; // for slow self-repair when not under attack
  }

  // slow self-repair once the base hasn't been hit for a while
  regen(dtMs, now) {
    if (!this.alive || this.hp >= this.maxHp) return;
    if (now - this.lastHitAt < BASE.regenDelayMs) return;
    this.hp = Math.min(this.maxHp, this.hp + BASE.regenPerSec * (dtMs / 1000));
  }

  inHealZone(ship) { return dist(ship.pos, this.pos) <= BASE.healRadius; }

  updateHeal(ship, dtMs, now) {
    if (!ship.alive) { ship.healingSince = null; ship.safe = false; return; }
    if (this.inHealZone(ship)) {
      if (ship.healingSince == null) ship.healingSince = now;
      ship.safe = true;
      if (now - ship.healingSince >= BASE.healWaitMs) {
        ship.hp = Math.min(ship.maxHp, ship.hp + BASE.healPerSec * (dtMs / 1000));
      }
    } else {
      ship.healingSince = null;
      ship.safe = false;
    }
  }

  damage(amount) {
    if (!this.alive) return false;
    this.hp -= amount;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; return true; }
    return false;
  }

  respawnPoint() {
    const jitter = () => (Math.random() - 0.5) * 120;
    return { x: this.pos.x + jitter(), y: this.pos.y + jitter() };
  }

  canDonate(from, to) {
    return from.faction === this.faction && to.faction === this.faction &&
      from.id !== to.id && from.alive && to.alive &&
      dist(from.pos, this.pos) <= BASE.donateRadius &&
      dist(to.pos, this.pos) <= BASE.donateRadius;
  }

  serialize() {
    return { faction:this.faction, x:this.pos.x, y:this.pos.y, hp:Math.round(this.hp), maxHp:this.maxHp, alive:this.alive };
  }
}
