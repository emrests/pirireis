// client/js/fx/water.js
// A living sea: deep->light depth gradient, scrolling sine-wave sun-glint
// bands, subtle caustic shimmer, and a lighter/foamy glow near islands and
// bases. All time-driven state comes from the `time` (performance.now())
// argument passed in by the Renderer - nothing here reads the clock itself.
import { worldToScreen } from '../iso.js';
import { screenRadius } from './util.js';

export class WaterFX {
  constructor() {
    this._grad = null; this._gradKey = '';
    this._caustics = null; this._causticKey = '';
  }

  _deepGradient(ctx, w, h) {
    const key = w + 'x' + h;
    if (this._gradKey !== key) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#0a2d40');
      g.addColorStop(0.45, '#0f4760');
      g.addColorStop(1, '#1a6480');
      this._grad = g;
      this._gradKey = key;
    }
    return this._grad;
  }

  _causticGrid(w, h) {
    const key = w + 'x' + h;
    if (this._causticKey !== key) {
      const pts = [];
      const spacing = 96;
      const cols = Math.ceil(w / spacing) + 2, rows = Math.ceil(h / spacing) + 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          pts.push({
            x: c * spacing + (r % 2 ? spacing / 2 : 0),
            y: r * spacing,
            seed: ((r * 31 + c * 17) % 628) / 100,
            speed: 0.5 + ((r + c) % 5) * 0.08,
            size: 8 + ((r * 7 + c * 3) % 10),
          });
        }
      }
      this._caustics = pts;
      this._causticKey = key;
    }
    return this._caustics;
  }

  draw(ctx, w, h, cam, time, islands, bases) {
    ctx.fillStyle = this._deepGradient(ctx, w, h);
    ctx.fillRect(0, 0, w, h);

    const t = time * 0.001;

    // Scrolling sun-glint bands.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const bands = 5;
    const wrapH = h + 160;
    for (let b = 0; b < bands; b++) {
      const yBase = ((h / bands) * b + t * 22 + b * 71) % wrapH - 80;
      const amp = 8 + b * 2.4;
      const freq = 0.010 + b * 0.0016;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 20) {
        const y = yBase + Math.sin(x * freq + t * 1.1 + b * 1.7) * amp;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(185,228,238,${(0.05 + 0.015 * (bands - b)).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();

    // Caustic shimmer.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this._causticGrid(w, h)) {
      const a = 0.02 + 0.05 * (0.5 + 0.5 * Math.sin(t * p.speed + p.seed));
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size, p.size * 0.42, 0.35, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(215,242,250,${a.toFixed(3)})`;
      ctx.fill();
    }
    ctx.restore();

    // Foamy lighter water near shores and harbor bases.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = (cx, cy, r, color) => {
      const p = worldToScreen(cx, cy, cam);
      const rr = screenRadius(cx, cy, r, cam);
      const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, rr);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.sx, p.sy, rr, 0, Math.PI * 2); ctx.fill();
    };
    for (const i of islands) glow(i.x, i.y, i.r * 1.5, 'rgba(210,238,228,0.12)');
    for (const b of bases) glow(b.x, b.y, 520, 'rgba(210,232,255,0.07)');
    ctx.restore();
  }
}
