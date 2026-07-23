// client/js/render.js
import { worldToScreen } from './iso.js';
import { drawShip } from './ships/draw.js';
import { WaterFX } from './fx/water.js';
import { drawIslands } from './fx/islands.js';
import { drawBase } from './fx/bases.js';
import { EffectsFX } from './fx/effects.js';
import { drawVignette, drawTopBars, drawOwnPanel, drawMinimap } from './fx/hud.js';
import { screenAngleForWorldDir, lerpAngle } from './fx/util.js';

// Island list mirrors server/game/map.js (kept in sync manually).
export const ISLANDS = [
  { x:2000,y:2000,r:300 }, { x:1350,y:1150,r:210 }, { x:2650,y:1150,r:210 },
  { x:1350,y:2850,r:210 }, { x:2650,y:2850,r:210 },
];

const MOVE_EPS = 0.35;      // world units/frame below which we don't retarget heading
const MOVING_SPEED = 14;    // world units/sec above which a ship counts as "moving"
const WAKE_INTERVAL = 90;   // ms between wake puffs while moving
const SINK_DURATION = 2600; // ms for a dead ship to fully sink/fade

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.water = new WaterFX();
    this.fx = new EffectsFX();
    this.shipFx = new Map(); // id -> {heading, bobPhase, rollPhase, lastX, lastY, lastT, speed, wake, deadSince, bubbles, moving}
    this.resize();
  }

  resize() { this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; }

  draw(state, cam, meId) {
    const ctx = this.ctx;
    const canvas = this.canvas;
    cam.cx = canvas.width / 2; cam.cy = canvas.height / 2;
    const now = performance.now();

    this.water.draw(ctx, canvas.width, canvas.height, cam, now, ISLANDS, state.bases);
    drawIslands(ctx, ISLANDS, cam, now);
    for (const b of state.bases) drawBase(ctx, b, cam, now);
    this.fx.drawFires(ctx, state.fires, cam, now);

    const liveIds = new Set(state.ships.map((s) => s.id));
    for (const id of [...this.shipFx.keys()]) if (!liveIds.has(id)) this.shipFx.delete(id);

    const ships = [...state.ships].sort((a, b) => a.y - b.y);
    for (const s of ships) {
      const fx = this._updateShipFx(s, now, cam);
      if (s.alive) {
        if (fx.moving) this.fx.drawWake(ctx, fx, cam, now);
        else this.fx.drawIdleRipple(ctx, fx, cam, now);
      }

      const bobFreq = fx.moving ? 2.6 : 1.4;
      const bobAmp = (fx.moving ? 3.2 : 1.6) * cam.scale;
      const bob = Math.sin(now * 0.001 * bobFreq + fx.bobPhase) * bobAmp - (fx.moving ? 1.4 * cam.scale : 0);
      const rollFreq = fx.moving ? 2.1 : 1.1;
      const rollAmp = fx.moving ? 0.055 : 0.022;
      const roll = Math.sin(now * 0.001 * rollFreq + fx.rollPhase) * rollAmp;
      const sinkT = fx.deadSince != null ? Math.min(1, (now - fx.deadSince) / SINK_DURATION) : 0;

      const pos = worldToScreen(s.x, s.y, cam);
      drawShip(ctx, s, pos, cam.scale, { heading: fx.heading, bob, roll, moving: fx.moving, sinkT }, now);

      if (!s.alive && sinkT < 1) this.fx.drawBubbles(ctx, fx, cam, now);
    }

    this.fx.drawProjectiles(ctx, state.projectiles, cam, now);
    this.fx.drawSplashes(ctx, cam, now);

    this._hud(state, meId);
    drawVignette(ctx, canvas.width, canvas.height);
  }

  // Derives smoothed screen-space heading, bob/roll phase, wake trail and
  // sink timing for one ship from frame-to-frame movement. Cached per ship
  // id so each vessel bobs/turns independently and dead ships remember when
  // they sank.
  _updateShipFx(ship, now, cam) {
    let fx = this.shipFx.get(ship.id);
    if (!fx) {
      fx = {
        heading: ship.faction === 'pirate' ? 0 : Math.PI,
        bobPhase: Math.random() * Math.PI * 2,
        rollPhase: Math.random() * Math.PI * 2,
        lastX: ship.x, lastY: ship.y, lastT: now,
        speed: 0, moving: false,
        wake: [], lastWake: 0,
        deadSince: null, bubbles: [], lastBubble: 0,
      };
      this.shipFx.set(ship.id, fx);
    }

    const dtSec = Math.max(1, now - fx.lastT) / 1000;
    const dx = ship.x - fx.lastX, dy = ship.y - fx.lastY;
    const dist = Math.hypot(dx, dy);
    const instSpeed = dist / dtSec;
    fx.speed = fx.speed * 0.8 + instSpeed * 0.2;
    fx.moving = fx.speed > MOVING_SPEED;

    if (dist > MOVE_EPS) {
      const target = screenAngleForWorldDir(fx.lastX, fx.lastY, dx, dy, cam);
      fx.heading = lerpAngle(fx.heading, target, 0.18);
    }

    if (ship.alive) {
      fx.deadSince = null;
      if (fx.moving && now - fx.lastWake > WAKE_INTERVAL) {
        fx.lastWake = now;
        const ux = dist > 0.01 ? dx / dist : Math.cos(fx.heading);
        const uy = dist > 0.01 ? dy / dist : Math.sin(fx.heading);
        fx.wake.push({ x: ship.x - ux * 16, y: ship.y - uy * 16, born: now });
        if (fx.wake.length > 40) fx.wake.shift();
      }
    } else if (fx.deadSince == null) {
      fx.deadSince = now;
    }

    fx.lastX = ship.x; fx.lastY = ship.y; fx.lastT = now;
    return fx;
  }

  _hud(state, meId) {
    const ctx = this.ctx;
    const pirate = state.bases.find((b) => b.faction === 'pirate');
    const navy = state.bases.find((b) => b.faction === 'navy');
    if (pirate && navy) drawTopBars(ctx, this.canvas.width, pirate, navy);
    const mine = state.ships.find((s) => s.id === meId);
    drawOwnPanel(ctx, this.canvas.height, mine);
    drawMinimap(ctx, this.canvas.width, ISLANDS, state.bases, state.ships, meId);
  }
}
