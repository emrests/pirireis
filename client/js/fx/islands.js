// client/js/fx/islands.js
// Textured islands: drop shadow, animated surf/foam ring, sandy beach band,
// vegetated interior with a scatter of deterministic trees/rocks.
import { worldToScreen } from '../iso.js';
import { screenRadius, mulberry32 } from './util.js';

const decorCache = new Map();

function decorFor(island) {
  const key = island.x + ',' + island.y;
  let items = decorCache.get(key);
  if (items) return items;
  const rnd = mulberry32((island.x * 7349 + island.y * 104729) >>> 0);
  const n = 5 + Math.floor(rnd() * 3);
  items = [];
  for (let i = 0; i < n; i++) {
    items.push({
      ang: rnd() * Math.PI * 2,
      dist: 0.12 + rnd() * 0.5,
      kind: rnd() > 0.7 ? 'rock' : 'tree',
      scale: 0.7 + rnd() * 0.7,
    });
  }
  decorCache.set(key, items);
  return items;
}

export function drawIslands(ctx, islands, cam, time) {
  for (const isl of islands) {
    const p = worldToScreen(isl.x, isl.y, cam);
    const rx = screenRadius(isl.x, isl.y, isl.r, cam);
    const ry = rx * 0.5;

    // drop shadow
    ctx.beginPath();
    ctx.ellipse(p.sx + 6, p.sy + 10, rx * 1.02, ry * 1.02, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fill();

    // surf/foam ring, gently pulsing
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.0018 + isl.x * 0.01);
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy, rx * 1.14, ry * 1.14, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${(0.30 + 0.22 * pulse).toFixed(3)})`;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy, rx * 1.07, ry * 1.07, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${(0.18 + 0.12 * (1 - pulse)).toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.stroke();

    // sandy beach band
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#dfc98a';
    ctx.fill();

    // vegetated interior
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy, rx * 0.8, ry * 0.8, 0, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(p.sx, p.sy - ry * 0.3, rx * 0.1, p.sx, p.sy, rx * 0.8);
    g.addColorStop(0, '#4f9a5c');
    g.addColorStop(1, '#2c6b3c');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,60,30,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // trees / rocks
    for (const d of decorFor(isl)) {
      const dx = Math.cos(d.ang) * rx * 0.78 * d.dist;
      const dy = Math.sin(d.ang) * ry * 0.78 * d.dist;
      const sx = p.sx + dx, sy = p.sy + dy;
      if (d.kind === 'tree') {
        const th = 13 * d.scale;
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.ellipse(sx + 2, sy + 3, 6 * d.scale, 3 * d.scale, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#5a3d21'; ctx.lineWidth = 2 * d.scale;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - th); ctx.stroke();
        ctx.fillStyle = '#356b34';
        ctx.beginPath(); ctx.arc(sx, sy - th, 7 * d.scale, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath(); ctx.arc(sx - 2 * d.scale, sy - th - 2 * d.scale, 3 * d.scale, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath(); ctx.ellipse(sx + 2, sy + 2, 6 * d.scale, 3 * d.scale, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8b8b86';
        ctx.beginPath(); ctx.ellipse(sx, sy, 6 * d.scale, 4 * d.scale, 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath(); ctx.ellipse(sx - d.scale, sy - d.scale, 2.4 * d.scale, 1.4 * d.scale, 0.3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}
