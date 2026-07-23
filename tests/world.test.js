// tests/world.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../server/game/world.js';

function twoShips() {
  const w = new World('room1');
  const a = w.addShip({ id:'a', name:'A', faction:'pirate', cls:'galleon', flagColor:'#f00' });
  const b = w.addShip({ id:'b', name:'B', faction:'navy',   cls:'sloop',   flagColor:'#00f' });
  a.pos = { x: 2000, y: 500 };
  b.pos = { x: 2000, y: 600 };
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
  a.pos = { x:2000, y:500 }; c.pos = { x:2000, y:600 };
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
