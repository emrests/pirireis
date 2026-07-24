// server/game/balance.js
// ALL tunable numbers live here. Units: distance = world units, time = ms.
export { TICK_MS } from '../../shared/constants.js';

// Ship stat table. reloadMs = cannon reload. range = max cannon range.
export const SHIPS = {
  // PIRATES
  sloop:      { faction:'pirate', size:'small',    hp:80,  speed:190, cannonDmg:14, reloadMs:1400, range:520,  vision:900, special:'kite' },
  brig:       { faction:'pirate', size:'smallmed', hp:110, speed:165, cannonDmg:20, reloadMs:1700, range:620,  vision:750, special:'archer' },
  frigate:    { faction:'pirate', size:'medium',   hp:150, speed:140, cannonDmg:26, reloadMs:2000, range:680,  vision:750, special:'balanced' },
  galleon:    { faction:'pirate', size:'large',    hp:240, speed:90,  cannonDmg:44, reloadMs:2900, range:820,  vision:700, special:'crusher' },
  fireship:   { faction:'pirate', size:'special',  hp:120, speed:130, cannonDmg:16, reloadMs:2000, range:520,  vision:750, special:'fire' },
  // NAVY
  cutter:     { faction:'navy',   size:'small',    hp:90,  speed:180, cannonDmg:14, reloadMs:1400, range:520,  vision:950, special:'scout' },
  corvette:   { faction:'navy',   size:'smallmed', hp:120, speed:160, cannonDmg:20, reloadMs:1700, range:700,  vision:800, special:'archer' },
  frigate_n:  { faction:'navy',   size:'medium',   hp:160, speed:136, cannonDmg:26, reloadMs:2000, range:700,  vision:750, special:'balanced' },
  shipofline: { faction:'navy',   size:'large',    hp:260, speed:84,  cannonDmg:46, reloadMs:3000, range:860,  vision:700, special:'armor' },
  bombketch:  { faction:'navy',   size:'special',  hp:130, speed:120, cannonDmg:24, reloadMs:3200, range:1100, vision:750, special:'mortar' },
};

// Cannon: distance-damage falloff. dmg = cannonDmg * lerp(1 -> minDmgFactor, d/range)
// Cannon = HIGHEST damage (class-based, close full / far reduced), flat 4s reload.
export const CANNON = { minDmgFactor:0.3, speed:620, radius:14, hitRadius:34, reloadMs:4000 };

// Rifle ("Tüfek"): one key-press fires a 5-round automatic BURST, then must
// reload (cooldownMs). Flat low damage per bullet, no falloff. (Field name
// ARCHER kept so the 'archer' weapon id / streak wiring stays intact.)
// Rifle = LOWEST damage of the three, reload 2s.
export const ARCHER = { dmg:6, cooldownMs:2000, range:660, speed:1600, hitRadius:24, spread:0.05, burst:5, burstIntervalMs:85 };

// Molotov = MIDDLE damage, reload 3s. Thrown area, lingering DoT.
export const MOLOTOV = { cooldownMs:3000, radius:150, durationMs:4000, dotPerSec:14, throwRange:600 };

// Bomb ketch special override (instant shock area instead of lingering fire).
export const MORTAR = { cooldownMs:3000, radius:170, durationMs:400, dotPerSec:0, burst:70, throwRange:1100 };

export const BASE = {
  hp:700, perEnemyHp:100, regenDelayMs:10000, regenPerSec:1.5,
  healRadius:420, healWaitMs:2000, healPerSec:40,
  turretDmg:18, turretRange:700, turretCooldownMs:1200,
  respawnMs:5000, donateRadius:460, baseHitPad:230,
};

// Kraken: a neutral sea monster that roams the mid-map and sinks any ship it
// reaches with its arms. Stays away from the edges/bases (min/max bounds).
export const KRAKEN = {
  speed:60, chaseSpeed:100, turnRate:1.8, turnMs:3200, radius:90,
  detectRadius:650, attackRadius:320, attackDmg:65, attackCooldownMs:1400,
  minX:900, maxX:3100, minY:750, maxY:3250,
};

export const BUFF_MS = {
  fastreload:12000, broadside:10000, fullsails:10000, inferno:12000,
  chainshot:8000, shockwave:8000, marksman:10000,
};

// Full Sails buff: +50% speed (see ship.speedNow) AND -25% damage taken.
export const FULLSAILS_RESIST = 0.25;
