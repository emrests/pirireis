import { WORLD } from '../../shared/constants.js';
import { clamp } from './vec.js';

// Bases sit on the LEFT and RIGHT edges — the battle flows horizontally.
export const BASES = {
  pirate: { x: 400,  y: 2000 },
  navy:   { x: 3600, y: 2000 },
};

// Handcrafted islands (impassable cover), symmetric left<->right so neither
// side has a terrain advantage. Center is blocked; top (y~500) and bottom
// (y~3500) stay open as flanking lanes.
export const ISLANDS = [
  { x: 2000, y: 2000, r: 300 },
  { x: 1350, y: 1150, r: 210 },
  { x: 2650, y: 1150, r: 210 },
  { x: 1350, y: 2850, r: 210 },
  { x: 2650, y: 2850, r: 210 },
];

export function blocked(p) {
  return ISLANDS.some((i) => Math.hypot(p.x - i.x, p.y - i.y) < i.r);
}

// Distance from point p to segment ab.
function distPointSeg(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const apx = p.x - a.x, apy = p.y - a.y;
  const len2 = abx * abx + aby * aby;
  let t = len2 === 0 ? 0 : (apx * abx + apy * aby) / len2;
  t = clamp(t, 0, 1);
  const cx = a.x + abx * t, cy = a.y + aby * t;
  return Math.hypot(p.x - cx, p.y - cy);
}

export function segmentHitsIsland(a, b) {
  return ISLANDS.some((i) => distPointSeg(i, a, b) < i.r);
}

export function resolveShipCollision(pos, radius) {
  let x = clamp(pos.x, radius, WORLD.w - radius);
  let y = clamp(pos.y, radius, WORLD.h - radius);
  for (const i of ISLANDS) {
    const dx = x - i.x, dy = y - i.y;
    const d = Math.hypot(dx, dy);
    const min = i.r + radius;
    if (d < min && d > 0) {
      x = i.x + (dx / d) * min;
      y = i.y + (dy / d) * min;
    } else if (d === 0) {
      x = i.x + min;
    }
  }
  return { x, y };
}
