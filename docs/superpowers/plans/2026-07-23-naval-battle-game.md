# Naval Battle Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a LAN-playable, browser-based, real-time isometric naval battle game with two factions, distance-based cannon damage, streak-buff skills, and per-team bases.

**Architecture:** Authoritative Node.js server (`ws`) runs a 20 tick/s simulation per room and broadcasts full JSON snapshots. A vanilla HTML5 Canvas client sends input, interpolates snapshots, and renders vector ships in a full isometric (2:1) projection. All game math lives in pure, unit-tested modules; the server and client wire them together.

**Tech Stack:** Node.js (>=18, built-in `node:test`), `ws` for WebSockets, vanilla ES modules on the client (no build step, no framework).

## Global Constraints

- Node.js >= 18 (uses built-in `node:test`, `node --test`).
- Only one runtime dependency: `ws`. No client-side build step or framework.
- All ES modules (`"type": "module"` in package.json). Use `.js` extension in imports.
- ALL tunable numbers (HP, speed, damage, cooldowns, durations, ranges) live in `server/game/balance.js`. No magic numbers elsewhere.
- Protocol message-type strings and enums live in `shared/constants.js`, imported by both server and client.
- Server is authoritative: clients never compute damage/deaths; they send intent and render snapshots.
- Tick rate: 20/s (TICK_MS = 50). World size: 4000x4000 units.
- Vector art only — ships/world drawn by code in Canvas. No external image/audio assets.
- Two factions: `pirate`, `navy`. Two teams map 1:1 to factions.

---

## File Structure

```
ship/
  package.json
  server/
    server.js          # HTTP static serve + WS upgrade + room router
    room.js            # 1 match: player set, tick loop, snapshot broadcast
    game/
      balance.js       # ALL constants + ship stat tables
      vec.js           # 2D vector helpers (pure)
      map.js           # island geometry, base positions, collision helpers
      ship.js          # Ship entity: movement, HP, state
      weapons.js       # projectile creation + distance-damage + fire areas
      skills.js        # streak tracking + timed buff application
      base.js          # base HP, healing zone, respawn, donation, turrets
      world.js         # World: holds ships/projectiles/fires/bases, step()
  shared/
    constants.js       # message types, enums, ship class ids
  client/
    index.html
    css/style.css
    js/
      net.js           # WS connection + message dispatch
      iso.js           # world<->screen isometric transforms
      input.js         # mouse/keyboard -> intent messages
      interpolate.js   # snapshot buffer + interpolation
      render.js        # draw loop: world, ships, projectiles, fires, HUD
      lobby.js         # room list + join form
      game.js          # client entry: ties net+input+render+lobby
      ships/draw.js    # per-ship-class vector draw functions
  tests/
    (mirrors server/game/*)
```

---

## Phase 1 — Foundations (pure, fully testable)

### Task 1: Project scaffold + shared constants

**Files:**
- Create: `package.json`
- Create: `shared/constants.js`
- Test: `tests/constants.test.js`

**Interfaces:**
- Produces: `MSG` (object of client/server message type strings), `FACTION` (`{PIRATE:'pirate', NAVY:'navy'}`), `WEAPON` (`{CANNON:'cannon', ARCHER:'archer', MOLOTOV:'molotov'}`), `SHIP_CLASSES` (`{pirate:[...5 ids], navy:[...5 ids]}`), `TICK_MS = 50`, `WORLD = {w:4000, h:4000}`.

- [ ] **Step 1: Write the failing test**

```js
// tests/constants.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MSG, FACTION, WEAPON, SHIP_CLASSES, TICK_MS, WORLD } from '../shared/constants.js';

test('constants expose protocol + enums', () => {
  assert.equal(MSG.JOIN, 'join');
  assert.equal(MSG.SNAPSHOT, 'snapshot');
  assert.equal(FACTION.PIRATE, 'pirate');
  assert.equal(WEAPON.MOLOTOV, 'molotov');
  assert.equal(SHIP_CLASSES.pirate.length, 5);
  assert.equal(SHIP_CLASSES.navy.length, 5);
  assert.equal(TICK_MS, 50);
  assert.deepEqual(WORLD, { w: 4000, h: 4000 });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `node --test tests/constants.test.js`
Expected: FAIL — cannot find module `../shared/constants.js`.

- [ ] **Step 3: Create package.json**

```json
{
  "name": "naval-battle",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "start": "node server/server.js",
    "test": "node --test"
  },
  "dependencies": {
    "ws": "^8.18.0"
  }
}
```

- [ ] **Step 4: Create shared/constants.js**

```js
// shared/constants.js
export const TICK_MS = 50;
export const WORLD = { w: 4000, h: 4000 };

export const FACTION = { PIRATE: 'pirate', NAVY: 'navy' };
export const WEAPON = { CANNON: 'cannon', ARCHER: 'archer', MOLOTOV: 'molotov' };

// client -> server and server -> client message type strings
export const MSG = {
  // client -> server
  LIST_ROOMS: 'listRooms',
  JOIN: 'join',
  MOVE: 'move',
  FIRE: 'fire',
  USE_SKILL: 'useSkill',
  DONATE: 'donate',
  // server -> client
  ROOMS: 'rooms',
  JOINED: 'joined',
  SNAPSHOT: 'snapshot',
  EVENT: 'event',
  ERROR: 'error',
};

export const SHIP_CLASSES = {
  pirate: ['sloop', 'brig', 'frigate', 'galleon', 'fireship'],
  navy: ['cutter', 'corvette', 'frigate_n', 'shipofline', 'bombketch'],
};
```

- [ ] **Step 5: Run test, verify it passes, then install deps**

Run: `node --test tests/constants.test.js`
Expected: PASS.
Run: `npm install`
Expected: `ws` installed, `node_modules/` created.

- [ ] **Step 6: Add .gitignore and commit**

Create `.gitignore`:
```
node_modules/
```

```bash
git add package.json package-lock.json .gitignore shared/constants.js tests/constants.test.js
git commit -m "feat: project scaffold + shared protocol constants"
```

---

### Task 2: Vector math helpers

**Files:**
- Create: `server/game/vec.js`
- Test: `tests/vec.test.js`

**Interfaces:**
- Produces: `add(a,b)`, `sub(a,b)`, `scale(a,s)`, `len(a)`, `dist(a,b)`, `norm(a)`, `clamp(x,lo,hi)`, `lerp(a,b,t)`. Vectors are `{x,y}` plain objects. All pure, no mutation.

- [ ] **Step 1: Write the failing test**

```js
// tests/vec.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { add, sub, scale, len, dist, norm, clamp, lerp } from '../server/game/vec.js';

test('vec basics', () => {
  assert.deepEqual(add({x:1,y:2}, {x:3,y:4}), {x:4,y:6});
  assert.deepEqual(sub({x:3,y:4}, {x:1,y:1}), {x:2,y:3});
  assert.deepEqual(scale({x:2,y:3}, 2), {x:4,y:6});
  assert.equal(len({x:3,y:4}), 5);
  assert.equal(dist({x:0,y:0}, {x:3,y:4}), 5);
  const n = norm({x:3,y:4});
  assert.ok(Math.abs(n.x - 0.6) < 1e-9 && Math.abs(n.y - 0.8) < 1e-9);
  assert.deepEqual(norm({x:0,y:0}), {x:0,y:0});
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(lerp(0, 10, 0.5), 5);
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `node --test tests/vec.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create server/game/vec.js**

```js
// server/game/vec.js
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a, s) => ({ x: a.x * s, y: a.y * s });
export const len = (a) => Math.hypot(a.x, a.y);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const norm = (a) => {
  const l = len(a);
  return l === 0 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};
```

- [ ] **Step 4: Run test, verify it passes**

Run: `node --test tests/vec.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/game/vec.js tests/vec.test.js
git commit -m "feat: 2D vector helpers"
```

---

### Task 3: Balance tables (ship stats + tunables)

**Files:**
- Create: `server/game/balance.js`
- Test: `tests/balance.test.js`

**Interfaces:**
- Produces: `SHIPS` (object keyed by class id → `{faction, size, hp, speed, cannonDmg, reloadMs, range, vision, special}`), `CANNON` (`{minDmgFactor:0.3, speed, radius, hitRadius}`), `ARCHER` (`{dmg, cooldownMs, range, arrows, spread, speed, hitRadius}`), `MOLOTOV` (`{cooldownMs, radius, durationMs, dotPerSec, throwRange}`), `MORTAR` (bomb-ketch override), `BASE` (`{hp:2000, healRadius, healWaitMs, healPerSec, turretDmg, turretRange, turretCooldownMs, respawnMs, donateRadius}`), `TICK_MS` re-export.
- All 10 class ids from `SHIP_CLASSES` must have an entry in `SHIPS`.

- [ ] **Step 1: Write the failing test**

```js
// tests/balance.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHIPS, CANNON, BASE } from '../server/game/balance.js';
import { SHIP_CLASSES } from '../shared/constants.js';

test('every ship class has stats', () => {
  for (const f of ['pirate', 'navy']) {
    for (const id of SHIP_CLASSES[f]) {
      const s = SHIPS[id];
      assert.ok(s, `missing stats for ${id}`);
      assert.equal(s.faction, f);
      assert.ok(s.hp > 0 && s.speed > 0 && s.range > 0);
    }
  }
});

test('large ships slower + tankier than small', () => {
  assert.ok(SHIPS.galleon.hp > SHIPS.sloop.hp);
  assert.ok(SHIPS.galleon.speed < SHIPS.sloop.speed);
  assert.ok(SHIPS.galleon.cannonDmg > SHIPS.sloop.cannonDmg);
});

test('cannon + base tunables sane', () => {
  assert.ok(CANNON.minDmgFactor > 0 && CANNON.minDmgFactor < 1);
  assert.equal(BASE.hp, 2000);
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `node --test tests/balance.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create server/game/balance.js**

```js
// server/game/balance.js
// ALL tunable numbers live here. Units: distance = world units, time = ms.
export { TICK_MS } from '../../shared/constants.js';

// Ship stat table. reloadMs = cannon reload. range = max cannon range.
export const SHIPS = {
  // PIRATES
  sloop:      { faction:'pirate', size:'small',    hp:80,  speed:190, cannonDmg:14, reloadMs:1400, range:520,  vision:900, special:'kite' },
  brig:       { faction:'pirate', size:'smallmed', hp:110, speed:165, cannonDmg:20, reloadMs:1700, range:620,  vision:750, special:'archer' },
  frigate:    { faction:'pirate', size:'medium',   hp:150, speed:140, cannonDmg:26, reloadMs:2000, range:680,  vision:750, special:'balanced' },
  galleon:    { faction:'pirate', size:'large',    hp:240, speed:90,  cannonDmg:44, reloadMs:2900, range:820,  vision:700, special:'crusher' },
  fireship:   { faction:'pirate', size:'special',  hp:120, speed:130, cannonDmg:16, reloadMs:2000, range:520,  vision:750, special:'fire' },
  // NAVY
  cutter:     { faction:'navy',   size:'small',    hp:90,  speed:180, cannonDmg:14, reloadMs:1400, range:520,  vision:950, special:'scout' },
  corvette:   { faction:'navy',   size:'smallmed', hp:120, speed:160, cannonDmg:20, reloadMs:1700, range:700,  vision:800, special:'archer' },
  frigate_n:  { faction:'navy',   size:'medium',   hp:160, speed:136, cannonDmg:26, reloadMs:2000, range:700,  vision:750, special:'balanced' },
  shipofline: { faction:'navy',   size:'large',    hp:260, speed:84,  cannonDmg:46, reloadMs:3000, range:860,  vision:700, special:'armor' },
  bombketch:  { faction:'navy',   size:'special',  hp:130, speed:120, cannonDmg:24, reloadMs:3200, range:1100, vision:750, special:'mortar' },
};

// Cannon: distance-damage falloff. dmg = cannonDmg * lerp(1 -> minDmgFactor, d/range)
export const CANNON = { minDmgFactor:0.3, speed:900, radius:14, hitRadius:34 };

// Archer: flat low damage, fast, no falloff.
export const ARCHER = { dmg:7, cooldownMs:700, range:420, arrows:3, spread:0.28, speed:1100, hitRadius:30 };

// Molotov: thrown area, lingering DoT.
export const MOLOTOV = { cooldownMs:6000, radius:150, durationMs:4000, dotPerSec:22, throwRange:600 };

// Bomb ketch special override (instant shock area instead of lingering fire).
export const MORTAR = { cooldownMs:6000, radius:170, durationMs:400, dotPerSec:0, burst:70, throwRange:1100 };

export const BASE = {
  hp:2000, healRadius:420, healWaitMs:2000, healPerSec:40,
  turretDmg:18, turretRange:700, turretCooldownMs:1200,
  respawnMs:5000, donateRadius:460,
};
```

- [ ] **Step 4: Run test, verify it passes**

Run: `node --test tests/balance.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/game/balance.js tests/balance.test.js
git commit -m "feat: balance tables for ships/weapons/base"
```

---

### Task 4: Map + collision

**Files:**
- Create: `server/game/map.js`
- Test: `tests/map.test.js`

**Interfaces:**
- Consumes: `vec.js`, `WORLD` from constants.
- Produces:
  - `ISLANDS` = array of `{x,y,r}` circles.
  - `BASES` = `{pirate:{x,y}, navy:{x,y}}` (opposite corners).
  - `blocked(p)` → boolean (point inside any island).
  - `segmentHitsIsland(a, b)` → boolean (does segment a→b intersect an island; used to stop projectiles / block vision).
  - `resolveShipCollision(pos, radius)` → `{x,y}` pushed out of islands and world bounds.

- [ ] **Step 1: Write the failing test**

```js
// tests/map.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ISLANDS, BASES, blocked, segmentHitsIsland, resolveShipCollision } from '../server/game/map.js';

test('bases are in opposite corners', () => {
  assert.ok(BASES.pirate && BASES.navy);
  assert.ok(Math.hypot(BASES.pirate.x - BASES.navy.x, BASES.pirate.y - BASES.navy.y) > 3000);
});

test('blocked detects island interior', () => {
  const i = ISLANDS[0];
  assert.equal(blocked({ x: i.x, y: i.y }), true);
  assert.equal(blocked({ x: -5, y: -5 }), false); // outside world but not island
});

test('segmentHitsIsland true when crossing island', () => {
  const i = ISLANDS[0];
  assert.equal(segmentHitsIsland({ x: i.x - i.r - 200, y: i.y }, { x: i.x + i.r + 200, y: i.y }), true);
  assert.equal(segmentHitsIsland({ x: 0, y: 0 }, { x: 0, y: 1 }), false);
});

test('resolveShipCollision pushes out of island and keeps in bounds', () => {
  const i = ISLANDS[0];
  const out = resolveShipCollision({ x: i.x, y: i.y }, 20);
  assert.ok(Math.hypot(out.x - i.x, out.y - i.y) >= i.r + 20 - 1e-6);
  const b = resolveShipCollision({ x: -100, y: -100 }, 20);
  assert.ok(b.x >= 0 && b.y >= 0);
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `node --test tests/map.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create server/game/map.js**

```js
// server/game/map.js
import { WORLD } from '../../shared/constants.js';
import { clamp } from './vec.js';

export const BASES = {
  pirate: { x: 500,  y: 500 },
  navy:   { x: 3500, y: 3500 },
};

// Handcrafted islands (impassable cover) in the mid-field.
export const ISLANDS = [
  { x: 2000, y: 2000, r: 320 },
  { x: 1300, y: 2600, r: 220 },
  { x: 2700, y: 1400, r: 220 },
  { x: 1200, y: 1200, r: 180 },
  { x: 2800, y: 2800, r: 180 },
];

export function blocked(p) {
  return ISLANDS.some((i) => Math.hypot(p.x - i.x, p.y - i.y) < i.r);
}

// Distance from point p to segment ab.
function distPointSeg(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const apx = p.x - a.x, apy = p.y - a.y;
  const len2 = abx * abx + aby * aby;
  let t = len2 === 0 ? 0 : (apx * abx + apy * aby) / len2;
  t = clamp(t, 0, 1);
  const cx = a.x + abx * t, cy = a.y + aby * t;
  return Math.hypot(p.x - cx, p.y - cy);
}

export function segmentHitsIsland(a, b) {
  return ISLANDS.some((i) => distPointSeg(i, a, b) < i.r);
}

export function resolveShipCollision(pos, radius) {
  let x = clamp(pos.x, radius, WORLD.w - radius);
  let y = clamp(pos.y, radius, WORLD.h - radius);
  for (const i of ISLANDS) {
    const dx = x - i.x, dy = y - i.y;
    const d = Math.hypot(dx, dy);
    const min = i.r + radius;
    if (d < min && d > 0) {
      x = i.x + (dx / d) * min;
      y = i.y + (dy / d) * min;
    } else if (d === 0) {
      x = i.x + min;
    }
  }
  return { x, y };
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `node --test tests/map.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/game/map.js tests/map.test.js
git commit -m "feat: map geometry + collision helpers"
```

---

## Phase 2 — Entities & combat logic (pure, testable)

### Task 5: Ship entity + movement

**Files:**
- Create: `server/game/ship.js`
- Test: `tests/ship.test.js`

**Interfaces:**
- Consumes: `SHIPS` (balance), `vec.js`, `map.js`, `TICK_MS`.
- Produces: `class Ship` with:
  - constructor `new Ship({id, name, faction, cls, flagColor, pos})`.
  - fields: `id, name, faction, cls, flagColor, pos{x,y}, target{x,y}|null, hp, maxHp, alive, radius, buffs[], streak, archerKills, lastCannonAt, lastArcherAt, lastMolotovAt, healingSince, safe`.
  - `hasBuff(type)` — boolean.
  - `setTarget(x,y)` — set move destination.
  - `speedNow()` — base speed × active speed buffs (`fullsails` = ×1.5).
  - `step(dtMs)` — move toward target, apply collision via `resolveShipCollision`, stop when within 4 units.
  - `damage(amount)` — reduce hp, set `alive=false` at <=0, returns true if it died this call.
  - `serialize()` — plain snapshot object.

- [ ] **Step 1: Write the failing test**

```js
// tests/ship.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ship } from '../server/game/ship.js';

function mk() {
  return new Ship({ id:'p1', name:'A', faction:'pirate', cls:'sloop', flagColor:'#f00', pos:{x:500,y:500} });
}

test('ship inits from stat table', () => {
  const s = mk();
  assert.equal(s.hp, 80);
  assert.equal(s.maxHp, 80);
  assert.ok(s.alive);
  assert.ok(s.radius > 0);
});

test('ship moves toward target and stops', () => {
  const s = mk();
  s.setTarget(1000, 500);
  for (let i = 0; i < 200; i++) s.step(50);
  assert.ok(Math.abs(s.pos.x - 1000) < 5);
  assert.equal(s.target, null);
});

test('damage kills at zero and reports death once', () => {
  const s = mk();
  assert.equal(s.damage(50), false);
  assert.equal(s.damage(50), true);   // crosses to <=0 -> died
  assert.equal(s.alive, false);
  assert.equal(s.damage(10), false);  // already dead, not "died this call"
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `node --test tests/ship.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create server/game/ship.js**

```js
// server/game/ship.js
import { SHIPS } from './balance.js';
import { sub, len, norm } from './vec.js';
import { resolveShipCollision } from './map.js';

const RADIUS_BY_SIZE = { small:16, smallmed:20, medium:24, large:34, special:24 };

export class Ship {
  constructor({ id, name, faction, cls, flagColor, pos }) {
    const stat = SHIPS[cls];
    if (!stat) throw new Error('unknown ship class ' + cls);
    this.id = id;
    this.name = name;
    this.faction = faction;
    this.cls = cls;
    this.flagColor = flagColor;
    this.stat = stat;
    this.pos = { x: pos.x, y: pos.y };
    this.target = null;
    this.hp = stat.hp;
    this.maxHp = stat.hp;
    this.alive = true;
    this.radius = RADIUS_BY_SIZE[stat.size] || 22;
    this.buffs = [];               // [{type, until}]
    this.streak = 0;
    this.archerKills = 0;
    this.lastCannonAt = 0;
    this.lastArcherAt = 0;
    this.lastMolotovAt = 0;
    this.healingSince = null;      // ts when entered heal zone (set by base logic)
    this.safe = false;             // true while healing in own base zone
  }

  hasBuff(type) { return this.buffs.some((b) => b.type === type); }

  speedNow() {
    let mult = 1;
    if (this.hasBuff('fullsails')) mult *= 1.5;
    return this.stat.speed * mult;
  }

  setTarget(x, y) { this.target = { x, y }; }

  step(dtMs) {
    if (!this.alive || !this.target) return;
    const dt = dtMs / 1000;
    const d = sub(this.target, this.pos);
    const dl = len(d);
    if (dl < 4) { this.target = null; return; }
    const dir = norm(d);
    const stepLen = Math.min(dl, this.speedNow() * dt);
    const next = { x: this.pos.x + dir.x * stepLen, y: this.pos.y + dir.y * stepLen };
    this.pos = resolveShipCollision(next, this.radius);
  }

  damage(amount) {
    if (!this.alive) return false;
    this.hp -= amount;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; return true; }
    return false;
  }

  serialize() {
    return {
      id: this.id, name: this.name, faction: this.faction, cls: this.cls,
      flagColor: this.flagColor, x: Math.round(this.pos.x), y: Math.round(this.pos.y),
      hp: Math.round(this.hp), maxHp: this.maxHp, alive: this.alive,
      streak: this.streak, buffs: this.buffs.map((b) => b.type),
    };
  }
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `node --test tests/ship.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/game/ship.js tests/ship.test.js
git commit -m "feat: ship entity with movement/collision/damage"
```

---

### Task 6: Cannon damage falloff (distance-based)

**Files:**
- Create: `server/game/weapons.js` (cannon portion first)
- Test: `tests/weapons_cannon.test.js`

**Interfaces:**
- Consumes: `CANNON`, `ARCHER`, `SHIPS` (balance), `vec.js`, `map.js`.
- Produces:
  - `cannonDamage(baseDmg, travelled, maxRange)` → number. Full at 0, `minDmgFactor` at maxRange, clamped.
  - `class Projectile` `{id, kind, owner, faction, pos, vel, dmg, life, pierce, hitRadius}` with `step(dtMs)` returning `'hit-island'|'expired'|null`.
  - `makeCannon(ship, dir, power)` → Projectile. `power` in `[0,1]` scales travel distance up to ship range; carries `dmg` computed for that intended travel distance (close aim = more dmg). Applies `broadside` (×2) and `chainshot` (pierce) buffs.

- [ ] **Step 1: Write the failing test**

```js
// tests/weapons_cannon.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cannonDamage, makeCannon, Projectile } from '../server/game/weapons.js';
import { Ship } from '../server/game/ship.js';
import { CANNON } from '../server/game/balance.js';

test('cannon damage falls off with distance', () => {
  const base = 40, range = 800;
  assert.equal(cannonDamage(base, 0, range), 40);
  assert.equal(Math.round(cannonDamage(base, 800, range)), Math.round(base * CANNON.minDmgFactor));
  assert.ok(cannonDamage(base, 400, range) < 40 && cannonDamage(base, 400, range) > base * CANNON.minDmgFactor);
});

test('makeCannon: closer aim (low power) deals more damage than far aim', () => {
  const s = new Ship({ id:'p1', name:'A', faction:'pirate', cls:'galleon', flagColor:'#f00', pos:{x:0,y:0} });
  const near = makeCannon(s, { x:1, y:0 }, 0.2);
  const far  = makeCannon(s, { x:1, y:0 }, 1.0);
  assert.ok(near.dmg > far.dmg);
});

test('projectile expires after its life', () => {
  const p = new Projectile({ id:'x', kind:'cannon', owner:'p1', faction:'pirate', pos:{x:0,y:0}, vel:{x:100,y:0}, dmg:10, life:100, pierce:false });
  assert.equal(p.step(50), null);
  assert.equal(p.step(60), 'expired');
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `node --test tests/weapons_cannon.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create server/game/weapons.js (cannon portion)**

```js
// server/game/weapons.js
import { CANNON, ARCHER, MOLOTOV, MORTAR, SHIPS } from './balance.js';
import { lerp, clamp, norm, scale } from './vec.js';
import { segmentHitsIsland } from './map.js';

let _pid = 0;
const nextId = () => 'proj' + (++_pid);

export function cannonDamage(baseDmg, travelled, maxRange) {
  const t = clamp(travelled / maxRange, 0, 1);
  return baseDmg * lerp(1, CANNON.minDmgFactor, t);
}

export class Projectile {
  constructor({ id, kind, owner, faction, pos, vel, dmg, life, pierce }) {
    this.id = id; this.kind = kind; this.owner = owner; this.faction = faction;
    this.pos = { x: pos.x, y: pos.y }; this.vel = { x: vel.x, y: vel.y };
    this.dmg = dmg; this.life = life; this.pierce = !!pierce; this.hitRadius = CANNON.hitRadius;
    if (kind === 'arrow') this.hitRadius = ARCHER.hitRadius;
  }
  step(dtMs) {
    const dt = dtMs / 1000;
    const prev = { x: this.pos.x, y: this.pos.y };
    this.pos = { x: this.pos.x + this.vel.x * dt, y: this.pos.y + this.vel.y * dt };
    this.life -= dtMs;
    if (segmentHitsIsland(prev, this.pos)) return 'hit-island';
    if (this.life <= 0) return 'expired';
    return null;
  }
  serialize() {
    return { id:this.id, kind:this.kind, x:Math.round(this.pos.x), y:Math.round(this.pos.y), faction:this.faction };
  }
}

// dir = direction {x,y} (not necessarily unit); power in [0,1] chooses intended travel distance.
export function makeCannon(ship, dir, power) {
  const range = SHIPS[ship.cls].range;
  const p = clamp(power, 0.05, 1);
  const travel = range * p;
  const dmgMult = ship.hasBuff('broadside') ? 2 : 1;
  const dmg = cannonDamage(SHIPS[ship.cls].cannonDmg, travel, range) * dmgMult;
  const d = norm(dir);
  const life = (travel / CANNON.speed) * 1000;
  return new Projectile({
    id: nextId(), kind:'cannon', owner:ship.id, faction:ship.faction,
    pos:{ x:ship.pos.x, y:ship.pos.y }, vel: scale(d, CANNON.speed),
    dmg, life, pierce: ship.hasBuff('chainshot'),
  });
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `node --test tests/weapons_cannon.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/game/weapons.js tests/weapons_cannon.test.js
git commit -m "feat: cannon projectile + distance-based damage falloff"
```

---

### Task 7: Archer volley + molotov/mortar fire areas

**Files:**
- Modify: `server/game/weapons.js` (add archer + fire area functions)
- Test: `tests/weapons_area.test.js`

**Interfaces:**
- Produces (appended to `weapons.js`):
  - `makeArcherVolley(ship, dir)` → `Projectile[]` (kind `'arrow'`), count = `ARCHER.arrows` (+2 with `marksman` buff), spread fan, flat `ARCHER.dmg`, range extended +40% with `marksman`.
  - `class FireArea` `{id, owner, faction, pos, radius, life, dotPerSec, burst}` with `step(dtMs)` → `'expired'|null`, and `contains(point)` → boolean. `burst>0` means it deals an instant hit once (mortar); a private `_burst` flag guards single application.
  - `makeMolotov(ship, aimPos)` → FireArea. Fireship gets ×2 radius & duration; `inferno` buff also grants ×2 (radius/duration) and ×2 DoT. Bomb ketch (`bombketch`) uses `MORTAR` (instant burst, no lingering DoT).

- [ ] **Step 1: Write the failing test**

```js
// tests/weapons_area.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeArcherVolley, makeMolotov, FireArea } from '../server/game/weapons.js';
import { Ship } from '../server/game/ship.js';
import { ARCHER } from '../server/game/balance.js';

const mk = (cls) => new Ship({ id:'p1', name:'A', faction:'pirate', cls, flagColor:'#f00', pos:{x:0,y:0} });

test('archer volley fans multiple arrows', () => {
  const arrows = makeArcherVolley(mk('brig'), { x:1, y:0 });
  assert.equal(arrows.length, ARCHER.arrows);
  assert.ok(arrows.every((a) => a.kind === 'arrow' && a.dmg === ARCHER.dmg));
});

test('fireship molotov is bigger than a normal ship', () => {
  const normal = makeMolotov(mk('frigate'), { x:200, y:0 });
  const fire = makeMolotov(mk('fireship'), { x:200, y:0 });
  assert.ok(fire.radius > normal.radius);
});

test('FireArea contains + expires', () => {
  const f = new FireArea({ id:'f', owner:'p1', faction:'pirate', pos:{x:0,y:0}, radius:100, life:1000, dotPerSec:20, burst:0 });
  assert.equal(f.contains({ x:50, y:0 }), true);
  assert.equal(f.contains({ x:200, y:0 }), false);
  assert.equal(f.step(500), null);
  assert.equal(f.step(600), 'expired');
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `node --test tests/weapons_area.test.js`
Expected: FAIL — `makeArcherVolley` not exported.

- [ ] **Step 3: Append to server/game/weapons.js**

```js
// --- append to server/game/weapons.js ---

export function makeArcherVolley(ship, dir) {
  const marks = ship.hasBuff('marksman');
  const count = ARCHER.arrows + (marks ? 2 : 0);
  const range = ARCHER.range * (marks ? 1.4 : 1);
  const life = (range / ARCHER.speed) * 1000;
  const baseAng = Math.atan2(dir.y, dir.x);
  const out = [];
  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * (ARCHER.spread / Math.max(1, count - 1)) * 2;
    const ang = baseAng + offset;
    out.push(new Projectile({
      id: nextId(), kind:'arrow', owner:ship.id, faction:ship.faction,
      pos:{ x:ship.pos.x, y:ship.pos.y },
      vel:{ x:Math.cos(ang) * ARCHER.speed, y:Math.sin(ang) * ARCHER.speed },
      dmg: ARCHER.dmg, life, pierce:false,
    }));
  }
  return out;
}

export class FireArea {
  constructor({ id, owner, faction, pos, radius, life, dotPerSec, burst }) {
    this.id = id; this.owner = owner; this.faction = faction;
    this.pos = { x: pos.x, y: pos.y }; this.radius = radius;
    this.life = life; this.dotPerSec = dotPerSec; this.burst = burst || 0;
    this._burst = false;
  }
  step(dtMs) { this.life -= dtMs; return this.life <= 0 ? 'expired' : null; }
  contains(p) { return Math.hypot(p.x - this.pos.x, p.y - this.pos.y) <= this.radius; }
  serialize() {
    return { id:this.id, x:Math.round(this.pos.x), y:Math.round(this.pos.y), radius:this.radius, faction:this.faction };
  }
}

export function makeMolotov(ship, aimPos) {
  if (ship.cls === 'bombketch') {
    return new FireArea({
      id: nextId(), owner:ship.id, faction:ship.faction, pos:aimPos,
      radius: MORTAR.radius, life: MORTAR.durationMs, dotPerSec: MORTAR.dotPerSec, burst: MORTAR.burst,
    });
  }
  const big = ship.cls === 'fireship' || ship.hasBuff('inferno');
  return new FireArea({
    id: nextId(), owner:ship.id, faction:ship.faction, pos:aimPos,
    radius: MOLOTOV.radius * (big ? 2 : 1),
    life: MOLOTOV.durationMs * (big ? 2 : 1),
    dotPerSec: MOLOTOV.dotPerSec * (ship.hasBuff('inferno') ? 2 : 1),
    burst: 0,
  });
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `node --test tests/weapons_area.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/game/weapons.js tests/weapons_area.test.js
git commit -m "feat: archer volley + molotov/mortar fire areas"
```

---

### Task 8: Base logic (heal, respawn, turret, donation)

**Files:**
- Create: `server/game/base.js`
- Test: `tests/base.test.js`

**Interfaces:**
- Consumes: `BASE` (balance), `BASES` (map), `vec.js`.
- Produces: `class Base` `{faction, pos, hp, maxHp, alive, lastTurretAt}` with:
  - `inHealZone(ship)` → boolean.
  - `updateHeal(ship, dtMs, now)` — if ship in zone: set `healingSince` if unset; after `healWaitMs`, regen `healPerSec` scaled by `dtMs`; set `ship.safe = true`. If outside/dead, clear `healingSince` and `safe`. Clamps to `maxHp`.
  - `damage(amount)` — reduce base hp, set `alive=false` at 0, return died-bool.
  - `respawnPoint()` → `{x,y}` near base (small jitter).
  - `canDonate(from, to)` — both same faction as base, different ships, both within `donateRadius`.
  - `serialize()`.

- [ ] **Step 1: Write the failing test**

```js
// tests/base.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Base } from '../server/game/base.js';
import { Ship } from '../server/game/ship.js';
import { BASE } from '../server/game/balance.js';

const shipAt = (x, y) => new Ship({ id:'p1', name:'A', faction:'pirate', cls:'frigate', flagColor:'#f00', pos:{x,y} });

test('heal only after waiting, and clamps to maxHp', () => {
  const b = new Base('pirate');
  const s = shipAt(b.pos.x, b.pos.y);
  s.hp = 50;
  b.updateHeal(s, 100, 1000);          // just entered, wait not elapsed
  assert.equal(s.hp, 50);
  b.updateHeal(s, BASE.healWaitMs, 1000 + BASE.healWaitMs + 1000); // waited + 1s
  assert.ok(s.hp > 50);
  s.hp = s.maxHp - 1;
  b.updateHeal(s, 5000, 999999);
  assert.equal(s.hp, s.maxHp);         // clamps
});

test('leaving zone resets healingSince', () => {
  const b = new Base('pirate');
  const s = shipAt(b.pos.x, b.pos.y);
  b.updateHeal(s, 100, 1000);
  assert.ok(s.healingSince !== null);
  s.pos = { x: b.pos.x + BASE.healRadius + 500, y: b.pos.y };
  b.updateHeal(s, 100, 2000);
  assert.equal(s.healingSince, null);
});

test('base dies at zero hp', () => {
  const b = new Base('navy');
  assert.equal(b.damage(BASE.hp - 1), false);
  assert.equal(b.damage(10), true);
  assert.equal(b.alive, false);
});

test('donation requires same faction near base', () => {
  const b = new Base('pirate');
  const a = shipAt(b.pos.x, b.pos.y);
  const c = shipAt(b.pos.x + 50, b.pos.y);
  assert.equal(b.canDonate(a, c), true);
  c.pos = { x: b.pos.x + 5000, y: b.pos.y };
  assert.equal(b.canDonate(a, c), false);
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `node --test tests/base.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create server/game/base.js**

```js
// server/game/base.js
import { BASE } from './balance.js';
import { BASES } from './map.js';
import { dist } from './vec.js';

export class Base {
  constructor(faction) {
    this.faction = faction;
    this.pos = { ...BASES[faction] };
    this.hp = BASE.hp;
    this.maxHp = BASE.hp;
    this.alive = true;
    this.lastTurretAt = 0;
  }

  inHealZone(ship) { return dist(ship.pos, this.pos) <= BASE.healRadius; }

  updateHeal(ship, dtMs, now) {
    if (!ship.alive) { ship.healingSince = null; ship.safe = false; return; }
    if (this.inHealZone(ship)) {
      if (ship.healingSince == null) ship.healingSince = now;
      ship.safe = true;
      if (now - ship.healingSince >= BASE.healWaitMs) {
        ship.hp = Math.min(ship.maxHp, ship.hp + BASE.healPerSec * (dtMs / 1000));
      }
    } else {
      ship.healingSince = null;
      ship.safe = false;
    }
  }

  damage(amount) {
    if (!this.alive) return false;
    this.hp -= amount;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; return true; }
    return false;
  }

  respawnPoint() {
    const jitter = () => (Math.random() - 0.5) * 120;
    return { x: this.pos.x + jitter(), y: this.pos.y + jitter() };
  }

  canDonate(from, to) {
    return from.faction === this.faction && to.faction === this.faction &&
      from.id !== to.id &&
      dist(from.pos, this.pos) <= BASE.donateRadius &&
      dist(to.pos, this.pos) <= BASE.donateRadius;
  }

  serialize() {
    return { faction:this.faction, x:this.pos.x, y:this.pos.y, hp:Math.round(this.hp), maxHp:this.maxHp, alive:this.alive };
  }
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `node --test tests/base.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/game/base.js tests/base.test.js
git commit -m "feat: base heal/respawn/turret/donation logic"
```

---

### Task 9: Skills / streak system

**Files:**
- Create: `server/game/skills.js`
- Modify: `server/game/balance.js` (add `BUFF_MS`)
- Test: `tests/skills.test.js`

**Interfaces:**
- Adds to balance: `BUFF_MS` = `{fastreload:12000, broadside:10000, fullsails:10000, inferno:12000, chainshot:8000, shockwave:8000, marksman:10000}`.
- Produces in `skills.js`:
  - `addBuff(ship, type, now)` — push `{type, until: now + BUFF_MS[type]}`, refreshing an existing same-type buff's timer.
  - `expireBuffs(ship, now)` — drop buffs whose `until <= now`.
  - `cooldownFactor(ship)` — 0.6 if `fastreload` else 1.
  - `onKill(killer, killsThisShot, now)` — increments streak, evaluates triggers, returns `string[]` of buff types granted. Rules: streak 3→`fastreload`, 5→`broadside`, 7→`fullsails`, 10→`inferno`; `killsThisShot>=3`→`shockwave` else `>=2`→`chainshot`.
  - `onArcherKill(killer, now)` — increments `archerKills`; every 3rd grants `marksman`.
  - `resetStreak(ship)` — streak = 0, archerKills = 0 (on death).

- [ ] **Step 1: Write the failing test**

```js
// tests/skills.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addBuff, expireBuffs, onKill, onArcherKill, resetStreak, cooldownFactor } from '../server/game/skills.js';
import { Ship } from '../server/game/ship.js';

const mk = () => new Ship({ id:'p1', name:'A', faction:'pirate', cls:'frigate', flagColor:'#f00', pos:{x:0,y:0} });

test('buffs expire on time', () => {
  const s = mk();
  addBuff(s, 'fastreload', 1000);
  assert.ok(s.hasBuff('fastreload'));
  expireBuffs(s, 1000 + 11999);
  assert.ok(s.hasBuff('fastreload'));
  expireBuffs(s, 1000 + 12001);
  assert.ok(!s.hasBuff('fastreload'));
});

test('kill streak grants tiered buffs', () => {
  const s = mk();
  let g = [];
  for (let i = 0; i < 3; i++) g = onKill(s, 1, 1000);
  assert.ok(g.includes('fastreload'));
  for (let i = 3; i < 5; i++) g = onKill(s, 1, 1000);
  assert.ok(g.includes('broadside'));
});

test('multi-kill grants chainshot/shockwave', () => {
  const s = mk();
  const g2 = onKill(s, 2, 1000);
  assert.ok(g2.includes('chainshot'));
  const g3 = onKill(s, 3, 1000);
  assert.ok(g3.includes('shockwave'));
});

test('death resets streak', () => {
  const s = mk();
  onKill(s, 1, 1000); onKill(s, 1, 1000);
  resetStreak(s);
  assert.equal(s.streak, 0);
});

test('cooldownFactor reflects fastreload', () => {
  const s = mk();
  assert.equal(cooldownFactor(s), 1);
  addBuff(s, 'fastreload', 0);
  assert.equal(cooldownFactor(s), 0.6);
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `node --test tests/skills.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Add BUFF_MS to balance.js**

```js
// --- append to server/game/balance.js ---
export const BUFF_MS = {
  fastreload:12000, broadside:10000, fullsails:10000, inferno:12000,
  chainshot:8000, shockwave:8000, marksman:10000,
};
```

- [ ] **Step 4: Create server/game/skills.js**

```js
// server/game/skills.js
import { BUFF_MS } from './balance.js';

export function addBuff(ship, type, now) {
  const until = now + (BUFF_MS[type] || 8000);
  const existing = ship.buffs.find((b) => b.type === type);
  if (existing) existing.until = until;
  else ship.buffs.push({ type, until });
}

export function expireBuffs(ship, now) {
  ship.buffs = ship.buffs.filter((b) => b.until > now);
}

export function cooldownFactor(ship) {
  return ship.hasBuff('fastreload') ? 0.6 : 1;
}

export function onKill(killer, killsThisShot, now) {
  killer.streak += 1;
  const granted = [];
  const grant = (t) => { addBuff(killer, t, now); granted.push(t); };
  if (killer.streak === 3) grant('fastreload');
  if (killer.streak === 5) grant('broadside');
  if (killer.streak === 7) grant('fullsails');
  if (killer.streak === 10) grant('inferno');
  if (killsThisShot >= 3) grant('shockwave');
  else if (killsThisShot >= 2) grant('chainshot');
  return granted;
}

export function onArcherKill(killer, now) {
  killer.archerKills += 1;
  const granted = [];
  if (killer.archerKills > 0 && killer.archerKills % 3 === 0) {
    addBuff(killer, 'marksman', now);
    granted.push('marksman');
  }
  return granted;
}

export function resetStreak(ship) {
  ship.streak = 0;
  ship.archerKills = 0;
}
```

- [ ] **Step 5: Run test, verify it passes**

Run: `node --test tests/skills.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/game/skills.js server/game/balance.js tests/skills.test.js
git commit -m "feat: streak-driven timed buff skill system"
```

---

### Task 10: World — integrate everything into one step()

**Files:**
- Create: `server/game/world.js`
- Test: `tests/world.test.js`

**Interfaces:**
- Consumes: all of Phase 1–2 (`Ship`, `Base`, weapons, skills, balance, `vec`).
- Produces: `class World` with:
  - `addShip({id,name,faction,cls,flagColor})` — spawn at own base respawn point, store, return Ship.
  - `removeShip(id)`.
  - `input(id, msg)` — apply client intent (`move`/`fire`/`useSkill`/`donate`) with server-side cooldown checks; blocks firing while `ship.safe`.
  - `step(dtMs, now)` — advance ships, projectiles, fires, turrets, heal, deaths/respawn, buff expiry, base damage. Returns `events[]`.
  - `serialize()` → `{ships, projectiles, fires, bases:[pirate,navy], over, winner}`.
  - Death handling credits killer streak (or archer kills for arrows); counts kills-in-one-shot for pierce/area; schedules respawn after `BASE.respawnMs`; clears buffs on respawn.
  - `gameOver` set when a base dies; `winner` = firing faction.

- [ ] **Step 1: Write the failing test**

```js
// tests/world.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../server/game/world.js';

function twoShips() {
  const w = new World('room1');
  const a = w.addShip({ id:'a', name:'A', faction:'pirate', cls:'galleon', flagColor:'#f00' });
  const b = w.addShip({ id:'b', name:'B', faction:'navy',   cls:'sloop',   flagColor:'#00f' });
  a.pos = { x: 2000, y: 2000 };
  b.pos = { x: 2000, y: 2100 };
  return { w, a, b };
}

test('cannon fire damages an enemy in line', () => {
  const { w, b } = twoShips();
  const before = b.hp;
  w.input('a', { type:'fire', weapon:'cannon', dir:{ x:0, y:1 }, power:0.2 });
  for (let i = 0; i < 10; i++) w.step(50, 100 + i * 50);
  assert.ok(b.hp < before, 'enemy took damage');
});

test('friendly fire does nothing', () => {
  const w = new World('r');
  const a = w.addShip({ id:'a', name:'A', faction:'pirate', cls:'galleon', flagColor:'#f00' });
  const c = w.addShip({ id:'c', name:'C', faction:'pirate', cls:'sloop', flagColor:'#f00' });
  a.pos = { x:2000, y:2000 }; c.pos = { x:2000, y:2100 };
  const before = c.hp;
  w.input('a', { type:'fire', weapon:'cannon', dir:{x:0,y:1}, power:0.2 });
  for (let i = 0; i < 10; i++) w.step(50, 100 + i*50);
  assert.equal(c.hp, before);
});

test('destroying a base ends the game', () => {
  const { w } = twoShips();
  w.bases.navy.hp = 5;
  w.bases.navy.damage(5);      // base now dead
  const evs = w.step(50, 200); // step should notice + end
  assert.ok(w.over);
  assert.ok(evs.some((e) => e.type === 'gameOver'));
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `node --test tests/world.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create server/game/world.js**

```js
// server/game/world.js
import { Ship } from './ship.js';
import { Base } from './base.js';
import { makeCannon, makeArcherVolley, makeMolotov } from './weapons.js';
import { onKill, onArcherKill, resetStreak, expireBuffs, cooldownFactor, addBuff } from './skills.js';
import { SHIPS, ARCHER, MOLOTOV, MORTAR, BASE } from './balance.js';
import { dist } from './vec.js';

export class World {
  constructor(id) {
    this.id = id;
    this.ships = new Map();
    this.projectiles = [];
    this.fires = [];
    this.bases = { pirate: new Base('pirate'), navy: new Base('navy') };
    this.respawns = []; // {id, at}
    this.over = false;
    this.winner = null;
    this._now = 0;
  }

  addShip(cfg) {
    const rp = this.bases[cfg.faction].respawnPoint();
    const s = new Ship({ ...cfg, pos: rp });
    this.ships.set(cfg.id, s);
    return s;
  }
  removeShip(id) { this.ships.delete(id); }

  input(id, msg) {
    const s = this.ships.get(id);
    if (!s || !s.alive || this.over) return;
    const now = this._now;
    if (msg.type === 'move') { s.setTarget(msg.x, msg.y); return; }
    if (msg.type === 'useSkill') { return; } // buffs are auto-granted; reserved
    if (msg.type === 'donate') {
      const to = this.ships.get(msg.targetPlayerId);
      const base = this.bases[s.faction];
      if (to && base.canDonate(s, to) && s.buffs.length) {
        const b = s.buffs.shift();
        addBuff(to, b.type, now);
      }
      return;
    }
    if (msg.type === 'fire') {
      if (s.safe) return; // cannot fire while healing in base
      this._fire(s, msg, now);
    }
  }

  _fire(s, msg, now) {
    if (msg.weapon === 'cannon') {
      const cd = SHIPS[s.cls].reloadMs * cooldownFactor(s);
      if (now - s.lastCannonAt < cd) return;
      s.lastCannonAt = now;
      this.projectiles.push(makeCannon(s, msg.dir, msg.power ?? 1));
    } else if (msg.weapon === 'archer') {
      const cd = ARCHER.cooldownMs * cooldownFactor(s);
      if (now - s.lastArcherAt < cd) return;
      s.lastArcherAt = now;
      this.projectiles.push(...makeArcherVolley(s, msg.dir));
    } else if (msg.weapon === 'molotov') {
      const cd = (s.cls === 'bombketch' ? MORTAR.cooldownMs : MOLOTOV.cooldownMs) * cooldownFactor(s);
      if (now - s.lastMolotovAt < cd) return;
      s.lastMolotovAt = now;
      this.fires.push(makeMolotov(s, msg.aim || s.pos));
    }
  }

  step(dtMs, now) {
    this._now = now;
    const events = [];
    if (this.over) return events;

    // if a base already died (e.g. external), end immediately
    for (const f of ['pirate', 'navy']) {
      if (!this.bases[f].alive) { this._endGame(f === 'pirate' ? 'navy' : 'pirate', events); return events; }
    }

    for (const s of this.ships.values()) { if (s.alive) s.step(dtMs); expireBuffs(s, now); }

    for (const f of ['pirate', 'navy']) {
      for (const s of this.ships.values()) {
        if (s.faction === f) this.bases[f].updateHeal(s, dtMs, now);
      }
    }

    this._stepProjectiles(dtMs, now, events);
    this._stepFires(dtMs, now, events);
    this._stepTurrets(dtMs, now, events);
    this._stepRespawns(now);
    return events;
  }

  _enemiesOf(faction) {
    return [...this.ships.values()].filter((s) => s.alive && s.faction !== faction);
  }

  _killShip(victim, killer, killsThisShot, weapon, now, events) {
    victim.alive = false;
    resetStreak(victim);
    this.respawns.push({ id: victim.id, at: now + BASE.respawnMs });
    if (killer && killer.alive) {
      const granted = weapon === 'arrow' ? onArcherKill(killer, now) : onKill(killer, killsThisShot, now);
      events.push({ type: 'kill', killer: killer.id, victim: victim.id });
      for (const g of granted) events.push({ type: 'skillGained', player: killer.id, skill: g });
    } else {
      events.push({ type: 'kill', killer: killer ? killer.id : null, victim: victim.id });
    }
  }

  _stepProjectiles(dtMs, now, events) {
    const keep = [];
    for (const p of this.projectiles) {
      const r = p.step(dtMs);
      if (r === 'expired' || r === 'hit-island') continue;
      let hits = 0;
      let consumed = false;
      const owner = this.ships.get(p.owner);
      for (const s of this.ships.values()) {
        if (!s.alive || s.faction === p.faction || s.safe) continue;
        if (dist(s.pos, p.pos) <= p.hitRadius + s.radius) {
          const died = s.damage(p.dmg);
          hits++;
          if (died) this._killShip(s, owner, hits, p.kind === 'arrow' ? 'arrow' : 'cannon', now, events);
          if (!p.pierce) { consumed = true; break; }
        }
      }
      if (!consumed) {
        for (const f of ['pirate', 'navy']) {
          if (f === p.faction) continue;
          const base = this.bases[f];
          if (base.alive && dist(base.pos, p.pos) <= p.hitRadius + 60) {
            const died = base.damage(p.dmg);
            events.push({ type: 'baseHit', faction: f, hp: base.hp });
            if (died) this._endGame(p.faction, events);
            consumed = true;
            break;
          }
        }
      }
      if (!consumed && !this.over) keep.push(p);
    }
    this.projectiles = keep;
  }

  _stepFires(dtMs, now, events) {
    const keep = [];
    for (const fire of this.fires) {
      if (fire.burst && !fire._burst) {
        fire._burst = true;
        const owner = this.ships.get(fire.owner);
        for (const s of this.ships.values()) {
          if (s.alive && s.faction !== fire.faction && !s.safe && fire.contains(s.pos)) {
            const died = s.damage(fire.burst);
            if (died) this._killShip(s, owner, 1, 'cannon', now, events);
          }
        }
      }
      if (fire.dotPerSec) {
        const owner = this.ships.get(fire.owner);
        for (const s of this.ships.values()) {
          if (s.alive && s.faction !== fire.faction && !s.safe && fire.contains(s.pos)) {
            const died = s.damage(fire.dotPerSec * (dtMs / 1000));
            if (died) this._killShip(s, owner, 1, 'cannon', now, events);
          }
        }
      }
      if (fire.step(dtMs) !== 'expired') keep.push(fire);
    }
    this.fires = keep;
  }

  _stepTurrets(dtMs, now, events) {
    for (const f of ['pirate', 'navy']) {
      const base = this.bases[f];
      if (!base.alive) continue;
      if (now - base.lastTurretAt < BASE.turretCooldownMs) continue;
      let target = null, best = BASE.turretRange;
      for (const s of this._enemiesOf(f)) {
        if (s.safe) continue;
        const d = dist(s.pos, base.pos);
        if (d < best) { best = d; target = s; }
      }
      if (target) {
        base.lastTurretAt = now;
        const died = target.damage(BASE.turretDmg);
        if (died) this._killShip(target, null, 1, 'cannon', now, events);
      }
    }
  }

  _stepRespawns(now) {
    const still = [];
    for (const r of this.respawns) {
      if (now >= r.at) {
        const s = this.ships.get(r.id);
        if (s) {
          const rp = this.bases[s.faction].respawnPoint();
          s.pos = rp; s.hp = s.maxHp; s.alive = true; s.target = null; s.buffs = [];
          s.healingSince = null; s.safe = false;
        }
      } else still.push(r);
    }
    this.respawns = still;
  }

  _endGame(winner, events) {
    if (this.over) return;
    this.over = true;
    this.winner = winner;
    events.push({ type: 'gameOver', winner });
  }

  serialize() {
    return {
      ships: [...this.ships.values()].map((s) => s.serialize()),
      projectiles: this.projectiles.map((p) => p.serialize()),
      fires: this.fires.map((f) => f.serialize()),
      bases: [this.bases.pirate.serialize(), this.bases.navy.serialize()],
      over: this.over, winner: this.winner,
    };
  }
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `node --test tests/world.test.js`
Expected: PASS. (Also run full suite `node --test` — all green.)

- [ ] **Step 5: Commit**

```bash
git add server/game/world.js tests/world.test.js
git commit -m "feat: World integrates ships/weapons/skills/base into tick step"
```

---

## Phase 3 — Server wiring (integration)

### Task 11: Room (tick loop + snapshot broadcast)

**Files:**
- Create: `server/room.js`
- Test: `tests/room.test.js`

**Interfaces:**
- Consumes: `World`, `TICK_MS`, `MSG`.
- Produces: `class Room` with:
  - constructor `new Room(id, broadcast)` where `broadcast(obj)` is injected (testable without sockets).
  - `join({id,name,faction,cls,flagColor})` → adds ship, returns the Ship.
  - `leave(id)`.
  - `handle(id, msg)` → forwards intents to `world.input`.
  - `playerCount()`.
  - `tickOnce(now)` — single tick: `world.step`, broadcast snapshot, broadcast events if any.
  - `start()` / `stop()` — `setInterval` at `TICK_MS` driving `tickOnce`.

- [ ] **Step 1: Write the failing test**

```js
// tests/room.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../server/room.js';
import { MSG } from '../shared/constants.js';

test('room broadcasts snapshots on tick', () => {
  const sent = [];
  const room = new Room('r1', (obj) => sent.push(obj));
  room.join({ id:'a', name:'A', faction:'pirate', cls:'galleon', flagColor:'#f00' });
  room.join({ id:'b', name:'B', faction:'navy', cls:'sloop', flagColor:'#00f' });
  room.tickOnce(50);
  const snap = sent.find((m) => m.type === MSG.SNAPSHOT);
  assert.ok(snap, 'snapshot broadcast');
  assert.equal(snap.ships.length, 2);
});

test('handle forwards move intent', () => {
  const room = new Room('r2', () => {});
  const s = room.join({ id:'a', name:'A', faction:'pirate', cls:'sloop', flagColor:'#f00' });
  const before = s.pos.x;
  room.handle('a', { type:'move', x: s.pos.x + 400, y: s.pos.y });
  for (let i = 0; i < 30; i++) room.tickOnce(50 * (i + 1));
  assert.ok(room.world.ships.get('a').pos.x !== before);
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `node --test tests/room.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create server/room.js**

```js
// server/room.js
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
```

- [ ] **Step 4: Run test, verify it passes**

Run: `node --test tests/room.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/room.js tests/room.test.js
git commit -m "feat: Room tick loop + snapshot/event broadcast"
```

---

### Task 12: Server (HTTP static + WS + room routing)

**Files:**
- Create: `server/server.js`
- Test: manual (WebSocket smoke test) + checklist

**Interfaces:**
- Consumes: `ws`, `Room`, `MSG`, `SHIP_CLASSES`.
- Behavior:
  - HTTP serves files from `client/` and (read-only) `shared/` with correct MIME types; path traversal blocked.
  - WS on the same port; handles JSON messages:
    - `listRooms` → reply `rooms` `[{id, players}]`.
    - `join {room,nick,faction,shipClass,flagColor}` → validate faction/class vs `SHIP_CLASSES`; create/find room; add socket; reply `joined {playerId}`; `room.start()` if it was empty.
    - `move/fire/useSkill/donate` → `room.handle(playerId, msg)`.
  - On close: `leave`; stop + delete empty rooms.
  - Each room's `broadcast` sends to all sockets currently in that room.

- [ ] **Step 1: Create server/server.js**

```js
// server/server.js
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Room } from './room.js';
import { MSG, SHIP_CLASSES } from '../shared/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CLIENT_DIR = path.join(ROOT, 'client');
const PORT = process.env.PORT || 8080;

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json' };

const httpServer = http.createServer((req, res) => {
  const urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  // /shared/* is served from ROOT so the browser can import shared/constants.js
  const baseDir = urlPath.startsWith('/shared/') ? ROOT : CLIENT_DIR;
  const filePath = path.normalize(path.join(baseDir, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server: httpServer });

// roomId -> { room, sockets:Set }
const rooms = new Map();

function getRoom(id) {
  if (!rooms.has(id)) {
    const entry = { room: null, sockets: new Set() };
    entry.room = new Room(id, (obj) => {
      const data = JSON.stringify(obj);
      for (const ws of entry.sockets) { if (ws.readyState === ws.OPEN) ws.send(data); }
    });
    rooms.set(id, entry);
  }
  return rooms.get(id);
}

function roomList() {
  return [...rooms.entries()].map(([id, e]) => ({ id, players: e.room.playerCount() }));
}

let _id = 0;
wss.on('connection', (ws) => {
  ws.playerId = 'pl' + (++_id);
  ws.roomId = null;

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === MSG.LIST_ROOMS) {
      ws.send(JSON.stringify({ type: MSG.ROOMS, rooms: roomList() }));
      return;
    }
    if (msg.type === MSG.JOIN) {
      const { room, nick, faction, shipClass, flagColor } = msg;
      if (!SHIP_CLASSES[faction] || !SHIP_CLASSES[faction].includes(shipClass)) {
        ws.send(JSON.stringify({ type: MSG.ERROR, error: 'invalid faction/ship' })); return;
      }
      const entry = getRoom(room || 'default');
      const wasEmpty = entry.room.playerCount() === 0;
      entry.sockets.add(ws);
      ws.roomId = room || 'default';
      entry.room.join({ id: ws.playerId, name: (nick||'Sailor').slice(0,16), faction, cls: shipClass, flagColor: flagColor || '#ffffff' });
      ws.send(JSON.stringify({ type: MSG.JOINED, playerId: ws.playerId }));
      if (wasEmpty) entry.room.start();
      return;
    }
    if (ws.roomId && rooms.has(ws.roomId)) {
      rooms.get(ws.roomId).room.handle(ws.playerId, msg);
    }
  });

  ws.on('close', () => {
    if (ws.roomId && rooms.has(ws.roomId)) {
      const entry = rooms.get(ws.roomId);
      entry.sockets.delete(ws);
      entry.room.leave(ws.playerId);
      if (entry.room.playerCount() === 0) { entry.room.stop(); rooms.delete(ws.roomId); }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Naval battle server on http://localhost:${PORT} (LAN: http://<your-ip>:${PORT})`);
});
```

- [ ] **Step 2: Manual smoke test — server boots**

Run: `node server/server.js`
Expected: prints `Naval battle server on http://localhost:8080 ...`. Ctrl-C to stop.

- [ ] **Step 3: Manual smoke test — WS join round-trip**

Create a throwaway `tmp_wsclient.mjs` in the scratchpad (not committed):
```js
import WebSocket from 'ws';
const ws = new WebSocket('ws://localhost:8080');
ws.on('open', () => ws.send(JSON.stringify({ type:'join', room:'r1', nick:'Test', faction:'pirate', shipClass:'sloop', flagColor:'#f00' })));
let n = 0;
ws.on('message', (d) => {
  const m = JSON.parse(d);
  if (m.type === 'joined') console.log('JOINED', m.playerId);
  if (m.type === 'snapshot' && n++ < 1) { console.log('SNAPSHOT ships=', m.ships.length); ws.close(); process.exit(0); }
});
```
Run server in one shell, then: `node <scratchpad>/tmp_wsclient.mjs`
Expected: prints `JOINED plN` then `SNAPSHOT ships= 1`.

- [ ] **Step 4: Commit**

```bash
git add server/server.js
git commit -m "feat: HTTP static + WS server with room routing"
```

---

## Phase 4 — Client (isometric render + input + lobby)

> Client tasks are integration-tested manually in a browser (documented checklists). Pure math (`iso.js`) is unit-tested.

### Task 13: Isometric transforms + client scaffold

**Files:**
- Create: `client/index.html`, `client/css/style.css`, `client/js/iso.js`, `client/js/net.js`
- Test: `tests/iso.test.js`

**Interfaces:**
- `iso.js` (pure, no DOM): `worldToScreen(x, y, cam)` → `{sx, sy}` (2:1 isometric); `screenToWorld(sx, sy, cam)` → `{x, y}` inverse; `TILE = {w:64, h:32}`. `cam = {x, y, scale, cx, cy}` (world focus + screen center).
- `net.js`: `class Net { connect(url):Promise; on(type, cb); send(obj); }` thin WS wrapper dispatching by `msg.type`.

- [ ] **Step 1: Write the failing test (iso math round-trips)**

```js
// tests/iso.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worldToScreen, screenToWorld } from '../client/js/iso.js';

test('worldToScreen/screenToWorld are inverses', () => {
  const cam = { x: 1000, y: 800, scale: 1, cx: 400, cy: 300 };
  const { sx, sy } = worldToScreen(1200, 900, cam);
  const back = screenToWorld(sx, sy, cam);
  assert.ok(Math.abs(back.x - 1200) < 1e-6);
  assert.ok(Math.abs(back.y - 900) < 1e-6);
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `node --test tests/iso.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create client/js/iso.js**

```js
// client/js/iso.js
export const TILE = { w: 64, h: 32 };
const SX = TILE.w / 128; // world-unit -> iso scale factors (tuned)
const SY = TILE.h / 128;

export function worldToScreen(x, y, cam) {
  const wx = x - cam.x, wy = y - cam.y;
  const ix = (wx - wy) * SX * cam.scale;
  const iy = (wx + wy) * SY * cam.scale;
  return { sx: cam.cx + ix, sy: cam.cy + iy };
}

export function screenToWorld(sx, sy, cam) {
  const ix = (sx - cam.cx) / (SX * cam.scale);
  const iy = (sy - cam.cy) / (SY * cam.scale);
  const wx = (ix + iy) / 2;
  const wy = (iy - ix) / 2;
  return { x: wx + cam.x, y: wy + cam.y };
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `node --test tests/iso.test.js`
Expected: PASS.

- [ ] **Step 5: Create client/js/net.js**

```js
// client/js/net.js
export class Net {
  constructor() { this.ws = null; this.handlers = {}; }
  connect(url) {
    this.ws = new WebSocket(url);
    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      (this.handlers[msg.type] || []).forEach((cb) => cb(msg));
    };
    return new Promise((res) => { this.ws.onopen = () => res(); });
  }
  on(type, cb) { (this.handlers[type] ||= []).push(cb); }
  send(obj) { if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj)); }
}
```

- [ ] **Step 6: Create client/index.html**

```html
<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Deniz Savaşı</title>
  <link rel="stylesheet" href="/css/style.css" />
</head>
<body>
  <div id="lobby" class="screen">
    <h1>⚓ Deniz Savaşı</h1>
    <div id="roomList"></div>
    <form id="joinForm">
      <input id="room" placeholder="Oda adı" value="oda1" />
      <input id="nick" placeholder="Rumuz" value="Denizci" />
      <div class="factions">
        <label><input type="radio" name="faction" value="pirate" checked /> 🏴‍☠️ Korsan</label>
        <label><input type="radio" name="faction" value="navy" /> ⚓ Donanma</label>
      </div>
      <div id="ships" class="ships"></div>
      <label>Bayrak: <input type="color" id="flag" value="#e63946" /></label>
      <button type="submit">Savaşa Gir</button>
    </form>
  </div>
  <canvas id="game" class="screen hidden"></canvas>
  <div id="endScreen" class="screen hidden"></div>
  <script type="module" src="/js/game.js"></script>
</body>
</html>
```

- [ ] **Step 7: Create client/css/style.css**

```css
/* client/css/style.css */
* { box-sizing: border-box; }
body { margin:0; font-family: system-ui, sans-serif; background:#0b1e2d; color:#e8f1f8; overflow:hidden; }
.screen { position:absolute; inset:0; }
.hidden { display:none !important; }
#lobby { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; padding:24px; }
#lobby h1 { font-size:2.4rem; }
#joinForm { display:flex; flex-direction:column; gap:12px; width:min(420px,90vw); background:#12324a; padding:20px; border-radius:12px; }
#joinForm input#room, #joinForm input#nick { padding:10px; border-radius:8px; border:1px solid #24506f; background:#0d2537; color:#fff; }
.factions { display:flex; gap:16px; }
.ships { display:grid; grid-template-columns:repeat(5,1fr); gap:6px; }
.ships .ship { padding:8px 4px; border:1px solid #24506f; border-radius:8px; cursor:pointer; text-align:center; font-size:.72rem; }
.ships .ship.sel { background:#1d6fa5; border-color:#4db5ff; }
#joinForm button { padding:12px; border:0; border-radius:8px; background:#e63946; color:#fff; font-weight:700; cursor:pointer; }
#game { display:block; width:100vw; height:100vh; background:#12455f; }
#endScreen { display:flex; align-items:center; justify-content:center; font-size:2rem; background:rgba(0,0,0,.6); text-align:center; }
#endScreen button { margin-top:14px; padding:10px 20px; border:0; border-radius:8px; background:#4db5ff; cursor:pointer; }
```

- [ ] **Step 8: Commit**

```bash
git add client/index.html client/css/style.css client/js/iso.js client/js/net.js tests/iso.test.js
git commit -m "feat: client scaffold + isometric transforms + net wrapper"
```

---

### Task 14: Ship vector art + world/HUD renderer + interpolation

**Files:**
- Create: `client/js/interpolate.js`, `client/js/ships/draw.js`, `client/js/render.js`
- Test: manual (browser) + checklist

**Interfaces:**
- `interpolate.js`: `class SnapshotBuffer { push(snap); sample(renderTime) }` returns interpolated `{ships, projectiles, fires, bases, over, winner}` between the two snapshots straddling `renderTime`.
- `ships/draw.js`: `drawShip(ctx, ship, pos, scale)` — vector hull sized per `ship.cls`, faction-colored, with player flag color, HP bar, and name; special silhouettes for `fireship` (brazier) and `bombketch` (mortar).
- `render.js`: `class Renderer { constructor(canvas); resize(); draw(state, cam, meId) }` paints sea, islands (client mirror of `ISLANDS`), bases + heal circles + base HP, fires, projectiles, depth-sorted ships, and HUD (both base HP, own HP/streak/buffs). Exports `ISLANDS`.

- [ ] **Step 1: Create client/js/interpolate.js**

```js
// client/js/interpolate.js
export class SnapshotBuffer {
  constructor() { this.snaps = []; }
  push(snap) { this.snaps.push(snap); if (this.snaps.length > 20) this.snaps.shift(); }
  sample(renderTime) {
    const s = this.snaps;
    if (s.length === 0) return null;
    if (s.length === 1) return s[0];
    let a = s[0], b = s[s.length - 1];
    for (let i = 0; i < s.length - 1; i++) {
      if (s[i].t <= renderTime && s[i + 1].t >= renderTime) { a = s[i]; b = s[i + 1]; break; }
    }
    const span = b.t - a.t || 1;
    const f = Math.max(0, Math.min(1, (renderTime - a.t) / span));
    const byId = (arr) => { const m = new Map(); for (const o of arr) m.set(o.id, o); return m; };
    const bs = byId(b.ships);
    const ships = a.ships.map((sa) => {
      const sb = bs.get(sa.id) || sa;
      return { ...sb, x: sa.x + (sb.x - sa.x) * f, y: sa.y + (sb.y - sa.y) * f };
    });
    return { ships, projectiles: b.projectiles, fires: b.fires, bases: b.bases, over: b.over, winner: b.winner };
  }
}
```

- [ ] **Step 2: Create client/js/ships/draw.js**

```js
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
```

- [ ] **Step 3: Create client/js/render.js**

```js
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
```

- [ ] **Step 4: Commit**

```bash
git add client/js/interpolate.js client/js/ships/draw.js client/js/render.js
git commit -m "feat: snapshot interpolation + vector ship art + world/HUD renderer"
```

---

### Task 15: Input + lobby + client entry (playable end-to-end)

**Files:**
- Create: `client/js/input.js`, `client/js/lobby.js`, `client/js/game.js`
- Test: manual browser playtest + checklist

**Interfaces:**
- `input.js`: `class Input { constructor(canvas, cam, net, getState, getMeId) }` — left-click = `move` to `screenToWorld`; right-click drag+release = fire cannon (direction from own ship to release point, drag length → `power` 0..1); keys: `A` = archer toward mouse, `M` = molotov at mouse world point, `D` = donate to nearest teammate.
- `lobby.js`: `class Lobby { constructor(net, onStart) }` — renders ship buttons for chosen faction from `SHIP_CLASSES`, handles faction toggle + room list, on submit calls `onStart(joinInfo)`.
- `game.js`: entry — create `Net`, `Renderer`, `SnapshotBuffer`, `Lobby`, `Input`; wire `joined`/`snapshot`/`event`; run `requestAnimationFrame` loop sampling at `serverNow - 100ms`; camera follows own ship; show end screen on `gameOver`.

- [ ] **Step 1: Create client/js/input.js**

```js
// client/js/input.js
import { screenToWorld } from './iso.js';

export class Input {
  constructor(canvas, cam, net, getState, getMeId) {
    this.canvas = canvas; this.cam = cam; this.net = net;
    this.getState = getState; this.getMeId = getMeId;
    this.mouse = { x: 0, y: 0 };
    this.aiming = false; this.aimStart = null;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousemove', (e) => { this.mouse = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('mousedown', (e) => this._down(e));
    canvas.addEventListener('mouseup', (e) => this._up(e));
    window.addEventListener('keydown', (e) => this._key(e));
  }
  _me() { return (this.getState()?.ships || []).find((s) => s.id === this.getMeId()); }
  _down(e) {
    if (e.button === 0) {
      const w = screenToWorld(e.clientX, e.clientY, this.cam);
      this.net.send({ type: 'move', x: w.x, y: w.y });
    } else if (e.button === 2) { this.aiming = true; this.aimStart = { x: e.clientX, y: e.clientY }; }
  }
  _up(e) {
    if (e.button === 2 && this.aiming) {
      this.aiming = false;
      const me = this._me(); if (!me) return;
      const w = screenToWorld(e.clientX, e.clientY, this.cam);
      const dir = { x: w.x - me.x, y: w.y - me.y };
      const dragLen = Math.hypot(e.clientX - this.aimStart.x, e.clientY - this.aimStart.y);
      const power = Math.max(0.1, Math.min(1, dragLen / 300));
      this.net.send({ type: 'fire', weapon: 'cannon', dir, power });
    }
  }
  _key(e) {
    const me = this._me(); if (!me) return;
    const w = screenToWorld(this.mouse.x, this.mouse.y, this.cam);
    const k = e.key.toLowerCase();
    if (k === 'a') this.net.send({ type:'fire', weapon:'archer', dir:{ x:w.x-me.x, y:w.y-me.y } });
    if (k === 'm') this.net.send({ type:'fire', weapon:'molotov', aim:{ x:w.x, y:w.y } });
    if (k === 'd') {
      const mates = (this.getState()?.ships || []).filter((s) => s.faction === me.faction && s.id !== me.id);
      if (mates.length) {
        mates.sort((p, q) => Math.hypot(p.x-me.x,p.y-me.y) - Math.hypot(q.x-me.x,q.y-me.y));
        this.net.send({ type:'donate', targetPlayerId: mates[0].id });
      }
    }
  }
}
```

- [ ] **Step 2: Create client/js/lobby.js**

```js
// client/js/lobby.js
import { SHIP_CLASSES } from '/shared/constants.js';

const SHIP_LABEL = {
  sloop:'Salapurya', brig:'Uşkuna', frigate:'Firkateyn', galleon:'Kalyon', fireship:'Ateş Gemisi',
  cutter:'Karakol', corvette:'Korvet', frigate_n:'Firkateyn', shipofline:'Hat Gemisi', bombketch:'Havan',
};

export class Lobby {
  constructor(net, onStart) {
    this.net = net; this.onStart = onStart; this.selected = null;
    this.form = document.getElementById('joinForm');
    this.shipsEl = document.getElementById('ships');
    this.factionInputs = [...document.querySelectorAll('input[name=faction]')];
    this.factionInputs.forEach((r) => r.addEventListener('change', () => this.renderShips()));
    this.form.addEventListener('submit', (e) => this._submit(e));
    net.on('rooms', (m) => this._rooms(m.rooms));
    this.renderShips();
  }
  faction() { return this.factionInputs.find((r) => r.checked).value; }
  renderShips() {
    const f = this.faction();
    this.selected = SHIP_CLASSES[f][0];
    this.shipsEl.innerHTML = '';
    for (const id of SHIP_CLASSES[f]) {
      const d = document.createElement('div');
      d.className = 'ship' + (id === this.selected ? ' sel' : '');
      d.textContent = SHIP_LABEL[id] || id;
      d.onclick = () => { this.selected = id; [...this.shipsEl.children].forEach((c) => c.classList.remove('sel')); d.classList.add('sel'); };
      this.shipsEl.appendChild(d);
    }
  }
  _rooms(rooms) {
    const el = document.getElementById('roomList');
    el.textContent = rooms.length ? 'Odalar: ' + rooms.map((r) => `${r.id}(${r.players})`).join(', ') : 'Henüz oda yok';
  }
  _submit(e) {
    e.preventDefault();
    this.onStart({
      room: document.getElementById('room').value || 'oda1',
      nick: document.getElementById('nick').value || 'Denizci',
      faction: this.faction(),
      shipClass: this.selected,
      flagColor: document.getElementById('flag').value,
    });
  }
}
```

- [ ] **Step 3: Create client/js/game.js**

```js
// client/js/game.js
import { Net } from './net.js';
import { Renderer } from './render.js';
import { SnapshotBuffer } from './interpolate.js';
import { Lobby } from './lobby.js';
import { Input } from './input.js';

const net = new Net();
const buffer = new SnapshotBuffer();
let meId = null;
let renderer = null;
const cam = { x: 500, y: 500, scale: 1, cx: 0, cy: 0 };
let latestState = null;
let clockOffset = 0; // Date.now() - serverT

const currentState = () => latestState;
const myId = () => meId;

async function boot() {
  await net.connect(`ws://${location.host}`);
  net.send({ type: 'listRooms' });

  net.on('joined', (m) => {
    meId = m.playerId;
    document.getElementById('lobby').classList.add('hidden');
    const canvas = document.getElementById('game');
    canvas.classList.remove('hidden');
    renderer = new Renderer(canvas);
    window.addEventListener('resize', () => renderer.resize());
    new Input(canvas, cam, net, currentState, myId);
    requestAnimationFrame(loop);
  });

  net.on('snapshot', (m) => { buffer.push(m); clockOffset = Date.now() - m.t; });
  net.on('event', (m) => { for (const e of m.events) if (e.type === 'gameOver') showEnd(e.winner); });

  new Lobby(net, (info) => net.send({ type: 'join', ...info }));
}

function loop() {
  const renderTime = Date.now() - clockOffset - 100;
  const state = buffer.sample(renderTime);
  if (state && renderer) {
    latestState = state;
    const me = state.ships.find((s) => s.id === meId);
    if (me) { cam.x = me.x; cam.y = me.y; }
    renderer.draw(state, cam, meId);
  }
  requestAnimationFrame(loop);
}

function showEnd(winner) {
  const el = document.getElementById('endScreen');
  el.classList.remove('hidden');
  const mine = latestState?.ships.find((s) => s.id === meId);
  const win = mine && mine.faction === winner;
  el.innerHTML = `<div>${win ? '🏆 ZAFER' : '💀 MAĞLUP'} — Kazanan: ${winner === 'pirate' ? 'Korsan' : 'Donanma'}<br><button onclick="location.reload()">Tekrar</button></div>`;
}

boot();
```

- [ ] **Step 4: Manual playtest checklist (two browser tabs)**

Run: `node server/server.js`. Open two tabs at `http://localhost:8080`.
- [ ] Tab 1: pick Korsan + ship + flag color → Savaşa Gir → canvas shows own ship at pirate base.
- [ ] Tab 2: pick Donanma + ship → joins same room `oda1`.
- [ ] Left-click moves your ship along an isometric path.
- [ ] Right-click drag + release fires a cannonball; hitting the enemy drops its HP bar; closer aim hurts more.
- [ ] `A` fires an archer volley; `M` drops a fire area; sitting in enemy fire drains HP.
- [ ] Sail into your base circle, wait ~2s → HP regenerates; can't fire while healing.
- [ ] Reduce a base to 0 → victory/defeat screen appears in both tabs.
- [ ] No console errors.

- [ ] **Step 5: Full test suite + commit**

Run: `node --test`
Expected: all unit tests green.

```bash
git add client/js/input.js client/js/lobby.js client/js/game.js
git commit -m "feat: input, lobby, client entry — playable end-to-end"
```

---

### Task 16: README + run instructions

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README.md**

````markdown
# Deniz Savaşı (Naval Battle)

LAN multiplayer isometric ship-battle. Pirates vs Navy. Node.js authoritative server + vanilla Canvas client.

## Run
```
npm install
npm start
```
Open `http://<server-LAN-IP>:8080` in each player's browser.

## Controls
- Left click: move ship (RTS)
- Right click + drag + release: fire cannon (drag length = power; closer aim = more damage)
- `A`: archer volley toward mouse
- `M`: molotov / mortar at mouse
- `D`: donate your oldest active buff to nearest teammate (near your base)

## Rules
- Destroy the enemy base to win. Your base is respawn + heal zone (wait ~2s inside to heal; can't fire while healing).
- Kill streaks grant timed buffs (3/5/7/10 in a row; multi-kills grant chain/shock).

## Test
```
npm test
```

## Tuning
All numbers live in `server/game/balance.js` (+ `BUFF_MS`). Map/islands in `server/game/map.js` — mirror the client copy in `client/js/render.js`.
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with run/controls/tuning"
```

---

## Self-Review (author check)

**Spec coverage:**
- Room select / nickname / faction / ship / flag color / team → Lobby (Task 15) + join (Task 12). ✓
- Two teams / factions with own ship pools → `SHIP_CLASSES` (Task 1), lobby filter (Task 15). ✓
- Distinct ship stats + advantages → balance table + rock-paper-scissors tuning (Task 3). ✓
- Streak skills (5-kill, 3-in-one-shot, etc.) → skills.js (Task 9), wired in world (Task 10). ✓
- Cannon distance-damage (close high, far low) → Task 6. ✓
- Archer + molotov → Task 7. ✓
- Healing base + wait + donation → Task 8 (logic), wired Task 10/15. ✓
- Pirate vs Navy ship pools → constants + lobby filter by faction. ✓
- Isometric vector rendering → Tasks 13–14. ✓
- Win by destroying base → Task 10 (`_endGame`), end screen Task 15. ✓

**Placeholder scan:** No TBD/TODO; every code step contains full code. ✓

**Type consistency:** `Ship` fields (`safe`, `healingSince`, `buffs`, `streak`, `archerKills`) defined Task 5, used Tasks 8–10. Weapon factories (`makeCannon`, `makeArcherVolley`, `makeMolotov`, `FireArea`, `Projectile`) defined Tasks 6–7, consumed Task 10. `World` API (`addShip`, `input`, `step`, `serialize`) consumed by Room (Task 11) and server (Task 12). Snapshot shape (`ships/projectiles/fires/bases/over/winner`) consistent between `World.serialize` (Task 10), interpolation (Task 14), renderer (Task 14). ✓

**Known follow-ups (acceptable for v1):** client island list is a manual mirror of the server's (documented in README + Task 14); mortar `burst` uses a `_burst` flag to fire once; `shockwave` buff is granted but its knockback/stun effect is a v1.1 enhancement (buff is tracked and displayed).
```
