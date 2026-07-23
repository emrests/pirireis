import { World } from './game/world.js';
import { TICK_MS, MSG } from '../shared/constants.js';

export class Room {
  constructor(id, broadcast) {
    this.id = id;
    this.world = new World(id);
    this.broadcast = broadcast;
    this.timer = null;
    this.now = 0;
  }

  join(cfg) { return this.world.addShip(cfg); }
  leave(id) { this.world.removeShip(id); }
  handle(id, msg) { this.world.input(id, msg); }
  playerCount() { return this.world.ships.size; }

  tickOnce(now) {
    this.now = now;
    const events = this.world.step(TICK_MS, now);
    this.broadcast({ type: MSG.SNAPSHOT, t: now, ...this.world.serialize() });
    if (events.length) this.broadcast({ type: MSG.EVENT, events });
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => { this.now += TICK_MS; this.tickOnce(this.now); }, TICK_MS);
  }
  stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
}
