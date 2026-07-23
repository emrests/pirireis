// client/js/three/hud.js
// 2D HUD drawn on an overlay canvas above the WebGL scene: both base HP bars
// (top centre), the own-ship panel (bottom-left) and a minimap (top-right).
const WORLD = 4000;

function panel(ctx, x, y, w, h, r = 10) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = 'rgba(8,20,30,0.55)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.stroke();
}

function bar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.strokeRect(x, y, w, h);
}

export function drawHUD(ctx, W, H, state, meId, islands) {
  ctx.clearRect(0, 0, W, H);
  const pirate = state.bases.find((b) => b.faction === 'pirate');
  const navy = state.bases.find((b) => b.faction === 'navy');

  // top-centre base HP
  if (pirate && navy) {
    const bw = 220, gap = 60, total = bw * 2 + gap, x0 = (W - total) / 2, y = 16;
    panel(ctx, x0 - 16, y - 8, total + 32, 44, 12);
    ctx.font = '600 15px system-ui'; ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
    ctx.fillText('🏴‍☠️', x0 - 4, y + 14);
    bar(ctx, x0 + 22, y + 6, bw - 22, 16, pirate.hp / pirate.maxHp, '#e63946');
    ctx.textAlign = 'right';
    ctx.fillText('⚓', x0 + total + 2, y + 14);
    bar(ctx, x0 + bw + gap, y + 6, bw - 22, 16, navy.hp / navy.maxHp, '#4db5ff');
    ctx.textAlign = 'center'; ctx.fillStyle = '#cfe';
    ctx.fillText(`${pirate.hp}`, x0 + bw / 2 + 10, y + 14);
    ctx.fillText(`${navy.hp}`, x0 + bw + gap + (bw - 22) / 2, y + 14);
  }

  // own-ship panel bottom-left
  const mine = state.ships.find((s) => s.id === meId);
  if (mine) {
    const px = 16, ph = 84, py = H - ph - 16, pw = 300;
    panel(ctx, px, py, pw, ph, 12);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.font = '600 15px system-ui';
    ctx.fillText(mine.name || 'Denizci', px + 14, py + 20);
    if (mine.streak >= 3) { ctx.fillStyle = '#ffb347'; ctx.fillText(`🔥 ${mine.streak}`, px + pw - 70, py + 20); }
    bar(ctx, px + 14, py + 34, pw - 28, 16, mine.hp / mine.maxHp,
      mine.hp / mine.maxHp > 0.5 ? '#4caf50' : mine.hp / mine.maxHp > 0.25 ? '#ffb300' : '#e53935');
    ctx.fillStyle = '#bcd'; ctx.font = '12px system-ui';
    ctx.fillText(`HP ${mine.hp}/${mine.maxHp}`, px + 16, py + 42 + 1);
    // buff chips
    let bx = px + 14;
    const by = py + 60;
    ctx.font = '600 11px system-ui';
    for (const b of (mine.buffs || [])) {
      const tw = ctx.measureText(b).width + 16;
      ctx.fillStyle = 'rgba(77,181,255,0.25)';
      ctx.fillRect(bx, by, tw, 16);
      ctx.strokeStyle = 'rgba(77,181,255,0.6)'; ctx.strokeRect(bx, by, tw, 16);
      ctx.fillStyle = '#dff'; ctx.textAlign = 'left';
      ctx.fillText(b, bx + 8, by + 9);
      bx += tw + 6;
      if (bx > px + pw - 40) break;
    }
  }

  // minimap top-right
  const ms = 150, mx = W - ms - 16, my = 16;
  panel(ctx, mx - 6, my - 6, ms + 12, ms + 12, 10);
  ctx.save();
  ctx.beginPath(); ctx.rect(mx, my, ms, ms); ctx.clip();
  ctx.fillStyle = 'rgba(20,70,95,0.7)'; ctx.fillRect(mx, my, ms, ms);
  const sc = ms / WORLD;
  for (const i of islands) {
    ctx.beginPath();
    ctx.arc(mx + i.x * sc, my + i.y * sc, Math.max(2, i.r * sc), 0, 7);
    ctx.fillStyle = '#3d7a4f'; ctx.fill();
  }
  for (const b of state.bases) {
    ctx.fillStyle = b.faction === 'pirate' ? '#e63946' : '#4db5ff';
    ctx.fillRect(mx + b.x * sc - 4, my + b.y * sc - 4, 8, 8);
  }
  for (const s of state.ships) {
    if (!s.alive) continue;
    ctx.beginPath();
    ctx.arc(mx + s.x * sc, my + s.y * sc, s.id === meId ? 4 : 2.5, 0, 7);
    ctx.fillStyle = s.id === meId ? '#fff' : (s.faction === 'pirate' ? '#ff9d8a' : '#a9dcff');
    ctx.fill();
    if (s.id === meId) { ctx.strokeStyle = '#000'; ctx.stroke(); }
  }
  ctx.restore();
}
