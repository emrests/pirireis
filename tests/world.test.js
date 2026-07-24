// tests/world.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../server/game/world.js';

function twoShips() {
  const w = new World('room1');
  const a = w.addShip({ id:'a', name:'A', faction:'pirate', cls:'galleon', flagColor:'#f00' });
  const b = w.addShip({ id:'b', name:'B', faction:'navy',   cls:'sloop',   flagColor:'#00f' });
  a.pos = { x: 2000, y: 300 }; // north edge, out of the kraken's mid-map reach
  b.pos = { x: 2000, y: 400 };
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
  a.pos = { x:2000, y:300 }; c.pos = { x:2000, y:400 };
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

test('malformed move (non-numeric) is ignored, ship position stays finite', () => {
  const { w, a } = twoShips();
  const before = { x: a.pos.x, y: a.pos.y };
  assert.doesNotThrow(() => w.input('a', { type:'move', x:'bad', y:1 }));
  w.step(50, 100);
  assert.equal(a.pos.x, before.x);
  assert.equal(a.pos.y, before.y);
  assert.ok(Number.isFinite(a.pos.x) && Number.isFinite(a.pos.y));
});

test('malformed move (missing fields) does not crash and is ignored', () => {
  const { w, a } = twoShips();
  const before = { x: a.pos.x, y: a.pos.y };
  assert.doesNotThrow(() => w.input('a', { type:'move' }));
  w.step(50, 100);
  assert.equal(a.pos.x, before.x);
  assert.equal(a.pos.y, before.y);
});

test('malformed fire (missing dir) does not crash and does not fire', () => {
  const { w, b } = twoShips();
  const before = b.hp;
  assert.doesNotThrow(() => w.input('a', { type:'fire', weapon:'cannon' }));
  for (let i = 0; i < 10; i++) w.step(50, 100 + i * 50);
  assert.equal(b.hp, before, 'no projectile fired, no damage');
});

test('malformed fire (non-finite dir fields) does not crash and does not fire', () => {
  const { w, b } = twoShips();
  const before = b.hp;
  assert.doesNotThrow(() => w.input('a', { type:'fire', weapon:'cannon', dir:{ x:'nope', y:1 } }));
  for (let i = 0; i < 10; i++) w.step(50, 100 + i * 50);
  assert.equal(b.hp, before);
});

test('malformed molotov aim does not crash and does not throw fire', () => {
  const { w } = twoShips();
  assert.doesNotThrow(() => w.input('a', { type:'fire', weapon:'molotov', aim:{ x:NaN, y:5 } }));
  assert.equal(w.fires.length, 0);
});

test('malformed donate (non-string targetPlayerId) does not crash', () => {
  const { w } = twoShips();
  assert.doesNotThrow(() => w.input('a', { type:'donate', targetPlayerId: 123 }));
});

test('heal charge needs 100 damage dealt, then gives +20 HP', () => {
  const w = new World('r');
  const a = w.addShip({ id:'a', name:'A', faction:'pirate', cls:'galleon', flagColor:'#f00' });
  a.pos = { x: 2000, y: 200 };
  a.hp = a.maxHp - 50;
  // not enough charge -> no heal
  a.dmgDealt = 50;
  w.input('a', { type:'heal' });
  assert.equal(a.hp, a.maxHp - 50, 'no heal below a full charge');
  // full charge -> +20 and charge spent
  a.dmgDealt = 100;
  w.input('a', { type:'heal' });
  assert.equal(a.hp, a.maxHp - 30, '+20 HP');
  assert.ok(a.dmgDealt < 100, 'charge spent');
});

test('bases spawn low-HP NPC soldier boats on the interval', () => {
  const w = new World('r');
  w.addShip({ id:'a', name:'A', faction:'pirate', cls:'galleon', flagColor:'#f00' });
  w.setNpcInterval(3000);
  for (let t = 0; t <= 3100; t += 50) w.step(50, t);
  const npcs = [...w.ships.values()].filter((s) => s.npc);
  assert.ok(npcs.length >= 2, `spawned NPC boats (${npcs.length})`);
  assert.equal(npcs[0].cls, 'boat');
  assert.equal(npcs[0].maxHp, 15);
  // NPCs must not inflate base HP (players only)
  assert.equal(w.bases.navy.maxHp, 100); // 1 pirate player -> navy base 100
});

test('ships cannot sail through each other (pushed apart)', () => {
  const w = new World('r');
  const a = w.addShip({ id:'a', name:'A', faction:'pirate', cls:'frigate', flagColor:'#f00' });
  const b = w.addShip({ id:'b', name:'B', faction:'pirate', cls:'frigate', flagColor:'#f00' });
  a.pos = { x: 2000, y: 300 }; b.pos = { x: 2000, y: 306 }; // overlapping
  w.step(50, 100);
  const d = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
  assert.ok(d >= a.radius + b.radius - 1, `ships separated (d=${d})`);
});

test('base takes damage from a shot landing on it from the side', () => {
  const w = new World('r');
  const a = w.addShip({ id:'a', name:'A', faction:'pirate', cls:'galleon', flagColor:'#f00' });
  a.pos = { x: 3600, y: 2320 }; // south of the navy base
  const before = w.bases.navy.hp;
  w.input('a', { type:'fire', weapon:'cannon', dir:{ x:0, y:-1 }, power:1 });
  for (let i = 0; i < 20; i++) w.step(50, 100 + i * 50);
  assert.ok(w.bases.navy.hp < before, 'base damaged from the side');
});

test('rifle press starts a 5-round burst that fires over time then reloads', () => {
  const w = new World('r');
  const a = w.addShip({ id:'a', name:'A', faction:'pirate', cls:'brig', flagColor:'#f00' });
  a.pos = { x: 2000, y: 500 };
  w.input('a', { type:'fire', weapon:'archer', dir:{ x:1, y:0 } });
  assert.equal(a.gunBurst.remaining, 5, 'burst queued, none fired yet');
  let fired = 0; const seen = new Set();
  for (let t = 0; t <= 700; t += 50) {
    w.step(50, t);
    for (const p of w.projectiles) if (p.kind === 'bullet' && !seen.has(p.id)) { seen.add(p.id); fired++; }
  }
  assert.equal(fired, 5, 'exactly five bullets fired across the burst');
  assert.equal(a.gunBurst, null, 'burst finished');
  // still reloading right after -> a second press does nothing
  w.input('a', { type:'fire', weapon:'archer', dir:{ x:1, y:0 } });
  assert.equal(a.gunBurst, null, 'cannot re-fire during reload');
});
