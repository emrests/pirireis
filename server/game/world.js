// server/game/world.js
import { Ship } from './ship.js';
import { Base } from './base.js';
import { makeCannon, makeGunShot, makeMolotov } from './weapons.js';
import { onKill, onArcherKill, resetStreak, expireBuffs, cooldownFactor, addBuff } from './skills.js';
import { SHIPS, ARCHER, MOLOTOV, MORTAR, BASE, KRAKEN } from './balance.js';
import { dist } from './vec.js';

export class World {
  constructor(id) {
    this.id = id;
    this.ships = new Map();
    this.projectiles = [];
    this.fires = [];
    this.bases = { pirate: new Base('pirate'), navy: new Base('navy') };
    this.respawns = []; // {id, at}
    this.score = { pirate: 0, navy: 0 }; // team kill totals
    this.kraken = { x: 2000, y: 900, ang: Math.random() * 6.28, nextTurn: 0, lastAttackAt: -999999, attackT: -999999, tx: 0, ty: 0 };
    this.over = false;
    this.winner = null;
    this._now = 0;
  }

  addShip(cfg) {
    const rp = this.bases[cfg.faction].respawnPoint();
    const s = new Ship({ ...cfg, pos: rp });
    this.ships.set(cfg.id, s);
    this._recomputeBaseHp();
    return s;
  }
  removeShip(id) { this.ships.delete(id); this._recomputeBaseHp(); }

  // each base's HP = (opposing team size) * perEnemyHp, min one player's worth
  _recomputeBaseHp() {
    const count = { pirate: 0, navy: 0 };
    for (const s of this.ships.values()) count[s.faction] += 1;
    for (const f of ['pirate', 'navy']) {
      const enemy = f === 'pirate' ? 'navy' : 'pirate';
      const max = Math.max(BASE.perEnemyHp, count[enemy] * BASE.perEnemyHp);
      const b = this.bases[f];
      const wasFull = b.hp >= b.maxHp;
      b.maxHp = max;
      b.hp = wasFull ? max : Math.min(b.hp, max);
    }
  }

  input(id, msg) {
    const s = this.ships.get(id);
    if (!s || !s.alive || this.over) return;
    const now = this._now;
    if (msg.type === 'move') {
      if (Number.isFinite(msg.x) && Number.isFinite(msg.y)) s.setTarget(msg.x, msg.y);
      return;
    }
    if (msg.type === 'useSkill') { return; } // buffs are auto-granted; reserved
    if (msg.type === 'donate') {
      if (typeof msg.targetPlayerId !== 'string') return;
      const to = this.ships.get(msg.targetPlayerId);
      const base = this.bases[s.faction];
      if (to && base.canDonate(s, to) && s.buffs.length) {
        const b = s.buffs.shift();
        addBuff(to, b.type, now);
      }
      return;
    }
    if (msg.type === 'fire') {
      if (s.safe) return; // cannot fire while healing in base
      this._fire(s, msg, now);
    }
  }

  _fire(s, msg, now) {
    if (msg.weapon === 'cannon') {
      if (!msg.dir || !Number.isFinite(msg.dir.x) || !Number.isFinite(msg.dir.y)) return;
      const cd = SHIPS[s.cls].reloadMs * cooldownFactor(s);
      if (now - s.lastCannonAt < cd) return;
      s.lastCannonAt = now;
      this.projectiles.push(makeCannon(s, msg.dir, msg.power ?? 1));
    } else if (msg.weapon === 'archer') {
      // rifle: one press starts a 5-round auto burst, then reload (cooldownMs)
      if (!msg.dir || !Number.isFinite(msg.dir.x) || !Number.isFinite(msg.dir.y)) return;
      const cd = ARCHER.cooldownMs * cooldownFactor(s);
      if (now - s.lastArcherAt < cd) return;                 // still reloading
      if (s.gunBurst && s.gunBurst.remaining > 0) return;    // burst in progress
      const rounds = ARCHER.burst + (s.hasBuff('marksman') ? 2 : 0);
      s.gunBurst = { remaining: rounds, nextAt: now, dir: msg.dir };
    } else if (msg.weapon === 'molotov') {
      if (msg.aim && (!Number.isFinite(msg.aim.x) || !Number.isFinite(msg.aim.y))) return;
      const cd = (s.cls === 'bombketch' ? MORTAR.cooldownMs : MOLOTOV.cooldownMs) * cooldownFactor(s);
      if (now - s.lastMolotovAt < cd) return;
      s.lastMolotovAt = now;
      this.fires.push(makeMolotov(s, msg.aim || s.pos));
    }
  }

  step(dtMs, now) {
    this._now = now;
    const events = [];
    if (this.over) return events;

    // if a base already died (e.g. external), end immediately
    for (const f of ['pirate', 'navy']) {
      if (!this.bases[f].alive) { this._endGame(f === 'pirate' ? 'navy' : 'pirate', events); return events; }
    }

    for (const s of this.ships.values()) { if (s.alive) s.step(dtMs); expireBuffs(s, now); }

    for (const f of ['pirate', 'navy']) {
      for (const s of this.ships.values()) {
        if (s.faction === f) this.bases[f].updateHeal(s, dtMs, now);
      }
    }

    this._stepGunBursts(now);
    this._stepProjectiles(dtMs, now, events);
    this._stepFires(dtMs, now, events);
    this._stepKraken(dtMs, now, events);
    this.bases.pirate.regen(dtMs, now);
    this.bases.navy.regen(dtMs, now);
    this._stepRespawns(now);
    return events;
  }

  _enemiesOf(faction) {
    return [...this.ships.values()].filter((s) => s.alive && s.faction !== faction);
  }

  // fire queued rifle-burst rounds whose time has come
  _stepGunBursts(now) {
    for (const s of this.ships.values()) {
      if (!s.alive) { s.gunBurst = null; continue; }
      const b = s.gunBurst;
      if (!b || b.remaining <= 0) continue;
      while (b.remaining > 0 && now >= b.nextAt) {
        this.projectiles.push(makeGunShot(s, b.dir));
        b.remaining -= 1;
        b.nextAt += ARCHER.burstIntervalMs;
        if (b.remaining <= 0) { s.lastArcherAt = now; s.gunBurst = null; break; }
      }
    }
  }

  // the kraken wanders the mid-map and sinks any ship within reach
  _stepKraken(dtMs, now, events) {
    const k = this.kraken, dt = dtMs / 1000;
    if (now >= k.nextTurn) { k.ang = Math.random() * Math.PI * 2; k.nextTurn = now + KRAKEN.turnMs * (0.5 + Math.random()); }
    k.x += Math.cos(k.ang) * KRAKEN.speed * dt;
    k.y += Math.sin(k.ang) * KRAKEN.speed * dt;
    if (k.x < KRAKEN.minX) { k.x = KRAKEN.minX; k.ang = Math.PI - k.ang; }
    if (k.x > KRAKEN.maxX) { k.x = KRAKEN.maxX; k.ang = Math.PI - k.ang; }
    if (k.y < KRAKEN.minY) { k.y = KRAKEN.minY; k.ang = -k.ang; }
    if (k.y > KRAKEN.maxY) { k.y = KRAKEN.maxY; k.ang = -k.ang; }
    if (now - k.lastAttackAt < KRAKEN.attackCooldownMs) return;
    let best = KRAKEN.attackRadius, target = null;
    for (const s of this.ships.values()) {
      if (!s.alive || s.safe) continue;
      const d = dist(s.pos, k);
      if (d < best) { best = d; target = s; }
    }
    if (target) {
      k.lastAttackAt = now; k.attackT = now; k.tx = target.pos.x; k.ty = target.pos.y;
      const died = target.damage(KRAKEN.attackDmg);
      events.push({ type: 'kraken', x: target.pos.x, y: target.pos.y });
      if (died) this._killShip(target, null, 1, 'kraken', now, events);
    }
  }

  _killShip(victim, killer, killsThisShot, weapon, now, events) {
    victim.alive = false;
    resetStreak(victim);
    this.respawns.push({ id: victim.id, at: now + BASE.respawnMs });
    if (killer && killer.alive) {
      const granted = weapon === 'bullet' ? onArcherKill(killer, now) : onKill(killer, killsThisShot, now);
      killer.kills += 1;
      this.score[killer.faction] += 1;
      events.push({ type: 'kill', killer: killer.id, victim: victim.id });
      for (const g of granted) events.push({ type: 'skillGained', player: killer.id, skill: g });
    } else {
      events.push({ type: 'kill', killer: killer ? killer.id : null, victim: victim.id });
    }
  }

  _stepProjectiles(dtMs, now, events) {
    const keep = [];
    for (const p of this.projectiles) {
      const r = p.step(dtMs);
      if (r === 'expired' || r === 'hit-island') continue;
      let hits = 0;
      let consumed = false;
      const owner = this.ships.get(p.owner);
      for (const s of this.ships.values()) {
        if (!s.alive || s.faction === p.faction || s.safe) continue;
        if (dist(s.pos, p.pos) <= p.hitRadius + s.radius) {
          const died = s.damage(p.dmg);
          hits++;
          if (died) this._killShip(s, owner, hits, p.kind === 'bullet' ? 'bullet' : 'cannon', now, events);
          if (!p.pierce) { consumed = true; break; }
        }
      }
      if (!consumed) {
        for (const f of ['pirate', 'navy']) {
          if (f === p.faction) continue;
          const base = this.bases[f];
          if (base.alive && dist(base.pos, p.pos) <= p.hitRadius + BASE.baseHitPad) {
            const died = base.damage(p.dmg);
            base.lastHitAt = now;
            events.push({ type: 'baseHit', faction: f, hp: base.hp });
            if (died) this._endGame(p.faction, events);
            consumed = true;
            break;
          }
        }
      }
      if (!consumed && !this.over) keep.push(p);
    }
    this.projectiles = keep;
  }

  _stepFires(dtMs, now, events) {
    const keep = [];
    for (const fire of this.fires) {
      if (fire.burst && !fire._burst) {
        fire._burst = true;
        const owner = this.ships.get(fire.owner);
        for (const s of this.ships.values()) {
          if (s.alive && s.faction !== fire.faction && !s.safe && fire.contains(s.pos)) {
            const died = s.damage(fire.burst);
            if (died) this._killShip(s, owner, 1, 'cannon', now, events);
          }
        }
      }
      if (fire.dotPerSec) {
        const owner = this.ships.get(fire.owner);
        for (const s of this.ships.values()) {
          if (s.alive && s.faction !== fire.faction && !s.safe && fire.contains(s.pos)) {
            const died = s.damage(fire.dotPerSec * (dtMs / 1000));
            if (died) this._killShip(s, owner, 1, 'cannon', now, events);
          }
        }
      }
      if (fire.step(dtMs) !== 'expired') keep.push(fire);
    }
    this.fires = keep;
  }

  _stepTurrets(dtMs, now, events) {
    for (const f of ['pirate', 'navy']) {
      const base = this.bases[f];
      if (!base.alive) continue;
      if (now - base.lastTurretAt < BASE.turretCooldownMs) continue;
      let target = null, best = BASE.turretRange;
      for (const s of this._enemiesOf(f)) {
        if (s.safe) continue;
        const d = dist(s.pos, base.pos);
        if (d < best) { best = d; target = s; }
      }
      if (target) {
        base.lastTurretAt = now;
        const died = target.damage(BASE.turretDmg);
        if (died) this._killShip(target, null, 1, 'cannon', now, events);
      }
    }
  }

  _stepRespawns(now) {
    const still = [];
    for (const r of this.respawns) {
      if (now >= r.at) {
        const s = this.ships.get(r.id);
        if (s) {
          const rp = this.bases[s.faction].respawnPoint();
          s.pos = rp; s.hp = s.maxHp; s.alive = true; s.target = null; s.buffs = []; s.gunBurst = null;
          s.healingSince = null; s.safe = false;
        }
      } else still.push(r);
    }
    this.respawns = still;
  }

  _endGame(winner, events) {
    if (this.over) return;
    this.over = true;
    this.winner = winner;
    events.push({ type: 'gameOver', winner });
  }

  serialize() {
    return {
      ships: [...this.ships.values()].map((s) => s.serialize()),
      projectiles: this.projectiles.map((p) => p.serialize()),
      fires: this.fires.map((f) => f.serialize()),
      bases: [this.bases.pirate.serialize(), this.bases.navy.serialize()],
      score: this.score,
      kraken: {
        x: Math.round(this.kraken.x), y: Math.round(this.kraken.y), ang: this.kraken.ang,
        atk: (this._now - this.kraken.attackT) < 350, tx: Math.round(this.kraken.tx), ty: Math.round(this.kraken.ty),
      },
      over: this.over, winner: this.winner,
    };
  }
}
