import { WORLD } from '../../shared/constants.js';
import { clamp } from './vec.js';

export const BASES = {
  pirate: { x: 500,  y: 500 },
  navy:   { x: 3500, y: 3500 },
};

// Handcrafted islands (impassable cover) in the mid-field.
export const ISLANDS = [
  { x: 2000, y: 2000, r: 320 },
  { x: 1300, y: 2600, r: 220 },
  { x: 2700, y: 1400, r: 220 },
  { x: 1200, y: 1200, r: 180 },
  { x: 2800, y: 2800, r: 180 },
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
