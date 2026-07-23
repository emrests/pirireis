// client/js/ships/draw.js
// Layered vector ship art: plank-shaded hull with highlighted gunwale,
// masts + rigging + billowing sails, cannon ports on larger hulls, a waving
// masthead flag in the player's flagColor, faction identity (weathered dark
// wood / tattered sails for pirates; clean blue-grey / crisp white + gold
// trim for navy), class-specific extras, and a sinking animation for dead
// ships. Called by render.js as drawShip(ctx, ship, pos, scale, fx, time),
// where `fx` = { heading, bob, roll, moving, sinkT } is computed per-frame
// by the Renderer (heading/bob state cache lives there, not here).

const SIZE = {
  sloop: [34, 14], cutter: [34, 14],
  brig: [42, 17], corvette: [42, 17],
  frigate: [50, 20], frigate_n: [50, 20],
  galleon: [70, 28], shipofline: [74, 30],
  fireship: [48, 20], bombketch: [52, 22],
};

const MASTS = {
  sloop: 1, cutter: 1,
  brig: 2, corvette: 2,
  frigate: 2, frigate_n: 2,
  galleon: 3, shipofline: 3,
  fireship: 1, bombketch: 1,
};

const GUNPORT_CLASSES = new Set(['frigate', 'frigate_n', 'galleon', 'shipofline', 'bombketch']);

const FACTION_STYLE = {
  pirate: {
    hullA: '#3d2812', hullB: '#6b4726', deck: '#7a5a34',
    trim: '#8a1f28', sail: '#e6ddc2', sailShade: '#a89d7c', gunport: '#161311',
  },
  navy: {
    hullA: '#28374a', hullB: '#4c6480', deck: '#5a7085',
    trim: '#caa63e', sail: '#f6f8fb', sailShade: '#c7d2dc', gunport: '#0f151c',
  },
};

export function drawShip(ctx, ship, pos, scale, fx = {}, time = 0) {
  const [Lraw, Wraw] = SIZE[ship.cls] || [46, 18];
  const L = Lraw * scale, W = Wraw * scale;
  const style = FACTION_STYLE[ship.faction] || FACTION_STYLE.pirate;
  const heading = fx.heading || 0;
  const bob = fx.bob || 0;
  const roll = fx.roll || 0;
  const sinkT = fx.sinkT || 0;
  const alive = ship.alive !== false;

  ctx.save();
  ctx.translate(pos.sx, pos.sy);

  // shadow ellipse, anchored to the water surface (not lifted by bob)
  ctx.save();
  ctx.rotate(heading);
  ctx.beginPath();
  ctx.ellipse(0, 0, L * 0.62, W * 0.55, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(0,0,0,${(0.22 * (1 - sinkT * 0.7)).toFixed(3)})`;
  ctx.fill();
  ctx.restore();

  const submerge = sinkT * W * 1.0;
  const extraTilt = sinkT * 0.55;
  const fadeAlpha = alive ? 1 : Math.max(0, 1 - sinkT * 1.15);

  ctx.translate(0, bob + submerge);
  ctx.rotate(heading + roll + extraTilt);
  ctx.globalAlpha = fadeAlpha;

  drawHull(ctx, L, W, style, ship.cls);
  if (sinkT < 0.7) drawMasts(ctx, L, W, style, ship, time, fx.moving);
  if (sinkT < 0.5) drawClassExtras(ctx, L, W, ship, time);

  ctx.globalAlpha = 1;
  ctx.restore();

  drawLabel(ctx, ship, pos, W);
}

function drawHull(ctx, L, W, style, cls) {
  ctx.beginPath();
  ctx.moveTo(-L * 0.6, 0);
  ctx.quadraticCurveTo(-L * 0.5, -W * 0.55, 0, -W * 0.62);
  ctx.quadraticCurveTo(L * 0.4, -W * 0.5, L * 0.62, -W * 0.05);
  ctx.quadraticCurveTo(L * 0.68, 0, L * 0.62, W * 0.05);
  ctx.quadraticCurveTo(L * 0.4, W * 0.5, 0, W * 0.62);
  ctx.quadraticCurveTo(-L * 0.5, W * 0.55, -L * 0.6, 0);
  ctx.closePath();

  const g = ctx.createLinearGradient(0, -W * 0.62, 0, W * 0.62);
  g.addColorStop(0, style.hullB);
  g.addColorStop(0.5, style.hullA);
  g.addColorStop(1, style.hullB);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1, L * 0.02);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.stroke();

  // gunwale highlight along the top rim
  ctx.beginPath();
  ctx.moveTo(-L * 0.52, -W * 0.18);
  ctx.quadraticCurveTo(-L * 0.4, -W * 0.5, 0, -W * 0.58);
  ctx.quadraticCurveTo(L * 0.35, -W * 0.46, L * 0.58, -W * 0.06);
  ctx.strokeStyle = 'rgba(255,235,190,0.5)';
  ctx.lineWidth = Math.max(1, L * 0.015);
  ctx.stroke();

  // plank lines
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(-L * 0.45, i * W * 0.14);
    ctx.lineTo(L * 0.45, i * W * 0.14);
    ctx.stroke();
  }

  // cannon ports on bigger hulls
  if (GUNPORT_CLASSES.has(cls)) {
    const n = (cls === 'galleon' || cls === 'shipofline') ? 4 : 3;
    ctx.fillStyle = style.gunport;
    for (let i = 0; i < n; i++) {
      const px = -L * 0.32 + (i / Math.max(1, n - 1)) * L * 0.55;
      const pr = Math.max(1.4, W * 0.07);
      ctx.beginPath(); ctx.arc(px, -W * 0.32, pr, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px, W * 0.32, pr, 0, Math.PI * 2); ctx.fill();
    }
  }

  // faction trim stripe along the gunwale
  ctx.beginPath();
  ctx.moveTo(-L * 0.5, -W * 0.02);
  ctx.lineTo(L * 0.55, -W * 0.02);
  ctx.strokeStyle = style.trim;
  ctx.lineWidth = Math.max(1, W * 0.09);
  ctx.globalAlpha = 0.85;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawMasts(ctx, L, W, style, ship, time, moving) {
  const count = MASTS[ship.cls] || 1;
  const xs = count === 1 ? [0] : count === 2 ? [-L * 0.16, L * 0.2] : [-L * 0.28, 0, L * 0.28];
  const t = time * 0.001;

  xs.forEach((mx, idx) => {
    const isMain = idx === Math.floor((xs.length - 1) / 2);
    const mastH = W * 1.9 * (isMain ? 1.12 : 0.86);

    ctx.strokeStyle = 'rgba(35,24,14,0.9)';
    ctx.lineWidth = Math.max(1.2, L * 0.02);
    ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, -mastH); ctx.stroke();

    const billow = (moving ? 11 : 5) + Math.sin(t * 1.6 + idx * 1.7) * (moving ? 4 : 1.6);
    const sailW = L * 0.22, sailH = mastH * 0.62, sailY = -mastH * 0.94;
    ctx.beginPath();
    ctx.moveTo(mx - sailW * 0.05, sailY);
    ctx.quadraticCurveTo(mx + sailW * 0.5 + billow * 0.3, sailY + sailH * 0.32, mx + sailW * 0.4, sailY + sailH);
    ctx.lineTo(mx - sailW * 0.4, sailY + sailH);
    ctx.quadraticCurveTo(mx - sailW * 0.5 + billow * 0.15, sailY + sailH * 0.32, mx - sailW * 0.05, sailY);
    ctx.closePath();
    const sg = ctx.createLinearGradient(mx - sailW * 0.5, sailY, mx + sailW * 0.5, sailY + sailH);
    sg.addColorStop(0, style.sail);
    sg.addColorStop(1, style.sailShade);
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.stroke();

    // rigging
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(mx, -mastH); ctx.lineTo(mx - sailW * 0.55, 0);
    ctx.moveTo(mx, -mastH); ctx.lineTo(mx + sailW * 0.55, 0);
    ctx.stroke();
  });

  // masthead flag (player color) on the main mast
  const midx = xs[Math.floor((xs.length - 1) / 2)];
  const mainH = W * 1.9 * 1.12;
  const topY = -mainH;
  const flagT = t * 4;
  ctx.strokeStyle = 'rgba(35,24,14,0.9)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(midx, topY); ctx.lineTo(midx, topY - 8); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(midx, topY - 8);
  for (let i = 0; i <= 4; i++) {
    const fx = midx + (i / 4) * 11;
    const fy = topY - 8 + Math.sin(flagT + i * 1.1) * 2.2 - (i / 4) * 1;
    ctx.lineTo(fx, fy);
  }
  ctx.lineTo(midx, topY - 2);
  ctx.closePath();
  ctx.fillStyle = ship.flagColor || '#fff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.6; ctx.stroke();
}

function drawClassExtras(ctx, L, W, ship, time) {
  const t = time * 0.001;
  if (ship.cls === 'fireship') {
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(-W * 0.18, -W * 0.1, W * 0.36, W * 0.22);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
    ctx.strokeRect(-W * 0.18, -W * 0.1, W * 0.36, W * 0.22);
    for (let i = 0; i < 3; i++) {
      const flick = 0.55 + 0.45 * Math.sin(t * 8 + i * 2.1);
      const h = (10 + 7 * flick) * (L / 48);
      const bx = -6 + i * 6;
      ctx.beginPath();
      ctx.moveTo(bx - 4, -W * 0.1);
      ctx.quadraticCurveTo(bx, -W * 0.1 - h * 0.6, bx + 1, -W * 0.1 - h);
      ctx.quadraticCurveTo(bx + 3, -W * 0.1 - h * 0.6, bx + 5, -W * 0.1);
      ctx.closePath();
      const g = ctx.createLinearGradient(bx, -W * 0.1, bx, -W * 0.1 - h);
      g.addColorStop(0, 'rgba(255,90,0,0.9)');
      g.addColorStop(1, 'rgba(255,220,80,0.15)');
      ctx.fillStyle = g;
      ctx.fill();
    }
  }
  if (ship.cls === 'bombketch') {
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath(); ctx.arc(0, -W * 0.02, W * 0.34, Math.PI, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.fillRect(-W * 0.1, -W * 0.02, W * 0.2, W * 0.18);
  }
}

function drawLabel(ctx, ship, pos, W) {
  if (ship.alive === false) return; // sinking ships read from the sink animation alone
  const barW = 40;
  const frac = Math.max(0, ship.hp / ship.maxHp);
  const y = pos.sy - W - 14;
  ctx.fillStyle = '#000a'; ctx.fillRect(pos.sx - barW / 2, y, barW, 5);
  ctx.fillStyle = frac > 0.5 ? '#4caf50' : frac > 0.25 ? '#ffb300' : '#e53935';
  ctx.fillRect(pos.sx - barW / 2, y, barW * frac, 5);
  ctx.fillStyle = '#fff'; ctx.font = '11px system-ui'; ctx.textAlign = 'center';
  ctx.fillText(ship.name + (ship.streak >= 3 ? ` 🔥${ship.streak}` : ''), pos.sx, y - 4);
}
