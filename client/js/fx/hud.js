// client/js/fx/hud.js
// Polished HUD: top-center base HP bars, bottom-left own-ship panel,
// top-right minimap, and a subtle vignette. Semi-transparent rounded panels.
function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawBar(ctx, x, y, w, h, frac, color) {
  frac = Math.max(0, Math.min(1, frac));
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundedRect(ctx, x, y, w, h, h / 2); ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = color;
    roundedRect(ctx, x, y, Math.max(h, w * frac), h, h / 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
  roundedRect(ctx, x, y, w, h, h / 2); ctx.stroke();
}

export function drawVignette(ctx, w, h) {
  ctx.save();
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function drawTopBars(ctx, w, pirateBase, navyBase) {
  const panelW = 340, panelH = 46, x = w / 2 - panelW / 2, y = 10;
  ctx.save();
  roundedRect(ctx, x, y, panelW, panelH, 10);
  ctx.fillStyle = 'rgba(8,18,26,0.55)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();

  const barW = panelW / 2 - 20;
  drawBar(ctx, x + 10, y + 26, barW, 10, pirateBase.hp / pirateBase.maxHp, '#e63946');
  drawBar(ctx, x + panelW / 2 + 10, y + 26, barW, 10, navyBase.hp / navyBase.maxHp, '#4db5ff');

  ctx.font = '13px system-ui';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.fillText(`🏴‍☠️ ${Math.round(pirateBase.hp)}/${pirateBase.maxHp}`, x + 10, y + 18);
  ctx.textAlign = 'right';
  ctx.fillText(`⚓ ${Math.round(navyBase.hp)}/${navyBase.maxHp}`, x + panelW - 10, y + 18);
  ctx.restore();
}

export function drawOwnPanel(ctx, canvasH, ship) {
  if (!ship) return;
  const x = 14, panelW = 240, panelH = 82, y = canvasH - panelH - 14;
  ctx.save();
  roundedRect(ctx, x, y, panelW, panelH, 10);
  ctx.fillStyle = 'rgba(8,18,26,0.55)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();

  ctx.fillStyle = '#fff'; ctx.font = '12px system-ui'; ctx.textAlign = 'left';
  ctx.fillText(ship.name, x + 12, y + 17);

  const frac = ship.hp / ship.maxHp;
  const hpColor = frac > 0.5 ? '#4caf50' : frac > 0.25 ? '#ffb300' : '#e53935';
  drawBar(ctx, x + 12, y + 24, panelW - 24, 10, frac, hpColor);
  ctx.fillText(`HP ${ship.hp}/${ship.maxHp}`, x + 12, y + 50);
  ctx.textAlign = 'right';
  ctx.fillText(`🔥 ${ship.streak}`, x + panelW - 12, y + 50);
  ctx.textAlign = 'left';

  let cx = x + 12;
  const cy = y + 60;
  ctx.font = '10px system-ui';
  if (!ship.buffs || ship.buffs.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('-', cx, cy + 11);
  } else {
    for (const b of ship.buffs) {
      const tw = ctx.measureText(b).width + 12;
      if (cx + tw > x + panelW - 10) break;
      roundedRect(ctx, cx, cy, tw, 15, 7);
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill();
      ctx.fillStyle = '#ffd76b';
      ctx.fillText(b, cx + 6, cy + 11);
      cx += tw + 5;
    }
  }
  ctx.restore();
}

export function drawMinimap(ctx, canvasW, islands, bases, ships, meId) {
  const size = 150, x = canvasW - size - 14, y = 14, WORLD = 4000;
  ctx.save();
  roundedRect(ctx, x, y, size, size, 8);
  ctx.fillStyle = 'rgba(8,18,26,0.6)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.stroke();

  ctx.save();
  roundedRect(ctx, x, y, size, size, 8);
  ctx.clip();

  const toMap = (wx, wy) => ({ mx: x + (wx / WORLD) * size, my: y + (wy / WORLD) * size });

  for (const isl of islands) {
    const p = toMap(isl.x, isl.y);
    const r = Math.max(2, (isl.r / WORLD) * size);
    ctx.beginPath(); ctx.arc(p.mx, p.my, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(80,160,90,0.75)'; ctx.fill();
  }
  for (const b of bases) {
    const p = toMap(b.x, b.y);
    ctx.beginPath(); ctx.arc(p.mx, p.my, 4, 0, Math.PI * 2);
    ctx.fillStyle = b.faction === 'pirate' ? '#e63946' : '#4db5ff';
    ctx.fill();
  }
  for (const s of ships) {
    if (!s.alive) continue;
    const p = toMap(s.x, s.y);
    const isMe = s.id === meId;
    ctx.beginPath(); ctx.arc(p.mx, p.my, isMe ? 3.6 : 2.2, 0, Math.PI * 2);
    ctx.fillStyle = s.faction === 'pirate' ? '#ff8c69' : '#a7d8ff';
    ctx.fill();
    if (isMe) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.stroke(); }
  }
  ctx.restore();
  ctx.restore();
}
