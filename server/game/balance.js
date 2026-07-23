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
export const CANNON = { minDmgFactor:0.3, speed:900, radius:14, hitRadius:34 };

// Archer: flat low damage, fast, no falloff.
export const ARCHER = { dmg:7, cooldownMs:700, range:420, arrows:3, spread:0.28, speed:1100, hitRadius:30 };

// Molotov: thrown area, lingering DoT.
export const MOLOTOV = { cooldownMs:6000, radius:150, durationMs:4000, dotPerSec:22, throwRange:600 };

// Bomb ketch special override (instant shock area instead of lingering fire).
export const MORTAR = { cooldownMs:6000, radius:170, durationMs:400, dotPerSec:0, burst:70, throwRange:1100 };

export const BASE = {
  hp:2000, healRadius:420, healWaitMs:2000, healPerSec:40,
  turretDmg:18, turretRange:700, turretCooldownMs:1200,
  respawnMs:5000, donateRadius:460,
};
