// client/js/fx/effects.js
// Transient visual effects that aren't part of server state: cannonball /
// arrow rendering with trails, splash rings, animated fire, ship wakes,
// idle ripples and sinking bubbles. All positions are kept in WORLD space
// internally and re-projected through worldToScreen every frame so effects
// stay correct as the camera moves.
import { worldToScreen } from '../iso.js';
import { screenRadius, screenAngleForWorldDir, hashSeed } from './util.js';

export class EffectsFX {
  constructor() {
    this.trails = new Map();       // projectile id -> { pts:[{x,y}], kind }
    this.splashes = [];            // { x, y, start }
    this._prevProjIds = new Set();
  }

  // ---- projectiles (cannonballs + arrows) --------------------------------
  drawProjectiles(ctx, projectiles, cam, now) {
    const currentIds = new Set();
    for (const pr of projectiles) {
      currentIds.add(pr.id);
      let tr = this.trails.get(pr.id);
      if (!tr) { tr = { pts: [], kind: pr.kind }; this.trails.set(pr.id, tr); }
      tr.kind = pr.kind;
      tr.pts.push({ x: pr.x, y: pr.y });
      if (tr.pts.length > 6) tr.pts.shift();

      const p = worldToScreen(pr.x, pr.y, cam);
      let angle = 0;
      if (tr.pts.length >= 2) {
        const a = tr.pts[tr.pts.length - 2], b = tr.pts[tr.pts.length - 1];
        if (a.x !== b.x || a.y !== b.y) angle = screenAngleForWorldDir(a.x, a.y, b.x - a.x, b.y - a.y, cam);
      }

      if (pr.kind === 'arrow') this._drawArrow(ctx, p, angle);
      else this._drawCannonball(ctx, p, tr, cam);
    }

    // A cannonball that vanished between frames hit something or expired -
    // spawn a splash ring at its last known world position.
    for (const id of this._prevProjIds) {
      if (currentIds.has(id)) continue;
      const tr = this.trails.get(id);
      if (tr && tr.kind === 'cannon' && tr.pts.length) {
        const last = tr.pts[tr.pts.length - 1];
        this.splashes.push({ x: last.x, y: last.y, start: now });
      }
      this.trails.delete(id);
    }
    this._prevProjIds = currentIds;
  }

  _drawCannonball(ctx, p, tr, cam) {
    for (let i = 0; i < tr.pts.length - 1; i++) {
      const pt = tr.pts[i];
      const sp = worldToScreen(pt.x, pt.y, cam);
      const age = (i + 1) / tr.pts.length;
      ctx.beginPath();
      ctx.arc(sp.sx, sp.sy, 3.2 * age, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(170,170,170,${(0.22 * age).toFixed(3)})`;
      ctx.fill();
    }
    const r = 4.4;
    const g = ctx.createRadialGradient(p.sx - 1.4, p.sy - 1.4, 0.4, p.sx, p.sy, r);
    g.addColorStop(0, '#666');
    g.addColorStop(1, '#0a0a0a');
    ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
  }

  _drawArrow(ctx, p, angle) {
    ctx.save();
    ctx.translate(p.sx, p.sy);
    ctx.rotate(angle);
    ctx.strokeStyle = '#caa96b'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(8, 0); ctx.stroke();
    ctx.fillStyle = '#e8d8a0';
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-13, -3); ctx.lineTo(-13, 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(5, -2.2); ctx.lineTo(5, 2.2); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  drawSplashes(ctx, cam, now) {
    const DUR = 550;
    this.splashes = this.splashes.filter((s) => now - s.start < DUR);
    for (const s of this.splashes) {
      const p = worldToScreen(s.x, s.y, cam);
      const t = (now - s.start) / DUR;
      const r = 4 + t * 22;
      ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${((1 - t) * 0.8).toFixed(3)})`;
      ctx.lineWidth = 2.4 * (1 - t) + 0.4;
      ctx.stroke();
    }
  }

  // ---- fire areas: flickering flame tongues + rising smoke + glow -------
  drawFires(ctx, fires, cam, now) {
    const t = now * 0.001;
    for (const f of fires) {
      const p = worldToScreen(f.x, f.y, cam);
      const rr = screenRadius(f.x, f.y, f.radius, cam);
      const seed = hashSeed(String(f.id ?? `${f.x},${f.y}`)) * 10;

      const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, rr * 1.25);
      g.addColorStop(0, 'rgba(255,140,20,0.32)');
      g.addColorStop(1, 'rgba(255,90,0,0)');
      ctx.beginPath(); ctx.arc(p.sx, p.sy, rr * 1.25, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();

      const tongues = 6;
      for (let i = 0; i < tongues; i++) {
        const ang = (i / tongues) * Math.PI * 2 + seed;
        const flick = 0.55 + 0.45 * Math.sin(t * (4 + i * 0.6) + seed * 7 + i);
        const dist = rr * (0.15 + 0.55 * ((i % 3) / 3));
        const fx = p.sx + Math.cos(ang) * dist;
        const fy = p.sy + Math.sin(ang) * dist * 0.5;
        const h = (9 + 7 * flick) * Math.max(0.5, rr / 45);
        ctx.beginPath();
        ctx.moveTo(fx - 4, fy);
        ctx.quadraticCurveTo(fx - 3, fy - h * 0.6, fx, fy - h);
        ctx.quadraticCurveTo(fx + 3, fy - h * 0.6, fx + 4, fy);
        ctx.closePath();
        const fg = ctx.createLinearGradient(fx, fy, fx, fy - h);
        fg.addColorStop(0, 'rgba(255,70,0,0.85)');
        fg.addColorStop(0.55, 'rgba(255,165,20,0.75)');
        fg.addColorStop(1, 'rgba(255,230,120,0.12)');
        ctx.fillStyle = fg;
        ctx.fill();
      }

      for (let i = 0; i < 4; i++) {
        const st = ((t * 0.5 + i * 0.37 + seed) % 1);
        const sx = p.sx + Math.sin(seed * 20 + i) * rr * 0.3;
        const sy = p.sy - st * 46;
        ctx.beginPath();
        ctx.arc(sx, sy, 5 + st * 10, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(90,90,90,${(0.2 * (1 - st)).toFixed(3)})`;
        ctx.fill();
      }
    }
  }

  // ---- per-ship wake / idle ripple / sinking bubbles --------------------
  // `fx` is the Renderer-owned per-ship cache entry ({heading,bobPhase,...}).
  drawWake(ctx, fx, cam, now) {
    if (!fx.wake) return;
    for (let i = fx.wake.length - 1; i >= 0; i--) {
      const w = fx.wake[i];
      const age = now - w.born;
      if (age > 1400) { fx.wake.splice(i, 1); continue; }
      const p = worldToScreen(w.x, w.y, cam);
      const t = age / 1400;
      const r = 2 + t * 8;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${((1 - t) * 0.32).toFixed(3)})`;
      ctx.fill();
    }
  }

  drawIdleRipple(ctx, fx, cam, now) {
    const period = 2400;
    const phaseMs = (fx.bobPhase / (Math.PI * 2)) * period;
    const age = (now + phaseMs) % period;
    const t = age / period;
    const p = worldToScreen(fx.lastX, fx.lastY, cam);
    const r = 6 + t * 18;
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${((1 - t) * 0.22).toFixed(3)})`;
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }

  drawBubbles(ctx, fx, cam, now) {
    if (!fx.bubbles) fx.bubbles = [];
    if (now - (fx.lastBubble || 0) > 320) {
      fx.lastBubble = now;
      fx.bubbles.push({ dx: (Math.random() - 0.5) * 16, born: now, life: 850 + Math.random() * 400 });
    }
    for (let i = fx.bubbles.length - 1; i >= 0; i--) {
      const b = fx.bubbles[i];
      const age = now - b.born;
      if (age > b.life) { fx.bubbles.splice(i, 1); continue; }
      const t = age / b.life;
      const p = worldToScreen(fx.lastX, fx.lastY, cam);
      const sx = p.sx + b.dx, sy = p.sy - t * 22;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.6 + t * 2.4, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${((1 - t) * 0.5).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}
