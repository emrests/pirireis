// client/js/fx/util.js
// Small stateless helpers shared by the fx modules. No canvas side effects.
import { worldToScreen } from '../iso.js';

// Screen-space radius of a world-space circle of radius r centered at (cx,cy).
export function screenRadius(cx, cy, r, cam) {
  const p = worldToScreen(cx, cy, cam);
  const e = worldToScreen(cx + r, cy, cam);
  return Math.abs(e.sx - p.sx) || 1;
}

// Angle (screen space, radians) of a world-space direction vector (dx,dy)
// starting at world point (x,y), respecting the isometric projection so
// rotated ship/arrow art matches the apparent travel direction on screen.
export function screenAngleForWorldDir(x, y, dx, dy, cam) {
  const p0 = worldToScreen(x, y, cam);
  const p1 = worldToScreen(x + dx, y + dy, cam);
  return Math.atan2(p1.sy - p0.sy, p1.sx - p0.sx);
}

// Shortest-path angle interpolation (handles wraparound at +-PI).
export function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// Deterministic 0..1 pseudo-hash of a string, used to give stable per-entity
// visual variation (flicker seeds, decoration layout) without Math.random()
// causing flicker-per-frame reshuffles.
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

// Small seeded PRNG (mulberry32) for deterministic per-entity decoration.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
