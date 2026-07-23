// client/js/ships/draw.js
// Vector ship silhouettes. Size drives length/width; special classes get extras.
const SIZE = {
  sloop:[34,14], cutter:[34,14],
  brig:[42,17], corvette:[42,17],
  frigate:[50,20], frigate_n:[50,20],
  galleon:[70,28], shipofline:[74,30],
  fireship:[48,20], bombketch:[52,22],
};
const FACTION_HULL = { pirate:'#5b3b1e', navy:'#3a4b63' };

export function drawShip(ctx, ship, pos, scale) {
  const [L, W] = (SIZE[ship.cls] || [46,18]).map((n) => n * scale);
  ctx.save();
  ctx.translate(pos.sx, pos.sy);
  if (!ship.alive) ctx.globalAlpha = 0.25;

  // hull
  ctx.beginPath();
  ctx.moveTo(0, -W);
  ctx.quadraticCurveTo(L * 0.5, -W * 0.3, L * 0.6, 0);
  ctx.quadraticCurveTo(L * 0.5, W * 0.3, 0, W);
  ctx.quadraticCurveTo(-L * 0.5, W * 0.3, -L * 0.6, 0);
  ctx.quadraticCurveTo(-L * 0.5, -W * 0.3, 0, -W);
  ctx.closePath();
  ctx.fillStyle = FACTION_HULL[ship.faction] || '#555';
  ctx.fill();
  ctx.strokeStyle = '#00000055'; ctx.stroke();

  // sail
  ctx.fillStyle = '#e9e2cf';
  ctx.fillRect(-W * 0.4, -L * 0.28, W * 0.8, L * 0.5);

  // flag (player color)
  ctx.fillStyle = ship.flagColor || '#fff';
  ctx.fillRect(-3 * scale, -L * 0.5, 12 * scale, 8 * scale);

  // special extras
  if (ship.cls === 'fireship') { ctx.fillStyle = '#ff7b1a'; ctx.beginPath(); ctx.arc(0, 0, W * 0.35, 0, 7); ctx.fill(); }
  if (ship.cls === 'bombketch') { ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(0, -L*0.1, W*0.3, 0, 7); ctx.fill(); }

  ctx.restore();

  // HP bar + name
  const hpw = 40 * scale, frac = Math.max(0, ship.hp / ship.maxHp);
  ctx.fillStyle = '#000a'; ctx.fillRect(pos.sx - hpw/2, pos.sy - W - 14, hpw, 5);
  ctx.fillStyle = frac > 0.5 ? '#4caf50' : frac > 0.25 ? '#ffb300' : '#e53935';
  ctx.fillRect(pos.sx - hpw/2, pos.sy - W - 14, hpw * frac, 5);
  ctx.fillStyle = '#fff'; ctx.font = '11px system-ui'; ctx.textAlign = 'center';
  ctx.fillText(ship.name + (ship.streak >= 3 ? ` 🔥${ship.streak}` : ''), pos.sx, pos.sy - W - 18);
}
