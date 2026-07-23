// client/js/render.js
import { worldToScreen } from './iso.js';
import { drawShip } from './ships/draw.js';

// Island list mirrors server/game/map.js (kept in sync manually).
export const ISLANDS = [
  { x:2000,y:2000,r:320 }, { x:1300,y:2600,r:220 }, { x:2700,y:1400,r:220 },
  { x:1200,y:1200,r:180 }, { x:2800,y:2800,r:180 },
];
const HEAL_R = 420;

export class Renderer {
  constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.resize(); }
  resize() { this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; }

  draw(state, cam, meId) {
    const ctx = this.ctx;
    cam.cx = this.canvas.width / 2; cam.cy = this.canvas.height / 2;
    ctx.fillStyle = '#12455f'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (const b of state.bases) {
      const p = worldToScreen(b.x, b.y, cam);
      const hz = worldToScreen(b.x + HEAL_R, b.y, cam);
      const rr = Math.abs(hz.sx - p.sx);
      ctx.beginPath(); ctx.arc(p.sx, p.sy, rr, 0, 7);
      ctx.fillStyle = b.faction === 'pirate' ? '#e6394622' : '#4db5ff22'; ctx.fill();
      ctx.fillStyle = b.alive ? '#c9a24b' : '#444';
      ctx.fillRect(p.sx - 26, p.sy - 20, 52, 40);
      const frac = Math.max(0, b.hp / b.maxHp);
      ctx.fillStyle = '#000a'; ctx.fillRect(p.sx - 30, p.sy - 34, 60, 6);
      ctx.fillStyle = b.faction === 'pirate' ? '#e63946' : '#4db5ff';
      ctx.fillRect(p.sx - 30, p.sy - 34, 60 * frac, 6);
    }

    for (const i of ISLANDS) {
      const p = worldToScreen(i.x, i.y, cam);
      const e = worldToScreen(i.x + i.r, i.y, cam);
      const rx = Math.abs(e.sx - p.sx);
      ctx.beginPath(); ctx.ellipse(p.sx, p.sy, rx, rx / 2, 0, 0, 7);
      ctx.fillStyle = '#3d7a4f'; ctx.fill(); ctx.strokeStyle = '#2a5738'; ctx.stroke();
    }

    for (const f of state.fires) {
      const p = worldToScreen(f.x, f.y, cam);
      const e = worldToScreen(f.x + f.radius, f.y, cam);
      const rx = Math.abs(e.sx - p.sx);
      ctx.beginPath(); ctx.ellipse(p.sx, p.sy, rx, rx / 2, 0, 0, 7);
      ctx.fillStyle = '#ff6a0055'; ctx.fill();
    }

    for (const pr of state.projectiles) {
      const p = worldToScreen(pr.x, pr.y, cam);
      ctx.beginPath(); ctx.arc(p.sx, p.sy, pr.kind === 'arrow' ? 2 : 4, 0, 7);
      ctx.fillStyle = pr.kind === 'arrow' ? '#e8d8a0' : '#111'; ctx.fill();
    }

    const ships = [...state.ships].sort((a, b) => a.y - b.y);
    for (const s of ships) drawShip(ctx, s, worldToScreen(s.x, s.y, cam), cam.scale);

    this._hud(state, meId);
  }

  _hud(state, meId) {
    const ctx = this.ctx;
    const p = state.bases.find((b) => b.faction === 'pirate');
    const n = state.bases.find((b) => b.faction === 'navy');
    ctx.fillStyle = '#fff'; ctx.font = '14px system-ui'; ctx.textAlign = 'left';
    ctx.fillText(`🏴‍☠️ ${p.hp}    ⚓ ${n.hp}`, 12, 22);
    const mine = state.ships.find((s) => s.id === meId);
    if (mine) {
      ctx.fillText(`HP ${mine.hp}/${mine.maxHp}   Seri ${mine.streak}   Buff: ${mine.buffs.join(', ') || '-'}`, 12, this.canvas.height - 16);
    }
  }
}
