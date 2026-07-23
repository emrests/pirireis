// client/js/fx/bases.js
// Fortified harbor forts: stone dock, twin towers, faction banner, a couple
// of cannons, a soft pulsing healing-zone ring, and a clean HP bar.
// Positions always come from the server-provided base (never hardcoded).
import { worldToScreen } from '../iso.js';
import { screenRadius } from './util.js';

const HEAL_R = 420; // must match server BASE.healRadius

const COLORS = {
  pirate: { flag: '#e63946', wood: '#4a2f16', accent: '#8a1f28' },
  navy: { flag: '#4db5ff', wood: '#2c3b4e', accent: '#caa63e' },
};

export function drawBase(ctx, base, cam, time) {
  const p = worldToScreen(base.x, base.y, cam);
  const rr = screenRadius(base.x, base.y, HEAL_R, cam);
  const col = COLORS[base.faction] || COLORS.pirate;
  const c = base.faction === 'pirate' ? '230,57,70' : '77,181,255';

  // pulsing healing-zone ring
  const pulse = 0.5 + 0.5 * Math.sin(time * 0.0016);
  const g = ctx.createRadialGradient(p.sx, p.sy, rr * 0.25, p.sx, p.sy, rr);
  g.addColorStop(0, `rgba(${c},${(0.02 + 0.05 * pulse).toFixed(3)})`);
  g.addColorStop(0.85, `rgba(${c},${(0.09 + 0.07 * pulse).toFixed(3)})`);
  g.addColorStop(1, `rgba(${c},0)`);
  ctx.beginPath(); ctx.arc(p.sx, p.sy, rr, 0, Math.PI * 2);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = `rgba(${c},${(0.22 + 0.18 * pulse).toFixed(3)})`;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.save();
  if (!base.alive) ctx.globalAlpha = 0.35;

  const dw = 92, dh = 34;

  // stone dock
  ctx.fillStyle = '#7d7a72';
  ctx.fillRect(p.sx - dw / 2, p.sy - dh / 2, dw, dh);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
  ctx.strokeRect(p.sx - dw / 2, p.sy - dh / 2, dw, dh);
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath(); ctx.moveTo(p.sx - dw / 2, p.sy + i * 5); ctx.lineTo(p.sx + dw / 2, p.sy + i * 5); ctx.stroke();
  }

  // twin towers
  for (const tx of [-dw / 2 - 6, dw / 2 + 6]) {
    ctx.fillStyle = col.wood;
    ctx.fillRect(p.sx + tx - 8, p.sy - dh / 2 - 26, 16, 26);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
    ctx.strokeRect(p.sx + tx - 8, p.sy - dh / 2 - 26, 16, 26);
    ctx.fillStyle = '#9c9488';
    ctx.beginPath();
    ctx.moveTo(p.sx + tx - 10, p.sy - dh / 2 - 26);
    ctx.lineTo(p.sx + tx, p.sy - dh / 2 - 40);
    ctx.lineTo(p.sx + tx + 10, p.sy - dh / 2 - 26);
    ctx.closePath(); ctx.fill();
  }

  // cannons peeking over the dock wall
  ctx.fillStyle = '#222';
  ctx.fillRect(p.sx - dw / 2 + 10, p.sy - dh / 2 - 4, 13, 5);
  ctx.fillRect(p.sx + dw / 2 - 23, p.sy - dh / 2 - 4, 13, 5);

  // banner pole + waving faction flag
  const flagT = time * 0.005;
  const poleX = p.sx, poleTopY = p.sy - dh / 2 - 46;
  ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(poleX, p.sy - dh / 2 - 8); ctx.lineTo(poleX, poleTopY); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(poleX, poleTopY);
  for (let i = 0; i <= 6; i++) {
    const fx = poleX + (i / 6) * 24;
    const fy = poleTopY + Math.sin(flagT + i * 0.9) * 3 + (i / 6) * 9 - 3;
    ctx.lineTo(fx, fy);
  }
  ctx.lineTo(poleX, poleTopY + 11);
  ctx.closePath();
  ctx.fillStyle = col.flag;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();

  ctx.restore();

  // HP bar
  const frac = Math.max(0, base.hp / base.maxHp);
  const bw = 74;
  const by = p.sy - dh / 2 - 60;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(p.sx - bw / 2, by, bw, 7);
  ctx.fillStyle = base.faction === 'pirate' ? '#e63946' : '#4db5ff';
  ctx.fillRect(p.sx - bw / 2, by, bw * frac, 7);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
  ctx.strokeRect(p.sx - bw / 2, by, bw, 7);
  ctx.fillStyle = '#fff'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
  ctx.fillText((base.faction === 'pirate' ? '🏴‍☠️' : '⚓') + ' ' + Math.round(base.hp), p.sx, by - 3);
}
